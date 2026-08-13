"use client";

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { BLOCKS, isSolid, type BlockType } from "@/frontend/lib/voxel/blocks";
import type { VoxelWorld } from "@/frontend/lib/voxel/world";

/**
 * Face-culled mesh builder — the actual voxel-engine renderer.
 *
 * WHY NOT InstancedMesh of cubes (the obvious first approach):
 * a cube is 24 vertices, and a block sitting in a wall shows at most one face.
 * Instancing 15k cubes pushed ~367k vertices per pass, twice per frame with
 * shadows. Measured: framerate stayed pinned at ~4fps even when the viewport
 * shrank 8×, proving the cost was geometry, not pixels.
 *
 * WHAT THIS DOES INSTEAD: emit only the faces that touch air. Flat terrain
 * contributes one quad per column instead of a whole cube; a wall's interior
 * contributes nothing. Roughly a 4× vertex reduction on this village.
 *
 * It also merges EVERY opaque block type into a single geometry, with colour
 * carried per-vertex. That takes the whole opaque world from ~20 draw calls to
 * one. Per-face brightness (top bright, sides mid, bottom dark) is baked into
 * those same vertex colours, which is what gives untextured cubes their form.
 *
 * THREE passes, not two:
 *  - **opaque** — Lambert, lit by the sun.
 *  - **glow** — emissive blocks (lanterns, gold, gems) on an UNLIT basic
 *    material, so they read as light sources instead of brightly-painted
 *    cubes. `BlockDef.emissive` had been declared since the first version and
 *    silently ignored by this file; the 2D map honoured it and the 3D view did
 *    not, which is why lanterns glowed on the map and looked like yellow
 *    blocks in the world.
 *  - **transparent** — glass and water, with per-block alpha carried in a
 *    4-component vertex colour. It used to be one flat 0.72 for everything, so
 *    glass (0.34) was as solid as water (0.62) and windows read as walls.
 *
 * Vertex AMBIENT OCCLUSION is baked in the same pass. It is the single biggest
 * thing that makes untextured voxels read as architecture rather than as a pile
 * of coloured boxes: corners darken, walls meet floors in a visible seam, and
 * doorways gain depth. It costs no draw calls and no extra vertices — only the
 * neighbour sampling at build time.
 */

/** [normal, four corner offsets] for each cube face, wound counter-clockwise. */
const FACES: Array<{
  dir: [number, number, number];
  corners: Array<[number, number, number]>;
  /** Baked directional shading — the classic voxel read. */
  shade: number;
}> = [
  {
    dir: [0, 1, 0], shade: 1.0, // top
    corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
  },
  {
    dir: [0, -1, 0], shade: 0.55, // bottom
    corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  },
  {
    dir: [1, 0, 0], shade: 0.82, // +x
    corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  },
  {
    dir: [-1, 0, 0], shade: 0.72, // -x
    corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
  },
  {
    dir: [0, 0, 1], shade: 0.9, // +z
    corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  },
  {
    dir: [0, 0, -1], shade: 0.65, // -z
    corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
  },
];

/**
 * The two axes each face runs along — everything except its normal.
 * Precomputed because the AO sampler needs them for every corner of every face.
 */
const FACE_TANGENTS: Array<[number, number]> = FACES.map((f) => {
  const t: number[] = [];
  for (let a = 0; a < 3; a++) if (f.dir[a] === 0) t.push(a);
  return [t[0], t[1]];
});

/**
 * Brightness per occlusion level, 0 (most enclosed) to 3 (fully open).
 *
 * Deliberately gentle at the top end and steep at the bottom: heavy AO on a
 * flat-shaded palette reads as dirt smeared into the corners, but too little
 * and the whole point is lost.
 */
const AO_LEVELS = [0.55, 0.74, 0.89, 1.0];

