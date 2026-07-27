"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
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
  const color = new THREE.Color();

  for (const b of blocks) {
    const def = BLOCKS[b.type];
    const target = def.transparent ? transparent : opaque;

    // Deterministic per-block tint. Random() would make the world shimmer
    // differently on every mount.
    let jitter = 1;
    if (def.jitter) {
      const n = Math.sin(b.x * 12.9898 + b.y * 78.233 + b.z * 37.719) * 43758.5453;
      jitter = 1 + (n - Math.floor(n) - 0.5) * 2 * def.jitter;
    }

    for (const face of FACES) {
      const nx = b.x + face.dir[0];
      const ny = b.y + face.dir[1];
      const nz = b.z + face.dir[2];
      if (!faceVisible(b.type, world.get(nx, ny, nz))) continue;

      const base = target.positions.length / 3;
      color.set(def.color).multiplyScalar(face.shade * jitter);

      for (const c of face.corners) {
        // -0.5 centres the cube on its integer coordinate.
        target.positions.push(b.x + c[0] - 0.5, b.y + c[1] - 0.5, b.z + c[2] - 0.5);
        target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
        target.colors.push(color.r, color.g, color.b);
      }
      // Two triangles per quad.
      target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  return { opaque, transparent };
}

function toGeometry(data: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  g.setIndex(data.indices);
  g.computeBoundingSphere();
  return g;
}

export function VoxelTerrain({ world }: { world: VoxelWorld }) {
  const opaqueRef = useRef<THREE.Mesh>(null);
  const transparentRef = useRef<THREE.Mesh>(null);

  const { opaqueGeo, transparentGeo, stats } = useMemo(() => {
    const blocks = world.visibleBlocks();
    const { opaque, transparent } = buildMeshes(world, blocks);
    return {
      opaqueGeo: toGeometry(opaque),
      transparentGeo: toGeometry(transparent),
      stats: {
        blocks: blocks.length,
        // 4 vertices per quad.
        faces: (opaque.positions.length + transparent.positions.length) / 12,
      },
    };
  }, [world]);

  // Report the budget so the HUD can show it without recomputing.
  useLayoutEffect(() => {
    (window as unknown as { __voxelStats?: typeof stats }).__voxelStats = stats;
  }, [stats]);

  // Free GPU buffers when the world changes or the scene unmounts.
  useLayoutEffect(() => {
    return () => {
      opaqueGeo.dispose();
      transparentGeo.dispose();
    };
  }, [opaqueGeo, transparentGeo]);

  return (
    <group>
      <mesh ref={opaqueRef} geometry={opaqueGeo} castShadow receiveShadow>
        <meshLambertMaterial vertexColors />
      </mesh>

      {/* Transparent pass is separate and does not write depth, or blocks
          behind glass and water would be culled away. */}
      <mesh ref={transparentRef} geometry={transparentGeo}>
        <meshLambertMaterial vertexColors transparent opacity={0.72} depthWrite={false} />
      </mesh>
    </group>
  );
}
