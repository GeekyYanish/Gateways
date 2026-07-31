import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { fontVariables } from "@/frontend/lib/fonts";
import { PixelSplash } from "@/frontend/components/portal/pixel-splash";
import { HistoryCursor } from "@/frontend/components/navigation/history-cursor";
import { SPLASH_SEEN_KEY } from "@/frontend/lib/animation/splash-store";
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

export const metadata: Metadata = {
  title: "Parallax — Another World Awaits",
  description:
    "A Minecraft-inspired college fest portal. Create your adventurer, explore the realm, and register for events.",
};

export const viewport: Viewport = {
  themeColor: "#0b0710",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom is deliberately left enabled — disabling it is an accessibility
  // failure. The world map handles its own gestures without blocking the page.
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fontVariables} h-full`}>
      <head>
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
