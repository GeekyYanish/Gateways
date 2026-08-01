import { BLOCKS, isSolid, type BlockType } from "@/frontend/lib/voxel/blocks";
import { VILLAGE_SIZE, VILLAGE_SIZE_Z, getVillage } from "@/frontend/lib/voxel/village";
import type { VoxelWorld, WorldAnchor } from "@/frontend/lib/voxel/world";

/**
 * THE 2D MAP — the same voxel world the 3D view walks around in, drawn flat.
 *
 * This does not draw a *second* building. It projects the exact
 * `buildVillage()` world, so the two views are one place by construction rather
 * than by two generators being kept in sync by hand. Move a wall in the floor
 * plan and it moves here too.
 *
 * That is only possible because the voxel data layer (`world.ts`, `village.ts`,
 * `blocks.ts`) is pure — it has no three.js import. Keep it that way: pulling
 * three into that module would drag the whole 3D bundle onto this route, which
 * `voxel-world.tsx` goes out of its way to avoid.
 *
 * **Canvas, not SVG.** Every other generated image in this project is an SVG
 * data URI, but this one is ~20k faces: as a URI that is megabytes of markup
 * inlined into the document. A canvas costs nothing in payload, and CSS
 * transforms pan and zoom the element just as well as they would an <img>.
 *
 * ## Two projections
 *
 * **Isometric** is the picturesque view. **Top-down** is the floor plan — for a
 * building it is the view that actually answers "where is room C from here",
 * which isometric cannot because it squashes the depth axis.
 *
 * Every canvas dimension is therefore per-projection, returned by
 * `mapMetrics()`. They used to be module constants, which is why
 * `world-viewport` closed over them and would silently keep the previous mode's
 * fit — they must be threaded through as values, not imported.
 */

export type MapProjection = "isometric" | "top-down";

/** Quarter turns clockwise. The map can be spun to face any wing of the building. */
export type MapRotation = 0 | 1 | 2 | 3;

export const MAP_PROJECTIONS: readonly MapProjection[] = ["isometric", "top-down"];
export const DEFAULT_PROJECTION: MapProjection = "top-down";

/**
 * Compass label for each quarter turn — which world direction is "up" on screen.
 *
 * At rotation 0 the map is drawn with world −z (north) up, which is how the
 * floor plan is authored. Each clockwise turn brings the next wing to the top.
 */
export const ROTATION_LABELS: readonly string[] = ["N", "E", "S", "W"];

/**
 * World → rotated grid coordinates.
 *
 * Rotation happens BEFORE the projection, in grid space, so both projections
 * get it for free and the isometric depth sort keeps working: `x + y + z` is
 * only camera depth in the frame the camera is actually in.
 */
function rotate(rotation: MapRotation, x: number, z: number): [number, number] {
  switch (rotation) {
    case 1:
      return [VILLAGE_SIZE_Z - 1 - z, x];
    case 2:
      return [VILLAGE_SIZE - 1 - x, VILLAGE_SIZE_Z - 1 - z];
    case 3:
      return [z, VILLAGE_SIZE - 1 - x];
    default:
      return [x, z];
  }
}

/**
 * World-space step corresponding to one unit of screen-right / screen-left
 * after rotation.
 *
 * The isometric draw picks which two side faces of a cube to paint by looking
 * at the +x and +z neighbours. Once the world is turned, "the face pointing
 * down-right on screen" is a different world axis — without this the shading
 * stays keyed to the unrotated axes and every wall lights from the wrong side.
 */
const RIGHT_STEP: ReadonlyArray<readonly [number, number]> = [[1, 0], [0, -1], [-1, 0], [0, 1]];
const LEFT_STEP: ReadonlyArray<readonly [number, number]> = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Half-extents of one voxel's diamond top face. 2:1 is the classic iso ratio. */
const TILE_W = 14;
const TILE_H = 7;
/** Vertical screen distance per world Y. */
const TILE_Z = 8;
/** Edge of one voxel in the top-down projection. */
const TILE_FLAT = 12;
/**
 * Tallest structure, in blocks — the portal arch, and the odd tree.
 *
 * Was 34, sized for the old castle's towers. A single-storey building needs a
 * fraction of that, and the surplus was pure empty sky: it inflated the canvas
 * height, which then dragged the fit-to-screen scale down for everyone.
 */
const Y_HEADROOM = 12;

