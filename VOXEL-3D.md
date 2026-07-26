# 3D voxel village

A walkable, Minecraft-*style* 3D village rendered with React Three Fiber. All
geometry is generated in code — there are no model files, no textures, and
nothing derived from Mojang assets.

Open `/world` and pick **3D** (it auto-selects on capable desktop browsers).

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | Walk (camera-relative) |
| `Space` | Jump — apex ~1.2 blocks, clears a one-block ledge |
| Drag | Orbit the camera |
| `Q` / `E` | Turn without a mouse — the keyboard-only path |
| `Enter` | Enter the building you are standing next to |
| Click a label or beacon | Go to that event category |
| Touch drag (left pad) | Virtual joystick, shown only on coarse-pointer devices |
| Jump button (bottom right) | Touch equivalent of Space — touch devices have no keyboard |

## What is in the village

Seven buildings, placed at the **same percentage coordinates** as the 2D map's
signposts (`src/lib/world/world-locations.ts`), so both views describe one place:

Hackathon Mine (hillside cave, emerald seams, cart rails) · Photography Forest
(blocky woodland) · Design Workshop (timber hut, pitched roof) · Quiz Library
(tall hall, glass windows, beacon) · Gaming Arena (tiered colosseum) · Village
Square (fountain plaza, lantern posts — the spawn) · Leaderboard Castle (keep
with four gold-capped towers). Plus a portal landmark, paths between buildings,
a lake, and scattered trees and boulders.

Generation is **seeded** (`SEED` in `village.ts`), so the village is identical on
every load. That is not just tidiness: the anchor positions are what the UI links
to, so a village that reshuffled would move buildings out from under their labels.

## Files

```
src/lib/voxel/blocks.ts      block palette (colour, transparency, emissive)
src/lib/voxel/world.ts       sparse voxel grid, height map, visibility pass
src/lib/voxel/village.ts     procedural village generator
src/components/voxel/
  voxel-terrain.tsx          face-culled mesh builder  ← the renderer
  voxel-character.tsx        cube character, 5 archetypes, walk cycle
  player-controller.tsx      movement, collision, third-person camera
  building-markers.tsx       floating labels + beacons
  touch-controls.tsx         virtual joystick
  village-scene.tsx          Canvas, lighting, input wiring
  voxel-world.tsx            dynamic import + capability detection
```

## The performance work (and why it was needed)

**Do not replace the mesh builder with `InstancedMesh` of cubes.** That was the
first implementation and it was measurably wrong:

| Approach | Vertices | FPS (SwiftShader, 1440×900) |
|---|---|---|
| InstancedMesh, one cube per block | 366,768 | **4** |
| Face-culled merged mesh | 91,104 | **19** |

A cube is 24 vertices, but a block inside a wall shows at most one face. The
proof it was geometry-bound and not fill-rate-bound: framerate stayed pinned at
4fps even when the viewport shrank 8× (1M → 130k pixels). After face culling,
FPS *does* scale with resolution — the correct signature for a software
rasterizer, and real GPUs have vastly more fill rate than SwiftShader.

Other measures that matter:

- **Crust-only terrain.** Columns generate 4 blocks deep, not down to bedrock.
  71k blocks → 28k, with no visible difference from any reachable camera position.
- **One draw call for all opaque blocks.** Every block type merges into a single
  geometry with colour carried per-vertex, including baked per-face brightness
  (top bright, sides mid, bottom dark) — which is what gives untextured cubes
  their form.
- **DPR clamped to 1.75.** A 3× phone would otherwise render 9× the pixels of a
  1× display for no gain on blocky art.
- **1024 shadow map** over a frustum sized to the village, with `normalBias`.

## Bugs worth remembering

Each of these produced a dramatic visual failure and a non-obvious cause:

1. **Canvas collapsed to 150px.** R3F's container does not inherit a
   flex-derived parent height; it falls back to the canvas intrinsic size. Fixed
   by absolutely filling the relative wrapper.
2. **Forest grew 40-block pillars.** Tree trunks are solid, so planting raised
   the column height map; a second tree rolled onto the same column started from
   the first one's canopy and stacked. Fixed by requiring bare grass.
3. **A giant mesa blacked out half the view.** `flatten()` used `groundAt()`,
   which counts *any* solid block — so the castle treated the neighbouring
   library's **roof** as ground, raised its whole 17×17 footprint to roof height,
   and built towers on top. Fixed by snapshotting natural terrain height before
   any construction and flattening against that.
4. **Camera inside the terrain.** Third-person cameras need collision; without
   it the camera sat inside hills and rendered their unlit interiors. Fixed by
   marching the ray from the player's head and pulling the camera in.
5. **Strafe was mirrored.** `atan2(right, forward)` yields `(cos yaw, -sin yaw)`,
   but a Three.js camera's local +X (screen right) is `(-cos yaw, sin yaw)` — the
   negation. So D drove screen-left. Fixed by negating `right` in the move angle.
   Worth deriving rather than sign-flipping by trial: the same reasoning governs
   any camera-relative control you add later.
6. **Shadows a third of the map long.** The sun sat at ~50° elevation. Raised to
   ~73°, with high ambient — flat-shaded voxels have no texture detail to carry
   a dark area, so an unlit face reads as a rendering fault rather than shade.

## Vertical movement

Gravity is 26 blocks/s² (real-world 9.8 feels floaty at this scale) and jump
velocity 8.4, giving an apex of ~1.2 blocks — enough to clear a one-block ledge.

Three details that make it feel right rather than merely work:

- **Coyote time (0.12s).** A jump still registers just after walking off an
  edge. Without it, jumping at the lip of a ledge silently fails.
- **Step-up is gated on being grounded.** Otherwise the player snaps onto ledges
  they are falling past.
- **`e.repeat` is ignored, and the request is a latch** consumed once per frame,
  so holding Space cannot machine-gun jumps and one press is exactly one jump.

Verified: apex 1.16 blocks, lands back on ground, and a second press mid-air
does not raise the apex (no double jump).

## Fallbacks — the 3D view is never the only path

`/world` offers **3D · Map · List**, and all three are equal views of the same
data. Verified behaviour:

| Condition | Result |
|---|---|
| Desktop + WebGL | Auto-selects 3D |
| `prefers-reduced-motion` | Auto-selects **Map**; 3D stays available but titled with a warning, and choosing it shows an explanation |
| Screen ≤ 640px | Auto-selects **List**; the three.js bundle is never downloaded |
| No WebGL | 3D button disabled with an explanatory title |
| List view | 8 location links, canvas unmounted — the screen-reader and keyboard path |

An explicit user choice is never overridden by auto-selection.

Three.js only loads on the 3D view (`dynamic(..., { ssr: false })`), so no other
route pays for it. `ssr: false` is also required outright — Three touches
`window` and WebGL at import time.

## Extending it

Add a building by adding a block to `buildVillage()` in `village.ts`:

```ts
const s = sites.get("my-location")!;
const y = flatten(s.x, s.z, 5);          // level the site to natural terrain
world.box(s.x-4, y+1, s.z-3, s.x+4, y+4, s.z+3, "plank");
addAnchor("my-location", { x: s.x, y: y+1, z: s.z }, 6, 10);
```

`addAnchor` links it to `WORLD_LOCATIONS`, which supplies the label and the route
the marker navigates to. Add a new block type in `blocks.ts` and it is picked up
automatically — one entry, no renderer changes.
