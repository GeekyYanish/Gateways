import { BLOCKS, isSolid, type BlockType } from "@/lib/voxel/blocks";
import { VILLAGE_SIZE, buildVillage } from "@/lib/voxel/village";
import type { VoxelWorld, WorldAnchor } from "@/lib/voxel/world";

/**
 * ISOMETRIC RENDER OF THE VILLAGE — the 2D map view.
 *
 * This does not draw a *second* village. It projects the exact same
 * `buildVillage()` voxel world the 3D view walks around in, so the two views
 * are one place by construction rather than by two generators being kept in
 * sync by hand. Move a building in `village.ts` and it moves here too.
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
 */

/** Half-extents of one voxel's diamond top face. 2:1 is the classic iso ratio. */
const TILE_W = 14;
const TILE_H = 7;
/** Vertical screen distance per world Y. */
const TILE_Z = 8;
/** Tallest structure, in blocks — the castle towers. Reserves sky above them. */
const Y_HEADROOM = 34;

/**
 * Screen span of the diamond, corner to corner. `x - z` runs over
 * ±(SIZE-1) and `x + z` over 0..2(SIZE-1), so both axes derive from this.
 */
const SPAN = 2 * (VILLAGE_SIZE - 1);

/**
 * Canvas size, DERIVED from the village rather than picked.
 *
 * A 72×72 grid at this tile size projects to a diamond 1988px across; choosing
 * a canvas first and hoping the diamond fits is how the first version ended up
 * drawing a 3124px island into 2048px and losing a third of the village off
 * both sides. Everything downstream (marker percentages, the viewport's
 * fit-to-screen) reads these, so they only have to be right here.
 */
export const MAP_W = SPAN * TILE_W + TILE_W * 2;
export const MAP_H = SPAN * TILE_H + Y_HEADROOM * TILE_Z + TILE_Z * 2;

/**
 * Vertical origin: placed so the near corner at y=0 lands just above the bottom
 * edge, which leaves exactly `Y_HEADROOM` of sky for the tall builds at the far
 * corner to grow into.
 */
const ORIGIN_Y = MAP_H - TILE_Z * 2 - SPAN * TILE_H;

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

/**
 * World → screen. Standard isometric: +x goes down-right, +z down-left, +y up.
 */
function project(x: number, y: number, z: number) {
  return {
    sx: MAP_W / 2 + (x - z) * TILE_W,
    sy: ORIGIN_Y + (x + z) * TILE_H - y * TILE_Z,
  };
}

/** One voxel as three visible faces, drawn as flat polygons. */
function drawCube(
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
function drawSky(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, MAP_H);
  g.addColorStop(0, "#2f6ebc");
  g.addColorStop(0.45, "#417ec6");
  g.addColorStop(1, "#6f9ed3");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Positional hash again — the clouds must not reshuffle on resize. Confined
  // to the top band and kept small: the island is the subject, and the first
  // pass had clouds the size of buildings dominating the frame.
  for (let i = 0; i < 18; i++) {
    const j = jitterAt(i * 17, 3, i * 91);
    const j2 = jitterAt(i * 31, 7, i * 13);
    const cx = j * MAP_W;
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
 * Draw the whole village.
 *
 * Painter's algorithm on `x + y + z`: in this projection that sum is exactly
 * depth from the camera, so sorting by it and drawing back-to-front resolves
 * occlusion with no z-buffer. Faces whose neighbour is solid are skipped
 * first — the same culling `visibleBlocks()` does, which removes most of the
 * work before any drawing happens.
 */
export function renderVillageMap(canvas: HTMLCanvasElement): VillageMapResult {
  const { world, anchors } = buildVillage();

  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { anchors: [] };

  drawSky(ctx);

  const visible = world.visibleBlocks();
  visible.sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));

  for (const v of visible) {
    const def = BLOCKS[v.type as BlockType];
    // A face is hidden when the neighbour that would cover it is solid.
    const top = !isSolid(world.get(v.x, v.y + 1, v.z));
    const left = !isSolid(world.get(v.x, v.y, v.z + 1));
    const right = !isSolid(world.get(v.x + 1, v.y, v.z));
    if (!top && !left && !right) continue;

    const { sx, sy } = project(v.x, v.y, v.z);
    // Generous cull margin — a cube's faces extend well past its origin.
    if (sx < -TILE_W * 2 || sx > MAP_W + TILE_W * 2) continue;
    if (sy < -TILE_Z * 4 || sy > MAP_H + TILE_Z * 4) continue;

    ctx.globalAlpha = def.transparent ? (def.opacity ?? 1) : 1;
    drawCube(ctx, sx, sy, def.color, def.jitter ?? 0, jitterAt(v.x, v.y, v.z), {
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
    anchors: anchors.map((a) => {
      // Label anchors sit above the building, matching the 3D view's
      // `labelHeight` so a location is in the same place in both views.
      const { sx, sy } = project(a.x, a.y + a.labelHeight, a.z);
      return {
        ...a,
        xPct: (sx / MAP_W) * 100,
        yPct: (sy / MAP_H) * 100,
      };
    }),
  };
}

/** Exposed for anything else that needs the same projection. */
export function projectToPct(
  x: number,
  y: number,
  z: number,
): { xPct: number; yPct: number } {
  const { sx, sy } = project(x, y, z);
  return { xPct: (sx / MAP_W) * 100, yPct: (sy / MAP_H) * 100 };
}

export type { VoxelWorld };
