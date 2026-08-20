"use client";

import { useState } from "react";
import { BackLink, BlockPanel, PixelAvatar } from "@/frontend/components/mc";
import { cn } from "@/frontend/lib/utils";
import {
  skinFor,
  FACULTY_COORDINATORS,
  CORE_COMMITTEE,
  ADVISORY_COMMITTEE,
  COMMITTEE_HEADS,
  TECHNICAL_COMMITTEE,
  type TeamMember,
  type CommitteeHead,
} from "@/frontend/lib/team";

/**
 * The people behind the fest — faculty coordinators, the core committee,
 * committee heads, and the technical committee. A standalone page rather than a
 * homepage section: this is the credits list you link directly, not
 * something a first-time visitor needs mid-pitch.
 */
export function AboutScreen() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-[calc(var(--mc-unit)*2)] px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*1.5)] md:p-[calc(var(--mc-unit)*2)]">
      <BackLink href="/" label="Home" />

      <header>
        <h1 className="text-mc-accent text-base md:text-lg">ABOUT</h1>
        <p className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text-dim">
          The faculty, students, and builders running the realm.
        </p>
      </header>

      <TeamSection title="Advisory Committee" members={ADVISORY_COMMITTEE} />
      <TeamSection title="Faculty Coordinators" members={FACULTY_COORDINATORS} />
      <TeamSection title="Core Committee" members={CORE_COMMITTEE} />
      <CommitteeHeadsSection />
      <TeamSection title="Technical Committee" members={TECHNICAL_COMMITTEE} />
    </div>
  );
}

function TeamSection({ title, members }: { title: string; members: TeamMember[] }) {
  return (
    <section>
      <h2 className="font-pixel text-[11px] uppercase text-mc-text-dim">{title}</h2>
      <ul className="mt-[var(--mc-unit)] grid gap-[var(--mc-unit)] sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <li key={m.name}>
            <MemberCard member={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Committee heads group by the team they run, so the grid reads as an org chart. */
function CommitteeHeadsSection() {
  const groups = new Map<string, CommitteeHead[]>();
  for (const head of COMMITTEE_HEADS) {
    const group = groups.get(head.team) ?? [];
    group.push(head);
    groups.set(head.team, group);
  }

  return (
    <section>
      <h2 className="font-pixel text-[11px] uppercase text-mc-text-dim">Committee Heads</h2>
      <div className="mt-[var(--mc-unit)] grid gap-[calc(var(--mc-unit)*1.5)] sm:grid-cols-2">
        {[...groups.entries()].map(([team, heads]) => (
          <div key={team}>
            <h3 className="text-[15px] text-mc-eyebrow">{team}</h3>
            <ul className="mt-[calc(var(--mc-unit)*0.5)] flex flex-col gap-[calc(var(--mc-unit)*0.5)]">
              {heads.map((head) => (
                <li key={head.name}>
                  <MemberCard member={head} compact />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function MemberCard({ member, compact = false }: { member: TeamMember; compact?: boolean }) {
  return (
    <BlockPanel
      variant="panel"
      padded={compact ? "sm" : "md"}
      className="flex h-full items-center gap-[var(--mc-unit)]"
    >
      <MemberPortrait member={member} size={compact ? 32 : 48} />
      <div className="min-w-0">
        <p className="font-pixel text-[10px] text-mc-success">{member.name}</p>
        <p className="mt-[2px] text-[14px] text-mc-text-dim">{member.subtitle}</p>
        {member.blurb ? (
          <p className="mt-[calc(var(--mc-unit)*0.25)] text-[14px] text-mc-text">{member.blurb}</p>
        ) : null}
      </div>
    </BlockPanel>
  );
}

/**
 * A member's face: their photograph where one exists, and the deterministic
 * pixel avatar everywhere else.
 *
 * The fallback is on `onError`, not on the absence of a path, and that is the
 * point — faculty entries in `team.ts` carry their photo path BEFORE the file
 * is added, so a missing photo degrades to the avatar the roster already used
 * instead of a broken frame, and dropping the file in is the only step needed
 * to make it appear.
 *
 * A plain <img> rather than next/image for that same reason: the optimizer
 * answers a source it cannot fetch with a 500, while <img> fires `onError`,
 * which is what this fallback listens for. The frame is a fixed square that
 * never exceeds 48px, so there is no meaningful optimization being given up.
 */
function MemberPortrait({ member, size }: { member: TeamMember; size: number }) {
  const [failed, setFailed] = useState(false);

  if (!member.image || failed) {
    return <PixelAvatar skinId={skinFor(member.name)} size={size} alt="" />;
  }

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden",
        "bg-mc-slot bevel-inset",
      )}
      style={{ width: size, height: size }}
    >
      {/* A plain <img> is deliberate — see the component doc comment. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={member.image}
        alt={member.name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        // object-top, not the default centre: the faculty photographs are 2:3
        // portraits and the frame is a square, so a centred crop takes the
        // middle third and slices the top of the head off. Anchoring to the top
        // keeps the face in frame, which is the whole point of the portrait.
        className="h-full w-full object-cover object-top"
      />
    </span>
  );
}
