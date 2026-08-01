import type { ItemName } from "@/frontend/lib/assets/manifest";
import { COURTYARD, planPct, roomByKey, type RectM } from "./floor-plan";

/**
 * World map hotspots (mockup SCREEN 6).
 *
 * These are the rooms of our building, dressed in the realm's names — the
 * layout is real, the naming is not. Classroom C is the Hackathon Mine, the
 * staff room is the Wardens' Hall, the courtyard is the Village Square.
 *
 * `x`/`y` are PERCENTAGES, never pixels, and they are **derived from
 * `floor-plan.ts`** rather than hand-typed. They are only a fallback: the map
 * canvas reports true projected positions once it has drawn (see
 * `MappedAnchor`), and these hold the markers roughly right for the frame
 * before that happens. `/dev/kitchen-sink` also renders them directly.
 *
 * `categorySlug` links a signpost to event_categories.world_location_key.
 *
 * **Do not rename the five event keys** (`hackathon-mine`, `photography-forest`,
 * `design-workshop`, `quiz-library`, `gaming-arena`). Nothing reads
 * `categorySlug` today — the live path is the hardcoded `href` outbound, and on
 * the way back `/events` hands its category slug to `locationByKey()`. That only
 * works because `key` and the seeded `EventCategory.slug` are the same string.
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
  /** Null for utility locations that are not event categories. */
  categorySlug: string | null;
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
    label: "Hackathon Mine",
    ...at("hackathon-mine"),
    href: "/events?category=hackathon-mine",
    item: "pickaxe",
    categorySlug: "hackathon-mine",
    blurb: "Dig deep into code. Overnight builds and prize-winning prototypes.",
  },
  {
    key: "photography-forest",
    label: "Photography Forest",
    ...at("photography-forest"),
    href: "/events?category=photography-forest",
    item: "camera",
    categorySlug: "photography-forest",
    blurb: "Capture the realm. Photo walks, edits and exhibitions.",
  },
  {
    key: "design-workshop",
    label: "Design Workshop",
    ...at("design-workshop"),
    href: "/events?category=design-workshop",
    item: "craftingTable",
    categorySlug: "design-workshop",
    blurb: "Craft interfaces and posters at the workbench.",
  },
  {
    key: "quiz-library",
    label: "Quiz Library",
    ...at("quiz-library"),
    href: "/events?category=quiz-library",
    item: "book",
    categorySlug: "quiz-library",
    blurb: "Test your knowledge across every subject in the realm.",
  },
  {
    key: "gaming-arena",
    label: "Gaming Arena",
    ...at("gaming-arena"),
    href: "/events?category=gaming-arena",
    item: "sword",
    categorySlug: "gaming-arena",
    blurb: "Tournaments, brackets and bragging rights.",
  },
  {
    key: "sponsors-pavilion",
    label: "Sponsors' Pavilion",
    ...at("sponsors-pavilion"),
    href: "/sponsors",
    item: "chest",
    categorySlug: null,
    blurb: "The patrons who keep the realm's forges lit.",
  },
  {
    key: "leaderboard-castle",
    label: "Leaderboard Castle",
    ...at("leaderboard-castle"),
    href: "/leaderboard",
    item: "trophy",
    categorySlug: null,
    blurb: "See who rules the realm.",
  },
  {
    key: "staff-room",
    label: "Wardens' Hall",
    ...at("staff-room"),
    href: "/dashboard/team",
    item: "warpOrb",
    categorySlug: null,
    blurb: "Muster your party and see who you are questing with.",
  },
  {
    key: "sitting-area",
    label: "Hearth Hall",
    ...at("sitting-area"),
    href: "/schedule",
    item: "map",
    categorySlug: null,
    blurb: "The lounge and café by the main doors. Check what is on, and when.",
  },
  {
    key: "village-square",
    label: "Village Square",
    ...atRect(COURTYARD),
    href: "/dashboard",
    item: "compass",
    categorySlug: null,
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
