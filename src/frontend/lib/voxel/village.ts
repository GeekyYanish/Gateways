import { WORLD_LOCATIONS } from "@/frontend/lib/world/world-locations";
import {
  COURTYARD,
  DOOR_H,
  DOOR_W,
  ENTRANCE_X,
  FURNITURE,
  GRID_X,
  GRID_Z,
  PLAN_MAX,
  RING,
  ROOMS,
  WALL_H,
  gridCentre,
  gridRect,
  gv,
  gx,
  gz,
  type RoomSpec,
  type Wall,
} from "@/frontend/lib/world/floor-plan";
import { VoxelWorld, makeRng, type WorldAnchor } from "./world";
import type { BlockType } from "./blocks";

/**
 * Builds our building as voxels.
 *
 * This is not a procedural village any more — it is the floor plan in
 * `@/frontend/lib/world/floor-plan.ts` extruded into blocks: a corridor ring
 * around an open courtyard, with classrooms A–G, the Staff Room and the
 * sitting area / café hanging off it. The plan file owns every dimension; this
 * file owns only how those dimensions become blocks.
 *
 * The realm's NAMES are still original fiction (Hackathon Mine, Wardens' Hall)
 * and the architecture is generic blocky construction — nothing here copies
 * Minecraft builds or textures.
 *
 * Seeded, so the world is byte-identical on every load. Only the scatter
 * decoration is random at all; the building itself is fully determined.
 *
 * **No ceilings.** Rooms are open-top boxes, which is what lets the 2D map read
 * as a floor plan from above. Conditional ceilings arrive with the interiors
 * pass, together with an indoor camera.
 */

/**
 * Village grid dimensions. Exported because the 2D map derives its canvas size
 * from them — hardcoding them in two files is how the two views drift apart.
 * Both come from the floor plan's own extent, so they cannot disagree with it.
 */
export const VILLAGE_SIZE = GRID_X;
export const VILLAGE_SIZE_Z = GRID_Z;

const SEED = 20260726;

/**
 * The single floor level; everything stands on `GROUND + 1`.
 *
 * One layer, not a crust. On flat ground a deeper slab is pure cost: the
 * buried blocks are culled by `visibleBlocks()`, but the BOTTOM face of the
 * lowest layer is still emitted whatever its depth, so extra layers buy
 * nothing. (That bottom face is itself culled at y = 0 by the renderer — see
 * `faceVisible` in `voxel-terrain.tsx`.)
 */
const GROUND = 0;

const WALL_V = gv(WALL_H);
const DOOR_WV = gv(DOOR_W);
const DOOR_HV = gv(DOOR_H);
/** Height of the parapet between the corridor and the courtyard. */
const PARAPET_V = 2;

export interface VillageResult {
  world: VoxelWorld;
  anchors: WorldAnchor[];
  /** Where the player spawns — outside the main doors, facing the building. */
  spawn: { x: number; y: number; z: number };
  /**
   * Camera yaw at spawn, radians, in the controller's convention
   * (forward = `(sin yaw, cos yaw)`).
   *
   * Not a detail: the old village spawned you in a square with buildings on
   * every side, so any yaw framed something. This world is a single building
   * entirely to the north of the spawn, and the default yaw of 0 put the camera
   * north of the player looking south — at an empty field, with the whole
   * building behind the camera. It also meant W walked away from the doors.
   */
  spawnYaw: number;
}

interface GridRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** The grid line a named wall of a rect sits on, and the axis it runs along. */
function wallRun(wall: Wall, g: GridRect) {
  const horizontal = wall === "n" || wall === "s";
  return {
    horizontal,
    fixed: wall === "n" ? g.z0 : wall === "s" ? g.z1 : wall === "w" ? g.x0 : g.x1,
    from: horizontal ? g.x0 : g.z0,
    to: horizontal ? g.x1 : g.z1,
  };
}

/** Centred span of `width` cells along a run. */
function centredSpan(from: number, to: number, width: number) {
  const start = Math.floor((from + to) / 2) - Math.floor(width / 2);
  return { start, end: start + width - 1 };
}

