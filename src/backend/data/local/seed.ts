import type {
  Achievement,
  Announcement,
  College,
  Department,
  EventCategory,
  FestEvent,
  Level,
  ScheduleSlot,
  Sponsor,
} from "../types";
import { read, readList, write } from "./store";

/**
 * One-time seed of reference and demo data.
 *
 * Purpose: every screen looks populated and real from the first load, before any
 * user has signed up. Without this, the events list, leaderboard, schedule and
 * sponsors pages would all be empty shells and impossible to judge.
 *
 * Dates are computed RELATIVE to now, so the fest never looks stale no matter
 * when the app is opened — a hardcoded 2026 date would show a fest in the past.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const COLLEGES: College[] = [
  { id: "col-sjc", name: "St. Joseph's College", shortName: "SJC", city: "Bengaluru", isActive: true },
  { id: "col-cmr", name: "CMR Institute of Technology", shortName: "CMRIT", city: "Bengaluru", isActive: true },
  { id: "col-rvce", name: "RV College of Engineering", shortName: "RVCE", city: "Bengaluru", isActive: true },
  { id: "col-pes", name: "PES University", shortName: "PES", city: "Bengaluru", isActive: true },
  { id: "col-bms", name: "BMS College of Engineering", shortName: "BMSCE", city: "Bengaluru", isActive: true },
  { id: "col-msr", name: "MS Ramaiah Institute of Technology", shortName: "MSRIT", city: "Bengaluru", isActive: true },
  { id: "col-nmit", name: "Nitte Meenakshi Institute of Technology", shortName: "NMIT", city: "Bengaluru", isActive: true },
  { id: "col-other", name: "Other", shortName: "OTHER", city: null, isActive: true },
];

/** collegeId null = available to every college. */
const DEPARTMENTS: Department[] = [
  { id: "dep-cse", collegeId: null, name: "Computer Science", shortName: "CSE" },
  { id: "dep-ise", collegeId: null, name: "Information Science", shortName: "ISE" },
  { id: "dep-ece", collegeId: null, name: "Electronics & Communication", shortName: "ECE" },
  { id: "dep-eee", collegeId: null, name: "Electrical & Electronics", shortName: "EEE" },
  { id: "dep-mech", collegeId: null, name: "Mechanical", shortName: "MECH" },
  { id: "dep-civil", collegeId: null, name: "Civil", shortName: "CIVIL" },
  { id: "dep-aiml", collegeId: null, name: "AI & Machine Learning", shortName: "AIML" },
  { id: "dep-bba", collegeId: null, name: "Business Administration", shortName: "BBA" },
  { id: "dep-design", collegeId: null, name: "Design", shortName: "DSGN" },
  { id: "dep-other", collegeId: null, name: "Other", shortName: null },
];

/** slug matches WORLD_LOCATIONS keys so the map filters events. */
const CATEGORIES: EventCategory[] = [
  { id: "cat-hack", slug: "hackathon-mine", name: "Hackathon Mine", description: "Build something real, overnight.", worldLocationKey: "hackathon-mine", blockColor: "mc-emerald", sortOrder: 1 },
  { id: "cat-photo", slug: "photography-forest", name: "Photography Forest", description: "Capture the realm.", worldLocationKey: "photography-forest", blockColor: "mc-grass", sortOrder: 2 },
  { id: "cat-design", slug: "design-workshop", name: "Design Workshop", description: "Craft interfaces and posters.", worldLocationKey: "design-workshop", blockColor: "mc-planks", sortOrder: 3 },
  { id: "cat-quiz", slug: "quiz-library", name: "Quiz Library", description: "Test your knowledge.", worldLocationKey: "quiz-library", blockColor: "mc-diamond", sortOrder: 4 },
  { id: "cat-gaming", slug: "gaming-arena", name: "Gaming Arena", description: "Tournaments and brackets.", worldLocationKey: "gaming-arena", blockColor: "mc-redstone", sortOrder: 5 },
  { id: "cat-culture", slug: "culture-stage", name: "Culture Stage", description: "Music, dance and drama.", worldLocationKey: null, blockColor: "mc-gold", sortOrder: 6 },
  { id: "cat-robotics", slug: "circuit-lab", name: "Circuit Lab", description: "Robotics and hardware.", worldLocationKey: null, blockColor: "mc-stone", sortOrder: 7 },
];

