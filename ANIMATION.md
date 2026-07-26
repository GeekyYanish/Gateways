# Animation architecture

One rule, no ambiguity:

> **GSAP owns timelines. Framer Motion owns components.**

If it is a multi-element choreographed sequence with a progress/scrub notion →
GSAP. If it is a single component reacting to state or presence → Framer Motion.
**Never animate the same property with both on one element.**

| Concern | Tool |
|---|---|
| Landing portal idle loop, particle drift | GSAP |
| "Entering the realm" / portal transition overlay | GSAP |
| Portal activation progress (SCREEN 5) | GSAP |
| World map camera pan / zoom-to-signpost | GSAP |
| Achievement-unlock cinematic | GSAP (inside a Framer-presence modal) |
| Button press/hover bevel | CSS (must respond on first paint) |
| Sidebar & mobile drawer, tab bar | Framer `AnimatePresence` |
| Toast enter/exit/stack | Framer (via sonner) |
| Modal backdrop + scale | Framer |
| List stagger (event cards, badges) | Framer `staggerChildren` |
| XP bar fill | Framer spring |

## GSAP rules (non-negotiable)

1. **Never register plugins at module top level in a shared file.** Do it once in
   `src/lib/animation/gsap-init.ts`, which is `"use client"`.
2. **Always `useGSAP` from `@gsap/react`, never bare `useEffect` + `gsap.to`.**
   `useGSAP` wraps in `gsap.context()` and reverts on unmount. Without it,
   StrictMode's double-invoke leaves two tweens fighting over one element — the
   animation plays at double speed or strands inline styles.
3. **Always scope with a ref** (`useGSAP(fn, { scope: ref })`), never a global
   selector string. Global selectors match elements in other route trees after
   client-side navigation.
4. **Set initial states in CSS, not in a GSAP `.from()`.** A `.from({opacity:0})`
   runs *after* hydration, so the SSR HTML paints visible then snaps to hidden —
   a visible flash. Use the `.gsap-hidden` class instead, and tween `to()`.
5. **`gsap.matchMedia()`** for responsive and reduced-motion variants; it handles
   its own per-breakpoint cleanup.
6. Anything reading `window` goes inside the `useGSAP` callback, never in render.

## Framer Motion rules

- **Never animate a property across mixed units.** `width: 0 → "35%"` cannot be
  interpolated: Framer bails and leaves the element at its initial value, which
  silently renders e.g. every XP bar empty. Animate `scaleX` (unitless) instead —
  it is also GPU-composited rather than triggering layout. This exact bug cost
  real debugging time in Phase 1; see `src/components/mc/xp-bar.tsx`.
- Prefer declarative `animate={...}` over an imperative `useSpring` + `.set()`
  in an effect. With several instances mounting at once the imperative call can
  be lost mid-flight.
- `<MotionConfig reducedMotion="user">` is mounted once at the app root, which
  makes every Framer animation respect the OS setting for free.

## Reduced motion — three coordinated layers

1. **GSAP**: `gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", …)`
   so the timeline is never built when reduce is set, plus a branch that snaps
   final states.
2. **Framer**: `<MotionConfig reducedMotion="user">`.
3. **CSS**: the `@media (prefers-reduced-motion: reduce)` block in `globals.css`,
   which also force-reveals `.gsap-hidden`.

**The `.gsap-hidden` escape hatch is a hard requirement, not a nicety.** Elements
that GSAP fades in start hidden via that class. If JS fails, or motion is
reduced, the class must not leave content permanently invisible — so both the
media query and the `html[data-reduce-motion="true"]` attribute selector force
`opacity: 1`.

There is also an **in-app "Reduce animations" toggle** (sets
`data-reduce-motion` on `<html>`), because many motion-sensitive users have never
changed their OS setting.

## Verifying animations locally

**The in-app browser pane runs with a paused animation clock**
(`document.timeline.currentTime` stays `0`), so every animation appears frozen at
its initial value there. That is an artifact of the tool, not a bug in the app —
do not "fix" code based on it.

To verify animations for real, drive headless Chrome over CDP:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-anim about:blank &
```

Then evaluate `document.timeline.currentTime > 0` to confirm the clock runs
before trusting any measurement.

## Pixel-art crispness

- All art goes through `<PixelImage>`: `image-rendering: pixelated` and a plain
  `<img>`. **Never `next/image` for pixel art** — sharp resampling blurs it.
- **Integer scaling only.** `--mc-scale` is 2 (mobile) / 3 (desktop) / 4 (≥1920px).
  A 16px texture drawn at 40px produces uneven pixel widths and shimmer.
- Avoid `translateZ(0)` on pixel layers; GPU compositing can introduce
  half-pixel offsets.
- Press Start 2P for headings/buttons only; VT323 for body. Press Start 2P at
  paragraph sizes is genuinely unreadable.
