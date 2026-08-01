# 3D voxel world

A walkable, Minecraft-*style* 3D rendering of **our building** — the corridor
ring, its classrooms, the staff room and the café — with React Three Fiber. All
geometry is generated in code: there are no model files, no textures, and
nothing derived from Mojang assets. The layout is real; the naming is fiction.

Open `/world` and pick **3D** (it auto-selects on capable desktop browsers).

**One voxel is 0.5 m.** Every length in the 3D components is in voxels, which
are the scene's world units — so a 1.8 m person is 3.6 units tall and a 3 m wall
is 6 blocks. Anything hand-tuned in these files (camera boom, fog, shadow
frustum, marker sizes) is in that unit and has to move with it.

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | Walk (camera-relative) |
| `Space` | Jump — apex ~2.7 blocks (≈1.36 m), clears a one-block step |
| Drag | Orbit the camera |
| `Q` / `E` | Turn without a mouse — the keyboard-only path |
| `Enter` | Enter the building you are standing next to |
| Click a label or beacon | Go to that event category |
| Touch drag (left pad) | Virtual joystick, shown only on coarse-pointer devices |
| Jump button (bottom right) | Touch equivalent of Space — touch devices have no keyboard |

## What is in the world

A **corridor ring** 3 m wide wrapping an open courtyard, with rooms hanging off
the outside of it on all four sides. The building is a cross, not a rectangle —
there is deliberately no "envelope", because an earlier draft carried one and it
disagreed with the room table by a metre within a day.

| Wing | Rooms | Realm names |
|---|---|---|
| North | Classrooms G F E D C | Photography Forest · Design Workshop · Quiz Library · Gaming Arena · Hackathon Mine |
| East | Classrooms B, A | Sponsors' Pavilion · Leaderboard Castle |
| West | Staff Room | Wardens' Hall |
| South | Sitting area + café, open-plan | Hearth Hall |
| Middle | Courtyard, open to sky | Village Square |

Ten locations, and the item manifest holds exactly ten sprites — one each. Note
the **hotbar only shows nine**: see `HOTBAR_LOCATIONS` in `world-locations.ts`.

Outside is a flat grass apron with scattered shrubs and boulders, a path to the
main doors, and the portal landmark you arrive through. There is **no terrain**
— a floor plan has one level, and rolling ground under it only fights the
geometry.

**`floor-plan.ts` owns every dimension**, in metres. `village.ts` owns only how
those dimensions become blocks, and the 2D map projects the very same world. So
moving a wall moves it in all three places at once. Generation is **seeded**
(`SEED` in `village.ts`); only the scatter is random at all.

**Grid coordinates are never negative.** Rooms genuinely sit at negative metre
coordinates (the north classrooms are at z −7…0), but the player clamp and the
map projection both index from zero, so `GRID_ORIGIN_M` shifts the plan into
positive space. `gx()` / `gz()` are the only sanctioned conversion.

## Files