/** Original rank names — no Mojang terminology (no "Redstone", "Ender", etc.). */
const LEVELS: Level[] = [
  { level: 1, minXp: 0, title: "Wanderer" },
  { level: 2, minXp: 100, title: "Settler" },
  { level: 3, minXp: 250, title: "Delver" },
  { level: 4, minXp: 500, title: "Adventurer" },
  { level: 5, minXp: 1000, title: "Circuit Sage" },
  { level: 6, minXp: 1750, title: "Starborn" },
  { level: 7, minXp: 2750, title: "Realm Legend" },
];

const ACHIEVEMENTS: Achievement[] = [
  { id: "ach-first-steps", code: "first_steps", name: "First Steps", description: "Join the Parallax.", flavorText: "Every legend starts somewhere.", rarity: "common", xpReward: 25, triggerType: "profile_completed", triggerConfig: {}, isSecret: false, isActive: true, sortOrder: 1 },
  { id: "ach-explorer", code: "explorer", name: "Explorer", description: "Register for your first event.", flavorText: "The realm opens up.", rarity: "common", xpReward: 30, triggerType: "first_registration", triggerConfig: {}, isSecret: false, isActive: true, sortOrder: 2 },
  { id: "ach-team-player", code: "team_player", name: "Team Player", description: "Create or join a team.", flavorText: "Better together.", rarity: "uncommon", xpReward: 50, triggerType: "team_created", triggerConfig: {}, isSecret: false, isActive: true, sortOrder: 3 },
  { id: "ach-showed-up", code: "showed_up", name: "Showed Up", description: "Check in to your first event.", flavorText: "Attendance is half the battle.", rarity: "uncommon", xpReward: 40, triggerType: "event_attended", triggerConfig: {}, isSecret: false, isActive: true, sortOrder: 4 },
  { id: "ach-triple-threat", code: "triple_threat", name: "Triple Threat", description: "Attend three events.", flavorText: "Busy adventurer.", rarity: "rare", xpReward: 100, triggerType: "events_attended_count", triggerConfig: { count: 3 }, isSecret: false, isActive: true, sortOrder: 5 },
  { id: "ach-marathon", code: "marathon", name: "Marathon Runner", description: "Attend five events.", flavorText: "Do you ever sleep?", rarity: "epic", xpReward: 200, triggerType: "events_attended_count", triggerConfig: { count: 5 }, isSecret: false, isActive: true, sortOrder: 6 },
  { id: "ach-apprentice", code: "apprentice", name: "Apprentice", description: "Reach 250 XP.", flavorText: null, rarity: "common", xpReward: 0, triggerType: "xp_threshold", triggerConfig: { xp: 250 }, isSecret: false, isActive: true, sortOrder: 7 },
  { id: "ach-veteran", code: "veteran", name: "Veteran", description: "Reach 1000 XP.", flavorText: null, rarity: "rare", xpReward: 0, triggerType: "xp_threshold", triggerConfig: { xp: 1000 }, isSecret: false, isActive: true, sortOrder: 8 },
  { id: "ach-legend", code: "realm_legend", name: "Realm Legend", description: "Reach 2750 XP.", flavorText: "The realm remembers your name.", rarity: "legendary", xpReward: 0, triggerType: "xp_threshold", triggerConfig: { xp: 2750 }, isSecret: false, isActive: true, sortOrder: 9 },
  { id: "ach-night-owl", code: "night_owl", name: "Night Owl", description: "Register for an event after midnight.", flavorText: "Who needs sleep?", rarity: "rare", xpReward: 60, triggerType: "manual", triggerConfig: {}, isSecret: true, isActive: true, sortOrder: 10 },
  { id: "ach-completionist", code: "completionist", name: "Completionist", description: "Register in every category.", flavorText: "A true realm explorer.", rarity: "legendary", xpReward: 250, triggerType: "manual", triggerConfig: {}, isSecret: true, isActive: true, sortOrder: 11 },
  { id: "ach-early-bird", code: "early_bird", name: "Early Bird", description: "Be among the first 10 to register for an event.", flavorText: null, rarity: "uncommon", xpReward: 45, triggerType: "manual", triggerConfig: {}, isSecret: false, isActive: true, sortOrder: 12 },
];

