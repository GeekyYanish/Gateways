"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { useReducedMotion } from "@/lib/animation/use-reduced-motion";
import { markCovering } from "@/lib/animation/transition-store";
import { repo } from "@/lib/data";

/** Hard ceiling: never hang here, even if something never resolves. */
const MAX_WAIT_MS = 6000;
/** Floor: below this the screen flashes and reads as a glitch. */
const MIN_SHOW_MS = 1400;

/**
 * SCREEN 5 — "Traveling to Fest Realm 73%"
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

    // Star field streaking outward from the centre — cheap, and reads as speed.
    type Star = { x: number; y: number; z: number };
    const STAR_COUNT = 220;
    let stars: Star[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: Math.random(),
      }));
    };

    resize();
    seed();
    window.addEventListener("resize", resize);

    const draw = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      ctx.fillStyle = "rgba(11,7,16,0.35)";
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        s.z -= 0.012;
        if (s.z <= 0.02) {
          s.x = (Math.random() - 0.5) * 2;
          s.y = (Math.random() - 0.5) * 2;
          s.z = 1;
        }

        const k = 0.5 / s.z;
        const px = cx + s.x * k * w * 0.5;
        const py = cy + s.y * k * h * 0.5;

        const kPrev = 0.5 / Math.min(1, s.z + 0.05);
        const pxPrev = cx + s.x * kPrev * w * 0.5;
        const pyPrev = cy + s.y * kPrev * h * 0.5;

        const size = Math.max(1, (1 - s.z) * 3);
        ctx.strokeStyle = `rgba(201,100,255,${Math.min(1, 1 - s.z)})`;
        ctx.lineWidth = size;
        ctx.beginPath();
        ctx.moveTo(pxPrev, pyPrev);
        ctx.lineTo(px, py);
        ctx.stroke();
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
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-mc-void">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />

      <div className="relative z-10 w-full max-w-[420px] px-[calc(var(--mc-unit)*2)]">
        <div className="bg-mc-panel/90 border-[length:var(--mc-bevel)] border-mc-border bevel p-[calc(var(--mc-unit)*1.5)] [--bevel-light:var(--color-mc-panel-light)] [--bevel-dark:var(--color-mc-panel-dark)]">
          <div className="flex items-baseline justify-between gap-[var(--mc-unit)]">
            <p className="font-pixel text-[11px] uppercase text-mc-text">
              Traveling to Fest Realm
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
            className="mt-[var(--mc-unit)] h-[calc(var(--mc-unit)*1.25)] w-full overflow-hidden bg-mc-slot bevel-inset"
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
