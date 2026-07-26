import type { AssetSpec } from "./manifest";

/**
 * LAYERED SCENE MANIFEST — backgrounds, portal scenes, biome illustrations.
 *
 * A scene is an ordered stack of full-bleed layers, each with a parallax
 * `depth`. Depth 0 is infinitely far (never moves); 1 moves with the pointer at
 * full rate. Splitting a background into sky/far/mid/fore is what makes parallax
 * possible at all — a single flat image cannot have depth.
 *
 * All art is ORIGINAL voxel-inspired work. Nothing here references or reuses
 * Mojang assets: the briefs describe generic blocky landscapes, and the naming
 * avoids their terminology entirely. See ART-ASSETS.md for the per-layer prompt
 * guidance for AI generation or hand illustration.
 *
 * Every layer renders a distinguishable generated placeholder until the real
 * file exists, so parallax is visible and tunable before any art is delivered.
 */

export type LayerKind = "sky" | "far" | "mid" | "fore" | "overlay";

export interface SceneLayer extends AssetSpec {
  /** Stable key within the scene; also the placeholder label. */
  key: string;
  layer: LayerKind;
  /**
   * Parallax strength, 0–1. 0 = static (sky), 1 = tracks the pointer fully.
   * Keep foreground layers under ~0.6 or the motion reads as seasickness.
   */
  depth: number;
  /** Repeat horizontally — for tileable strips like treelines or hills. */
  tile?: boolean;
  /** Continuous horizontal drift in px/sec (clouds, mist). 0 = still. */
  drift?: number;
  /** Gentle opacity pulse period in seconds. 0 = none. */
  pulse?: number;
  /** CSS blend mode for glow/mist overlays. */
  blend?: "normal" | "screen" | "overlay" | "soft-light";
  /** Layer opacity 0–1. */
  opacity?: number;
}

export interface Scene {
  key: string;
  name: string;
  /** One-line art direction, surfaced in the placeholder and the docs. */
  brief: string;
  /** Fallback CSS gradient painted under the layers — covers any gaps. */
  baseGradient: string;
  /**
   * Placeholder palette for THIS scene: [near, far] hex pair.
   *
   * Without it, placeholders hash their colour from the layer key, which
   * produces a random rainbow per scene — a red triangle in a violet dusk
   * valley reads as a rendering bug rather than pending art. Anchoring the
   * placeholder to the scene's real palette means the pre-art state already
   * looks deliberate.
   */
  palette: [string, string];
  layers: SceneLayer[];
}

/** Terse builder so scene definitions stay readable. */
function layer(
  key: string,
  layerKind: LayerKind,
  depth: number,
  opts: Partial<SceneLayer> & { w?: number; h?: number } = {},
): SceneLayer {
  return {
    key,
    layer: layerKind,
    depth,
    src: opts.src ?? "",
    w: opts.w ?? 1920,
    h: opts.h ?? 1080,
    kind: "bg",
    ...opts,
  };
}

function scenePath(sceneKey: string, layerKey: string): string {
  return `/art/scenes/${sceneKey}/${layerKey}.png`;
}

