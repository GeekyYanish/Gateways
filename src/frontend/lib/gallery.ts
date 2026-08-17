/**
 * THE SINGLE SOURCE OF TRUTH FOR THE GALLERY LAYOUT.
 *
 * Structured after the department's Revelations gallery: photos are grouped
 * by fest edition, each tagged with a short moment title rather than an event
 * category. `edition` is on every entry (not a top-level grouping key alone)
 * so a future year's photos can be appended here without a schema change —
 * the screen derives its edition tabs from whatever editions are present.
 *
 * No real photos exist yet (this edition has not happened), so every entry is
 * a placeholder today. When photos land, give each entry an `image` field and
 * swap the placeholder tile in gallery-screen.tsx for a real <Image>.
 */

import { FEST } from "./fest";

export interface GalleryMoment {
  title: string;
  edition: string;
}

export const GALLERY_MOMENTS: GalleryMoment[] = [
  { title: "Inauguration", edition: FEST.edition },
  { title: "Opening Ceremony", edition: FEST.edition },
  { title: "CodeCrafters 24H", edition: FEST.edition },
  { title: "AI Dungeon Sprint", edition: FEST.edition },
  { title: "Golden Hour Walk", edition: FEST.edition },
  { title: "Realm Through a Lens", edition: FEST.edition },
  { title: "Pixel Perfect UI", edition: FEST.edition },
  { title: "Poster Forge", edition: FEST.edition },
  { title: "BrainMines Tech Quiz", edition: FEST.edition },
  { title: "Arena FPS Cup", edition: FEST.edition },
  { title: "Battle of the Bands", edition: FEST.edition },
  { title: "Line Follower Championship", edition: FEST.edition },
  { title: "Guest of Honour", edition: FEST.edition },
  { title: "Group Photo", edition: FEST.edition },
  { title: "Prize Distribution", edition: FEST.edition },
  { title: "Valedictory", edition: FEST.edition },
];
