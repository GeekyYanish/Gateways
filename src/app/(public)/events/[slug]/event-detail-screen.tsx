"use client";

import { useState } from "react";
import Link from "next/link";
import { BlockButton, BlockPanel, LoadingScreen, showToast } from "@/components/mc";
import { AchievementModal } from "@/components/achievements/achievement-modal";
import { useSession } from "@/components/auth/session-provider";
import { useAsync } from "@/hooks/use-async";
import { repo } from "@/lib/data";
import { DataError } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/**
 * Event detail with working registration.
 *
 * All the guarantees the data layer enforces surface here as UI states:
 * already-registered, waitlisted (over capacity), and closed registration.
 */
export function EventDetailScreen({ slug }: { slug: string }) {
  const { session } = useSession();
  const userId = session?.userId;
  const [busy, setBusy] = useState(false);

  const { data: event, loading } = useAsync(() => repo.events.getBySlug(slug), [slug]);
  const { data: stats, reload: reloadStats } = useAsync(
    async () => (event ? repo.events.stats(event.id) : null),
    [event?.id],
  );
  const { data: registration, reload: reloadReg } = useAsync(
    async () => (event && userId ? repo.registrations.get(event.id, userId) : null),
    [event?.id, userId],
  );
  const { data: categories } = useAsync(() => repo.reference.categories(), []);

  if (loading) return <LoadingScreen label="Loading event" />;

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl p-[calc(var(--mc-unit)*2)]">
        <BlockPanel variant="slot" className="text-center">
          <p className="text-mc-text-dim">
            No such event.{" "}
            <Link href="/events" className="text-mc-portal-light underline">
              Back to all events
            </Link>
          </p>
        </BlockPanel>
      </div>
    );
  }

  const category = categories?.find((c) => c.id === event.categoryId);
  const isRegistered = registration && registration.status !== "cancelled";
  const registrationOpen = event.status === "published" || event.status === "ongoing";

  async function onRegister() {
    if (!userId || !event) return;
    setBusy(true);
    try {
      const reg = await repo.registrations.register(event.id, userId);
      reloadReg();
      reloadStats();
      showToast({
        title: reg.status === "waitlisted" ? "Added to waitlist" : "Registered!",
        body:
          reg.status === "waitlisted"
            ? "This event is full — you will be promoted if a seat frees up."
            : `You are in. See you at ${event.title}.`,
        severity: reg.status === "waitlisted" ? "warning" : "success",
      });
    } catch (e) {
      showToast({
        title: "Could not register",
        body: e instanceof DataError ? e.message : "Please try again.",
        severity: "critical",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!registration) return;
    setBusy(true);
    try {
      await repo.registrations.cancel(registration.id);
      reloadReg();
      reloadStats();
      showToast({ title: "Registration cancelled", severity: "info" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--mc-unit)] p-[var(--mc-unit)]">
      <AchievementModal />

      <Link href="/events" className="text-[15px] text-mc-portal-light underline">
        ← All events
      </Link>

      <BlockPanel variant="panel" padded="lg">
        {category ? (
          <p className="font-pixel text-[9px] uppercase text-mc-text-dim">{category.name}</p>
        ) : null}
        <h1 className="mt-[calc(var(--mc-unit)*0.5)] text-mc-emerald-light text-base md:text-lg">
          {event.title}
        </h1>
        {event.tagline ? (
          <p className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text-dim">{event.tagline}</p>
        ) : null}

        <dl className="mt-[calc(var(--mc-unit)*1.5)] grid gap-[var(--mc-unit)] sm:grid-cols-2">
          <Fact label="Starts">
            {new Date(event.startsAt).toLocaleString(undefined, {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </Fact>
          <Fact label="Ends">
            {new Date(event.endsAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Fact>
          <Fact label="Venue">{event.venue ?? "To be announced"}</Fact>
          <Fact label="Format">
            {event.mode === "solo"
              ? "Solo"
              : `Teams of ${event.minTeamSize}–${event.maxTeamSize}`}
          </Fact>
          <Fact label="Reward">
            <span className="text-mc-gold-light">+{event.xpReward} XP on check-in</span>
          </Fact>
          <Fact label="Seats">
            {event.capacity == null
              ? "Unlimited"
              : `${stats?.confirmedCount ?? 0} / ${event.capacity} taken`}
          </Fact>
        </dl>

        {event.description ? (
          <p className="mt-[calc(var(--mc-unit)*1.5)] text-mc-text-dim">{event.description}</p>
        ) : null}

        {event.rules ? (
          <div className="mt-[calc(var(--mc-unit)*1.5)]">
            <h2 className="font-pixel text-[10px] uppercase text-mc-text-dim">Rules</h2>
            <p className="mt-[calc(var(--mc-unit)*0.5)] text-[16px] text-mc-text-dim">
              {event.rules}
            </p>
          </div>
        ) : null}

        <div className="mt-[calc(var(--mc-unit)*2)] flex flex-wrap items-center gap-[var(--mc-unit)]">
          {!userId ? (
            // Signed-out visitors can read everything; registering needs an
            // account, so send them through the portal with a return path.
            <Link
              href={`/login?next=${encodeURIComponent(`/events/${slug}`)}`}
              className={cn(
                "inline-flex min-h-[52px] items-center px-[calc(var(--mc-unit)*3)] no-underline",
                "font-pixel text-[14px] uppercase tracking-wider",
                "bg-mc-portal text-white bevel",
                "[--bevel-light:var(--color-mc-portal-light)] [--bevel-dark:var(--color-mc-portal-dark)]",
                "hover:brightness-110 active:translate-y-[var(--mc-bevel)] active:bevel-pressed",
              )}
            >
              Sign in to register
            </Link>
          ) : isRegistered ? (
            <>
              <span className="font-pixel text-[10px] uppercase text-mc-emerald-light">
                {registration.status === "waitlisted" ? "On waitlist" : "Registered"}
              </span>
              <BlockButton variant="danger" size="sm" loading={busy} onClick={onCancel}>
                Cancel registration
              </BlockButton>
            </>
          ) : registrationOpen ? (
            <BlockButton variant="emerald" size="lg" loading={busy} onClick={onRegister}>
              {stats?.seatsLeft === 0 ? "Join waitlist" : "Register"}
            </BlockButton>
          ) : (
            <span className="text-mc-text-dim">
              Registration is closed for this event.
            </span>
          )}
        </div>
      </BlockPanel>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-pixel text-[9px] uppercase text-mc-text-dim">{label}</dt>
      <dd className="mt-[2px] text-[16px]">{children}</dd>
    </div>
  );
}
