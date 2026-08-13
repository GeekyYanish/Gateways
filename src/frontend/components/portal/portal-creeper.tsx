"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { useReducedMotion } from "@/frontend/lib/animation/use-reduced-motion";
import { ART } from "@/frontend/lib/assets/manifest";
import { PixelImage } from "@/frontend/components/mc";
import styles from "./portal-landing.module.css";

type Particle = {
  baseX: number;
  baseY: number;
  color: string;
  phase: number;
  size: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type PointerPosition = {
  active: boolean;
  x: number;
  y: number;
};

type Blast = {
  active: boolean;
  radius: number;
  x: number;
  y: number;
};

/**
 * The homepage particle encounter, condensed into a creature living beside the
 * gateway. The source image is sampled locally into coloured squares; pointer
 * proximity repels them and a press sends a shockwave through the silhouette.
 */
export function PortalCreeper({ side }: { side: "left" | "right" }) {
  const root = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLImageElement | null>(null);
  const particles = useRef<Particle[]>([]);
  const pointer = useRef<PointerPosition>({ active: false, x: 0, y: 0 });
  const blast = useRef<Blast>({ active: false, radius: 0, x: 0, y: 0 });
  const [sourceReady, setSourceReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const image = new Image();
    image.decoding = "async";
    image.src = ART.home.creeper.src;
    image.onload = () => {
      source.current = image;
      setSourceReady(true);
    };
    image.onerror = () => setSourceReady(false);

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  const rebuild = useCallback(() => {
    const host = root.current;
    const surface = canvas.current;
    const image = source.current;
    if (!host || !surface || !image) return;

    const bounds = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    surface.width = Math.round(width * dpr);
    surface.height = Math.round(height * dpr);

    const sampler = document.createElement("canvas");
    sampler.width = image.naturalWidth;
    sampler.height = image.naturalHeight;
    const context = sampler.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
    ).data;

    // The side encounter shares a frame budget with the Three.js world. About
    // 2–3k squares preserves the dissolving silhouette without spending half
    // the frame walking particles that are smaller than a screen pixel.
    const sampleStep = width < 100 ? 10 : 8;
    const displayHeight = height * 0.86;
    const scale = displayHeight / image.naturalHeight;
    const displayWidth = image.naturalWidth * scale;
    const originX = (width - displayWidth) / 2;
    const originY = height - displayHeight;
    const square = Math.max(1.4, sampleStep * scale * 0.9);
    const next: Particle[] = [];

    for (let sy = 0; sy < image.naturalHeight; sy += sampleStep) {
      for (let sx = 0; sx < image.naturalWidth; sx += sampleStep) {
        const index = (sy * image.naturalWidth + sx) * 4;
        const alpha = pixels[index + 3];
        if (alpha < 42) continue;

        const baseX = originX + sx * scale;
        const baseY = originY + sy * scale;
        next.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          vx: 0,
          vy: 0,
          size: square,
          color: `rgba(${pixels[index]}, ${pixels[index + 1]}, ${pixels[index + 2]}, ${Math.min(1, alpha / 220)})`,
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
    const frame = requestAnimationFrame(rebuild);
    const observer = new ResizeObserver(rebuild);
    if (root.current) observer.observe(root.current);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [rebuild, sourceReady]);

  useGSAP(
    () => {
      const surface = canvas.current;
      if (!surface || !canvasReady || particles.current.length === 0) return;
      const context = surface.getContext("2d");
      if (!context) return;

      const paint = (animate: boolean) => {
        const width = surface.clientWidth;
        const height = surface.clientHeight;
        const dpr = surface.width / Math.max(1, width);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);

        const now = performance.now() * 0.001;
        const dt = animate ? Math.min(2, gsap.ticker.deltaRatio(60)) : 0;
        const cursor = pointer.current;
        const wave = blast.current;
        const repelRadius = Math.max(38, width * 0.42);

        if (animate && wave.active) {
          wave.radius += 8.5 * dt;
          if (wave.radius > Math.max(width, height) * 0.85) wave.active = false;
        }

        particles.current.forEach((particle) => {
          let highlighted = false;

          if (animate) {
            if (cursor.active) {
              const dx = particle.x - cursor.x;
              const dy = particle.y - cursor.y;
              const distance = Math.hypot(dx, dy) || 1;
              if (distance < repelRadius) {
                const force = (1 - distance / repelRadius) * 1.45 * dt;
                particle.vx += (dx / distance) * force;
                particle.vy += (dy / distance) * force;
                highlighted = distance < repelRadius * 0.48;
              }
            }

            if (wave.active) {
              const dx = particle.x - wave.x;
              const dy = particle.y - wave.y;
              const distance = Math.hypot(dx, dy) || 1;
              const ringDistance = Math.abs(distance - wave.radius);
              if (ringDistance < 16) {
                const force = (1 - ringDistance / 16) * 2.35 * dt;
                particle.vx += (dx / distance) * force;
                particle.vy += (dy / distance) * force;
                highlighted = true;
              }
            }

            const targetX = particle.baseX + Math.sin(now * 0.85 + particle.phase) * 0.45;
            const targetY = particle.baseY + Math.cos(now * 0.7 + particle.phase) * 0.38;
            particle.vx += (targetX - particle.x) * 0.04 * dt;
            particle.vy += (targetY - particle.y) * 0.04 * dt;
            const damping = Math.pow(0.84, dt);
            particle.vx *= damping;
            particle.vy *= damping;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
          } else {
            particle.x = particle.baseX;
            particle.y = particle.baseY;
          }

          context.fillStyle = highlighted
            ? "rgba(198, 255, 173, 0.98)"
            : particle.color;
          context.fillRect(
            Math.round(particle.x),
            Math.round(particle.y),
            particle.size,
            particle.size,
          );
        });
      };

      if (reducedMotion) {
        paint(false);
        return;
      }

      const tick = () => {
        if (!document.hidden) paint(true);
      };
      gsap.ticker.add(tick);
      paint(true);
      return () => gsap.ticker.remove(tick);
    },
    {
      scope: root,
      dependencies: [canvasReady, layoutVersion, reducedMotion],
    },
  );

  const locatePointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds) return;
    pointer.current = {
      active: true,
      x:
        side === "left"
          ? bounds.width - (event.clientX - bounds.left)
          : event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const scatter = () => {
    const host = root.current;
    if (!host) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    blast.current = {
      active: !reducedMotion,
      radius: 0,
      x: pointer.current.active ? pointer.current.x : width / 2,
      y: pointer.current.active ? pointer.current.y : height / 2,
    };
  };

  return (
    <aside
      className={`${styles.creeperEncounter} ${
        side === "left" ? styles.creeperLeft : styles.creeperRight
      } landing-creeper gsap-hidden`}
    >
      <div aria-hidden className={styles.creeperGlow} />
      <button
        ref={root}
        type="button"
        aria-label={`${side === "left" ? "Left" : "Right"} portal guardian. Move across it or press to scatter its blocks.`}
        className={styles.creeperTarget}
        onPointerMove={locatePointer}
        onPointerLeave={() => {
          pointer.current.active = false;
        }}
        onPointerDown={(event) => {
          locatePointer(event);
          scatter();
        }}
        onClick={(event) => {
          if (event.detail === 0) scatter();
        }}
      >
        <canvas
          ref={canvas}
          aria-hidden
          className={`${styles.creeperCanvas} ${
            side === "left" ? styles.creeperMirrored : ""
          } ${canvasReady ? styles.creeperCanvasReady : ""}`}
        />
        <PixelImage
          aria-hidden
          alt=""
          asset={ART.home.creeper}
          label="portal-creeper"
          className={`${styles.creeperFallback} ${
            side === "left" ? styles.creeperMirrored : ""
          } ${canvasReady ? styles.creeperFallbackHidden : ""}`}
        />
      </button>

      <div aria-hidden className={styles.creeperCaption}>
        <span>Unknown entity // {side === "left" ? "01" : "02"}</span>
        <span>Move · tap · scatter</span>
      </div>
    </aside>
  );
}