```
src/frontend/lib/world/floor-plan.ts  THE PLAN — rooms, corridor, sizes, in metres
src/frontend/lib/voxel/blocks.ts      block palette (colour, transparency, emissive)
src/frontend/lib/voxel/world.ts       sparse voxel grid, height map, visibility pass
src/frontend/lib/voxel/village.ts     extrudes the floor plan into blocks
src/frontend/components/voxel/
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
| Face-culled merged mesh (old village) | 91,104 | **19** |
| Face-culled merged mesh (this building) | 99,164 | — |

The current world is 126 × 104 voxels: 19,174 blocks, of which 18,911 are
visible. Note how little `visibleBlocks()` removes — it only drops blocks with
six solid neighbours, and a single-storey building on a one-layer floor has
almost none. The 0.5 m grid therefore buys detail at close to a linear cost in
geometry, which is why the numbers below are worth keeping an eye on. The dev
HUD in the bottom-right of the 3D view prints all three live.

A cube is 24 vertices, but a block inside a wall shows at most one face. The
proof it was geometry-bound and not fill-rate-bound: framerate stayed pinned at
4fps even when the viewport shrank 8× (1M → 130k pixels). After face culling,
FPS *does* scale with resolution — the correct signature for a software
rasterizer, and real GPUs have vastly more fill rate than SwiftShader.

Other measures that matter:

- **A one-layer floor.** The old world generated a 4-block crust; on flat ground
  that is pure cost, because the buried layers are culled anyway while the
  *bottom* face of the lowest layer is emitted whatever its depth.
- **No faces below y = 0.** Nothing exists under the world and the camera cannot
  get beneath it, so the underside of the floor is geometry no one can see. On
  rolling terrain that was a rounding error; on a flat single-storey floor it is
  one wasted quad for *every* column — 13k of them, more than the entire
  building's walls put together. Skipping them saved ~52k vertices, which is the
  single largest win in this version.
- **Three draw calls for the whole world** — opaque, self-lit, transparent.
  Every block type merges into one of three geometries with colour carried
  per-vertex, including baked per-face brightness and ambient occlusion.
  **Block types are therefore free**; the count is not a draw-call budget,
  whatever an older comment in `blocks.ts` used to claim.
- **DPR clamped to 1.75.** A 3× phone would otherwise render 9× the pixels of a
  1× display for no gain on blocky art.
- **Shadow map 1024, or 512 under 768px wide**, over a frustum sized to the
  building's footprint, with `normalBias`.

## Making it look like a building

Flat-shaded cubes have no texture to carry form, so everything that makes the
world readable is baked into the mesh or into the palette. In rough order of how
much difference each one made:

- **Vertex ambient occlusion**, computed in `voxel-terrain.tsx`. For each corner
  of each face it samples the three neighbouring blocks and darkens accordingly.
  This is what puts a contact shadow where a wall meets the floor and depth into
  every doorway. Costs no vertices and no draw calls. The quad's triangle split
  is chosen per face to keep the darker corners together — with a fixed diagonal,
  long walls develop a herringbone of light and dark triangles.
- **A self-lit pass.** `BlockDef.emissive` was declared from the first version
  and silently ignored by the renderer, so lanterns and the portal glowed on the
  2D map and looked like painted cubes in 3D. Emissive blocks now render on an
  unlit `meshBasicMaterial` and cast shadows without receiving them.
- **Per-block transparency.** The transparent pass carried one flat `0.72`, so
  glass (0.34) was as opaque as water (0.62) and windows read as walls. Alpha is
  now a 4th component on the vertex colour — Three switches to `USE_COLOR_ALPHA`
  purely on the attribute's `itemSize`.
- **Lower ambient.** It was 1.25, which was right before AO existed and washed
  everything to one tone afterwards. Now 0.62 with a stronger sun.
- **Checkered floors and accent carpets.** AO gives a room its corners but does
  nothing to the middle of a 6,000-block floor; a two-tone tile gives scale, and
  a coloured carpet per room is what makes five identical grey boxes tellable
  apart — in the 3D view and, more importantly, on the plan.
- **Skirting.** One darker course at the foot of every wall. Without it walls run
  into the floor with no visible base.

Leaves are deliberately **opaque** despite being walk-through. Rendering them at
0.96 alpha bought nothing visible and put every leaf in the depth-write-disabled
pass, where overlapping canopies sorted against each other. `NON_SOLID` is what
makes a block walk-through; that is a separate question from how it draws.

## Bugs worth remembering

Each of these produced a dramatic visual failure and a non-obvious cause:

1. **Canvas collapsed to 150px.** R3F's container does not inherit a
   flex-derived parent height; it falls back to the canvas intrinsic size. Fixed
   by absolutely filling the relative wrapper.
2. **Forest grew 40-block pillars.** Tree trunks are solid, so planting raised
   the column height map; a second tree rolled onto the same column started from
   the first one's canopy and stacked. Fixed by requiring bare grass.
3. **Every room in the building was sealed.** `groundAt()` returns the highest
   solid block *anywhere* in a column. That was harmless while the world had no
   doorways — the old "doors" were solid decorative blocks you could never walk
   through. With real openings, standing in a doorway made the **lintel above
   your head** the ground: the controller placed the player on top of the door
   frame, so no door was passable. Fixed with `groundBelow(x, y, z)`, which
   scans *down* from the player. The lesson generalises — any overhang, arch or
   ceiling breaks a highest-solid-block height map.
4. **A door that opened onto nothing.** Classroom G was laid out overhanging the
   corridor ring's west end, so its doorway was punched through a stretch of
   wall that did not exist and the room sealed itself. Rooms must sit within the
   span of the ring wall they open onto — worth a flood-fill check rather than
   an eyeball, because the wall looks perfectly correct in both views.
5. **Camera inside the terrain.** Third-person cameras need collision; without
   it the camera sat inside hills and rendered their unlit interiors. Fixed by
   marching the ray from the player's head and pulling the camera in.
6. **Strafe was mirrored.** `atan2(right, forward)` yields `(cos yaw, -sin yaw)`,
   but a Three.js camera's local +X (screen right) is `(-cos yaw, sin yaw)` — the
   negation. So D drove screen-left. Fixed by negating `right` in the move angle.
   Worth deriving rather than sign-flipping by trial: the same reasoning governs
   any camera-relative control you add later.
7. **Shadows a third of the map long.** The sun sat at ~50° elevation. Raised to
   ~73°, with high ambient — flat-shaded voxels have no texture detail to carry
   a dark area, so an unlit face reads as a rendering fault rather than shade.

## Vertical movement

Gravity is 52 blocks/s² and jump velocity 16.8, giving an apex of ~2.7 blocks.
At 0.5 m per voxel that is 26 m/s² and 1.36 m — the same real-world feel as the
old 1 m-per-voxel village, which used exactly half of each number.

Three details that make it feel right rather than merely work:

- **Coyote time (0.12s).** A jump still registers just after walking off an
  edge. Without it, jumping at the lip of a ledge silently fails.
- **Step-up is gated on being grounded.** Otherwise the player snaps onto ledges
  they are falling past.
- **`e.repeat` is ignored, and the request is a latch** consumed once per frame,
  so holding Space cannot machine-gun jumps and one press is exactly one jump.

`STEP_HEIGHT` stays ~1 voxel, which is now a 0.5 m step rather than a 1 m one —
the right value for a kerb, and the reason **furniture must be at least 2 voxels
tall**. Anything shorter is something the player walks on top of instead of
around, so `floor-plan.ts` asserts it rather than trusting a comment.

## Fallbacks — the 3D view is never the only path

`/world` offers **3D · Map · List**, and all three are equal views of the same
data. Verified behaviour:

| Condition | Result |
|---|---|
| Desktop + WebGL | Auto-selects 3D |
| `prefers-reduced-motion` | Auto-selects **Map**; 3D stays available but titled with a warning, and choosing it shows an explanation |
| Screen ≤ 640px | Auto-selects **List**; the three.js bundle is never downloaded |
| No WebGL | 3D button disabled with an explanatory title |
| List view | 10 location links, canvas unmounted — the screen-reader and keyboard path |

An explicit user choice is never overridden by auto-selection.

Three.js only loads on the 3D view (`dynamic(..., { ssr: false })`), so no other
route pays for it. `ssr: false` is also required outright — Three touches
`window` and WebGL at import time.

## Extending it

Add a room with **one entry in `floor-plan.ts`** — `village.ts` needs no change:

```ts
// metres; the corridor ring spans x 8–48, z 0–25
{ key: "my-location", name: "H", kind: "classroom",
  x: 9, z: 26, w: 7, d: 7, door: "n", windows: ["s"] },
