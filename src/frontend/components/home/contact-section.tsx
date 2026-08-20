import { HomeSection } from "@/frontend/components/home/home-section";
import { BlockPanel } from "@/frontend/components/mc";
import { FEST } from "@/frontend/lib/fest";

export function ContactSection() {
  return (
    <HomeSection
      id="contact"
      eyebrow="Get in touch"
      title="Contact"
      lead="Any question about events, payments or a place to stay — one of these will have the answer."
    >
      <ul className="grid gap-[var(--mc-unit)] md:grid-cols-2 lg:grid-cols-4">
        {FEST.contacts.map((c) => (
          <li key={c.name}>
            <BlockPanel
              variant="panel"
              padded="lg"
              className="flex h-full flex-col gap-[calc(var(--mc-unit)*0.5)]"
            >
              <p className="text-[17px] text-mc-text">{c.name}</p>
              {c.role ? (
                <p className="font-pixel text-[7px] uppercase tracking-[0.12em] text-mc-text-dim">
                  {c.role}
                </p>
              ) : null}
              <div className="mt-auto flex min-h-11 flex-col justify-center">
                {c.email ? (
                  <p className="text-[17px] tracking-tighter whitespace-nowrap text-mc-text">
                    {c.email}
                  </p>
                ) : null}
                {c.phone ? (
                  <a
                    href={`tel:${c.phone.replace(/\s+/g, "")}`}
                    className="inline-flex font-pixel text-[9px] tracking-[0.1em] text-mc-accent no-underline hover:text-mc-accent-strong md:text-[10px]"
                  >
                    {c.phone}
                  </a>
                ) : null}
              </div>
            </BlockPanel>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
