"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { getScene, type Scene } from "@/frontend/lib/assets/scenes";
import { useTheme } from "@/frontend/lib/theme/use-theme";
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

  /**
   * Bumped on resize so the drift tweens rebuild.
   *
   * A drifting tile's loop distance is derived from the element's rendered
   * height, so a resize (or a phone rotation) invalidates it and the seam the
   * distance was chosen to hide would come back. Rebuilding on resize is the
   * whole fix. It starts at 0 on both server and client, so it cannot cause a
   * hydration mismatch.
   */
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      // Debounced: a drag-resize fires continuously, and rebuilding a set of
      // infinite tweens on every frame of it would be far more expensive than
      // the seam we are avoiding.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setResizeTick((n) => n + 1), 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

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

          // Horizontal drift for tileable strips (clouds, treelines, meadow).
          if (l.drift) {
            const speed = Math.abs(l.drift);

            /**
             * Travel EXACTLY one tile width per cycle.
             *
             * A repeating GSAP tween restarts from its recorded start value, so
             * whatever distance is chosen here is also the distance the layer
             * snaps back at the end of every cycle. One tile width is the only
             * distance at which that snap is invisible: the pattern has just
             * repeated itself, so the pixel it jumps to is identical to the one
             * it jumped from. Any other number puts a seam through the sky on a
             * fixed interval.
             *
             * With `background-size: auto 100%` the rendered tile is as wide as
             * the element is tall, times the source aspect ratio.
             */
            const el = node as HTMLElement;
            const tileWidth =
              l.tile && el.clientHeight
                ? Math.round(el.clientHeight * (l.w / l.h))
                : speed * 100;

            /**
             * `fromTo` from an explicit 0, NOT a relative `+=` tween.
             *
             * These layers compute to `background-position-x: 50%` (the default
             * anchor), and a relative tween would be asking GSAP for
             * `50% += 400px` — mismatched units, which it drops on the floor.
             * The layer then sits perfectly still, which is exactly what this
             * used to do. Pinning the start to 0px makes the arithmetic
             * unambiguous, and horizontal alignment is irrelevant for a
             * `repeat-x` tile because it covers the element either way.
             */
            tweens.push(
              gsap.fromTo(
                node,
                { backgroundPositionX: 0 },
                {
                  backgroundPositionX: l.drift > 0 ? tileWidth : -tileWidth,
                  // Distance over speed, so `drift` means px/sec exactly as the
                  // SceneLayer docs claim.
                  duration: tileWidth / speed,
                  repeat: -1,
                  ease: "none",
                },
              ),
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
    { scope: root, dependencies: [sceneKey, resizeTick] },
  );

  if (!scene) {
    // An unknown key should not blank the page — render the children plainly.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[AnimatedBackground] unknown scene "${sceneKey}"`);
    }
    return <div className={cn("relative", className)}>{children}</div>;
  }

  return (
    <div ref={root} className={cn("relative isolate overflow-hidden", className)} style={{ contain: "content" }}>
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
 *
 * `lightScene` swaps to a second scene key under the light theme, for scenes
 * that are lit rather than merely coloured — a night workshop does not become a
 * day workshop by tinting it, it needs its own gradient, palette and blend
 * modes (see `circuit-lab` / `circuit-lab-day` in scenes.ts). Omit it and the
 * one scene is used in both themes, which is right for anything whose backdrop
 * is fixed art.
 */
export function BiomeScene({
  scene,
  lightScene,
  className,
  children,
}: {
  scene: string;
  /** Scene key to use instead of `scene` when the light theme is active. */
  lightScene?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  // `useTheme` resolves "dark" on the first client pass and corrects in an
  // effect, so a light-theme visitor gets one frame of the dark scene. That is
  // why the nav swaps its crest in CSS instead — but the nav is above the fold
  // and this is not: every current caller sits well down the page, so the
  // correction lands long before the element is on screen. If a `lightScene`
  // is ever wanted above the fold, render both and swap with the
  // `theme-only-dark` / `theme-only-light` classes in globals.css.
  const { resolved } = useTheme();
  const key = lightScene && resolved === "light" ? lightScene : scene;

  return (
    <AnimatedBackground
      scene={key}
      intensity={0.45}
      // `flex` (not the default block) so a child with h-full actually fills
      // the box — otherwise content anchored to the bottom floats at the top.
      className={cn("flex w-full flex-col", className)}
    >
      {children}
    </AnimatedBackground>
  );
}