```

Then a matching entry in `WORLD_LOCATIONS`, which supplies the label, the item
sprite and the route. Both views and the List pick it up from there.

Two things the geometry has to respect, both of which fail silently:

- **The door wall must overlap the ring wall it opens onto.** A room hanging
  past the end of the ring punches its doorway through a wall that is not there
  and seals itself — see bug 4 above.
- **`WORLD_LOCATIONS` beyond ten needs a new item sprite**, and `item-icon.tsx`
  declares `Record<ItemName, Glyph>` exhaustively, so an eleventh item is a type
  error until a glyph is drawn. Past nine, decide explicitly which location the
  hotbar drops (`HOTBAR_LOCATIONS`).

Adding a **block type** is one entry in `blocks.ts` (plus the `BlockType` union)
and needs no renderer change — and costs no draw call.

Worth running after any layout change: a flood fill from `spawn` over standable
columns, checking every room's interior is reached. Both of the sealing bugs
above looked completely correct in the 3D view and on the map.

## Where the player is

`PlayerController` publishes a `PlayerPose` (position + yaw) about 8 times a
second — never per frame, since keeping React out of the movement loop is the
reason input lives in a ref at all. It only fires when the player has actually
moved or turned.

The pose is held in `world-screen.tsx`, not in the scene, because **the canvas
unmounts when you switch to the Map view** — which is the exact moment the
position becomes interesting. Before any 3D session it falls back to the spawn
point, so the marker is never simply absent.

`projectToPct()` and `headingDegrees()` in `village-map-art.ts` put that pose
through the same projection the canvas drew with. The heading needs projecting
too: isometric skews direction as well as position, and the rotation control
turns it further — a facing arrow rotated by the raw yaw points at the wrong
room in every view except unrotated plan.

## Rotating the map

Both projections turn in 90° steps. This is not decoration: an isometric view
only ever shows two sides of a building, so without it the north and west faces
of every room are permanently hidden.

Rotation happens in GRID space, before the projection, which is what lets one
implementation serve both views. Three things have to follow it, and each fails
silently on its own:

- **Canvas extents swap** on the odd quarters. The building is 126 × 104, so
  forgetting this crops a third of it away.
- **The isometric depth sort** is the sum of the ROTATED coordinates. `x + y + z`
  is only camera depth in the frame the camera is actually in; sorting on the
  raw values draws the far side of the building over the near side.
- **Face selection.** The draw picks which two side faces to paint from the +x
  and +z neighbours. Once the world is turned, "the face pointing down-right on
  screen" is a different world axis — see `RIGHT_STEP` / `LEFT_STEP`.

The compass button reads out which world direction is currently at the top.

One typography trap worth remembering: the rotate buttons originally used ↺/↻,
which **Press Start 2P has no glyph for**. The browser silently fell back to a
system font, so they rendered thin and half-size beside the chunky pixel
compass letter. Anything placed in a `font-pixel` control has to exist in that
font — plain ASCII is the safe bet.
