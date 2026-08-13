# Parallax

A voxel-styled college fest portal. Blocky pixel-art UI, an animated portal entry
sequence with layered parallax scenes, a **walkable 3D voxel model of our
building**, and a working event/character system.

Minecraft-*inspired* in aesthetic only — every asset, name and texture is
original. See [Art](#art--all-external-all-original).

**Phases 0–5 are built.** Events, teams, QR check-in and the organizer/admin
dashboards are the next run — see [Roadmap](#roadmap).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, scroll the homepage, and click **START THE JOURNEY**.

Two dev-only pages (they 404 in production):

- `/dev/kitchen-sink` — every design-system primitive in every variant
- `/dev/data-test` — 40 assertions against the data layer

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind **v4** — tokens live in `@theme` in `globals.css`, not a config file |
| 3D | React Three Fiber + three.js (`/world` only, dynamically imported) |
| Cinematics | GSAP (`@gsap/react`) |
| UI motion | Framer Motion |
| Dialogs | Radix Dialog (focus trap + scroll lock), fully reskinned |
| Forms | react-hook-form + zod |
| Toasts | sonner, custom render surface |
| Data | **localStorage** behind a repository interface — MySQL 8.4 + Drizzle later |

## Architecture

### Source layout

The App Router stays in `src/app`, so route groups, dynamic segments, layouts,
and URLs remain visible in one place. Route files are deliberately thin:

```text
src/
├── app/       Next.js pages, layouts, metadata, and global CSS
├── frontend/  screens, reusable components, hooks, animation, and rendering
└── backend/   repository contracts and data implementations
```

`src/backend` is the application's data boundary. Its current implementation is
browser-local because the MySQL backend has not landed yet; moving to a real
server does not require reorganizing the frontend again.

### The data seam

Screens never touch `localStorage`. Everything goes through the `Repository`
interface (`src/backend/data/repository.ts`), currently implemented by
`LocalRepository`. `src/backend/data/index.ts` is the single construction point, so
swapping in MySQL is one line plus a second implementation.

Every method is `async` even though localStorage is synchronous — otherwise
swapping in a network backend would mean touching every call site.

Guarantees enforced in the local implementation (and verified by `/dev/data-test`):

- **XP grants are idempotent** on `(userId, sourceType, sourceId, reason)`, and
  `totalXp` is always recomputed as the ledger **sum**, never incremented — so a
  duplicate write cannot drift the cache.
- **No double registration** — unique `(eventId, userId)`; over-capacity
  registrations waitlist, and cancelling a seat promotes the earliest waitlister.
- **No double check-in** — a second check-in returns the original record without
  re-awarding XP.
- **Achievements unlock once** — composite key on `(userId, achievementId)`.

These mirror the actual SQL constraints in
[MYSQL-MIGRATION.md](MYSQL-MIGRATION.md), which has the full schema, the
authorization model, and the transactions that enforce capacity and team size.
[DECISIONS.md](DECISIONS.md) records why the backend is MySQL rather than Postgres.

### ⚠️ localStorage is not security

There is no server, so there is no security boundary. Any user can edit their own
roles, XP or registrations in devtools. Passwords are SHA-256 + salt rather than
plaintext, which is better than nothing but still offline-attackable.

Consequences to be explicit about:

- Organizer/admin views built later are **UI-only** until the MySQL backend lands.
- **QR check-in cannot be trusted** without a server-held signing secret.
- Data does not sync across devices or browsers.

### Art — all external, all original

Two manifests, and **no component hardcodes a path**:

- `src/frontend/lib/assets/manifest.ts` — sprites, skins, blocks, items, badges, UI (42 assets)
- `src/frontend/lib/assets/scenes.ts` — layered parallax scenes (10 scenes, 43 layers)

Each entry declares its intrinsic dimensions, and a generated SVG placeholder
renders at exactly those dimensions until the real file lands in `public/art/**`.
So the app is fully demoable today and **nothing shifts on delivery**.

**Everything is original voxel-inspired work.** No Mojang textures, skins, mob
designs, or terminology — the five character archetypes (`prospector`,
`botanist`, `sentinel`, `voidwalker`, `artificer`) and all scene briefs are ours.
The blocky *aesthetic* is fair game; specific assets are not.
[ART-ASSETS.md](ART-ASSETS.md) has the full spec plus AI-generation prompts.

Placeholders are deliberately non-generic: scene layers draw blocky silhouettes
in each scene's own palette with atmospheric depth, so parallax is visible and
tunable pre-art. The landing portal draws a CSS obsidian frame rather than a
checkerboard, because a placeholder as the site's hero looks broken.

### 3D voxel world

`/world` renders **our actual floor plan** with React Three Fiber — the corridor
ring around the courtyard, classrooms A–G, the staff room and the café — with a
controllable cube character, WASD movement with collision, doorways you can walk
through, and click-to-navigate markers wired to the same event categories as the
2D map. All geometry is generated in code; there are no models or textures.

The layout is real; the naming is fiction. Classroom C is the Hackathon Mine,
the staff room is the Wardens' Hall, the courtyard is the Village Square. One
voxel is 0.5 m, so desks and doorways read at the right size.

Every dimension lives in `src/frontend/lib/world/floor-plan.ts`, in metres. The
3D view, the 2D map and the marker positions are all derived from it, so moving
a wall moves it everywhere at once.

Full detail, including the performance work and the bugs worth remembering, is
in [VOXEL-3D.md](VOXEL-3D.md). The headline: rendering blocks as instanced cubes
ran at **4fps**; emitting only the faces that touch air cut vertices from 367k
to 91k and took it to **19fps under software rasterization** (real GPUs are far
faster). Three.js loads only on the 3D view, so no other route pays for it.

`/world` offers **3D · Map · List** as equal views. The map draws in either
**plan or isometric** projection and **rotates in 90° steps**, so no wing of the
building stays hidden behind the isometric angle. Both projections show a live
**"YOU" marker** with your facing direction, carried over from wherever you
walked to in 3D — the canvas unmounts when you switch views, so the position is
held above it and falls back to the spawn point before your first 3D session.

3D auto-selects on capable desktops; reduced-motion users get Map with an
explanation, phones get List, and List remains the screen-reader and keyboard
path. An explicit choice is never overridden.

### Animated backgrounds and parallax

```tsx
import { AnimatedBackground, BiomeScene } from "@/frontend/components/scene";

<AnimatedBackground scene="portal-approach">…</AnimatedBackground>
<AnimatedBackground scene="realm-gate" intensity={0.5}>…</AnimatedBackground>
<BiomeScene scene="photography-forest" className="h-[180px]" />
```

Adding a scene is one entry in `scenes.ts` — no component changes. Each scene is
a stack of layers at different depths (sky → far → mid → fore → overlay), with
optional drift and pulse per layer.

Implementation notes that matter:
- **One pointer listener per scene**, coalesced to one update per frame. Eight
  layers cost one listener, not eight.
- **`gsap.quickTo`** reuses one tween per property instead of allocating per
  pointer move — that is what holds 60fps on a deep stack.
- **Verified**: 8 layers move by 8 distinct amounts in proportion to depth
  (sky 0 → ground 26.9px); under `prefers-reduced-motion` **0 of 8 move** and all
  13 `.gsap-hidden` elements stay visible.

### Animation

One rule: **GSAP owns timelines, Framer Motion owns components.** The full
ruleset — including the GSAP/StrictMode pitfalls, the mixed-unit interpolation
bug that silently empties progress bars, and the three-layer reduced-motion
setup — is in [ANIMATION.md](ANIMATION.md).

Reduced motion is honoured three ways (`gsap.matchMedia`, `MotionConfig`, and a
CSS block) plus an in-app toggle in Settings, because many motion-sensitive users
have never changed their OS setting. With it enabled the portal still renders but
stops pulsing, and the transition routes skip straight to their destination.

## Routes

**Public** — no account needed, so the fest can actually be shared:
`/` `/events` `/events/[slug]` `/leaderboard` `/schedule` `/sponsors`

`/` is the fest homepage: a panning voxel-overworld hero, the Digital Twins
theme story, and the registration/contact detail, with Events and Schedule in
modals. Every fact it prints (dates, fees, contacts, socials) comes from
`src/frontend/lib/fest.ts` — `grep TODO` there for what still needs real 2026
values. The portal CTA sits at the end of the Parallax section rather than in
the hero, so the ask lands after the explanation.

**Start the Journey** goes to `/portal`, the gate — the portal screen with its
own entry choreography — and *that* page's **Enter the Portal** fires the wipe
into `/entering`. Two presses, deliberately: `/entering` redirects on arrival,
so linking a marketing page straight at it would flash past and drop the
visitor on a login form with no sense of having gone anywhere.

**Auth**: `/login` `/create-character`
**Gate + transitions**: `/portal` `/entering` `/travelling`
**Authed**: `/world` `/dashboard` (+ `events`, `achievements`, `team`,
`notifications`, `profile`, `settings`)

Route protection is a client guard in `(realm)/layout.tsx` because localStorage
has no server presence. It moves into `middleware.ts` with the MySQL backend.

## Verify

```bash
npm run build && npm start
```

Checked and passing: clean `tsc` and `eslint`; production build (22 routes);
full funnel landing → portal → signup → character → travelling → world with zero
console errors; 40/40 data-layer assertions; case-insensitive player-name
collision blocking submit; registration awarding XP and unlocking achievements;
`prefers-reduced-motion` leaving no content invisible (13/13 `.gsap-hidden`
elements revealed) and cutting the portal route from ~2600ms to ~150ms; no
unlabelled inputs, unnamed buttons, missing `alt`, or horizontal overflow;
375px mobile layout with a working tab bar; dev pages 404 in production.

**Note:** verify animations in a real browser, not an embedded preview pane —
some panes run a paused animation clock (`document.timeline.currentTime === 0`),
which makes every animation look frozen at its initial value.

## Roadmap

| Phase | Scope |
|---|---|
| 6 | Full events CRUD, richer registration flows |
| 7 | Team creation/join UI (the data layer already supports it) |
| 8 | QR check-in — HMAC rotating tokens, organizer scanner. **Needs HTTPS + MySQL** |
| 9 | Organizer + admin dashboards, realtime announcements |
| 10 | Certificates, gallery, public profiles |
| 11 | Drop in real art files |
| 12 | Hardening, load test, Lighthouse pass |

The MySQL backend should land **before or with Phase 8** — QR attendance and role
gating are meaningless without a real server boundary.
