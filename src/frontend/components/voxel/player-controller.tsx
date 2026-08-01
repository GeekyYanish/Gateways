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

/** Where the player is and which way they face, in world/grid coordinates. */
export interface PlayerPose {
  x: number;
  y: number;
  z: number;
  /** Facing, radians; forward is `(sin yaw, cos yaw)`. */
  yaw: number;
}

/**
 * How often the pose is published to React, in seconds.
 *
 * Movement is a per-frame ref precisely so React stays out of the hot loop, so
 * this cannot become a `setState` per frame. 8 times a second is far smoother
 * than a person can read a map marker moving, and it only fires when the player
 * has actually gone somewhere.
 */
const POSE_INTERVAL = 0.125;
const POSE_MOVE_EPSILON = 0.5;
const POSE_TURN_EPSILON = 0.1;

/**
 * All distances below are in VOXELS, which are the scene's world units — and a
 * voxel is now 0.5 m, not 1 m (see `floor-plan.ts`). Every length therefore
 * doubled relative to the old village so the player keeps the same real-world
 * size and feel: a 1.8 m tall body is 3.6 units, a 6.2 m/s walk is 12.4 units/s.
 *
 * The numbers further down this file that are not constants — eye height, the
 * camera ray march, the ledge threshold — are equally scale-bound, so they are
 * hoisted here rather than left inline. Retuning only the obvious five left the
 * camera sitting at the character's waist.
 */
const PLAYER_RADIUS = 0.64;
const PLAYER_HEIGHT = 3.6;
const WALK_SPEED = 12.4;
/**
 * Still ~1 voxel — but a voxel is 0.5 m now, so this is a 0.5 m step rather
 * than a 1 m one. That is the correct real-world value for a kerb, and it is
 * why furniture must be at least 2 voxels tall (asserted in `floor-plan.ts`):
 * anything shorter is something the player walks on top of.
 */
const STEP_HEIGHT = 1.05;
/**
 * Third-person boom. Shorter than strict real-world parity (which would be 18)
 * because the world is now enclosed by walls rather than open landscape.
 * A room-aware camera is part of the interiors pass.
 */
const CAMERA_DISTANCE = 16;
/** Eye/look heights on the player capsule. */
const EYE_HEIGHT = 3;
const LOOK_HEIGHT = 2.8;
/** Height of the camera above the spawn point on the very first frame. */
const CAMERA_START_LIFT = 14;
/** Fall off a ledge once this far above the floor. */
const LEDGE_FALL = 1.2;
/** Camera collision ray march: granularity, near start, floor, and pull-back. */
const CAM_RAY_STEP = 0.8;
const CAM_RAY_START = 2.4;
const CAM_MIN_DISTANCE = 4.4;
const CAM_BACKOFF = 1.4;

