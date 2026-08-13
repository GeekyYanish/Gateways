"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { BlockButton } from "@/frontend/components/mc";
import { cn } from "@/frontend/lib/utils";

// Min is well below 1 because "fit a ~3000px-wide map into a phone viewport"
// legitimately needs ~0.15.
const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;
/** Pixels moved per arrow-key press, before scale. */
const KEY_PAN = 80;

export interface WorldViewportHandle {
  /**
   * Ease the map so a point (in map percentages) sits at the viewport centre.
   * `zoom` is absolute; omit it to keep the current scale.
   */
  focusOn: (xPct: number, yPct: number, zoom?: number) => void;
  reset: () => void;
}

/**
 * Pannable, zoomable map surface.
 *
 * Pointer Events (not separate mouse/touch handlers) so drag works identically
 * with a mouse, a finger and a stylus, and `setPointerCapture` keeps the drag
 * alive when the cursor leaves the element.
 *
 * Two-finger pinch is handled by tracking two active pointers and comparing
 * their distance — cheaper and more predictable than wiring a gesture library
 * for one interaction.
 *
 * Children are positioned by percentage (see Signpost), so they track the map
 * through pan and zoom without any per-child maths here.
 *
 * **Keyboard is a first-class input**, not an afterthought: the surface is
 * focusable, arrows pan, +/− zoom and 0 resets. The markers inside are real
 * links in the tab order. The previous version marked this whole subtree
 * `aria-hidden` while it contained focusable links — assistive tech then
 * announces nothing for an element the user can still tab into, which is worse
 * than either exposing or removing it.
 */
export const WorldViewport = forwardRef<
  WorldViewportHandle,
  {
    children?: React.ReactNode;
    className?: string;
    /** Rendered beneath the children, inside the transformed surface. */
    map?: React.ReactNode;
    /**
     * Map size in pixels.
     *
     * Props rather than module constants, because the map has more than one
     * projection and they are very different shapes. As imports they were baked
     * into this component's callbacks and into a `[]`-dep fit effect, so
     * switching projection kept the previous mode's scale and clamp — the map
     * did not error, it just silently framed the wrong thing.
     */
    mapW: number;
    mapH: number;
    /** Reports the live scale so markers can counter-scale. */
    onScaleChange?: (scale: number) => void;
    /** Clicking empty terrain — used to clear the selection. */
    onBackgroundClick?: () => void;
  }
