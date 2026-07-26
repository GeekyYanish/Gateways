import type { ItemName } from "@/lib/assets/manifest";

/**
 * World map hotspots (mockup SCREEN 6).
 *
 * Coordinates are PERCENTAGES of the map's width/height, never pixels. The map
 * art does not exist yet, will arrive at 2048×1152, and has a separate portrait
 * recrop for mobile — percentages stay correct across all of those, pixel
 * offsets would not.
 *
 * `categorySlug` links a signpost to event_categories.world_location_key, so
 * clicking a location filters the events list to that category.
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

export const WORLD_LOCATIONS: readonly WorldLocation[] = [
  {
    key: "hackathon-mine",
    label: "Hackathon Mine",
    x: 22,
    y: 61,
    href: "/events?category=hackathon-mine",
    item: "pickaxe",
    categorySlug: "hackathon-mine",
    blurb: "Dig deep into code. Overnight builds and prize-winning prototypes.",
  },
  {
    key: "photography-forest",
    label: "Photography Forest",
    x: 74,
    y: 30,
    href: "/events?category=photography-forest",
    item: "camera",
    categorySlug: "photography-forest",
    blurb: "Capture the realm. Photo walks, edits and exhibitions.",
  },
  {
    key: "design-workshop",
    label: "Design Workshop",
    x: 46,
    y: 72,
    href: "/events?category=design-workshop",
    item: "craftingTable",
    categorySlug: "design-workshop",
    blurb: "Craft interfaces and posters at the workbench.",
  },
  {
    key: "quiz-library",
    label: "Quiz Library",
    x: 63,
    y: 55,
    href: "/events?category=quiz-library",
    item: "book",
    categorySlug: "quiz-library",
    blurb: "Test your knowledge across every subject in the realm.",
  },
  {
    key: "gaming-arena",
    label: "Gaming Arena",
    x: 30,
    y: 33,
    href: "/events?category=gaming-arena",
    item: "sword",
    categorySlug: "gaming-arena",
    blurb: "Tournaments, brackets and bragging rights.",
  },
  {
    key: "village-square",
    label: "Village Square",
    x: 50,
    y: 45,
    href: "/dashboard",
    item: "compass",
    categorySlug: null,
    blurb: "Your inventory, events and achievements.",
  },
  {
    key: "leaderboard-castle",
    label: "Leaderboard Castle",
    x: 84,
    y: 66,
    href: "/leaderboard",
    item: "trophy",
    categorySlug: null,
    blurb: "See who rules the realm.",
  },
] as const;

export function locationByKey(key: string): WorldLocation | undefined {
  return WORLD_LOCATIONS.find((l) => l.key === key);
}