function makeEvents(): FestEvent[] {
  const base = {
    rules: "Bring your own laptop. Team changes are not permitted after check-in. Judges' decisions are final.",
    registrationOpensAt: iso(-14 * DAY),
    entryFeeInr: 0,
    requiresApproval: false,
    contactEmail: "organizers@parallax.test",
    createdBy: null,
    createdAt: iso(-20 * DAY),
    updatedAt: iso(-2 * DAY),
  };

  const defs: Array<Partial<FestEvent> & Pick<FestEvent, "id" | "slug" | "title" | "categoryId" | "startsAt" | "endsAt">> = [
    { id: "evt-hack-24", slug: "code-crafters-24h", title: "CodeCrafters 24H", tagline: "Build a working product in a day.", categoryId: "cat-hack", mode: "team", minTeamSize: 2, maxTeamSize: 4, capacity: 120, venue: "Main Auditorium", startsAt: iso(2 * DAY), endsAt: iso(3 * DAY), xpReward: 200 },
    { id: "evt-hack-ai", slug: "ai-dungeon-sprint", title: "AI Dungeon Sprint", tagline: "6-hour ML sprint.", categoryId: "cat-hack", mode: "team", minTeamSize: 1, maxTeamSize: 3, capacity: 60, venue: "CS Lab 2", startsAt: iso(5 * DAY), endsAt: iso(5 * DAY + 6 * HOUR), xpReward: 150 },
    { id: "evt-photo-walk", slug: "golden-hour-walk", title: "Golden Hour Walk", tagline: "Campus photo walk with critique.", categoryId: "cat-photo", mode: "solo", capacity: 40, venue: "Meet at Main Gate", startsAt: iso(1 * DAY + 11 * HOUR), endsAt: iso(1 * DAY + 14 * HOUR), xpReward: 60 },
    { id: "evt-photo-contest", slug: "realm-through-lens", title: "Realm Through a Lens", tagline: "Themed photo contest.", categoryId: "cat-photo", mode: "solo", capacity: null, venue: "Online submission", startsAt: iso(-1 * DAY), endsAt: iso(6 * DAY), xpReward: 80 },
    { id: "evt-design-ui", slug: "pixel-perfect-ui", title: "Pixel Perfect UI", tagline: "Design a game UI in 3 hours.", categoryId: "cat-design", mode: "solo", capacity: 50, venue: "Design Studio", startsAt: iso(3 * DAY + 4 * HOUR), endsAt: iso(3 * DAY + 7 * HOUR), xpReward: 90 },
    { id: "evt-design-poster", slug: "poster-forge", title: "Poster Forge", tagline: "Rapid poster design battle.", categoryId: "cat-design", mode: "team", minTeamSize: 2, maxTeamSize: 2, capacity: 30, venue: "Design Studio", startsAt: iso(4 * DAY), endsAt: iso(4 * DAY + 3 * HOUR), xpReward: 70 },
    { id: "evt-quiz-tech", slug: "brainmines-tech-quiz", title: "BrainMines Tech Quiz", tagline: "Three rounds, no mercy.", categoryId: "cat-quiz", mode: "team", minTeamSize: 2, maxTeamSize: 3, capacity: 64, venue: "Seminar Hall A", startsAt: iso(2 * DAY + 6 * HOUR), endsAt: iso(2 * DAY + 9 * HOUR), xpReward: 100 },
    { id: "evt-quiz-gk", slug: "general-knowledge-gauntlet", title: "GK Gauntlet", tagline: "Everything under the sun.", categoryId: "cat-quiz", mode: "solo", capacity: 100, venue: "Seminar Hall B", startsAt: iso(6 * DAY), endsAt: iso(6 * DAY + 2 * HOUR), xpReward: 60 },
    { id: "evt-game-valorant", slug: "arena-fps-cup", title: "Arena FPS Cup", tagline: "5v5 elimination bracket.", categoryId: "cat-gaming", mode: "team", minTeamSize: 5, maxTeamSize: 5, capacity: 80, venue: "Gaming Arena", startsAt: iso(3 * DAY), endsAt: iso(4 * DAY), xpReward: 150 },
    { id: "evt-game-retro", slug: "retro-block-battle", title: "Retro Block Battle", tagline: "Classic games, modern stakes.", categoryId: "cat-gaming", mode: "solo", capacity: 32, venue: "Gaming Arena", startsAt: iso(1 * DAY + 8 * HOUR), endsAt: iso(1 * DAY + 12 * HOUR), xpReward: 70 },
    { id: "evt-culture-band", slug: "battle-of-bands", title: "Battle of the Bands", tagline: "Live music finals.", categoryId: "cat-culture", mode: "team", minTeamSize: 3, maxTeamSize: 8, capacity: 20, venue: "Open Air Stage", startsAt: iso(4 * DAY + 10 * HOUR), endsAt: iso(4 * DAY + 15 * HOUR), xpReward: 120 },
    { id: "evt-robotics-line", slug: "circuit-line-follower", title: "Line Follower Championship", tagline: "Fastest bot wins.", categoryId: "cat-robotics", mode: "team", minTeamSize: 1, maxTeamSize: 3, capacity: 40, venue: "Robotics Lab", startsAt: iso(5 * DAY + 5 * HOUR), endsAt: iso(5 * DAY + 9 * HOUR), xpReward: 110 },
    // One completed event so "past events" and certificates have data.
    { id: "evt-past-workshop", slug: "git-basics-workshop", title: "Git Basics Workshop", tagline: "Version control from zero.", categoryId: "cat-design", mode: "solo", capacity: 60, venue: "CS Lab 1", startsAt: iso(-5 * DAY), endsAt: iso(-5 * DAY + 3 * HOUR), xpReward: 40, status: "completed" },
  ];

  return defs.map((d) => ({
    tagline: null,
    description:
      "Full details will be shared with registered participants closer to the date. " +
      "Arrive 15 minutes early for check-in — you will need your QR pass.",
    status: "published" as const,
    mode: "solo" as const,
    minTeamSize: 1,
    maxTeamSize: 1,
    capacity: null,
    venue: null,
    registrationClosesAt: null,
    xpReward: 50,
    ...base,
    ...d,
  })) as FestEvent[];
}

