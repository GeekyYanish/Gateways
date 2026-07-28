"use client";

import { BlockButton, BlockPanel } from "@/frontend/components/mc";
import { BiomeScene } from "@/frontend/components/scene";
import { usePortalTransition } from "@/frontend/components/portal/portal-transition-overlay";
import { FEST, inr } from "@/frontend/lib/fest";
import { HomeSection } from "./home-section";
import { TwinCompare } from "./twin-compare";

/**
 * Sections 4–7: who we are, what the theme is, why it is called Parallax, and
 * why the whole site is made of blocks.
 *
 * All body copy is VT323 (the document default), never Press Start 2P. The
 * Digital Twins paragraph is 60-odd words; in a pixel display face it would be
 * unreadable, and the font split is a stated legibility requirement rather than
 * a preference.
 */

const VOXEL_CARDS = [
  {
    title: "Voxel = volume pixel",
    body: "A 3D building block for rendered worlds and simulations.",
  },
  {
    title: "Why it fits",
    body: "A world visibly assembling is a twin being rendered.",
  },
  {
    title: "Why it's practical",
    body: "Cardboard and foam blocks. Geometric signs. Pixel banners.",
  },
] as const;

export function AboutSection() {
  return (
    <HomeSection
      id="about"
      eyebrow="The fest"
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
      <dl className="grid grid-cols-2 gap-[var(--mc-unit)] md:grid-cols-4">
        <Stat label="Years running" value={`${FEST.yearsRunning}+`} />
        <Stat label="Prize pool" value={inr(FEST.money.prizePoolInr)} />
        <Stat label="Entry" value={inr(FEST.money.registrationFeeInr)} />
        <Stat label="Days" value="2" />
      </dl>
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
      {/* dd before dt in the DOM would break the pairing; the visual order is
          achieved with flex-col-reverse instead of reordering the markup. */}
      <div className="flex flex-col-reverse items-center gap-[calc(var(--mc-unit)*0.5)]">
        <dt className="font-pixel text-[7px] uppercase tracking-[0.14em] text-mc-text-dim md:text-[8px]">
          {label}
        </dt>
        <dd className="font-pixel text-[13px] text-mc-gold md:text-[16px]">
          {value}
        </dd>
      </div>
    </BlockPanel>
  );
}

export function DigitalTwinsSection() {
  return (
    <HomeSection id="theme" eyebrow="This year's subject" title="Digital Twins">
      <BiomeScene
        scene="circuit-lab"
        className="min-h-[220px] border-[length:var(--mc-bevel)] border-mc-border bevel-inset"
      >
        <div className="mt-auto w-full bg-black/55 p-[calc(var(--mc-unit)*2)]">
          <p className="mx-auto max-w-[74ch] text-[17px] leading-relaxed text-mc-text md:text-[20px]">
            <strong className="text-mc-diamond-light">Digital Twins</strong>{" "}
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

      <p className="mt-[calc(var(--mc-unit)*3)] text-center font-pixel text-[10px] uppercase leading-loose tracking-[0.14em] text-mc-portal-pale md:text-[13px]">
        One reality.
        <br />
        Two vantage points.
        <br />
        <span className="text-mc-gold">Better decisions.</span>
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
          Build your character and explore the realm.
        </p>
      </div>
    </HomeSection>
  );
}

export function VoxelLanguageSection() {
  return (
    <HomeSection
      eyebrow="Visual language"
      title="Voxel Design"
      lead="Everything you see here — the buttons, the panels, the village — is built from blocks, because a world assembling itself out of blocks is the clearest picture of a twin being rendered."
    >
      <ul className="grid gap-[var(--mc-unit)] md:grid-cols-3">
        {VOXEL_CARDS.map((card) => (
          <li key={card.title}>
            <BlockPanel
              variant="panel"
              padded="lg"
              className="flex h-full flex-col gap-[var(--mc-unit)]"
            >
              <h3 className="text-[11px] uppercase text-mc-emerald-light md:text-[13px]">
                {card.title}
              </h3>
              <p className="text-[17px] leading-relaxed text-mc-text-dim md:text-[19px]">
                {card.body}
              </p>
            </BlockPanel>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
