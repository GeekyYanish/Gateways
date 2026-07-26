# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Next 16 dev server (Turbopack) on :3000
npm run build    # production build — also the real typecheck of route types
npm start        # serve the production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit # standalone typecheck
```

**There is no test runner.** The suites are two dev-only routes that 404 in production:

- `/dev/data-test` — ~40 live assertions against the data layer (`src/app/dev/data-test/data-test.tsx`). To run "a single test", edit `runSuite()` and reload the page; it wipes the store on each run, so results are deterministic.
- `/dev/kitchen-sink` — every design-system primitive in every variant.

Both gate on `process.env.NODE_ENV === "production"` → `notFound()` in their `page.tsx`.

## Architecture

Read `README.md` first — it is the canonical project overview. The topic docs are `ANIMATION.md`, `ART-ASSETS.md`, `VOXEL-3D.md`, and `SUPABASE-MIGRATION.md` (full target schema + RLS design). Points below are the ones that change how you write code here.

### The data seam

Nothing outside `src/lib/data/` may touch `localStorage`. Screens import `repo` from `@/lib/data` and depend only on the `Repository` interface (`src/lib/data/repository.ts`). `src/lib/data/index.ts` is the single construction point — the Supabase migration is one line there plus a second implementation.

- **Every repository method is `async`**, even though localStorage is synchronous. Keep it that way; a synchronous signature would have to be unwound at every call site later.
- Failures throw `DataError` with a stable `code` (`EMAIL_TAKEN`, etc.) matching what a Postgres RPC would return. Catch on `code`, not on message.
- Invariants the app leans on, enforced in `local-repository.ts` and asserted by `/dev/data-test`: XP grants idempotent on `(userId, sourceType, sourceId, reason)` with `totalXp` recomputed as the ledger **sum** (never incremented); no double registration; check-in idempotent; achievements unlock once. Preserve these in any new implementation.
- Data fetching in components uses `useAsync` (`src/hooks/use-async.ts`), not TanStack Query. Its `{ data, error, loading, reload }` shape mirrors TanStack deliberately, so that's the swap point later.

`localStorage is not a security boundary` — there is no server. Any role/XP gate is UI-only until Supabase lands.

### Routes

App Router with route groups: `(public)` no account needed · `(auth)` login/character creation · `(portal)` cinematic transitions · `(realm)` authenticated.

- Auth protection is a **client guard** in `src/app/(realm)/layout.tsx` (`status` is `unauthenticated` / `needs-character` / `ready`), because localStorage has no server presence. It moves to `middleware.ts` with Supabase.
- **Convention: `page.tsx` is a thin server component** holding `metadata` and rendering a sibling `*-screen.tsx` client component that carries the actual UI. Follow it for new routes.
- `<MotionConfig reducedMotion="user">` is mounted once per route-group layout — don't remount it per component.

### Design system

`src/components/mc/` is the primitive layer (`Block*`, `Pixel*`, `Hotbar`, `XpBar`, …); import from the `@/components/mc` barrel. Compose from these rather than styling raw elements.

Tailwind **v4, CSS-first**: there is no `tailwind.config.ts`. Every token lives in `@theme` in `src/app/globals.css` and becomes a utility automatically (`--color-mc-grass` → `bg-mc-grass`). Add tokens there, not in a config file.

- Each block colour is a triple: base, `-light` (top/left bevel), `-dark` (bottom/right). **Never hand-pick a bevel colour** outside the scale — use the `bevel` / `bevel-pressed` / `bevel-inset` custom utilities.
- `--mc-scale` (2 mobile / 3 desktop / 4 ≥1920px) rescales the whole pixel UI. Scaling must stay **integer** or pixel art shimmers.
- Fonts are role-split in `src/lib/fonts.ts`: Press Start 2P for headings/buttons/short labels only, VT323 for body. This is a legibility requirement, not a preference.
- Use `cn()` from `@/lib/utils` for class merging.

### Art assets

**No component hardcodes an image path.** All paths live in `src/lib/assets/manifest.ts` (sprites/skins/blocks/badges) and `src/lib/assets/scenes.ts` (parallax scenes). Each entry declares intrinsic 1x dimensions, and `<PixelImage>` renders a generated placeholder at exactly those dimensions until the real file lands in `public/art/**` — so nothing shifts on delivery.

**Never use `next/image` for pixel art** — the optimizer resamples and blurs it. `<PixelImage>` uses a plain `<img>` plus `image-rendering: pixelated`.

Adding a parallax scene is one entry in `scenes.ts`, no component changes.

### Animation

**One rule: GSAP owns timelines, Framer Motion owns components.** Never animate the same property with both on one element. `ANIMATION.md` has the full ruleset; the ones that cause real bugs:

- Always `useGSAP` from `@gsap/react` (never bare `useEffect` + `gsap.to`) and always scope with a ref — otherwise StrictMode's double-invoke leaves two tweens fighting, and global selectors leak across route trees after client navigation.
- Register GSAP plugins only in `src/lib/animation/gsap-init.ts`.
- Set initial hidden states with the `.gsap-hidden` class and tween `to()`; a `.from({opacity:0})` flashes visible content post-hydration. `.gsap-hidden` **must** be force-revealed under reduced motion — content that stays invisible when JS fails is a hard failure.
- Framer: never animate across mixed units (`width: 0 → "35%"` silently leaves the element at its initial value — this emptied every XP bar once). Animate `scaleX`.
- Reduced motion is honoured in three coordinated layers (`gsap.matchMedia`, `MotionConfig`, a `globals.css` media block) plus an in-app toggle that sets `data-reduce-motion` on `<html>`. Changes must respect all four.

### 3D voxel village (`/world`)

React Three Fiber, loaded via dynamic import in `voxel-world.tsx` so no other route pays for three.js. All geometry is generated in code — no models, no textures.

- **Do not replace the face-culled mesh builder (`voxel-terrain.tsx`) with `InstancedMesh` of cubes.** That was measured: 367k vertices at 4fps vs 91k at 19fps under software rasterization.
- Village generation is **seeded** (`SEED` in `src/lib/voxel/village.ts`) — buildings must stay put because UI labels anchor to their positions, shared with the 2D map via `src/lib/world/world-locations.ts`.
- `/world` offers 3D · Map · List as equal views; List is the screen-reader and keyboard path. Never make 3D the only route to a feature, and never override an explicit user choice.

### Originality constraint

Minecraft-*inspired* aesthetic only. No Mojang textures, skins, mob designs, or terminology. Character archetypes (`prospector`, `botanist`, `sentinel`, `voidwalker`, `artificer`) and all scene briefs are original — keep new assets and naming original too.

## Verifying animations

The in-app/embedded browser pane runs a **paused animation clock** (`document.timeline.currentTime` stays `0`), so every animation looks frozen at its initial value there. That is a tool artifact — do not "fix" code based on it. Verify in a real browser, or drive headless Chrome over CDP and confirm `document.timeline.currentTime > 0` before trusting a measurement (recipe in `ANIMATION.md`).
