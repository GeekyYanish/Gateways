"use client";

import { useState } from "react";
import Link from "next/link";
import { BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";

/** Registered events, split into upcoming and past. */
export function MyEventsScreen() {
  const { session } = useSession();
  const userId = session?.userId;

  const { data: regs, loading } = useAsync(
    async () => (userId ? repo.registrations.listForUser(userId) : []),
    [userId],
  );
  const { data: events } = useAsync(() => repo.events.list(), []);

  // Captured once on mount rather than read during render: Date.now() in a
  // render body is impure, and under concurrent rendering two passes could
  // classify the same event differently.
  const [now] = useState(() => Date.now());

  const rows = (regs ?? [])
    .filter((r) => r.status !== "cancelled")
    .map((r) => ({ reg: r, event: events?.find((e) => e.id === r.eventId) }))
    .filter((x) => x.event);

  const upcoming = rows.filter((x) => new Date(x.event!.endsAt).getTime() >= now);
  const past = rows.filter((x) => new Date(x.event!.endsAt).getTime() < now);

  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
      <h1 className="text-mc-accent text-base md:text-lg">MY EVENTS</h1>

      {loading ? (
        <BlockPanel variant="slot"><LoadingBlocks label="Loading" /></BlockPanel>
      ) : rows.length === 0 ? (
        <BlockPanel variant="slot" className="text-center">
          <p className="text-mc-text-dim">
            Nothing registered yet.{" "}
            <Link href="/events" className="text-mc-eyebrow underline">Browse events</Link>
          </p>
        </BlockPanel>
      ) : (
        <>
          <Group title="Upcoming" rows={upcoming} empty="No upcoming events." />
          <Group title="Past" rows={past} empty="No past events yet." />
        </>
      )}
    </div>
  );
}

function Group({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ reg: { id: string; status: string }; event?: { slug: string; title: string; startsAt: string } }>;
  empty: string;
}) {
  return (
    <section>
      <h2 className="font-pixel text-[11px] uppercase text-mc-text-dim">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px] text-mc-text-dim">{empty}</p>
      ) : (
        <ul className="mt-[var(--mc-unit)] grid gap-[var(--mc-unit)] sm:grid-cols-2">
          {rows.map(({ reg, event }) => (
            <li key={reg.id}>
              <Link href={`/events/${event!.slug}`} className="block no-underline">
                <BlockPanel variant="panel" padded="md" className="hover:brightness-115">
                  <p className="font-pixel text-[11px] text-mc-success">{event!.title}</p>
                  <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px] text-mc-text-dim">
                    {new Date(event!.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <p className="mt-[calc(var(--mc-unit)*0.5)] text-[14px] capitalize text-mc-text-dim">{reg.status}</p>
                </BlockPanel>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
