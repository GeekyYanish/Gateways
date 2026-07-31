/**
 * THE SINGLE SOURCE OF TRUTH FOR EVERY ART PATH.
 *
 * No component may hardcode an image path. Import from here instead.
 *
 * Why the indirection: the real pixel art does not exist yet — the user is
 * authoring it. Every entry declares its expected intrinsic dimensions, and
 * <PixelImage> falls back to a generated placeholder of exactly those
 * dimensions when the file is missing. That means:
 *   - no broken-image icons, ever
 *   - no layout shift when real art lands (the box is already the right size)
 *   - a dev-mode console warning if a delivered file is the wrong size
 *
 * Dimensions are the art's INTRINSIC (1x) size. Display size is that multiplied
 * by --mc-scale, always an integer, so pixels stay square and crisp.
 *
 * The dimension table in ART-ASSETS.md is generated from this file — keep them
 * in sync by editing here.
 */

export type AssetKind =
  | "sprite" // free-standing pixel art with alpha
  | "tile" // must tile seamlessly (block textures)
  | "skin" // character skin bust/full render
  | "map" // large world map
  | "bg" // full-bleed background
  | "nine-slice" // stretched via border-image
  | "icon"; // small UI glyph

export interface AssetSpec {
  src: string;
  /** Intrinsic width at 1x, in pixels. */
  w: number;
  /** Intrinsic height at 1x, in pixels. */
  h: number;
  kind: AssetKind;
  /** Short note shown inside the placeholder to guide the artist. */
  note?: string;
}

const spec = <T extends Record<string, AssetSpec>>(t: T) => t;

