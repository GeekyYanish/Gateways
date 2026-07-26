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
  private readonly blocks = new Map<string, BlockType>();
  readonly anchors: WorldAnchor[] = [];
  /** Ground height per column, so things can be placed on the surface. */
  private readonly heightMap = new Map<string, number>();

  constructor(size = 64) {
    this.size = size;
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

/** Cheap smooth noise for terrain — good enough for gentle rolling ground. */
export function smoothNoise(
  rng: () => number,
  size: number,
): (x: number, z: number) => number {
  const gridSize = 8;
  const g = gridSize + 1;
  const grid: number[] = Array.from({ length: g * g }, () => rng());

  return (x: number, z: number) => {
    const fx = (x / size) * gridSize;
    const fz = (z / size) * gridSize;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = fx - x0;
    const tz = fz - z0;
    // Smoothstep so the terrain has no visible grid seams.
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);
    const at = (ix: number, iz: number) =>
      grid[Math.min(g - 1, Math.max(0, iz)) * g + Math.min(g - 1, Math.max(0, ix))];

    const a = at(x0, z0) * (1 - sx) + at(x0 + 1, z0) * sx;
    const b = at(x0, z0 + 1) * (1 - sx) + at(x0 + 1, z0 + 1) * sx;
    return a * (1 - sz) + b * sz;
  };
}
