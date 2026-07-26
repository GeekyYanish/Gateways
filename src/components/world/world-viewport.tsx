"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BlockButton } from "@/components/mc";
import { ART } from "@/lib/assets/manifest";
import { worldMapPlaceholder } from "@/lib/assets/placeholder";
import { WORLD_LOCATIONS } from "@/lib/world/world-locations";
import { cn } from "@/lib/utils";

// Min is well below 1 because "fit a 2048×1152 map into a phone viewport"
// legitimately needs ~0.18.
const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;

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
 */
export function WorldViewport({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const surface = useRef<HTMLDivElement>(null);
  // 0 means "not measured yet"; the fit effect sets the real value before paint.
  const [scale, setScale] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const fitScale = useRef(1);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // The real map may not exist yet; fall back to the generated placeholder,
  // which draws the hotspots so the map is explorable pre-art.
  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onerror = () => {
      if (!cancelled) setMapFailed(true);
    };
    probe.src = ART.world.map.src;
    return () => {
      cancelled = true;
    };
  }, []);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  /**
   * Fit the whole map into the viewport on mount and on resize.
   *
   * Without this the map renders at 1:1 (2048px wide) and the outer signposts
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
      // 0.94 leaves a small margin so edge signposts are not flush to the bezel.
      const next = Math.min(vw / ART.world.map.w, vh / ART.world.map.h) * 0.94;
      fitScale.current = clampScale(next);
      // Only snap the view when the user has not zoomed away from the fit.
      setScale((current) => (current === 0 ? fitScale.current : current));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Never start a drag from a signpost — that would swallow its click.
    if ((e.target as HTMLElement).closest("a,button")) return;

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
  }, [offset.x, offset.y, scale]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size >= 2 && pinchStart.current) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        setScale(clampScale(pinchStart.current.scale * (dist / pinchStart.current.dist)));
        return;
      }

      if (dragStart.current) {
        setOffset({
          x: dragStart.current.ox + (e.clientX - dragStart.current.x),
          y: dragStart.current.oy + (e.clientY - dragStart.current.y),
        });
      }
    },
    [],
  );

  const endPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      setDragging(false);
      dragStart.current = null;
    }
  }, []);

  // Ctrl/⌘ + wheel zooms (the platform convention); plain wheel scrolls the page.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setScale((s) => clampScale(s - e.deltaY * 0.002));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Reset returns to the FITTED scale, not 1 — at 1:1 the outer signposts are
  // off-screen, which is not a sensible "reset" state.
  const reset = () => {
    setScale(fitScale.current);
    setOffset({ x: 0, y: 0 });
  };

  const mapSrc = mapFailed
    ? worldMapPlaceholder(
        ART.world.map.w,
        ART.world.map.h,
        WORLD_LOCATIONS.map((l) => ({ label: l.label, x: l.x, y: l.y })),
      )
    : ART.world.map.src;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-mc-obsidian bevel-inset",
        className,
      )}
    >
      <div
        ref={surface}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        className={cn(
          "absolute inset-0 touch-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        // The interactive signposts inside are the accessible path; the drag
        // surface itself is a pointer affordance, and the List view is the
        // keyboard/screen-reader equivalent.
        aria-hidden
      >
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            width: ART.world.map.w,
            height: ART.world.map.h,
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale || 0.2})`,
            // No transition while dragging, or the map lags behind the finger.
            transition: dragging ? "none" : "transform 160ms ease-out",
            // Hidden for the one frame before the fit scale is measured, so the
            // map never flashes at 1:1.
            opacity: scale === 0 ? 0 : 1,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapSrc}
            alt=""
            width={ART.world.map.w}
            height={ART.world.map.h}
            draggable={false}
            className="pixelated absolute inset-0 h-full w-full select-none"
            onError={() => setMapFailed(true)}
          />
          {children}
        </div>
      </div>

      {/* Zoom controls. Real buttons so the map is usable without a trackpad. */}
      <div className="absolute bottom-[var(--mc-unit)] right-[var(--mc-unit)] z-20 flex gap-[3px]">
        <BlockButton
          size="icon"
          variant="ghost"
          aria-label="Zoom out"
          onClick={() => setScale((s) => clampScale(s - 0.25))}
        >
          −
        </BlockButton>
        <BlockButton
          size="icon"
          variant="ghost"
          aria-label="Zoom in"
          onClick={() => setScale((s) => clampScale(s + 0.25))}
        >
          +
        </BlockButton>
        <BlockButton size="sm" variant="ghost" onClick={reset}>
          Reset
        </BlockButton>
      </div>

      <p className="absolute bottom-[var(--mc-unit)] left-[var(--mc-unit)] z-20 text-[14px] text-mc-text-dim">
        Drag to pan · pinch or ⌘-scroll to zoom
      </p>
    </div>
  );
}
