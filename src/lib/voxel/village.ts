import { WORLD_LOCATIONS } from "@/lib/world/world-locations";
import { VoxelWorld, makeRng, smoothNoise, type WorldAnchor } from "./world";

/**
 * Procedural village generator.
 *
 * Builds an ORIGINAL voxel village — none of these structures copy Minecraft
 * builds or textures; they are generic blocky architecture (huts, a library
 * hall, an arena, a castle) in our own palette.
 *
 * Seeded, so the village is byte-identical on every load. That matters for more
 * than determinism: the anchor positions below are what the UI links to, so a
 * village that shuffled would move the buildings out from under the labels.
 *
 * Buildings are placed at the SAME percentage coordinates as the 2D map's
 * signposts (`WORLD_LOCATIONS`), so the 3D and 2D views describe one place.
 */

const SIZE = 72;
const SEED = 20260726;
const SEA_LEVEL = 4;

export interface VillageResult {
  world: VoxelWorld;
  anchors: WorldAnchor[];
  /** Where the player spawns — the square, facing the portal. */
  spawn: { x: number; y: number; z: number };
  /** Portal landmark position, for the camera's initial framing. */
  portal: { x: number; y: number; z: number };
}

/** Percentage coords (0–100) from the 2D map → world grid coords. */
function pctToWorld(xPct: number, zPct: number): { x: number; z: number } {
  return {
    x: Math.round((xPct / 100) * (SIZE - 16)) + 8,
    z: Math.round((zPct / 100) * (SIZE - 16)) + 8,
  };
}

