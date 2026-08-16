"use client";

import { useState } from "react";
import { BackLink, BlockPanel, ItemIcon } from "@/frontend/components/mc";
import { GALLERY_MOMENTS } from "@/frontend/lib/gallery";
import { cn } from "@/frontend/lib/utils";

/**
 * Fest photography, grouped by edition — the same shape as the department's
 * Revelations gallery (year tabs, moment-titled tiles), not by event category.
 *
 * Real photos do not exist yet (this edition has not happened), so every tile
 * is a placeholder — the same rule the art manifest applies to pixel art,
 * extended here to photography per CLAUDE.md's guidance that real photos use
 * next/image, not <PixelImage>. Once photos exist, give each `GALLERY_MOMENTS`
 * entry an `image` field and swap the placeholder tile below for a real
 * `<Image>` — nothing else on this page changes.
 */
export function GalleryScreen() {
  const editions = [...new Set(GALLERY_MOMENTS.map((m) => m.edition))];
  const [edition, setEdition] = useState(editions[0]);
  const moments = GALLERY_MOMENTS.filter((m) => m.edition === edition);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-[calc(var(--mc-unit)*2)] px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*1.5)] md:p-[calc(var(--mc-unit)*2)]">
      <BackLink href="/" label="Home" />

      <header>
        <h1 className="text-mc-accent text-base md:text-lg">GALLERY</h1>
        <p className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text-dim">
          Moments from the realm, by edition. Photos land here as the fest happens.
        </p>
      </header>

      {editions.length > 1 ? (
        <nav aria-label="Edition" className="flex flex-wrap gap-[calc(var(--mc-unit)*0.5)]">
          {editions.map((e) => (
            <button
              key={e}
              type="button"
              aria-current={e === edition ? "page" : undefined}
              onClick={() => setEdition(e)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center px-[var(--mc-unit)]",
                "font-pixel text-[9px] uppercase tracking-wide cursor-pointer",
                e === edition
                  ? "bg-mc-portal text-white [--bevel-light:var(--color-mc-portal-light)] [--bevel-dark:var(--color-mc-portal-dark)] bevel"
                  : "bg-mc-panel text-mc-text-dim [--bevel-light:var(--color-mc-panel-light)] [--bevel-dark:var(--color-mc-panel-dark)] bevel hover:text-mc-text",
              )}
            >
              {e}
            </button>
          ))}
        </nav>
      ) : null}

      <ul className="grid gap-[var(--mc-unit)] grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {moments.map((moment) => (
          <li key={moment.title}>
            <GalleryPlaceholder title={moment.title} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function GalleryPlaceholder({ title }: { title: string }) {
  return (
    <BlockPanel
      variant="slot"
      padded="none"
      className="flex aspect-[4/3] flex-col items-center justify-center gap-[calc(var(--mc-unit)*0.5)] text-center"
    >
      <ItemIcon item="camera" size={28} />
      <span className="px-[var(--mc-unit)] text-[13px] text-mc-text-dim">{title}</span>
    </BlockPanel>
  );
}
