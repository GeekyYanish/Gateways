"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BlockButton,
  BlockPanel,
  Hotbar,
  ItemIcon,
  PixelAvatar,
  Signpost,
} from "@/frontend/components/mc";
import {
  WorldViewport,
  type WorldViewportHandle,
} from "@/frontend/components/world/world-viewport";
import { VillageMapCanvas } from "@/frontend/components/world/village-map-canvas";
import {
  VoxelWorldView,
  useVoxelSupport,
} from "@/frontend/components/voxel/voxel-world";
import { useSession } from "@/frontend/components/auth/session-provider";
import {
  HOTBAR_LOCATIONS,
  WORLD_LOCATIONS,
  locationByKey,
} from "@/frontend/lib/world/world-locations";
import {
  DEFAULT_PROJECTION,
  headingDegrees,
  mapMetrics,
  projectToPct,
  ROTATION_LABELS,
  type MapProjection,
  type MapRotation,
  type MappedAnchor,
} from "@/frontend/lib/world/village-map-art";
import { PlayerMarker } from "@/frontend/components/world/player-marker";
import { getVillage } from "@/frontend/lib/voxel/village";
import type { PlayerPose } from "@/frontend/components/voxel/player-controller";
import { showToast } from "@/frontend/components/mc";
import { cn } from "@/frontend/lib/utils";

type View = "3d" | "map" | "list";

/** Zoom the map eases to when a location is chosen. */
const FOCUS_ZOOM = 0.72;

/**
 * True on viewports too narrow for full text labels on the map.
 *
 * A media query rather than a CSS breakpoint because the value feeds the label
 * layout maths, not just styling — the de-overlap search needs to know how wide
 * a chip actually is.
 */
function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

/**
 * SCREEN 6 — World spawn.
 *
 * Three equal views of one place, not a primary plus two fallbacks:
 *
 *  - **3D** — a walkable voxel village. The centrepiece, but it needs WebGL and
 *    is the wrong choice for anyone who has asked for reduced motion.
 *  - **Map** — the 2D isometric map with signposts.
 *  - **List** — the same locations as text. This is the screen-reader and
 *    keyboard path, and it works on any device.
 *
 * The view auto-selects on first load (3D when supported, list on small
 * screens), but the toggle is always available and an explicit choice is never
 * overridden.
 */
