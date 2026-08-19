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
  },

  /** All rupee figures. TODO — confirm every one of these for 2026. */
  money: {
    /**
     * Tiered registration fees — one pass covers every event a participant enters.
     * Early-bird window and exact cutoff date are set by the organising team.
     */
    registration: REGISTRATION_FEES,
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
    "Sign in and create your character.",
    `Pay the registration fee — ${inr(REGISTRATION_FEES.earlyBirdInr)} early bird, ${inr(REGISTRATION_FEES.standardInr)} standard, or ${inr(REGISTRATION_FEES.onSpotInr)} on the spot. One pass covers every event.`,
    "Upload the payment receipt (PDF) and wait for verification.",
    "Browse the events and open the one you want.",
    "Read its rules, team size and timing, then hit Register.",
    "Fill in your participant details — asked once, reused for every event.",
    "Once we verify the receipt, event registration is unlocked.",
  ],

  /** TODO — replace with the 2026 organising team. */
  contacts: [
    { name: "Reno Riji Mathew", phone: "+91 9945135960", email: "renoreji.matthew@mca.christuniversity.in", role: "Registration & Payments" },
    { name: "Abhinav Jain", phone: "+91 9214544078", email: "abhinav.jain@mca.christuniversity.in", role: "General Convenor" },
    { name: "Slaven Dereck Pais", phone: "+91 9844373547", email: "slavenderick.pais@mca.christuniversity.in", role: "Hospitality" },
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
