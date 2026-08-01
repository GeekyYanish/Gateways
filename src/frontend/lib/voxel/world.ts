import { BLOCKS, isSolid, type BlockType } from "./blocks";

/**
 * Voxel world: a sparse grid plus the builders that populate it.
 *
 * Sparse (a Map keyed by "x,y,z") rather than a dense 3D array because the
 * village is mostly air — a 64×24×64 dense array is 98k slots for ~12k real
 * blocks. The Map also makes neighbour lookups for face culling trivial.
 */

export interface Voxel {
  x: number;
  y: number;
  z: number;
  type: BlockType;
}

/** An interactive building the player can click. */
export interface WorldAnchor {
  /** Matches WORLD_LOCATIONS[].key so it routes to the right event category. */
  key: string;
  label: string;
  href: string;
  /** Centre of the building, world coords. */
  x: number;
  y: number;
  z: number;
  /** Click/hover hitbox half-extents. */
  radius: number;
  /** Height of the floating label above the anchor. */
  labelHeight: number;
}

export class VoxelWorld {
  readonly size: number;
  /**
   * Depth, when the world is not square. Defaults to `size`.
   *
   * A building is not a square: ours is 126 × 104. Nothing here indexes by it —
   * storage is a sparse Map, so an oversized grid costs no memory — but the
   * isometric map derives its canvas span from these, and a square span for a
   * rectangular plan draws it off-centre in a quarter-empty canvas.
   */
  readonly sizeZ: number;
  private readonly blocks = new Map<string, BlockType>();
  readonly anchors: WorldAnchor[] = [];
  /** Ground height per column, so things can be placed on the surface. */
  private readonly heightMap = new Map<string, number>();

  constructor(size = 64, sizeZ = size) {
    this.size = size;
    this.sizeZ = sizeZ;
  }

  private static key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  set(x: number, y: number, z: number, type: BlockType): void {
    if (y < 0) return;
    this.blocks.set(VoxelWorld.key(x, y, z), type);
    const hk = `${x},${z}`;
    if (isSolid(type) && (this.heightMap.get(hk) ?? -1) < y) {
      this.heightMap.set(hk, y);
    }
  }

  get(x: number, y: number, z: number): BlockType | undefined {
    return this.blocks.get(VoxelWorld.key(x, y, z));
  }

  /** Surface height at a column, or -1 if empty. */
  groundAt(x: number, z: number): number {
    return this.heightMap.get(`${Math.round(x)},${Math.round(z)}`) ?? -1;
  }

  /**
   * Highest solid block at or below `y` in a column, or -1.
   *
   * This is the one to use for "what am I standing on". `groundAt` returns the
   * highest solid block ANYWHERE in the column, which stopped being the same
   * thing the moment the world grew doorways: stand in a doorway and the
   * highest solid block is the lintel above your head, so the player was
   * placed on top of the door frame and every room in the building was sealed.
   *
   * Starts from the column's known top rather than from `y` so the common case
   * — open ground, nothing overhead — still resolves on the first iteration.
   */
  groundBelow(x: number, y: number, z: number): number {
    const cx = Math.round(x);
    const cz = Math.round(z);
    const top = this.heightMap.get(`${cx},${cz}`) ?? -1;
    if (top < 0) return -1;
    for (let cy = Math.min(top, Math.floor(y)); cy >= 0; cy--) {
      if (isSolid(this.get(cx, cy, cz))) return cy;
    }
    return -1;
  }

  isSolidAt(x: number, y: number, z: number): boolean {
    return isSolid(this.get(Math.round(x), Math.round(y), Math.round(z)));
  }

  /** Fill an axis-aligned box (inclusive). */
  fill(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    type: BlockType,
  ): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
          this.set(x, y, z, type);
        }
      }
    }
  }

  /** Hollow box — walls only, no interior. Used for every building shell. */
  box(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    type: BlockType,
  ): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
          const onEdge =
            x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1;
          if (onEdge) this.set(x, y, z, type);
        }
      }
    }
  }

  /**
   * Visible blocks only.
   *
   * A block whose six neighbours are all solid can never be seen, so it is
   * dropped before it ever reaches the GPU. On this village that removes
   * roughly two thirds of the blocks — the single biggest win available, and
   * the reason the scene renders at all on a phone.
   */
  visibleBlocks(): Voxel[] {
    const out: Voxel[] = [];

    for (const [k, type] of this.blocks) {
      const [x, y, z] = k.split(",").map(Number);

      // Transparent blocks always render — they are visible through by design.
      if (BLOCKS[type].transparent) {
        out.push({ x, y, z, type });
        continue;
      }

      const buried =
        isSolid(this.get(x + 1, y, z)) &&
        isSolid(this.get(x - 1, y, z)) &&
        isSolid(this.get(x, y + 1, z)) &&
        isSolid(this.get(x, y - 1, z)) &&
        isSolid(this.get(x, y, z + 1)) &&
        isSolid(this.get(x, y, z - 1));

      if (!buried) out.push({ x, y, z, type });
    }

    return out;
  }

  get blockCount(): number {
    return this.blocks.size;
  }
}

// ---------------------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------------------

/**
 * Mulberry32. Seeded so the village is IDENTICAL on every load — a village that
 * regenerates differently each visit would make the map unlearnable, and would
 * also break the anchor positions the UI links to.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// `smoothNoise` lived here to shape the old procedural terrain. The world is a
// building on one flat level now, and it had no other caller.
