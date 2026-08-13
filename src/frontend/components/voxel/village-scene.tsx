"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { buildVillage } from "@/frontend/lib/voxel/village";
import type { WorldAnchor } from "@/frontend/lib/voxel/world";
import type { SkinId } from "@/backend/data/types";
import { VoxelTerrain, type TerrainStats } from "./voxel-terrain";
import { PlayerController, type InputState, type PlayerPose } from "./player-controller";
import { BuildingMarkers } from "./building-markers";
import { TouchControls } from "./touch-controls";
import { cn } from "@/frontend/lib/utils";

/**
 * The 3D village.
 *
 * Input lives in a REF, not state: movement and camera orbit update every
 * frame, and routing that through React state would re-render the whole scene
 * 60 times a second. The ref is written by DOM listeners and read inside
 * useFrame, so React never participates in the hot loop.
 */
/**
 * Sun with a shadow frustum centred on the village.
 *
 * A bare <directionalLight> aims at the world ORIGIN, but this world spans
 * ~126 × 104. The shadow camera therefore covered only the half of the map
 * nearest the origin and everything past its edge rendered fully shadowed —
 * a hard vertical line straight down the middle of the screen.
 *
 * Giving the light an explicit target at the village centre fixes it. The
 * target must be added to the scene and have its matrix updated, or Three
 * silently keeps aiming at the origin.
 */
function SunLight({ center }: { center: [number, number, number] }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    target.position.set(center[0], center[1], center[2]);
    target.updateMatrixWorld();
    if (light.current) {
      light.current.target = target;
      light.current.updateMatrixWorld();
    }
  }, [center, target]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const shadowSize = isMobile ? 512 : 1024;

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        // High, near-overhead sun. At the previous ~50° elevation the castle and
        // mine hill threw shadows a third of the map long, which read as a
        // rendering fault rather than as lighting. ~73° keeps shadows short
        // enough to describe form without swallowing the village.
        position={[center[0] + 45, 200, center[2] + 32]}
        intensity={1.5}
        color="#fff2dc"
        castShadow
        // Frustum sized to the building's footprint (~126 voxels across), so
        // the half-extent is ~63 plus margin. A wider frustum at the same map
        // size would only thin the texel density.
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={1}
        shadow-camera-far={380}
        shadow-bias={-0.0004}
        // normalBias offsets the shadow lookup ALONG THE SURFACE NORMAL. With a
        // 1024 map spread over the village a texel covers ~0.11 world units, and
        // plain depth bias could not stop large flat faces shadowing themselves —
        // which blanketed most of the map in false shadow.
        shadow-normalBias={0.6}
      />
    </>
  );
}