interface MeshData {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

function emptyMesh(): MeshData {
  return { positions: [], normals: [], colors: [], indices: [] };
}

/**
 * Should a face between `here` and the neighbour be drawn?
 *
 * Drawn when the neighbour is air, or when it is transparent and of a different
 * type. That second condition is what stops the interior faces of a body of
 * water from being emitted while still drawing the water's surface against air.
 */
function faceVisible(here: BlockType, neighbour: BlockType | undefined): boolean {
  if (neighbour === undefined) return true;
  if (isSolid(neighbour)) return false;
  return neighbour !== here;
}

function buildMeshes(world: VoxelWorld, blocks: Array<{ x: number; y: number; z: number; type: BlockType }>) {
  const opaque = emptyMesh();
  const transparent = emptyMesh();
  const glow = emptyMesh();
  const color = new THREE.Color();

  /** Is the block one step off `face` in tangent directions (du, dv) solid? */
  const occluded = (
    bx: number, by: number, bz: number,
    dir: [number, number, number],
    ua: number, va: number,
    du: number, dv: number,
  ): number => {
    const p: [number, number, number] = [bx + dir[0], by + dir[1], bz + dir[2]];
    p[ua] += du;
    p[va] += dv;
    return isSolid(world.get(p[0], p[1], p[2])) ? 1 : 0;
  };

  for (const b of blocks) {
    const def = BLOCKS[b.type];
    // Emissive blocks go to the unlit pass so they actually glow. The portal is
    // both emissive and transparent; transparency wins, and its own colour is
    // bright enough to read.
    const target = def.transparent
      ? transparent
      : def.emissive
        ? glow
        : opaque;
    const isGlow = target === glow;

    // Deterministic per-block tint. Random() would make the world shimmer
    // differently on every mount.
    let jitter = 1;
    if (def.jitter) {
      const n = Math.sin(b.x * 12.9898 + b.y * 78.233 + b.z * 37.719) * 43758.5453;
      jitter = 1 + (n - Math.floor(n) - 0.5) * 2 * def.jitter;
    }

    for (let fi = 0; fi < FACES.length; fi++) {
      const face = FACES[fi];
      const nx = b.x + face.dir[0];
      const ny = b.y + face.dir[1];
      const nz = b.z + face.dir[2];
      /**
       * Nothing exists below y=0 and the camera can never get under the world,
       * so the underside of the lowest layer is geometry no one can see. On the
       * old rolling terrain that was a rounding error; on a flat single-level
       * floor it is one wasted quad for EVERY column — ~13k of them, more than
       * the whole building's walls put together.
       */
      if (ny < 0) continue;
      if (!faceVisible(b.type, world.get(nx, ny, nz))) continue;

      const base = target.positions.length / 3;
      // Self-lit blocks ignore the directional ramp — a light source is not
      // darker on its underside — and are pushed past 1.0 so they bloom. Gently,
      // though: a lantern driven to 1.7 clips to a flat yellow square.
      const shade = isGlow ? 1 + Math.min(0.25, (def.emissiveIntensity ?? 0.5) * 0.18) : face.shade;
      color.set(def.color).multiplyScalar(shade * jitter);

      const [ua, va] = FACE_TANGENTS[fi];
      const ao = [1, 1, 1, 1];
      if (!isGlow) {
        for (let ci = 0; ci < 4; ci++) {
          const c = face.corners[ci];
          const su = c[ua] === 1 ? 1 : -1;
          const sv = c[va] === 1 ? 1 : -1;
          const s1 = occluded(b.x, b.y, b.z, face.dir, ua, va, su, 0);
          const s2 = occluded(b.x, b.y, b.z, face.dir, ua, va, 0, sv);
          // Two touching sides fully enclose the corner; the diagonal cannot
          // make it darker, and sampling it would be wrong when it is air.
          const corner = s1 && s2 ? 1 : occluded(b.x, b.y, b.z, face.dir, ua, va, su, sv);
          ao[ci] = AO_LEVELS[s1 && s2 ? 0 : 3 - (s1 + s2 + corner)];
        }
      }

      for (let ci = 0; ci < 4; ci++) {
        const c = face.corners[ci];
        // -0.5 centres the cube on its integer coordinate.
        target.positions.push(b.x + c[0] - 0.5, b.y + c[1] - 0.5, b.z + c[2] - 0.5);
        target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
        target.colors.push(color.r * ao[ci], color.g * ao[ci], color.b * ao[ci]);
        // The transparent pass carries alpha per vertex, so glass and water can
        // differ. The other two passes use a 3-component attribute.
        if (target === transparent) target.colors.push(def.opacity ?? 1);
      }

      /**
       * Two triangles per quad — but split along whichever diagonal keeps the
       * darker corners together.
       *
       * A quad is flat-interpolated across whichever diagonal it is cut on, so
       * with unequal corner AO the fixed cut produces a visible seam running
       * the wrong way, and long walls end up with a herringbone of light and
       * dark triangles. Choosing the diagonal per quad is the standard fix.
       */
      if (ao[0] + ao[2] > ao[1] + ao[3]) {
        target.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      } else {
        target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }

  return { opaque, transparent, glow };
}

/**
 * `colorSize` is 4 for the transparent pass. Three.js switches the shader to
 * `USE_COLOR_ALPHA` purely on the attribute's itemSize, which is what lets one
 * merged geometry hold blocks of differing opacity.
 */
function toGeometry(data: MeshData, colorSize: 3 | 4 = 3): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, colorSize));
  g.setIndex(data.indices);
  g.computeBoundingSphere();
  return g;
}

