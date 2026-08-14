"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BackLink,
  BlockButton,
  BlockInput,
  BlockPanel,
  LoadingBlocks,
} from "@/frontend/components/mc";
import {
  GATEWAYS_ENTRY_PAYMENT_ID,
  PaymentUploadModal,
} from "@/frontend/components/registration/payment-upload-modal";
import { BiomeScene } from "@/frontend/components/scene";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { cn } from "@/frontend/lib/utils";

/**
 * Events list, filterable by category and free-text search.
 *
 * The `?category=` param is what the world-map signposts link to, so clicking
 * "Hackathon Mine" lands here pre-filtered.
 */
export function EventsScreen() {
  const params = useSearchParams();
  const categorySlug = params.get("category") ?? undefined;
  const [search, setSearch] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const { session } = useSession();
  const userId = session?.userId;

  const { data: categories } = useAsync(() => repo.reference.categories(), []);
  const { data: events, loading } = useAsync(
    () =>
      repo.events.list({
        categorySlug,
        search: search || undefined,
        status: ["published", "ongoing", "registration_closed", "completed"],
      }),
    [categorySlug, search],
  );
  const {
    data: userReceipt,
    loading: paymentLoading,
    reload: reloadReceipt,
  } = useAsync(
    async () => (userId ? repo.paymentReceipts.getByUser(userId) : null),
    [userId],
  );

  const activeCategory = categories?.find((c) => c.slug === categorySlug);
  // Category slugs double as scene keys, so filtering to a category shows its
  // biome illustration as the header banner.
  const bannerScene = activeCategory?.slug ?? "portal-approach";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-[calc(var(--mc-unit)*1.5)] px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*1.5)] md:p-[calc(var(--mc-unit)*2)]">
      {userId ? (
        <PaymentUploadModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          eventId={GATEWAYS_ENTRY_PAYMENT_ID}
          registrationId={GATEWAYS_ENTRY_PAYMENT_ID}
          onSuccess={reloadReceipt}
        />
      ) : null}

      <BackLink
        href={
          categorySlug
            ? `/world?view=map&location=${encodeURIComponent(categorySlug)}`
            : "/world?view=map"
        }
      />

      <BiomeScene
        scene={bannerScene}
        className="min-h-[160px] border-[length:var(--mc-bevel)] border-mc-border bevel-inset"
      >
        <header className="mt-auto flex flex-col p-[calc(var(--mc-unit)*1.5)]">
          <h1
            className="text-mc-accent text-base md:text-lg"
            style={{ textShadow: "3px 3px 0 rgba(0,0,0,0.7)" }}
          >
            {activeCategory ? activeCategory.name.toUpperCase() : "ALL EVENTS"}
          </h1>
          {activeCategory?.description ? (
            <p
              className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text"
              style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.8)" }}
            >
              {activeCategory.description}
            </p>
          ) : null}
        </header>
      </BiomeScene>

      {!paymentLoading && userReceipt?.status !== "verified" ? (
        <BlockPanel
          variant="slot"
          className="flex flex-col items-start justify-between gap-[var(--mc-unit)] border-l-4 border-mc-gold p-[var(--mc-unit)] sm:flex-row sm:items-center"
        >
          <div>
            <p className="font-pixel text-[11px] uppercase text-mc-gold">
              One-time Gateways pass
            </p>
            <p className="mt-[calc(var(--mc-unit)*0.5)] text-[14px]">
              {userReceipt?.status === "pending"
                ? "Your payment receipt is awaiting verification. Registration opens once it is approved."
                : userReceipt?.status === "rejected"
                  ? "Your receipt was rejected. Upload a new receipt before registering for events."
                  : "Make the one-time payment and upload your receipt. You can register after it is verified."}
            </p>
          </div>
          {userId ? (
            userReceipt?.status === "pending" ? (
              <span className="shrink-0 font-pixel text-[10px] uppercase text-mc-text-dim">
                Awaiting verification
              </span>
            ) : (
              <BlockButton
                variant="gold"
                size="sm"
                className="shrink-0"
                onClick={() => setPaymentModalOpen(true)}
              >
                {userReceipt?.status === "rejected" ? "Re-upload receipt" : "Make Payment"}
              </BlockButton>
            )
          ) : (
            <Link href="/login?next=/events" className="shrink-0 no-underline">
              <BlockButton variant="gold" size="sm">
                Make Payment
              </BlockButton>
            </Link>
          )}
        </BlockPanel>
      ) : null}

      <BlockInput
        label="Search"
        placeholder="Search events…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <nav aria-label="Categories" className="flex flex-wrap gap-[calc(var(--mc-unit)*0.5)]">
        <CategoryChip href="/events" label="All" active={!categorySlug} />
        {(categories ?? []).map((c) => (
          <CategoryChip
            key={c.id}
            href={`/events?category=${c.slug}`}
            label={c.name}
            active={c.slug === categorySlug}
          />
        ))}
      </nav>

      {loading ? (
        <BlockPanel variant="slot">
          <LoadingBlocks label="Loading events" />
        </BlockPanel>
      ) : (events ?? []).length === 0 ? (
        <BlockPanel variant="slot" className="text-center">
          <p className="text-mc-text-dim">No events match that search.</p>
        </BlockPanel>
      ) : (
        <ul className="grid gap-[var(--mc-unit)] sm:grid-cols-2 lg:grid-cols-3">
          {(events ?? []).map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.slug}?fromCategory=${encodeURIComponent(categorySlug ?? "all")}`}
                className="block no-underline"
              >
                <BlockPanel
                  variant="panel"
                  padded="md"
                  className="h-full transition-[filter,transform] duration-100 hover:brightness-115 hover:-translate-y-[2px]"
                >
                  <p className="font-pixel text-[11px] text-mc-success">{e.title}</p>
                  {e.tagline ? (
                    <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px] text-mc-text-dim">
                      {e.tagline}
                    </p>
                  ) : null}
                  <dl className="mt-[var(--mc-unit)] flex flex-wrap gap-x-[var(--mc-unit)] text-[14px] text-mc-text-dim">
                    <div>
                      <dt className="sr-only">Starts</dt>
                      <dd>
                        {new Date(e.startsAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Mode</dt>
                      <dd className="capitalize">{e.mode}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Reward</dt>
                      <dd className="text-mc-accent-strong">+{e.xpReward} XP</dd>
                    </div>
                  </dl>
                </BlockPanel>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-[44px] min-w-11 items-center justify-center px-[var(--mc-unit)] no-underline",
        "font-pixel text-[9px] uppercase tracking-wide",
        active
          ? "bg-mc-portal text-white [--bevel-light:var(--color-mc-portal-light)] [--bevel-dark:var(--color-mc-portal-dark)] bevel"
          : "bg-mc-panel text-mc-text-dim [--bevel-light:var(--color-mc-panel-light)] [--bevel-dark:var(--color-mc-panel-dark)] bevel hover:text-mc-text",
      )}
    >
      {label}
    </Link>
  );
}
