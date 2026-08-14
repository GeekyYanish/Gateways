"use client";

import { BlockButton, BlockPanel, PixelImage } from "@/frontend/components/mc";
import { BiomeScene } from "@/frontend/components/scene";
import { AboutCharacterDecor, TorchPair } from "@/frontend/components/decor";
import { ART } from "@/frontend/lib/assets/manifest";
import { usePortalTransition } from "@/frontend/components/portal/portal-transition-overlay";
import { FEST, inr } from "@/frontend/lib/fest";
import { HomeSection } from "./home-section";
import { TwinCompare } from "./twin-compare";

/**
 * Sections 4–6: who we are, what the theme is, and why it is called Parallax.
 *
 * All body copy is VT323 (the document default), never Press Start 2P. The
 * Digital Twins paragraph is 60-odd words; in a pixel display face it would be
 * unreadable, and the font split is a stated legibility requirement rather than
 * a preference.
 */

export function AboutSection() {
  return (
    <HomeSection
      id="about"
      eyebrow="The fest"
      decor={
        <>
          <TorchPair />
          <AboutCharacterDecor />
        </>
      }
      title={FEST.edition}
      lead={
        <>
          Gateways is the national technical fest held annually for over{" "}
          {FEST.yearsRunning} years by the {FEST.host.department} at{" "}
          {FEST.host.university}, {FEST.host.city} — organised by its{" "}
          {FEST.host.programmes} students.
        </>
      }
    >
      <div
        aria-hidden
        className="pointer-events-none mb-[var(--mc-unit)] flex h-[170px] items-end justify-center xl:hidden"
      >
        <PixelImage
          asset={ART.home.girl}
          label="girl"
          alt=""
          className="h-full w-auto"
          style={{ filter: "drop-shadow(0 10px 8px rgba(0,0,0,0.36))" }}
        />
      </div>
      <div
        aria-label="Festival highlights"
        className="grid grid-cols-2 gap-[var(--mc-unit)] md:grid-cols-4"
      >
        <Stat label="Years running" value={`${FEST.yearsRunning}+`} />
        <Stat label="Prize pool" value={inr(FEST.money.prizePoolInr)} />
        <Stat label="Entry" value={inr(FEST.money.registrationFeeInr)} />
        <Stat label="Days" value="2" />
      </div>
    </HomeSection>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <BlockPanel
      variant="slot"
      padded="md"
      className="flex flex-col items-center gap-[calc(var(--mc-unit)*0.5)] text-center"
    >
      <div className="flex flex-col items-center gap-[calc(var(--mc-unit)*0.5)]">
        <p className="order-2 font-pixel text-[7px] uppercase tracking-[0.14em] text-mc-text-dim md:text-[8px]">
          {label}
        </p>
        <p className="order-1 font-pixel text-[13px] text-mc-accent md:text-[16px]">
          {value}
        </p>
      </div>
    </BlockPanel>
  );
}

