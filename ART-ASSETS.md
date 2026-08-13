# Art asset contract

Drop files into `public/art/**` at the paths and **exact dimensions** below.
Nothing else needs to change — every component reads paths from
`src/frontend/lib/assets/manifest.ts` and `src/frontend/lib/assets/scenes.ts`, and until a file
exists it renders a generated placeholder at the same dimensions.

That means:

- **Deliver art incrementally.** One file at a time is fine.
- **No layout shift when art lands** — the box is already the right size.
- **Wrong-sized art warns in the dev console** (`[PixelImage] … is 48×48 but the
  manifest declares 64×64`), because non-integer scaling is what makes pixel art
  blurry.

Review everything at `/dev/kitchen-sink` (dev only).

---

## Originality requirement — read first

**All artwork must be original.** Do not use, trace, re-colour, or re-export
Minecraft textures, character skins, mob designs, block art, UI, or fonts. Those
are Mojang/Microsoft's copyrighted assets, and shipping them — even modified —
is infringement.

What *is* fine: the **voxel/blocky aesthetic** itself. Cubes, 16×16 texel
grids, chunky pixel shading, isometric block worlds. Style is not protectable;
specific assets are.

Concretely, avoid:

| Don't | Do |
|---|---|
| Steve/Alex/Creeper/Enderman likenesses | The five original archetypes below |
| Mojang's actual `grass_block_side.png` etc. | Your own 16×16 tiles |
| "Redstone", "Nether", "Ender", "Netherite" | "Circuit", "Deepstone", "Void", "Basalt" |
| The Minecraft logo, font, or panel GUI art | Our CSS bevel system + Press Start 2P |

Naming in this codebase already follows that rule — if you add assets, keep it.

---

## Format rules

- **PNG-24 with alpha** for sprites. Indexed PNG-8 is fine where the palette suffices.
- **Author at 1x.** Do not pre-scale to 2x/3x — the app scales by an integer
  `--mc-scale` (2 mobile / 3 desktop / 4 at ≥1920px). Pre-scaled art gets scaled
  twice and turns to mush.
- **No antialiasing on edges.** Hard pixel edges only; the renderer uses
  `image-rendering: pixelated`.
- **Block textures must tile seamlessly** — they repeat as backgrounds.
- **Scene layers**: PNG-24 with alpha (except `sky`, which can be opaque), and
  transparent wherever a layer behind should show through.

---

## Part 1 — Scene layers (backgrounds, portals, biomes)

Path: `public/art/scenes/<scene>/<layer>.png`

A scene is a **stack of layers at different parallax depths**. This is what makes
the backgrounds move with depth — a single flat image cannot parallax. Each layer
is full-bleed, 1920×1080 unless noted, and rendered with `background-size: cover`.

**Depth guide** — 0 never moves, 1 tracks the pointer fully. Keep foreground
under ~0.6 or the motion induces nausea. Depths are already tuned in
`scenes.ts`; adjust there, not in the art.

### `portal-approach` — landing hero (8 layers)

> Dusk valley of blocky terraced hills, violet sky fading to deep indigo, a
> stone archway silhouetted on the ridge.

| Layer | Depth | Size | Notes |
|---|---|---|---|
| `sky` | 0 | 1920×1080 | Opaque violet→indigo gradient |
| `stars` | 0.04 | 1920×1080 | Alpha, sparse pixels, blends `screen` |
| `clouds` | 0.10 | 1920×1080 | **Tileable horizontally**, drifts |
| `ridge` | 0.18 | 1920×620 | Distant hill silhouette, alpha below |
| `hills` | 0.32 | 1920×520 | Mid hills |
| `trees` | 0.46 | 1920×380 | **Tileable**, blocky treeline |
| `ground` | 0.62 | 1920×320 | Foreground terrain, anchored bottom |
| `haze` | 0.08 | 1920×1080 | Soft glow, `screen`, pulses |

### `void-transit` — /entering and /travelling (4 layers)