export interface TerrainStats {
  blocks: number;
  faces: number;
}

export function VoxelTerrain({
  world,
  onStats,
}: {
  world: VoxelWorld;
  /** Reports the geometry budget once per world, for the dev HUD. */
  onStats?: (stats: TerrainStats) => void;
}) {
  const { opaqueGeo, transparentGeo, glowGeo, stats } = useMemo(() => {
    const blocks = world.visibleBlocks();
    const { opaque, transparent, glow } = buildMeshes(world, blocks);
    return {
      opaqueGeo: toGeometry(opaque),
      transparentGeo: toGeometry(transparent, 4),
      glowGeo: toGeometry(glow),
      stats: {
        blocks: blocks.length,
        // 4 vertices per quad; the transparent pass packs 4 floats per vertex.
        faces:
          (opaque.positions.length + transparent.positions.length + glow.positions.length) / 12,
      },
    };
  }, [world]);

  // Report the budget so the HUD can show it without recomputing. The window
  // global is kept for headless measurement (CDP can read it without a React
  // hook); the callback is what the on-screen readout uses.
  useLayoutEffect(() => {
    (window as unknown as { __voxelStats?: typeof stats }).__voxelStats = stats;
    onStats?.(stats);
  }, [stats, onStats]);

  // Free GPU buffers when the world changes or the scene unmounts.
  useLayoutEffect(() => {
    return () => {
      opaqueGeo.dispose();
      transparentGeo.dispose();
      glowGeo.dispose();
    };
  }, [opaqueGeo, transparentGeo, glowGeo]);

  return (
    <group>
      <mesh geometry={opaqueGeo} castShadow receiveShadow>
        <meshLambertMaterial vertexColors />
      </mesh>

      {/* Self-lit: basic, not Lambert, so lanterns and gold stay bright on
          their shadowed sides. They cast shadows but do not receive them —
          a light source lying in its own shadow is the giveaway that it is
          just a painted cube. */}
      <mesh geometry={glowGeo} castShadow>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>

      {/* Transparent pass is separate and does not write depth, or blocks
          behind glass and water would be culled away. Opacity comes from the
          vertex alpha, so glass and water differ; a flat material opacity here
          would flatten them back to one value. */}
      <mesh geometry={transparentGeo}>
        <meshLambertMaterial vertexColors transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
