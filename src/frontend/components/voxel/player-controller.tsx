"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { VoxelCharacter } from "./voxel-character";
import type { VoxelWorld, WorldAnchor } from "@/frontend/lib/voxel/world";
import type { SkinId } from "@/backend/data/types";

/**
 * Third-person player: input → collision-resolved movement → camera follow.
 *
 * Collision is a swept AABB against the voxel grid, resolved **per axis**. That
 * per-axis split is what lets the player slide along a wall instead of sticking
 * to it: if X is blocked but Z is free, the Z component still applies.
 *
 * Vertical handling combines a step-up (walk onto a one-block rise without
 * jumping) with real gravity so Space can launch the player.
 */

export interface InputState {
  forward: number;
  right: number;
  /** Camera orbit, radians. */
  yaw: number;
  pitch: number;
}

const PLAYER_RADIUS = 0.32;
const PLAYER_HEIGHT = 1.8;
const WALK_SPEED = 6.2;
const STEP_HEIGHT = 1.05;
const CAMERA_DISTANCE = 9;

/** Blocks per second². Tuned high — real-world 9.8 feels floaty at this scale. */
const GRAVITY = 26;
/** Apex = v²/2g ≈ 1.36 blocks, so a one-block ledge clears comfortably. */
const JUMP_SPEED = 8.4;
/**
 * Grace period after walking off an edge during which a jump still registers.
 * Without it, jumping at the lip of a ledge silently fails and feels broken.
 */
const COYOTE_TIME = 0.12;

