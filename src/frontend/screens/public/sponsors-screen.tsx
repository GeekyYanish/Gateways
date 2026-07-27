"use client";

import { BackLink, BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";

const TIER_STYLE: Record<string, string> = {
  diamond: "border-mc-diamond text-mc-diamond-light",
  gold: "border-mc-gold text-mc-gold-light",
  iron: "border-mc-stone text-mc-stone-light",
  stone: "border-mc-border text-mc-text-dim",
};

export function SponsorsScreen() {
  const { data: sponsors, loading } = useAsync(() => repo.reference.sponsors(), []);

  const tiers = ["diamond", "gold", "iron", "stone"] as const;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[calc(var(--mc-unit)*1.5)] p-[calc(var(--mc-unit)*2)]">
      <BackLink href="/" label="Home" />
      <h1 className="text-mc-gold text-base md:text-lg">SPONSORS</h1>

      {loading ? (
        <BlockPanel variant="slot"><LoadingBlocks label="Loading" /></BlockPanel>
      ) : (
        tiers.map((tier) => {
          const group = (sponsors ?? []).filter((s) => s.tier === tier);
          if (group.length === 0) return null;
          return (
            <section key={tier}>
              <h2 className="font-pixel text-[11px] uppercase text-mc-text-dim">{tier}</h2>
              <ul className="mt-[var(--mc-unit)] grid gap-[var(--mc-unit)] sm:grid-cols-2">
                {group.map((s) => (
                  <li key={s.id}>
                    <BlockPanel
                      variant="panel"
                      padded="md"
                      className={`h-full border-[length:var(--mc-bevel)] ${TIER_STYLE[tier]}`}
                    >
                      <p className="font-pixel text-[11px]">{s.name}</p>
                      {s.blurb ? (
                        <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px] text-mc-text-dim">{s.blurb}</p>
                      ) : null}
                      {s.websiteUrl ? (
                        <a
                          href={s.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-[var(--mc-unit)] inline-block text-[15px] text-mc-portal-light underline"
                        >
                          Visit site
                        </a>
                      ) : null}
                    </BlockPanel>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
