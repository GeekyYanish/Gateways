/**
 * THE FLOOR PLAN — the single source of truth for the shape of our building.
 *
 * Authored in METRES, with the courtyard's north-west corner as the origin,
 * `+x` east and `+z` south. Everything downstream (the 3D voxel world, the 2D
 * map, the marker percentages) is derived from this file, so recalibrating the
 * building to real measurements is a handful of edits here rather than a
 * rebuild.
 *
 * **The building is a cross, not a rectangle.** A corridor ring wraps an open
 * courtyard, and rooms hang off the OUTSIDE of that ring on all four sides —
 * classrooms C–G to the north, A and B to the east, the Staff Room to the west,
 * the sitting area and café to the south. There is deliberately no "envelope"
 * rectangle: an earlier draft carried one and it immediately disagreed with the
 * room table by a metre. The plan's extent is computed from the ring and the
 * rooms (`PLAN_MIN` / `PLAN_MAX`), so the two can never drift apart.
 *
 * ## Grid coordinates are never negative
 *
 * Rooms genuinely sit at negative metre coordinates — the northern classrooms
 * are at z −7…0. But two consumers assume the voxel grid starts at 0:
 * `player-controller` clamps the player to `[1, size - 2]`, and the isometric
 * map projection indexes from the origin. So `GRID_ORIGIN_M` shifts the whole
 * plan into positive space and `gx()` / `gz()` are the only sanctioned way to
 * convert. Emitting a raw metre value as a grid coordinate is a bug.
 */

export const VOXEL_METRES = 0.5;

/** Metres → voxels, for lengths (not positions). */
export function gv(metres: number): number {
  return Math.round(metres / VOXEL_METRES);
}

export type Wall = "n" | "s" | "e" | "w";

export interface RectM {
  x: number;
  z: number;
  w: number;
  d: number;
}

/**
 * A room hanging off the corridor ring.
 *
 * `door` is always centred on the named wall. Walls listed in `open` are not
 * built at all — that is how the sitting area flows into the corridor and the
 * café into the sitting area, rather than being sealed boxes with a token gap.
 */
export interface RoomSpec extends RectM {
  /** Matches `WorldLocation.key` when the room is an anchor; `null` when it is not. */
  key: string | null;
  name: string;
  kind: "classroom" | "office" | "hall" | "cafe";
  door?: Wall;
  open?: Wall[];
  windows?: Wall[];
  /**
   * Carpet colour. Not decoration for its own sake — five identical grey boxes
   * along the north wall are indistinguishable in plan view, and the carpet is
   * what tells you at a glance which room you are looking at in both the 3D
   * view and on the map.
   */
  accent?: "red" | "blue" | "green" | "gold" | "purple";
}

