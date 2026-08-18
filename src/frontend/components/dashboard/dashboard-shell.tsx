"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BackLink,
  BlockButton,
  BlockPanel,
  PixelAvatar,
  ThemeToggle,
  XpBar,
} from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo, xpProgress } from "@/backend/data";
import { cn } from "@/frontend/lib/utils";

/**
 * Dashboard chrome (mockup SCREEN 7 sidebar + SCREEN 10 mobile tab bar).
 *
 * The sidebar is a persistent rail on desktop and a Framer AnimatePresence
 * drawer on mobile. The bottom tab bar is mobile-only and holds the four
 * highest-traffic destinations, matching the mockup.
 */

const NAV = [
  // Profile leads: it is where participant details are filled in, and that is
  // the one thing here a participant MUST do before they can register.
  { href: "/dashboard/profile", label: "Profile", icon: "◉" },
  { href: "/dashboard/events", label: "My Events", icon: "▤" },
  // The in-shell schedule, NOT the public /schedule route — that one lives
  // outside the (realm) group, so it would drop the sidebar on the way there.
  { href: "/dashboard/schedule", label: "Schedule", icon: "◷" },
  { href: "/dashboard/team", label: "Team", icon: "◍" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "◈" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
] as const;

/**
 * Staff-only destinations, appended for organizers and admins.
 *
 * The verification queue is load-bearing: the entry fee is paid before
 * registering, so until someone works this queue nobody can register for
 * anything. It had no link at all, which made that a silent dead end.
 *
 * This capability check only decides whether to show the shortcut. `/admin`
 * and every privileged mutation independently reload staff roles from MySQL.
 */
const TABS = [
  { href: "/world", label: "Home", icon: "⌂" },
  { href: "/events", label: "Events", icon: "▤" },
  { href: "/dashboard/profile", label: "Profile", icon: "◉" },
] as const;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { character, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: levels } = useAsync(() => repo.reference.levels(), []);
  const progress =
    character && levels ? xpProgress(character.totalXp, levels) : null;

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    // h-dvh (not flex-1) because nothing above this in the tree gives it a
    // constrained height to grow into — the root layout's <body> is only
    // min-h-full. Without an explicit height, this shell has no scroll
    // container of its own, so the WHOLE PAGE scrolls once content (e.g. the
    // Schedule list) outgrows the viewport, dragging the sidebar up and out of
    // view with it. Pinning the shell to the viewport and letting only <main>
    // scroll (below) is what keeps the sidebar in place.
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Mobile header with the drawer trigger. */}
      <header className="flex shrink-0 items-center justify-between gap-[var(--mc-unit)] border-b-[length:var(--mc-bevel)] border-mc-border px-[calc(var(--mc-unit)*1.5)] pb-[var(--mc-unit)] pt-[max(var(--mc-unit),env(safe-area-inset-top))] md:hidden">
        <BlockButton
          size="sm"
          variant="ghost"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
        >
          ☰
        </BlockButton>
        <div className="flex items-center gap-[calc(var(--mc-unit)*0.75)]">
          <ThemeToggle />
          {character ? (
            <>
              <span className="font-pixel text-[10px] text-mc-text">
                {character.playerName}
              </span>
              <PixelAvatar skinId={character.skinId} size={32} />
            </>
          ) : null}
        </div>
      </header>

      {/* min-h-0 overrides the flex default of min-height:auto, which would
          otherwise let this row grow to fit <main>'s full content height
          instead of clipping it at the space actually available — the same
          fix <main>'s own overflow-y-auto needs to do anything. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop sidebar. No overflow-y-auto here on purpose: the menu stays
            put and never scrolls, independent of how tall <main> gets. */}
        <aside className="hidden w-[220px] shrink-0 flex-col gap-[var(--mc-unit)] overflow-hidden border-r-[length:var(--mc-bevel)] border-mc-border p-[var(--mc-unit)] md:flex">
          <SidebarContent
            pathname={pathname}
            onNavigate={() => undefined}
            onSignOut={handleSignOut}
          />
        </aside>

        {/* Mobile drawer. */}
        <AnimatePresence>
          {drawerOpen ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 z-40 bg-black/70 md:hidden"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className="fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col gap-[var(--mc-unit)] overflow-y-auto bg-mc-panel px-[calc(var(--mc-unit)*1.5)] pb-[max(var(--mc-unit),env(safe-area-inset-bottom))] pt-[max(var(--mc-unit),env(safe-area-inset-top))] md:hidden"
              >
                <div className="flex justify-end">
                  <BlockButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close menu"
                  >
                    ✕
                  </BlockButton>
                </div>
                <SidebarContent
                  pathname={pathname}
                  onNavigate={() => setDrawerOpen(false)}
                  onSignOut={handleSignOut}
                />
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        {/* Main content — the only scrollable region in the shell. pb clears
            the mobile tab bar. */}
        <main className="min-w-0 flex-1 overflow-y-auto p-[calc(var(--mc-unit)*1.5)] pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-[calc(var(--mc-unit)*1.5)]">
          {character && progress ? (
            <BlockPanel
              variant="panel"
              padded="sm"
              className="mb-[var(--mc-unit)] flex flex-wrap items-center gap-[calc(var(--mc-unit)*1.5)]"
            >
              <div className="flex items-center gap-[var(--mc-unit)]">
                <PixelAvatar skinId={character.skinId} size={44} />
                <div>
                  <p className="font-pixel text-[11px] text-mc-text">
                    {character.playerName}
                  </p>
                  <p className="text-[15px] text-mc-text-dim">
                    {character.totalXp} XP total
                  </p>
                </div>
              </div>
              <XpBar
                className="min-w-[200px] flex-1"
                current={progress.current}
                required={progress.required}
                level={progress.level}
                title={progress.title}
              />
            </BlockPanel>
          ) : null}

          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar (SCREEN 10). */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t-[length:var(--mc-bevel)] border-mc-border bg-mc-panel pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-[2px] py-[calc(var(--mc-unit)*0.75)] no-underline",
                // 44px minimum touch target.
                "min-h-[56px] justify-center",
                active ? "text-mc-eyebrow" : "text-mc-text-dim",
              )}
            >
              <span aria-hidden className="text-[18px] leading-none">
                {t.icon}
              </span>
              <span className="font-pixel text-[8px] uppercase">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
  onSignOut,
}: {
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <Link
        href="/world"
        onClick={onNavigate}
        className="font-pixel text-[12px] text-mc-eyebrow no-underline hover:text-mc-text"
      >
        PARALLAX
      </Link>

      <nav aria-label="Dashboard" className="flex flex-col gap-[2px]">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-[calc(var(--mc-unit)*0.75)] no-underline",
                "px-[var(--mc-unit)] py-[calc(var(--mc-unit)*0.65)] min-h-[44px]",
                "text-[16px]",
                active
                  ? "bg-mc-panel-light text-mc-text bevel-inset"
                  : "text-mc-text-dim hover:bg-mc-panel-light/50 hover:text-mc-text",
              )}
            >
              <span aria-hidden className="w-[18px] text-center">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-[var(--mc-unit)] pt-[var(--mc-unit)]">
        {/* preferHistory={false}: this is a persistent "return to the map"
            action shown on every dashboard page, not a one-off retracing of
            how the player arrived — history would make it land wherever the
            player happened to be a moment ago (e.g. Schedule) instead. */}
        <BackLink
          href="/world?view=map"
          onClick={onNavigate}
          className="w-full"
          preferHistory={false}
        />
        <div className="flex items-center gap-[var(--mc-unit)]">
          <BlockButton
            variant="danger"
            size="sm"
            block
            onClick={onSignOut}
            className="min-w-0"
          >
            Logout
          </BlockButton>
          {/* Also in the mobile header above — this copy is the desktop one,
              where the sidebar is the only persistent chrome. */}
          <ThemeToggle className="shrink-0" />
        </div>
      </div>
    </>
  );
}
