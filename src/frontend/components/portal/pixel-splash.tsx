"use client";

import { useCallback, useRef, useState } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { markSplashSeen, shouldPlaySplash } from "@/frontend/lib/animation/splash-store";
import {
  SPLASH_GRID,
  SPLASH_MASK,
} from "@/frontend/lib/animation/splash-mask";
import { ART } from "@/frontend/lib/assets/manifest";

/**
 * The crest assembles itself out of flying blocks, then reveals the site.
 *
 * Inspired by the Ra.One (2011) Q-BRICKS cube-assembly sequence — cubes converge
 * out of the dark and resolve into a solid form — rebuilt in the project's voxel
 * idiom and, unlike the original's 8-10 hours per frame, running at 60fps.
 *
 * WHAT IT ASSEMBLES INTO: not the original artwork. `scripts/gen-splash-mask.mjs`
 * redraws the crest as real pixel art — 152x152, snapped to the gold token ramp —
 * and that is what the blocks build. Landing on the smooth 1254px original would
 * undo the whole effect: the pixels would resolve into something that was never
 * made of pixels.
 *
 * HOW IT WORKS: the pixel crest is sliced into a 38x38 grid via CSS
 * background-position, one <span> per cell, each carrying a 4x4 chunk of art.
 * Only the 639 cells that actually contain artwork are rendered — the mask is
 * generated alongside the art, so no image decode or canvas read gates the
 * animation. Each block flies in from a randomised radial offset wearing a solid
 * gold cube face; the face fades on landing to reveal that block's chunk of the
 * crest. That two-layer trick is what makes it read as blocks ASSEMBLING rather
 * than an image wiping in.
 *
 * Rendering all 5233 art pixels as their own animated nodes would have been the
 * literal reading of "build it out of pixels", but it puts ~750KB of markup in
 * every page's HTML; flying 4x4 chunks looks the same and costs a twelfth of that.
 *
 * IT IS AN OVERLAY, NOT A GATE. The app renders and hydrates underneath, so the
 * homepage's LCP is untouched — the splash only covers it. Everything below is
 * about making sure that cover always lifts:
 *
 *   - a hard timeout force-dismisses it even if the timeline never completes
 *   - any pointer or key press skips it
 *   - reduced motion (OS or the in-app toggle) skips it before it ever builds
 *   - it plays at most once per tab, and a boot script in the root layout hides
 *     it before first paint on repeat loads so there is no flash
 *   - <noscript> CSS in globals.css hides it when JS never runs
 */

/**
 * Ceiling on how long the overlay may cover the app, whatever the timeline does.
 * Must stay comfortably above the timeline's own ~5.6s, or it would cut the
 * animation off rather than act as a backstop.
 */
const FAILSAFE_MS = 8500;

/** The occupied cells, resolved once at module scope rather than per render. */
const CELLS: ReadonlyArray<{ col: number; row: number }> = SPLASH_MASK.flatMap(
  (line, row) =>
    [...line].flatMap((char, col) => (char === "#" ? [{ col, row }] : [])),
);