> Abstract violet energy corridor: concentric blocky rings receding to a bright
> core, drifting motes.

`core` (0, pulses) · `rings` (0.12) · `motes` (0.3, tileable, drifts) ·
`vignette` (0, edge darkening)

### `realm-gate` — auth screens (3 layers)

> Calm night sky over distant blocky rooftops, soft violet horizon glow.
> **Deliberately low contrast** — login forms sit on top and must stay readable.

`sky` (0) · `skyline` (0.14, tileable, 1920×420) · `glow` (0.06, `screen`)

### Biomes — one per event category

Each becomes the banner on `/events?category=<slug>` and the card art.

| Scene | Brief | Layers |
|---|---|---|
| `hackathon-mine` | Cavern of cut stone, glowing green crystal seams, timber supports, cart rails | `cavern` `crystals` `rails` |
| `photography-forest` | Sunlit blocky woodland, layered canopy, godrays, drifting pollen | `sky` `canopy-far` `godrays` `canopy-near` `pollen` |
| `design-workshop` | Timber workshop: plank walls, pinned sketches, lantern light, tool racks | `walls` `benches` `lantern` |
| `quiz-library` | Tall library hall, shelves receding into blue shadow, floating books | `hall` `shelves` `books` `dust` |
| `gaming-arena` | Floodlit blocky colosseum, banner tiers, sand floor, red/amber stage light | `stands` `banners` `floor` `spotlights` |
| `culture-stage` | Open-air night stage, string lights over a blocky courtyard | `night` `courtyard` `stage` `lights` |
| `circuit-lab` | Clean workshop of blocky machinery, glowing conduit lines, teal/slate | `machines` `conduits` `bench` |

Exact per-layer depths, sizes and blend modes live in `src/frontend/lib/assets/scenes.ts` —
that file is the source of truth, and the kitchen-sink page prints them under
each preview.

### AI-generation prompt template

```
Original voxel/blocky pixel art, <SCENE BRIEF>.
Single flat layer showing ONLY the <LAYER> element, transparent background.
Side-on parallax layer for a game background, 1920x1080, horizontally
tileable, hard pixel edges, no antialiasing, limited palette.
No logos, no text, no watermarks, no recognisable game characters.
```

Generate each layer **separately** against transparency. A single merged
illustration cannot be parallaxed apart afterwards.

---

## Part 2 — Sprites and UI

### Character archetypes — original designs

Five archetypes, deliberately not resembling any existing game's characters:

| Id | Design brief |
|---|---|
| `prospector` | Hard hat with lamp, dusty overalls, pickaxe. Earth tones. |
| `botanist` | Leaf-patterned cloak, satchel of cuttings, green/brown. |
| `sentinel` | Plated guard armour, tower shield, slate and steel. |
| `voidwalker` | Deep robe with a starfield pattern, faintly glowing eyes, violet. |
| `artificer` | Goggles, tool belt, brass and teal, wrench. |

| Path | Size | Notes |
|---|---|---|
| `skins/<id>.png` | 64×64 | Head/bust for pickers, headers, leaderboard |
| `skins/full/<id>.png` | 128×256 | Full body, character creation |

### World map

| Path | Size | Notes |
|---|---|---|
| `world/village-map.png` | 2048×1152 | Isometric village, 16:9 |
| `world/village-map-mobile.png` | 1024×1536 | Portrait recrop of the same scene |
| `world/signpost.png` (+`-hover`) | 96×128 | Wooden sign with post, alpha |

Hotspots are **percentages** in `src/frontend/lib/world/world-locations.ts`, so they stay
correct at any map resolution. Adjust the x/y once the real map exists.

### Portal sprites

| Path | Size |
|---|---|
| `portal/portal-frame.png` | 320×400 |
| `portal/portal-swirl.png` | 256×320 (or an 8-frame sheet at 2048×320) |
| `portal/particle.png` | 8×8 (white — CSS tints it) |

