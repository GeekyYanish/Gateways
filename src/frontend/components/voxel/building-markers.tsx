"use client";

import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldAnchor } from "@/frontend/lib/voxel/world";

/**
 * Floating, clickable labels above each building.
 *
 * `<Html>` from drei renders real DOM in 3D space, which matters for more than
 * convenience: the labels are actual <button> elements, so they are keyboard
 * focusable and screen-reader readable. Labels drawn as canvas sprites would be
 * invisible to assistive tech entirely.
 *
 * `occlude` hides a label when a building stands between it and the camera, so
 * markers do not float through walls.
 */
export function BuildingMarkers({
  anchors,
  activeKey,
  onSelect,
}: {
  anchors: WorldAnchor[];
  activeKey: string | null;
  onSelect: (anchor: WorldAnchor) => void;
}) {
  return (
    <>
      {anchors.map((a) => (
        <Marker
          key={a.key}
          anchor={a}
          active={a.key === activeKey}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function Marker({
  anchor,
  active,
  onSelect,
}: {
  anchor: WorldAnchor;
  active: boolean;
  onSelect: (a: WorldAnchor) => void;
}) {
  const beacon = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!beacon.current) return;
    const t = state.clock.elapsedTime;
    // Gentle bob + spin so the marker reads as interactive, not scenery.
    beacon.current.position.y = anchor.y + anchor.labelHeight - 1.2 + Math.sin(t * 2 + anchor.x) * 0.18;
    beacon.current.rotation.y = t * 0.9;
  });

  const highlighted = active || hovered;

  return (
    <group>
      {/* Floating diamond beacon. */}
      <mesh
        ref={beacon}
        position={[anchor.x, anchor.y + anchor.labelHeight - 1.2, anchor.z]}
        rotation={[Math.PI / 4, 0, Math.PI / 4]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(anchor);
        }}
      >
        {/* Sized in voxels, and a voxel is 0.5 m — so these are twice the
            numbers the 1 m-per-voxel village used, for the same apparent size. */}
        <boxGeometry args={[1.1, 1.1, 1.1]} />
        <meshLambertMaterial
          color={highlighted ? "#ffd166" : "#c964ff"}
          emissive={highlighted ? "#ffd166" : "#a02ce0"}
          emissiveIntensity={highlighted ? 1.4 : 0.7}
        />
      </mesh>

      {/* Beam of light down to the building, so the marker is locatable from
          across the map. */}
      <mesh position={[anchor.x, anchor.y + anchor.labelHeight / 2 - 1, anchor.z]}>
        <cylinderGeometry args={[0.14, 0.14, anchor.labelHeight, 6]} />
        <meshBasicMaterial
          color={highlighted ? "#ffd166" : "#a02ce0"}
          transparent
          opacity={highlighted ? 0.5 : 0.22}
          depthWrite={false}
        />
      </mesh>

      <Html
        position={[anchor.x, anchor.y + anchor.labelHeight, anchor.z]}
        center
        // Lower distanceFactor = smaller on screen; drei scales the element by
        // distanceFactor / distance, so this is "the distance at which the
        // label renders 1:1". The camera boom is 16, and a label at 1:1 when
        // you are standing under it fills a third of the viewport — which is
        // exactly what 18 did. Keep it well below the boom length.
        distanceFactor={10}
        occlude
        // Wrapper must not swallow pointer events for the whole scene.
        style={{ pointerEvents: "none" }}
      >
        <button
          type="button"
          onClick={() => onSelect(anchor)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="voxel-marker-label"
          data-active={highlighted || undefined}
        >
          {anchor.label}
        </button>
      </Html>
    </group>
  );
}
