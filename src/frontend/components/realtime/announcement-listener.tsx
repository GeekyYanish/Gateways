"use client";

import { useEffect } from "react";
import { repo } from "@/backend/data";
import { showToast } from "@/frontend/components/mc";
import type { AnnouncementSeverity } from "@/backend/data/types";

/**
 * Turns new announcements into toasts (mockup SCREEN 9).
 *
 * Mounted ONCE in the authed layout, so there is exactly one subscription for
 * the whole session regardless of navigation. That single-subscription discipline
 * matters more after the Supabase migration, where a per-component subscription
 * would open a websocket per mount — but establishing it now means the consumer
 * does not change when the backend does.
 *
 * `repo.announcements.subscribe` already has the same signature Supabase
 * Realtime will have, and locally it fires across tabs via the storage event.
 */
export function AnnouncementListener() {
  useEffect(() => {
    const unsub = repo.announcements.subscribe((a) => {
      showToast({
        title: a.title,
        body: a.body,
        severity: a.severity as AnnouncementSeverity,
      });
    });
    return unsub;
  }, []);

  return null;
}