Until `portal-frame.png` exists the landing page draws a **CSS stand-in** portal,
because a checkerboard placeholder as the site's hero looks broken.

### Blocks — 16×16, must tile

`dirt` `grass` `stone` `planks` `obsidian` `emerald` `diamond` `basalt`

### Items — 32×32, alpha

`pickaxe` `camera` `book` `sword` `compass` `trophy` `crafting-table` `chest`
`map` `warp-orb`

### Creatures — original designs

The page's wildlife. Same originality rule as the archetypes, and it bites
hardest here: **none of these may be a Mojang mob**, in silhouette or in name.
No creeper, no enderman, no zombie, no skeleton, no slime. If a design starts
looking like one, change it.

Every sprite faces **right** at rest. The decor helpers mirror with CSS to face
one the other way, so a left-facing source arrives back-to-front.

| Id | Size | Design brief |
|---|---|---|
| `glowmite` | 32×32 | Palm-sized beetle with a lantern abdomen. Warm amber glow, dark chitin. |
| `stonewarden` | 48×64 | Squat mossy golem, cut-stone plates, green seams. Slow and friendly. |
| `driftling` | 32×48 | A wisp of banded air with two dot eyes. Pale cyan, semi-transparent. |
| `burrower` | 32×32 | Round tunneller, spade paws, soil on its snout. Earth browns. |
| `pipfowl` | 32×32 | Small ground bird, oversized beak, teal plumage. |

### Decor props — alpha

Set dressing only. Anything a player can *hold* belongs in **Items** instead —
reuse `chest`, `crafting-table`, `map`, `compass` and `trophy` from there rather
than redrawing them here.

| Path | Size | Notes |
|---|---|---|
| `decor/torch.png` | 16×48 | Lit, warm cast at the head |
| `decor/lantern.png` | 16×32 | Hanging, with a ring at the top |
| `decor/sapling.png` | 32×32 | |
| `decor/ore-vein.png` | 32×32 | Glowing seam in stone |
| `decor/sign-board.png` | 48×32 | Blank — text is drawn in HTML over it |
| `decor/flower-pot.png` | 16×24 | |
| `decor/fence.png` | 32×32 | **Tileable horizontally** |

### Badges — 64×64, alpha

`badges/<code>.png` where `<code>` is the achievement's `code` field, e.g.
`badges/first_steps.png`. Filename must match exactly.

### UI chrome

| Path | Size | Notes |
|---|---|---|
| `ui/hotbar.png` | 364×44 | 9 slots of 40px + 2px border |
| `ui/slot.png` | 18×18 | |
| `ui/xp-empty.png` / `xp-full.png` | 182×5 | |
| `ui/heart.png` | 9×9 | |
| `ui/panel.png` | 48×48 | 9-slice, 16px corners |

---

## Using the components

```tsx
import { AnimatedBackground, BiomeScene } from "@/frontend/components/scene";

// Full-bleed animated background with parallax
<AnimatedBackground scene="portal-approach">
  <YourContent />
</AnimatedBackground>

// Quieter, for pages where content must dominate
<AnimatedBackground scene="realm-gate" intensity={0.5}>…</AnimatedBackground>

// Bounded biome illustration (cards, banners)
<BiomeScene scene="photography-forest" className="h-[180px]" />

// Long scrollable pages can also shift layers on scroll
<AnimatedBackground scene="portal-approach" scrollParallax>…</AnimatedBackground>
```

Adding a scene = one entry in `scenes.ts`. No component changes.

Notes on behaviour:
- **One pointer listener per scene**, coalesced to one update per frame. Eight
  layers cost one listener, not eight.
- **`gsap.quickTo`** reuses a tween per property instead of allocating one per
  pointer move — that is what holds 60fps with a deep stack.
- **Reduced motion disables parallax and ambient loops entirely** — verified: 0
  of 8 layers move, and all content stays visible.

---

## Current status

All 42 sprite assets and 43 scene layers render as placeholders today. The app is
fully functional and reviewable without a single art file.
