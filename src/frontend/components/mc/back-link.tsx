"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasAppHistory } from "@/frontend/components/navigation/history-cursor";
import { blockButton } from "./block-button";
import { cn } from "@/frontend/lib/utils";

/**
 * "Back" — to wherever the visitor actually came from when that is somewhere
 * inside Parallax, and to `href` when it is not.
 *
 * This used to be an unconditional `<Link href>` so that someone arriving from
 * an email, a search result or a QR code could never be thrown out of the app by
 * a control that looks like it belongs to it. That reasoning still holds — but
 * it made Back wrong for the common case: a player who reached this page from
 * elsewhere in the app was sent to a fixed parent rather than back to where they
 * actually were, losing their place.
 *
 * So: prefer real history, fall back to the href. Whether there IS app history
 * comes from `<HistoryCursor>`, which stamps each entry — Next 16 keeps no `idx`
 * of its own to read. See that file for why.
 *
 * `href` therefore stays REQUIRED. It is both the fallback and the anchor's real
 * destination, which is what keeps middle-click, "open in new tab" and crawling
 * working — none of which a history-driven <button> could offer.
 *
 * `preferHistory` opts a caller OUT of the history behaviour above, for the one
 * kind of "Back" that is not actually a back-in-history control: the dashboard
 * sidebar's link is a persistent "return to the map" action, present on every
 * dashboard page, not a one-off retracing of how the player got there. History
 * would make it inconsistent — Back from Schedule would land on Inventory, not
 * the map, purely because that happened to be the previous page. Set it to
 * `false` there so it always goes to `href`.
 */
export function BackLink({
  href,
  label = "Back",
  className,
  onClick,
  preferHistory = true,
}: {
  href: string;
  label?: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  preferHistory?: boolean;
}) {
  const router = useRouter();

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (!preferHistory) return; // always the <Link>'s href

    // Leave new-tab / new-window intents and non-primary buttons to the browser.
    // Hijacking those would break behaviour every link is expected to have.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (!hasAppHistory()) return; // fall through to the <Link>'s href

    event.preventDefault();
    router.back();
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        blockButton({ variant: "ghost", size: "sm" }),
        "w-fit no-underline",
        className,
      )}
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}

