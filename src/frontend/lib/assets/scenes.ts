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
  /**
   * Names a painter in `scene-art.ts`. When set, the layer draws finished
   * generated art instead of the generic "art pending" silhouette — and draws
   * it immediately, rather than only after the real file 404s. The `src` below
   * still wins the moment a PNG exists at that path.
   */
  paint?: string;
  /**
   * `background-size` override. Default: `auto 100%` when tiling, else `cover`.
   * Needed by edge-anchored layers, which must occupy a fixed share of the
   * viewport width rather than being cover-cropped.
   */
  fit?: string;
  /**
   * `background-position` override. Default: `center bottom` for `fore`
   * layers, `center` otherwise.
   */
  anchor?: string;
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

/**
 * Intrinsic size for a full-bleed painted landform.
 *
 * Deliberately 1280×1080 rather than the 1920×1080 default. These layers are
 * `cover`-fitted, and `cover` scales by the larger ratio — so a 16:9 source in
 * a portrait phone viewport gets blown up more than 4×, turning a 24px block
 * into a 98px slab and the distant ridge into a wall across the screen. A
 * squarer source cuts that to about 1.8× and keeps the blocks block-sized at
 * every aspect. It costs a little horizontal crop on ultrawide, which is the
 * cheap direction to lose.
 */