export interface MapMetrics {
  projection: MapProjection;
  rotation: MapRotation;
  /** Canvas pixel dimensions. */
  width: number;
  height: number;
  /** Screen position of rotated grid (0, 0, 0). */
  originX: number;
  originY: number;
}

/**
 * Canvas geometry, DERIVED from the world rather than picked.
 *
 * Choosing a canvas first and hoping the world fits is how the first version
 * ended up drawing a 3124px island into 2048px and losing a third of it off
 * both sides.
 *
 * The isometric origin is NOT `width / 2`. `x - z` runs from `-(SZ - 1)` to
 * `SX - 1`, which is only symmetric when the grid is square — and this one is
 * 126 × 104. Centring on the midpoint drew the plan off-centre and slid every
 * marker off its room.
 */
export function mapMetrics(
  projection: MapProjection,
  rotation: MapRotation = 0,
): MapMetrics {
  // A quarter turn swaps the grid's extents. The building is 126 × 104, so
  // forgetting this crops a third of it off in the odd rotations.
  const quarter = rotation % 2 === 1;
  const sx = quarter ? VILLAGE_SIZE_Z : VILLAGE_SIZE;
  const sz = quarter ? VILLAGE_SIZE : VILLAGE_SIZE_Z;

  if (projection === "top-down") {
    return {
      projection,
      rotation,
      width: sx * TILE_FLAT,
      height: sz * TILE_FLAT,
      originX: 0,
      originY: 0,
    };
  }

  const span = sx - 1 + (sz - 1);
  const height = span * TILE_H + Y_HEADROOM * TILE_Z + TILE_Z * 2;
  return {
    projection,
    rotation,
    width: span * TILE_W + TILE_W * 2,
    height,
    // One tile of margin past the westmost corner (x = 0, z = sz - 1).
    originX: (sz - 1) * TILE_W + TILE_W,
    // Places the near corner at y = 0 just above the bottom edge, leaving
    // exactly Y_HEADROOM of sky above the far corner.
    originY: height - TILE_Z * 2 - span * TILE_H,
  };
}

/** Face brightness ramp. Untextured cubes only read as solid because of this. */
const FACE_TOP = 1.16;
const FACE_LEFT = 0.78;
const FACE_RIGHT = 0.56;

export interface MappedAnchor extends WorldAnchor {
  /** Position of the building's label anchor, as a % of the map. */
  xPct: number;
  yPct: number;
}

export interface VillageMapResult {
  anchors: MappedAnchor[];
  metrics: MapMetrics;
}

// ---------------------------------------------------------------------------

function shadeHex(hex: string, mul: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (sh: number) => Math.min(255, Math.round(((n >> sh) & 255) * mul));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

/**
 * Cheap deterministic hash → 0..1, used for per-block colour jitter.
 *
 * Must be positional rather than random: the map is redrawn on resize, and a
 * per-call RNG would make every blade of grass change shade each time.
 */
function jitterAt(x: number, y: number, z: number): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 1000) / 1000;
}

/** World → screen, for whichever projection and rotation the metrics describe. */
function project(m: MapMetrics, x: number, y: number, z: number) {
  const [rx, rz] = rotate(m.rotation, x, z);
  if (m.projection === "top-down") {
    return {
      sx: m.originX + rx * TILE_FLAT + TILE_FLAT / 2,
      sy: m.originY + rz * TILE_FLAT + TILE_FLAT / 2,
    };
  }
  return {
    sx: m.originX + (rx - rz) * TILE_W,
    sy: m.originY + (rx + rz) * TILE_H - y * TILE_Z,
  };
}

/** One voxel as three visible faces, drawn as flat polygons. */
function drawIsoCube(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  base: string,
  jitterAmt: number,
  j: number,
  faces: { top: boolean; left: boolean; right: boolean },
) {
  // ±jitter around 1, so large flat areas of one block type are not sterile.
  const mul = 1 + (j - 0.5) * 2 * jitterAmt;

  if (faces.top) {
    ctx.fillStyle = shadeHex(base, FACE_TOP * mul);
    ctx.beginPath();
    ctx.moveTo(sx, sy - TILE_H);
    ctx.lineTo(sx + TILE_W, sy);
    ctx.lineTo(sx, sy + TILE_H);
    ctx.lineTo(sx - TILE_W, sy);
    ctx.closePath();
    ctx.fill();
  }
  if (faces.left) {
    ctx.fillStyle = shadeHex(base, FACE_LEFT * mul);
    ctx.beginPath();
    ctx.moveTo(sx - TILE_W, sy);
    ctx.lineTo(sx, sy + TILE_H);
    ctx.lineTo(sx, sy + TILE_H + TILE_Z);
    ctx.lineTo(sx - TILE_W, sy + TILE_Z);
    ctx.closePath();
    ctx.fill();
  }
  if (faces.right) {
    ctx.fillStyle = shadeHex(base, FACE_RIGHT * mul);
    ctx.beginPath();
    ctx.moveTo(sx + TILE_W, sy);
    ctx.lineTo(sx, sy + TILE_H);
    ctx.lineTo(sx, sy + TILE_H + TILE_Z);
    ctx.lineTo(sx + TILE_W, sy + TILE_Z);
    ctx.closePath();
    ctx.fill();
  }
}

