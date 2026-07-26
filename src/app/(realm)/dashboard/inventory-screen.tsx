"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BadgeSlot, BlockPanel, LoadingBlocks } from "@/components/mc";
import { AchievementModal } from "@/components/achievements/achievement-modal";
import { useSession } from "@/components/auth/session-provider";
import { useAsync } from "@/hooks/use-async";
import { repo } from "@/lib/data";
import type { Rarity } from "@/lib/data/types";

/**
 * SCREEN 7 — Inventory.
 *
 * Registered events as inventory cards, then the achievement badge grid with
 * locked slots. Both stagger in with Framer, which is the component-presence
 * case rather than a GSAP timeline.
 */
export function InventoryScreen() {
  const { session } = useSession();
  const userId = session?.userId;

  const { data: registrations, loading: regsLoading } = useAsync(
    async () => (userId ? repo.registrations.listForUser(userId) : []),
    [userId],
  );
  const { data: events } = useAsync(() => repo.events.list(), []);
  const { data: allAchievements } = useAsync(() => repo.achievements.listAll(), []);
  const { data: mine } = useAsync(
    async () => (userId ? repo.achievements.listForUser(userId) : []),
    [userId],
  );

  const active = (registrations ?? []).filter((r) => r.status !== "cancelled");
  const unlockedIds = new Set((mine ?? []).map((u) => u.achievementId));

  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*2)]">
      <AchievementModal />

      <section>
        <h1 className="text-mc-gold text-base md:text-lg">INVENTORY</h1>
        <h2 className="mt-[calc(var(--mc-unit)*1.5)] font-pixel text-[11px] uppercase text-mc-text-dim">
          Registered Events
        </h2>

        {regsLoading ? (
          <BlockPanel variant="slot" className="mt-[var(--mc-unit)]">
            <LoadingBlocks label="Loading your events" />
          </BlockPanel>
        ) : active.length === 0 ? (
          <BlockPanel variant="slot" className="mt-[var(--mc-unit)] text-center">
            <p className="text-mc-text-dim">
              Your inventory is empty.{" "}
              <Link href="/events" className="text-mc-portal-light underline">
                Browse events
              </Link>{" "}
              to get started.
            </p>
          </BlockPanel>
        ) : (
          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            className="mt-[var(--mc-unit)] grid gap-[var(--mc-unit)] sm:grid-cols-2 lg:grid-cols-3"
          >
            {active.map((reg) => {
              const event = (events ?? []).find((e) => e.id === reg.eventId);
              if (!event) return null;
              return (
                <motion.li
                  key={reg.id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0 },
                  }}
                >
                  <BlockPanel variant="panel" padded="md" className="h-full">
                    <p className="font-pixel text-[11px] text-mc-emerald-light">
                      {event.title}
                    </p>
                    <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px] text-mc-text-dim">
                      {new Date(event.startsAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px]">
                      <StatusPill status={reg.status} />
                    </p>
                    <Link
                      href={`/events/${event.slug}`}
                      className="mt-[var(--mc-unit)] inline-block text-[15px] text-mc-portal-light underline"
                    >
                      View
                    </Link>
                  </BlockPanel>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </section>

      <section>
        <h2 className="font-pixel text-[11px] uppercase text-mc-text-dim">
          Achievements{" "}
          <span className="text-mc-text">
            ({unlockedIds.size}/{allAchievements?.length ?? 0})
          </span>
        </h2>

        <BlockPanel variant="slot" className="mt-[var(--mc-unit)]">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.035 } } }}
            className="flex flex-wrap gap-[var(--mc-unit)]"
          >
            {(allAchievements ?? []).map((a) => (
              <motion.div
                key={a.id}
                variants={{
                  hidden: { opacity: 0, scale: 0.85 },
                  show: { opacity: 1, scale: 1 },
                }}
              >
                <BadgeSlot
                  code={a.code}
                  name={a.name}
                  description={a.description}
                  rarity={a.rarity as Rarity}
                  unlocked={unlockedIds.has(a.id)}
                  secret={a.isSecret}
                />
              </motion.div>
            ))}
          </motion.div>
        </BlockPanel>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: "text-mc-emerald-light",
    waitlisted: "text-mc-gold-light",
    pending: "text-mc-diamond-light",
    rejected: "text-mc-redstone-light",
  };
  return (
    <span className={styles[status] ?? "text-mc-text-dim"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
