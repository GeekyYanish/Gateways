"use client";

import { motion } from "framer-motion";
import { cn } from "@/frontend/lib/utils";

/**
 * The shell every homepage content section shares: width, rhythm, heading
 * treatment, and the scroll reveal.
 *
 * The reveal is Framer `whileInView`, not GSAP ScrollTrigger. This is a single
 * component reacting to its own visibility — no cross-element choreography and
 * no scrub — which is precisely the case the animation ruleset assigns to
 * Framer. It also means no new GSAP plugin has to be registered.
 *
 * `once: true` matters: re-animating a section every time it re-enters the
 * viewport turns an ordinary scroll back up the page into a flashing mess.
 *
 * Reduced motion is handled by the `<MotionConfig reducedMotion="user">` that
 * wraps the page — Framer then drops the transform and opacity tweens for us,
 * so there is no branch to write here.
 */

export interface HomeSectionProps {
  id?: string;
  /** Small pixel-font label above the heading. */
  eyebrow?: string;
  title?: string;
  /** Renders under the heading, before `children`. */
  lead?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Centres the heading block. Defaults to true. */
  centered?: boolean;
}

export function HomeSection({
  id,
  eyebrow,
  title,
  lead,
  children,
  className,
  centered = true,
}: HomeSectionProps) {
  return (
    <motion.section
      id={id}
      // scroll-mt clears the sticky nav when an anchor link jumps here;
      // without it the heading lands underneath the bar.
      className={cn(
        "mx-auto w-full max-w-6xl scroll-mt-[calc(var(--mc-unit)*8)] px-[calc(var(--mc-unit)*1.5)] py-[calc(var(--mc-unit)*4)]",
        className,
      )}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {eyebrow || title ? (
        <header
          className={cn(
            "mb-[calc(var(--mc-unit)*2)] flex flex-col gap-[calc(var(--mc-unit)*0.75)]",
            centered && "items-center text-center",
          )}
        >
          {eyebrow ? (
            <p className="font-pixel text-[8px] uppercase tracking-[0.28em] text-mc-portal-light md:text-[9px]">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="text-[16px] uppercase text-mc-gold md:text-[24px]">
              {title}
            </h2>
          ) : null}
          {lead ? (
            <div
              className={cn(
                "max-w-[70ch] text-[17px] leading-relaxed text-mc-text md:text-[19px]",
                centered && "mx-auto",
              )}
            >
              {lead}
            </div>
          ) : null}
        </header>
      ) : null}

      {children}
    </motion.section>
  );
}
