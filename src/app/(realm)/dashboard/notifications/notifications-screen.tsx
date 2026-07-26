"use client";

import { BlockPanel, LoadingBlocks } from "@/components/mc";
import { useAsync } from "@/hooks/use-async";
import { repo } from "@/lib/data";
import type { AnnouncementSeverity } from "@/lib/data/types";

const SEVERITY_COLOR: Record<AnnouncementSeverity, string> = {
  info: "text-mc-diamond-light",
  success: "text-mc-emerald-light",
  warning: "text-mc-gold-light",
  critical: "text-mc-redstone-light",
};

/**
 * Announcement feed. New announcements also arrive as toasts via
 * AnnouncementListener; this is the durable record of them.
 */
export function NotificationsScreen() {
  const { data: items, loading } = useAsync(() => repo.announcements.list(), []);

  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
      <h1 className="text-mc-gold text-base md:text-lg">NOTIFICATIONS</h1>

      {loading ? (
        <BlockPanel variant="slot"><LoadingBlocks label="Loading" /></BlockPanel>
      ) : (items ?? []).length === 0 ? (
        <BlockPanel variant="slot" className="text-center">
          <p className="text-mc-text-dim">Nothing yet. Announcements will appear here.</p>
        </BlockPanel>
      ) : (
        <ul className="flex flex-col gap-[var(--mc-unit)]">
          {(items ?? []).map((a) => (
            <li key={a.id}>
              <BlockPanel variant={a.isPinned ? "gold" : "panel"} padded="md">
                <div className="flex flex-wrap items-baseline justify-between gap-[var(--mc-unit)]">
                  <p className={`font-pixel text-[10px] uppercase ${SEVERITY_COLOR[a.severity]}`}>
                    {a.isPinned ? "📌 " : ""}
                    {a.title}
                  </p>
                  <time dateTime={a.publishedAt} className="text-[14px] text-mc-text-dim">
                    {new Date(a.publishedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </div>
                <p className="mt-[calc(var(--mc-unit)*0.5)] text-[16px] text-mc-text-dim">{a.body}</p>
              </BlockPanel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
