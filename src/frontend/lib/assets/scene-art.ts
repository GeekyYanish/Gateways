import { seededRandom, shade, svgDataUri } from "./placeholder";

/**
 * GENERATED SCENE ART.
 *
 * `placeholder.ts` draws *stand-ins* — labelled silhouettes that say "art
 * pending". This module draws the real thing: finished, deliberate pixel art
 * emitted as SVG, for scenes whose look is specified but whose PNGs do not
 * exist. The landing page's daylight valley is the first user.
 *
 * Why generate rather than ship files:
 *   - it is authored in the same palette tokens as the rest of the UI, so a
 *     colour change is a one-line edit rather than a re-export
 *   - every layer is separately addressable, which is what makes parallax work
 *   - zero network requests, and it renders before /public/art exists
 *
 * It is still only a stage. Every painted layer keeps its manifest `src`, so
 * dropping a real PNG at that path silently replaces the generated version
 * with no code change (see ParallaxLayer).
 *
 * RULES for anything added here:
 *   - **Whole blocks only.** Every edge lands on a multiple of the block size.
 *     A smooth curve or a soft gradient instantly breaks the voxel read.
 *   - **Deterministic.** Seed from the layer key via `seededRandom`. Art that
 *     reshuffles between renders looks like a bug, and it would also desync
 *     between the server and client render.
 *   - **Original.** Generic blocky landforms only — no game's textures, block
 *     names, or terminology.
 */

// ---------------------------------------------------------------------------
// Palette — mirrors the --color-mc-* tokens in globals.css.
// SVG cannot read CSS custom properties from a data URI (it has no access to
// the host document's cascade), so the values are duplicated here. Keep the
// two in sync; these are the sampled colours from the landing mockup.
// ---------------------------------------------------------------------------

const C = {
  skyHigh: "#1b4a86",
  skyMid: "#2064b4",
  skyLow: "#5787bf",

  cloudTop: "#f2f7fd",
  cloudBody: "#dfeaf6",
  cloudUnder: "#cfe0ef",

  stone: "#3c4a52",
  stoneLight: "#4e5f68",
  stoneDark: "#26323a",
  stoneDeep: "#1a242b",

  moss: "#4a7024",
  mossLight: "#63903a",
  mossDark: "#2f4a15",

  grass: "#33501a",
  grassLight: "#4a6b22",
  grassDark: "#1c2e0d",

  path: "#6f675c",
  pathLight: "#877e70",
  pathDark: "#544e46",

  portal: "#a02ce0",
  portalPale: "#e8dcfb",

  // Open-daylight greens for the panorama. The `grass*` set above is the
  // valley floor sitting in cliff shadow and is far too dark for a sunlit
  // meadow; these mirror the --color-mc-grass token scale instead.
  meadow: "#5fa73f",
  meadowLight: "#7ec850",
  meadowDark: "#3d6b28",

  trunk: "#6d5732",
  trunkLight: "#8a6f43",
  leaf: "#3f8f2f",
  leafLight: "#5cb03f",
  leafDark: "#2b6620",
} as const;

/** Linear blend between two hex colours. Used for banded sky ramps. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => {
    const va = (pa >> sh) & 255;
    const vb = (pb >> sh) & 255;
    return Math.round(va + (vb - va) * t);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const rect = (x: number, y: number, w: number, h: number, fill: string, op = 1) =>
  `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${fill}"${op < 1 ? ` fill-opacity="${op}"` : ""}/>`;

/**
 * One cube face: flat fill, a lit strip along the top, a shadowed strip along
 * the bottom. Those two strips are the entire trick — they are what makes a
 * grid of squares read as stacked blocks rather than as a checkerboard.
 */
function block(x: number, y: number, s: number, fill: string, lit: string, dark: string): string {
  const edge = Math.max(1, Math.round(s / 6));
  return (
    rect(x, y, s, s, fill) +
    rect(x, y, s, edge, lit) +
    rect(x, y + s - edge, s, edge, dark)
  );
}

/**
 * Paint a grid of blocks, colouring each cell from a callback, and merge
 * horizontal runs of the same colour into one rect.
 *
 * This exists because **`image-rendering: pixelated` does nothing to an SVG
 * background** — the browser rasterises vector art at final display size, so
 * an `<ellipse>` comes out smooth however small the viewBox is. The only way
 * to get genuinely stepped edges is to quantise the geometry here.
 *
 * Run-merging is what keeps that affordable: concentric bands are mostly long
 * stretches of one colour per row, so it cuts a 600-rect field to well under a
 * hundred, and these strings are inlined into the document as data URIs.
 */
