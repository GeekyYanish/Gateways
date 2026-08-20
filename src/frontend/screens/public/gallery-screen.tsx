"use client";

import { useState } from "react";
import { BackLink, BlockPanel, ItemIcon } from "@/frontend/components/mc";
import {
  chaptersForEdition,
  galleryEditions,
  type GalleryChapter,
  type GalleryMoment,
} from "@/frontend/lib/gallery";
import { cn } from "@/frontend/lib/utils";

/**
 * Fest photography, one carousel per chapter of the fest.
 *
 * A carousel rather than the flat 16-tile grid this page used to be: the grid
 * gave every photo the same weight, so the inauguration and a mid-event candid
 * read as equals and the arc of the two days disappeared. Each chapter now gets
 * a focused frame with its neighbours peeking in on either side, which is both
 * the requested layout and the one that survives a chapter growing to fifty
 * photos — a grid would not.
 *
 * Chapters, their order and their contents all come from `gallery.ts`. Nothing
 * here names a chapter, so the page reshapes itself when that file changes.
 */
export function GalleryScreen() {
  const editions = galleryEditions();
  const [edition, setEdition] = useState(editions[0]);
  const chapters = chaptersForEdition(edition);

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

      <div className="flex flex-col gap-[calc(var(--mc-unit)*3)]">
        {chapters.map((chapter) => (
          // Keyed by edition too: switching editions must reset every carousel
          // to its first slide, not leave it parked on an index that belonged
          // to a different year's photo set.
          <GalleryCarousel key={`${edition}-${chapter.id}`} chapter={chapter} />
        ))}
      </div>
    </div>
  );
}

/**
 * One chapter's photos as a wrap-around carousel.
 *
 * The neighbours are rendered as real tiles rather than a cropped strip so the
 * viewer can see what is coming; they are `aria-hidden` and not clickable,
 * which keeps one photo per stop for a screen reader and leaves the arrows as
 * the single navigation affordance. Arrow keys drive it as well as the buttons.
 */
function GalleryCarousel({ chapter }: { chapter: GalleryChapter }) {
  const [index, setIndex] = useState(0);
  const count = chapter.moments.length;

  /** Wraps in both directions, so the ends are never dead. */
  const at = (offset: number): GalleryMoment =>
    chapter.moments[(index + offset + count * 2) % count];
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  // With one photo there is nothing to page to, and with two the neighbour on
  // both sides would be the SAME photo shown twice — misleading peeks.
  const showPeeks = count > 2;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={chapter.title}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        }
      }}
    >
      <div className="flex items-center gap-[calc(var(--mc-unit)*0.5)] md:gap-[var(--mc-unit)]">
        <CarouselArrow
          direction="prev"
          label={`Previous photo in ${chapter.title}`}
          onClick={() => go(-1)}
          disabled={count < 2}
        />

        <div className="flex min-w-0 flex-1 items-center justify-center">
          {showPeeks ? (
            <div
              aria-hidden
              className="pointer-events-none -mr-[calc(var(--mc-unit)*1.5)] hidden w-[24%] shrink-0 opacity-40 sm:block"
            >
              <GalleryTile moment={at(-1)} />
            </div>
          ) : null}

          {/* z-10 so the focused frame sits OVER both peeks, which is what
              makes the three tiles read as one carousel rather than as three
              cards in a row. */}
          <div className="relative z-10 w-full shrink-0 sm:w-[58%]">
            <GalleryTile moment={at(0)} current />
          </div>

          {showPeeks ? (
            <div
              aria-hidden
              className="pointer-events-none -ml-[calc(var(--mc-unit)*1.5)] hidden w-[24%] shrink-0 opacity-40 sm:block"
            >
              <GalleryTile moment={at(1)} />
            </div>
          ) : null}
        </div>

        <CarouselArrow
          direction="next"
          label={`Next photo in ${chapter.title}`}
          onClick={() => go(1)}
          disabled={count < 2}
        />
      </div>

      {/* Caption below the carousel, as drawn: the chapter is the label for the
          frames above it, not a heading they sit under. */}
      <div className="mt-[calc(var(--mc-unit)*1.25)] text-center">
        <h2 className="text-[13px] uppercase text-mc-accent md:text-[15px]">
          {chapter.title}
        </h2>
        <p className="mt-[calc(var(--mc-unit)*0.25)] text-[14px] text-mc-text-dim">
          {chapter.blurb}
        </p>
        <p
          aria-live="polite"
          className="mt-[calc(var(--mc-unit)*0.5)] font-pixel text-[8px] uppercase tracking-[0.12em] text-mc-text-dim"
        >
          {at(0).title} · {index + 1} / {count}
        </p>
      </div>
    </section>
  );
}

function CarouselArrow({
  direction,
  label,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center",
        "font-pixel text-[14px] text-mc-text-dim md:text-[18px]",
        "cursor-pointer transition-[color,filter] duration-75",
        "hover:text-mc-accent focus-visible:text-mc-accent",
        "disabled:cursor-default disabled:opacity-30 disabled:hover:text-mc-text-dim",
      )}
    >
      {direction === "prev" ? "<" : ">"}
    </button>
  );
}

/**
 * A single frame. Renders the photo once one exists, and the camera
 * placeholder until then — the swap is per-moment, so a chapter can be half
 * shot without the page looking broken.
 *
 * A plain <img> rather than next/image: these tiles render at a handful of
 * widths inside a fixed 4:3 frame, and the placeholder path has to survive a
 * file that is not there yet — the optimizer answers a missing source with a
 * 500, while <img> simply fires `onError`, which is what the fallback below
 * listens for.
 */
function GalleryTile({
  moment,
  current = false,
}: {
  moment: GalleryMoment;
  current?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(moment.image) && !failed;

  return (
    <BlockPanel
      variant="slot"
      padded="none"
      className={cn(
        "relative flex aspect-[4/3] flex-col items-center justify-center gap-[calc(var(--mc-unit)*0.5)] overflow-hidden text-center",
        current && "border-mc-portal",
      )}
    >
      {showPhoto ? (
        <>
          {/* A plain <img> is deliberate — see the component doc comment. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={moment.image}
            alt={moment.alt ?? moment.title}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {current ? (
            <span className="absolute inset-x-0 bottom-0 bg-mc-panel-dark/85 px-[var(--mc-unit)] py-[calc(var(--mc-unit)*0.5)] text-[13px] text-mc-text">
              {moment.title}
            </span>
          ) : null}
        </>
      ) : (
        <>
          <ItemIcon item="camera" size={current ? 28 : 20} />
          {current ? (
            <span className="px-[var(--mc-unit)] text-[13px] text-mc-text-dim">
              {moment.title}
            </span>
          ) : null}
        </>
      )}
    </BlockPanel>
  );
}
