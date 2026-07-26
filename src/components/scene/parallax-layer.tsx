"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/animation/gsap-init";
import { sceneLayerPlaceholder } from "@/lib/assets/placeholder";
import type { SceneLayer } from "@/lib/assets/scenes";
import { cn } from "@/lib/utils";

/**
 * One depth-offset layer of a parallax scene.
 *
 * Deliberately dumb: it renders an image and exposes `applyOffset` through a
 * ref so the parent `AnimatedBackground` can drive every layer from ONE pointer
 * listener. A per-layer listener would mean N listeners and N independent GSAP
 * tweens fighting for the same frame budget on a page with eight layers.
 *
 * Falls back to a generated silhouette placeholder when the art is missing, so
 * depth ordering is visible and tunable before any files are delivered.
 */

export interface ParallaxLayerHandle {
  applyOffset: (x: number, y: number) => void;
}

export function ParallaxLayer({
  layer,
  sceneKey,
  palette,
  handleRef,
  className,
}: {
  layer: SceneLayer;
  sceneKey: string;
  /** Scene palette, so the placeholder matches the scene's colour direction. */
  palette?: [string, string];
  handleRef?: (h: ParallaxLayerHandle | null) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Probe the real asset; swap to the placeholder only if it is genuinely absent.
  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    probe.src = layer.src;
    return () => {
      cancelled = true;
    };
  }, [layer.src]);

  // Publish the imperative handle. Offsets are applied via gsap.quickTo, which
  // reuses a single tween per property instead of allocating one per pointer
  // move — that difference is what keeps eight layers at 60fps.
  useEffect(() => {
    const node = el.current;
    if (!node || !handleRef) return;

    const xTo = gsap.quickTo(node, "x", { duration: 0.5, ease: "power2.out" });
    const yTo = gsap.quickTo(node, "y", { duration: 0.5, ease: "power2.out" });

    handleRef({
      applyOffset: (x, y) => {
        xTo(x * layer.depth);
        yTo(y * layer.depth);
      },
    });

    return () => handleRef(null);
  }, [handleRef, layer.depth]);

  const url = failed
    ? sceneLayerPlaceholder({
        key: `${sceneKey}-${layer.key}`,
        layer: layer.layer,
        w: layer.w,
        h: layer.h,
        tile: layer.tile,
        palette,
      })
    : layer.src;

  // Layers are oversized and centred so translating them never exposes an edge.
  const overscan = 8 + layer.depth * 14;

  return (
    <div
      ref={el}
      aria-hidden
      data-parallax-layer={layer.key}
      className={cn("pointer-events-none absolute", className)}
      style={{
        inset: `-${overscan}%`,
        opacity: layer.opacity ?? 1,
        mixBlendMode: layer.blend ?? "normal",
        backgroundImage: `url("${url}")`,
        backgroundRepeat: layer.tile ? "repeat-x" : "no-repeat",
        backgroundPosition: layer.layer === "fore" ? "center bottom" : "center",
        backgroundSize: layer.tile ? "auto 100%" : "cover",
        // Pixel art must not be smoothed when scaled to cover the viewport.
        imageRendering: "pixelated",
        willChange: "transform",
      }}
    />
  );
}