function blockField(
  w: number,
  h: number,
  cell: number,
  colourAt: (cx: number, cy: number) => string | null,
): string {
  let body = "";
  for (let y = 0; y < h; y += cell) {
    let runStart = 0;
    let runFill: string | null = null;
    const flush = (endX: number) => {
      if (runFill && endX > runStart) body += rect(runStart, y, endX - runStart, cell, runFill);
    };
    for (let x = 0; x < w; x += cell) {
      const fill = colourAt(x + cell / 2, y + cell / 2);
      if (fill !== runFill) {
        flush(x);
        runStart = x;
        runFill = fill;
      }
    }
    flush(w);
  }
  return body;
}

const svg = (w: number, h: number, par: string, body: string) =>
  svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${par}" shape-rendering="crispEdges">${body}</svg>`,
  );

// ---------------------------------------------------------------------------
// Painters
// ---------------------------------------------------------------------------

/**
 * Afternoon sky, ramped in discrete horizontal bands.
 *
 * A real `<linearGradient>` would be smoother and wrong: banding is the point.
 * Sixteen steps is the sweet spot — fewer reads as a bug, more reads as a
 * gradient.
 */
function skyDay(w: number, h: number): string {
  const bands = 16;
  let body = rect(0, 0, w, h, C.skyLow);
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    // Two-stop ramp: deep zenith to mid, then mid to a pale horizon.
    const col = t < 0.55 ? mix(C.skyHigh, C.skyMid, t / 0.55) : mix(C.skyMid, C.skyLow, (t - 0.55) / 0.45);
    body += rect(0, (i * h) / bands, w, h / bands + 1, col);
  }
  return svg(w, h, "none", body);
}

/**
 * Tileable cloud strip.
 *
 * Seamlessness is a hard constraint — this layer is `repeat-x` and drifts
 * horizontally forever, so a puff crossing either edge would show a seam
 * sliding across the sky every cycle. Puffs are therefore inset from both
 * edges by a full cluster width rather than wrapped.
 */
function cloudsBlocky(w: number, h: number, key: string): string {
  const rnd = seededRandom(key);
  const s = 24; // block size
  let body = "";

  const puff = (cx: number, cy: number, wide: number, tall: number) => {
    // Rows narrow toward the top, so the cluster silhouettes as a cumulus
    // rather than a rectangle.
    for (let row = 0; row < tall; row++) {
      const shrink = Math.round(row * (wide / (tall * 1.6)) + (rnd() < 0.4 ? 1 : 0));
      const cols = Math.max(1, wide - shrink * 2);
      const x0 = cx - (cols * s) / 2;
      const y = cy - row * s;
      for (let c = 0; c < cols; c++) {
        const top = row === tall - 1;
        const bottom = row === 0;
        body += rect(
          x0 + c * s,
          y,
          s,
          s,
          top ? C.cloudTop : bottom ? C.cloudUnder : C.cloudBody,
        );
      }
    }
  };

  // Inset from both edges by more than the widest cluster keeps the tile seam
  // clean. Clouds live in the upper 45% only; below that is the valley.
  const margin = s * 10;
  const count = 7;
  for (let i = 0; i < count; i++) {
    const cx = margin + ((w - margin * 2) * (i + 0.5)) / count + (rnd() - 0.5) * s * 4;
    const cy = h * 0.1 + rnd() * h * 0.3;
    puff(Math.round(cx / s) * s, Math.round(cy / s) * s, 5 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3));
  }

  return svg(w, h, "none", body);
}

/**
 * Distant rock spires on the far side of the valley.
 *
 * Deliberately low contrast and lifted toward the sky colour — this sits
 * behind the portal and must never compete with it. Full-bleed, so `cover`
 * cropping on any aspect is harmless.
 */