/** Fill in each layer's src from its scene + layer key. */
function buildScene(s: Omit<Scene, "layers"> & { layers: SceneLayer[] }): Scene {
  return {
    ...s,
    layers: s.layers.map((l) => ({
      ...l,
      src: l.src || scenePath(s.key, l.key),
      note: l.note ?? `${s.key}/${l.layer}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

export const SCENES: Record<string, Scene> = {
  /** Landing page — the hero. A blocky valley at dusk with the portal ahead. */
  "portal-approach": buildScene({
    key: "portal-approach",
    name: "Portal Approach",
    brief:
      "Dusk valley of blocky terraced hills, violet sky fading to deep indigo, " +
      "a stone archway silhouetted on the ridge. Original voxel style, no game logos.",
    baseGradient: "linear-gradient(180deg, #241040 0%, #140a1f 45%, #0b0710 100%)",
    palette: ["#5f2a9a", "#2a1140"],
    layers: [
      layer("sky", "sky", 0, { pulse: 14, opacity: 0.95 }),
      layer("stars", "sky", 0.04, { pulse: 7, blend: "screen", opacity: 0.7 }),
      layer("clouds", "far", 0.1, { tile: true, drift: 7, opacity: 0.55 }),
      layer("ridge", "far", 0.18, { h: 620 }),
      layer("hills", "mid", 0.32, { h: 520 }),
      layer("trees", "mid", 0.46, { tile: true, h: 380 }),
      layer("ground", "fore", 0.62, { h: 320 }),
      layer("haze", "overlay", 0.08, { blend: "screen", opacity: 0.35, pulse: 9 }),
    ],
  }),

  /** The transit tunnel behind /entering and /travelling. */
  "void-transit": buildScene({
    key: "void-transit",
    name: "Void Transit",
    brief:
      "Abstract violet energy corridor: concentric blocky rings receding to a " +
      "bright core, drifting motes. Original abstract art.",
    baseGradient: "radial-gradient(circle at 50% 50%, #3d1259 0%, #1a0a28 55%, #0b0710 100%)",
    palette: ["#a02ce0", "#3d1259"],
    layers: [
      layer("core", "sky", 0, { pulse: 3, blend: "screen", opacity: 0.9 }),
      layer("rings", "far", 0.12, { pulse: 5, blend: "screen", opacity: 0.6 }),
      layer("motes", "mid", 0.3, { tile: true, drift: -14, blend: "screen", opacity: 0.5 }),
      layer("vignette", "overlay", 0, { opacity: 0.55 }),
    ],
  }),

  /** Auth screens — quieter, so forms stay readable on top. */
  "realm-gate": buildScene({
    key: "realm-gate",
    name: "Realm Gate",
    brief:
      "Calm night sky over distant blocky rooftops, soft violet glow on the " +
      "horizon. Deliberately low-contrast — UI panels sit on top.",
    baseGradient: "linear-gradient(180deg, #1a1024 0%, #0d0812 100%)",
    palette: ["#3b2a5c", "#1a1024"],
    layers: [
      layer("sky", "sky", 0, { opacity: 0.9 }),
      layer("skyline", "far", 0.14, { tile: true, h: 420, opacity: 0.75 }),
      layer("glow", "overlay", 0.06, { blend: "screen", opacity: 0.3, pulse: 11 }),
    ],
  }),

  // --- Biomes, one per event category ------------------------------------

  "hackathon-mine": buildScene({
    key: "hackathon-mine",
    name: "Hackathon Mine",
    brief:
      "Underground cavern of cut stone, glowing green crystal seams, wooden " +
      "support beams, mine cart rails. Original voxel style.",
    baseGradient: "linear-gradient(180deg, #1c1a17 0%, #0e0d0b 100%)",
    palette: ["#4a463c", "#1c1a17"],
    layers: [
      layer("cavern", "far", 0.1, {}),
      layer("crystals", "mid", 0.3, { blend: "screen", pulse: 6, opacity: 0.8 }),
      layer("rails", "fore", 0.5, { h: 300 }),
    ],
  }),

  "photography-forest": buildScene({
    key: "photography-forest",
    name: "Photography Forest",
    brief:
      "Sunlit blocky woodland, layered canopy, godrays through leaves, " +
      "drifting pollen. Warm greens and gold.",
    baseGradient: "linear-gradient(180deg, #2f4a1f 0%, #16240f 100%)",
    palette: ["#4e7a32", "#1f3315"],
    layers: [
      layer("sky", "sky", 0, {}),
      layer("canopy-far", "far", 0.16, { tile: true, h: 480 }),
      layer("godrays", "mid", 0.1, { blend: "screen", opacity: 0.4, pulse: 8 }),
      layer("canopy-near", "fore", 0.55, { tile: true, h: 420 }),
      layer("pollen", "overlay", 0.35, { tile: true, drift: 5, blend: "screen", opacity: 0.5 }),
    ],
  }),

  "design-workshop": buildScene({
    key: "design-workshop",
    name: "Design Workshop",
    brief:
      "Warm timber workshop interior: plank walls, pinned sketches, lantern " +
      "light, tool racks. Cosy amber palette.",
    baseGradient: "linear-gradient(180deg, #3a2b18 0%, #1a130b 100%)",
    palette: ["#8a6636", "#3a2b18"],
    layers: [
      layer("walls", "far", 0.08, {}),
      layer("benches", "mid", 0.28, { h: 520 }),
      layer("lantern", "overlay", 0.12, { blend: "screen", opacity: 0.45, pulse: 4 }),
    ],
  }),

  "quiz-library": buildScene({
    key: "quiz-library",
    name: "Quiz Library",
    brief:
      "Tall blocky library hall, shelves receding into blue shadow, floating " +
      "open books, cool cyan light.",
    baseGradient: "linear-gradient(180deg, #16283a 0%, #0a121b 100%)",
    palette: ["#2f5d80", "#132433"],
    layers: [
      layer("hall", "far", 0.1, {}),
      layer("shelves", "mid", 0.3, { tile: true, h: 560 }),
      layer("books", "fore", 0.48, { drift: 3, opacity: 0.85 }),
      layer("dust", "overlay", 0.2, { tile: true, blend: "screen", opacity: 0.3 }),
    ],
  }),

  "gaming-arena": buildScene({
    key: "gaming-arena",
    name: "Gaming Arena",
    brief:
      "Floodlit blocky colosseum, banner-lined tiers, sand floor, dramatic " +
      "red and amber stage light.",
    baseGradient: "linear-gradient(180deg, #3a1512 0%, #170807 100%)",
    palette: ["#8a3428", "#33110e"],
    layers: [
      layer("stands", "far", 0.12, {}),
      layer("banners", "mid", 0.3, { tile: true, h: 360, drift: 2 }),
      layer("floor", "fore", 0.5, { h: 300 }),
      layer("spotlights", "overlay", 0.06, { blend: "screen", opacity: 0.4, pulse: 5 }),
    ],
  }),

  "culture-stage": buildScene({
    key: "culture-stage",
    name: "Culture Stage",
    brief:
      "Open-air night stage, string lights over a blocky courtyard, warm " +
      "gold spill against deep blue.",
    baseGradient: "linear-gradient(180deg, #1b1436 0%, #0b0817 100%)",
    palette: ["#4a3b7a", "#1b1436"],
    layers: [
      layer("night", "sky", 0, {}),
      layer("courtyard", "far", 0.15, { h: 500 }),
      layer("stage", "mid", 0.34, { h: 420 }),
      layer("lights", "overlay", 0.1, { tile: true, blend: "screen", opacity: 0.55, pulse: 3 }),
    ],
  }),

  "circuit-lab": buildScene({
    key: "circuit-lab",
    name: "Circuit Lab",
    brief:
      "Clean workshop of blocky machinery, glowing conduit lines tracing the " +
      "walls, teal and slate palette.",
    baseGradient: "linear-gradient(180deg, #14232b 0%, #080f13 100%)",
    palette: ["#2c6472", "#0f2129"],
    layers: [
      layer("machines", "far", 0.1, {}),
      layer("conduits", "mid", 0.26, { blend: "screen", pulse: 2.5, opacity: 0.75 }),
      layer("bench", "fore", 0.48, { h: 320 }),
    ],
  }),
};

export type SceneKey = keyof typeof SCENES;

export function getScene(key: string): Scene | undefined {
  return SCENES[key];
}

/** Every declared scene layer — used by the kitchen-sink asset audit. */
export function allSceneLayers(): Array<{ scene: string; layer: SceneLayer }> {
  return Object.values(SCENES).flatMap((s) =>
    s.layers.map((l) => ({ scene: s.key, layer: l })),
  );
}
