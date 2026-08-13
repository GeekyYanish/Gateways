import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { fontVariables } from "@/frontend/lib/fonts";
import { PixelSplash } from "@/frontend/components/portal/pixel-splash";
import { HistoryCursor } from "@/frontend/components/navigation/history-cursor";
import { SPLASH_SEEN_KEY } from "@/frontend/lib/animation/splash-store";
// From theme-store, NOT use-theme: the latter is a "use client" module, and a
// value imported from one of those into this server component arrives as a
// client reference — it would interpolate below as the string "undefined".
import { THEME_STORAGE_KEY } from "@/frontend/lib/theme/theme-store";
import "./globals.css";

/**
 * Runs before hydration, so a repeat load in the same tab never shows a frame of
 * the splash. The overlay is in the server HTML on purpose — that is what stops
 * the homepage flashing before hydration on a first visit — which means the
 * "already seen" decision has to be made before first paint, and only an inline
 * blocking script can do that. Same shape as the usual theme-flash fix.
 *
 * IT INJECTS A <style> RATHER THAN SETTING AN ATTRIBUTE ON <html>. The obvious
 * version stamps `data-splash-seen` on the root element, but React renders <html>
 * here, so hydration finds an attribute that was not in the server output and
 * warns ("some attributes of the server rendered HTML didn't match"). The usual
 * answer is `suppressHydrationWarning` on <html>, which silences the symptom and
 * every future mismatch on that element with it. Appending a style element keeps
 * the script entirely outside React's tree, so there is nothing to reconcile.
 *
 * Worst case (the style is somehow dropped) is a brief flash of the overlay
 * before the component unmounts itself — never a stuck overlay.
 *
 * The key is inlined rather than imported because this executes before any
 * module has loaded; `SPLASH_SEEN_KEY` is interpolated in so the two cannot drift.
 */
const SPLASH_BOOT = `try{if(sessionStorage.getItem(${JSON.stringify(SPLASH_SEEN_KEY)})==="true"){var s=document.createElement("style");s.textContent="#pixel-splash{display:none}";document.head.appendChild(s)}}catch(e){}`;

/**
 * Paints the correct colour theme before first paint. Without it a visitor who
 * chose light gets a full frame of the dark page first — the classic theme
 * flash, and a nasty one here because the page is near-black.
 *
 * It STAMPS AN ATTRIBUTE, unlike SPLASH_BOOT above, and that difference is
 * deliberate rather than an inconsistency. The splash decision collapses to one
 * `display:none` rule, so a script-injected <style> expresses it completely and
 * keeps the script outside React's tree. A theme cannot be expressed that way:
 * globals.css keys a whole token table off `html[data-theme="light"]`, and the
 * only alternatives are to duplicate that table into a JS string (two sources of
 * truth for every colour in the app) or to duplicate it again inside a
 * `prefers-color-scheme` block so the attribute is only needed for overrides.
 * Both are worse than the cost below.
 *
 * That cost is `suppressHydrationWarning` on <html>: React renders that element,
 * so an attribute the server did not emit is a mismatch. The flag applies to one
 * element's own attributes and direct text content — it does NOT propagate to
 * descendants, so this does not blind us to mismatches anywhere else in the tree.
 *
 * The attribute is always set, including when following the OS, so there is
 * exactly one theme block in CSS. `applyThemeAttribute()` recomputes the same
 * value from the same key after hydration.
 */
const THEME_BOOT = `try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.setAttribute("data-theme",p==="light"||p==="dark"?p:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"))}catch(e){}`;

export const metadata: Metadata = {
  title: "Parallax — Another World Awaits",
  description:
    "A Minecraft-inspired college fest portal. Create your adventurer, explore the realm, and register for events.",
};

export const viewport: Viewport = {
  // Two entries so the browser's own chrome (the mobile address bar) matches
  // the theme rather than staying near-black behind a pale page. These track
  // the OS setting only — there is no way to drive <meta name="theme-color">
  // off our data-attribute — so a visitor whose in-app choice disagrees with
  // their OS gets the other bar colour. That is a strictly smaller mismatch
  // than the single fixed value it replaces.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0710" },
    { media: "(prefers-color-scheme: light)", color: "#7ecdf5" },
  ],
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom is deliberately left enabled — disabling it is an accessibility
  // failure. The world map handles its own gestures without blocking the page.
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning is for the `data-theme` attribute THEME_BOOT
    // stamps here before hydration. It covers this element only — see the
    // comment on THEME_BOOT.
    <html lang="en" className={`${fontVariables} h-full`} suppressHydrationWarning>
      <head>
        {/* Theme first: it decides what the page looks like, whereas the splash
            only decides whether an overlay is skipped. */}
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT}
        </Script>
        <Script id="splash-boot" strategy="beforeInteractive">
          {SPLASH_BOOT}
        </Script>
        {/* If JS never runs the splash can never dismiss itself, so it must not
            appear at all. */}
        <noscript>
          <style>{`#pixel-splash{display:none}`}</style>
        </noscript>
      </head>
      <body className="min-h-full flex flex-col bg-mc-void text-mc-text">
        {children}
        {/* Renders nothing; numbers each history entry so <BackLink> can tell
            in-app history from a cold arrival. Must be at the root to see every
            navigation. */}
        <HistoryCursor />
        <PixelSplash />
      </body>
    </html>
  );
}
