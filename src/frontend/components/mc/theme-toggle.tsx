"use client";

import { BlockButton } from "./block-button";
import { useTheme } from "@/frontend/lib/theme/use-theme";

/**
 * Light ⇄ dark switch.
 *
 * Two-state on purpose. The three-way control — including "follow my system" —
 * lives on the settings page, because that is a preference you set once and
 * forget, while this is a control you reach for when the room's lighting changed
 * and you want the other one NOW. Making the quick control cycle through three
 * states would mean two presses to get where you were looking.
 *
 * Choosing here does write an explicit preference, so it stops following the OS
 * from that point on. Settings is where you hand that back.
 *
 * The icon is chosen by CSS from `html[data-theme]`, not from React state — see
 * the `.theme-icon-*` rules in globals.css for why. The `aria-label` still comes
 * from state: it is wrong for the moment before hydration, but nothing can read
 * or press the button in that window anyway.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPreference } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <BlockButton
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {/* Both render; CSS shows one. The sun offers light, so it appears while
          the page is dark. */}
      <SunIcon className="theme-icon-dark" />
      <MoonIcon className="theme-icon-light" />
    </BlockButton>
  );
}

/**
 * Drawn as rects on a 9×9 grid with `shape-rendering: crispEdges`, so the icons
 * are genuinely pixel art at any --mc-scale rather than smooth vectors that
 * happen to sit next to some. `currentColor` lets them inherit the button's
 * variant colour like the text they replace.
 */
const ICON_PROPS = {
  viewBox: "0 0 9 9",
  width: 18,
  height: 18,
  fill: "currentColor",
  shapeRendering: "crispEdges" as const,
  "aria-hidden": true,
  focusable: false,
};

function SunIcon({ className }: { className?: string }) {
  return (
    <svg {...ICON_PROPS} className={className}>
      <rect x="3" y="3" width="3" height="3" />
      <rect x="4" y="0" width="1" height="2" />
      <rect x="4" y="7" width="1" height="2" />
      <rect x="0" y="4" width="2" height="1" />
      <rect x="7" y="4" width="2" height="1" />
      <rect x="1" y="1" width="1" height="1" />
      <rect x="7" y="1" width="1" height="1" />
      <rect x="1" y="7" width="1" height="1" />
      <rect x="7" y="7" width="1" height="1" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  // A disc with a disc-shaped bite taken out of the right, row by row.
  return (
    <svg {...ICON_PROPS} className={className}>
      <rect x="3" y="0" width="3" height="1" />
      <rect x="2" y="1" width="3" height="1" />
      <rect x="1" y="2" width="3" height="1" />
      <rect x="1" y="3" width="2" height="1" />
      <rect x="1" y="4" width="2" height="1" />
      <rect x="1" y="5" width="3" height="1" />
      <rect x="2" y="6" width="3" height="1" />
      <rect x="3" y="7" width="3" height="1" />
    </svg>
  );
}
