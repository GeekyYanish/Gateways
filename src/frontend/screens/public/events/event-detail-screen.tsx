"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BackLink,
  BlockButton,
  BlockPanel,
  LoadingScreen,
  showToast,
} from "@/frontend/components/mc";
import { AchievementModal } from "@/frontend/components/achievements/achievement-modal";
import { PaymentUploadModal } from "@/frontend/components/registration/payment-upload-modal";
import { ParticipantDetailsModal } from "@/frontend/components/registration/participant-details-modal";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { DataError, isParticipantComplete } from "@/backend/data/types";
import { cn } from "@/frontend/lib/utils";

/**
 * Event detail with working registration.
 *
 * The order is REGISTER, then pay. Clicking Register takes the seat
 * immediately — `pending` if the entry fee has not cleared yet — and verifying
 * the receipt is what confirms it. That is why the payment prompt below lives
 * inside the already-registered branch rather than in front of it.
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

  const { data: event, loading } = useAsync(() => repo.events.getBySlug(slug), [slug]);
  const { data: stats, reload: reloadStats } = useAsync(
    async () => (event ? repo.events.stats(event.id) : null),
    [event?.id],
  );
  const { data: registration, reload: reloadReg } = useAsync(
    async () => (event && userId ? repo.registrations.get(event.id, userId) : null),
    [event?.id, userId],
  );
  const { data: userReceipt, reload: reloadReceipt } = useAsync(
    async () => (userId ? repo.paymentReceipts.getByUser(userId) : null),
    [userId]
  );
  const { data: profile, reload: reloadProfile } = useAsync(
    async () => (userId ? repo.profiles.get(userId) : null),
    [userId],
  );
  const { data: categories } = useAsync(() => repo.reference.categories(), []);

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
  // `pending` means the seat is held but the entry fee has not cleared. It is
  // the only state that still needs money; waitlisted seats are not charged
  // until they are promoted.
  const awaitingPayment = isRegistered && registration.status === "pending";

  /** Register directly, or collect the participant details first if this is
   *  their first time — the repository refuses an incomplete record. */
  async function onRegisterClick() {
    if (!detailsComplete) {
      setDetailsModalOpen(true);
      return;
    }
    await onRegister();
  }

  async function onRegister() {
    if (!userId || !event) return;
    setBusy(true);
    try {
      const reg = await repo.registrations.register(event.id, userId);
      reloadReg();
      reloadStats();
      showToast({
        title:
          reg.status === "waitlisted"
            ? "Added to waitlist"
            : reg.status === "pending"
              ? "Seat held"
              : "Registered!",
        body:
          reg.status === "waitlisted"
            ? "This event is full — you will be promoted if a seat frees up."
            : reg.status === "pending"
              ? "Pay the one-time entry fee to confirm your place."
              : `You are in. See you at ${event.title}.`,
        severity: reg.status === "confirmed" ? "success" : "warning",
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
      {/* Mounted only once a registration exists, because the receipt now
          carries that registration's REAL id — the `"gateways-entry"` sentinel
          it used to pass could never satisfy the payment_receipts foreign key
          in the target schema. */}
      {registration ? (
        <PaymentUploadModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          eventId={event.id}
          registrationId={registration.id}
          onSuccess={() => reloadReceipt()}
        />
      ) : null}

      {userId ? (
        <ParticipantDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          userId={userId}
          profile={profile ?? null}
          onSaved={async () => {
            reloadProfile();
            await onRegister();
          }}
        />
      ) : null}

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
          ) : isRegistered ? (
            <div className="flex w-full flex-col gap-[var(--mc-unit)]">
              <div className="flex items-center gap-[var(--mc-unit)]">
                <span
                  className={cn(
                    "font-pixel text-[10px] uppercase",
                    registration.status === "confirmed"
                      ? "text-mc-success"
                      : "text-mc-accent",
                  )}
                >
                  {registration.status === "waitlisted"
                    ? "On waitlist"
                    : registration.status === "pending"
                      ? "Seat held — payment due"
                      : "Registered"}
                </span>
                <BlockButton variant="danger" size="sm" loading={busy} onClick={onCancel}>
                  Cancel registration
                </BlockButton>
              </div>

              {/* The money step. Only reachable once a seat exists, and the fee
                  is one-time — a student who already paid for another event
                  lands here confirmed and never sees this block. */}
              {awaitingPayment ? (
                !userReceipt || userReceipt.status === "rejected" ? (
                  <>
                    <BlockPanel
                      variant="slot"
                      className="w-full border-l-4 border-mc-gold p-[var(--mc-unit)]"
                    >
                      {userReceipt?.status === "rejected" ? (
                        <>
                          <p className="mb-1 font-pixel text-[14px] uppercase text-mc-danger">
                            Payment rejected
                          </p>
                          {userReceipt.reviewNote ? (
                            <p className="text-[14px] text-mc-text-dim">
                              Reason: {userReceipt.reviewNote}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[14px]">
                            Your seat is still held. Upload a new receipt to confirm it.
                          </p>
                        </>
                      ) : (
                        <p className="text-[14px]">
                          Your seat is held. Pay the one-time Gateways entry fee to
                          confirm it — it covers every event you enter.
                        </p>
                      )}
                    </BlockPanel>
                    <div>
                      <BlockButton
                        variant="gold"
                        size="lg"
                        onClick={() => setPaymentModalOpen(true)}
                      >
                        {userReceipt?.status === "rejected"
                          ? "Re-upload receipt"
                          : "Pay entry fee"}
                      </BlockButton>
                    </div>
                  </>
                ) : (
                  <BlockPanel
                    variant="slot"
                    className="w-full border-l-4 border-mc-gold p-[var(--mc-unit)]"
                  >
                    <p className="text-[14px]">
                      ⏳ Your entry fee receipt is awaiting verification. Your seat is
                      held meanwhile. Any trouble, contact{" "}
                      <a
                        href="mailto:committeeheads@gateways.in"
                        className="text-mc-eyebrow underline"
                      >
                        committeeheads@gateways.in
                      </a>
                      .
                    </p>
                  </BlockPanel>
                )
              ) : null}
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
