"use client";

import { useEffect, useRef, useState } from "react";
import type { InputState } from "./player-controller";

/**
 * Virtual joystick for touch devices.
 *
 * Shown only when the device actually reports coarse pointer input, rather than
 * on a width breakpoint — a small laptop window is not a touchscreen, and a
 * large tablet is.
 *
 * Writes straight into the shared input ref, so joystick movement never
 * triggers a React render.
 */
export function TouchControls({
  input,
  onMove,
  onJump,
}: {
  input: React.RefObject<InputState>;
  onMove?: () => void;
  onJump?: () => void;
}) {
  const [isTouch, setIsTouch] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const padRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);

  useEffect(() => {
    // Pointer-capability probe: a browser API with no SSR equivalent, so it
    // cannot move into a lazy initialiser without a hydration mismatch. Runs
    // once and settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    if (!isTouch) return;
    const pad = padRef.current;
    if (!pad) return;

    const RADIUS = 46;

    const update = (clientX: number, clientY: number) => {
      const r = pad.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;

      const dist = Math.hypot(dx, dy);
      if (dist > RADIUS) {
        dx = (dx / dist) * RADIUS;
        dy = (dy / dist) * RADIUS;
      }
      setKnob({ x: dx, y: dy });

      if (input.current) {
        input.current.right = dx / RADIUS;
        // Screen-up is forward, so the Y axis inverts.
        input.current.forward = -dy / RADIUS;
      }
      onMove?.();
    };

    const down = (e: PointerEvent) => {
      activeId.current = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      update(e.clientX, e.clientY);
    };
    const move = (e: PointerEvent) => {
      if (activeId.current !== e.pointerId) return;
      e.preventDefault();
      update(e.clientX, e.clientY);
    };
    const end = (e: PointerEvent) => {
      if (activeId.current !== e.pointerId) return;
      activeId.current = null;
      setKnob({ x: 0, y: 0 });
      if (input.current) {
        input.current.forward = 0;
        input.current.right = 0;
      }
    };

    pad.addEventListener("pointerdown", down);
    pad.addEventListener("pointermove", move, { passive: false });
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
    return () => {
      pad.removeEventListener("pointerdown", down);
      pad.removeEventListener("pointermove", move);
      pad.removeEventListener("pointerup", end);
      pad.removeEventListener("pointercancel", end);
    };
  }, [isTouch, input, onMove]);

  if (!isTouch) return null;

  return (
    <>
      <div
        ref={padRef}
        // Decorative duplicate of the keyboard controls — the list view is the
        // accessible path, so this is hidden from assistive tech.
        aria-hidden
        className="absolute bottom-[calc(var(--mc-unit)*2)] left-[calc(var(--mc-unit)*2)] grid h-[112px] w-[112px] place-items-center rounded-full bg-mc-panel/55 backdrop-blur-[2px]"
        style={{ touchAction: "none" }}
      >
        <span
          className="pointer-events-none block h-[46px] w-[46px] rounded-full bg-mc-portal-light/85 shadow-[0_0_10px_rgba(201,100,255,0.6)]"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      <p
        aria-hidden
        className="pointer-events-none absolute bottom-[calc(var(--mc-unit)*0.5)] left-[calc(var(--mc-unit)*2)] w-[112px] text-center font-pixel text-[7px] uppercase text-mc-text-dim"
      >
        Move · drag screen to look
      </p>

      {/* Jump. Touch devices have no Space key, so the control has to exist on
          screen or jumping is simply unavailable there. */}
      <button
        type="button"
        aria-label="Jump"
        onPointerDown={(e) => {
          e.preventDefault();
          onJump?.();
          onMove?.();
        }}
        className="absolute bottom-[calc(var(--mc-unit)*3)] right-[calc(var(--mc-unit)*2)] grid h-[76px] w-[76px] place-items-center rounded-full bg-mc-emerald/85 font-pixel text-[10px] uppercase text-mc-obsidian active:brightness-110"
        style={{ touchAction: "none" }}
      >
        Jump
      </button>
    </>
  );
}
