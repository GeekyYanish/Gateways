"use client";

import { blockButton, BlockPanel } from "@/frontend/components/mc";
import { RegisterDecor } from "@/frontend/components/decor";
import { FEST, inr } from "@/frontend/lib/fest";
import { cn } from "@/frontend/lib/utils";
import { HomeSection } from "./home-section";

/**
 * How to register, plus accommodation.
 *
 * Laid out as a crafting recipe: the numbered steps are the recipe, the price
 * panel beside them is the output. Registration itself happens on an external
 * form (as it did in 2025) — this section's only job is to make the process
 * legible before someone leaves the site for it.
 *
 * `FEST.links.register` now points at an on-site route. The external-link
 * handling below is kept rather than deleted: the value is data, and a future
 * edition that does hand registration to an external form should not need a
 * component change to stop opening it in the same tab.
 */
export function RegisterSection() {
  const isExternal = FEST.links.register.startsWith("http");

  return (
    <HomeSection
      id="register"
      eyebrow="Take part"
      decor={<RegisterDecor />}
      title="How to Register"
      lead={
        <>
          One flat fee of{" "}
          <strong className="text-mc-accent">
            {inr(FEST.money.registrationFeeInr)}
          </strong>{" "}
          lets you enter as many events as you can fit into two days.
        </>
      }
    >
      <div className="grid gap-[calc(var(--mc-unit)*1.5)] lg:grid-cols-[1.6fr_1fr]">
        <BlockPanel variant="gold" padded="lg" title="The recipe">
          <ol className="flex flex-col gap-[var(--mc-unit)] p-[calc(var(--mc-unit)*1.5)]">
            {FEST.registerSteps.map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-[var(--mc-unit)] text-[17px] leading-snug text-mc-text md:text-[19px]"
              >
                <span
                  aria-hidden
                  className="flex h-[28px] w-[28px] shrink-0 items-center justify-center bg-mc-slot font-pixel text-[9px] text-mc-accent bevel-inset"
                >
                  {i + 1}
                </span>
                <span className="pt-[3px]">{step}</span>
              </li>
            ))}
          </ol>
        </BlockPanel>

        <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
          <BlockPanel
            variant="slot"
            padded="lg"
            className="flex flex-col gap-[calc(var(--mc-unit)*0.75)]"
          >
            <h3 className="text-[10px] uppercase text-mc-success md:text-[12px]">
              Entry
            </h3>
            <p className="font-pixel text-[18px] text-mc-accent md:text-[22px]">
              {inr(FEST.money.registrationFeeInr)}
            </p>
            <p className="text-[16px] leading-snug text-mc-text-dim">
              Per person, covering any number of events.
            </p>
          </BlockPanel>

          <BlockPanel
            variant="slot"
            padded="lg"
            className="flex flex-col gap-[calc(var(--mc-unit)*0.75)]"
          >
            <h3 className="text-[10px] uppercase text-mc-success md:text-[12px]">
              Accommodation
            </h3>
            <p className="font-pixel text-[18px] text-mc-accent md:text-[22px]">
              {inr(FEST.money.accommodationPerDayInr)}
            </p>
            <p className="text-[16px] leading-snug text-mc-text-dim">
              {FEST.money.accommodationNote}. Allotted first-come, first-served;
              payable on arrival. Ask the hospitality contact below.
            </p>
          </BlockPanel>

          {/* The cva classes on an anchor, not a <BlockButton> inside one —
              an <a> wrapping a <button> is invalid HTML and swallows the
              anchor's keyboard activation. */}
          <a
            href={FEST.links.register}
            {...(isExternal
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className={cn(
              blockButton({ variant: "gold", size: "lg", block: true }),
              "no-underline",
            )}
          >
            Browse events and register
          </a>

          <a
            href={FEST.links.brochure}
            {...(FEST.links.brochure.startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className={cn(
              "inline-flex min-h-11 items-center justify-center text-center font-pixel text-[9px] uppercase tracking-[0.12em] no-underline transition-colors",
              "text-mc-text-dim hover:text-mc-accent",
            )}
          >
            Read the brochure ↗
          </a>
        </div>
      </div>
    </HomeSection>
  );
}