export function buildVillage(): VillageResult {
  const rng = makeRng(SEED);
  const noise = smoothNoise(rng, SIZE);
  const world = new VoxelWorld(SIZE);

  // ---- terrain -----------------------------------------------------------
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      // Gentle rolling height, plus a bowl shape so the village sits in a
      // valley and the edges rise — that framing keeps the camera enclosed
      // without needing invisible walls.
      const dx = (x - SIZE / 2) / (SIZE / 2);
      const dz = (z - SIZE / 2) / (SIZE / 2);
      const bowl = Math.min(1, (dx * dx + dz * dz) * 1.15);
      const h = Math.round(SEA_LEVEL + noise(x, z) * 3 + bowl * 7);

      /**
       * Only generate a CRUST, not a solid column to bedrock.
       *
       * Filling every column from y=0 produced 71k blocks for a 72² world, of
       * which the overwhelming majority were buried stone that no camera angle
       * can ever reach. Four blocks of crust looks identical from any position
       * the player can occupy, and cuts total block count by roughly 60% —
       * which is memory, culling time, and instance-buffer size all at once.
       *
       * The floor is kept solid so a player can never fall through a seam where
       * neighbouring columns differ in height.
       */
      const floor = Math.max(0, h - 3);
      for (let y = floor; y <= h; y++) {
        const depth = h - y;
        world.set(
          x, y, z,
          depth === 0 ? "grass" : depth < 3 ? "dirt" : "stone",
        );
      }

      // A small lake in one corner, for water and reflection interest.
      if (h <= SEA_LEVEL && dx < -0.35 && dz > 0.2) {
        for (let y = h + 1; y <= SEA_LEVEL; y++) world.set(x, y, z, "water");
        world.set(x, h, z, "sand");
      }
    }
  }

  // ---- resolve building sites from the shared 2D coordinates -------------
  const sites = new Map<string, { x: number; z: number; y: number }>();
  for (const loc of WORLD_LOCATIONS) {
    const { x, z } = pctToWorld(loc.x, loc.y);
    sites.set(loc.key, { x, z, y: world.groundAt(x, z) });
  }

  const anchors: WorldAnchor[] = [];
  const addAnchor = (
    key: string,
    pos: { x: number; y: number; z: number },
    radius: number,
    labelHeight: number,
  ) => {
    const loc = WORLD_LOCATIONS.find((l) => l.key === key);
    if (!loc) return;
    anchors.push({
      key,
      label: loc.label,
      href: loc.href,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      radius,
      labelHeight,
    });
  };

  /**
   * Natural ground height per column, captured BEFORE anything is built.
   *
   * This snapshot is the whole point. `world.groundAt()` returns the highest
   * SOLID block, which after construction includes roofs and towers. Flattening
   * against that made each building treat its neighbour's roof as "ground":
   * the castle sat within flatten range of the library roof, raised its entire
   * 17×17 footprint to roof height, and produced a dirt mesa with towers on top
   * that filled half the camera view. Flattening against natural terrain only
   * keeps every building on the actual landscape.
   */
  const naturalHeight = new Map<string, number>();
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      naturalHeight.set(`${x},${z}`, world.groundAt(x, z));
    }
  }
  const naturalAt = (x: number, z: number) => naturalHeight.get(`${x},${z}`) ?? -1;

  /** Level a footprint to its natural terrain, so buildings sit flush on ground. */
  const flatten = (cx: number, cz: number, r: number): number => {
    let maxH = 0;
    for (let x = cx - r; x <= cx + r; x++)
      for (let z = cz - r; z <= cz + r; z++) maxH = Math.max(maxH, naturalAt(x, z));

    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        const g = naturalAt(x, z);
        if (g < 0) continue;
        for (let y = g + 1; y <= maxH; y++) world.set(x, y, z, "dirt");
        world.set(x, maxH, z, "grass");
        // Keep the snapshot consistent so later flattens see the new ground.
        naturalHeight.set(`${x},${z}`, maxH);
      }
    }
    return maxH;
  };

  // ---- Village Square: fountain plaza, the hub ---------------------------
  {
    const s = sites.get("village-square")!;
    const y = flatten(s.x, s.z, 7);
    world.fill(s.x - 6, y, s.z - 6, s.x + 6, y, s.z + 6, "path");
    // Fountain: stone rim, water centre, gold spout.
    world.box(s.x - 2, y + 1, s.z - 2, s.x + 2, y + 1, s.z + 2, "cobble");
    world.fill(s.x - 1, y + 1, s.z - 1, s.x + 1, y + 1, s.z + 1, "water");
    world.fill(s.x, y + 1, s.z, s.x, y + 3, s.z, "cobble");
    world.set(s.x, y + 4, s.z, "gold");
    // Lantern posts at the corners.
    for (const [ox, oz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      world.fill(s.x + ox, y + 1, s.z + oz, s.x + ox, y + 3, s.z + oz, "log");
      world.set(s.x + ox, y + 4, s.z + oz, "lantern");
    }
    addAnchor("village-square", { x: s.x, y: y + 1, z: s.z }, 7, 6);
    sites.set("village-square", { ...s, y });
  }

  // ---- Hackathon Mine: hillside cave mouth with rails --------------------
  {
    const s = sites.get("hackathon-mine")!;
    const y = flatten(s.x, s.z, 6);
    // Raise a hill behind, then cut a tunnel entrance into it.
    for (let x = s.x - 5; x <= s.x + 5; x++) {
      for (let z = s.z - 5; z <= s.z + 5; z++) {
        const d = Math.hypot(x - s.x, z - s.z + 3);
        const hh = Math.max(0, Math.round(7 - d * 1.1));
        for (let h = 1; h <= hh; h++) world.set(x, y + h, z, "stone");
      }
    }
    // Tunnel + timber frame.
    world.fill(s.x - 1, y + 1, s.z - 6, s.x + 1, y + 3, s.z + 2, "path");
    for (const ox of [-2, 2]) world.fill(s.x + ox, y + 1, s.z - 1, s.x + ox, y + 4, s.z - 1, "log");
    world.fill(s.x - 2, y + 4, s.z - 1, s.x + 2, y + 4, s.z - 1, "log");
    // Emerald seams in the rock face.
    for (let i = 0; i < 12; i++) {
      const ex = s.x + Math.round((rng() - 0.5) * 8);
      const ez = s.z + Math.round(rng() * 4) - 4;
      const ey = y + 1 + Math.round(rng() * 4);
      if (world.isSolidAt(ex, ey, ez)) world.set(ex, ey, ez, "emerald");
    }
    // Minecart rails leading out.
    for (let z = s.z - 6; z <= s.z + 6; z++) {
      world.set(s.x - 1, y + 1, z, "log");
      world.set(s.x + 1, y + 1, z, "log");
    }
    addAnchor("hackathon-mine", { x: s.x, y: y + 1, z: s.z - 2 }, 6, 8);
  }

  // ---- Photography Forest: dense woodland ---------------------------------
  {
    const s = sites.get("photography-forest")!;
    const y = flatten(s.x, s.z, 3);
    const tree = (tx: number, tz: number, height: number) => {
      const g = world.groundAt(tx, tz);
      if (g < 0) return;
      /**
       * Only plant on open ground.
       *
       * Trunks are solid, so planting raises the column's height map. Without
       * this guard a second tree rolled onto the same column started from the
       * FIRST tree's canopy and stacked — repeatedly, until the forest grew
       * 40-block pillars of logs that towered over the village and blacked out
       * half the camera view. Requiring bare grass makes planting idempotent.
       */
      if (world.get(tx, g, tz) !== "grass") return;
      for (let h = 1; h <= height; h++) world.set(tx, g + h, tz, "log");
      // Blocky canopy: a stepped cube cluster, not a sphere.
      const top = g + height;
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++)
          for (let dy = 0; dy <= 2; dy++) {
            const spread = Math.abs(dx) + Math.abs(dz) + dy;
            if (spread <= 3 + (dy === 0 ? 1 : 0)) world.set(tx + dx, top + dy, tz + dz, "leaf");
          }
      world.set(tx, top + 3, tz, "leaf");
    };

    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2;
      const r = 2 + rng() * 9;
      tree(
        Math.round(s.x + Math.cos(a) * r),
        Math.round(s.z + Math.sin(a) * r),
        4 + Math.round(rng() * 3),
      );
    }
    // A small clearing with a camera tripod cairn so the site reads as a place.
    world.fill(s.x - 1, y + 1, s.z - 1, s.x + 1, y + 1, s.z + 1, "path");
    world.fill(s.x, y + 1, s.z, s.x, y + 2, s.z, "cobble");
    world.set(s.x, y + 3, s.z, "sapphire");
    addAnchor("photography-forest", { x: s.x, y: y + 1, z: s.z }, 6, 7);
  }

  // ---- Design Workshop: timber hut with a pitched roof -------------------
  {
    const s = sites.get("design-workshop")!;
    const y = flatten(s.x, s.z, 5);
    world.box(s.x - 4, y + 1, s.z - 3, s.x + 4, y + 4, s.z + 3, "plank");
    // Corner posts read as structure.
    for (const [ox, oz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]])
      world.fill(s.x + ox, y + 1, s.z + oz, s.x + ox, y + 4, s.z + oz, "log");
    // Pitched roof.
    for (let i = 0; i <= 4; i++) {
      world.fill(s.x - 4 + i, y + 5 + i, s.z - 3, s.x + 4 - i, y + 5 + i, s.z + 3, "roofDark");
    }
    // Door and windows.
    world.fill(s.x, y + 1, s.z - 3, s.x, y + 2, s.z - 3, "path");
    for (const ox of [-2, 2]) world.fill(s.x + ox, y + 2, s.z - 3, s.x + ox, y + 3, s.z - 3, "glass");
    world.set(s.x - 5, y + 4, s.z - 3, "lantern");
    addAnchor("design-workshop", { x: s.x, y: y + 1, z: s.z }, 6, 11);
  }

  // ---- Quiz Library: tall stone hall --------------------------------------
  {
    const s = sites.get("quiz-library")!;
    const y = flatten(s.x, s.z, 6);
    world.box(s.x - 5, y + 1, s.z - 4, s.x + 5, y + 8, s.z + 4, "cobble");
    // Tall glass windows down both long sides.
    for (let z = s.z - 2; z <= s.z + 2; z += 2) {
      world.fill(s.x - 5, y + 3, z, s.x - 5, y + 6, z, "glass");
      world.fill(s.x + 5, y + 3, z, s.x + 5, y + 6, z, "glass");
    }
    world.fill(s.x, y + 1, s.z - 4, s.x, y + 3, s.z - 4, "path");
    // Flat roof with a sapphire beacon.
    world.fill(s.x - 5, y + 9, s.z - 4, s.x + 5, y + 9, s.z + 4, "stone");
    world.fill(s.x, y + 10, s.z, s.x, y + 12, s.z, "cobble");
    world.set(s.x, y + 13, s.z, "sapphire");
    addAnchor("quiz-library", { x: s.x, y: y + 1, z: s.z }, 7, 15);
  }

  // ---- Gaming Arena: open colosseum ---------------------------------------
  {
    const s = sites.get("gaming-arena")!;
    const y = flatten(s.x, s.z, 9);
    // Ring of tiered seating.
    for (let x = s.x - 8; x <= s.x + 8; x++) {
      for (let z = s.z - 8; z <= s.z + 8; z++) {
        const d = Math.hypot(x - s.x, z - s.z);
        if (d > 5.5 && d <= 8.5) {
          const tier = Math.round(d - 5.5);
          for (let h = 1; h <= tier + 1; h++) world.set(x, y + h, z, "cobble");
        } else if (d <= 5.5) {
          world.set(x, y, z, "sand");
        }
      }
    }
    // Banner posts around the rim.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bx = Math.round(s.x + Math.cos(a) * 9);
      const bz = Math.round(s.z + Math.sin(a) * 9);
      world.fill(bx, y + 1, bz, bx, y + 5, bz, "log");
      world.fill(bx, y + 4, bz, bx, y + 5, bz, "roofRed");
    }
    addAnchor("gaming-arena", { x: s.x, y: y + 1, z: s.z }, 9, 8);
  }

  // ---- Leaderboard Castle: keep with towers -------------------------------
  {
    const s = sites.get("leaderboard-castle")!;
    const y = flatten(s.x, s.z, 8);
    world.box(s.x - 6, y + 1, s.z - 5, s.x + 6, y + 9, s.z + 5, "stone");
    // Crenellations along the front wall.
    for (let x = s.x - 6; x <= s.x + 6; x += 2) {
      world.set(x, y + 10, s.z - 5, "stone");
      world.set(x, y + 10, s.z + 5, "stone");
    }
    // Four corner towers, each capped in gold.
    for (const [ox, oz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) {
      const tx = s.x + ox;
      const tz = s.z + oz;
      world.box(tx - 1, y + 1, tz - 1, tx + 1, y + 13, tz + 1, "cobble");
      world.fill(tx - 1, y + 14, tz - 1, tx + 1, y + 14, tz + 1, "roofRed");
      world.set(tx, y + 15, tz, "gold");
    }
    // Gate.
    world.fill(s.x - 1, y + 1, s.z - 5, s.x + 1, y + 4, s.z - 5, "path");
    addAnchor("leaderboard-castle", { x: s.x, y: y + 1, z: s.z - 6 }, 8, 17);
  }

  // ---- The portal, the landmark you arrive through ------------------------
  const square = sites.get("village-square")!;
  const portalPos = { x: square.x, y: square.y + 1, z: square.z - 11 };
  {
    const py = flatten(portalPos.x, portalPos.z, 3);
    portalPos.y = py;
    // Obsidian frame, 4 wide × 5 tall, with the energy plane inside.
    world.fill(portalPos.x - 2, py + 1, portalPos.z, portalPos.x + 2, py + 1, portalPos.z, "obsidian");
    world.fill(portalPos.x - 2, py + 6, portalPos.z, portalPos.x + 2, py + 6, portalPos.z, "obsidian");
    world.fill(portalPos.x - 2, py + 1, portalPos.z, portalPos.x - 2, py + 6, portalPos.z, "obsidian");
    world.fill(portalPos.x + 2, py + 1, portalPos.z, portalPos.x + 2, py + 6, portalPos.z, "obsidian");
    world.fill(portalPos.x - 1, py + 2, portalPos.z, portalPos.x + 1, py + 5, portalPos.z, "portal");
    // Plinth.
    world.fill(portalPos.x - 3, py, portalPos.z - 2, portalPos.x + 3, py, portalPos.z + 2, "obsidian");
  }

  // ---- Paths radiating from the square to each building -------------------
  for (const anchor of anchors) {
    if (anchor.key === "village-square") continue;
    let cx = square.x;
    let cz = square.z;
    let guard = 0;
    // Simple L-walk; good enough and reads as a deliberate track.
    while ((cx !== anchor.x || cz !== anchor.z) && guard++ < 400) {
      if (cx !== anchor.x) cx += Math.sign(anchor.x - cx);
      else if (cz !== anchor.z) cz += Math.sign(anchor.z - cz);

      const g = world.groundAt(cx, cz);
      if (g >= 0 && world.get(cx, g, cz) === "grass") {
        world.set(cx, g, cz, "path");
        // Widen so paths are visible from the camera height.
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + ox;
          const nz = cz + oz;
          const ng = world.groundAt(nx, nz);
          if (ng === g && world.get(nx, ng, nz) === "grass") world.set(nx, ng, nz, "path");
        }
      }
    }
  }

  // ---- Scatter decoration on leftover grass -------------------------------
  for (let i = 0; i < 90; i++) {
    const x = 3 + Math.floor(rng() * (SIZE - 6));
    const z = 3 + Math.floor(rng() * (SIZE - 6));
    const g = world.groundAt(x, z);
    if (g < 0 || world.get(x, g, z) !== "grass") continue;

    const roll = rng();
    if (roll < 0.5) {
      // Boulder.
      world.set(x, g + 1, z, "cobble");
    } else if (roll < 0.8) {
      // Lone shrub.
      world.set(x, g + 1, z, "leaf");
    } else {
      // Small tree.
      const h = 3 + Math.round(rng() * 2);
      for (let y = 1; y <= h; y++) world.set(x, g + y, z, "log");
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) world.set(x + dx, g + h + 1, z + dz, "leaf");
      world.set(x, g + h + 2, z, "leaf");
    }
  }

  /**
   * Find a genuinely clear spawn by spiralling out from the square.
   *
   * A hardcoded offset is not safe: the plaza has a fountain in the middle and
   * lantern posts at its corners, and spawning inside one puts the player's
   * head in a block with the camera trapped behind it.
   */
  const spawn = (() => {
    for (let r = 2; r < 14; r++) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const sx = Math.round(square.x + Math.cos(ang) * r);
        const sz = Math.round(square.z + Math.sin(ang) * r);
        const g = world.groundAt(sx, sz);
        if (g < 0) continue;
        // Need two blocks of headroom for the player capsule.
        if (world.isSolidAt(sx, g + 1, sz) || world.isSolidAt(sx, g + 2, sz)) continue;
        return { x: sx, y: g + 1, z: sz };
      }
    }
    return { x: square.x, y: square.y + 1, z: square.z + 6 };
  })();


  return { world, anchors, spawn, portal: portalPos };
}
