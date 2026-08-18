import type { ItemName } from "@/frontend/lib/assets/manifest";
import { COURTYARD, planPct, roomByKey, type RectM } from "./floor-plan";

/**
 * World map hotspots (mockup SCREEN 6).
 *
 * These are the rooms of our building. The five event rooms are LABELLED with
 * the event they host, so the map and the list name what is actually on; the
 * room's realm name survives in the blurb. Utility locations keep their realm
 * names (Wardens' Hall, Village Square) — they host no event.
 *
 * `x`/`y` are PERCENTAGES, never pixels, and they are **derived from
 * `floor-plan.ts`** rather than hand-typed. They are only a fallback: the map
 * canvas reports true projected positions once it has drawn (see
 * `MappedAnchor`), and these hold the markers roughly right for the frame
 * before that happens. `/dev/kitchen-sink` also renders them directly.
 *
 * `eventSlug` points a signpost at ONE real event, and `href` goes straight to
 * that event's page.
 *
 * It used to be `categorySlug`, pointing at `/events?category=<slug>`. The 2026
 * catalogue files every event under Technical or Non-Technical, so those five
 * category filters became empty — each signpost led to a "no events" page. A
 * signpost to a real event cannot go stale that way.
 *
 * **Do not rename the five event keys** (`hackathon-mine`, `photography-forest`,
 * `design-workshop`, `quiz-library`, `gaming-arena`) — the reason is now purely
 * geometric. `at(key)` looks the key up in `floor-plan.ts` to derive the marker
 * position, and an unknown key throws. The keys are room ids first and category
 * ids not at all.
 */
export interface WorldLocation {
  key: string;
  label: string;
  /** Percentage across the map, 0–100. */
  x: number;
  /** Percentage down the map, 0–100. */
  y: number;
  href: string;
  item: ItemName;
  /**
   * The event this signpost leads to, or null for utility locations that are
   * not events at all (sponsors, leaderboard, the square).
   */
  eventSlug: string | null;
  blurb: string;
}

/** Position a location from its room in the floor plan. */
function at(key: string): { x: number; y: number } {
  const room = roomByKey(key);
  if (!room) throw new Error(`No room in the floor plan for location "${key}"`);
  return planPct(room);
}

function atRect(r: RectM): { x: number; y: number } {
  return planPct(r);
}

export const WORLD_LOCATIONS: readonly WorldLocation[] = [
  {
    key: "hackathon-mine",
    label: "24° Shift",
    ...at("hackathon-mine"),
    href: "/events/24-shift",
    item: "pickaxe",
    eventSlug: "24-shift",
    blurb: "The 24-hour hackathon, in the Hackathon Mine. Dig deep into code and ship by morning.",
  },
  {
    key: "photography-forest",
    label: "Pixel Quest",
    ...at("photography-forest"),
    href: "/events/pixel-quest",
    item: "camera",
    eventSlug: "pixel-quest",
    blurb: "The photography contest, out in the Photography Forest. Capture the realm.",
  },
  {
    key: "design-workshop",
    label: "Pixel Paradox",
    ...at("design-workshop"),
    href: "/events/pixel-paradox",
    item: "craftingTable",
    eventSlug: "pixel-paradox",
    blurb: "The UI/UX event, at the Design Workshop bench.",
  },
  {
    key: "quiz-library",
    label: "Deviation",
    ...at("quiz-library"),
    href: "/events/deviation",
    item: "book",
    eventSlug: "deviation",
    blurb: "The IT quiz, held in the Quiz Library. Test your knowledge across the realm.",
  },
  {
    key: "gaming-arena",
    label: "Gaming",
    ...at("gaming-arena"),
    href: "/events/gaming",
    item: "sword",
    eventSlug: "gaming",
    blurb: "Tournaments and brackets in the Gaming Arena.",
  },
  {
    key: "sponsors-pavilion",
    label: "Sponsors' Pavilion",
    ...at("sponsors-pavilion"),
    href: "/sponsors",
    item: "chest",
    eventSlug: null,
    blurb: "The patrons who keep the realm's forges lit.",
  },
  {
    key: "leaderboard-castle",
    label: "Leaderboard Castle",
    ...at("leaderboard-castle"),
    href: "/leaderboard",
    item: "trophy",
    eventSlug: null,
    blurb: "See who rules the realm.",
  },
  {
    key: "staff-room",
    label: "Wardens' Hall",
    ...at("staff-room"),
    href: "/dashboard/team",
    item: "warpOrb",
    eventSlug: null,
    blurb: "Muster your party and see who you are questing with.",
  },
  {
    key: "sitting-area",
    label: "Hearth Hall",
    ...at("sitting-area"),
    href: "/schedule",
    item: "map",
    eventSlug: null,
    blurb: "The lounge and café by the main doors. Check what is on, and when.",
  },
  {
    key: "village-square",
    label: "Village Square",
    ...atRect(COURTYARD),
    href: "/dashboard",
    item: "compass",
    eventSlug: null,
    blurb: "Your inventory, events and achievements.",
  },
];

/**
 * The nine locations that get a hotbar slot.
 *
 * `Hotbar` is hard-capped at nine (its 1–9 number-key binding is the whole
 * point of the component), and it silently DROPS anything past the ninth — so
 * this cannot be left to a stray tenth entry. The Village Square is the one
 * omitted: it is the spawn point rather than somewhere you travel to, and its
 * `/dashboard` target is already the header's "Inventory" link, so nothing
 * becomes unreachable.
 */
export const HOTBAR_LOCATIONS: readonly WorldLocation[] = WORLD_LOCATIONS.filter(
  (l) => l.key !== "village-square",
);

if (HOTBAR_LOCATIONS.length > 9) {
  throw new Error(
    `HOTBAR_LOCATIONS has ${HOTBAR_LOCATIONS.length} entries; Hotbar shows only 9 and drops the rest.`,
  );
}

export function locationByKey(key: string): WorldLocation | undefined {
  return WORLD_LOCATIONS.find((l) => l.key === key);
}

/** The signpost for an event, if one leads there. */
export function locationByEventSlug(eventSlug: string): WorldLocation | undefined {
  return WORLD_LOCATIONS.find((l) => l.eventSlug === eventSlug);
}
