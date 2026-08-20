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
  /**
   * Public path to a real photograph, e.g. `/art/team/faculty/neha-singhal.jpg`.
   *
   * Set on the faculty groups ahead of the files themselves: the card falls
   * back to the pixel avatar when the image is missing or fails to load, so a
   * path that is not filled in yet costs nothing and the photo appears the
   * moment someone drops the file at that path.
   *
   * Naming rule, should more people need one: the name lowercased, honorifics
   * dropped, punctuation removed, spaces hyphenated. Square crop, 256px or
   * larger — the card renders at 48px and centre-crops with `object-cover`.
   */
  image?: string;
}

/**
 * Where faculty photographs live. One constant rather than the prefix repeated
 * on eight entries, so the folder can be renamed in a single edit.
 */
const FACULTY_PHOTOS = "/art/team/faculty";

export const ADVISORY_COMMITTEE: TeamMember[] = [
  { name: "Dr. Fr. Jossy P George", subtitle: "Director CS, Statistics & DS", image: `${FACULTY_PHOTOS}/jossy-p-george.jpg` },
  { name: "Dr. Deepthi Das", subtitle: "Associate Dean", image: `${FACULTY_PHOTOS}/deepthi-das.jpg` },
  { name: "Dr. Rupali Sunil Wagh", subtitle: "Head of Department", image: `${FACULTY_PHOTOS}/rupali-sunil-wagh.jpg` },
  { name: "Dr. Gobi Ramasamy", subtitle: "Associate HOD", image: `${FACULTY_PHOTOS}/gobi-ramasamy.jpg` },
  { name: "Dr. Cynthia T", subtitle: "PG Program Coordinator", image: `${FACULTY_PHOTOS}/cynthia-t.jpg` },
];

export const FACULTY_COORDINATORS: TeamMember[] = [
  { name: "Dr. Neha Singhal", subtitle: "Assistant Professor", image: `${FACULTY_PHOTOS}/neha-singhal.jpg` },
  { name: "Dr. Shivangi Singh", subtitle: "Assistant Professor", image: `${FACULTY_PHOTOS}/shivangi-singh.jpg` },
  { name: "Dr. Nizar Banu P K", subtitle: "Associate Professor", image: `${FACULTY_PHOTOS}/nizar-banu-p-k.jpg` },
];

export const CORE_COMMITTEE: TeamMember[] = [
  { name: "Smitha M", subtitle: "4 MSC AIML (2548556)" },
  { name: "Shambhavi Sinha", subtitle: "4 MCA A (2547151)" },
  { name: "Aimee Susan Joseph", subtitle: "4 MCA B (2547204)" },
  { name: "Hitesh Kumar", subtitle: "4 MSC AIML (2548525)" },
  { name: "Joshua Joby", subtitle: "4 MCA A (2547125)" },
  { name: "Abhinav Jain", subtitle: "4 MCA B (2547203)" },
  { name: "Joseph Alicia Elias", subtitle: "1 MSC AIML (2648525)" },
  { name: "Anooja Sreenivasan", subtitle: "1 MCA A (2647114)" },
  { name: "Haniya Zehra Mody", subtitle: "1 MCA B (2647225)" },
  { name: "Ronith Tharun Joshi", subtitle: "1 MSC AIML (2648545)" },
  { name: "Iwin Jose", subtitle: "1 MCA A (2647126)" },
  { name: "Shiva A Karthik", subtitle: "1 MCA B (2647247)" },
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

/**
 * The people who build and run the website and application.
 *
 * `subtitle` is the class here, not the role — "Technical (Website /
 * Application)" is what the section itself says, so repeating it on all seven
 * cards would be noise. The two members with no class on record carry the role
 * instead; the field is documented as taking either.
 */
export const TECHNICAL_COMMITTEE: TeamMember[] = [
  { name: "Yanish Rai", subtitle: "4 MCA A", blurb: "Crafting portals to new worlds." },
  { name: "Kartik Dewnani", subtitle: "4 MCA A", blurb: "Animating the Upside Down." },
  { name: "Darshan Heble", subtitle: "4 MCA A", blurb: "Code, coffee, and curiosity." },
  { name: "Vishal B G", subtitle: "Website / Application" },
  { name: "Gerard Nicholas Paul M", subtitle: "Website / Application" },
  { name: "S Anand", subtitle: "1 MCA A", blurb: "Code, coffee, and curiosity." },
  { name: "Gokul T A", subtitle: "1 MCA B", blurb: "Code, coffee, and curiosity." },
];