export function DigitalTwinsSection() {
  return (
    <HomeSection
      id="theme"
      eyebrow="This year's subject"
      title="Digital Twins"
    >
      {/* The night workshop is the dark theme's; `circuit-lab-day` is the same
          room with the shutters open. A tint would not have done it — the
          conduits layer glows via `screen`, which composites to nothing on a
          pale wall, so the day variant re-blends it as well as re-colouring. */}
      <BiomeScene
        scene="circuit-lab"
        lightScene="circuit-lab-day"
        className="relative min-h-[650px] overflow-hidden border-[length:var(--mc-bevel)] border-mc-border bevel-inset md:min-h-[430px]"
      >
        <PixelImage
          asset={ART.home.bowOne}
          label="bow character one"
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-[-14px] top-[calc(var(--mc-unit)*1.5)] z-0 h-[230px] w-auto scale-x-[-1] md:bottom-0 md:top-auto md:h-[390px]"
          style={{ filter: "drop-shadow(8px 10px 8px rgba(0,0,0,0.45))" }}
        />
        <PixelImage
          asset={ART.home.bowTwo}
          label="bow character two"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-[-14px] top-[calc(var(--mc-unit)*1.5)] z-0 h-[230px] w-auto md:bottom-0 md:top-auto md:h-[390px]"
          style={{ filter: "drop-shadow(-8px 10px 8px rgba(0,0,0,0.45))" }}
        />
        {/* THEMED, and that is a reversal worth explaining.

            This was a fixed black wash with white text, on the rule that the
            caption sits on scene art whose backdrop never changes — so themed
            tokens would have darkened it against a constant. That rule was
            right for as long as it held. It stopped holding the moment the card
            gained `lightScene`: the backdrop is now a night workshop OR a day
            one, and a hard black slab that disappeared into the first reads as a
            hole punched in the second.

            So it goes back to the semantic layer, which is what that layer is
            for — `panel` and `text` flip together, and `info` is the one accent
            that already has a light-theme value solved for cream (a deep teal,
            where dark uses diamond). What must never come back is the ORIGINAL
            bug: `bg-mc-slot/95` with a hardcoded `text-white`, one token themed
            and the other not, which is how white on sand happened. Both sides of
            a contrast pair are themed here, or neither is. */}
        <div className="relative z-10 mx-[var(--mc-unit)] mb-[var(--mc-unit)] mt-auto bg-mc-panel/85 p-[calc(var(--mc-unit)*1.5)] bevel-inset md:mx-auto md:mb-[calc(var(--mc-unit)*2)] md:w-[68%] md:p-[calc(var(--mc-unit)*2)]">
          <p className="mx-auto max-w-[74ch] text-[17px] leading-relaxed text-mc-text md:text-[20px]">
            <strong className="text-mc-info">Digital Twins</strong>{" "}
            represent the convergence of AI, IoT, cloud computing, and
            simulation by creating intelligent virtual replicas of real-world
            systems. These digital counterparts continuously learn from live
            data, enabling predictive analytics, optimization, and innovation
            across industries. As one of the fastest-growing technologies
            driving Industry 4.0, Digital Twins are transforming how we design,
            operate, and interact with the physical world.
          </p>
        </div>
      </BiomeScene>
    </HomeSection>
  );
}

export function ParallaxSection() {
  const { navigateWithPortal } = usePortalTransition();

  return (
    <HomeSection
      eyebrow="Why we called it"
      title="Parallax"
      lead={
        <>
          &ldquo;Parallax&rdquo; is the physics behind our metaphor. An object
          appears to shift when observed from two viewpoints.
        </>
      }
    >
      <TwinCompare />

      {/* Sits directly on the PAGE, unlike the portal-pale lines elsewhere in
          this file which sit on art or on a black scrim — so it reads its
          violet from the semantic token rather than the material one. */}
      <p className="mt-[calc(var(--mc-unit)*3)] text-center font-pixel text-[10px] uppercase leading-loose tracking-[0.14em] text-mc-eyebrow md:text-[13px]">
        One reality.
        <br />
        Two vantage points.
        <br />
        <span className="text-mc-accent">Better decisions.</span>
      </p>

      {/*
        The portal CTA lives HERE, not in the hero.
        This is the first point on the page where "start the journey" means
        something concrete: the visitor has just been shown one object seen from
        two viewpoints, so stepping through to see the fest from the inside is
        the obvious next move. Above this line it would be an ask before an
        explanation.

        It goes to `/portal` — the gate — rather than straight to `/entering`.
        `/entering` is a transition that immediately redirects, so jumping there
        from a marketing page would flash past and dump the visitor on a login
        form with no sense of having gone anywhere. The gate is the beat in
        between: the portal, and a deliberate second press to step through it.
      */}
      <div className="mt-[calc(var(--mc-unit)*3)] flex flex-col items-center gap-[var(--mc-unit)]">
        <BlockButton
          size="xl"
          variant="portal"
          onClick={() => navigateWithPortal("/portal")}
        >
          Start the Journey
        </BlockButton>
        <p className="text-[16px] text-mc-text-dim">
          Choose your name, register for events, and explore the realm.
        </p>
      </div>
    </HomeSection>
  );
}