function ridgeFar(w: number, h: number, key: string): string {
  const rnd = seededRandom(key);
  const s = 24;
  const cols = Math.ceil(w / s);
  const baseY = h * 0.62;
  // Atmospheric perspective done properly: haze the rock toward the SKY, not
  // toward white. `shade(_, +n)` lifts to grey-lavender, which against a blue
  // sky reads as a pale monolith standing in front of it rather than as stone
  // receding into it.
  const faceA = mix(C.stone, C.skyLow, 0.62);
  const faceB = mix(C.stone, C.skyLow, 0.54);
  const capA = mix(C.moss, C.skyLow, 0.5);

  // Overlapping SPIRES, not a per-column height field.
  //
  // Any height-per-column approach — random walk or summed sines — quantises
  // into flat-topped towers of independent height, which is a city skyline.
  // The fix is to give the silhouette a generating shape: each spire is a
  // triangle, the ridge line is the union of them, and a peak therefore has
  // two sloping shoulders that actually belong to it.
  const peaks = Array.from({ length: 18 }, (_, i) => ({
    cx: ((i + 0.5) / 18) * w + (rnd() - 0.5) * (w / 18),
    top: baseY - h * (0.04 + rnd() * 0.17),
    slope: 0.9 + rnd() * 1.9,
  }));

  let body = "";
  for (let c = 0; c < cols; c++) {
    const x = c * s + s / 2;
    let top = baseY + h * 0.06;
    for (const p of peaks) {
      top = Math.min(top, p.top + Math.abs(x - p.cx) * p.slope);
    }
    const y = Math.round(Math.min(h * 0.78, top) / s) * s;
    body += rect(c * s, y, s, h - y, c % 3 ? faceA : faceB);
    // Light along the crest, and a hint of green where growth catches.
    body += rect(c * s, y, s, Math.max(2, s / 4), mix(C.stone, C.skyLow, 0.78), 0.7);
    body += rect(c * s, y, s, s * 0.7, capA, 0.4);
  }
  return svg(w, h, "none", body);
}

/**
 * A mossy cliff wall that frames one side of the composition.
 *
 * Rendered as its own edge-anchored layer rather than as part of a full-bleed
 * background, because a `cover`-fitted wide image crops from the *sides* — on
 * a portrait phone the two cliffs would be the first thing cropped away, which
 * is precisely the framing the mockup depends on. Anchoring each wall to its
 * own viewport edge keeps them present at every aspect ratio.
 *
 * `preserveAspectRatio="...YMax slice"` (not `none`) so the blocks stay square
 * and the wall crops inward on narrow screens instead of stretching into
 * slivers.
 */
function cliffWall(side: "left" | "right", w: number, h: number, key: string): string {
  const rnd = seededRandom(key);
  const s = 40;
  const rows = Math.ceil(h / s);
  const maxCols = Math.ceil(w / s);

  let body = "";
  // How far the rock reaches inward, per row. Wider at the bottom: the wall
  // is nearer the camera down there, and it hands off to the valley floor.
  //
  // The profile holds a value for a run of rows before jumping, rather than
  // being redrawn every row. That is what produces LEDGES — sheer faces with
  // shelves between them. Per-row noise instead gives a fuzzy diagonal edge
  // that reads as a pile of rubble.
  const reach: number[] = [];
  let held = 3;
  let hold = 0;
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    // Already substantial at the top, not a thin wedge. The widest part of the
    // wall is its base, and the base is behind the valley floor — so a profile
    // that only broadens near the bottom leaves nothing visible at all.
    const target = 3.5 + (maxCols - 4) * Math.pow(t, 0.85);
    if (hold-- <= 0) {
      hold = 1 + Math.floor(rnd() * 4);
      held = Math.round(target + (rnd() - 0.35) * 2.5);
    }
    reach.push(Math.max(1, Math.min(maxCols, Math.max(held, Math.round(target * 0.6)))));
  }

  // Column -> index of its topmost rock row, so ledges can be moss-capped.
  const firstRow = new Array<number>(maxCols).fill(-1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < reach[r]; c++) if (firstRow[c] < 0) firstRow[c] = r;
  }

  // Vertical fissures: a couple of columns run dark top to bottom, which is
  // what stops the wall reading as a tiled floor stood on its end.
  const fissures = new Set([1 + Math.floor(rnd() * 3), 4 + Math.floor(rnd() * 4)]);

  for (let r = 0; r < rows; r++) {
    const y = r * s;
    for (let c = 0; c < reach[r]; c++) {
      const x = c * s;
      // A newly exposed ledge, either because the wall starts here or because
      // this row juts further in than the one above.
      const exposed = firstRow[c] === r || (r > 0 && c >= reach[r - 1]);
      // Moss colonises ledges and the damp lower wall; bare rock stays up high.
      const mossy = exposed || rnd() < 0.08 + 0.34 * Math.pow(r / rows, 1.6);
      const inner = c === reach[r] - 1;

      if (mossy) {
        const f = rnd() < 0.35 ? C.mossDark : C.moss;
        body += block(x, y, s, f, C.mossLight, C.mossDark);
      } else {
        // Three-way variance so neighbouring blocks in a row differ — with a
        // single fill the per-block lit/dark strips merge into one continuous
        // stripe across the wall.
        const roll = rnd();
        const f = roll < 0.22 ? C.stoneDeep : roll < 0.55 ? C.stoneDark : C.stone;
        body += block(x, y, s, f, C.stoneLight, C.stoneDeep);
      }
      if (fissures.has(c)) body += rect(x, y, s, s, "#000000", 0.3);
      // The inward-facing column catches less light — this is what gives the
      // wall its turn away from the viewer.
      if (inner) body += rect(x, y, s, s, "#000000", 0.3);
    }
    // Ambient occlusion down the inner edge, deepening toward the valley floor.
    body += rect(reach[r] * s - s * 0.35, y, s * 0.35, s, "#0b1418", 0.35);
  }

  // Mirror for the right wall. Generated from its own seed first, so the two
  // walls are not each other's reflection.
  const wrapped =
    side === "right" ? `<g transform="translate(${w},0) scale(-1,1)">${body}</g>` : body;

  return svg(w, h, side === "left" ? "xMinYMax slice" : "xMaxYMax slice", wrapped);
}

