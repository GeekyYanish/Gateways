"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BackLink,
  BlockButton,
  BlockInput,
  BlockPanel,
  LoadingScreen,
  showToast,
} from "@/frontend/components/mc";
import { AchievementModal } from "@/frontend/components/achievements/achievement-modal";
import {
  GATEWAYS_ENTRY_PAYMENT_ID,
  PaymentUploadModal,
} from "@/frontend/components/registration/payment-upload-modal";
import { ParticipantDetailsModal } from "@/frontend/components/registration/participant-details-modal";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { DataError, isParticipantComplete } from "@/backend/data/types";
import { cn } from "@/frontend/lib/utils";

/**
 * Event detail with payment-first registration.
 *
 * The one-time Gateways pass is paid and verified before an event registration
 * can be created. The repository enforces the same rule, so this screen is a
 * clear UI state rather than the security boundary by itself.
 *
 * All the guarantees the data layer enforces surface here as UI states:
 * already-registered, awaiting payment, waitlisted (over capacity), and closed
 * registration.
 */
export function EventDetailScreen({
  slug,
  fromCategory,
}: {
  slug: string;
  fromCategory?: string;
}) {
  const { session, character } = useSession();
  const userId = session?.userId;
  const [busy, setBusy] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const { data: event, loading } = useAsync(() => repo.events.getBySlug(slug), [slug]);
  const { data: stats, reload: reloadStats } = useAsync(
    async () => (event ? repo.events.stats(event.id) : null),
    [event?.id],
  );
  const { data: registration, reload: reloadReg } = useAsync(
    async () => (event && userId ? repo.registrations.get(event.id, userId) : null),
    [event?.id, userId],
  );
  // The Gateways pass is one per user, not one per registration — so this is
  // looked up by user, independent of whether `registration` exists yet.
  const { data: userReceipt, reload: reloadReceipt } = useAsync(
    async () => (userId ? repo.paymentReceipts.getByUser(userId) : null),
    [userId],
  );
  const { data: profile, reload: reloadProfile } = useAsync(
    async () => (userId ? repo.profiles.get(userId) : null),
    [userId],
  );
  const { data: categories } = useAsync(() => repo.reference.categories(), []);
  const { data: teams, reload: reloadTeams } = useAsync(
    async () => (userId ? repo.teams.listForUser(userId) : []),
    [userId],
  );

  if (loading) return <LoadingScreen label="Loading event" />;

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl p-[calc(var(--mc-unit)*2)]">
        <BlockPanel variant="slot" className="text-center">
          <p className="text-mc-text-dim">
            No such event.{" "}
            <Link href="/events" className="text-mc-eyebrow underline">
              Back to all events
            </Link>
          </p>
        </BlockPanel>
      </div>
    );
  }

  const category = categories?.find((c) => c.id === event.categoryId);
  const returnCategory =
    fromCategory === "all" ? undefined : (fromCategory ?? category?.slug);
  const backHref = returnCategory
    ? `/events?category=${encodeURIComponent(returnCategory)}`
    : "/events";
  const detailHref = fromCategory
    ? `/events/${slug}?fromCategory=${encodeURIComponent(fromCategory)}`
    : `/events/${slug}`;
  const isRegistered = registration && registration.status !== "cancelled";
  const registrationOpen = event.status === "published" || event.status === "ongoing";
  const detailsComplete = isParticipantComplete(profile ?? null, character);
  const paymentVerified = userReceipt?.status === "verified";
  const eventTeam = teams?.find((team) => team.eventId === event.id) ?? null;

  /** Register directly, or collect the participant details first if this is
   *  their first time — the repository refuses an incomplete record. */
  async function onRegisterClick() {
    if (!event) return;
    if (!paymentVerified) {
      setPaymentModalOpen(true);
      return;
    }
    if (!detailsComplete) {
      setDetailsModalOpen(true);
      return;
    }
    if (event.mode === "team" && !eventTeam) return;
    await onRegister();
  }

  function canManageTeam() {
    if (!paymentVerified) {
      setPaymentModalOpen(true);
      return false;
    }
    if (!detailsComplete) {
      setDetailsModalOpen(true);
      return false;
    }
    return true;
  }

  async function onCreateTeam() {
    if (!userId || !event || !canManageTeam()) return;
    if (teamName.trim().length < 2) {
      setTeamError("Enter a team name.");
      return;
    }
    setTeamBusy(true);
    setTeamError(null);
    try {
      await repo.teams.create(event.id, userId, teamName.trim());
      await Promise.all([reloadTeams(), reloadReg(), reloadStats()]);
      setTeamName("");
      showToast({ title: "Team created", body: "Share the join code with your teammates.", severity: "success" });
    } catch (e) {
      setTeamError(e instanceof DataError ? e.message : "Could not create the team.");
    } finally {
      setTeamBusy(false);
    }
  }

  async function onJoinTeam() {
    if (!userId || !event || !canManageTeam()) return;
    if (joinCode.trim().length < 4) {
      setTeamError("Enter the team join code.");
      return;
    }
    setTeamBusy(true);
    setTeamError(null);
    try {
      await repo.teams.join(joinCode.trim().toUpperCase(), userId);
      await Promise.all([reloadTeams(), reloadReg(), reloadStats()]);
      setJoinCode("");
      showToast({ title: "Joined team", body: "Your team registration is now reflected in the backend.", severity: "success" });
    } catch (e) {
      setTeamError(e instanceof DataError ? e.message : "Could not join the team.");
    } finally {
      setTeamBusy(false);
    }
  }

  async function onRegister() {
    if (!userId || !event) return;
    if (!paymentVerified) {
      setPaymentModalOpen(true);
      return;
    }
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--mc-unit)] px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*1.5)] md:p-[calc(var(--mc-unit)*2)]">
      <AchievementModal />
      {userId && (
        <PaymentUploadModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          eventId={GATEWAYS_ENTRY_PAYMENT_ID}
          registrationId={GATEWAYS_ENTRY_PAYMENT_ID}
          onSuccess={() => reloadReceipt()}
        />
      )}
      {userId && (
        <ParticipantDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          userId={userId}
          profile={profile ?? null}
          character={character}
          onSaved={async () => {
            await reloadProfile();
            await onRegister();
          }}
        />
      )}

      <BackLink href={backHref} />

      <BlockPanel variant="panel" padded="lg">
        {category ? (
          <p className="font-pixel text-[9px] uppercase text-mc-text-dim">{category.name}</p>
        ) : null}
        <h1 className="mt-[calc(var(--mc-unit)*0.5)] text-mc-success text-base md:text-lg">
          {event.title}
        </h1>
        {event.tagline ? (
          <p className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text-dim">{event.tagline}</p>
        ) : null}

        <dl className="mt-[calc(var(--mc-unit)*1.5)] grid gap-[var(--mc-unit)] sm:grid-cols-2">
          <Fact label="Entry Fee">
            Gateways Pass
          </Fact>
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
            <span className="text-mc-accent-strong">+{event.xpReward} XP on check-in</span>
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
            <Link
              href={`/login?next=${encodeURIComponent(detailHref)}`}
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
          ) : !paymentVerified ? (
            // Payment is verified once, fest-wide, before any event registration
            // can be created — so an unpaid/pending/rejected pass blocks here,
            // never after a registration already exists.
            <div className="flex flex-col gap-[var(--mc-unit)] w-full">
              {userReceipt?.status === "pending" && (
                <BlockPanel variant="slot" className="border-l-4 border-mc-gold p-[var(--mc-unit)] w-full">
                  <p className="text-[14px]">
                    ⏳ Your one-time entry fee payment is pending verification. Please wait while we verify your receipt before registering for events.
                  </p>
                </BlockPanel>
              )}
              {userReceipt?.status === "rejected" && (
                <BlockPanel variant="slot" className="border-l-4 border-mc-redstone p-[var(--mc-unit)]">
                  <p className="text-[14px] text-mc-redstone-light font-pixel uppercase mb-1">
                    ❌ Payment Rejected
                  </p>
                  {userReceipt.reviewNote && (
                    <p className="text-[14px] text-mc-text-dim">Reason: {userReceipt.reviewNote}</p>
                  )}
                </BlockPanel>
              )}
              {userReceipt?.status === "pending" ? null : (
                // Removed while pending so a second receipt can't be submitted
                // for the same one-time pass.
                <BlockButton
                  variant={userReceipt?.status === "rejected" ? "emerald" : "gold"}
                  size="lg"
                  onClick={() => setPaymentModalOpen(true)}
                >
                  {userReceipt?.status === "rejected" ? "Re-upload Receipt" : "Make Payment"}
                </BlockButton>
              )}
            </div>
          ) : isRegistered ? (
            <div className="flex items-center gap-[var(--mc-unit)]">
              <span className="font-pixel text-[10px] uppercase text-mc-emerald-light">
                {registration.status === "waitlisted" ? "On waitlist" : "Registered"}
              </span>
              <BlockButton variant="danger" size="sm" loading={busy} onClick={onCancel}>
                Cancel registration
              </BlockButton>
            </div>
          ) : registrationOpen ? (
            <BlockButton variant="emerald" size="lg" loading={busy} onClick={onRegisterClick}>
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
