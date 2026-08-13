"use client";

import { PixelImage } from "@/frontend/components/mc";
import type { AssetSpec } from "@/frontend/lib/assets/manifest";
import { cn } from "@/frontend/lib/utils";

/**
 * Set dressing: the creatures and props that make the page feel like a place
 * rather than a document.
 *
 * Everything here is DECORATIVE by definition. That is not a stylistic note, it
 * is the contract:
 *
 *  - `aria-hidden` always, never optional. A screen-reader user hearing "torch,
 *    sapling, glowmite" between every heading is being given noise, not scenery.
 *  - `pointer-events-none` always. These are positioned over real content and
 *    would otherwise eat clicks meant for the panel underneath.
 *  - Nothing may affect layout. Props are absolutely positioned inside a
 *    <DecorLayer>, so a missing or late-loading sprite cannot shift the page.
 *
 * Art still routes through `<PixelImage>` and the manifest, so every one of
 * these renders a correctly-sized generated placeholder until the real file
 * lands — the whole point of adding them before the art exists.
 */

export interface PixelDecorProps {
  asset: AssetSpec;
  /** Manifest key. Drawn on the placeholder; never announced. */
  label: string;
  /** Integer multiple of the asset's intrinsic size. */
  scale?: number;
  /** Bob gently on the spot. */
  float?: boolean;
  /**
   * Offsets the float cycle, in seconds. Two sprites bobbing in lockstep read
   * as one animated strip; a fraction of a second apart reads as two creatures.
   */
  delay?: number;
  /** Mirrors the sprite. Manifest art faces right at rest. */
  flip?: boolean;
  className?: string;
  /** For values Tailwind cannot generate a class for, e.g. a data-driven `left: 34%`. */
  style?: React.CSSProperties;
}

export function PixelDecor({
  asset,
  label,
  scale = 2,
  float = false,
  delay = 0,
  flip = false,
  className,
  style,
}: PixelDecorProps) {
  return (
    <PixelImage
      asset={asset}
      label={label}
      scale={scale}
      alt=""
      aria-hidden
      className={cn(
        "pointer-events-none select-none",
        // `float` is the token-defined keyframe in globals.css. It returns to
        // its origin at 0% and 100%, so the reduced-motion override (which
        // snaps every animation to its last frame) leaves these resting exactly
        // where they are laid out — no branch needed here.
        float && "animate-float",
        flip && "scale-x-[-1]",
        className,
      )}
      style={{
        ...(float && delay ? { animationDelay: `${delay}s` } : null),
        ...style,
      }}
    />
  );
}

/**
 * The positioning context decor sits in.
 *
 * Deliberately NOT `overflow-hidden`. Props are offset OUTWARD, into the page
 * margin beside the content column, because a torch overlapping a paragraph
 * reads as a rendering fault rather than as scenery. Clipping to the section
 * would cut every one of them in half.
 *
 * Nothing can escape horizontally as a result: `body { overflow-x: hidden }` in
 * globals.css already stops a negatively-offset child from widening the
 * document. The call sites gate on `xl` so the margin they sit in exists.
 *
 * `absolute inset-0` requires the parent to be positioned — `HomeSection` sets
 * `relative` for exactly this.
 */
export function DecorLayer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
