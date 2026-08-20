/**
 * THE SINGLE SOURCE OF TRUTH FOR EVERY FEST FACT.
 *
 * Dates, money, phone numbers and links change late and change often, and they
 * are exactly the things that get missed when they are scattered across a dozen
 * components. No homepage section may hardcode one — import from here.
 *
 * Values still marked `TODO` are placeholders carried over from the 2025
 * edition or invented as shape-correct stand-ins. Before launch:
 *
 *     grep -n "TODO" src/frontend/lib/fest.ts
 *
 * lists exactly what needs a real answer. Everything renders correctly with the
 * placeholders in place, so the page is demoable today.
 */

export interface FestContact {
  name: string;
  phone: string;
  email: string;
  role?: string;
}

export interface FestSocial {
  label: string;
  href: string;
}

/** Formats a rupee figure with Indian digit grouping: 63000 → "₹63,000". */
export function inr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Facts that appear in more than one place on the page.
 *
 * Hoisted out of the `FEST` literal so the sky announcements and the
 * registration steps can interpolate them rather than restating them. They were
 * spelled out twice
 * before, and a date change is exactly the moment two copies of the same fact
 * quietly stop agreeing — which is what happened here.
 */
const HACKATHON_DATE_LABEL = "30 September 2026";
const PRIZE_POOL_INR = 250_000;

/** Tiered registration fees (domestic/international, time-of-purchase). */
/**
 * The rates a participant can claim to have paid, each with the window it is
 * valid in.
 *
 * The dates used to live as hardcoded text in the fees table on the homepage,
 * where nothing could read them. They matter now: the payment upload only
 * offers the tiers that are actually open on the day, so a participant cannot
 * claim an early-bird rate in October.
 *
 * `opensOn`/`closesOn` are inclusive IST calendar dates. Comparison is
 * date-only on purpose — a tier that "closes on the 9th" is good all of the 9th.
 */
export interface RegistrationTier {
  id: "early_bird" | "standard" | "on_spot" | "christite" | "international";
  label: string;
  amountInr: number;
  opensOn: string;
  closesOn: string;
  /** Who the tier is for, when that is not obvious from the label. */
  note?: string;
}

const REGISTRATION_TIERS: RegistrationTier[] = [
  { id: "early_bird", label: "Early bird", amountInr: 200, opensOn: "2026-08-17", closesOn: "2026-09-09" },
  { id: "standard", label: "Standard", amountInr: 250, opensOn: "2026-09-09", closesOn: "2026-10-07" },
  { id: "on_spot", label: "On the spot", amountInr: 300, opensOn: "2026-10-08", closesOn: "2026-10-09" },
  { id: "christite", label: "Christite", amountInr: 200, opensOn: "2026-08-17", closesOn: "2026-10-09", note: "CHRIST students" },
  { id: "international", label: "International", amountInr: 1_000, opensOn: "2026-08-17", closesOn: "2026-10-09", note: "International participants" },
];

/** IST calendar date as `YYYY-MM-DD`, so windows are compared in fest time. */
function istDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Tiers open on a given day. Returns every tier if the fest has not opened yet
 * or has closed — an empty picker would leave someone who genuinely paid with
 * no way to say what they paid, which is worse than showing a stale option.
 */
export function openRegistrationTiers(at: Date = new Date()): RegistrationTier[] {
  const today = istDate(at);
  const open = REGISTRATION_TIERS.filter(
    (tier) => tier.opensOn <= today && today <= tier.closesOn,
  );
  return open.length ? open : REGISTRATION_TIERS;
}

const REGISTRATION_FEES = {
  /** Domestic early-bird rate. */
  earlyBirdInr: 200,
  /** Domestic standard rate (after early-bird window closes). */
  standardInr: 250,
  /** At-the-door rate on the day of the fest. */
  onSpotInr: 300,
  /** On campus rate for Christites. */
  christiteInr: 200,
  /** Flat rate for international participants. */
  internationalInr: 1_000,
} as const;