export const ART = {
  portal: spec({
    frame: { src: "/art/portal/portal-frame.png", w: 320, h: 400, kind: "sprite", note: "obsidian frame" },
    swirl: { src: "/art/portal/portal-swirl.png", w: 256, h: 320, kind: "sprite", note: "inner swirl" },
    particle: { src: "/art/portal/particle.png", w: 8, h: 8, kind: "sprite", note: "white, CSS-tinted" },
    voidBg: { src: "/art/portal/void-bg.png", w: 1920, h: 1080, kind: "bg", note: "tileable starfield" },
  }),

  /**
   * Original voxel-character archetypes — NOT Minecraft characters.
   * See ART-ASSETS.md for the per-archetype design brief.
   */
  skins: spec({
    prospector: { src: "/art/skins/prospector.png", w: 64, h: 64, kind: "skin", note: "hard hat, lamp" },
    botanist: { src: "/art/skins/botanist.png", w: 64, h: 64, kind: "skin", note: "leaf cloak" },
    sentinel: { src: "/art/skins/sentinel.png", w: 64, h: 64, kind: "skin", note: "plated guard" },
    voidwalker: { src: "/art/skins/voidwalker.png", w: 64, h: 64, kind: "skin", note: "starfield robe" },
    artificer: { src: "/art/skins/artificer.png", w: 64, h: 64, kind: "skin", note: "goggles, tools" },
  }),

  /** Full-body standing renders for the character-creation carousel. */
  skinsFull: spec({
    prospector: { src: "/art/skins/full/prospector.png", w: 128, h: 256, kind: "skin" },
    botanist: { src: "/art/skins/full/botanist.png", w: 128, h: 256, kind: "skin" },
    sentinel: { src: "/art/skins/full/sentinel.png", w: 128, h: 256, kind: "skin" },
    voidwalker: { src: "/art/skins/full/voidwalker.png", w: 128, h: 256, kind: "skin" },
    artificer: { src: "/art/skins/full/artificer.png", w: 128, h: 256, kind: "skin" },
  }),

  world: spec({
    map: { src: "/art/world/village-map.png", w: 2048, h: 1152, kind: "map", note: "isometric 16:9" },
    mapMobile: { src: "/art/world/village-map-mobile.png", w: 1024, h: 1536, kind: "map", note: "portrait recrop" },
    signpost: { src: "/art/world/signpost.png", w: 96, h: 128, kind: "sprite" },
    signpostHover: { src: "/art/world/signpost-hover.png", w: 96, h: 128, kind: "sprite" },
  }),

  blocks: spec({
    dirt: { src: "/art/blocks/dirt.png", w: 16, h: 16, kind: "tile" },
    grass: { src: "/art/blocks/grass.png", w: 16, h: 16, kind: "tile" },
    stone: { src: "/art/blocks/stone.png", w: 16, h: 16, kind: "tile" },
    planks: { src: "/art/blocks/planks.png", w: 16, h: 16, kind: "tile" },
    obsidian: { src: "/art/blocks/obsidian.png", w: 16, h: 16, kind: "tile" },
    emerald: { src: "/art/blocks/emerald.png", w: 16, h: 16, kind: "tile" },
    diamond: { src: "/art/blocks/diamond.png", w: 16, h: 16, kind: "tile" },
    basalt: { src: "/art/blocks/basalt.png", w: 16, h: 16, kind: "tile" },
  }),

  items: spec({
    pickaxe: { src: "/art/items/pickaxe.png", w: 32, h: 32, kind: "sprite" },
    camera: { src: "/art/items/camera.png", w: 32, h: 32, kind: "sprite" },
    book: { src: "/art/items/book.png", w: 32, h: 32, kind: "sprite" },
    sword: { src: "/art/items/sword.png", w: 32, h: 32, kind: "sprite" },
    compass: { src: "/art/items/compass.png", w: 32, h: 32, kind: "sprite" },
    trophy: { src: "/art/items/trophy.png", w: 32, h: 32, kind: "sprite" },
    craftingTable: { src: "/art/items/crafting-table.png", w: 32, h: 32, kind: "sprite" },
    chest: { src: "/art/items/chest.png", w: 32, h: 32, kind: "sprite" },
    map: { src: "/art/items/map.png", w: 32, h: 32, kind: "sprite" },
    warpOrb: { src: "/art/items/warp-orb.png", w: 32, h: 32, kind: "sprite" },
  }),

  /**
   * The homepage's digital-twin comparison: the same object photographed and
   * then rebuilt out of blocks, side by side. Both halves are declared at the
   * SAME intrinsic size on purpose — the whole point of the section is that the
   * pair reads as one object seen twice, and two different box sizes would
   * break that the moment the real art lands.
   */
  twins: spec({
    // Notes stay SHORT: the placeholder draws "<w>×<h> <note>" on one
    // unwrapped line, so a long note runs straight out of the box.
    physical: { src: "/art/twins/physical.png", w: 256, h: 256, kind: "sprite", note: "photo" },
    mirrored: { src: "/art/twins/mirrored.png", w: 256, h: 256, kind: "sprite", note: "voxel" },
  }),

  /**
   * Brand marks. Mixed rendering rules — check before reaching for `<PixelImage>`:
   *
   * - `christUniversity` is a smooth vector wordmark and must NEVER go through
   *   `<PixelImage>`; `image-rendering: pixelated` destroys its curves and
   *   misrepresents someone else's brand. Render it with a plain <img> at a CSS
   *   height. The path still lives here so the no-hardcoded-paths rule holds.
   * - `gatewaysCrest` is the full-detail crest at 1254px. Its edges are smooth,
   *   so it must only be pixelated at an integer multiple of its own size —
   *   which in practice means never; render it at a CSS size and leave sampling
   *   alone.
   * - `gatewaysCrestPixel` IS pixel art: the crest redrawn at 152px against the
   *   gold token ramp by `scripts/gen-splash-mask.mjs`. Draw it ONLY at integer
   *   multiples of 152 (304/456/608/760) and always with `pixelated`. It is what
   *   the splash screen assembles out of flying blocks.
   * - `gatewaysCrestAperture` is not artwork at all — it is the crest's filled
   *   silhouette, used only as a CSS mask so the splash can zoom into the logo
   *   and reveal the page through it. Never render it directly.
   */
  brand: spec({
    christUniversity: { src: "/art/brand/christ-university.png", w: 1795, h: 608, kind: "sprite", note: "CHRIST wordmark, white" },
    gatewaysCrest: { src: "/art/brand/Gateways_Pixel.png", w: 1254, h: 1254, kind: "sprite", note: "Gateways crest, gold" },
    gatewaysCrestPixel: { src: "/art/brand/gateways-crest-pixel.png", w: 152, h: 152, kind: "sprite", note: "crest, pixel art" },
    gatewaysCrestAperture: { src: "/art/brand/gateways-crest-aperture.png", w: 152, h: 152, kind: "sprite", note: "crest silhouette, CSS mask" },
  }),

  ui: spec({
    hotbarFrame: { src: "/art/ui/hotbar.png", w: 364, h: 44, kind: "sprite" },
    slot: { src: "/art/ui/slot.png", w: 18, h: 18, kind: "sprite" },
    xpBarEmpty: { src: "/art/ui/xp-empty.png", w: 182, h: 5, kind: "sprite" },
    xpBarFull: { src: "/art/ui/xp-full.png", w: 182, h: 5, kind: "sprite" },
    heart: { src: "/art/ui/heart.png", w: 9, h: 9, kind: "sprite" },
    panelBg: { src: "/art/ui/panel.png", w: 48, h: 48, kind: "nine-slice", note: "16px corners" },
  }),
} as const;

/** Badge art is keyed by `achievements.code`, so the path is derived. */
export function badgeAsset(code: string): AssetSpec {
  return { src: `/art/badges/${code}.png`, w: 64, h: 64, kind: "sprite" };
}

/** Block-texture asset by palette name, for tiled backgrounds. */
export type BlockName = keyof typeof ART.blocks;
export type SkinId = keyof typeof ART.skins;
export type ItemName = keyof typeof ART.items;

export const SKIN_IDS = Object.keys(ART.skins) as SkinId[];

/** Flat list of every declared asset — used by the kitchen-sink audit page. */
export function allAssets(): Array<{ group: string; key: string; spec: AssetSpec }> {
  const out: Array<{ group: string; key: string; spec: AssetSpec }> = [];
  for (const [group, entries] of Object.entries(ART)) {
    for (const [key, s] of Object.entries(entries as Record<string, AssetSpec>)) {
      out.push({ group, key, spec: s });
    }
  }
  return out;
}
