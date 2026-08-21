/**
 * THE SINGLE SOURCE OF TRUTH FOR THE GALLERY LAYOUT.
 *
 * Photos are grouped twice over: by fest edition, and within an edition by
 * CHAPTER — the arc of a fest as it is actually lived, from the inauguration
 * through the events, the candid moments, and out at the valedictory.
 *
 * The chapter grouping is what the gallery renders as one carousel each, so
 * this file decides the page's shape: add a chapter here and a fifth carousel
 * appears; move a moment between chapters and it slides to the other carousel.
 * Nothing in `gallery-screen.tsx` names a chapter or a moment.
 *
 * `edition` is on every moment (not a top-level grouping key alone) so a future
 * year's photos can be appended without a schema change — the screen derives
 * its edition tabs from whatever editions are present, and a chapter that has
 * no photos in the selected edition simply does not render.
 *
 * No real photos exist yet (this edition has not happened), so every entry is
 * a placeholder today. When photos land, set `image` on the entry — the tile
 * swaps from the camera placeholder to the real photo on its own.
 */

import { FEST } from "./fest";

export interface GalleryMoment {
  title: string;
  edition: string;
  /**
   * Public path to the photo, e.g. `/art/gallery/inauguration-lamp.jpg`.
   * Absent until the photo exists — the tile renders a placeholder instead.
   */
  image?: string;
  /** Alt text for the photo. Falls back to `title` when not given. */
  alt?: string;
}

export interface GalleryChapter {
  /** Stable key — used for React keys and the carousel's ARIA ids. */
  id: string;
  /** Caption under the carousel. */
  title: string;
  /** One line of context, shown beneath the caption. */
  blurb: string;
  moments: GalleryMoment[];
}

const edition = FEST.edition;

export const GALLERY_CHAPTERS: GalleryChapter[] = [
  {
    id: "inauguration",
    title: "Inauguration & Opening",
    blurb: "The lamp, the address, and the first walk into the realm.",
    moments: [
      { title: "Inauguration", edition },
      { title: "Opening Ceremony", edition },
      { title: "Guest of Honour", edition },
    ],
  },
  {
    id: "events",
    title: "Events",
    blurb: "Two days of building, quizzing, playing and performing.",
    moments: [
      { title: "CodeCrafters 24H", edition },
      { title: "AI Dungeon Sprint", edition },
      { title: "Pixel Perfect UI", edition },
      { title: "Poster Forge", edition },
      { title: "BrainMines Tech Quiz", edition },
      { title: "Arena FPS Cup", edition },
      { title: "Battle of the Bands", edition },
      { title: "Line Follower Championship", edition },
    ],
  },
  {
    id: "moments",
    title: "Moments",
    blurb: "The in-between frames — corridors, crews and golden hour.",
    moments: [
      { title: "Golden Hour Walk", edition },
      { title: "Realm Through a Lens", edition },
      { title: "Group Photo", edition },
    ],
  },
  {
    id: "valedictory",
    title: "Valedictory",
    blurb: "Trophies handed over and the portal closing on the edition.",
    moments: [
      { title: "Prize Distribution", edition },
      { title: "Valedictory", edition },
    ],
  },
];

/** Every edition present across all chapters, in first-seen order. */
export function galleryEditions(): string[] {
  return [
    ...new Set(GALLERY_CHAPTERS.flatMap((c) => c.moments.map((m) => m.edition))),
  ];
}

/**
 * The chapters as they should render for one edition — each narrowed to that
 * edition's photos, with empty chapters dropped so a year the fest ran no
 * culturals does not leave a dead carousel on the page.
 */
export function chaptersForEdition(edition: string): GalleryChapter[] {
  return GALLERY_CHAPTERS.map((chapter) => ({
    ...chapter,
    moments: chapter.moments.filter((m) => m.edition === edition),
  })).filter((chapter) => chapter.moments.length > 0);
}
