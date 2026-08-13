"use client";

import { useEffect, useRef, useState } from "react";
import type { AssetSpec } from "@/frontend/lib/assets/manifest";
import { placeholderDataUri } from "@/frontend/lib/assets/placeholder";
import { cn } from "@/frontend/lib/utils";

/**
 * The ONLY way art enters the app.
 *
 * Three jobs, all mandatory:
 *
 * 1. Crisp pixels. `image-rendering: pixelated` plus a plain <img> rather than
 *    next/image — Next's sharp pipeline resamples on resize and turns pixel art
 *    into mush. This is why we do not use next/image for art. (next/image is
 *    still correct for photographs, e.g. the gallery.)
 *
 * 2. Graceful absence. The real art does not exist yet. On error we swap to a
 *    generated placeholder at the asset's exact declared dimensions, so nothing
 *    ever shows a broken-image icon and no layout shifts when files land.
 *
 * 3. Dimension policing. In dev, a delivered file whose intrinsic size differs
 *    from the manifest logs a warning — wrong-sized art is the main cause of
 *    blurry scaling and it is otherwise easy to miss.
 */

export interface PixelImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> {
  asset: AssetSpec;
  /** Label drawn on the placeholder; also the fallback alt text. */
  label: string;
  /**
   * Integer multiple of the asset's intrinsic size. Omit to size via CSS
   * (className) instead — used where the box is layout-driven, e.g. the map.
   */
  scale?: number;
  alt?: string;
}

export function PixelImage({
  asset,
  label,
  scale,
  alt,
  className,
  style,
  ...props
}: PixelImageProps) {
  // Track WHICH src failed rather than a boolean, so changing the asset
  // automatically clears the fallback without a reset effect (which would
  // trigger a cascading render).
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === asset.src;
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (failed) return;
    const el = ref.current;
    if (!el) return;

    /**
     * Catch-up check. This is NOT redundant with the onError prop.
     *
     * The server renders the real /art path into the HTML. The browser starts
     * (and often finishes) that request while parsing, i.e. BEFORE React
     * hydrates and attaches onError — so the error event fires into the void and
     * the image is stuck as a broken-image icon forever. A complete image with
     * naturalWidth === 0 is exactly that state, so we detect it on mount.
     */
    const evaluate = () => {
      if (el.complete && el.naturalWidth === 0) {
        setFailedSrc(el.getAttribute("src"));
        return;
      }
      if (
        process.env.NODE_ENV !== "production" &&
        el.naturalWidth &&
        (el.naturalWidth !== asset.w || el.naturalHeight !== asset.h)
      ) {
        console.warn(
          `[PixelImage] ${asset.src} is ${el.naturalWidth}×${el.naturalHeight} but the manifest declares ${asset.w}×${asset.h}. ` +
            `Non-matching art scales to non-integer multiples and will look blurry.`,
        );
      }
    };

    if (el.complete) evaluate();
    else {
      el.addEventListener("load", evaluate, { once: true });
      // A late failure still needs catching if hydration beat the response.
      el.addEventListener("error", evaluate, { once: true });
    }
    return () => {
      el.removeEventListener("load", evaluate);
      el.removeEventListener("error", evaluate);
    };
  }, [asset, failed]);

  const src = failed ? placeholderDataUri(asset, label) : asset.src;

  return (
    // A plain <img> is deliberate: next/image resamples through sharp, which
    // destroys pixel art. See the component doc comment.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt ?? label}
      width={asset.w}
      height={asset.h}
      draggable={false}
      onError={() => setFailedSrc(asset.src)}
      className={cn(
        asset.rendering !== "smooth" && "pixelated",
        "select-none",
        className,
      )}
      style={{
        ...(scale
          ? { width: asset.w * scale, height: asset.h * scale }
          : undefined),
        ...style,
      }}
      {...props}
    />
  );
}

/**
 * Tiled block texture as a background. Falls back to the generated placeholder
 * tile when the texture is missing, so panels still read as textured blocks
 * rather than flat rectangles.
 */
export function BlockTexture({
  asset,
  label,
  className,
  children,
  ...props
}: {
  asset: AssetSpec;
  label: string;
  className?: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === asset.src;

  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onerror = () => {
      if (!cancelled) setFailedSrc(asset.src);
    };
    probe.src = asset.src;
    return () => {
      cancelled = true;
    };
  }, [asset.src]);

  const url = failed ? placeholderDataUri(asset, label) : asset.src;

  return (
    <div
      className={cn("pixelated", className)}
      style={
        {
          backgroundImage: `url("${url}")`,
          backgroundRepeat: "repeat",
          // Integer scaling: the tile is drawn at its intrinsic size times
          // --mc-scale, never a fractional multiple.
          backgroundSize: `calc(${asset.w}px * var(--mc-scale))`,
          imageRendering: "pixelated",
        } as React.CSSProperties
      }
      aria-hidden={!children || undefined}
      {...props}
    >
      {children}
    </div>
  );
}