/** Blocky clouds over the sky band, so the empty corners are not dead space. */
function drawSky(ctx: CanvasRenderingContext2D, m: MapMetrics) {
  const g = ctx.createLinearGradient(0, 0, 0, m.height);
  g.addColorStop(0, "#2f6ebc");
  g.addColorStop(0.45, "#417ec6");
  g.addColorStop(1, "#6f9ed3");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, m.width, m.height);

  // Positional hash again — the clouds must not reshuffle on resize. Confined
  // to the top band and kept small: the building is the subject, and the first
  // pass had clouds the size of buildings dominating the frame.
  for (let i = 0; i < 18; i++) {
    const j = jitterAt(i * 17, 3, i * 91);
    const j2 = jitterAt(i * 31, 7, i * 13);
    const cx = j * m.width;
    const cy = TILE_Z * 2 + j2 * (Y_HEADROOM * TILE_Z * 0.7);
    const s = 8 + Math.round(j2 * 2) * 4;
    const rows = 2 + Math.round(j * 2);
    for (let r = 0; r < rows; r++) {
      const wide = (rows - r) * 2 + 1;
      ctx.fillStyle = r === rows - 1 ? "#f2f7fd" : r === 0 ? "#cfe0ef" : "#e3ecf7";
      ctx.fillRect(cx - (wide * s) / 2, cy - r * s, wide * s, s);
    }
  }
}

/**
 * Where a world point lands on the map, as percentages.
 *
 * Exported so the screen can place things the renderer does not draw — the
 * player's own position, most of all. Going through the same `project()` the
 * canvas uses is the only way a marker can be guaranteed to sit on the right
 * spot in both projections.
 */
export function projectToPct(
  m: MapMetrics,
  x: number,
  y: number,
  z: number,
): { xPct: number; yPct: number } {
  const { sx, sy } = project(m, x, y, z);
  return { xPct: (sx / m.width) * 100, yPct: (sy / m.height) * 100 };
}

/**
 * A world-space heading as a CSS rotation, in degrees clockwise from "up".
 *
 * Isometric skews direction as well as position: due north on the ground is not
 * up on the screen, it is up-and-left. Rotating a facing arrow by the raw yaw
 * would therefore point it at the wrong room in iso and only be right in plan.
 */
export function headingDegrees(m: MapMetrics, yaw: number): number {
  // The controller's forward vector, in world (x, z).
  const dx = Math.sin(yaw);
  const dz = Math.cos(yaw);
  // Rotate the DIRECTION by the same quarter turns as the positions. (Same
  // matrix as `rotate`, without the grid-size offsets, which are translation.)
  const turn: Array<[number, number]> = [
    [dx, dz],
    [-dz, dx],
    [-dx, -dz],
    [dz, -dx],
  ];
  const [rx, rz] = turn[m.rotation];
  // Same transform as `project`, minus the origin — it is a direction.
  const sx = m.projection === "top-down" ? rx : (rx - rz) * TILE_W;
  const sy = m.projection === "top-down" ? rz : (rx + rz) * TILE_H;
  return (Math.atan2(sx, -sy) * 180) / Math.PI;
}

/** The village, built once and shared — see `getVillage`. */
function village() {
  return getVillage();
}

/**
 * Draw the whole world.
 *
 * Isometric sorts by `x + y + z`: in that projection the sum is exactly depth
 * from the camera, so drawing back-to-front resolves occlusion with no
 * z-buffer. Top-down sorts by `y` alone — straight up is the view direction, so
 * height is depth, and only the top face of each column ever shows.
 *
 * Faces whose neighbour is solid are skipped first — the same culling
 * `visibleBlocks()` does, which removes most of the work before any drawing.
 */
