"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useReducedMotion } from "@/frontend/lib/animation/use-reduced-motion";
import { markCovering } from "@/frontend/lib/animation/transition-store";
import { repo } from "@/backend/data";

/** Hard ceiling: never hang here, even if something never resolves. */
const MAX_WAIT_MS = 6000;
/** Floor: below this the screen flashes and reads as a glitch. */
const MIN_SHOW_MS = 1400;

/**
 * SCREEN 5 — "Traveling to Parallax 73%"
 *
 * The percentage is REAL. It is driven by actual preload work — the character,
 * registrations, events, achievements and world-map image — combined with an
 * eased floor so it advances smoothly instead of jumping 0 → 100.
 *
 * Two guards that matter:
 *  - it never completes before the data is ready (otherwise /world renders empty)
 *  - it never hangs (a 6s cap proceeds regardless, because a stuck loader is
 *    worse than a slightly unprepared destination)
 */
export function TravellingScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { status, session } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  // ---- preload + progress -------------------------------------------------
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "needs-character") {
      router.replace("/create-character");
      return;
    }
    if (!session) return;

    const startedAt = performance.now();
    let cancelled = false;
    let rafId = 0;

    // Real work, each step contributing to the bar.
    const steps: Array<() => Promise<unknown>> = [
      () => repo.characters.getByUser(session.userId),
      () => repo.registrations.listForUser(session.userId),
      () => repo.events.list({ status: ["published", "ongoing"] }),
      () => repo.achievements.listForUser(session.userId),
      () => repo.reference.levels(),
      () => repo.announcements.list(),
    ];

    let completed = 0;
    const total = steps.length + 1; // +1 for the map image

    const bump = () => {
      completed += 1;
    };

    // Kick off all reads plus the map preload.
    const work = Promise.all([
      ...steps.map((s) => s().then(bump).catch(bump)),
      preloadImage("/art/world/village-map.png").then(bump, bump),
    ]);

    let workDone = false;
    void work.then(() => {
      workDone = true;
    });

    const tick = () => {
      if (cancelled) return;
      const elapsed = performance.now() - startedAt;

      // Real fraction from completed work.
      const real = (completed / total) * 100;
      // Eased floor so the bar always creeps forward — a bar that sits at 0
      // while work happens reads as broken.
      const floor = Math.min(92, (elapsed / MAX_WAIT_MS) * 92);
      const next = Math.max(real, floor);

      const ready = workDone && elapsed >= MIN_SHOW_MS;
      const timedOut = elapsed >= MAX_WAIT_MS;

      if (ready || timedOut) {
        setProgress(100);
        if (!doneRef.current) {
          doneRef.current = true;
          markCovering();
          router.replace("/world");
        }
        return;
      }

      setProgress(next);
      rafId = requestAnimationFrame(tick);
    };

    if (reduced) {
      // Still wait for the data — just skip the theatre.
      void work.then(() => {
        if (cancelled || doneRef.current) return;
        doneRef.current = true;
        markCovering();
        router.replace("/world");
      });
      // And honour the cap.
      const t = setTimeout(() => {
        if (cancelled || doneRef.current) return;
        doneRef.current = true;
        markCovering();
        router.replace("/world");
      }, MAX_WAIT_MS);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [status, session, router, reduced]);

  // ---- warp tunnel --------------------------------------------------------
  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;

    /**
     * Blocks rushing outward past the camera, over a floor receding to the
     * same vanishing point.
     *
     * Canvas rather than DOM or SVG: a few hundred elements moving every frame
     * is exactly what canvas is for, and the radial light streaks come free
     * from compositing each frame over a partly-transparent wipe of the last
     * one — there is no way to get that from discrete elements.
     */
    type Block = { x: number; y: number; z: number; s: number; hot: boolean };
    const BLOCK_COUNT = 220;
    /** Vanishing point sits below centre, so the floor has room to read. */
    const HORIZON = 0.54;
    const SPEED = 0.007;
    let blocks: Block[] = [];
    let floorPhase = 0;

    const respawn = (b: Block): Block => {
      b.x = (Math.random() - 0.5) * 2;
      b.y = (Math.random() - 0.5) * 2;
      b.z = 1;
      b.s = 0.5 + Math.random() * 1.6;
      b.hot = Math.random() < 0.22;
      return b;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    blocks = Array.from({ length: BLOCK_COUNT }, () =>
      // Stagger the initial depths, or every block arrives in one wave.
      Object.assign(respawn({} as Block), { z: Math.random() }),
    );
    window.addEventListener("resize", resize);

    const draw = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h * HORIZON;

      // Partial wipe rather than a clear: what survives from previous frames
      // IS the motion streaking.
      ctx.fillStyle = "rgba(6,2,20,0.34)";
      ctx.fillRect(0, 0, w, h);

      // Ambient violet haze across the whole frame. Without it the corners sit
      // at pure black and the tunnel reads as a starfield in space rather than
      // as a lit corridor.
      const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.95);
      haze.addColorStop(0, "rgba(41,14,110,0.30)");
      haze.addColorStop(0.45, "rgba(29,10,92,0.22)");
      haze.addColorStop(1, "rgba(12,4,44,0.06)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);

      // --- floor: lines converging on the vanishing point ------------------
      floorPhase = (floorPhase + SPEED * 1.6) % 0.1;
      ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const d = 0.04 + i * 0.1 - floorPhase;
        if (d <= 0.03) continue;
        const y = cy + (h * 0.055) / d;
        if (y > h) continue;
        // Nearer rows are brighter; distant ones dissolve into the core.
        ctx.strokeStyle = `rgba(150,80,236,${Math.min(0.3, 0.035 / d)})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let i = -14; i <= 14; i++) {
        ctx.strokeStyle = "rgba(150,80,236,0.08)";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + i * w * 0.16, h);
        ctx.stroke();
      }

      // --- core bloom -------------------------------------------------------
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.38);
      bloom.addColorStop(0, "rgba(255,255,255,0.85)");
      bloom.addColorStop(0.12, "rgba(233,176,242,0.5)");
      bloom.addColorStop(0.4, "rgba(148,64,218,0.16)");
      bloom.addColorStop(1, "rgba(58,18,121,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);

      // --- blocks -----------------------------------------------------------
      for (const b of blocks) {
        b.z -= SPEED;
        if (b.z <= 0.02) respawn(b);

        const k = 0.5 / b.z;
        const px = cx + b.x * k * w * 0.5;
        const py = cy + b.y * k * h * 0.5;

        const near = 1 - b.z;
        // Integer sizes keep every block a crisp square instead of a
        // half-pixel smudge.
        const size = Math.max(2, Math.round(near * near * 20 * b.s));
        const alpha = Math.min(1, near * 1.3);

        ctx.fillStyle = b.hot
          ? `rgba(243,221,251,${alpha})`
          : `rgba(168,74,220,${alpha * 0.85})`;
        ctx.fillRect(Math.round(px - size / 2), Math.round(py - size / 2), size, size);

        // A hot inner pip on the brighter blocks, so they read as lit rather
        // than as flat swatches.
        if (b.hot && size > 6) {
          const inner = Math.max(2, Math.round(size * 0.34));
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fillRect(
            Math.round(px - inner / 2),
            Math.round(py - inner / 2),
            inner,
            inner,
          );
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  const shown = Math.round(progress);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-mc-obsidian-dark">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />

      {/* Anchored near the bottom, as in the reference — centring it would put
          the panel over the vanishing point, which is the whole image. */}
      <div className="absolute bottom-[10%] z-10 w-full max-w-[420px] px-[calc(var(--mc-unit)*2)]">
        <div className="border-[length:var(--mc-bevel)] border-mc-obsidian-light bg-mc-obsidian/80 p-[calc(var(--mc-unit)*1.5)]">
          <div className="flex items-baseline justify-between gap-[var(--mc-unit)]">
            <p className="font-pixel text-[10px] uppercase tracking-[0.08em] text-white md:text-[11px]">
              Traveling to Parallax
            </p>
            <span className="font-pixel text-[11px] text-mc-portal-light tabular-nums">
              {shown}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={shown}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Loading the realm"
            className="mt-[var(--mc-unit)] h-[calc(var(--mc-unit)*1.25)] w-full overflow-hidden bg-mc-obsidian-dark bevel-inset"
          >
            <div
              className="h-full origin-left bg-mc-portal-light transition-transform duration-150 ease-out"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Resolves either way: a missing map must not block entry to the realm. */
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}