export function buildVillage(): VillageResult {
  const rng = makeRng(SEED);
  const world = new VoxelWorld(GRID_X, GRID_Z);

  const ring = gridRect(RING);
  const court = gridRect(COURTYARD);

  // ---- floor -------------------------------------------------------------
  // One flat slab over the whole grid: grass by default, then overridden where
  // the building stands. There is no terrain height at all — a real floor plan
  // has one level, and rolling ground under it would only fight the geometry.
  for (let x = 0; x < GRID_X; x++) {
    for (let z = 0; z < GRID_Z; z++) world.set(x, GROUND, z, "grass");
  }

  /**
   * Two-tone tiling on a 2×2 grid.
   *
   * Ambient occlusion gives a room its corners, but the middle of a 6,000-block
   * floor is untouched by it — as one flat colour it reads as a void with walls
   * around it, and you lose all sense of how big the space is or how fast you
   * are walking. A checker is the cheapest possible fix: no extra blocks, no
   * extra draw call, and it doubles as a scale reference.
   */
  const tileRect = (g: GridRect, a: BlockType = "floorTile", b: BlockType = "floorTileAlt") => {
    for (let x = g.x0; x <= g.x1; x++) {
      for (let z = g.z0; z <= g.z1; z++) {
        world.set(x, GROUND, z, ((x >> 1) + (z >> 1)) % 2 === 0 ? a : b);
      }
    }
  };

  const ACCENT_CARPET: Record<string, BlockType> = {
    red: "carpet",
    blue: "carpetBlue",
    green: "carpetGreen",
    gold: "carpetGold",
    purple: "carpetPurple",
  };

  tileRect(ring);
  // The courtyard is paved, not sandy: it is the biggest single surface in the
  // world, and one flat tone across 2,600 blocks reads as a void the building
  // happens to surround.
  tileRect(court, "paving", "pavingAlt");
  for (const room of ROOMS) {
    const g = gridRect(room);
    tileRect(g);
    // Carpet inset one voxel from the walls, so a tiled border still shows and
    // the room reads as furnished rather than painted.
    if (room.accent) {
      world.fill(
        g.x0 + 2, GROUND, g.z0 + 2,
        g.x1 - 2, GROUND, g.z1 - 2,
        ACCENT_CARPET[room.accent],
      );
    }
  }

  /**
   * Openings: columns where a wall must be left air, and how far up.
   *
   * Collected BEFORE any wall is built, because a room's doorway usually
   * pierces a wall the room does not own — the classrooms' doors go through the
   * corridor ring's outer wall, which is emitted by a different loop. Punching
   * afterwards is not an option (`VoxelWorld` has no delete), and building the
   * ring in segments around every room would put the door positions in two
   * places at once. One shared map keeps the two loops honest.
   */
  const openings = new Map<string, number>();
  const openColumn = (x: number, z: number, height: number) => {
    const k = `${x},${z}`;
    openings.set(k, Math.max(openings.get(k) ?? 0, height));
  };
  const openingAt = (x: number, z: number) => openings.get(`${x},${z}`) ?? 0;

  const markOpening = (wall: Wall, g: GridRect, width: number, height: number) => {
    const run = wallRun(wall, g);
    const span = width >= run.to - run.from ? { start: run.from, end: run.to } : centredSpan(run.from, run.to, width);
    for (let a = span.start; a <= span.end; a++) {
      openColumn(run.horizontal ? a : run.fixed, run.horizontal ? run.fixed : a, height);
    }
  };

  for (const room of ROOMS) {
    const g = gridRect(room);
    if (room.door) markOpening(room.door, g, DOOR_WV, DOOR_HV);
    for (const wall of room.open ?? []) markOpening(wall, g, Infinity, WALL_V);
  }
  // Four archways through the courtyard parapet, so the square is reachable
  // from every arm of the corridor rather than only where a room happens to be.
  for (const wall of ["n", "s", "e", "w"] as const) {
    markOpening(wall, court, 12, PARAPET_V);
  }

  // ---- walls -------------------------------------------------------------

  /**
   * Emit one wall of a rect, honouring `openings`.
   *
   * `window` puts a glass band at eye height, `board` a dark panel — both skip
   * the wall's end cells so corners stay solid, which is what stops a room
   * reading as a floating frame from inside.
   */
  const emitWall = (
    wall: Wall,
    g: GridRect,
    o: { type: BlockType; height?: number; window?: boolean; board?: boolean },
  ) => {
    const run = wallRun(wall, g);
    const height = o.height ?? WALL_V;

    for (let a = run.from; a <= run.to; a++) {
      const x = run.horizontal ? a : run.fixed;
      const z = run.horizontal ? run.fixed : a;
      const open = openingAt(x, z);
      const nearEnd = a <= run.from + 1 || a >= run.to - 1;

      for (let y = GROUND + 1; y <= GROUND + height; y++) {
        if (y <= GROUND + open) continue;
        const band = y - GROUND;
        const isWindow = Boolean(o.window) && !nearEnd && band >= 3 && band <= 4;
        const isBoard = Boolean(o.board) && !nearEnd && band >= 2 && band <= 4;
        // Skirting. A wall running straight into the floor in the same tone
        // has no visible base, so rooms looked like flat-shaded boxes; one
        // darker course at the bottom is what gives them a footing.
        const isTrim = band === 1 && !isWindow && !isBoard;
        world.set(
          x, y, z,
          isWindow ? "glass" : isBoard ? "board" : isTrim ? "trim" : o.type,
        );
      }
    }
  };

  // Corridor ring: solid outer wall all the way round, low parapet inside so
  // the courtyard stays visible from the corridor and from the map.
  for (const wall of ["n", "s", "e", "w"] as const) {
    emitWall(wall, ring, { type: "wallPaint" });
    emitWall(wall, court, { type: "cobble", height: PARAPET_V });
  }

  // Rooms. Each shares one wall with the ring, which is already standing — the
  // shared line simply gets written twice with the same result.
  for (const room of ROOMS) {
    const g = gridRect(room);
    const open = new Set(room.open ?? []);
    const windows = new Set(room.windows ?? []);
    // The board goes on whichever wall is neither the door, a window, nor open.
    const boardWall = (["n", "s", "e", "w"] as const).find(
      (w) => w !== room.door && !open.has(w) && !windows.has(w),
    );

    for (const wall of ["n", "s", "e", "w"] as const) {
      if (open.has(wall)) continue;
      emitWall(wall, g, {
        type: "wallPaint",
        window: windows.has(wall),
        board: room.kind === "classroom" && wall === boardWall,
      });
    }
  }

  // ---- furniture ---------------------------------------------------------
  for (const f of FURNITURE) {
    const g = gridRect(f);
    const type: BlockType = f.kind === "counter" ? "plank" : "desk";
    world.fill(g.x0, GROUND + 1, g.z0, g.x1, GROUND + gv(f.h), g.z1, type);
  }

  // Lanterns along the corridor's inner edge, on the parapet.
  for (let x = court.x0 + 6; x <= court.x1 - 6; x += 14) {
    world.set(x, GROUND + PARAPET_V + 1, court.z0, "lantern");
    world.set(x, GROUND + PARAPET_V + 1, court.z1, "lantern");
  }

  // ---- the courtyard fountain, the one piece of village left --------------
  {
    const c = gridCentre(COURTYARD);
    world.box(c.x - 4, GROUND + 1, c.z - 4, c.x + 4, GROUND + 1, c.z + 4, "cobble");
    world.fill(c.x - 3, GROUND + 1, c.z - 3, c.x + 3, GROUND + 1, c.z + 3, "water");
    world.fill(c.x, GROUND + 1, c.z, c.x, GROUND + 4, c.z, "cobble");
    world.set(c.x, GROUND + 5, c.z, "gold");
  }

  // ---- the portal you arrive through -------------------------------------
  const entranceX = gx(ENTRANCE_X);
  const portalPos = { x: entranceX, y: GROUND + 1, z: gz(PLAN_MAX.z + 6) };
  {
    const { x: px, z: pz } = portalPos;
    const y = GROUND;
    world.fill(px - 3, y, pz - 2, px + 3, y, pz + 2, "obsidian");
    world.fill(px - 3, y + 1, pz, px + 3, y + 1, pz, "obsidian");
    world.fill(px - 3, y + 8, pz, px + 3, y + 8, pz, "obsidian");
    world.fill(px - 3, y + 1, pz, px - 3, y + 8, pz, "obsidian");
    world.fill(px + 3, y + 1, pz, px + 3, y + 8, pz, "obsidian");
    world.fill(px - 2, y + 2, pz, px + 2, y + 7, pz, "portal");
  }

  // ---- a path from the portal to the main doors --------------------------
  for (let z = gz(PLAN_MAX.z); z <= portalPos.z; z++) {
    world.fill(entranceX - 2, GROUND, z, entranceX + 2, GROUND, z, "path");
  }
  // Lantern posts down both sides of the approach, so the walk in is lit and
  // the doors are findable from anywhere on the apron.
  for (let z = gz(PLAN_MAX.z) + 3; z < portalPos.z; z += 6) {
    for (const ox of [-3, 3]) {
      world.fill(entranceX + ox, GROUND + 1, z, entranceX + ox, GROUND + 3, z, "log");
      world.set(entranceX + ox, GROUND + 4, z, "lantern");
    }
  }

  // ---- courtyard planters, breaking up the open square --------------------
  for (const [cx, cz] of [
    [court.x0 + 8, court.z0 + 6],
    [court.x1 - 8, court.z0 + 6],
    [court.x0 + 8, court.z1 - 6],
    [court.x1 - 8, court.z1 - 6],
  ]) {
    world.box(cx - 2, GROUND + 1, cz - 2, cx + 2, GROUND + 1, cz + 2, "cobble");
    world.fill(cx - 1, GROUND + 1, cz - 1, cx + 1, GROUND + 2, cz + 1, "hedge");
    world.set(cx, GROUND + 3, cz, "flower");
  }

  // ---- scatter decoration on the apron ------------------------------------
  /**
   * Kept at the ORIGINAL block dimensions, not scaled to the new voxel size.
   *
   * At 0.5 m per voxel, doubling a tree's linear size octuples its block count:
   * the canopy alone goes from ~75 blocks to ~600, and forty of them would add
   * more geometry than the entire building. Left as-is they read as waist-high
   * shrubs and boulders bordering the grounds, which is what an apron wants
   * anyway. The count is capped for the same reason.
   */
  const onApron = (x: number, z: number) =>
    x < ring.x0 - 2 || x > ring.x1 + 2 || z < ring.z0 - 2 || z > ring.z1 + 2;

  for (let i = 0; i < 120; i++) {
    const x = 2 + Math.floor(rng() * (GRID_X - 4));
    const z = 2 + Math.floor(rng() * (GRID_Z - 4));
    if (!onApron(x, z)) continue;
    if (world.get(x, GROUND, z) !== "grass") continue;
    if (world.isSolidAt(x, GROUND + 1, z)) continue;

    const roll = rng();
    if (roll < 0.24) {
      world.set(x, GROUND + 1, z, "cobble");
    } else if (roll < 0.44) {
      // Flower clumps, the one spot of warm colour on a lot of green.
      world.set(x, GROUND + 1, z, "flower");
      if (rng() < 0.5) world.set(x + 1, GROUND + 1, z, "flower");
    } else if (roll < 0.75) {
      // Hedges, in short runs rather than single cubes — a lone bush reads as
      // debris, a run of three reads as planting.
      const len = 2 + Math.floor(rng() * 3);
      const horiz = rng() < 0.5;
      for (let i = 0; i < len; i++) {
        const hx = x + (horiz ? i : 0);
        const hz = z + (horiz ? 0 : i);
        if (world.get(hx, GROUND, hz) !== "grass") break;
        world.fill(hx, GROUND + 1, hz, hx, GROUND + 2, hz, "hedge");
      }
    } else {
      const h = 3 + Math.round(rng() * 2);
      for (let y = 1; y <= h; y++) world.set(x, GROUND + y, z, "log");
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) world.set(x + dx, GROUND + h + 1, z + dz, "leaf");
      world.set(x, GROUND + h + 2, z, "leaf");
    }
  }

  // ---- anchors ------------------------------------------------------------
  const anchors: WorldAnchor[] = [];
  const addAnchor = (key: string, rect: { x: number; z: number; w: number; d: number }) => {
    const loc = WORLD_LOCATIONS.find((l) => l.key === key);
    if (!loc) return;
    const c = gridCentre(rect);
    const g = gridRect(rect);
    // Half the SHORT side, so a long room like the sitting area does not claim
    // proximity halfway across the courtyard.
    const radius = Math.round(Math.min(g.x1 - g.x0, g.z1 - g.z0) / 2) + 2;
    anchors.push({
      key,
      label: loc.label,
      href: loc.href,
      x: c.x,
      y: GROUND + 1,
      z: c.z,
      radius,
      labelHeight: WALL_V + 4,
    });
  };

  for (const room of ROOMS) {
    if (room.key) addAnchor(room.key, room);
  }
  addAnchor("village-square", COURTYARD);

  /**
   * Spawn in the courtyard, south of the fountain, facing the north wing.
   *
   * Outside the main doors reads better on paper, but the third-person camera
   * needs ~16 voxels of clear space BEHIND the player, and out there that space
   * is exactly where the portal stands — so the camera collided with it and
   * pulled in to arm's length, filling the screen with the character and
   * hiding the building. The courtyard is 68 × 38 with only a 2-voxel parapet,
   * so the boom has room and the opening shot shows the building wrapped
   * around you. It is also the hub the Village Square anchor describes.
   *
   * Still a spiral search rather than a fixed offset: the fountain is in the
   * middle, and spawning inside it puts the player's head in a block.
   */
  const courtCentre = gridCentre(COURTYARD);
  const spawnSeed = { x: courtCentre.x, z: courtCentre.z + 12 };
  const spawn = (() => {
    for (let r = 1; r < 24; r++) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const sx = Math.round(spawnSeed.x + Math.cos(ang) * r);
        const sz = Math.round(spawnSeed.z + Math.sin(ang) * r);
        if (sx < 1 || sz < 1 || sx > GRID_X - 2 || sz > GRID_Z - 2) continue;
        const g = world.groundAt(sx, sz);
        if (g < 0) continue;
        // Enough headroom for the player capsule at the new voxel scale.
        let clear = true;
        for (let dy = 1; dy <= 4; dy++) {
          if (world.isSolidAt(sx, g + dy, sz)) clear = false;
        }
        if (clear) return { x: sx, y: g + 1, z: sz };
      }
    }
    return { x: spawnSeed.x, y: GROUND + 1, z: spawnSeed.z };
  })();

  // Look north across the fountain to the classroom wing. `forward =
  // (sin yaw, cos yaw)`, so this is atan2 of spawn → target in (x, z) order.
  const spawnYaw = Math.atan2(courtCentre.x - spawn.x, court.z0 - spawn.z);

  return { world, anchors, spawn, spawnYaw };
}

/**
 * The world, built once and shared.
 *
 * `buildVillage()` is pure and seeded, so a second call produces an identical
 * ~19k-block world at full cost. The 2D map, the projection maths and the
 * screen's "you are here" fallback all need it, and before this they each
 * rebuilt it — switching map projection regenerated the entire world before
 * drawing a pixel.
 *
 * The 3D scene deliberately does NOT use this: it holds its own instance for
 * the lifetime of the canvas, and sharing one across a mount/unmount would keep
 * the whole grid alive after the user leaves the 3D view.
 */
let cached: VillageResult | null = null;
export function getVillage(): VillageResult {
  cached ??= buildVillage();
  return cached;
}

/** Re-exported so callers can reason about the plan without a second import. */
export type { RoomSpec };