/**
 * The valley floor. Three depth bands rather than one flat fill — a single
 * green would read as a wall, not as ground receding away from the camera.
 */
function grassFore(w: number, h: number, key: string): string {
  const rnd = seededRandom(key);
  const s = 32;
  const cols = Math.ceil(w / s);
  // Low horizon: the cliffs are the framing element, and every percent the
  // grass climbs is a percent of cliff it buries.
  const horizon = h * 0.66;

  let body = "";
  // Stepped horizon line.
  const tops: number[] = [];
  let t = horizon;
  for (let c = 0; c <= cols; c++) {
    t += (rnd() < 0.5 ? -1 : 1) * s * 0.6 + (horizon - t) * 0.18;
    tops.push(Math.round(Math.max(horizon - s * 2.5, Math.min(horizon + s, t)) / s) * s);
  }

  for (let c = 0; c < cols; c++) {
    const y = tops[c];
    // Far band is hazier and lighter; near band saturates and darkens.
    body += rect(c * s, y, s, h - y, C.grass);
    body += rect(c * s, y, s, s, rnd() < 0.3 ? C.moss : C.grassLight);
    body += rect(c * s, y, s, Math.max(2, s / 6), shade(C.grassLight, 0.25));
  }

  // Near-ground darkening, banded so it stays blocky. The valley floor is in
  // the cliffs' shadow, and without this it reads as a flat green wall.
  const bands = 7;
  for (let i = 0; i < bands; i++) {
    const y = horizon + ((h - horizon) * i) / bands;
    body += rect(0, y, w, (h - horizon) / bands + 1, C.grassDark, (i / bands) * 0.75);
  }
  // Shadow pooling under each cliff wall, so the floor meets them instead of
  // butting against them.
  for (const side of [0, 1]) {
    for (let i = 0; i < 9; i++) {
      const bw = w * (0.2 - i * 0.018);
      body += rect(side ? w - bw : 0, horizon - s, bw, h, C.grassDark, 0.16);
    }
  }

  // Scattered tufts for texture.
  for (let i = 0; i < 90; i++) {
    const x = Math.round((rnd() * w) / s) * s;
    const y = Math.round((horizon + rnd() * (h - horizon)) / s) * s;
    body += rect(x, y, s, s / 2, rnd() < 0.5 ? C.grassDark : C.mossLight, 0.5);
  }

  return svg(w, h, "none", body);
}

/**
 * Stone path running from the bottom edge up to the portal's base.
 *
 * Drawn as a trapezoid of brick rows that narrow with distance. This is the
 * only element carrying linear perspective, and it is what makes the flat
 * grass plane read as ground you could walk along.
 */