function makeSchedule(events: FestEvent[]): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [
    { id: "sch-open", eventId: null, title: "Opening Ceremony", dayLabel: "Day 1", startsAt: iso(1 * DAY + 6 * HOUR), endsAt: iso(1 * DAY + 7 * HOUR), venue: "Main Auditorium", track: null, isBreak: false },
    { id: "sch-lunch-1", eventId: null, title: "Lunch Break", dayLabel: "Day 1", startsAt: iso(1 * DAY + 13 * HOUR), endsAt: iso(1 * DAY + 14 * HOUR), venue: "Food Court", track: null, isBreak: true },
    { id: "sch-close", eventId: null, title: "Prize Distribution & Closing", dayLabel: "Day 3", startsAt: iso(6 * DAY + 10 * HOUR), endsAt: iso(6 * DAY + 12 * HOUR), venue: "Main Auditorium", track: null, isBreak: false },
  ];

  // Derive a slot per upcoming event so the schedule matches the events list
  // rather than duplicating hand-written times that could drift out of sync.
  const eventSlots: ScheduleSlot[] = events
    .filter((e) => e.status === "published")
    .map((e) => {
      const days = Math.max(1, Math.ceil((new Date(e.startsAt).getTime() - Date.now()) / DAY));
      return {
        id: `sch-${e.id}`,
        eventId: e.id,
        title: e.title,
        dayLabel: `Day ${Math.min(days, 3)}`,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        venue: e.venue,
        track: null,
        isBreak: false,
      };
    });

  return [...slots, ...eventSlots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
}

const SPONSORS: Sponsor[] = [
  { id: "spn-1", name: "Circuitworks Systems", tier: "diamond", websiteUrl: "https://example.com", blurb: "Powering the realm's infrastructure.", sortOrder: 1, isActive: true },
  { id: "spn-2", name: "Deepstone Cloud", tier: "diamond", websiteUrl: "https://example.com", blurb: "Cloud credits for every participant.", sortOrder: 2, isActive: true },
  { id: "spn-3", name: "Emerald Ventures", tier: "gold", websiteUrl: "https://example.com", blurb: null, sortOrder: 3, isActive: true },
  { id: "spn-4", name: "Pixel Labs", tier: "gold", websiteUrl: "https://example.com", blurb: null, sortOrder: 4, isActive: true },
  { id: "spn-5", name: "Crafting Table Coffee", tier: "iron", websiteUrl: null, blurb: "Fuel for the 24-hour hack.", sortOrder: 5, isActive: true },
  { id: "spn-6", name: "Iron Pickaxe Tools", tier: "iron", websiteUrl: null, blurb: null, sortOrder: 6, isActive: true },
  { id: "spn-7", name: "Cobblestone Prints", tier: "stone", websiteUrl: null, blurb: null, sortOrder: 7, isActive: true },
];

