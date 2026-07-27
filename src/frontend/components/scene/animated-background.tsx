"use client";

import { useCallback, useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { getScene, type Scene } from "@/frontend/lib/assets/scenes";
import { ParallaxLayer, type ParallaxLayerHandle } from "./parallax-layer";
import { cn } from "@/frontend/lib/utils";

/**
 * A full-bleed animated scene: layered art + parallax + ambient GSAP loops.
 *
 * This is the reusable surface every screen sits on. Give it a scene key and it
 * handles the rest — layer stacking, pointer/scroll parallax, drifting clouds,
 * pulsing glows, and reduced-motion behaviour.
 *
 * Design decisions worth knowing:
 *
 * - **One pointer listener for the whole scene**, not one per layer. Layers
 *   expose an imperative `applyOffset` handle; this component owns the input.
 * - **Pointer input is throttled to the frame** via requestAnimationFrame.
 *   pointermove can fire well above 60Hz on high-polling mice, and tweening on
 *   every raw event wastes most of that work.
 * - **Ambient motion (drift/pulse) is GSAP**, because it is a looping timeline
 *   over several elements — the exact case ANIMATION.md assigns to GSAP.
 * - **Reduced motion kills all of it.** `gsap.matchMedia` never builds the
 *   timelines, and the pointer listener is not attached at all. The scene still
 *   renders — it simply holds still.
 */
export function AnimatedBackground({
  scene: sceneKey,
  className,
  children,
  /** Multiplies all parallax travel. 0 disables parallax but keeps ambient motion. */
  intensity = 1,
  /** Also shift layers as the page scrolls — for long scrollable pages. */
  scrollParallax = false,
}: {
  scene: string;
  className?: string;
  children?: React.ReactNode;
  intensity?: number;
  scrollParallax?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const handles = useRef(new Map<string, ParallaxLayerHandle>());
  const scene: Scene | undefined = getScene(sceneKey);

  const register = useCallback(
    (key: string) => (h: ParallaxLayerHandle | null) => {
      if (h) handles.current.set(key, h);
      else handles.current.delete(key);
    },
    [],
  );

  // ---- pointer + scroll parallax -----------------------------------------
  useEffect(() => {
    if (!scene) return;
    const node = root.current;
    if (!node) return;

    // Honour reduced motion by simply never listening.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () =>
      mq.matches || document.documentElement.dataset.reduceMotion === "true";
    if (reduced()) return;

    // Travel is a share of the viewport, so the effect feels the same on a
    // phone and an ultrawide rather than being tuned to one screen size.
    const maxX = Math.min(60, window.innerWidth * 0.035) * intensity;
    const maxY = Math.min(36, window.innerHeight * 0.03) * intensity;

    let pointerX = 0;
    let pointerY = 0;
    let scrollY = 0;
    let frame = 0;

    const flush = () => {
      frame = 0;
      handles.current.forEach((h) => h.applyOffset(pointerX, pointerY + scrollY));
    };

    // Coalesce to one update per frame regardless of input rate.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const onPointer = (e: PointerEvent) => {
      pointerX = (e.clientX / window.innerWidth - 0.5) * -2 * maxX;
      pointerY = (e.clientY / window.innerHeight - 0.5) * -2 * maxY;
      schedule();
    };

    const onScroll = () => {
      scrollY = -window.scrollY * 0.15 * intensity;
      schedule();
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    if (scrollParallax) window.addEventListener("scroll", onScroll, { passive: true });

    // Reset to neutral if the user turns reduced motion on mid-session.
    const onPrefChange = () => {
      if (reduced()) {
        pointerX = 0;
        pointerY = 0;
        scrollY = 0;
        flush();
      }
    };
    mq.addEventListener("change", onPrefChange);

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", onPrefChange);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scene, intensity, scrollParallax]);

  // ---- ambient drift + pulse ---------------------------------------------
  useGSAP(
    () => {
      if (!scene) return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tweens: gsap.core.Tween[] = [];

        for (const l of scene.layers) {
          const sel = `[data-parallax-layer="${l.key}"]`;
          const node = root.current?.querySelector(sel);
          if (!node) continue;

          // Horizontal drift for tileable strips (clouds, mist, pollen).
          if (l.drift) {
            tweens.push(
              gsap.to(node, {
                backgroundPositionX: `${l.drift > 0 ? "+" : "-"}=${Math.abs(l.drift) * 100}px`,
                duration: 100 / Math.abs(l.drift),
                repeat: -1,
                ease: "none",
              }),
            );
          }

          // Opacity breathing for glow layers.
          if (l.pulse) {
            const base = l.opacity ?? 1;
            tweens.push(
              gsap.to(node, {
                opacity: Math.min(1, base * 1.35),
                duration: l.pulse / 2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
              }),
            );
          }
        }

        return () => tweens.forEach((t) => t.kill());
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [sceneKey] },
  );

  if (!scene) {
    // An unknown key should not blank the page — render the children plainly.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[AnimatedBackground] unknown scene "${sceneKey}"`);
    }
    return <div className={cn("relative", className)}>{children}</div>;
  }

  return (
    <div ref={root} className={cn("relative isolate overflow-hidden", className)}>
      {/* Base gradient guarantees full coverage even if every layer 404s. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: scene.baseGradient }}
      />

      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {scene.layers.map((l) => (
          <ParallaxLayer
            key={l.key}
            layer={l}
            sceneKey={scene.key}
            palette={scene.palette}
            handleRef={register(l.key)}
          />
        ))}
      </div>

      {children}
    </div>
  );
}

/**
 * Biome illustration in a bounded box (event cards, category headers) rather
 * than full-bleed. Same scene data, lighter motion.
 */
export function BiomeScene({
  scene,
  className,
  children,
}: {
  scene: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <AnimatedBackground
      scene={scene}
      intensity={0.45}
      // `flex` (not the default block) so a child with h-full actually fills
      // the box — otherwise content anchored to the bottom floats at the top.
      className={cn("flex w-full flex-col", className)}
    >
      {children}
    </AnimatedBackground>
  );
}