function pathStones(w: number, h: number, key: string): string {
  const rnd = seededRandom(key);
  const rows = 22;
  const topY = h * 0.6;
  const topW = w * 0.06;
  const botW = w * 0.28;
  const cx = w / 2;

  let body = "";
  for (let r = 0; r < rows; r++) {
    const t = r / rows;
    const t2 = (r + 1) / rows;
    const y = topY + (h - topY) * t;
    const rowH = Math.max(3, topY + (h - topY) * t2 - y);
    const halfW = (topW + (botW - topW) * Math.pow(t, 1.35)) / 2;

    // Brick count stays roughly constant; bricks simply grow as they approach.
    const bricks = 5 + Math.floor(t * 3);
    const bw = (halfW * 2) / bricks;
    // Alternate rows are offset half a brick, like real coursing.
    const offset = r % 2 ? bw / 2 : 0;
    // Mortar scales with the brick, so the gaps stay visible once the layer is
    // blown up to viewport size instead of collapsing to a hairline.
    const gapX = Math.max(2, bw * 0.09);
    const gapY = Math.max(2, rowH * 0.16);

    for (let b = -1; b <= bricks; b++) {
      const x = cx - halfW + b * bw + offset;
      const x0 = Math.max(cx - halfW, x);
      const x1 = Math.min(cx + halfW, x + bw - gapX);
      if (x1 - x0 < 2) continue;
      const roll = rnd();
      const f = roll < 0.22 ? C.pathDark : roll < 0.4 ? shade(C.path, -0.12) : C.path;
      body += rect(x0, y, x1 - x0, rowH - gapY, f);
      // A light edge on every row turns the path into a flight of stairs. Only
      // some bricks catch it, and softly, so it reads as an uneven surface.
      if (roll > 0.35) {
        body += rect(x0, y, x1 - x0, Math.max(1, rowH / 7), C.pathLight, 0.55);
      }
    }
  }
  // Ground the path in the grass rather than letting it sit on top as a decal.
  for (let i = 0; i < 60; i++) {
    const t = rnd();
    const y = topY + (h - topY) * t;
    const halfW = (topW + (botW - topW) * Math.pow(t, 1.35)) / 2;
    const s = 6 + rnd() * 14;
    const x = cx + (rnd() < 0.5 ? -1 : 1) * (halfW - s * 0.4);
    body += rect(x, y, s, s * 0.7, rnd() < 0.5 ? C.mossDark : C.moss, 0.65);
  }
  return svg(w, h, "none", body);
}

/** Night sky over the threshold: deep blue, banded, with a scatter of stars. */
function skyNight(w: number, h: number, key: string): string {
  const rnd = seededRandom(key);
  const bands = 14;
  let body = "";
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const col = t < 0.6 ? mix("#070b1c", "#0c1126", t / 0.6) : mix("#0c1126", "#161f45", (t - 0.6) / 0.4);
    body += rect(0, (i * h) / bands, w, h / bands + 1, col);
  }
  for (let i = 0; i < 120; i++) {
    const s = rnd() < 0.8 ? 2 : 4;
    body += rect(rnd() * w, rnd() * h * 0.72, s, s, "#c8d4f0", 0.25 + rnd() * 0.6);
  }
  return svg(w, h, "none", body);
}

/**
 * Darkens the terrain to night while leaving the middle lit.
 *
 * The valley painters are authored for daylight and are reused verbatim here —
 * repainting every one of them in a night palette would double the surface
 * area for no gain. A veil with a hole punched where the portal stands gets
 * the same result and keeps one source of truth per landform.
 */
function nightVeil(w: number, h: number): string {
  const body =
    `<defs><radialGradient id="v" cx="50%" cy="44%" r="58%">` +
    `<stop offset="0%" stop-color="#0a0618" stop-opacity="0.12"/>` +
    `<stop offset="45%" stop-color="#070a1a" stop-opacity="0.6"/>` +
    `<stop offset="100%" stop-color="#03050e" stop-opacity="0.94"/>` +
    `</radialGradient></defs>` +
    rect(0, 0, w, h, "url(#v)");
  return svg(w, h, "none", body);
}

/** Violet embers drifting through the air. Tileable, transparent. */
function airMotes(w: number, h: number, key: string): string {
  const rnd = seededRandom(key);
  let body = "";
  // Inset from both edges so the tile seam never cuts a mote in half.
  const margin = 40;
  for (let i = 0; i < 90; i++) {
    const s = 2 + Math.round(rnd() * 2) * 3;
    const x = margin + rnd() * (w - margin * 2);
    const y = rnd() * h;
    const bright = rnd();
    body += rect(x, y, s, s, bright < 0.25 ? C.portalPale : bright < 0.7 ? "#c461e2" : "#8b3dd8", 0.3 + rnd() * 0.55);
  }
  return svg(w, h, "none", body);
}

/**
 * Violet light spilling out of the aperture onto the valley. Screen-blended
 * overlay; the only intentionally soft element in the scene, because light
 * bloom is the one thing that does not read as blocky.
 */
function portalSpill(w: number, h: number): string {
  const body = `
    <defs>
      <radialGradient id="s" cx="50%" cy="46%" r="46%">
        <stop offset="0%" stop-color="${C.portalPale}" stop-opacity="0.55"/>
        <stop offset="42%" stop-color="${C.portal}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${C.portal}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#s)"/>`;
  return svg(w, h, "none", body);
}

// ---------------------------------------------------------------------------
// The aperture
// ---------------------------------------------------------------------------

