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
  { href: "/dashboard", label: "Inventory", icon: "▦" },
  { href: "/dashboard/events", label: "My Events", icon: "▤" },
  { href: "/dashboard/achievements", label: "Achievements", icon: "★" },
  { href: "/schedule", label: "Schedule", icon: "◷" },
  { href: "/dashboard/team", label: "Team", icon: "◍" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "◈" },
  { href: "/dashboard/verify-payments", label: "Verify Payments", icon: "◆" },
  { href: "/dashboard/profile", label: "Profile", icon: "◉" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
] as const;

const TABS = [
  { href: "/world", label: "Home", icon: "⌂" },
  { href: "/events", label: "Events", icon: "▤" },
  { href: "/dashboard", label: "Inventory", icon: "▦" },
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
    <div className="flex flex-1 flex-col">
      {/* Mobile header with the drawer trigger. */}
      <header className="flex items-center justify-between gap-[var(--mc-unit)] border-b-[length:var(--mc-bevel)] border-mc-border p-[var(--mc-unit)] md:hidden">
        <BlockButton
          size="sm"
          variant="ghost"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
        >
          ☰
        </BlockButton>
        {character ? (
          <div className="flex items-center gap-[calc(var(--mc-unit)*0.75)]">
            <span className="font-pixel text-[10px] text-mc-text">
              {character.playerName}
            </span>
            <PixelAvatar skinId={character.skinId} size={32} />
          </div>
        ) : null}
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar. */}
        <aside className="hidden w-[220px] shrink-0 flex-col gap-[var(--mc-unit)] border-r-[length:var(--mc-bevel)] border-mc-border p-[var(--mc-unit)] md:flex">
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
                className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col gap-[var(--mc-unit)] overflow-y-auto bg-mc-panel p-[var(--mc-unit)] md:hidden"
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

        {/* Main content. pb clears the mobile tab bar. */}
        <main className="min-w-0 flex-1 p-[var(--mc-unit)] pb-[88px] md:pb-[var(--mc-unit)]">
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
                active ? "text-mc-portal-light" : "text-mc-text-dim",
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
        className="font-pixel text-[12px] text-mc-portal-light no-underline hover:text-mc-text"
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
        <BackLink
          href="/world?view=map"
          onClick={onNavigate}
          className="w-full"
        />
        <BlockButton variant="danger" size="sm" block onClick={onSignOut}>
          Logout
        </BlockButton>
      </div>
    </>
  );
}