export const FEST = {
  /** Display name of this edition. */
  edition: "Gateways 2026",
  shortEdition: "GATEWAYS 2026",

  theme: {
    /** The event name — also the project's name. */
    name: "Parallax",
    /** The technical subject the theme dramatises. */
    subject: "Digital Twins",
    /** Hero tagline, verbatim from the theme deck. */
    tagline:
      "See reality from two perspectives at once: the physical world and its living digital mirror.",
    /** One-line reduction used in metadata and the nav. */
    blurb: "One reality. Two vantage points. Better decisions.",
  },

  /**
   * Countdown target and the two fest days.
   * ISO with an explicit +05:30 offset so the countdown is identical for a
   * visitor in another timezone; a bare local string would drift.
   *
   * The times of day are still assumptions — 09:30 open on day one and 18:00
   * close on day two, mirroring 2025's inauguration and valedictory slots.
   * TODO — confirm the start and end times; the DATES are confirmed.
   */
  datesIso: {
    start: "2026-10-08T09:30:00+05:30",
    end: "2026-10-09T18:00:00+05:30",
  },
  /** Human-readable date line under the hero wordmark. */
  dateLabel: "8 & 9 October 2026",
  /**
   * Hackathon runs ahead of the main fest, as it did in 2025 (six days early).
   * TODO — confirm; this is derived from the fest dates, not given.
   */
  hackathonDateLabel: HACKATHON_DATE_LABEL,

  /** TODO — 2025 said "over 29 years", so 2026 should be 30. Confirm. */
  yearsRunning: 30,

  host: {
    department: "Department of Computer Science",
    programmes: "MCA · MSc AI-ML",
    university: "CHRIST (Deemed to be University)",
    universityUrl: "https://christuniversity.in",
    city: "Bangalore",
    address: "Dharmaram College Post, Hosur Rd, Bengaluru, Karnataka 560029",

    /**
     * How to reach the campus, rendered under Location on /contact.
     *
     * Distances are approximate road distances, not straight-line — quoted as
     * the university publishes them. Bus numbers are BMTC routes; they are
     * strings, not numbers, because several carry letters ("168D", "KBS 3A")
     * and the numeric-looking ones must not be reformatted or sorted.
     */
    reach: {
      nearest: [
        { label: "Airport", place: "Kempegowda Intl. Airport", distance: "40 km" },
        { label: "Railway Station", place: "KSR Bengaluru City Jn.", distance: "10 km" },
        { label: "Bus Terminus", place: "Kempegowda Bus Stand (Majestic)", distance: "10 km" },
        { label: "Metro Station", place: "R V Road (Green Line)", distance: "5.6 km" },
      ],
      /** The stop is not named after the campus on every board — hence the ask. */
      busStopNote: "Ask for Christ University / Dairy Circle Bus Stop",
      busRoutes: [
        {
          from: "From Majestic / KSR Bengaluru",
          routes: [
            "365", "353", "168D", "170", "171A", "171B", "171C", "171D",
            "165", "340", "342", "356", "360B", "KBS 3A", "KBS 3C",
          ],
        },
        { from: "From Airport", routes: ["KIA-5", "KIA-7", "KIA-14"] },
      ],
      cabNote:
        "Cab and auto rickshaw services can be availed via Ola, Uber, Rapido, and NammaYatri apps.",
    },
  },

  /** All rupee figures. TODO — confirm every one of these for 2026. */
  money: {
    /**
     * Tiered registration fees — one pass covers every event a participant enters.
     * Early-bird window and exact cutoff date are set by the organising team.
     */
    registration: REGISTRATION_FEES,
    /** Same rates as `registration`, with the window each one is valid in. */
    tiers: REGISTRATION_TIERS,
    prizePoolInr: PRIZE_POOL_INR,
    accommodationPerDayInr: 300,
    accommodationNote: "Per person per day",
  },

  links: {
    /**
     * Registration is on this site now, not an external form: pay the
     * fest-wide pass first, then pick events and complete your participant
     * details. `/events` is the entry point for both steps.
     */
    register: "/events",
    /** TODO — the real brochure link. */
    brochure: "#",
  },

  /**
   * The registration walkthrough, rendered as a numbered recipe.
   *
   * Payment happens before registration. These steps are the visitor-facing
   * statement of that order, so they must stay in step with the branch ladder
   * in `event-detail-screen.tsx`.
   */
  registerSteps: [
    "Sign in to your account.",
    `Pay the registration fee — ${inr(REGISTRATION_FEES.earlyBirdInr)} early bird, ${inr(REGISTRATION_FEES.standardInr)} standard, or ${inr(REGISTRATION_FEES.onSpotInr)} on the spot. One pass covers every event.`,
    "Upload the payment receipt (PDF) and wait for verification.",
    "Browse the events and open the one you want.",
    "Read its rules, team size and timing, then hit Register.",
    "Fill in your participant details — asked once, reused for every event.",
    "Once we verify the receipt, event registration is unlocked.",
  ],

  /** TODO — replace with the 2026 organising team. */
  contacts: [
    { name: "Reno Riji Matthew", phone: "+91 9945135960", role: "Registration & Payments" },
    { name: "Abhinav Jain", phone: "+91 9214544078", role: "General Convenor" },
    { name: "Slaven Dereck Pais", phone: "+91 9844373547", role: "Hospitality" },
    { name: "Gateways Queries", phone: "", email: "gateways@christuniversity.in", role: "General Enquiries" },
  ] as FestContact[],

  /** TODO — point these at the fest's own handles once they exist. */
  socials: [
    { label: "Instagram", href: "https://www.instagram.com/christ_university_bangalore/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/school/christ-university-bangalore/" },
    { label: "YouTube", href: "https://www.youtube.com/@gateways-2024" },
  ] as FestSocial[],

  /** The rolling announcement bar. TODO — confirm the copy each time it changes. */
  announcements: [
    "Registrations are open",
    `Prize pool ${inr(PRIZE_POOL_INR)}`,
    `Hackathon begins ${HACKATHON_DATE_LABEL}`,
    "One reality. Two vantage points.",
  ],
} as const;