export function PlayerController({
  world,
  spawn,
  skinId,
  input,
  anchors,
  onNearAnchor,
  consumeJump,
}: {
  world: VoxelWorld;
  spawn: { x: number; y: number; z: number };
  skinId: SkinId;
  input: React.RefObject<InputState>;
  anchors: WorldAnchor[];
  onNearAnchor: (anchor: WorldAnchor | null) => void;
  /**
   * Returns true once per jump press, then resets.
   *
   * A callback rather than a flag on `input`, because the jump latch is owned
   * by whoever handles the key/tap. Reaching into a ref that arrived as a prop
   * and mutating it makes ownership ambiguous — and React's immutability lint
   * rightly rejects it.
   */
  consumeJump: () => boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const pos = useRef(new THREE.Vector3(spawn.x, spawn.y + 1, spawn.z));
  const facing = useRef(0);
  const movingAmount = useRef(0);
  const nearest = useRef<string | null>(null);

  // Vertical state. `airborne` also gates step-up, which must not fire mid-jump
  // or the player would teleport onto ledges while falling past them.
  const velocityY = useRef(0);
  const airborne = useRef(false);
  const timeOffGround = useRef(0);

  // Reusable vectors — allocating inside useFrame would churn the GC 60×/sec.
  const scratch = useMemo(
    () => ({ desired: new THREE.Vector3(), camPos: new THREE.Vector3(), look: new THREE.Vector3() }),
    [],
  );

  /** Would the player's capsule intersect solid blocks at this position? */
  const collides = useMemo(
    () => (x: number, y: number, z: number): boolean => {
      // Sample the capsule's corners at foot and head height.
      for (const dy of [0.1, PLAYER_HEIGHT * 0.5, PLAYER_HEIGHT - 0.1]) {
        for (const [ox, oz] of [
          [-PLAYER_RADIUS, -PLAYER_RADIUS],
          [PLAYER_RADIUS, -PLAYER_RADIUS],
          [-PLAYER_RADIUS, PLAYER_RADIUS],
          [PLAYER_RADIUS, PLAYER_RADIUS],
        ]) {
          if (world.isSolidAt(x + ox, y + dy, z + oz)) return true;
        }
      }
      return false;
    },
    [world],
  );

  // Place the camera behind the spawn point on mount, so the first frame is
  // already framed rather than snapping into place.
  useEffect(() => {
    camera.position.set(spawn.x, spawn.y + 7, spawn.z + CAMERA_DISTANCE);
    camera.lookAt(spawn.x, spawn.y + 1.5, spawn.z);
  }, [camera, spawn]);

  useFrame((_, rawDelta) => {
    // Clamp: a background tab can hand back a multi-second delta, which would
    // teleport the player through walls on return.
    const delta = Math.min(rawDelta, 0.05);
    const inp = input.current;
    if (!inp) return;

    // --- movement, relative to where the camera is looking ----------------
    const mag = Math.hypot(inp.forward, inp.right);
    const speed = mag > 0.01 ? WALK_SPEED * Math.min(1, mag) : 0;

    if (speed > 0) {
      /**
       * Strafe sign.
       *
       * Forward is F = (sin yaw, cos yaw) — the direction from camera to
       * player. The camera looks along +F, and a Three.js camera's local +X
       * (screen right) works out to (-cos yaw, sin yaw), which is MINUS the
       * vector `atan2(right, forward)` produces. Feeding `right` in unnegated
       * therefore drove D to screen-left and A to screen-right. Negating it
       * aligns strafing with what the player sees.
       */
      const moveAngle = inp.yaw + Math.atan2(-inp.right, inp.forward);
      const vx = Math.sin(moveAngle) * speed * delta;
      const vz = Math.cos(moveAngle) * speed * delta;

      const p = pos.current;

      // Resolve each axis separately so a blocked X still allows Z — this is
      // what produces wall-sliding instead of dead stops.
      const tryAxis = (nx: number, nz: number) => {
        if (!collides(nx, p.y, nz)) {
          p.x = nx;
          p.z = nz;
          return true;
        }
        // Blocked at foot level? Step up — but only when standing on something.
        // Mid-jump this would snap the player onto ledges they are falling past.
        if (!airborne.current && !collides(nx, p.y + STEP_HEIGHT, nz)) {
          const ground = world.groundAt(nx, nz);
          if (ground >= 0 && ground + 1 - p.y <= STEP_HEIGHT) {
            p.x = nx;
            p.z = nz;
            p.y = ground + 1;
            return true;
          }
        }
        return false;
      };

      if (!tryAxis(p.x + vx, p.z + vz)) {
        tryAxis(p.x + vx, p.z);
        tryAxis(p.x, p.z + vz);
      }

      facing.current = moveAngle;
    }

    // Smooth the walk-animation weight so idle↔walk blends rather than snaps.
    const target = speed > 0 ? 1 : 0;
    movingAmount.current += (target - movingAmount.current) * Math.min(1, delta * 12);

    // --- vertical: jump, gravity, landing ----------------------------------
    const p = pos.current;
    p.x = THREE.MathUtils.clamp(p.x, 1, world.size - 2);
    p.z = THREE.MathUtils.clamp(p.z, 1, world.size - 2);

    const ground = world.groundAt(p.x, p.z);
    const floorY = ground >= 0 ? ground + 1 : 0;

    // Coyote time: how long since we last had ground under us.
    timeOffGround.current = airborne.current ? timeOffGround.current + delta : 0;

    // Consume the latched jump request.
    if (consumeJump()) {
      const canJump = !airborne.current || timeOffGround.current <= COYOTE_TIME;
      if (canJump) {
        velocityY.current = JUMP_SPEED;
        airborne.current = true;
        // Spend the coyote window so one press cannot double-jump off a ledge.
        timeOffGround.current = COYOTE_TIME + 1;
      }
    }

    if (airborne.current) {
      velocityY.current -= GRAVITY * delta;
      p.y += velocityY.current * delta;

      // Head bump: stop upward motion rather than letting the player tunnel
      // through a ceiling and pop out on top of it.
      if (velocityY.current > 0 && world.isSolidAt(p.x, p.y + PLAYER_HEIGHT, p.z)) {
        velocityY.current = 0;
      }

      if (p.y <= floorY) {
        p.y = floorY;
        velocityY.current = 0;
        airborne.current = false;
      }
    } else {
      // Grounded: ease onto the new height so slopes are walked, not hopped.
      p.y += (floorY - p.y) * Math.min(1, delta * 14);
      // Walked off a ledge — start falling (coyote time makes this forgiving).
      if (p.y - floorY > 0.6) {
        airborne.current = true;
        velocityY.current = 0;
      }
    }

    // --- apply to the model ------------------------------------------------
    if (group.current) {
      group.current.position.copy(p);
      // Shortest-path yaw interpolation, or the model spins the long way round
      // when the angle wraps past π.
      const cur = group.current.rotation.y;
      let diff = facing.current - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      group.current.rotation.y = cur + diff * Math.min(1, delta * 10);
    }

    // --- third-person camera, with collision ------------------------------
    const pitch = THREE.MathUtils.clamp(inp.pitch, 0.15, 1.1);

    /**
     * Pull the camera in when terrain would come between it and the player.
     *
     * Without this the camera happily sits inside a hill or a building and the
     * player sees the unlit inside of the world — which is exactly what it did
     * before this was added. March along the ray from the player's head to the
     * ideal camera spot and stop at the first solid block.
     */
    const eyeY = p.y + 1.5;
    const dirX = -Math.sin(inp.yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch);
    const dirZ = -Math.cos(inp.yaw) * Math.cos(pitch);

    let dist = CAMERA_DISTANCE;
    const STEP = 0.4;
    for (let d = 1.2; d <= CAMERA_DISTANCE; d += STEP) {
      if (world.isSolidAt(p.x + dirX * d, eyeY + dirY * d, p.z + dirZ * d)) {
        // Back off slightly so the near plane does not clip into the block face.
        dist = Math.max(2.2, d - 0.7);
        break;
      }
    }

    // Set the look target BEFORE it is used below — reading it first would
    // compare against last frame's value.
    scratch.look.set(p.x, p.y + 1.4, p.z);

    scratch.camPos.set(p.x + dirX * dist, eyeY + dirY * dist, p.z + dirZ * dist);
    // Snap inward instantly but ease back out. A lagging pull-in would leave
    // the camera inside the wall it is trying to avoid for several frames.
    const currentDist = camera.position.distanceTo(scratch.look);
    const camLerp = dist < currentDist ? 1 : Math.min(1, delta * 6);
    camera.position.lerp(scratch.camPos, camLerp);
    camera.lookAt(scratch.look);

    // --- proximity to a building ------------------------------------------
    let found: WorldAnchor | null = null;
    let bestDist = Infinity;
    for (const a of anchors) {
      const d = Math.hypot(a.x - p.x, a.z - p.z);
      if (d < a.radius && d < bestDist) {
        bestDist = d;
        found = a;
      }
    }
    // Only notify React when the answer actually changes — firing every frame
    // would re-render the overlay 60×/sec.
    const key = found?.key ?? null;
    if (key !== nearest.current) {
      nearest.current = key;
      onNearAnchor(found);
    }
  });

  return (
    <group ref={group}>
      <VoxelCharacter
        skinId={skinId}
        movingRef={movingAmount}
        airborneRef={airborne}
      />
    </group>
  );
}

export { PLAYER_HEIGHT, WALK_SPEED };
