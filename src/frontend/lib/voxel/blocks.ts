/**
 * Voxel block palette.
 *
 * ORIGINAL colours, not Minecraft textures. These are flat-shaded solid colours
 * with a slight top/side/bottom brightness ramp, which is what gives untextured
 * cubes their readable form — the same trick that makes the CSS bevel system
 * work, applied in 3D.
 *
 * Adding a type is CHEAP. `voxel-terrain.tsx` merges every opaque type into one
 * geometry and every transparent type into a second — two draw calls for the
 * whole world, regardless of how many types are listed here. (This comment used
 * to claim one InstancedMesh per type; that described the implementation that
 * was measured and replaced. See VOXEL-3D.md.)
 */

export type BlockType =
  | "grass"
  | "dirt"
  | "stone"
  | "cobble"
  | "plank"
  | "log"
  | "leaf"
  | "sand"
  | "water"
  | "glass"
  | "obsidian"
  | "portal"
  | "emerald"
  | "gold"
  | "ruby"
  | "sapphire"
  | "roofDark"
  | "roofRed"
  | "lantern"
  | "path"
  // Architectural palette, for the floor plan.
  | "wallPaint"
  | "trim"
  | "floorTile"
  | "floorTileAlt"
  | "carpet"
  | "carpetBlue"
  | "carpetGreen"
  | "carpetGold"
  | "carpetPurple"
  | "desk"
  | "board"
  | "paving"
  | "pavingAlt"
  // Planting.
  | "hedge"
  | "flower";

export interface BlockDef {
  /** Base colour, hex. */
  color: string;
  /** Semi-transparent blocks (water, glass) render in a second pass. */
  transparent?: boolean;
  opacity?: number;
  /** Emissive strength, for lanterns and portal blocks. */
  emissive?: string;
  emissiveIntensity?: number;
  /** Slight per-instance colour jitter, so large flat areas do not look sterile. */
  jitter?: number;
}

export const BLOCKS: Record<BlockType, BlockDef> = {
  grass: { color: "#5fa73f", jitter: 0.07 },
  dirt: { color: "#8b5a2b", jitter: 0.06 },
  stone: { color: "#7f7f7f", jitter: 0.05 },
  cobble: { color: "#6b6b6b", jitter: 0.09 },
  plank: { color: "#9c7f4e", jitter: 0.05 },
  log: { color: "#6d5732", jitter: 0.04 },
  // Opaque despite being walk-through. Rendering it at 0.96 alpha bought
  // nothing visible and put every leaf in the depth-write-disabled pass, where
  // overlapping canopies sorted against each other. `NON_SOLID` below is what
  // makes it walk-through; that is a separate question from how it draws.
  leaf: { color: "#4a9c3d", jitter: 0.11 },
  sand: { color: "#d9c89a", jitter: 0.05 },
  water: { color: "#2f6fd0", transparent: true, opacity: 0.62 },
  glass: { color: "#b8e4f0", transparent: true, opacity: 0.34 },
  obsidian: { color: "#1a1024", jitter: 0.05 },
  portal: {
    color: "#a02ce0",
    transparent: true,
    opacity: 0.85,
    emissive: "#c964ff",
    emissiveIntensity: 0.9,
  },
  emerald: { color: "#17c07b", emissive: "#17c07b", emissiveIntensity: 0.25 },
  gold: { color: "#f2b233", emissive: "#f2b233", emissiveIntensity: 0.2 },
  ruby: { color: "#d63b2f", emissive: "#d63b2f", emissiveIntensity: 0.2 },
  sapphire: { color: "#3ddfe0", emissive: "#3ddfe0", emissiveIntensity: 0.25 },
  roofDark: { color: "#4a3b5c", jitter: 0.05 },
  roofRed: { color: "#8a3428", jitter: 0.06 },
  lantern: {
    color: "#ffd166",
    emissive: "#ffd166",
    emissiveIntensity: 1.4,
  },
  path: { color: "#b09b6a", jitter: 0.08 },

  // Interior surfaces. Jitter is kept low: these cover large flat areas where
  // the terrain palette's heavy jitter reads as noise rather than as texture.
  wallPaint: { color: "#e6e0d0", jitter: 0.025 },
  /** Skirting at the foot of every wall — the band that stops walls floating. */
  trim: { color: "#8d7f6a", jitter: 0.03 },
  /**
   * Two floor tones laid in a checker. Ambient occlusion gives the room its
   * corners; this gives the floor a sense of scale, which a single flat colour
   * over 6,000 blocks cannot.
   */
  floorTile: { color: "#bdb6a8", jitter: 0.03 },
  floorTileAlt: { color: "#aaa294", jitter: 0.03 },
  /** One carpet per classroom, so a room is identifiable at a glance. */
  carpet: { color: "#8a4c50", jitter: 0.045 },
  carpetBlue: { color: "#3f5f86", jitter: 0.045 },
  carpetGreen: { color: "#417a55", jitter: 0.045 },
  carpetGold: { color: "#9a7736", jitter: 0.045 },
  carpetPurple: { color: "#6b4a86", jitter: 0.045 },
  desk: { color: "#b98f52", jitter: 0.04 },
  board: { color: "#31513f", jitter: 0.03 },

  /** Courtyard paving, checkered like the indoor tiles. */
  paving: { color: "#9d9384", jitter: 0.05 },
  pavingAlt: { color: "#8d8375", jitter: 0.05 },

  hedge: { color: "#39702f", jitter: 0.09 },
  flower: { color: "#e0687f", emissive: "#e0687f", emissiveIntensity: 0.15 },
};

export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[];

/** Blocks you can walk through — excluded from collision and from face culling. */
export const NON_SOLID: ReadonlySet<BlockType> = new Set<BlockType>([
  "water",
  "leaf",
  "glass",
  "portal",
]);

export function isSolid(t: BlockType | undefined): boolean {
  return t !== undefined && !NON_SOLID.has(t);
}