export function PixelSplash() {
  const root = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  // The timeline, the failsafe and the skip handler can all race to finish.
  // Whoever gets there first wins; the rest become no-ops.
  const finished = useRef(false);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    markSplashSeen();
    setDone(true);
  }, []);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;

      // Reduced motion is checked synchronously here rather than via the
      // useReducedMotion hook: that hook starts false and corrects in an effect,
      // which would let the timeline build for a frame first.
      if (prefersReducedMotion() || !shouldPlaySplash()) {
        finish();
        return;
      }

      const tiles = gsap.utils.toArray<HTMLElement>(".splash-tile", stage.current);
      const faces = gsap.utils.toArray<HTMLElement>(".splash-face", stage.current);

      // Scatter each block outward from the centre. This is a `set` rather than a
      // `.from()` because the offsets are randomised per block and cannot live in
      // CSS — but the blocks are already opacity:0 via `.gsap-hidden`, so there is
      // no flash of them at rest first (ANIMATION.md rule 4).
      const centre = (SPLASH_GRID - 1) / 2;
      tiles.forEach((tile) => {
        const col = Number(tile.dataset.col);
        const row = Number(tile.dataset.row);
        const dx = col - centre;
        const dy = row - centre;
        const length = Math.hypot(dx, dy) || 1;
        const distance = gsap.utils.random(150, 420);

        gsap.set(tile, {
          x: (dx / length) * distance + gsap.utils.random(-70, 70),
          y: (dy / length) * distance + gsap.utils.random(-70, 70),
          scale: gsap.utils.random(1.5, 2.4),
          rotation: gsap.utils.random(-80, 80),
          autoAlpha: 0,
        });
      });

      // Identical stagger config on tiles and faces, so each block's face fades a
      // fixed beat after that same block starts flying — the "lands, then
      // resolves" read — without tracking 639 individual timelines.
      const stagger: gsap.StaggerVars = {
        grid: [SPLASH_GRID, SPLASH_GRID],
        from: "center",
        amount: 1.9,
      };

      const tl = gsap.timeline({ onComplete: finish });

      tl.to(tiles, {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        autoAlpha: 1,
        duration: 0.85,
        ease: "back.out(1.4)",
        stagger,
      }, 0.2)
        .to(faces, {
          autoAlpha: 0,
          duration: 0.5,
          ease: "power2.out",
          stagger,
        }, 0.85)
        // The crest lands: a shockwave ring pushes out and the whole mark takes a
        // short breath, so the assembly ends on an accent instead of just stopping.
        // The ring flashes in already wider than the crest and keeps expanding —
        // it is never static at the artwork's own size, where it would read as a
        // frame drawn around the logo rather than a pulse leaving it.
        .to(ring.current, {
          autoAlpha: 0.5,
          scale: 1.15,
          duration: 0.15,
          ease: "power2.out",
        }, 2.95)
        .to(ring.current, {
          autoAlpha: 0,
          scale: 2.3,
          duration: 0.8,
          ease: "power2.out",
        }, 3.1)
        .to(stage.current, {
          scale: 1.04,
          duration: 0.22,
          ease: "power2.out",
        }, 2.95)
        .to(stage.current, {
          scale: 1,
          duration: 0.7,
          ease: "elastic.out(1, 0.5)",
        }, 3.17)
        // A beat of stillness on the finished crest, then the reveal: the camera
        // pushes into the logo and the homepage arrives through it.
        //
        // Order matters. The aperture opens FIRST, while the gold blocks still
        // cover that exact shape — so nothing visibly pops. Fading the blocks
        // then uncovers the hole, and by then the zoom is already underway, so
        // the crest reads as opening rather than disappearing.
        // A class rather than a GSAP tween on the custom property: the value is
        // `var(--splash-size)`, an indirection GSAP would try to parse as a number.
        .call(() => backdrop.current?.classList.add("is-open"), undefined, 4.1)
        .to(tiles, {
          autoAlpha: 0,
          duration: 0.45,
          ease: "power2.in",
        }, 4.15)
        .to(el, {
          scale: 14,
          duration: 1.5,
          // Accelerating, so it reads as falling into the logo rather than the
          // logo being pushed at the viewer.
          ease: "power2.in",
        }, 4.1)
        // The silhouette has gaps between the wing feathers. They scale off-screen
        // long before this, but fading the backdrop out guarantees a clean finish
        // — and is the whole reveal on any browser without `mask-composite`.
        .to(backdrop.current, {
          autoAlpha: 0,
          duration: 0.4,
          ease: "power2.inOut",
        }, 5.2);

      // Skip on any input. `once` on each listener plus the `finished` guard means
      // a burst of events cannot start several exit tweens.
      const skip = () => {
        if (finished.current) return;
        tl.kill();
        gsap.to(el, { autoAlpha: 0, duration: 0.25, ease: "power2.out", onComplete: finish });
      };
      window.addEventListener("pointerdown", skip, { once: true });
      window.addEventListener("keydown", skip, { once: true });

      // Last line of defence: if the timeline stalls (a backgrounded tab that
      // never resumes, a tween that throws), the overlay still lifts.
      const failsafe = window.setTimeout(finish, FAILSAFE_MS);

      return () => {
        window.removeEventListener("pointerdown", skip);
        window.removeEventListener("keydown", skip);
        window.clearTimeout(failsafe);
      };
    },
    { scope: root, dependencies: [finish] },
  );

  // Unmount rather than hide: 542 spans have no business lingering in the DOM
  // for the rest of the session.
  if (done) return null;

  return (
    <div
      id="pixel-splash"
      ref={root}
      aria-hidden
      className="fixed inset-0 z-[200] grid place-items-center"
      style={
        {
          "--splash-aperture": `url("${ART.brand.gatewaysCrestAperture.src}")`,
        } as React.CSSProperties
      }
    >
      {/* The void itself, and the layer the crest-shaped hole is punched through.
          It carries the background instead of the root so the reveal has
          something to cut into. */}
      <div ref={backdrop} className="splash-backdrop">
        {/* Faint block grid, so the void reads as buildable space. Inside the
            backdrop so the aperture cuts through it too. */}
        <div className="splash-grid pointer-events-none absolute inset-0" />
      </div>

      <div ref={stage} className="splash-stage relative">
        <div
          ref={ring}
          className="splash-ring gsap-hidden pointer-events-none absolute left-1/2 top-1/2"
        />

        {CELLS.map(({ col, row }) => (
          <span
            key={`${col}-${row}`}
            data-col={col}
            data-row={row}
            className="splash-tile gsap-hidden absolute block"
            style={{
              left: `calc(var(--splash-tile) * ${col})`,
              top: `calc(var(--splash-tile) * ${row})`,
              backgroundImage: `url("${ART.brand.gatewaysCrestPixel.src}")`,
              backgroundPosition: `calc(var(--splash-tile) * -${col}) calc(var(--splash-tile) * -${row})`,
            }}
          >
            {/* The solid cube face worn during flight, faded on landing. */}
            <i className="splash-face absolute inset-0 block bg-mc-gold bevel" />
          </span>
        ))}
      </div>
    </div>
  );
}
