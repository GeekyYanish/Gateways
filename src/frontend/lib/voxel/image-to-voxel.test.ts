import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdaptivePalette,
  calculateVoxelElevation,
  getIsometricDrawOrder,
  nearestPaletteColour,
  VOXEL_PRESET_CELLS,
} from "./image-to-voxel";

test("voxel presets keep the promised grid densities", () => {
  assert.deepEqual(VOXEL_PRESET_CELLS, {
    fine: 40,
    balanced: 28,
    chunky: 18,
  });
});

test("adaptive palette is deterministic and respects its colour limit", () => {
  const colours = Array.from({ length: 64 }, (_, index) => ({
    r: (index * 31) % 256,
    g: (index * 57) % 256,
    b: (index * 83) % 256,
  }));
  const first = buildAdaptivePalette(colours, 8);
  const second = buildAdaptivePalette(colours, 8);
  assert.equal(first.length, 8);
  assert.deepEqual(first, second);
});

test("nearest palette colour uses perceptual channel weighting", () => {
  const palette = [
    { r: 0, g: 210, b: 0 },
    { r: 200, g: 0, b: 0 },
  ];
  assert.deepEqual(nearestPaletteColour({ r: 170, g: 12, b: 5 }, palette), palette[1]);
  assert.deepEqual(nearestPaletteColour({ r: 10, g: 180, b: 4 }, palette), palette[0]);
});

test("isometric order covers every cell from the far corner forward", () => {
  const order = getIsometricDrawOrder(3);
  assert.equal(order.length, 9);
  assert.deepEqual(order[0], { x: 0, y: 0 });
  assert.deepEqual(order.at(-1), { x: 2, y: 2 });

  for (let index = 1; index < order.length; index += 1) {
    const previous = order[index - 1];
    const current = order[index];
    assert.ok(previous.x + previous.y <= current.x + current.y);
  }
});

test("depth mapping produces visibly tall columns instead of a flat relief", () => {
  const brightFlat = calculateVoxelElevation(1, 0, 0);
  const midtoneFlat = calculateVoxelElevation(0.5, 0, 0.2);
  const darkFlat = calculateVoxelElevation(0.05, 0, 0.2);
  const contrastedMidtone = calculateVoxelElevation(0.5, 0.25, 0.2);

  assert.equal(brightFlat, 0.12);
  assert.ok(midtoneFlat > 0.5);
  assert.ok(darkFlat > 0.8);
  assert.ok(contrastedMidtone > midtoneFlat);
});
