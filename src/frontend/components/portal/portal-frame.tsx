"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { PixelImage } from "@/frontend/components/mc";
import { ART } from "@/frontend/lib/assets/manifest";
import { portalMotes, portalRings } from "@/frontend/lib/assets/scene-art";
import { cn } from "@/frontend/lib/utils";

const PARTICLE_COUNT = 14;

/**
 * Obsidian face fill: a block grid and violet veining over near-black.
 *
 * The grid lines are what sell it — a flat dark rectangle reads as a hole in
 * the page, whereas ruled 8×10 cells read as stacked blocks. Percentages
 * rather than pixels so the block count stays constant at every --mc-scale.
 */
function obsidianFace(base: string, vein: string, grid: number): string {
  return [
    // Veins, scattered but fixed — a random pattern would shimmer on rerender.
    // Kept small and hard-edged: a wide soft radial reads as a lens smudge on
    // the glass rather than as a fleck of colour in the rock.
    `radial-gradient(circle at 22% 15%, ${vein} 0 1.8%, transparent 2%)`,
    `radial-gradient(circle at 71% 27%, ${vein} 0 1.4%, transparent 1.6%)`,
    `radial-gradient(circle at 37% 41%, ${vein} 0 1.6%, transparent 1.8%)`,
    `radial-gradient(circle at 84% 59%, ${vein} 0 1.3%, transparent 1.5%)`,
    `radial-gradient(circle at 16% 63%, ${vein} 0 1.7%, transparent 1.9%)`,
    `radial-gradient(circle at 58% 78%, ${vein} 0 1.4%, transparent 1.6%)`,
    `radial-gradient(circle at 29% 88%, ${vein} 0 1.5%, transparent 1.7%)`,
    `radial-gradient(circle at 88% 90%, ${vein} 0 1.2%, transparent 1.4%)`,
    // Mortar. Two lines per axis — a dark groove with a lit lip below it — so
    // each cell reads as a separate block with thickness, not as a ruled grid.
    `repeating-linear-gradient(90deg, rgb(0 0 0 / 0.55) 0 2px, rgb(255 255 255 / ${grid}) 2px 4px, transparent 4px 16.66%)`,
    `repeating-linear-gradient(180deg, rgb(0 0 0 / 0.6) 0 2px, rgb(255 255 255 / ${grid}) 2px 4px, transparent 4px 12.5%)`,
    base,
  ].join(", ");
}

/**
 * Cut-stone fill for the pillars, cornice and steps.
 *
 * Same two-line mortar trick as `obsidianFace` — a dark groove with a lit lip
 * under it — so each cell reads as a block with thickness rather than a ruled
 * grid. Lighter and warmer than the obsidian, which is what separates the
 * masonry of the gateway from the black frame the portal is cut into.
 */
function brickFace(base: string, cellW = 16.66, cellH = 14, lip = 0.09): string {
  return [
    `repeating-linear-gradient(90deg, rgb(0 0 0 / 0.34) 0 2px, rgb(255 255 255 / ${lip}) 2px 4px, transparent 4px ${cellW}%)`,
    `repeating-linear-gradient(180deg, rgb(0 0 0 / 0.38) 0 2px, rgb(255 255 255 / ${lip}) 2px 4px, transparent 4px ${cellH}%)`,
    base,
  ].join(", ");
}

/** Pillar and lintel stone, lit from the front. */
const STONE = brickFace("linear-gradient(180deg, #9b958b 0%, #858076 55%, #726d64 100%)");
/** The same stone in shadow — capitals, bases, and the step risers. */
const STONE_DARK = brickFace("linear-gradient(180deg, #6d6860 0%, #55514a 100%)", 16.66, 34);
/** Dark slate for the overhanging cornice above the lintel. */
const SLATE = brickFace("linear-gradient(180deg, #4b4b57 0%, #35353f 100%)", 12.5, 40);

/** Front plane — the one the viewer reads as "the frame". */
const FACE_FRONT = obsidianFace(
  "linear-gradient(160deg, #141033 0%, #0a0c24 55%, #06081a 100%)",
  "rgb(104 38 158 / 0.5)",
  0.06,
);