export function renderVillageMap(
  canvas: HTMLCanvasElement,
  projection: MapProjection = DEFAULT_PROJECTION,
  rotation: MapRotation = 0,
): VillageMapResult {
  const { world, anchors } = village();
  const m = mapMetrics(projection, rotation);

  canvas.width = m.width;
  canvas.height = m.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { anchors: [], metrics: m };

  if (projection === "isometric") {
    drawSky(ctx, m);
  } else {
    // No sky in plan view — you are looking straight down at the ground.
    ctx.fillStyle = "#1c2331";
    ctx.fillRect(0, 0, m.width, m.height);
  }

  const visible = world.visibleBlocks();
  if (projection === "top-down") {
    visible.sort((a, b) => a.y - b.y);
  } else {
    // Depth is the sum of the ROTATED coordinates: `x + y + z` is only camera
    // depth in the frame the camera is actually in, so sorting on the raw
    // values draws the far side of the building over the near side once the
    // map is turned.
    const depth = (v: { x: number; y: number; z: number }) => {
      const [rx, rz] = rotate(rotation, v.x, v.z);
      return rx + v.y + rz;
    };
    visible.sort((a, b) => depth(a) - depth(b));
  }

  const [rdx, rdz] = RIGHT_STEP[rotation];
  const [ldx, ldz] = LEFT_STEP[rotation];

  for (const v of visible) {
    const def = BLOCKS[v.type as BlockType];
    // A face is hidden when the neighbour that would cover it is solid.
    const top = !isSolid(world.get(v.x, v.y + 1, v.z));

    if (projection === "top-down") {
      if (!top) continue;
      const { sx, sy } = project(m, v.x, v.y, v.z);
      const j = jitterAt(v.x, v.y, v.z);
      const mul = 1 + (j - 0.5) * 2 * (def.jitter ?? 0);
      /**
       * Lift the shade with height. Straight down, a wall and the floor beside
       * it are the same flat quad — without a height ramp the plan reads as one
       * uniform slab and the rooms disappear.
       */
      const lift = 1 + Math.min(v.y, Y_HEADROOM) * 0.045;
      ctx.globalAlpha = def.transparent ? (def.opacity ?? 1) : 1;
      ctx.fillStyle = shadeHex(def.color, FACE_TOP * mul * lift);
      ctx.fillRect(sx - TILE_FLAT / 2, sy - TILE_FLAT / 2, TILE_FLAT, TILE_FLAT);
      continue;
    }

    // Which world neighbours sit down-left and down-right on screen depends on
    // the rotation — see RIGHT_STEP / LEFT_STEP.
    const left = !isSolid(world.get(v.x + ldx, v.y, v.z + ldz));
    const right = !isSolid(world.get(v.x + rdx, v.y, v.z + rdz));
    if (!top && !left && !right) continue;

    const { sx, sy } = project(m, v.x, v.y, v.z);
    // Generous cull margin — a cube's faces extend well past its origin.
    if (sx < -TILE_W * 2 || sx > m.width + TILE_W * 2) continue;
    if (sy < -TILE_Z * 4 || sy > m.height + TILE_Z * 4) continue;

    ctx.globalAlpha = def.transparent ? (def.opacity ?? 1) : 1;
    drawIsoCube(ctx, sx, sy, def.color, def.jitter ?? 0, jitterAt(v.x, v.y, v.z), {
      top,
      left,
      right,
    });

    // Emissive blocks get a bloom, which is what makes lanterns and the portal
    // read as light sources rather than as brightly-painted cubes.
    if (def.emissive) {
      ctx.globalAlpha = 0.5 * (def.emissiveIntensity ?? 0.5);
      const r = TILE_W * 2.4;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, def.emissive);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;

  return {
    metrics: m,
    anchors: anchors.map((a) => {
      // Label anchors sit above the building, matching the 3D view's
      // `labelHeight` so a location is in the same place in both views. Plan
      // view has no vertical axis, so the lift would only push the marker off
      // its own room.
      const lift = projection === "isometric" ? a.labelHeight : 0;
      const { sx, sy } = project(m, a.x, a.y + lift, a.z);
      return {
        ...a,
        xPct: (sx / m.width) * 100,
        yPct: (sy / m.height) * 100,
      };
    }),
  };
}

export type { VoxelWorld };
