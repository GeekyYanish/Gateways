"use client";

import { PixelImage } from "@/frontend/components/mc";
import { ART } from "@/frontend/lib/assets/manifest";
import { DecorLayer } from "./pixel-decor";

/** A welcoming character tucked into the wide-screen margin beside About. */
export function AboutCharacterDecor() {
  return (
    <DecorLayer className="overflow-visible">
      <PixelImage
        asset={ART.home.girl}
        label="girl"
        alt=""
        aria-hidden
        className="absolute -left-[40px] top-[calc(var(--mc-unit)*2)] hidden h-[180px] w-auto xl:block 2xl:-left-[110px] 2xl:h-[240px]"
        style={{ filter: "drop-shadow(0 12px 10px rgba(0,0,0,0.42))" }}
      />
    </DecorLayer>
  );
}

/** A miner entering the event grid from the opposite page margin. */
export function ExploreCharacterDecor() {
  return (
    <DecorLayer className="overflow-visible">
      <PixelImage
        asset={ART.home.pickaxe}
        label="pickaxe character"
        alt=""
        aria-hidden
        className="absolute -right-[40px] top-[calc(var(--mc-unit)*2.5)] hidden h-[190px] w-auto xl:block 2xl:-right-[120px] 2xl:h-[250px]"
        style={{ filter: "drop-shadow(0 12px 10px rgba(0,0,0,0.42))" }}
      />
    </DecorLayer>
  );
}
