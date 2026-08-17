"use client";

import { BackLink, BlockPanel, PixelAvatar } from "@/frontend/components/mc";
import {
  skinFor,
  FACULTY_COORDINATORS,
  CORE_COMMITTEE,
  COMMITTEE_HEADS,
  WEBSITE_DEVELOPERS,
  type TeamMember,
  type CommitteeHead,
} from "@/frontend/lib/team";

/**
 * The people behind the fest — faculty coordinators, the core committee,
 * committee heads, and the website team. A standalone page rather than a
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

      <TeamSection title="Faculty Coordinators" members={FACULTY_COORDINATORS} />
      <TeamSection title="Core Committee" members={CORE_COMMITTEE} />
      <CommitteeHeadsSection />
      <TeamSection title="Website Developers" members={WEBSITE_DEVELOPERS} />
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
      <PixelAvatar skinId={skinFor(member.name)} size={compact ? 32 : 48} alt="" />
      <div className="min-w-0">
        <p className="truncate font-pixel text-[10px] text-mc-success">{member.name}</p>
        <p className="mt-[2px] truncate text-[14px] text-mc-text-dim">{member.subtitle}</p>
        {member.blurb ? (
          <p className="mt-[calc(var(--mc-unit)*0.25)] text-[14px] text-mc-text">{member.blurb}</p>
        ) : null}
      </div>
    </BlockPanel>
  );
}