/** Outer (dim, cool) to inner (hot, pale). Shared by the rings and the tunnel. */
export const VORTEX_RAMP = [
  "#2c0d5e",
  "#3a1279",
  "#4a1a9e",
  "#5a20b8",
  "#6225c8",
  "#7b37d5",
  "#8b3dd8",
  "#9440da",
  "#a84adc",
  "#b857df",
  "#c461e2",
  "#d47ae8",
  "#df94ec",
  "#e9b0f2",
  "#f3ddfb",
  "#ffffff",
];

/**
 * The portal's inner vortex: concentric rings collapsing into a white core.
 *
 * Drawn at the APERTURE's aspect ratio and stretched to fill it exactly, so
 * the rings hug the opening and clip against its sides the way the reference
 * does. An earlier version used a square canvas of rotated diamonds, spun by
 * GSAP — that fails twice over: the aperture is a narrow portrait window onto
 * the middle of the square, so only two or three rings ever fall inside it,
 * and their straight edges cut across the opening as diagonal streaks rather
 * than reading as a vortex at all.
 *
 * Ellipses with `shape-rendering="crispEdges"` are the whole trick: no
 * antialiasing means each ring stair-steps, which is exactly the blocky
 * concentric look, for free.
 *
 * Motion lives in `portalMotes` instead — motes have no silhouette to distort,
 * so they can be spun freely.
 */
export function portalRings(key = "portal-rings"): string {
  const rnd = seededRandom(key);
  // Deliberately tiny. The aperture is ~150×300 CSS px, so a 256-wide source
  // renders about 1:1 and any stair-stepping lands on single pixels. The
  // geometry itself is quantised by `blockField` below, so this only has to be
  // a comfortable multiple of the cell size.
  const w = 80;
  const h = 144;
  const cx = w / 2;
  const cy = h / 2;

  // Alternating light/dark BANDS, not a monotonic fade. A ramp that only
  // brightens toward the middle washes out to white and loses the concentric
  // structure; oscillating the brightness as it travels inward is what makes
  // discrete rings.
  const bands = 3.2;
  const cell = 4;

  let body = blockField(w, h, cell, (x, y) => {
    const dx = (x - cx) / (w / 2);
    const dy = (y - cy) / (h / 2);
    // Iso-contours of this distance are ellipses matching the aperture's own
    // aspect, so the rings hug the opening instead of leaving dead corners.
    const t = 1 - Math.min(1, Math.hypot(dx, dy));
    const osc = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * bands);
    const v = 0.2 + 0.55 * Math.pow(t, 1.7) + 0.32 * osc;
    // Quantising the ramp index as well as the geometry keeps neighbouring
    // rows on the same colour, which is what lets the run-merge collapse them.
    return rampAt(Math.round(v * 24) / 24);
  });

  // Scattered bright pixels in the field, as in the reference. Small and
  // sparse — these are glints in the energy, not confetti.
  for (let i = 0; i < 55; i++) {
    const s = rnd() < 0.75 ? 2 : 4;
    body += rect(
      Math.round((rnd() * w) / 2) * 2,
      Math.round((rnd() * h) / 2) * 2,
      s,
      s,
      rnd() < 0.4 ? "#ffffff" : C.portalPale,
      0.35 + rnd() * 0.5,
    );
  }

  // No soft core bloom and no edge vignette. The block field already peaks at
  // white in the middle, and laying a smooth radial over it puts the one
  // gradient in the image exactly where the eye lands. The reference likewise
  // stays bright violet right out to the frame — darkening the rim reads as
  // the portal being switched off rather than as depth.
  return svg(w, h, "none", body);
}

/** Sample `VORTEX_RAMP` at a continuous 0–1 position, blending between stops. */
function rampAt(v: number): string {
  const x = Math.max(0, Math.min(1, v)) * (VORTEX_RAMP.length - 1);
  const i = Math.floor(x);
  return mix(VORTEX_RAMP[i], VORTEX_RAMP[Math.min(i + 1, VORTEX_RAMP.length - 1)], x - i);
}

/**
 * Bright motes suspended in the aperture, on transparent.
 *
 * A separate square layer from the rings precisely so it CAN be rotated: a
 * scatter of squares has no silhouette to shear, so spinning it adds life
 * without touching the ring geometry underneath.
 */
