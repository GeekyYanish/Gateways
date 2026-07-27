/**
 * Voxel block palette.
 *
 * ORIGINAL colours, not Minecraft textures. These are flat-shaded solid colours
 * with a slight top/side/bottom brightness ramp, which is what gives untextured
 * cubes their readable form — the same trick that makes the CSS bevel system
 * work, applied in 3D.
 *
 * Each block type becomes ONE InstancedMesh at render time, so the count here
 * is effectively the draw-call budget for the world. Keep it small.
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
  | "path";

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
  leaf: { color: "#3f8a34", transparent: true, opacity: 0.96, jitter: 0.1 },
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