/** Voxels per second². 26 m/s² at 0.5 m per voxel — real 9.8 feels floaty here. */
const GRAVITY = 52;
/** Apex = v²/2g ≈ 2.7 voxels ≈ 1.36 m, unchanged in real terms from the village. */
const JUMP_SPEED = 16.8;
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
  onPose,
  consumeJump,
}: {
  world: VoxelWorld;
  spawn: { x: number; y: number; z: number };
  skinId: SkinId;
  input: React.RefObject<InputState>;
  anchors: WorldAnchor[];
  onNearAnchor: (anchor: WorldAnchor | null) => void;
  /** Published on a timer, not per frame — see `POSE_INTERVAL`. */
  onPose?: (pose: PlayerPose) => void;
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

  // Pose publishing. Seeded far outside the world so the first tick always
  // fires and the map has a real position rather than the spawn fallback.
  const poseClock = useRef(0);
  const lastPose = useRef<PlayerPose>({ x: -9999, y: 0, z: -9999, yaw: 0 });

  // Reusable vectors — allocating inside useFrame would churn the GC 60×/sec.
  const scratch = useMemo(
    () => ({ desired: new THREE.Vector3(), camPos: new THREE.Vector3(), look: new THREE.Vector3() }),
    [],
  );

  /** Would the player's capsule intersect solid blocks at this position? */
  const collides = useMemo(
    () => (x: number, y: number, z: number): boolean => {
      // Sample the capsule's corners at foot and head height.
      for (const dy of [0.2, PLAYER_HEIGHT * 0.5, PLAYER_HEIGHT - 0.2]) {
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

  /**
   * Place the camera behind the spawn point on mount, so the first frame is
   * already framed rather than snapping into place.
   *
   * "Behind" has to be derived from the starting yaw, not hardcoded to +z. When
   * it was, the effect put the camera on one side of the player and the first
   * `useFrame` immediately swung it to the other — a visible lurch on entry.
   */
  useEffect(() => {
    const yaw = input.current?.yaw ?? 0;
    camera.position.set(
      spawn.x - Math.sin(yaw) * CAMERA_DISTANCE,
      spawn.y + CAMERA_START_LIFT,
      spawn.z - Math.cos(yaw) * CAMERA_DISTANCE,
    );
    camera.lookAt(spawn.x, spawn.y + LOOK_HEIGHT, spawn.z);
  }, [camera, spawn, input]);

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
          // Below the step ceiling, not the top of the column — otherwise a
          // doorway's lintel reads as a one-block rise and the player is
          // snapped up onto the door frame instead of walking through.
          const ground = world.groundBelow(nx, p.y + STEP_HEIGHT, nz);
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
    // Per axis: the world is a building, not a square island, so x and z have
    // different extents. Clamping z against `size` would fence the player out
    // of everything past the grid's narrower dimension.
    p.x = THREE.MathUtils.clamp(p.x, 1, world.size - 2);
    p.z = THREE.MathUtils.clamp(p.z, 1, world.sizeZ - 2);

    // What is under the player's feet, not what is over their head.
    const ground = world.groundBelow(p.x, p.y, p.z);
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
      if (p.y - floorY > LEDGE_FALL) {
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
    const eyeY = p.y + EYE_HEIGHT;
    const dirX = -Math.sin(inp.yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch);
    const dirZ = -Math.cos(inp.yaw) * Math.cos(pitch);

    let dist = CAMERA_DISTANCE;
    for (let d = CAM_RAY_START; d <= CAMERA_DISTANCE; d += CAM_RAY_STEP) {
      if (world.isSolidAt(p.x + dirX * d, eyeY + dirY * d, p.z + dirZ * d)) {
        // Back off slightly so the near plane does not clip into the block face.
        dist = Math.max(CAM_MIN_DISTANCE, d - CAM_BACKOFF);
        break;
      }
    }

    // Set the look target BEFORE it is used below — reading it first would
    // compare against last frame's value.
    scratch.look.set(p.x, p.y + LOOK_HEIGHT, p.z);

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

    // --- publish the pose, on a timer ---------------------------------------
    if (onPose) {
      poseClock.current += delta;
      if (poseClock.current >= POSE_INTERVAL) {
        poseClock.current = 0;
        const prev = lastPose.current;
        if (
          Math.hypot(p.x - prev.x, p.z - prev.z) > POSE_MOVE_EPSILON ||
          Math.abs(inp.yaw - prev.yaw) > POSE_TURN_EPSILON
        ) {
          const pose = { x: p.x, y: p.y, z: p.z, yaw: inp.yaw };
          lastPose.current = pose;
          onPose(pose);
        }
      }
    }
  });

  return (
    <group ref={group}>
      <VoxelCharacter
        skinId={skinId}
        // The model is authored ~1.8 units tall, which used to be exactly the
        // collision capsule. At 0.5 m per voxel the capsule is 3.6, so without
        // this the character stands half the height of its own hitbox.
        scale={PLAYER_HEIGHT / 1.8}
        movingRef={movingAmount}
        airborneRef={airborne}
      />
    </group>
  );
}

export { PLAYER_HEIGHT, WALK_SPEED };
