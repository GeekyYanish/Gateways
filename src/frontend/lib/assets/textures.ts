import { seededRandom, svgDataUri } from "./placeholder";

/**
 * Generated block textures.
 *
 * These are ORIGINAL tiles drawn in code, not sampled art. The reference for
 * the footer was a Minecraft grass-and-dirt texture, which the project's
 * originality rule rules out shipping (see the constraint in CLAUDE.md — no
 * Mojang textures), so the structure is reproduced and the pixels are our own:
 * a grass cap with a ragged blade fringe over a speckled dirt field.
 *
 * Data URIs rather than files in /public/art for the same reason
 * `placeholder.ts` uses them — zero network requests, nothing to deliver later,
 * and no image path for a component to hardcode.
 *
 * Everything here is SEEDED (`seededRandom`, never `Math.random`). These
 * strings are built at module scope and rendered into markup that is
 * server-rendered first: an unseeded scatter would produce different pixels on
 * the server and the client and blow up hydration, quite apart from the texture
 * visibly reshuffling on every navigation.
 */

/** Art pixels per tile edge. Keep at 16 — every consumer scales it by an
 *  integer multiple of `--mc-unit`, which is only whole pixels at 16. */
const TILE = 16;

/** Grass rows before the blade fringe starts, and the deepest a blade hangs. */
const GRASS_ROWS = 6;
const BLADE_MAX = 4;

/** Cap tile height: the solid grass plus the longest possible blade. */
const CAP_H = GRASS_ROWS + BLADE_MAX;

/* The dirt spread. Base is the fill; the rest are scattered over it. Pulled
   toward the project's --color-mc-dirt scale rather than the reference's
   lighter earth, because the footer carries text and a pale ground fights it. */
const DIRT_BASE = "#8b6446";
const DIRT_SHADES = ["#a27653", "#77563d", "#5f4230"] as const;
const PEBBLE = "#7d7a76";

/* Grass anchored on #8fc661 — the same green the page gradient's meadow lands
   on, so the footer reads as the ground that horizon was promising rather than
   as a differently-lit patch. */
const GRASS_SHADES = ["#8fc661", "#7cb350", "#6d9f45", "#a2d178"] as const;

const px = (x: number, y: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;

const svg = (w: number, h: number, body: string, base?: string) =>
  svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">` +
      (base ? `<rect width="${w}" height="${h}" fill="${base}"/>` : "") +
      body +
      `</svg>`,
  );

/**
 * Seamless dirt. Only cells that differ from the base are emitted — the base
 * rect covers the rest, which roughly halves the data URI.
 *
 * The generator is consumed once per cell in a fixed order, so the pattern is
 * identical everywhere it renders.
 */
function buildDirt(): string {
  const rand = seededRandom("gateways:footer-dirt");
  let body = "";
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const r = rand();
      // Pebbles are deliberately rare: at more than a few percent the field
      // stops reading as soil and starts reading as gravel.
      if (r < 0.035) body += px(x, y, PEBBLE);
      else if (r < 0.29) body += px(x, y, DIRT_SHADES[0]);
      else if (r < 0.56) body += px(x, y, DIRT_SHADES[1]);
      else if (r < 0.72) body += px(x, y, DIRT_SHADES[2]);
    }
  }
  return svg(TILE, TILE, body, DIRT_BASE);
}

/**
 * The grass cap: solid grass on top, then one blade per column hanging a
 * random 0–4 pixels into the dirt.
 *
 * No base fill — everything below a column's blade stays TRANSPARENT so the
 * dirt layer underneath shows through. That is what lets the two tiles compose
 * as separate background layers instead of needing one combined image at a
 * fixed footer height.
 *
 * Blade depths are drawn from their own generator so that tweaking the shade
 * thresholds below never reshuffles the silhouette.
 */
function buildGrassCap(): string {
  const depthRand = seededRandom("gateways:footer-blades");
  const shadeRand = seededRandom("gateways:footer-grass");
  const depths = Array.from({ length: TILE }, () =>
    Math.floor(depthRand() * (BLADE_MAX + 1)),
  );

  let body = "";
  for (let x = 0; x < TILE; x++) {
    const bottom = GRASS_ROWS + depths[x];
    for (let y = 0; y < bottom; y++) {
      const r = shadeRand();
      // The palest shade is biased to the top rows so the cap reads as lit
      // from above rather than as uniform noise.
      const lit = y < 2 && r < 0.45;
      body += px(
        x,
        y,
        lit
          ? GRASS_SHADES[3]
          : r < 0.3
            ? GRASS_SHADES[1]
            : r < 0.52
              ? GRASS_SHADES[2]
              : GRASS_SHADES[0],
      );
    }
  }
  return svg(TILE, CAP_H, body);
}

export const DIRT_TILE = buildDirt();
export const GRASS_CAP = buildGrassCap();

/**
 * Ready-made `style` for a grass-topped dirt surface.
 *
 * Layer order is cap, scrim, dirt — the scrim sits BETWEEN them on purpose.
 * Darkening the dirt is what lets pale text clear 4.5:1 over even the lightest
 * speckle (a bare tile leaves cream at ~2.6:1 on its pale grains), but the same
 * wash over the grass would mute exactly the colour the cap is there to show.
 *
 * Sizes are integer multiples of `--mc-unit` (itself `4px * --mc-scale`), so a
 * 16px tile lands on whole pixels at every scale — fractional scaling makes
 * pixel art shimmer. Pair with the `pixelated` utility on the element.
 */
export const GRASS_GROUND_STYLE = {
  backgroundImage: `url("${GRASS_CAP}"), linear-gradient(rgb(0 0 0 / 0.45), rgb(0 0 0 / 0.45)), url("${DIRT_TILE}")`,
  backgroundRepeat: "repeat-x, no-repeat, repeat",
  backgroundPosition: "top left, top left, top left",
  backgroundSize: [
    `calc(var(--mc-unit) * 4) calc(var(--mc-unit) * ${CAP_H / 4})`,
    "auto",
    `calc(var(--mc-unit) * 4) calc(var(--mc-unit) * 4)`,
  ].join(", "),
} as const;
