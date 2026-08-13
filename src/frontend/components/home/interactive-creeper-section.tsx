"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PixelImage } from "@/frontend/components/mc";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { useReducedMotion } from "@/frontend/lib/animation/use-reduced-motion";
import { ART } from "@/frontend/lib/assets/manifest";

interface CreeperParticle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  colour: string;
  phase: number;
}

interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

interface BlastState {
  x: number;
  y: number;
  radius: number;
  active: boolean;
}

/**
 * A standalone encounter immediately after the existing hero.
 *
 * The supplied creeper render is sampled into a few thousand coloured squares
 * on an ordinary 2D canvas. The pointer pushes nearby blocks aside and a press
 * sends a larger square shockwave through the figure before the spring physics
 * pull everything home. It borrows the idea of a responsive particle-built
 * subject without copying the reference site's space aesthetic.
 *
 * The canvas never captures pointer events, so this remains harmless scenery:
 * it cannot interfere with scrolling, the nav, or keyboard interaction.
 */
export function InteractiveCreeperSection() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sourceImage = useRef<HTMLImageElement | null>(null);
  const particles = useRef<CreeperParticle[]>([]);
  const pointer = useRef<PointerState>({ x: 0, y: 0, active: false });
  const blast = useRef<BlastState>({ x: 0, y: 0, radius: 0, active: false });
  const visible = useRef(false);
  const [sourceReady, setSourceReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const image = new Image();
    image.decoding = "async";
    image.src = ART.home.creeper.src;
    image.onload = () => {
      sourceImage.current = image;
      setSourceReady(true);
    };
    image.onerror = () => setSourceReady(false);
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  const rebuildParticles = useCallback(() => {
    const host = root.current;
    const surface = canvas.current;
    const image = sourceImage.current;
    if (!host || !surface || !image) return;

    const bounds = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    surface.width = Math.round(width * dpr);
    surface.height = Math.round(height * dpr);

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = image.naturalWidth;
    sampleCanvas.height = image.naturalHeight;
    const sampleContext = sampleCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!sampleContext) return;
    sampleContext.drawImage(image, 0, 0);
    const pixels = sampleContext.getImageData(
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
    ).data;

    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const displayHeight = Math.min(
      height * (width < 640 ? 0.66 : 0.76),
      680,
    );
    const displayWidth = displayHeight * sourceRatio;
    const centreX = width * (width >= 900 ? 0.6 : 0.5);
    const originX = centreX - displayWidth / 2;
    const originY = (height - displayHeight) / 2 + height * 0.035;
    const sourceStep = width < 640 ? 8 : 6;
    const scale = displayHeight / image.naturalHeight;
    const squareSize = Math.max(2.5, sourceStep * scale * 0.78);
    const next: CreeperParticle[] = [];

    for (let sy = 0; sy < image.naturalHeight; sy += sourceStep) {
      for (let sx = 0; sx < image.naturalWidth; sx += sourceStep) {
        const index = (sy * image.naturalWidth + sx) * 4;
        const alpha = pixels[index + 3];
        if (alpha < 40) continue;

        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const baseX = originX + sx * scale;
        const baseY = originY + sy * scale;
        next.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          vx: 0,
          vy: 0,
          size: squareSize,
          colour: `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha / 220)})`,
          phase: (sx * 0.13 + sy * 0.07) % (Math.PI * 2),
        });
      }
    }

    particles.current = next;
    setCanvasReady(next.length > 0);
    setLayoutVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!sourceReady) return;
    const frame = window.requestAnimationFrame(rebuildParticles);

    const host = root.current;
    if (!host) {
      window.cancelAnimationFrame(frame);
      return;
    }
    const resizeObserver = new ResizeObserver(rebuildParticles);
    resizeObserver.observe(host);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [rebuildParticles, sourceReady]);

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
      },
      { rootMargin: "120px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useGSAP(
    () => {
      const surface = canvas.current;
      if (!surface || !canvasReady || particles.current.length === 0) return;
      const context = surface.getContext("2d");
      if (!context) return;

      const render = (animate: boolean) => {
        const width = surface.clientWidth;
        const height = surface.clientHeight;
        const dpr = surface.width / Math.max(1, width);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);

        const now = performance.now() * 0.001;
        const dt = animate ? Math.min(2, gsap.ticker.deltaRatio(60)) : 0;
        const cursor = pointer.current;
        const wave = blast.current;
        const repelRadius = Math.min(118, Math.max(74, width * 0.09));

        if (animate && wave.active) {
          wave.radius += 13 * dt;
          if (wave.radius > Math.max(width, height) * 0.7) wave.active = false;
        }

        for (const particle of particles.current) {
          let highlight = false;

          if (animate) {
            if (cursor.active) {
              const dx = particle.x - cursor.x;
              const dy = particle.y - cursor.y;
              const distance = Math.hypot(dx, dy) || 1;
              if (distance < repelRadius) {
                const force = (1 - distance / repelRadius) * 1.8 * dt;
                particle.vx += (dx / distance) * force;
                particle.vy += (dy / distance) * force;
                highlight = distance < repelRadius * 0.45;
              }
            }

            if (wave.active) {
              const dx = particle.x - wave.x;
              const dy = particle.y - wave.y;
              const distance = Math.hypot(dx, dy) || 1;
              const ringDistance = Math.abs(distance - wave.radius);
              if (ringDistance < 22) {
                const force = (1 - ringDistance / 22) * 2.7 * dt;
                particle.vx += (dx / distance) * force;
                particle.vy += (dy / distance) * force;
                highlight = true;
              }
            }

            const targetX = particle.baseX + Math.sin(now * 0.8 + particle.phase) * 0.7;
            const targetY = particle.baseY + Math.cos(now * 0.65 + particle.phase) * 0.55;
            particle.vx += (targetX - particle.x) * 0.034 * dt;
            particle.vy += (targetY - particle.y) * 0.034 * dt;
            const damping = Math.pow(0.87, dt);
            particle.vx *= damping;
            particle.vy *= damping;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
          } else {
            particle.x = particle.baseX;
            particle.y = particle.baseY;
          }

          context.fillStyle = highlight ? "rgba(180, 255, 166, 0.96)" : particle.colour;
          context.fillRect(
            Math.round(particle.x),
            Math.round(particle.y),
            particle.size,
            particle.size,
          );
        }
      };

      if (reducedMotion) {
        render(false);
        return;
      }

      const tick = () => {
        if (visible.current && !document.hidden) render(true);
      };
      gsap.ticker.add(tick);
      render(true);
      return () => gsap.ticker.remove(tick);
    },
    {
      scope: root,
      dependencies: [canvasReady, layoutVersion, reducedMotion],
    },
  );

  const updatePointer = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds) return;
    pointer.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      active: true,
    };
  };

  const triggerBlast = (event: React.PointerEvent<HTMLElement>) => {
    updatePointer(event);
    blast.current = {
      x: pointer.current.x,
      y: pointer.current.y,
      radius: 0,
      active: !reducedMotion,
    };
  };

  return (
    <section
      ref={root}
      aria-label="Interactive block-world encounter"
      onPointerMove={updatePointer}
      onPointerLeave={() => {
        pointer.current.active = false;
      }}
      onPointerDown={triggerBlast}
      className="relative isolate min-h-[72svh] overflow-hidden border-y-[length:var(--mc-bevel)] border-mc-border bg-mc-obsidian md:min-h-[82svh]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(62,229,157,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(62,229,157,0.045) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 60% 52%, rgba(23,192,123,0.2), transparent 34%), radial-gradient(circle at 50% 100%, rgba(160,44,224,0.14), transparent 42%), #0b0710",
        }}
      />

      <div className="pointer-events-none absolute left-[calc(var(--mc-unit)*1.5)] top-[calc(var(--mc-unit)*2)] z-10 max-w-[28rem] md:left-[calc(var(--mc-unit)*4)] md:top-[calc(var(--mc-unit)*4)]">
        <p className="font-pixel text-[8px] uppercase tracking-[0.28em] text-mc-emerald-light md:text-[10px]">
          World encounter
        </p>
        <p className="pixel-shadow mt-[var(--mc-unit)] text-[18px] leading-snug text-white md:text-[24px]">
          The blocks are watching.
        </p>
      </div>

      <canvas
        ref={canvas}
        aria-hidden
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300 ${
          canvasReady ? "opacity-100" : "opacity-0"
        }`}
      />

      <PixelImage
        asset={ART.home.creeper}
        label="creeper"
        alt=""
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-1/2 max-h-[66%] w-auto -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 md:left-[60%] md:max-h-[76%] ${
          canvasReady ? "opacity-0" : "opacity-90"
        }`}
      />

      <p className="pointer-events-none absolute bottom-[calc(var(--mc-unit)*2)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-black/45 px-[var(--mc-unit)] py-[calc(var(--mc-unit)*0.6)] font-pixel text-[7px] uppercase tracking-[0.16em] text-white/75 bevel-inset md:text-[8px]">
        Move to disturb the blocks · tap to scatter
      </p>
    </section>
  );
}