export function portalMotes(key = "portal-motes"): string {
  const rnd = seededRandom(key);
  const size = 256;
  const c = size / 2;

  let body = "";
  // Generous count: the aperture is a portrait slot over the middle of this
  // square, so under half of them are ever on screen at once. Kept small and
  // faint — the rings underneath are the subject, and chunky opaque squares
  // over them read as dirt on the screen.
  for (let i = 0; i < 190; i++) {
    const a = rnd() * Math.PI * 2;
    // sqrt-ish falloff spreads them evenly by AREA; a linear radius would
    // clump every mote around the centre.
    const d = Math.pow(rnd(), 0.55) * c * 0.95;
    const s = rnd() < 0.7 ? 2 : 3;
    body += rect(
      c + Math.cos(a) * d - s / 2,
      c + Math.sin(a) * d - s / 2,
      s,
      s,
      rnd() < 0.45 ? "#ffffff" : C.portalPale,
      0.2 + rnd() * 0.4,
    );
  }
  return svg(size, size, "none", body);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Resolve a layer's `paint` name to a data URI.
 *
 * Takes primitives rather than a `SceneLayer` so this module never has to
 * import `scenes.ts` — scenes reference painters by name, painters know
 * nothing about scenes, and there is no cycle between them.
 *
 * Returns `null` for an unknown name so the caller can fall back to the
 * generic placeholder rather than rendering an empty layer.
 */
// ---------------------------------------------------------------------------
// Panorama painters — the slowly-panning homepage backdrop.
//
// Every layer here is TILEABLE and drifts forever, so seamlessness is not a
// nicety: a discontinuity at the tile edge becomes a vertical seam sliding
// across the hero every few seconds, which is the most visible bug a
// background can have.
// ---------------------------------------------------------------------------

/**
 * A horizontal height field that is guaranteed to close on itself.
 *
 * Each component completes an INTEGER number of cycles across the tile width,
 * so f(x + w) === f(x) exactly. That identity is the entire reason these layers
 * can repeat and pan indefinitely. A random walk, value noise, or summed sines
 * at arbitrary frequencies would all produce a silhouette whose two ends do not
 * meet, and the seam would be obvious the moment the layer moved.
 */
function periodicHeight(
  w: number,
  key: string,
  parts: Array<{ cycles: number; amp: number }>,
): (x: number) => number {
  const rnd = seededRandom(key);
  const phases = parts.map(() => rnd() * Math.PI * 2);
  return (x: number) => {
    let v = 0;
    for (let i = 0; i < parts.length; i++) {
      v += parts[i].amp * Math.sin((2 * Math.PI * parts[i].cycles * x) / w + phases[i]);
    }
    return v;
  };
}

/**
 * Far rolling hills. Hazed heavily toward the sky so they read as distance
 * rather than as a green wall behind the wordmark.
 */
function hillsTile(w: number, h: number, key: string): string {
  const s = 20;
  const baseY = h * 0.52;
  const field = periodicHeight(w, key, [
    { cycles: 1, amp: h * 0.1 },
    { cycles: 2, amp: h * 0.05 },
    { cycles: 5, amp: h * 0.02 },
  ]);

  const face = mix(C.meadow, C.skyLow, 0.6);
  const crest = mix(C.meadowLight, C.skyLow, 0.52);

  let body = "";
  for (let x = 0; x < w; x += s) {
    const y = Math.round((baseY + field(x + s / 2)) / s) * s;
    body += rect(x, y, s, h - y, face);
    body += rect(x, y, s, s, crest);
  }
  return svg(w, h, "none", body);
}

/**
 * Mid-distance treeline on a grass shelf.
 *
 * The ground line is periodic; the trees are inset from both edges by more than
 * the widest canopy, so no tree is ever cut in half by the tile boundary. That
 * is the same trick `cloudsBlocky` uses, and for the same reason.
 */
function treelineTile(w: number, h: number, key: string): string {
  const rnd = seededRandom(key);
  const s = 16;
  const groundY = h * 0.6;
  const field = periodicHeight(w, `${key}-ground`, [
    { cycles: 2, amp: h * 0.035 },
    { cycles: 4, amp: h * 0.016 },
  ]);

  const soil = mix(C.meadow, C.skyLow, 0.3);
  const soilTop = mix(C.meadowLight, C.skyLow, 0.24);
  const leaf = mix(C.leaf, C.skyLow, 0.22);
  const leafLit = mix(C.leafLight, C.skyLow, 0.16);
  const leafDark = mix(C.leafDark, C.skyLow, 0.28);

  const groundAt = (x: number) => Math.round((groundY + field(x)) / s) * s;

  let body = "";
  for (let x = 0; x < w; x += s) {
    const y = groundAt(x + s / 2);
    body += rect(x, y, s, h - y, soil);
    body += rect(x, y, s, s / 2, soilTop);
  }

  const margin = s * 9;
  const count = 10;
  for (let i = 0; i < count; i++) {
    const cx =
      Math.round(
        (margin + ((w - margin * 2) * (i + 0.5)) / count + (rnd() - 0.5) * s * 5) / s,
      ) * s;
    const base = groundAt(cx);
    const trunkH = s * (2 + Math.floor(rnd() * 3));
    const rows = 3 + Math.floor(rnd() * 2);
    const halfW = 2 + Math.floor(rnd() * 2);

    body += rect(cx, base - trunkH, s, trunkH, C.trunk);
    body += rect(cx, base - trunkH, s / 2, trunkH, C.trunkLight);

    // Canopy: widest at the bottom, narrowing upward, so it silhouettes as a
    // crown instead of a box.
    for (let r = 0; r < rows; r++) {
      const shrink = Math.floor((r * halfW) / rows);
      const half = Math.max(1, halfW - shrink);
      const y = base - trunkH - (r + 1) * s;
      for (let c = -half; c <= half; c++) {
        const top = r === rows - 1;
        body += rect(cx + c * s, y, s, s, top ? leafLit : c < 0 ? leaf : leafDark);
      }
    }
  }

  return svg(w, h, "none", body);
}

/**
 * Foreground meadow. Saturated and unhazed — it is the nearest thing in frame,
 * and the depth cue only works if the near band is the most vivid.
 */
function meadowTile(w: number, h: number, key: string): string {
  const rnd = seededRandom(key);
  const s = 24;
  const topY = h * 0.66;
  const field = periodicHeight(w, `${key}-edge`, [
    { cycles: 3, amp: h * 0.03 },
    { cycles: 7, amp: h * 0.012 },
  ]);

  let body = "";
  for (let x = 0; x < w; x += s) {
    const y = Math.round((topY + field(x + s / 2)) / s) * s;
    body += rect(x, y, s, h - y, C.meadow);
    body += rect(x, y, s, s, C.meadowLight);
    body += rect(x, y, s, Math.max(2, s / 6), shade(C.meadowLight, 0.22));
  }

  // Depth banding toward the bottom edge, kept blocky.
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const y = topY + ((h - topY) * i) / bands;
    body += rect(0, y, w, (h - topY) / bands + 1, C.meadowDark, (i / bands) * 0.5);
  }

  // Tufts and flowers, inset so nothing is clipped at the seam.
  const margin = s * 2;
  for (let i = 0; i < 70; i++) {
    const x = Math.round((margin + rnd() * (w - margin * 2)) / s) * s;
    const y = Math.round((topY + rnd() * (h - topY)) / s) * s;
    const flower = rnd() < 0.12;
    body += rect(
      x,
      y,
      s,
      flower ? s / 3 : s / 2,
      flower ? (rnd() < 0.5 ? "#f2b233" : "#e8dcfb") : C.meadowDark,
      flower ? 0.9 : 0.45,
    );
  }

  return svg(w, h, "none", body);
}

