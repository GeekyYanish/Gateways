export type VoxelPreset = "fine" | "balanced" | "chunky";

export interface VoxelRenderOptions {
  image: ImageBitmap;
  preset: VoxelPreset;
  outputSize?: number;
}

export interface VoxelRenderResult {
  canvas: HTMLCanvasElement;
  blob: Blob;
}

export interface RgbColour {
  r: number;
  g: number;
  b: number;
}

export interface VoxelCell extends RgbColour {
  alpha: number;
  elevation: number;
  x: number;
  y: number;
}

export const VOXEL_PRESET_CELLS: Record<VoxelPreset, number> = {
  fine: 40,
  balanced: 28,
  chunky: 18,
};

const PALETTE_SIZE = 24;
const ALPHA_CUTOFF = 28;

interface ColourBucket {
  colours: RgbColour[];
  channel: keyof RgbColour;
  range: number;
}

/**
 * Deterministic median-cut quantisation for the small sampled grid.
 *
 * The converter deliberately does not depend on an image service or a WASM
 * package: at most 1,600 colours enter this function, so a compact TypeScript
 * implementation is both faster to load and easier to audit.
 */
export function buildAdaptivePalette(
  colours: RgbColour[],
  maximumColours = PALETTE_SIZE,
): RgbColour[] {
  if (colours.length === 0) return [];

  const buckets: ColourBucket[] = [describeBucket(colours)];
  while (buckets.length < maximumColours) {
    let splitIndex = -1;
    let splitScore = -1;

    for (let index = 0; index < buckets.length; index += 1) {
      const bucket = buckets[index];
      if (bucket.colours.length < 2 || bucket.range === 0) continue;
      const score = bucket.range * bucket.colours.length;
      if (score > splitScore) {
        splitIndex = index;
        splitScore = score;
      }
    }

    if (splitIndex === -1) break;
    const [bucket] = buckets.splice(splitIndex, 1);
    const sorted = [...bucket.colours].sort(
      (a, b) => a[bucket.channel] - b[bucket.channel],
    );
    const midpoint = Math.ceil(sorted.length / 2);
    buckets.push(
      describeBucket(sorted.slice(0, midpoint)),
      describeBucket(sorted.slice(midpoint)),
    );
  }

  return buckets.map(({ colours: bucketColours }) => averageColour(bucketColours));
}

