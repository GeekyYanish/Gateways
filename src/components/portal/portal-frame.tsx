"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/animation/gsap-init";
import { PixelImage } from "@/components/mc";
import { ART } from "@/lib/assets/manifest";
import { cn } from "@/lib/utils";

const PARTICLE_COUNT = 14;

/**
 * The portal (mockup SCREEN 1).
 *
 * GSAP owns this: it is a looping, multi-element choreography (swirl rotation,
 * glow pulse, drifting particles at staggered offsets), which is exactly the
 * timeline case rather than the component-state case.
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

  /**
   * Until the real art lands, a generic checkerboard placeholder makes the hero
   * of the whole site look broken. So when the frame art is missing we draw a
   * credible obsidian portal in CSS instead — blocky border, glowing aperture.
   * It reads as deliberate rather than as a gap, and it disappears the moment
   * portal-frame.png exists.
   */
  const [artMissing, setArtMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onerror = () => {
      if (!cancelled) setArtMissing(true);
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
          scale: 1 + 0.05 * intensity,
          opacity: 1,
          duration: 2.2,
          ease: "sine.inOut",
        }).to(
          ".portal-glow",
          { opacity: 0.85, scale: 1.08, duration: 2.2, ease: "sine.inOut" },
          0,
        );

        // Continuous rotation on its own tween so it is not affected by the yoyo.
        const spin = gsap.to(".portal-swirl-inner", {
          rotate: 360,
          duration: 26,
          repeat: -1,
          ease: "none",
        });

        // Particles drift upward and fade, each offset so they do not pulse in
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

  return (
    <div
      ref={root}
      className={cn("relative grid place-items-center", className)}
      // Decorative: the page heading carries the meaning.
      aria-hidden
    >
      {/* Glow behind the frame. */}
      <div
        className="portal-glow absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(201,100,255,0.55) 0%, rgba(160,44,224,0.28) 35%, transparent 70%)",
        }}
      />

      <div className="relative">
        {artMissing ? (
          // CSS stand-in: obsidian block border with a glowing aperture.
          <div
            className="relative z-10 grid place-items-center w-[min(70vw,320px)] aspect-[320/400] bg-mc-obsidian"
            style={{
              // Chunky stepped border, like stacked obsidian blocks.
              boxShadow:
                "inset 0 0 0 14px #1a1024, inset 0 0 0 20px #2b1b3d, inset 0 0 0 26px #120c18",
            }}
          >
            <div
              className="portal-swirl relative w-[62%] h-[74%] overflow-hidden"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 50%, #e9b6ff 0%, #c964ff 22%, #a02ce0 45%, #6b1aa0 70%, #3d1259 100%)",
              }}
            >
              {/* Rotating streaks give the aperture visible motion. */}
              <div
                className="portal-swirl-inner absolute inset-[-25%]"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.30) 18deg, transparent 42deg, rgba(255,255,255,0.20) 70deg, transparent 96deg, rgba(255,255,255,0.28) 130deg, transparent 165deg, rgba(255,255,255,0.16) 210deg, transparent 250deg, rgba(255,255,255,0.24) 300deg, transparent 340deg)",
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <PixelImage
              asset={ART.portal.frame}
              label="portal-frame"
              alt=""
              className="relative z-10 w-[min(70vw,320px)] h-auto"
            />

            {/* Swirl sits inside the frame's aperture. */}
            <div className="portal-swirl absolute inset-0 z-0 grid place-items-center opacity-85">
              <div className="portal-swirl-inner w-[64%] h-[74%]">
                <PixelImage
                  asset={ART.portal.swirl}
                  label="portal-swirl"
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </>
        )}

        {/* Rising particles. */}
        <div className="absolute inset-0 z-20 overflow-visible">
          {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
            <span
              key={i}
              className="portal-particle absolute block w-[6px] h-[6px] bg-mc-portal-light opacity-0"
              style={{
                left: `${12 + ((i * 37) % 76)}%`,
                bottom: `${8 + ((i * 23) % 40)}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