/** Something solid standing on the floor. Height is in METRES. */
export interface FurnitureSpec extends RectM {
  /**
   * Height in metres. Must be ≥ 1 m.
   *
   * `STEP_HEIGHT` in the player controller is ~1 voxel, which at 0.5 m per
   * voxel means anything shorter than 1 m is something the player walks UP
   * rather than around — you end up standing on the café counter. Asserted
   * below rather than left as a comment, because the failure is silent.
   */
  h: number;
  kind: "table" | "counter" | "desk";
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

/** Corridor width, metres. */
export const CORRIDOR_W = 3;
/** Wall height, metres. 3 m → 6 voxels. */
export const WALL_H = 3;
/** Doorway opening, metres. 1 m wide × 2 m tall → 2 × 4 voxels. */
export const DOOR_W = 1;
export const DOOR_H = 2;

/** Open to the sky, in the middle of the ring. */
export const COURTYARD: RectM = { x: 11, z: 3, w: 34, d: 19 };

/**
 * The corridor ring: the courtyard grown by one corridor width on every side.
 * Derived, so the ring can never be a different width on one side than another.
 */
export const RING: RectM = {
  x: COURTYARD.x - CORRIDOR_W,
  z: COURTYARD.z - CORRIDOR_W,
  w: COURTYARD.w + CORRIDOR_W * 2,
  d: COURTYARD.d + CORRIDOR_W * 2,
};

/**
 * Rooms, each sharing one wall with the ring's outer face.
 *
 * The five classrooms keep the original event-category keys. That is not
 * cosmetic: `/events` filtering round-trips through
 * `WorldLocation.key === EventCategory.slug` (see `seed.ts`), so renaming one of
 * these five silently breaks the link between a room and its events.
 */
export const ROOMS: readonly RoomSpec[] = [
  // ---- north wing: classrooms G F E D C, opening south onto the ring -------
  // The row spans x 9–48, which is exactly the ring's north wall. A room whose
  // door lands past the end of that wall opens onto open air and seals itself:
  // an earlier layout put G at x 2 and it was unreachable.
  { key: "photography-forest", name: "G", kind: "classroom", x: 9, z: -7, w: 7, d: 7, door: "s", windows: ["n"], accent: "green" },
  { key: "design-workshop", name: "F", kind: "classroom", x: 17, z: -7, w: 7, d: 7, door: "s", windows: ["n"], accent: "gold" },
  { key: "quiz-library", name: "E", kind: "classroom", x: 25, z: -7, w: 7, d: 7, door: "s", windows: ["n"], accent: "blue" },
  { key: "gaming-arena", name: "D", kind: "classroom", x: 33, z: -7, w: 7, d: 7, door: "s", windows: ["n"], accent: "purple" },
  { key: "hackathon-mine", name: "C", kind: "classroom", x: 41, z: -7, w: 7, d: 7, door: "s", windows: ["n"], accent: "red" },

  // ---- east wing: B and A, opening west onto the ring ----------------------
  { key: "sponsors-pavilion", name: "B", kind: "classroom", x: 48, z: 4, w: 8, d: 7, door: "w", windows: ["e"], accent: "gold" },
  { key: "leaderboard-castle", name: "A", kind: "classroom", x: 48, z: 15, w: 8, d: 7, door: "w", windows: ["e"], accent: "blue" },

  // ---- west wing: the Staff Room, opening east onto the ring ---------------
  { key: "staff-room", name: "Staff Room", kind: "office", x: 1, z: 8, w: 7, d: 14, door: "e", windows: ["w"], accent: "green" },

  // ---- south wing: sitting area and café, open-plan ------------------------
  // `open: ["n"]` makes the sitting area flow out of the corridor rather than
  // sitting behind a door; `door: "s"` is the building's main entrance, so you
  // arrive through the lounge.
  { key: "sitting-area", name: "Sitting Area", kind: "hall", x: 10, z: 25, w: 26, d: 8, open: ["n"], door: "s", windows: ["s"], accent: "red" },
  { key: null, name: "Café", kind: "cafe", x: 36, z: 25, w: 10, d: 8, open: ["w"], windows: ["s"], accent: "gold" },
];

/**
 * Where the main entrance sits, metres.
 *
 * DERIVED from the sitting area rather than declared, because doorways are
 * always centred on their wall — a hand-written number here would be quietly
 * ignored by the generator and would then put the approach path and the portal
 * a couple of metres to one side of the actual doors.
 */
const SITTING = ROOMS.find((r) => r.key === "sitting-area")!;
export const ENTRANCE_X = SITTING.x + SITTING.w / 2;

/** Furniture. Every piece is ≥ 1 m tall — see `FurnitureSpec.h`. */
export const FURNITURE: readonly FurnitureSpec[] = [
  // Sitting-area tables, two rows of three.
  ...[13, 20, 27].flatMap((x): FurnitureSpec[] => [
    { x, z: 27, w: 2, d: 1.5, h: 1, kind: "table" },
    { x, z: 30, w: 2, d: 1.5, h: 1, kind: "table" },
  ]),
  // Café counter, running most of the room's width.
  { x: 38, z: 27, w: 7, d: 1, h: 1, kind: "counter" },
  // Two desk rows per classroom. Cheap, and it is what makes an empty box read
  // as a classroom from the map.
  ...ROOMS.filter((r) => r.kind === "classroom").flatMap((r): FurnitureSpec[] =>
    [0, 1].flatMap((row) =>
      [0, 1].map((col): FurnitureSpec => ({
        x: r.x + 1.5 + col * 3.5,
        z: r.z + 2 + row * 2.5,
        w: 2.5,
        d: 1,
        h: 1,
        kind: "desk",
      })),
    ),
  ),
];

// `FurnitureSpec.h` documents why; assert it so a future edit cannot quietly
// reintroduce furniture the player walks on top of.
for (const f of FURNITURE) {
  if (gv(f.h) < 2) {
    throw new Error(
      `Furniture at (${f.x}, ${f.z}) is ${f.h}m tall — under 1m the player steps onto it instead of around it.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Derived extent
// ---------------------------------------------------------------------------

/** Walkable grass beyond the building, metres. Deeper to the south so the portal clears it. */
export const APRON = { n: 4, e: 4, s: 8, w: 4 } as const;

const ALL_RECTS: readonly RectM[] = [RING, ...ROOMS];

export const PLAN_MIN = {
  x: Math.min(...ALL_RECTS.map((r) => r.x)),
  z: Math.min(...ALL_RECTS.map((r) => r.z)),
};
export const PLAN_MAX = {
  x: Math.max(...ALL_RECTS.map((r) => r.x + r.w)),
  z: Math.max(...ALL_RECTS.map((r) => r.z + r.d)),
};

/** Metre position of grid cell (0, 0) — the north-west corner of the apron. */
export const GRID_ORIGIN_M = {
  x: PLAN_MIN.x - APRON.w,
  z: PLAN_MIN.z - APRON.n,
};

/** Voxel grid dimensions. Consumed as `VILLAGE_SIZE` / `VILLAGE_SIZE_Z`. */
export const GRID_X = gv(PLAN_MAX.x + APRON.e - GRID_ORIGIN_M.x);
export const GRID_Z = gv(PLAN_MAX.z + APRON.s - GRID_ORIGIN_M.z);

/** Metre x → grid x. The only sanctioned conversion; never emit raw metres. */
export function gx(metres: number): number {
  return Math.round((metres - GRID_ORIGIN_M.x) / VOXEL_METRES);
}

/** Metre z → grid z. */
export function gz(metres: number): number {
  return Math.round((metres - GRID_ORIGIN_M.z) / VOXEL_METRES);
}

/** A metre rect as inclusive grid bounds. */
export function gridRect(r: RectM): { x0: number; z0: number; x1: number; z1: number } {
  return { x0: gx(r.x), z0: gz(r.z), x1: gx(r.x + r.w), z1: gz(r.z + r.d) };
}

/** Centre of a metre rect, in grid coordinates. */
export function gridCentre(r: RectM): { x: number; z: number } {
  return { x: gx(r.x + r.w / 2), z: gz(r.z + r.d / 2) };
}

/**
 * Marker fallback position, as a percentage of the plan's extent.
 *
 * This is a plain top-down normalisation, NOT the map's projection — the map
 * reports true projected positions once it has drawn, and deriving these from
 * `village-map-art` would be a circular import (it builds the village, which
 * reads `world-locations`, which needs these). Good enough to place a marker
 * roughly right for the one frame before the canvas reports back.
 */
export function planPct(r: RectM): { x: number; y: number } {
  const c = gridCentre(r);
  return {
    x: Math.round(((c.x / GRID_X) * 100 + Number.EPSILON) * 10) / 10,
    y: Math.round(((c.z / GRID_Z) * 100 + Number.EPSILON) * 10) / 10,
  };
}

/** Look a room up by its world-location key. */
export function roomByKey(key: string): RoomSpec | undefined {
  return ROOMS.find((r) => r.key === key);
}
