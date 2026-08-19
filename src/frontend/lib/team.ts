/**
 * THE SINGLE SOURCE OF TRUTH FOR THE TEAM ROSTER.
 *
 * The /about page renders these lists directly — no component hardcodes a
 * name or title, matching the rule `fest.ts` already sets for every other fest
 * fact. Add or update a person here and every card updates with them.
 */

import type { SkinId } from "./assets/manifest";

const SKIN_CYCLE: SkinId[] = ["prospector", "botanist", "sentinel", "voidwalker", "artificer"];

/**
 * Deterministic placeholder avatar, not a random one — the same name always
 * gets the same skin across reloads and renders, without hand-assigning one
 * to each of the ~35 people on this page.
 */
export function skinFor(name: string): SkinId {
  const sum = [...name].reduce((total, ch) => total + ch.charCodeAt(0), 0);
  return SKIN_CYCLE[sum % SKIN_CYCLE.length];
}

export interface TeamMember {
  name: string;
  /** Role, department, or "<year> <programme> <section>" — whatever the group uses. */
  subtitle: string;
  /** Short tagline. Not every group has one. */
  blurb?: string;
}

export const FACULTY_COORDINATORS: TeamMember[] = [
  { name: "Dr. Neha Singhal", subtitle: "Assistant Professor", blurb: "Guiding us through the Upside Down." },
  { name: "Dr. Shivangi Singh", subtitle: "Assistant Professor", blurb: "Lighting the way for all." },
  { name: "Dr. Nizar Banu", subtitle: "Associate Professor", blurb: "The mind behind the code." },
];

export const CORE_COMMITTEE: TeamMember[] = [
  { name: "Aimee Joseph", subtitle: "4 MCA B", blurb: "Stranger things within" },
  { name: "Abhinav Jain", subtitle: "4 MCA B", blurb: "Stranger things within." },
  { name: "Hitesh", subtitle: "4 MSC AIML", blurb: "The code whisperer." },
];

export interface CommitteeHead extends TeamMember {
  /** The team this head runs, e.g. "Decorations" — its own line above the name/year. */
  team: string;
}

export const COMMITTEE_HEADS: CommitteeHead[] = [
  { name: "Annie Neena A A", team: "Audi Management", subtitle: "3 MCA B" },
  { name: "Binosh Sibi", team: "Audi Management", subtitle: "3 MSC AIML" },
  { name: "Shreya G", team: "Culturals (Dance)", subtitle: "3 MSC AIML" },
  { name: "Jai Pareek", team: "Culturals (Dance)", subtitle: "3 MCA B" },
  { name: "Aadharsh Krishnaa G", team: "Culturals (Music)", subtitle: "3 MCA B" },
  { name: "Omkaar Chakraborty", team: "Culturals (Music)", subtitle: "3 MCA B" },
  { name: "Bhagyashree Roy", team: "Decorations", subtitle: "3 MCA A" },
  { name: "Sheethal T Kochery", team: "Decorations", subtitle: "3 MSC AIML" },
  { name: "Kusum S", team: "Designs", subtitle: "3 MSC AIML" },
  { name: "Praneeth M", team: "Designs", subtitle: "3 MCA A" },
  { name: "Kanika Jain", team: "Documentation", subtitle: "3 MCA A" },
  { name: "Sharon Mathew", team: "Documentation", subtitle: "3 MCA B" },
  { name: "JV Baarathi", team: "Events", subtitle: "3 MSC AIML" },
  { name: "Abhinav Jain", team: "Events", subtitle: "3 MCA B" },
  { name: "Jariwala Mohit S", team: "Finance", subtitle: "3 MSC AIML" },
  { name: "Nishit Daruwala", team: "Finance", subtitle: "3 MSC AIML" },
  { name: "Ananya Pillai", team: "Hospitality", subtitle: "3 MSC AIML" },
  { name: "R Karan", team: "Hospitality", subtitle: "3 MCA B" },
  { name: "Ekta Singh", team: "Infobahn", subtitle: "3 MCA B" },
  { name: "Neha N", team: "Infobahn", subtitle: "3 MCA A" },

  { name: "Joshua V. Praveen", team: "Logistics", subtitle: "3 MSC AIML" },
  { name: "Amogh Sahore", team: "Media", subtitle: "3 MCA A" },
  { name: "Deon Binny", team: "Media", subtitle: "3 MSC AIML" },
];

export const WEBSITE_DEVELOPERS: TeamMember[] = [
  { name: "Yanish Rai", subtitle: "4 MCA A", blurb: "Crafting portals to new worlds." },
  { name: "Kartik Dewnani", subtitle: "4 MCA A", blurb: "Animating the Upside Down." },
  { name: "Darshan Heble", subtitle: "4 MCA A", blurb: "Code, coffee, and curiosity." },
  { name: "Anand", subtitle: "1 MCA A", blurb: "Code, coffee, and curiosity." },
  { name: "Gokul", subtitle: "1 MCA B", blurb: "Code, coffee, and curiosity." },

];