>(function WorldViewport(
  { children, className, map, mapW, mapH, onScaleChange, onBackgroundClick },
  ref,
) {
  const surface = useRef<HTMLDivElement>(null);
  // 0 means "not measured yet"; the fit effect sets the real value before paint.
  const [scale, setScale] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const fitScale = useRef(1);
  /**
   * Mirror of `scale` for the pointer handlers. They are deliberately
   * dependency-free so React does not rebuild them mid-drag; reading the live
   * scale through a ref keeps the clamp correct without that churn.
   */
  const scaleRef = useRef(1);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  /** Set on pointerdown, cleared once the pointer travels — see onPointerUp. */
  const movedRef = useRef(false);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  /**
   * Keep the map covering the viewport.
   *
   * Without this, centring on an edge location — or dragging past the corner —
   * slides the island off and leaves a dead band of page background inside the
   * frame, which reads as a rendering fault. When the map is *smaller* than the
   * viewport on an axis the only sensible position is centred, so the clamp
   * collapses to zero there rather than allowing free movement.
   */
  const clampOffset = useCallback(
    (o: { x: number; y: number }, s: number) => {
      const el = surface.current;
      if (!el) return o;
      const maxX = Math.max(0, (mapW * s - el.clientWidth) / 2);
      const maxY = Math.max(0, (mapH * s - el.clientHeight) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, o.x)),
        y: Math.min(maxY, Math.max(-maxY, o.y)),
      };
    },
    [mapW, mapH],
  );

  // Re-clamp after a zoom: zooming out shrinks the allowed pan range, so an
  // offset that was legal a moment ago can now expose an edge.
  useEffect(() => {
    if (!scale) return;
    setOffset((o) => {
      const c = clampOffset(o, scale);
      return c.x === o.x && c.y === o.y ? o : c;
    });
  }, [scale, clampOffset]);

  useEffect(() => {
    if (!scale) return;
    scaleRef.current = scale;
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  /** Last map size the fit ran against, so a projection change can re-frame. */
  const fittedTo = useRef("");

  /**
   * Fit the whole map into the viewport on mount, on resize, and whenever the
   * map itself changes shape.
   *
   * Without this the map renders at 1:1 (~3000px wide) and the outer markers
   * sit off-screen, so several locations are simply unreachable until the user
   * discovers they can drag. Measured with a ResizeObserver rather than a
   * one-shot read so it stays correct when the pane or window changes.
   */
  useEffect(() => {
    const el = surface.current;
    if (!el) return;

    const fit = () => {
      const { clientWidth: vw, clientHeight: vh } = el;
      if (!vw || !vh) return;
      // 0.94 leaves a small margin so edge markers are not flush to the bezel.
      const contain = Math.min(vw / mapW, vh / mapH) * 0.94;
      const cover = Math.max(vw / mapW, vh / mapH) * 0.94;
      /**
       * Contain by default — seeing the whole place at once is the point of a
       * map. But on a narrow portrait viewport containing a 1.6:1 map means
       * fitting it to the width, which shrinks the plan to a third of the
       * screen and strands it in a field of empty background. Below a
       * legibility floor, cover instead and let the user pan; the offset clamp
       * keeps the frame full either way.
       */
      const next = contain < 0.3 ? Math.min(cover, 0.55) : contain;
      fitScale.current = clampScale(next);

      /**
       * Re-frame when the MAP changed shape, not when the window did.
       *
       * The two projections have very different aspect ratios, so a scale that
       * framed one leaves the other half off-screen. On a plain resize the
       * user's own zoom is still theirs to keep.
       */
      const dims = `${mapW}x${mapH}`;
      const reshaped = fittedTo.current !== dims;
      fittedTo.current = dims;
      if (reshaped) setOffset({ x: 0, y: 0 });
      setScale((current) => (current === 0 || reshaped ? fitScale.current : current));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapW, mapH]);

  const reset = useCallback(() => {
    setAnimating(true);
    setScale(fitScale.current);
    setOffset({ x: 0, y: 0 });
  }, []);

  /**
   * Centre a map coordinate. The offset is applied AFTER the scale in the
   * transform below, so the delta from map-centre has to be pre-multiplied by
   * the target scale — using the current scale here makes the map land short
   * whenever focusing also changes the zoom.
   */
  const focusOn = useCallback(
    (xPct: number, yPct: number, zoom?: number) => {
      const target = zoom ? clampScale(zoom) : 0;
      setScale((current) => {
        const s = target || current || fitScale.current;
        setOffset(
          clampOffset(
            {
              x: -((xPct / 100) * mapW - mapW / 2) * s,
              y: -((yPct / 100) * mapH - mapH / 2) * s,
            },
            s,
          ),
        );
        return s;
      });
      setAnimating(true);
    },
    [clampOffset, mapW, mapH],
  );

  useImperativeHandle(ref, () => ({ focusOn, reset }), [focusOn, reset]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Never start a drag from a marker — that would swallow its click.
      if ((e.target as HTMLElement).closest("a,button")) return;

      movedRef.current = false;
      setAnimating(false);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      e.currentTarget.setPointerCapture(e.pointerId);

      if (pointers.current.size === 1) {
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      } else if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
        setDragging(false);
      }
    },
    [offset.x, offset.y, scale],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setScale(clampScale(pinchStart.current.scale * (dist / pinchStart.current.dist)));
      return;
    }

    if (dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      // A few pixels of slop, so a click with a shaky hand still counts as a
      // click and does not silently become a no-op drag.
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
      setOffset(
        clampOffset(
          { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy },
          scaleRef.current,
        ),
      );
    }
  }, [clampOffset]);

  const endPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const wasTracking = pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinchStart.current = null;
      if (pointers.current.size === 0) {
        setDragging(false);
        dragStart.current = null;
        // A tap on bare terrain clears the selection; a drag must not.
        if (
          wasTracking &&
          !movedRef.current &&
          e.type === "pointerup" &&
          !(e.target as HTMLElement).closest("a,button")
        ) {
          onBackgroundClick?.();
        }
      }
    },
    [onBackgroundClick],
  );

  // Ctrl/⌘ + wheel zooms (the platform convention); plain wheel scrolls the page.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setAnimating(false);
      setScale((s) => clampScale(s - e.deltaY * 0.002));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Let the markers inside handle their own keys.
      if ((e.target as HTMLElement).closest("a,button")) return;
      const step = KEY_PAN;
      const pan = (dx: number, dy: number) => {
        e.preventDefault();
        setAnimating(true);
        setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, scaleRef.current));
      };
      switch (e.key) {
        case "ArrowLeft": return pan(step, 0);
        case "ArrowRight": return pan(-step, 0);
        case "ArrowUp": return pan(0, step);
        case "ArrowDown": return pan(0, -step);
        case "+":
        case "=":
          e.preventDefault();
          setAnimating(true);
          return setScale((s) => clampScale(s + 0.25));
        case "-":
        case "_":
          e.preventDefault();
          setAnimating(true);
          return setScale((s) => clampScale(s - 0.25));
        case "0":
          e.preventDefault();
          return reset();
      }
    },
    [reset, clampOffset],
  );

  return (
    <div className={cn("relative overflow-hidden bg-mc-obsidian bevel-inset", className)}>
      <div
        ref={surface}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onKeyDown={onKeyDown}
        onDoubleClick={() => {
          setAnimating(true);
          setScale((s) => clampScale(s + 0.5));
        }}
        tabIndex={0}
        role="group"
        aria-label="Village map. Arrow keys pan, plus and minus zoom, zero resets."
        className={cn(
          "absolute inset-0 touch-none outline-none",
          "focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-mc-gold",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            width: mapW,
            height: mapH,
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale || 0.2})`,
            // Only ease for programmatic moves. Easing a drag makes the map lag
            // behind the finger; easing a pinch makes it feel like syrup.
            transition: animating && !dragging ? "transform 320ms cubic-bezier(0.2,0.8,0.2,1)" : "none",
            // Hidden for the one frame before the fit scale is measured, so the
            // map never flashes at 1:1.
            opacity: scale === 0 ? 0 : 1,
          }}
        >
          {map}
          {children}
        </div>
      </div>

      {/* Zoom controls. Real buttons so the map is usable without a trackpad. */}
      <div className="absolute bottom-[var(--mc-unit)] right-[var(--mc-unit)] z-20 flex gap-[3px]">
        <BlockButton
          size="icon"
          variant="ghost"
          aria-label="Zoom out"
          onClick={() => {
            setAnimating(true);
            setScale((s) => clampScale(s - 0.25));
          }}
        >
          −
        </BlockButton>
        <BlockButton
          size="icon"
          variant="ghost"
          aria-label="Zoom in"
          onClick={() => {
            setAnimating(true);
            setScale((s) => clampScale(s + 0.25));
          }}
        >
          +
        </BlockButton>
        <BlockButton size="sm" variant="ghost" onClick={reset}>
          Reset
        </BlockButton>
      </div>

      <p className="pointer-events-none absolute bottom-[var(--mc-unit)] left-[var(--mc-unit)] z-20 text-[14px] text-mc-text-dim">
        Drag to pan · ⌘-scroll or pinch to zoom · arrows when focused
      </p>
    </div>
  );
});
