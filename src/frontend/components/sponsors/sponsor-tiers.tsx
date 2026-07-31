"use client";

import { BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { cn } from "@/frontend/lib/utils";

/**
 * The sponsor roll, tier by tier.
 *
 * Deliberately headless — no heading, no back link, no page padding. Sponsors
 * appear in two places (a section on the homepage and the standalone /sponsors
 * page kept for sharing directly with sponsors), and the two need different
 * chrome around identical content. Owning the chrome here would mean either
 * duplicating the tier logic or bolting props onto it to suppress the parts one
 * caller does not want.
 *
 * Tier order is fixed rather than derived from the data: it is a ranking, and
 * sorting it alphabetically or by insertion would quietly demote the sponsors
 * who paid the most.
 */

const TIERS = ["diamond", "gold", "iron", "stone"] as const;

const TIER_STYLE: Record<string, string> = {
  diamond: "border-mc-diamond text-mc-diamond-light",
  gold: "border-mc-gold text-mc-gold-light",
  iron: "border-mc-stone text-mc-stone-light",
  stone: "border-mc-border text-mc-text-dim",
};

export function SponsorTiers({ className }: { className?: string }) {
  const { data: sponsors, loading } = useAsync(() => repo.reference.sponsors(), []);

  if (loading) {
    return (
      <BlockPanel variant="slot">
        <LoadingBlocks label="Loading sponsors" />
      </BlockPanel>
    );
  }

  return (
    <div className={cn("flex flex-col gap-[calc(var(--mc-unit)*1.5)]", className)}>
      {TIERS.map((tier) => {
        const group = (sponsors ?? []).filter((s) => s.tier === tier);
        if (group.length === 0) return null;

        return (
          <section key={tier}>
            <h3 className="font-pixel text-[11px] uppercase text-mc-text-dim">{tier}</h3>
            <ul className="mt-[var(--mc-unit)] grid gap-[var(--mc-unit)] sm:grid-cols-2">
              {group.map((s) => (
                <li key={s.id}>
                  <BlockPanel
                    variant="panel"
                    padded="md"
                    className={cn(
                      "h-full border-[length:var(--mc-bevel)]",
                      TIER_STYLE[tier],
                    )}
                  >
                    <p className="font-pixel text-[11px]">{s.name}</p>
                    {s.blurb ? (
                      <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px] text-mc-text-dim">
                        {s.blurb}
                      </p>
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
      })}
    </div>
  );
}