export function WorldScreen({
  initialView,
  initialLocation,
}: {
  initialView?: View;
  initialLocation?: string;
}) {
  const { character } = useSession();
  const router = useRouter();
  const voxelSupport = useVoxelSupport();

  // Start on the list for small screens; upgraded to 3D by the effect below
  // once capability detection has actually run.
  const [view, setView] = useState<View>(() => {
    if (initialView) return initialView;
    return typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches
      ? "list"
      : "map";
  });
  // Once the user picks a view, stop auto-selecting for them.
  const userChose = useRef(initialView !== undefined);
  const [slot, setSlot] = useState(0);
  const welcomed = useRef(false);

  // ---- map interaction state ---------------------------------------------
  const viewport = useRef<WorldViewportHandle>(null);
  /**
   * Label positions come back from the isometric renderer, because only it
   * knows where a building actually landed once projected. Until it has run we
   * fall back to the flat percentages in WORLD_LOCATIONS, so the markers are
   * never missing — they just settle into place when the terrain appears.
   */
  const [anchors, setAnchors] = useState<MappedAnchor[] | null>(null);
  const [selected, setSelected] = useState<string | null>(() =>
    initialLocation && locationByKey(initialLocation) ? initialLocation : null,
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [mapScale, setMapScale] = useState(1);
  const compactPins = useNarrowViewport();

  /**
   * Plan view or isometric.
   *
   * Both are honest views of the same voxel world; plan is the default because
   * the world is a building, and "which room is next to which" is the question
   * a floor plan answers and an isometric projection cannot.
   */
  const [projection, setProjection] = useState<MapProjection>(DEFAULT_PROJECTION);
  /**
   * Quarter turns clockwise. Shared by both projections rather than reset on
   * switching: having turned the map to face your wing, flipping plan↔iso to
   * compare them should not silently spin it back.
   */
  const [rotation, setRotation] = useState<MapRotation>(0);
  const metrics = useMemo(() => mapMetrics(projection, rotation), [projection, rotation]);

  /**
   * Where the player is standing in the 3D world.
   *
   * Held here rather than in the scene because the canvas UNMOUNTS when you
   * switch to the map — which is the exact moment the position becomes
   * interesting. `null` until the 3D view has run at all; the map falls back to
   * the spawn point so the marker is never simply missing.
   */
  const [pose, setPose] = useState<PlayerPose | null>(null);

  const shownPose = useMemo((): PlayerPose | null => {
    if (view !== "map") return null;
    if (pose) return pose;
    // Built once and cached, and the map canvas needs it anyway — so this costs
    // nothing extra on the map view, and never runs on 3D or List.
    const v = getVillage();
    return { x: v.spawn.x, y: v.spawn.y, z: v.spawn.z, yaw: v.spawnYaw };
  }, [view, pose]);

  /** The marker's projected position, heading and a readable location name. */
  const playerOnMap = useMemo(() => {
    if (!shownPose) return null;
    const { xPct, yPct } = projectToPct(metrics, shownPose.x, shownPose.y, shownPose.z);
    // Name the room you are in, by the same proximity rule the 3D view uses to
    // decide which building you can enter — so the two never disagree.
    const near = getVillage().anchors.find(
      (a) => Math.hypot(a.x - shownPose.x, a.z - shownPose.z) < a.radius,
    );
    return {
      xPct,
      yPct,
      headingDeg: headingDegrees(metrics, shownPose.yaw),
      where: near ? `in the ${near.label}` : "outside the building",
      explored: pose !== null,
    };
  }, [shownPose, metrics, pose]);

  /**
   * Anchor percentages are per-projection AND per-rotation. Dropping them falls
   * back to the floor plan's own positions for the frame before the canvas
   * redraws, rather than leaving every marker at the old view's coordinates.
   */
  const chooseProjection = useCallback((next: MapProjection) => {
    setProjection(next);
    setAnchors(null);
  }, []);

  const turnMap = useCallback((delta: 1 | -1) => {
    setRotation((r) => (((r + delta + 4) % 4) as MapRotation));
    setAnchors(null);
  }, []);

  /**
   * Fall back to icon-only pins when full labels cannot possibly fit.
   *
   * Ten labelled chips are ~2000px of chip across a map that is ~775px wide at
   * fit zoom. No de-overlap search can place those without collisions — it is
   * not a tuning problem, there is simply not enough room, and the previous
   * viewport-width rule did not notice because the viewport was wide. Density
   * against the map's on-screen width is the honest signal, and it means labels
   * appear naturally as the user zooms in, the way a real map behaves.
   *
   * Compact pins keep their `aria-label`, `title` and link semantics, and the
   * List view carries the same content as text, so nothing is lost but ink.
   */
  const denseLabels = useMemo(() => {
    const total = WORLD_LOCATIONS.reduce((n, l) => n + 57 + l.label.length * 10, 0);
    // ~1.6 map widths is about two notional rows of chips — as much as the
    // de-overlap search can place before it starts stacking them off the map.
    return compactPins || total > metrics.width * (mapScale || 1) * 1.6;
  }, [compactPins, mapScale, metrics]);

  /**
   * Marker positions, with overlapping labels pushed apart.
   *
   * The isometric projection squashes the depth axis, so rooms that are far
   * apart on the ground can land within a few pixels of each other on screen.
   * Plan view does not squash, but ten labels around one courtyard still
   * collide at fit zoom. Either way it is a labelling problem, so it is fixed
   * at the labelling layer rather than by dragging the rooms apart (their
   * positions are the real floor plan, shared with the 3D view).
   *
   * Worked in SCREEN pixels because the chips counter-scale to a constant
   * on-screen size: how much they overlap depends on the current zoom, so a
   * fixed offset in map percentages would be wrong at every scale but one. Each
   * marker's `lift` grows until it clears the ones already placed, and the
   * leader line stretches to match so the chip still points at its room.
   */
  const markers = useMemo(() => {
    const s = mapScale || 1;
    /** Map extent in screen pixels — the box every chip has to stay inside. */
    const mapWpx = metrics.width * s;
    const CHIP_H = 42;
    const GAP = 8;
    const BASE_LIFT = 18;
    /**
     * Chip width, fitted to measured renders: 12 chars → 177px, 18 → 237px.
     * Press Start 2P is monospace, so the advance really is ~10px per character
     * at `text-[10px]` with `tracking-wide`, plus 57px of icon, gap and padding.
     * Under-estimating this is what let two labels still overlap: the search
     * thinks they clear when they do not.
     */
    const chipWidth = (label: string) =>
      denseLabels ? 42 : 57 + label.length * 10;

    const placed = WORLD_LOCATIONS.map((loc) => {
      const a = anchors?.find((m) => m.key === loc.key);
      const xPct = a?.xPct ?? loc.x;
      const yPct = a?.yPct ?? loc.y;
      return {
        ...loc,
        xPct,
        yPct,
        sx: (xPct / 100) * metrics.width * s,
        sy: (yPct / 100) * metrics.height * s,
        w: chipWidth(loc.label),
        lift: BASE_LIFT,
        dx: 0,
      };
    });

    /**
     * Candidates in increasing order of how far they move the chip from its
     * building. Raising alone is not enough: at fit zoom every pair of rooms is
     * within a chip-width horizontally, so a vertical-only search finds a clash
     * at every level and stacks them into one tower off the top of the screen.
     * Allowing a sideways jog lets them fan out instead, and the chip slides
     * while the leader line stays over the room.
     *
     * The jogs have to be wider than a chip to clear a neighbour at all, and
     * cheap enough to be preferred over stacking: a row of five classrooms
     * along the north wall sits ~80px apart at fit zoom with ~230px chips, so
     * with the old ±150 jogs and a 0.6 weight every one of them stacked and
     * Quiz Library — the middle of the row — ended up above the top of the map,
     * invisible and unclickable.
     */
    const candidates: Array<{ lift: number; dx: number }> = [];
    const jogs = denseLabels ? [0, -90, 90, -180, 180] : [0, -300, 300, -600, 600];
    for (let level = 0; level < 5; level++) {
      for (const dx of jogs) {
        candidates.push({ lift: BASE_LIFT + level * (CHIP_H + GAP), dx });
      }
    }
    candidates.sort(
      (a, b) => a.lift + Math.abs(a.dx) * 0.25 - (b.lift + Math.abs(b.dx) * 0.25),
    );

    // Nearest-first, so the labels that get displaced are the ones further back.
    placed.sort((a, b) => b.sy - a.sy);
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      const done = placed.slice(0, i);
      const clashes = (lift: number, dx: number) =>
        done.some(
          (b) =>
            Math.abs(a.sx + dx - (b.sx + b.dx)) < (a.w + b.w) / 2 &&
            Math.abs(a.sy - lift - (b.sy - b.lift)) < CHIP_H + GAP,
        );
      /**
       * A chip may never be pushed outside the map.
       *
       * `sx`/`sy` are pixels from the map's own top-left, and the surface is
       * `overflow-hidden`, so a chip moved past an edge is clipped away
       * entirely — the location silently stops being visible or clickable.
       * Overlapping slightly is very much the lesser evil, so both bounds are
       * applied to the candidate set rather than left for the weights above to
       * avoid by luck. (They did not: lifting alone hid Quiz Library off the
       * top, and widening the jogs then sent Design Workshop off the side.)
       */
      const maxLift = Math.max(BASE_LIFT, a.sy - CHIP_H);
      const usable = candidates.filter(
        (c) =>
          c.lift <= maxLift &&
          a.sx + c.dx - a.w / 2 >= 0 &&
          a.sx + c.dx + a.w / 2 <= mapWpx,
      );
      const fit = usable.find((c) => !clashes(c.lift, c.dx));
      // Nothing clear? Take the highest option still on the map — overlapping
      // is better than dropping a location off the map entirely.
      a.lift = fit?.lift ?? usable[usable.length - 1]?.lift ?? BASE_LIFT;
      a.dx = fit?.dx ?? 0;
    }
    return placed;
  }, [anchors, mapScale, denseLabels, metrics]);

  const selectedLoc = selected ? locationByKey(selected) : undefined;

  /**
   * Selecting is just state; the camera move is an effect.
   *
   * Calling `viewport.current.focusOn` here directly cannot work from the List
   * view's "Show on map", which switches views in the same handler — the
   * viewport is not mounted yet at that point, so the ref is still null and the
   * focus is silently dropped. Driving it from an effect means every entry point
   * (marker, hotbar, list) behaves the same.
   */
  const focusLocation = useCallback((key: string) => setSelected(key), []);

  const lastFocused = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) {
      lastFocused.current = null;
      return;
    }
    if (view !== "map" || lastFocused.current === selected) return;
    const m = markers.find((x) => x.key === selected);
    if (!m) return;
    lastFocused.current = selected;
    viewport.current?.focusOn(m.xPct, m.yPct, FOCUS_ZOOM);
    // `markers` is a dependency because the anchor positions are not known until
    // the isometric render finishes; the guard above keeps this to one move per
    // selection rather than one per zoom change.
  }, [selected, view, markers]);

  // Promote to 3D when it is genuinely available. Deliberately not on small
  // screens: a 14k-block scene on a mid-range phone is a bad first impression.
  useEffect(() => {
    if (userChose.current) return;
    if (voxelSupport !== "ready") return;
    if (window.matchMedia("(max-width: 640px)").matches) return;
    // Reacting to the async result of WebGL capability detection, which is only
    // knowable on the client after mount. It transitions once, from the
    // pre-detection default to the detected default, then stops.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView("3d");
  }, [voxelSupport]);

  const chooseView = (next: View) => {
    userChose.current = true;
    setView(next);
  };

  // Welcome toast, once per mount.
  useEffect(() => {
    if (welcomed.current || !character) return;
    welcomed.current = true;
    showToast({
      title: `Welcome, ${character.playerName}!`,
      body: "Your adventure begins now. Pick a location to explore.",
      severity: "success",
    });
  }, [character]);

  return (
    <div className="flex flex-1 flex-col gap-[var(--mc-unit)] p-[var(--mc-unit)]">
      <header className="flex flex-wrap items-center justify-between gap-[var(--mc-unit)]">
        {/* In map view this card is overlaid on the map itself, as in the
            design — rendering it here too would show the greeting twice.

            The empty <div> is load-bearing. This row is `justify-between`, so
            dropping to a single child would push the view switcher from the
            right edge to the left, and it would visibly jump every time the
            visitor selected Map. Holding the slot keeps it put. */}
        {character && view !== "map" ? (
          <BlockPanel
            variant="panel"
            padded="sm"
            className="flex items-center gap-[var(--mc-unit)]"
          >
            <PixelAvatar skinId={character.skinId} size={40} />
            <div>
              <p className="font-pixel text-[11px] text-mc-emerald-light">
                Welcome, {character.playerName}!
              </p>
              <p className="text-[15px] text-mc-text-dim">
                Level {character.level} · {character.title}
              </p>
            </div>
          </BlockPanel>
        ) : (
          <div aria-hidden />
        )}

        <div className="flex items-center gap-[calc(var(--mc-unit)*0.75)]">
          {/* Not a decorative toggle: the list view is the screen-reader and
              small-screen path, so it is a labelled control. */}
          <div role="group" aria-label="World view" className="flex gap-[3px]">
            <BlockButton
              size="sm"
              variant={view === "3d" ? "primary" : "ghost"}
              aria-pressed={view === "3d"}
              // Only disabled when WebGL is genuinely unavailable. Under reduced
              // motion it stays selectable — an informed choice, not a lockout.
              disabled={voxelSupport === "unsupported"}
              title={
                voxelSupport === "unsupported"
                  ? "3D needs WebGL, which this browser does not provide"
                  : voxelSupport === "reduced-motion"
                    ? "You have reduced motion enabled — 3D involves camera movement"
                    : undefined
              }
              onClick={() => chooseView("3d")}
            >
              3D
            </BlockButton>
            <BlockButton
              size="sm"
              variant={view === "map" ? "primary" : "ghost"}
              aria-pressed={view === "map"}
              onClick={() => chooseView("map")}
            >
              Map
            </BlockButton>
            <BlockButton
              size="sm"
              variant={view === "list" ? "primary" : "ghost"}
              aria-pressed={view === "list"}
              onClick={() => chooseView("list")}
            >
              List
            </BlockButton>
          </div>

          {/* Only meaningful while the map is on screen, so it appears with it.
              The row above is `justify-between` and holds its slots explicitly,
              so adding a sibling here shifts nothing else. */}
          {view === "map" ? (
            <div role="group" aria-label="Map projection" className="flex gap-[3px]">
              <BlockButton
                size="sm"
                variant={projection === "top-down" ? "primary" : "ghost"}
                aria-pressed={projection === "top-down"}
                title="Look straight down — the floor plan"
                onClick={() => chooseProjection("top-down")}
              >
                Plan
              </BlockButton>
              <BlockButton
                size="sm"
                variant={projection === "isometric" ? "primary" : "ghost"}
                aria-pressed={projection === "isometric"}
                title="Angled view, showing height"
                onClick={() => chooseProjection("isometric")}
              >
                Iso
              </BlockButton>
            </div>
          ) : null}

          {/* Turn the map. An isometric view only ever shows two sides of a
              building, so without this the north and west faces of every room
              are permanently hidden. The compass letter is which world
              direction is currently at the top of the screen.

              Plain ASCII chevrons, not ↺/↻: Press Start 2P has no glyph for
              those, so the browser silently fell back to a system font and the
              arrows rendered thin and half-size beside the chunky pixel
              compass letter. Anything in these buttons has to exist in the
              pixel font. */}
          {view === "map" ? (
            <div role="group" aria-label="Rotate map" className="flex gap-[3px]">
              <BlockButton
                size="icon"
                variant="ghost"
                aria-label="Rotate map anticlockwise"
                onClick={() => turnMap(-1)}
              >
                {"<"}
              </BlockButton>
              <BlockButton
                size="sm"
                variant="ghost"
                // Not a control — a readout of which way is up. Announced as
                // words because a bare "N" is meaningless to a screen reader.
                aria-label={`North is ${["up", "to the left", "down", "to the right"][rotation]}`}
                title="Direction currently at the top of the map"
                onClick={() => turnMap(1)}
              >
                {ROTATION_LABELS[rotation]}
              </BlockButton>
              <BlockButton
                size="icon"
                variant="ghost"
                aria-label="Rotate map clockwise"
                onClick={() => turnMap(1)}
              >
                {">"}
              </BlockButton>
            </div>
          ) : null}

          {/* A Link styled as a block button, rather than a button wrapping a
              Link: keeps real anchor semantics (middle-click, focus, crawling). */}
          <Link
            href="/dashboard"
            className={cn(
              "inline-flex items-center justify-center no-underline",
              "min-h-[36px] px-[calc(var(--mc-unit)*1.5)]",
              "font-pixel text-[10px] uppercase tracking-wider",
              "bg-mc-emerald text-mc-obsidian bevel",
              "[--bevel-light:var(--color-mc-emerald-light)] [--bevel-dark:var(--color-mc-emerald-dark)]",
              "hover:brightness-110 active:translate-y-[var(--mc-bevel)] active:bevel-pressed",
            )}
          >
            Inventory
          </Link>
        </div>
      </header>

      {view === "3d" ? (
        <>
          {voxelSupport === "reduced-motion" ? (
            <BlockPanel variant="slot" padded="sm" className="border-mc-gold">
              <p className="text-[15px] text-mc-text-dim">
                You have reduced motion enabled. The 3D view moves the camera as
                you walk — switch to{" "}
                <button
                  type="button"
                  onClick={() => chooseView("map")}
                  className="cursor-pointer text-mc-portal-light underline"
                >
                  Map
                </button>{" "}
                or{" "}
                <button
                  type="button"
                  onClick={() => chooseView("list")}
                  className="cursor-pointer text-mc-portal-light underline"
                >
                  List
                </button>{" "}
                if that is uncomfortable.
              </p>
            </BlockPanel>
          ) : null}
          <VoxelWorldView
            skinId={character?.skinId ?? "prospector"}
            onPose={setPose}
            className="min-h-[460px] flex-1 border-[length:var(--mc-bevel)] border-mc-border bevel-inset overflow-hidden"
          />
        </>
      ) : view === "map" ? (
        <div className="relative flex min-h-[460px] flex-1 flex-col">
          <WorldViewport
            ref={viewport}
            className="min-h-[460px] flex-1"
            onScaleChange={setMapScale}
            onBackgroundClick={() => setSelected(null)}
            mapW={metrics.width}
            mapH={metrics.height}
            map={
              <VillageMapCanvas
                onAnchors={setAnchors}
                projection={projection}
                rotation={rotation}
              />
            }
          >
            {markers.map((l) => (
              <Signpost
                key={l.key}
                label={l.label}
                item={l.item}
                href={l.href}
                xPct={l.xPct}
                yPct={l.yPct}
                scale={mapScale}
                lift={l.lift}
                dx={l.dx}
                // The pin you are pointing at names itself, even in dense mode.
                compact={denseLabels && selected !== l.key && hovered !== l.key}
                selected={selected === l.key}
                dimmed={
                  (selected !== null && selected !== l.key) ||
                  (hovered !== null && hovered !== l.key)
                }
                onSelect={() => focusLocation(l.key)}
                onHover={(h) => setHovered(h ? l.key : null)}
              />
            ))}

            {playerOnMap ? (
              <PlayerMarker
                xPct={playerOnMap.xPct}
                yPct={playerOnMap.yPct}
                headingDeg={playerOnMap.headingDeg}
                scale={mapScale}
                where={playerOnMap.where}
              />
            ) : null}
          </WorldViewport>

          {/* Welcome card, over the map's top-left as in the design. */}
          {character ? (
            <BlockPanel
              variant="card"
              padded="sm"
              className="pointer-events-none absolute left-[var(--mc-unit)] top-[var(--mc-unit)] z-20 flex items-center gap-[var(--mc-unit)] bg-mc-void/85"
            >
              <PixelAvatar skinId={character.skinId} size={36} />
              <div>
                <p className="font-pixel text-[10px] text-mc-emerald-light">
                  Welcome, {character.playerName}!
                </p>
                <p className="text-[15px] text-mc-text-dim">
                  Your adventure begins now.
                </p>
              </div>
            </BlockPanel>
          ) : null}

          {/* Detail for the chosen location. Selecting a marker does NOT
              navigate — it focuses the map and opens this, so exploring the
              village never costs a page load. The link here is the commit. */}
          {selectedLoc ? (
            <BlockPanel
              variant="card"
              padded="md"
              role="region"
              aria-label={`${selectedLoc.label} details`}
              className="absolute inset-x-[var(--mc-unit)] bottom-[calc(var(--mc-unit)*4)] z-20 mx-auto max-w-[420px] bg-mc-void/95"
            >
              <div className="flex items-start gap-[var(--mc-unit)]">
                <ItemIcon item={selectedLoc.item} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="font-pixel text-[11px] uppercase text-mc-gold-light">
                    {selectedLoc.label}
                  </p>
                  <p className="mt-[calc(var(--mc-unit)*0.5)] text-[16px] text-mc-text-dim">
                    {selectedLoc.blurb}
                  </p>
                </div>
                <BlockButton
                  size="icon"
                  variant="ghost"
                  aria-label="Close location details"
                  onClick={() => setSelected(null)}
                >
                  ✕
                </BlockButton>
              </div>
              <Link
                href={selectedLoc.href}
                className={cn(
                  "mt-[var(--mc-unit)] flex items-center justify-center no-underline",
                  "min-h-[44px] px-[calc(var(--mc-unit)*2)]",
                  "font-pixel text-[11px] uppercase tracking-wider",
                  "bg-mc-portal-deep text-white bevel",
                  "[--bevel-light:var(--color-mc-portal)] [--bevel-dark:var(--color-mc-portal-ink)]",
                  "hover:brightness-110 active:translate-y-[var(--mc-bevel)] active:bevel-pressed",
                )}
              >
                Travel here
              </Link>
            </BlockPanel>
          ) : null}
        </div>
      ) : (
        <ul className="grid flex-1 gap-[var(--mc-unit)] sm:grid-cols-2 lg:grid-cols-3 content-start">
          {WORLD_LOCATIONS.map((l) => (
            <li key={l.key}>
              <BlockPanel
                variant="panel"
                padded="md"
                className="flex h-full flex-col gap-[calc(var(--mc-unit)*0.75)]"
              >
                <div className="flex items-start gap-[var(--mc-unit)]">
                  <ItemIcon item={l.item} size={24} />
                  <div className="min-w-0">
                    <p className="font-pixel text-[11px] uppercase text-mc-gold-light">
                      {l.label}
                    </p>
                    <p className="mt-[calc(var(--mc-unit)*0.5)] text-[16px] text-mc-text-dim">
                      {l.blurb}
                    </p>
                  </div>
                </div>
                {/* Two distinct actions, so the list is a peer of the map rather
                    than a dead end: jump to it on the map, or go straight in. */}
                <div className="mt-auto flex gap-[calc(var(--mc-unit)*0.5)]">
                  <BlockButton
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      chooseView("map");
                      focusLocation(l.key);
                    }}
                  >
                    Show on map
                  </BlockButton>
                  <Link
                    href={l.href}
                    className={cn(
                      "inline-flex items-center justify-center no-underline",
                      "min-h-[36px] px-[calc(var(--mc-unit)*1.5)]",
                      "font-pixel text-[10px] uppercase tracking-wider",
                      "bg-mc-portal-deep text-white bevel",
                      "[--bevel-light:var(--color-mc-portal)] [--bevel-dark:var(--color-mc-portal-ink)]",
                      "hover:brightness-110 active:translate-y-[var(--mc-bevel)] active:bevel-pressed",
                    )}
                  >
                    Travel
                  </Link>
                </div>
              </BlockPanel>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-center">
        <Hotbar
          activeIndex={slot}
          onActiveChange={setSlot}
          // HOTBAR_LOCATIONS, not WORLD_LOCATIONS: there are ten locations and
          // Hotbar renders nine, silently dropping the rest. The filtered list
          // makes the omission explicit and picks which one it is.
          slots={HOTBAR_LOCATIONS.map((l) => ({
            item: l.item,
            label: l.label,
            // On the map the hotbar is a way to FLY to a place, not to leave
            // for another page — that is what makes it feel like a world
            // rather than a nav bar. Everywhere else it still navigates, with
            // the client router (a full reload would discard the session and
            // re-run the whole boot sequence).
            onSelect: () =>
              view === "map" ? focusLocation(l.key) : router.push(l.href),
          }))}
        />
      </div>
    </div>
  );
}
