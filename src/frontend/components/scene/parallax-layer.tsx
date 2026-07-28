"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "@/frontend/lib/animation/gsap-init";
import { sceneLayerPlaceholder } from "@/frontend/lib/assets/placeholder";
import { paintSceneLayer } from "@/frontend/lib/assets/scene-art";
import type { SceneLayer } from "@/frontend/lib/assets/scenes";
import { cn } from "@/frontend/lib/utils";

/**
 * One depth-offset layer of a parallax scene.
 *
 * Deliberately dumb: it renders an image and exposes `applyOffset` through a
 * ref so the parent `AnimatedBackground` can drive every layer from ONE pointer
 * listener. A per-layer listener would mean N listeners and N independent GSAP
 * tweens fighting for the same frame budget on a page with eight layers.
 *
 * Art resolution has two modes, and the probe runs in opposite directions:
 *
 * - **Placeholder layers** (no `paint`): show `layer.src` optimistically and
 *   fall back to a generated silhouette on error. The silhouette is a stand-in
 *   that says "art pending", so it should appear only once the file is known
 *   to be missing.
 * - **Painted layers** (`paint` set): show the generated art *first* and swap
 *   to `layer.src` only once the probe confirms a real file loaded. Painted art
 *   is the intended render, not a fallback — probing first would flash an empty
 *   layer on every load.
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
  // The probed src is stored alongside the verdict rather than reset in the
  // effect body: clearing state synchronously on mount is a cascading render,
  // and comparing keys gets the same staleness guarantee for free.
  const [probed, setProbed] = useState<{
    src: string;
    status: "delivered" | "missing";
  } | null>(null);

  // Deterministic, so the server and client render byte-identical markup.
  const painted = useMemo(
    () =>
      layer.paint
        ? paintSceneLayer(layer.paint, layer.w, layer.h, `${sceneKey}-${layer.key}`)
        : null,
    [layer.paint, layer.w, layer.h, layer.key, sceneKey],
  );

  // Probe the real asset. `onload` matters as much as `onerror` here: it is
  // what lets a delivered PNG take over from generated art.
  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setProbed({ src: layer.src, status: "delivered" });
    };
    probe.onerror = () => {
      if (!cancelled) setProbed({ src: layer.src, status: "missing" });
    };
    probe.src = layer.src;
    return () => {
      cancelled = true;
    };
  }, [layer.src]);

  const status = probed?.src === layer.src ? probed.status : "pending";

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

  let url: string;
  if (status === "delivered") {
    url = layer.src;
  } else if (painted) {
    url = painted;
  } else if (status === "missing") {
    url = sceneLayerPlaceholder({
      key: `${sceneKey}-${layer.key}`,
      layer: layer.layer,
      w: layer.w,
      h: layer.h,
      tile: layer.tile,
      palette,
    });
  } else {
    url = layer.src;
  }

  // Layers are oversized and centred so translating them never exposes an edge.
  // Travel is capped at 60px × depth horizontally and 36px × depth vertically,
  // so a few percent already clears the largest possible shift several times
  // over — the margin only has to hide the pan, and every extra percent is a
  // percent of the art cropped away.
  //
  // Edge-anchored layers get a tighter margin still: they are positioned
  // against a viewport edge, so overscan pushes them off-screen rather than
  // merely zooming them.
  const anchored = Boolean(layer.anchor && !layer.anchor.startsWith("center"));
  const overscan = anchored ? 1.5 + layer.depth * 4 : 2.5 + layer.depth * 7;

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
        backgroundPosition:
          layer.anchor ?? (layer.layer === "fore" ? "center bottom" : "center"),
        backgroundSize: layer.fit ?? (layer.tile ? "auto 100%" : "cover"),
        // Pixel art must not be smoothed when scaled to cover the viewport.
        imageRendering: "pixelated",
      }}
    />
  );
}