const paintCache = new Map<string, string | null>();

export function paintSceneLayer(
  paint: string,
  w: number,
  h: number,
  key: string,
): string | null {
  const cacheKey = `${paint}:${w}:${h}:${key}`;
  if (paintCache.has(cacheKey)) {
    return paintCache.get(cacheKey) ?? null;
  }

  let result: string | null = null;
  switch (paint) {
    case "sky-day":
      result = skyDay(w, h);
      break;
    case "sky-night":
      result = skyNight(w, h, key);
      break;
    case "night-veil":
      result = nightVeil(w, h);
      break;
    case "air-motes":
      result = airMotes(w, h, key);
      break;
    case "clouds-blocky":
      result = cloudsBlocky(w, h, key);
      break;
    case "ridge-far":
      result = ridgeFar(w, h, key);
      break;
    case "cliff-left":
      result = cliffWall("left", w, h, key);
      break;
    case "cliff-right":
      result = cliffWall("right", w, h, key);
      break;
    case "grass-fore":
      result = grassFore(w, h, key);
      break;
    case "path-stones":
      result = pathStones(w, h, key);
      break;
    case "portal-spill":
      result = portalSpill(w, h);
      break;
    case "hills-tile":
      result = hillsTile(w, h, key);
      break;
    case "treeline-tile":
      result = treelineTile(w, h, key);
      break;
    case "meadow-tile":
      result = meadowTile(w, h, key);
      break;
    default:
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[scene-art] unknown painter "${paint}" for layer "${key}"`);
      }
      result = null;
      break;
  }

  paintCache.set(cacheKey, result);
  return result;
}