/**
 * The realm portal — the hero of the landing page.
 *
 * Drawn entirely in CSS: an extruded obsidian frame in three planes (front,
 * top, right) over a stone plinth, with a generated vortex in the aperture.
 * The extrusion is `clip-path` parallelograms rather than a 3D `transform`,
 * because a rotated plane antialiases its edges and that instantly breaks the
 * pixel-art read; clip-path keeps every edge hard.
 *
 * GSAP owns the motion: it is a looping, multi-element choreography (aperture
 * pulse, vortex rotation, drifting motes at staggered offsets), which is
 * exactly the timeline case rather than the component-state case.
 *
 * Reduced motion is handled with `gsap.matchMedia`, so under `reduce` the
 * timeline is never built at all — the portal still renders (it is the brand),
 * it simply stops moving.
 */
export function PortalFrame({
  className,
  intensity = 1,
}: {
  className?: string;
  /** Scales the animation magnitude; the landing page uses 1, loaders use more. */
  intensity?: number;
}) {
  const root = useRef<HTMLDivElement>(null);

  // Deterministic, so server and client render the same markup.
  const rings = useMemo(() => portalRings(), []);
  const motes = useMemo(() => portalMotes(), []);

  /**
   * The CSS portal is the intended render, not a fallback — so it draws first
   * and only steps aside once a real portal-frame.png is confirmed to load.
   * Probing the other way round (render the image, fall back on error) would
   * flash an empty hero on every single load.
   */
  const [artDelivered, setArtDelivered] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setArtDelivered(true);
    };
    probe.src = ART.portal.frame.src;
    return () => {
      cancelled = true;
    };
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Only build the timeline when the user has NOT asked for reduced motion.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ repeat: -1, yoyo: true });

        tl.to(".portal-swirl", {
          scale: 1 + 0.04 * intensity,
          opacity: 1,
          duration: 2.2,
          ease: "sine.inOut",
        }).to(
          ".portal-glow",
          { opacity: 0.85, scale: 1.08, duration: 2.2, ease: "sine.inOut" },
          0,
        );

        // The rings breathe outward rather than turning — they are drawn at the
        // aperture's aspect, so rotating them would shear the concentric shape.
        tl.to(
          ".portal-swirl-inner",
          { scale: 1 + 0.09 * intensity, duration: 2.2, ease: "sine.inOut" },
          0,
        );

        // Continuous rotation on its own tween so it is not affected by the
        // yoyo. Only the motes turn; they have no silhouette to distort.
        const spin = gsap.to(".portal-motes", {
          rotate: 360,
          duration: 26,
          repeat: -1,
          ease: "none",
        });

        // Motes drift upward and fade, each offset so they do not pulse in
        // unison. Staggered start times via a per-element delay.
        const particles = gsap.utils.toArray<HTMLElement>(".portal-particle");
        const particleTweens = particles.map((p, i) =>
          gsap.fromTo(
            p,
            { y: 0, opacity: 0 },
            {
              y: -90 * intensity,
              opacity: 0.9,
              duration: 2.4 + (i % 5) * 0.35,
              delay: i * 0.22,
              repeat: -1,
              ease: "sine.out",
              // Fade back out over the second half of each cycle.
              onRepeat: () => gsap.set(p, { opacity: 0 }),
            },
          ),
        );

        return () => {
          spin.kill();
          particleTweens.forEach((t) => t.kill());
          tl.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: root, dependencies: [intensity] },
  );

  /**
   * The aperture and its vortex. Shared by both branches so the GSAP selectors
   * resolve whichever art is in play.
   *
   * Two layers, split by what each can survive:
   *
   * - the RINGS fill the aperture exactly and never rotate, because they are
   *   drawn at the opening's aspect ratio and any turn would shear them;
   * - the MOTES are a square oversized past the aperture's diagonal and spin
   *   freely, because a scatter of squares has no silhouette to distort.
   *
   * The motes are centred with grid rather than a transform: GSAP owns
   * `transform` on `.portal-motes` for the spin, and a Tailwind
   * `-translate-x-1/2` on the same element would be overwritten the moment the
   * tween starts.
   */
  const aperture = (
    <>
      {/* No `pixelated` here, and it would not help: the browser rasterises an
          SVG background at final display size, so vector art never has pixels
          to preserve. Both sources are already quantised at author time. */}
      <div
        className="portal-swirl-inner absolute inset-0"
        style={{ backgroundImage: `url("${rings}")`, backgroundSize: "100% 100%" }}
      />
      {/* 115% of the aperture height clears its diagonal (~112%) — the minimum
          that keeps the square's corners out of frame through a full turn. */}
      <div className="absolute inset-0 grid place-items-center overflow-hidden">
        <div
          className="portal-motes aspect-square h-[115%]"
          style={{ backgroundImage: `url("${motes}")`, backgroundSize: "100% 100%" }}
        />
      </div>
      {/* Recessed rim — without it the aperture looks pasted on top of the
          frame rather than cut into it. */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 0 var(--mc-bevel) rgb(5 4 15 / 0.9), inset 0 0 calc(var(--mc-unit) * 1.5) rgb(20 6 40 / 0.75)",
        }}
      />
    </>
  );

  return (
    <div
      ref={root}
      className={cn("relative flex flex-col items-center", className)}
      // Decorative: the page heading carries the meaning.
      aria-hidden
    >
      {/* Bloom behind the whole structure. */}
      <div
        className="portal-glow pointer-events-none absolute inset-[-22%] -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, rgba(201,100,255,0.55) 0%, rgba(160,44,224,0.26) 34%, transparent 70%)",
        }}
      />

      {/* Three-way clamp, and all three terms earn their place:
          - vw, because the framing cliff walls each take ~24vw and a wider
            portal is wedged against them with no valley left between;
          - a px cap, so it stops growing on very large screens;
          - vh, because the frame is ~1.35× as tall as it is wide once the
            plinth is counted, so on a short laptop viewport a width-only
            clamp overflows the column and clips the wordmark. */}
      <div className="relative flex w-[min(60vw,300px,34vh)] flex-col items-center md:w-[min(50vw,360px,34vh)]">
        {artDelivered ? (
          <div className="relative w-full">
            <PixelImage
              asset={ART.portal.frame}
              label="portal-frame"
              alt=""
              className="relative z-10 h-auto w-full"
            />
            <div className="portal-swirl absolute inset-0 z-0 grid place-items-center opacity-90">
              <div className="relative h-[74%] w-[64%] overflow-hidden">{aperture}</div>
            </div>
          </div>
        ) : (
          <>
            {/*
              --- The gateway, drawn FRONT-ON ---------------------------------

              This used to be an extruded box: a front plane plus a top and a
              right plane cut with `clip-path`, which read as a monolith seen
              from off to one side. Everything else on this screen — wordmark,
              tagline, CTA — is dead centre and face-on, so the one object the
              eye lands on was the only thing turned away.

              It is now a symmetrical gateway seen straight on: an overhanging
              cornice, two pillars, and the obsidian frame between them with the
              aperture cut into it. No plane is foreshortened, so no edge has to
              be antialiased and the pixel read survives.
            */}
            <div className="relative w-full">
              {/* Cornice: three courses, each overhanging the one below, which
                  is what gives the roofline its weight from the front. */}
              <div className="relative z-20 flex flex-col items-center">
                <div
                  className="h-[calc(var(--mc-unit)*1.25)] w-[118%] bevel"
                  style={{ background: SLATE, ["--bevel-light" as string]: "#5d5d6b", ["--bevel-dark" as string]: "#26262e" }}
                />
                <div
                  className="h-[calc(var(--mc-unit)*1)] w-[108%] bevel"
                  style={{ background: SLATE, ["--bevel-light" as string]: "#55555f", ["--bevel-dark" as string]: "#222229" }}
                />
                <div
                  className="relative h-[calc(var(--mc-unit)*1.75)] w-[99%] bevel"
                  style={{ background: STONE, ["--bevel-light" as string]: "#b0aaa0", ["--bevel-dark" as string]: "#5d584f" }}
                >
                  {/* Moss creeping along the lintel, as in the reference. */}
                  <span className="absolute left-[12%] top-0 h-[38%] w-[7%] bg-[#5f8f3c] opacity-80" />
                  <span className="absolute right-[18%] top-0 h-[30%] w-[5%] bg-[#6d9c45] opacity-70" />
                </div>
              </div>

              {/* Body: pillar · obsidian frame · pillar */}
              <div className="relative flex w-full items-stretch">
                <Pillar side="left" />

                <div
                  className="relative aspect-[10/13] flex-1"
                  style={{ background: FACE_FRONT }}
                >
                  {/* Violet light washing out of the aperture across the frame. */}
                  <div
                    className="pointer-events-none absolute inset-0 mix-blend-screen"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 52%, rgba(196,97,226,0.55) 0%, rgba(123,55,213,0.2) 40%, transparent 68%)",
                    }}
                  />

                  {/* Centred, and taller than it is wide, so the opening reads
                      as a doorway rather than a window. */}
                  <div className="portal-swirl absolute inset-x-[13%] bottom-[7%] top-[9%] overflow-hidden opacity-90">
                    {aperture}
                  </div>
                </div>

                <Pillar side="right" />
              </div>

              {/* Rising motes, over the aperture's horizontal span. */}
              <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
                {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
                  <span
                    key={i}
                    className="portal-particle absolute block h-[6px] w-[6px] bg-mc-portal-light opacity-0"
                    style={{
                      left: `${32 + ((i * 37) % 34)}%`,
                      bottom: `${10 + ((i * 23) % 38)}%`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* --- Steps ---------------------------------------------------
                Three courses widening downward, mirroring the cornice above so
                the whole gateway reads as symmetrical top to bottom. */}
            {/* `items-center`, NOT `mx-auto`. These courses are deliberately
                WIDER than their parent, and `margin: auto` resolves to 0 once a
                box exceeds its containing block — so the steps pinned to the
                left and overhung to the right only. Flex centring handles
                overflow symmetrically, which is why the cornice above was
                already even. */}
            <div className="relative z-10 -mt-[1px] flex w-full flex-col items-center">
              <div
                className="relative h-[calc(var(--mc-unit)*1.25)] w-full bevel"
                style={{ background: STONE, ["--bevel-light" as string]: "#b0aaa0", ["--bevel-dark" as string]: "#5d584f" }}
              >
                {/* Spill from the aperture landing on the top step. */}
                <div className="absolute inset-x-[30%] top-0 h-1/2 bg-mc-portal-light opacity-30 mix-blend-screen" />
              </div>
              <div
                className="h-[calc(var(--mc-unit)*1.15)] w-[112%] bevel"
                style={{ background: STONE_DARK, ["--bevel-light" as string]: "#8b857b", ["--bevel-dark" as string]: "#45413a" }}
              />
              <div
                className="h-[calc(var(--mc-unit)*1.15)] w-[124%] bevel"
                style={{ background: STONE_DARK, ["--bevel-light" as string]: "#7d786f", ["--bevel-dark" as string]: "#3a362f" }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One flanking pillar: a capital and a base that overhang the shaft, plus a
 * little moss. Mirrored left/right so the pair lights from the same side.
 */
function Pillar({ side }: { side: "left" | "right" }) {
  return (
    <div
      className="relative w-[19%] shrink-0"
      style={{ background: STONE }}
    >
      {/* Capital and base, wider than the shaft so the column has a foot and a
          head rather than reading as a plain slab. */}
      <div
        className={cn(
          "absolute top-0 h-[7%] bevel",
          side === "left" ? "left-[-8%] right-0" : "left-0 right-[-8%]",
        )}
        style={{ background: STONE_DARK, ["--bevel-light" as string]: "#8b857b", ["--bevel-dark" as string]: "#45413a" }}
      />
      <div
        className={cn(
          "absolute bottom-0 h-[7%] bevel",
          side === "left" ? "left-[-8%] right-0" : "left-0 right-[-8%]",
        )}
        style={{ background: STONE_DARK, ["--bevel-light" as string]: "#8b857b", ["--bevel-dark" as string]: "#45413a" }}
      />
      {/* Moss, mirrored so the two pillars are not identical. */}
      <span
        className={cn(
          "absolute bottom-[12%] h-[9%] w-[34%] bg-[#5f8f3c] opacity-75",
          side === "left" ? "left-0" : "right-0",
        )}
      />
      <span
        className={cn(
          "absolute h-[6%] w-[22%] bg-[#6d9c45] opacity-60",
          side === "left" ? "left-[42%] top-[34%]" : "right-[42%] top-[46%]",
        )}
      />
    </div>
  );
}