const LANDFORM = { w: 1280, h: 1080 } as const;

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
  /**
   * Landing page — the hero, and the one scene that is fully painted rather
   * than placeheld (see `scene-art.ts`).
   *
   * A bright afternoon valley: mossy stone walls closing in from both sides, a
   * brick path running up to the portal. The daylight is deliberate — the
   * portal is the only violet in frame, so it reads as the way out.
   *
   * The two `cliff-*` walls are separate edge-anchored layers instead of one
   * wide background. A `cover`-fitted image crops from the sides, so on a
   * portrait phone the framing would be the first thing lost.
   */
  "portal-approach": buildScene({
    key: "portal-approach",
    name: "Portal Approach",
    brief:
      "Sunlit valley of blocky mossy-stone cliffs under a bright blue sky with " +
      "stepped white clouds, a stone brick path leading to the portal. " +
      "Original voxel style, no game logos.",
    baseGradient: "linear-gradient(180deg, #1b4a86 0%, #2064b4 45%, #5787bf 100%)",
    palette: ["#5787bf", "#1b4a86"],
    layers: [
      layer("sky", "sky", 0, { paint: "sky-day" }),
      layer("clouds", "far", 0.08, { paint: "clouds-blocky", tile: true, drift: 6, opacity: 0.95 }),
      layer("ridge", "far", 0.18, { ...LANDFORM, paint: "ridge-far", opacity: 0.75 }),
      // Same depth on both walls: they are one wall of rock the camera sits
      // inside, so any difference would read as the valley shearing.
      layer("cliff-left", "mid", 0.3, {
        paint: "cliff-left",
        w: 480,
        h: 1080,
        fit: "clamp(58px, 24vw, 430px) 100%",
        anchor: "left bottom",
      }),
      layer("cliff-right", "mid", 0.3, {
        paint: "cliff-right",
        w: 480,
        h: 1080,
        fit: "clamp(58px, 24vw, 430px) 100%",
        anchor: "right bottom",
      }),
      layer("grass", "fore", 0.5, { ...LANDFORM, paint: "grass-fore" }),
      layer("path", "fore", 0.58, { ...LANDFORM, paint: "path-stones" }),
      layer("spill", "overlay", 0.05, {
        paint: "portal-spill",
        blend: "screen",
        opacity: 0.6,
        pulse: 6,
      }),
    ],
  }),

  /**
   * Homepage hero — a sunlit overworld that pans forever.
   *
   * Modelled on the way a voxel game's title screen slowly sweeps across a
   * landscape: nothing happens, but the world is never still, so the page feels
   * alive before the visitor has done anything.
   *
   * Every layer is `tile: true` with its own `drift`, and the drift rates rise
   * with depth — far hills crawl, the near meadow slides. That gradient IS the
   * parallax; identical speeds would flatten the whole thing into one moving
   * photograph. Pointer parallax still applies on top, so moving the mouse and
   * simply waiting both produce depth.
   *
   * Bright by design. This is the fest's front door and the theme is a daylight
   * world being mirrored, not a portal in a dark valley — so there is no violet
   * anywhere in the stack.
   */
  "overworld-panorama": buildScene({
    key: "overworld-panorama",
    name: "Overworld Panorama",
    brief:
      "Sunlit blocky overworld panning slowly: banded blue sky, stepped white " +
      "clouds, hazed rolling hills, a treeline, and a vivid near meadow. " +
      "Seamlessly tileable horizontally. Original voxel style, no game logos.",
    baseGradient: "linear-gradient(180deg, #1b4a86 0%, #2064b4 38%, #5787bf 68%, #5fa73f 100%)",
    palette: ["#7ec850", "#2064b4"],
    layers: [
      layer("sky", "sky", 0, { paint: "sky-day" }),
      // NO decorative cloud layer here, deliberately. The homepage writes its
      // announcements into pixel clouds of its own (`sky-announcements.tsx`),
      // and a second set of painted clouds drifting behind them turned the sky
      // into visual noise — two cloud systems at different speeds, one of them
      // carrying text. The announcement clouds ARE this scene's clouds.
      layer("hills", "far", 0.16, {
        paint: "hills-tile",
        tile: true,
        drift: -8,
        w: 1600,
        h: 900,
        opacity: 0.9,
      }),
      layer("treeline", "mid", 0.3, {
        paint: "treeline-tile",
        tile: true,
        drift: -15,
        w: 1600,
        h: 900,
      }),
      layer("meadow", "fore", 0.46, {
        paint: "meadow-tile",
        tile: true,
        drift: -26,
        w: 1600,
        h: 900,
      }),
    ],
  }),

  /**
   * `/entering` — the same valley at night, stood right at the portal's foot.
   *
   * It reuses every landform painter from `portal-approach` unchanged and
   * darkens them with a single veil layer, rather than duplicating the whole
   * set in a night palette. One source of truth per landform; the two scenes
   * cannot drift apart.
   */
  "portal-threshold": buildScene({
    key: "portal-threshold",
    name: "Portal Threshold",
    brief:
      "The valley at night: deep blue sky and stars, mossy stone walls lit only " +
      "by the portal's violet spill, lantern-lit brick path. Original voxel style.",
    baseGradient: "linear-gradient(180deg, #070b1c 0%, #0c1126 55%, #161f45 100%)",
    palette: ["#2a3a6a", "#070b1c"],
    layers: [
      layer("sky", "sky", 0, { paint: "sky-night" }),
      layer("ridge", "far", 0.16, { ...LANDFORM, paint: "ridge-far", opacity: 0.35 }),
      layer("cliff-left", "mid", 0.28, {
        paint: "cliff-left",
        w: 480,
        h: 1080,
        fit: "clamp(80px, 29vw, 460px) 100%",
        anchor: "left bottom",
      }),
      layer("cliff-right", "mid", 0.28, {
        paint: "cliff-right",
        w: 480,
        h: 1080,
        fit: "clamp(80px, 29vw, 460px) 100%",
        anchor: "right bottom",
      }),
      layer("grass", "fore", 0.46, { ...LANDFORM, paint: "grass-fore" }),
      layer("path", "fore", 0.54, { ...LANDFORM, paint: "path-stones" }),
      // Veil first, THEN the spill — so the portal's light reads as the only
      // light source rather than being dimmed along with everything else.
      layer("veil", "overlay", 0.04, { paint: "night-veil" }),
      layer("spill", "overlay", 0.05, {
        paint: "portal-spill",
        blend: "screen",
        opacity: 0.85,
        pulse: 5,
      }),
      layer("motes", "overlay", 0.22, {
        paint: "air-motes",
        tile: true,
        drift: -4,
        blend: "screen",
        opacity: 0.8,
        pulse: 7,
      }),
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

  /**
   * Auth screens — near-black with only a breath of violet.
   *
   * By far the quietest scene in the set, and that is the point: this is the
   * one screen where the user is doing precise work (typing credentials), so
   * the backdrop has to disappear. Painted rather than placeheld so it looks
   * finished, but with nothing in it that could pull focus from the form.
   */
  "realm-gate": buildScene({
    key: "realm-gate",
    name: "Realm Gate",
    brief:
      "Near-black void with a faint violet bloom behind the panel and a few " +
      "drifting embers. Deliberately almost empty — a form sits on top.",
    baseGradient: "linear-gradient(180deg, #05040c 0%, #0a0616 55%, #04030a 100%)",
    palette: ["#2a1a4a", "#05040c"],
    layers: [
      layer("glow", "overlay", 0.04, {
        paint: "portal-spill",
        blend: "screen",
        opacity: 0.14,
        pulse: 11,
      }),
      layer("motes", "overlay", 0.16, {
        paint: "air-motes",
        tile: true,
        drift: -3,
        blend: "screen",
        opacity: 0.16,
        pulse: 9,
      }),
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
