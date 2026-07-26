"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SkinId } from "@/lib/data/types";

/**
 * Cube-built character for the five ORIGINAL archetypes.
 *
 * Deliberately not a Minecraft player model: different proportions (narrower
 * torso, visible boots and belt) and entirely our own colour schemes. The
 * blocky construction is the shared aesthetic, not a copied asset.
 *
 * Limbs are grouped and rotated about their shoulder/hip so the walk cycle is a
 * real articulated swing rather than a sliding texture.
 */

interface Palette {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  boots: string;
  accent: string;
}

const PALETTES: Record<SkinId, Palette> = {
  prospector: {
    skin: "#c8956d", hair: "#4a3520", shirt: "#8a6a3a",
    pants: "#5a4a35", boots: "#3a2f22", accent: "#f2b233",
  },
  botanist: {
    skin: "#e0b48c", hair: "#5c4322", shirt: "#3f8a34",
    pants: "#4a5a2f", boots: "#3a3020", accent: "#7ec850",
  },
  sentinel: {
    skin: "#b8845c", hair: "#2f2a26", shirt: "#8a8f96",
    pants: "#5c6068", boots: "#3c4046", accent: "#c4cad2",
  },
  voidwalker: {
    skin: "#9a86b8", hair: "#1a1024", shirt: "#3d1259",
    pants: "#2a1140", boots: "#1a1024", accent: "#c964ff",
  },
  artificer: {
    skin: "#d4a373", hair: "#8a5a2b", shirt: "#2c6472",
    pants: "#3a4550", boots: "#2a2f35", accent: "#3ddfe0",
  },
};

/** Small helper — a coloured box at a position. */
function Part({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

export function VoxelCharacter({
  skinId,
  /**
   * 0 = idle, 1 = full walk speed; drives limb-swing amplitude.
   *
   * Accepts a REF, not a number, deliberately. The controller updates this
   * every frame, and a plain prop would either be stale (refs do not re-render)
   * or force 60 React renders a second. Reading the ref inside useFrame keeps
   * the animation live at zero render cost.
   */
  movingRef,
  /** True while jumping or falling — swaps the walk cycle for a jump pose. */
  airborneRef,
  scale = 1,
}: {
  skinId: SkinId;
  movingRef?: React.RefObject<number>;
  airborneRef?: React.RefObject<boolean>;
  scale?: number;
}) {
  const p = PALETTES[skinId] ?? PALETTES.prospector;

  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);

  // Eased 0→1 weight for the jump pose, so take-off and landing blend rather
  // than snapping between two poses on the frame the state flips.
  const airWeight = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const moving = movingRef?.current ?? 0;
    const airborne = airborneRef?.current ?? false;

    airWeight.current +=
      ((airborne ? 1 : 0) - airWeight.current) * Math.min(1, delta * 12);
    const air = airWeight.current;

    // Walk cycle: opposite arm and leg swing together, amplitude scaled by
    // speed so idle↔walk is continuous rather than a snap between animations.
    // Damped by `air` so limbs stop pumping once the feet leave the ground.
    const swing = Math.sin(t * 9) * 0.9 * moving * (1 - air);

    // Jump pose: arms up and back, legs tucked forward.
    const armAir = -2.1 * air;
    const legAir = 0.7 * air;

    if (leftArm.current) leftArm.current.rotation.x = swing + armAir;
    if (rightArm.current) rightArm.current.rotation.x = -swing + armAir;
    if (leftLeg.current) leftLeg.current.rotation.x = -swing + legAir;
    if (rightLeg.current) rightLeg.current.rotation.x = swing + legAir * 0.55;

    // Idle breathing plus a walking bob, both suppressed in the air.
    if (body.current) {
      const idle = Math.sin(t * 1.8) * 0.02 * (1 - moving);
      const bob = Math.abs(Math.sin(t * 9)) * 0.06 * moving;
      body.current.position.y = (idle + bob) * (1 - air);
    }
  });

  return (
    <group scale={scale}>
      <group ref={body}>
        {/* Head */}
        <Part position={[0, 1.62, 0]} size={[0.5, 0.5, 0.5]} color={p.skin} />
        {/* Hair cap — sits proud of the skull so it reads as separate. */}
        <Part position={[0, 1.84, 0]} size={[0.54, 0.14, 0.54]} color={p.hair} />
        {/* Eyes, as tiny insets on the face. */}
        <Part position={[-0.12, 1.64, 0.26]} size={[0.08, 0.08, 0.02]} color="#1a1024" />
        <Part position={[0.12, 1.64, 0.26]} size={[0.08, 0.08, 0.02]} color="#1a1024" />

        {/* Torso, narrower than the classic blocky player. */}
        <Part position={[0, 1.1, 0]} size={[0.44, 0.6, 0.26]} color={p.shirt} />
        {/* Belt in the archetype's accent colour. */}
        <Part position={[0, 0.82, 0]} size={[0.46, 0.08, 0.28]} color={p.accent} />

        {/* Arms — pivot at the shoulder, so the group origin is the joint. */}
        <group ref={leftArm} position={[-0.32, 1.36, 0]}>
          <Part position={[0, -0.26, 0]} size={[0.18, 0.52, 0.18]} color={p.shirt} />
          <Part position={[0, -0.56, 0]} size={[0.18, 0.1, 0.18]} color={p.skin} />
        </group>
        <group ref={rightArm} position={[0.32, 1.36, 0]}>
          <Part position={[0, -0.26, 0]} size={[0.18, 0.52, 0.18]} color={p.shirt} />
          <Part position={[0, -0.56, 0]} size={[0.18, 0.1, 0.18]} color={p.skin} />
        </group>

        {/* Legs — pivot at the hip. */}
        <group ref={leftLeg} position={[-0.12, 0.78, 0]}>
          <Part position={[0, -0.32, 0]} size={[0.19, 0.6, 0.2]} color={p.pants} />
          <Part position={[0, -0.66, 0.02]} size={[0.21, 0.12, 0.26]} color={p.boots} />
        </group>
        <group ref={rightLeg} position={[0.12, 0.78, 0]}>
          <Part position={[0, -0.32, 0]} size={[0.19, 0.6, 0.2]} color={p.pants} />
          <Part position={[0, -0.66, 0.02]} size={[0.21, 0.12, 0.26]} color={p.boots} />
        </group>
      </group>
    </group>
  );
}

export { PALETTES as CHARACTER_PALETTES };
