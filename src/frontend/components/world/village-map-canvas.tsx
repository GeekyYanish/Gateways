"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAP_H,
  MAP_W,
  renderVillageMap,
  type MappedAnchor,
} from "@/frontend/lib/world/village-map-art";
import { cn } from "@/frontend/lib/utils";

/**
 * The village, drawn once into a canvas.
 *
 * Deliberately NOT redrawn on pan or zoom: the parent viewport CSS-transforms
 * this element, so the browser scales the already-rasterised bitmap on the
 * compositor. Re-rendering ~12k cubes per frame to get sharper edges would
 * trade a smooth 60fps drag for a slideshow.
 *
 * The draw is deferred one frame past mount. It is a few hundred milliseconds
 * of synchronous canvas work, and running it during the commit would hold up
 * first paint on the whole route — this way the layout, labels and controls are
 * on screen first and the terrain fades in under them.
 */
export function VillageMapCanvas({
  onAnchors,
  className,
}: {
  /** Called once with the label positions, as percentages of the map. */
  onAnchors?: (anchors: MappedAnchor[]) => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  // Latched in an effect rather than assigned during render: writing a ref in
  // the render body is not safe under concurrent rendering, which may run a
  // render that is later discarded. The draw effect below reads it, and both
  // effects flush in order, so the callback is always current by the time it
  // is used.
  const cb = useRef(onAnchors);
  useEffect(() => {
    cb.current = onAnchors;
  }, [onAnchors]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;

    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const { anchors } = renderVillageMap(canvas);
      cb.current?.(anchors);
      setDrawn(true);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      width={MAP_W}
      height={MAP_H}
      // Decorative: every location on it is also a real focusable link, and the
      // List view carries the same content as text.
      aria-hidden
      className={cn(
        "pixelated block h-full w-full select-none",
        "transition-opacity duration-500",
        drawn ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