export function nearestPaletteColour(
  colour: RgbColour,
  palette: RgbColour[],
): RgbColour {
  if (palette.length === 0) return colour;
  let nearest = palette[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of palette) {
    // Human vision is most sensitive to green, then red, then blue.
    const red = colour.r - candidate.r;
    const green = colour.g - candidate.g;
    const blue = colour.b - candidate.b;
    const distance = red * red * 0.3 + green * green * 0.59 + blue * blue * 0.11;
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/** Back-to-front order for an isometric grid. */
export function getIsometricDrawOrder(gridSize: number): Array<{ x: number; y: number }> {
  const order: Array<{ x: number; y: number }> = [];
  for (let diagonal = 0; diagonal <= (gridSize - 1) * 2; diagonal += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const y = diagonal - x;
      if (y >= 0 && y < gridSize) order.push({ x, y });
    }
  }
  return order;
}

export function calculateVoxelElevation(
  luminanceValue: number,
  localContrast: number,
  saturation: number,
): number {
  const darkness = Math.pow(1 - clamp(luminanceValue, 0, 1), 0.82);
  return clamp(
    0.12 + darkness * 0.7 + localContrast * 1.18 + saturation * 0.08,
    0.12,
    1,
  );
}

/**
 * Convert an image into a transparent, downloadable isometric voxel relief.
 * The source is contained rather than cropped, so arbitrary aspect ratios keep
 * their complete composition.
 */
export async function renderVoxelTwin({
  image,
  preset,
  outputSize = 1024,
}: VoxelRenderOptions): Promise<VoxelRenderResult> {
  const gridSize = VOXEL_PRESET_CELLS[preset];
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = gridSize;
  sampleCanvas.height = gridSize;
  const sampleContext = sampleCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!sampleContext) throw new Error("Canvas processing is not available.");

  const { width: sourceWidth, height: sourceHeight } = image;
  if (!sourceWidth || !sourceHeight) throw new Error("The selected image is empty.");

  sampleContext.clearRect(0, 0, gridSize, gridSize);
  sampleContext.imageSmoothingEnabled = true;
  sampleContext.imageSmoothingQuality = "high";
  const fit = Math.min(gridSize / sourceWidth, gridSize / sourceHeight);
  const drawWidth = Math.max(1, sourceWidth * fit);
  const drawHeight = Math.max(1, sourceHeight * fit);
  sampleContext.drawImage(
    image,
    (gridSize - drawWidth) / 2,
    (gridSize - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  const imageData = sampleContext.getImageData(0, 0, gridSize, gridSize);
  const sourceColours: RgbColour[] = [];
  for (let index = 0; index < imageData.data.length; index += 4) {
    if (imageData.data[index + 3] < ALPHA_CUTOFF) continue;
    sourceColours.push({
      r: imageData.data[index],
      g: imageData.data[index + 1],
      b: imageData.data[index + 2],
    });
  }

  if (sourceColours.length === 0) {
    throw new Error("The selected image has no visible pixels.");
  }

  const palette = buildAdaptivePalette(sourceColours);
  const cells = buildCells(imageData, gridSize, palette);

  const output = document.createElement("canvas");
  output.width = outputSize;
  output.height = outputSize;
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available.");

  context.clearRect(0, 0, outputSize, outputSize);
  context.lineJoin = "miter";
  const tileWidth = Math.max(8, Math.floor((outputSize * 0.82) / gridSize));
  const tileHeight = Math.max(4, Math.floor(tileWidth * 0.5));
  // Depth must be measured against the exported canvas, not the tile size.
  // A tile-relative cap turns the result into a shallow embossed sheet at the
  // denser presets. This gives portraits and objects a genuinely sculptural
  // silhouette while retaining enough room around the model for download.
  const maximumElevation = outputSize * 0.27;
  const gridHeight = tileHeight * gridSize;
  const originX = outputSize / 2;
  const originY = (outputSize - gridHeight - maximumElevation) / 2 + maximumElevation;

  drawGroundShadow(context, {
    gridSize,
    originX,
    originY,
    tileWidth,
    tileHeight,
  });

  for (const { x, y } of getIsometricDrawOrder(gridSize)) {
    const cell = cells[y * gridSize + x];
    if (!cell || cell.alpha < ALPHA_CUTOFF) continue;
    drawVoxel(context, cell, {
      originX,
      originY,
      tileWidth,
      tileHeight,
      maximumElevation,
    });
  }

  const blob = await canvasToBlob(output);
  return { canvas: output, blob };
}

function describeBucket(colours: RgbColour[]): ColourBucket {
  const ranges = {
    r: channelRange(colours, "r"),
    g: channelRange(colours, "g"),
    b: channelRange(colours, "b"),
  };
  const channel = (Object.keys(ranges) as Array<keyof RgbColour>).reduce(
    (largest, current) => (ranges[current] > ranges[largest] ? current : largest),
    "r",
  );
  return { colours, channel, range: ranges[channel] };
}

function channelRange(colours: RgbColour[], channel: keyof RgbColour): number {
  let minimum = 255;
  let maximum = 0;
  for (const colour of colours) {
    minimum = Math.min(minimum, colour[channel]);
    maximum = Math.max(maximum, colour[channel]);
  }
  return maximum - minimum;
}

function averageColour(colours: RgbColour[]): RgbColour {
  const sum = colours.reduce(
    (total, colour) => ({
      r: total.r + colour.r,
      g: total.g + colour.g,
      b: total.b + colour.b,
    }),
    { r: 0, g: 0, b: 0 },
  );
  const count = Math.max(1, colours.length);
  return {
    r: Math.round(sum.r / count),
    g: Math.round(sum.g / count),
    b: Math.round(sum.b / count),
  };
}

function buildCells(
  imageData: ImageData,
  gridSize: number,
  palette: RgbColour[],
): VoxelCell[] {
  const cells: VoxelCell[] = [];
  const luminanceMap = new Float32Array(gridSize * gridSize);

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const pixelIndex = (y * gridSize + x) * 4;
      const colour = nearestPaletteColour(
        {
          r: imageData.data[pixelIndex],
          g: imageData.data[pixelIndex + 1],
          b: imageData.data[pixelIndex + 2],
        },
        palette,
      );
      const alpha = imageData.data[pixelIndex + 3];
      luminanceMap[y * gridSize + x] = luminance(colour);
      cells.push({ ...colour, alpha, elevation: 0, x, y });
    }
  }

  removeNeutralBorderBackground(cells, gridSize);

  for (const cell of cells) {
    if (cell.alpha < ALPHA_CUTOFF) continue;
    const index = cell.y * gridSize + cell.x;
    const value = luminanceMap[index];
    let neighbours = 0;
    let neighbourSum = 0;
    for (const [offsetX, offsetY] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const x = cell.x + offsetX;
      const y = cell.y + offsetY;
      if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
      neighbourSum += luminanceMap[y * gridSize + x];
      neighbours += 1;
    }
    const localContrast = neighbours
      ? Math.abs(value - neighbourSum / neighbours)
      : 0;
    const saturation = colourSaturation(cell);
    // Every visible voxel has a real column, dark/material-rich regions rise
    // decisively, and edges step upward to reveal facial and object contours.
    cell.elevation = calculateVoxelElevation(value, localContrast, saturation);
  }

  return cells;
}

