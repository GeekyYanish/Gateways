"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LoadingBlocks } from "@/frontend/components/mc";
import type { SkinId } from "@/backend/data/types";
import type { PlayerPose } from "./player-controller";

/**
 * Public entry point for the 3D village.
 *
 * Three responsibilities, all of them about NOT breaking the site:
 *
 * 1. **ssr: false.** Three.js touches `window` and WebGL at import time; server
 *    rendering it throws. The whole bundle is also ~600kB, so keeping it out of
 *    the initial payload matters for every page that is not the world.
 *
 * 2. **Capability detection.** WebGL is missing or blocklisted on older
 *    hardware, in some VMs, and when a user has disabled it. We check for a real
 *    context before mounting, and hand back a `supported: false` signal so the
 *    caller can show the 2D map instead of a black rectangle.
 *
 * 3. **Reduced motion.** A camera the user cannot stop moving is exactly what
 *    motion-sensitive users need protection from, so we offer the 2D view
 *    rather than autoplaying a 3D scene at them.
 */

const VillageScene = dynamic(
  () => import("./village-scene").then((m) => m.VillageScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[420px] place-items-center bg-mc-obsidian">
        <LoadingBlocks label="Building the realm" />
      </div>
    ),
  },
);

export type VoxelSupport = "checking" | "ready" | "unsupported" | "reduced-motion";

/** Does this browser actually give us a usable WebGL context? */
function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    // Release it immediately — browsers cap simultaneous contexts, and leaking
    // this one can make the real canvas fail to initialise later.
    const lose = (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function useVoxelSupport(): VoxelSupport {
  const [state, setState] = useState<VoxelSupport>("checking");

  useEffect(() => {
    // Probing WebGL and the motion preference means touching browser APIs that
    // do not exist during SSR, so this cannot move into a lazy state
    // initialiser without a hydration mismatch. It runs exactly once and
    // settles; there is no cascade for the rule to protect against.
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reduceMotion === "true";

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(reduced ? "reduced-motion" : detectWebGL() ? "ready" : "unsupported");
  }, []);

  return state;
}

export function VoxelWorldView({
  skinId,
  className,
  onPose,
}: {
  skinId: SkinId;
  className?: string;
  /**
   * Reports where the player is standing, ~8×/second.
   *
   * The canvas unmounts when the user switches to the Map or List view, so the
   * position has to live above this component or it is lost the moment you go
   * to look at the map — which is exactly when you want it.
   */
  onPose?: (pose: PlayerPose) => void;
}) {
  return <VillageScene skinId={skinId} className={className} onPose={onPose} />;
}