export function VillageScene({
  skinId,
  className,
  onPose,
}: {
  skinId: SkinId;
  className?: string;
  /** Lifts the player's position out of the canvas, so the 2D map can show it. */
  onPose?: (pose: PlayerPose) => void;
}) {
  const router = useRouter();

  // Village generation is deterministic and pure — build it once, never rebuild.
  const village = useMemo(() => buildVillage(), []);

  // Yaw comes from the generator, which is the only thing that knows where the
  // building is relative to the spawn. See `VillageResult.spawnYaw`.
  const input = useRef<InputState>({
    forward: 0,
    right: 0,
    yaw: village.spawnYaw,
    pitch: 0.55,
  });

  // Jump latch, owned here because this component handles both the key and the
  // on-screen button. The controller drains it once per frame.
  const jumpRequested = useRef(false);
  const requestJump = useCallback(() => {
    jumpRequested.current = true;
  }, []);
  const consumeJump = useCallback(() => {
    if (!jumpRequested.current) return false;
    jumpRequested.current = false;
    return true;
  }, []);
  const [nearAnchor, setNearAnchor] = useState<WorldAnchor | null>(null);
  const [hint, setHint] = useState(true);
  const [stats, setStats] = useState<TerrainStats | null>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);

  // ---- keyboard ----------------------------------------------------------
  useEffect(() => {
    const keys = new Set<string>();

    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return Boolean(
        el &&
          (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.tagName === "SELECT" ||
            el.isContentEditable),
      );
    };

    const apply = () => {
      const i = input.current;
      i.forward = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      i.right = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    };

    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        // Stop arrow keys scrolling the page while driving the character.
        e.preventDefault();
        keys.add(k);
        setHint(false);
        apply();
      }

      // Jump. Space scrolls the page by default, so preventDefault is required.
      // `e.repeat` is ignored: holding Space must not machine-gun jumps.
      if ((k === " " || e.code === "Space") && !e.repeat) {
        e.preventDefault();
        requestJump();
        setHint(false);
      }
      // Q/E orbit the camera without a mouse — the keyboard-only path.
      if (k === "q") input.current.yaw += 0.18;
      if (k === "e") input.current.yaw -= 0.18;
      // Enter activates the building you are standing next to.
      if (k === "enter" && nearAnchor) router.push(nearAnchor.href);
    };

    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      apply();
    };

    // Releasing focus must clear held keys, or the player walks forever.
    const blur = () => {
      keys.clear();
      apply();
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [nearAnchor, router, requestJump]);

  // ---- mouse drag to orbit ----------------------------------------------
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const down = (e: PointerEvent) => {
      // Ignore drags that start on a label button.
      if ((e.target as HTMLElement).closest("button")) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      input.current.yaw -= (e.clientX - lastX) * 0.006;
      input.current.pitch = Math.min(
        1.1,
        Math.max(0.15, input.current.pitch + (e.clientY - lastY) * 0.004),
      );
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = () => {
      dragging = false;
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div ref={surfaceRef} className={cn("relative touch-none select-none", className)}>
      <Canvas
        // "percentage" (PCF) rather than the default soft map: Three deprecated
        // PCFSoftShadowMap and silently downgrades it anyway, and on blocky
        // geometry the softer filter buys nothing visually.
        shadows="percentage"
        // Clamp DPR: a 3× retina phone would otherwise render 9× the pixels of
        // a 1× display for no visible gain on a blocky scene.
        dpr={[1, 1.75]}
        camera={{ fov: 58, near: 0.1, far: 420 }}
        // Explicitly opt out of the default alpha buffer; the sky always covers.
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        // R3F's container does not inherit a flex-derived parent height — it
        // falls back to the canvas intrinsic 150px, which silently squashes the
        // whole scene into a letterbox. Absolutely filling the relative wrapper
        // is the reliable fix.
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#87b8e8"]} />
        {/* Near/far in voxels. Doubled with the voxel scale, then widened so the
            far corner of a 126×104 plan is still legible rather than fogged out.
            The colour matches the sky at the horizon — a fog tinted differently
            from what it fades into puts a visible band across the distance. */}
        <fog attach="fog" args={["#cfe1f2", 85, 260]} />

        <Sky sunPosition={[60, 40, 30]} turbidity={5} rayleigh={1.4} />

        {/* Warm key light with shadows, cool ambient fill — the two-light setup
            that makes untextured cubes read as solid form.

            Ambient used to be 1.25, on the reasoning that flat-shaded voxels
            have no texture detail to carry a dark area, so an unlit face reads
            as a rendering fault. That was true before the mesh builder baked
            ambient occlusion: with AO supplying contact shadows in every corner
            and doorway, this much fill washed the whole scene into one flat
            tone. Lowering it and pushing the sun up is what gives the building
            depth — the shading now comes from geometry rather than from
            everything being lit to the same value. */}
        <ambientLight intensity={0.62} color="#cfe0f5" />
        {/* Cool bounce from below, so ground-facing surfaces are not pure black. */}
        <hemisphereLight args={["#c6dcf7", "#5a4c38", 0.62]} />
        <SunLight center={[village.world.size / 2, 0, village.world.sizeZ / 2]} />

        <VoxelTerrain world={village.world} onStats={setStats} />

        <PlayerController
          world={village.world}
          spawn={village.spawn}
          skinId={skinId}
          input={input}
          anchors={village.anchors}
          onNearAnchor={setNearAnchor}
          onPose={onPose}
          consumeJump={consumeJump}
        />

        <BuildingMarkers
          anchors={village.anchors}
          activeKey={nearAnchor?.key ?? null}
          onSelect={(a) => router.push(a.href)}
        />
      </Canvas>

      {/* ---- HUD overlays -------------------------------------------------- */}

      {hint ? (
        <div className="pointer-events-none absolute left-1/2 top-[var(--mc-unit)] -translate-x-1/2 bg-mc-panel/90 px-[calc(var(--mc-unit)*1.5)] py-[var(--mc-unit)] bevel border-[length:var(--mc-bevel)] border-mc-border">
          <p className="font-pixel text-[10px] uppercase text-mc-text">
            WASD / arrows to walk · Space to jump · drag to look · Q/E to turn
          </p>
        </div>
      ) : null}

      {nearAnchor ? (
        <div className="absolute bottom-[calc(var(--mc-unit)*8)] left-1/2 -translate-x-1/2">
          <button
            type="button"
            onClick={() => router.push(nearAnchor.href)}
            className="bg-mc-emerald text-mc-obsidian bevel border-0 px-[calc(var(--mc-unit)*2)] py-[var(--mc-unit)] font-pixel text-[11px] uppercase [--bevel-light:var(--color-mc-emerald-light)] [--bevel-dark:var(--color-mc-emerald-dark)] hover:brightness-110 active:translate-y-[var(--mc-bevel)] active:bevel-pressed"
          >
            Enter {nearAnchor.label} ⏎
          </button>
        </div>
      ) : null}

      <TouchControls
        input={input}
        onMove={() => setHint(false)}
        onJump={requestJump}
      />

      {/* Dev-only geometry budget readout.
          Shows the numbers that actually decide whether this scene is
          affordable: total blocks, the visible subset after culling, and the
          resulting vertex count. VOXEL-3D.md records the measured working
          point to compare against. */}
      {process.env.NODE_ENV !== "production" ? (
        <p
          data-testid="voxel-stats"
          className="pointer-events-none absolute bottom-1 right-2 font-mono text-[11px] text-white/45"
        >
          {village.world.blockCount} blocks
          {stats
            ? ` · ${stats.blocks} visible · ${(stats.faces * 4).toLocaleString()} verts`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