function makeAnnouncements(): Announcement[] {
  return [
    { id: "ann-1", scope: "global", eventId: null, collegeId: null, title: "Registrations are open!", body: "All events are now open for registration. Portal closes 24 hours before each event.", severity: "success", isPinned: true, publishedAt: iso(-3 * DAY), expiresAt: null, createdBy: null },
    { id: "ann-2", scope: "event", eventId: "evt-hack-24", collegeId: null, title: "CodeCrafters 24H: bring your own laptop", body: "Power strips will be provided. Wi-Fi credentials are handed out at check-in.", severity: "info", isPinned: false, publishedAt: iso(-1 * DAY), expiresAt: null, createdBy: null },
    { id: "ann-3", scope: "global", eventId: null, collegeId: null, title: "Venue change for Quiz Library", body: "BrainMines Tech Quiz moves to Seminar Hall A. Signage will be updated.", severity: "warning", isPinned: false, publishedAt: iso(-6 * HOUR), expiresAt: null, createdBy: null },
  ];
}

/**
 * Skin ids were renamed away from Mojang's copyrighted character names.
 * Anyone who created a character before that rename has a now-invalid id in
 * storage, which would render a broken avatar. Map the old values across on
 * read rather than wiping their character.
 */
const LEGACY_SKIN_MAP: Record<string, string> = {
  steve: "prospector",
  alex: "botanist",
  creeper: "sentinel",
  enderman: "voidwalker",
  miner: "artificer",
};

function migrateLegacySkins(): void {
  const chars = readList<{ skinId: string }>("characters");
  if (chars.length === 0) return;

  let changed = false;
  const migrated = chars.map((c) => {
    const next = LEGACY_SKIN_MAP[c.skinId];
    if (!next) return c;
    changed = true;
    return { ...c, skinId: next };
  });

  if (changed) write("characters", migrated);
}

/**
 * Seeds reference + demo data exactly once. Idempotent: safe to call on every
 * app start, which is how it is wired (the repository calls it lazily).
 */
export function seedIfNeeded(): void {
<<<<<<< HEAD
  const meta = read<{ seededAt?: string }>("meta", {});
  if (meta.seededAt && readList("events").length > 0) {
=======
  const meta = read<{ seededAt?: string; feesSeededV1?: boolean; feesSeededV2?: boolean }>("meta", {});
  if (meta.seededAt && readList("events").length > 0) {
    if (!meta.feesSeededV2) {
      const existingEvents = readList<FestEvent>("events");
      const updated = existingEvents.map((e) => ({
        ...e,
        entryFeeInr: 0,
      }));
      write("events", updated);
      write("meta", { ...meta, feesSeededV1: true, feesSeededV2: true });
    }
>>>>>>> kartik-branch
    // Cheap no-op once every character is on a current skin id.
    migrateLegacySkins();
    return;
  }

  const events = makeEvents();

  write("colleges", COLLEGES);
  write("departments", DEPARTMENTS);
  write("categories", CATEGORIES);
  write("levels", LEVELS);
  write("achievements", ACHIEVEMENTS);
  write("events", events);
  write("schedule", makeSchedule(events));
  write("sponsors", SPONSORS);
  write("announcements", makeAnnouncements());

  // Collections that start empty but must exist so reads are predictable.
  for (const c of [
    "profiles",
    "credentials",
    "roles",
    "characters",
    "registrations",
    "teams",
    "teamMembers",
    "attendance",
    "userAchievements",
    "xpLedger",
  ] as const) {
    if (readList(c).length === 0) write(c, []);
  }

  write("meta", { seededAt: new Date().toISOString(), version: 1 });
}

/** Full reset — used by the dev tools panel. */
export function reseed(): void {
  write("meta", {});
  seedIfNeeded();
}