function drawVoxel(
  context: CanvasRenderingContext2D,
  cell: VoxelCell,
  geometry: {
    originX: number;
    originY: number;
    tileWidth: number;
    tileHeight: number;
    maximumElevation: number;
  },
) {
  const { originX, originY, tileWidth, tileHeight, maximumElevation } = geometry;
  const elevation = cell.elevation * maximumElevation;
  const centreX = originX + (cell.x - cell.y) * (tileWidth / 2);
  const topY = originY + (cell.x + cell.y) * (tileHeight / 2) - elevation;
  const halfWidth = tileWidth / 2;
  const halfHeight = tileHeight / 2;
  const top = { x: centreX, y: topY };
  const right = { x: centreX + halfWidth, y: topY + halfHeight };
  const bottom = { x: centreX, y: topY + tileHeight };
  const left = { x: centreX - halfWidth, y: topY + halfHeight };
  const bottomDrop = { x: bottom.x, y: bottom.y + elevation };
  const leftDrop = { x: left.x, y: left.y + elevation };
  const rightDrop = { x: right.x, y: right.y + elevation };

  const base = { r: cell.r, g: cell.g, b: cell.b };
  paintPolygon(context, [left, bottom, bottomDrop, leftDrop], shade(base, -0.18));
  paintPolygon(context, [right, bottom, bottomDrop, rightDrop], shade(base, -0.43));
  paintPolygon(context, [top, right, bottom, left], shade(base, 0.08));
}

function removeNeutralBorderBackground(cells: VoxelCell[], gridSize: number) {
  const border = cells.filter(
    (cell) =>
      cell.alpha >= ALPHA_CUTOFF &&
      (cell.x === 0 ||
        cell.y === 0 ||
        cell.x === gridSize - 1 ||
        cell.y === gridSize - 1),
  );
  if (border.length < gridSize * 2) return;

  const background = averageColour(border);
  const backgroundSaturation = colourSaturation(background);
  const deviation = Math.sqrt(
    border.reduce(
      (sum, colour) =>
        sum +
        (colour.r - background.r) ** 2 +
        (colour.g - background.g) ** 2 +
        (colour.b - background.b) ** 2,
      0,
    ) /
      (border.length * 3),
  );

  // Remove only a low-saturation, consistent studio-style backdrop, whether
  // it is white, grey, or black. Natural scenes and colourful edge-to-edge
  // images keep their full frame because their border variance is much higher.
  if (backgroundSaturation > 0.16 || deviation > 38) {
    return;
  }

  const visited = new Uint8Array(cells.length);
  const queue: number[] = [];
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    if (
      cell.x !== 0 &&
      cell.y !== 0 &&
      cell.x !== gridSize - 1 &&
      cell.y !== gridSize - 1
    ) {
      continue;
    }
    if (isBackdropCell(cell, background)) queue.push(index);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    if (visited[index]) continue;
    visited[index] = 1;
    const cell = cells[index];
    if (!isBackdropCell(cell, background)) continue;
    cell.alpha = 0;

    for (const [offsetX, offsetY] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const x = cell.x + offsetX;
      const y = cell.y + offsetY;
      if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
      const neighbourIndex = y * gridSize + x;
      if (!visited[neighbourIndex]) queue.push(neighbourIndex);
    }
  }
}

function isBackdropCell(cell: VoxelCell, background: RgbColour): boolean {
  if (cell.alpha < ALPHA_CUTOFF) return false;
  const distance = Math.sqrt(
    (cell.r - background.r) ** 2 +
      (cell.g - background.g) ** 2 +
      (cell.b - background.b) ** 2,
  );
  return distance < 76 && Math.abs(luminance(cell) - luminance(background)) < 0.24;
}

function drawGroundShadow(
  context: CanvasRenderingContext2D,
  geometry: {
    gridSize: number;
    originX: number;
    originY: number;
    tileWidth: number;
    tileHeight: number;
  },
) {
  const { gridSize, originX, originY, tileWidth, tileHeight } = geometry;
  const halfGridWidth = (gridSize * tileWidth) / 2;
  const gridDepth = gridSize * tileHeight;
  const offset = tileHeight * 1.4;
  context.save();
  context.filter = `blur(${Math.max(6, tileHeight * 0.7)}px)`;
  paintPolygon(
    context,
    [
      { x: originX, y: originY + offset },
      { x: originX + halfGridWidth, y: originY + gridDepth / 2 + offset },
      { x: originX, y: originY + gridDepth + offset },
      { x: originX - halfGridWidth, y: originY + gridDepth / 2 + offset },
    ],
    "rgba(0, 0, 0, 0.28)",
  );
  context.restore();
}

function paintPolygon(
  context: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  fill: string,
) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = "rgba(13, 8, 18, 0.32)";
  context.lineWidth = 1.25;
  context.stroke();
}

function shade(colour: RgbColour, amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  const strength = Math.abs(amount);
  const channel = (value: number) => Math.round(value + (target - value) * strength);
  return `rgb(${channel(colour.r)}, ${channel(colour.g)}, ${channel(colour.b)})`;
}

function luminance(colour: RgbColour): number {
  return (colour.r * 0.2126 + colour.g * 0.7152 + colour.b * 0.0722) / 255;
}

function colourSaturation(colour: RgbColour): number {
  const maximum = Math.max(colour.r, colour.g, colour.b);
  const minimum = Math.min(colour.r, colour.g, colour.b);
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The voxel image could not be exported."));
    }, "image/png");
  });
}
