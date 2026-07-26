"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlockButton, BlockPanel, Hotbar, PixelAvatar, Signpost } from "@/components/mc";
import { WorldViewport } from "@/components/world/world-viewport";
import { VoxelWorldView, useVoxelSupport } from "@/components/voxel/voxel-world";
import { useSession } from "@/components/auth/session-provider";
import { WORLD_LOCATIONS } from "@/lib/world/world-locations";
import { showToast } from "@/components/mc";
import { cn } from "@/lib/utils";

type View = "3d" | "map" | "list";

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
export function WorldScreen() {
  const { character } = useSession();
  const router = useRouter();
  const voxelSupport = useVoxelSupport();

  // Start on the list for small screens; upgraded to 3D by the effect below
  // once capability detection has actually run.
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches
      ? "list"
      : "map",
  );
  // Once the user picks a view, stop auto-selecting for them.
  const userChose = useRef(false);
  const [slot, setSlot] = useState(0);
  const welcomed = useRef(false);

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
        {character ? (
          <BlockPanel variant="panel" padded="sm" className="flex items-center gap-[var(--mc-unit)]">
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
        ) : null}

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
            className="min-h-[460px] flex-1 border-[length:var(--mc-bevel)] border-mc-border bevel-inset overflow-hidden"
          />
        </>
      ) : view === "map" ? (
        <WorldViewport className="min-h-[420px] flex-1">
          {WORLD_LOCATIONS.map((l) => (
            <Signpost
              key={l.key}
              label={l.label}
              item={l.item}
              href={l.href}
              xPct={l.x}
              yPct={l.y}
            />
          ))}
        </WorldViewport>
      ) : (
        <ul className="grid flex-1 gap-[var(--mc-unit)] sm:grid-cols-2 lg:grid-cols-3 content-start">
          {WORLD_LOCATIONS.map((l) => (
            <li key={l.key}>
              <Link href={l.href} className="block no-underline">
                <BlockPanel
                  variant="panel"
                  padded="md"
                  className={cn(
                    "h-full transition-[filter,transform] duration-100",
                    "hover:brightness-115 hover:-translate-y-[2px]",
                  )}
                >
                  <p className="font-pixel text-[11px] uppercase text-mc-gold-light">
                    {l.label}
                  </p>
                  <p className="mt-[calc(var(--mc-unit)*0.5)] text-[16px] text-mc-text-dim">
                    {l.blurb}
                  </p>
                </BlockPanel>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-center">
        <Hotbar
          activeIndex={slot}
          onActiveChange={setSlot}
          // Client navigation, not window.location — a full reload would discard
          // the session context and re-run the whole boot sequence.
          slots={WORLD_LOCATIONS.map((l) => ({
            item: l.item,
            label: l.label,
            onSelect: () => router.push(l.href),
          }))}
        />
      </div>
    </div>
  );
}
