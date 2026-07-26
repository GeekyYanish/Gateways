"use client";

import { useState } from "react";
import {
  BadgeSlot,
  BlockButton,
  BlockCheckbox,
  BlockInput,
  BlockModal,
  BlockPanel,
  BlockSelect,
  BlockToaster,
  Hotbar,
  LoadingBlocks,
  PixelAvatar,
  PixelImage,
  Signpost,
  XpBar,
  showToast,
  type ToastSeverity,
} from "@/components/mc";
import { ART, SKIN_IDS, allAssets } from "@/lib/assets/manifest";
import { SCENES } from "@/lib/assets/scenes";
import { BiomeScene } from "@/components/scene";
import { WORLD_LOCATIONS } from "@/lib/world/world-locations";
import type { Rarity } from "@/components/mc/badge-slot";

const BUTTON_VARIANTS = ["primary", "emerald", "stone", "gold", "danger", "dirt", "ghost"] as const;
const SIZES = ["sm", "md", "lg", "xl"] as const;
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const SEVERITIES: ToastSeverity[] = ["info", "success", "warning", "critical"];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
      <div>
        <h2 className="font-pixel text-[14px] uppercase text-mc-gold">{title}</h2>
        {note ? <p className="mt-1 text-[15px] text-mc-text-dim">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function KitchenSink() {
  const [modalOpen, setModalOpen] = useState(false);
  const [goldModal, setGoldModal] = useState(false);
  const [slot, setSlot] = useState(0);
  const [xp, setXp] = useState(350);
  const [checked, setChecked] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const assets = allAssets();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-[calc(var(--mc-unit)*4)] p-[calc(var(--mc-unit)*2)]">
      <BlockToaster />

      <header className="flex flex-col gap-2">
        <h1 className="text-mc-portal-light text-xl md:text-3xl">KITCHEN SINK</h1>
        <p className="text-mc-text-dim">
          Every design-system primitive in every variant. Dev-only. All art below
          is a generated placeholder — real files land in <code>/public/art</code>.
        </p>
        <label className="mt-2 flex items-center gap-2 text-[15px]">
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={(e) => {
              setReduceMotion(e.target.checked);
              document.documentElement.toggleAttribute("data-reduce-motion", e.target.checked);
            }}
          />
          Simulate <code>data-reduce-motion</code> (in-app toggle)
        </label>
      </header>

      <Section title="Block buttons" note="Bevel light/dark comes from each variant's CSS custom properties. Press to see the depress.">
        <div className="flex flex-col gap-[var(--mc-unit)]">
          {BUTTON_VARIANTS.map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-[var(--mc-unit)]">
              <span className="w-[80px] shrink-0 text-[14px] text-mc-text-dim">{v}</span>
              {SIZES.map((s) => (
                <BlockButton key={s} variant={v} size={s}>
                  {s}
                </BlockButton>
              ))}
              <BlockButton variant={v} disabled>disabled</BlockButton>
              <BlockButton variant={v} loading>loading</BlockButton>
            </div>
          ))}
          <BlockButton block variant="primary" size="lg">Full width (block)</BlockButton>
        </div>
      </Section>

      <Section title="Panels" note="Raised, recessed, and titled variants.">
        <div className="grid gap-[calc(var(--mc-unit)*1.5)] sm:grid-cols-2">
          <BlockPanel variant="panel">Standard panel</BlockPanel>
          <BlockPanel variant="slot">Recessed slot / well</BlockPanel>
          <BlockPanel variant="stone">Stone block</BlockPanel>
          <BlockPanel variant="gold">Gold highlight</BlockPanel>
          <BlockPanel variant="portal">Portal / obsidian</BlockPanel>
          <BlockPanel title="Titled panel" action={<BlockButton size="sm" variant="ghost">Action</BlockButton>}>
            Body content sits below the header strip.
          </BlockPanel>
        </div>
      </Section>

      <Section title="Form fields" note="Labels are programmatically bound; the message row is aria-live so async validation is announced.">
        <BlockPanel className="grid gap-[var(--mc-unit)] sm:grid-cols-2">
          <BlockInput label="Player name" placeholder="Ridge_07" hint="3–16 chars, letters/numbers/underscore" required />
          <BlockInput label="Email" type="email" placeholder="you@example.com" defaultValue="not-an-email" error="Enter a valid email address." />
          <BlockInput label="Password" type="password" defaultValue="hunter2" adornment={<BlockButton size="sm" variant="ghost">👁</BlockButton>} />
          <BlockSelect label="Year" defaultValue="2" required>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </BlockSelect>
          <BlockInput label="Disabled" disabled defaultValue="Read only" />
          <div className="flex items-end">
            <BlockCheckbox label="Remember me" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          </div>
        </BlockPanel>
      </Section>

      <Section title="XP bar" note="Framer spring on the fill. role=progressbar with live values.">
        <BlockPanel className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
          <XpBar current={xp} required={1000} level={3} title="Delver" />
          <XpBar current={980} required={1000} level={6} title="Starborn" compact />
          <XpBar current={1000} required={1000} level={7} title="Realm Legend" />
          <div className="flex flex-wrap gap-[var(--mc-unit)]">
            <BlockButton size="sm" onClick={() => setXp((v) => Math.max(0, v - 150))}>−150 XP</BlockButton>
            <BlockButton size="sm" variant="emerald" onClick={() => setXp((v) => Math.min(1000, v + 150))}>+150 XP</BlockButton>
          </div>
        </BlockPanel>
      </Section>

      <Section title="Hotbar" note="Press number keys 1–9 to select. Radio-group semantics.">
        <Hotbar
          activeIndex={slot}
          onActiveChange={setSlot}
          slots={[
            { item: "pickaxe", label: "Hackathon Mine" },
            { item: "camera", label: "Photography Forest" },
            { item: "craftingTable", label: "Design Workshop" },
            { item: "book", label: "Quiz Library" },
            { item: "sword", label: "Gaming Arena" },
            { item: "compass", label: "Village Square" },
            { item: "trophy", label: "Leaderboard" },
            {},
            { item: "warpOrb", label: "Teleport" },
          ]}
        />
        <p className="text-[15px] text-mc-text-dim">Selected slot: {slot + 1}</p>
      </Section>

      <Section title="Achievement badges" note="Locked, unlocked, and secret states across all five rarities.">
        <BlockPanel className="flex flex-wrap gap-[var(--mc-unit)]">
          {RARITIES.map((r) => (
            <BadgeSlot key={r} code={`demo_${r}`} name={`${r} badge`} description="Demo achievement" rarity={r} unlocked />
          ))}
          <BadgeSlot code="locked_one" name="Team Player" description="Join a team" unlocked={false} />
          <BadgeSlot code="secret_one" name="Secret Thing" unlocked={false} secret />
        </BlockPanel>
      </Section>

      <Section title="Avatars" note="Bust and full-body renders per skin.">
        <BlockPanel className="flex flex-wrap items-end gap-[calc(var(--mc-unit)*1.5)]">
          {SKIN_IDS.map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <PixelAvatar skinId={s} size={56} />
              <span className="text-[14px] text-mc-text-dim">{s}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <PixelAvatar skinId="prospector" size={64} full />
            <span className="text-[14px] text-mc-text-dim">full body</span>
          </div>
        </BlockPanel>
      </Section>

      <Section title="Modals & toasts" note="Radix handles focus trap + scroll lock; visuals are ours.">
        <div className="flex flex-wrap gap-[var(--mc-unit)]">
          <BlockButton onClick={() => setModalOpen(true)}>Open modal</BlockButton>
          <BlockButton variant="gold" onClick={() => setGoldModal(true)}>Achievement modal</BlockButton>
          {SEVERITIES.map((s) => (
            <BlockButton
              key={s}
              size="sm"
              variant={s === "critical" ? "danger" : s === "success" ? "emerald" : s === "warning" ? "gold" : "stone"}
              onClick={() => showToast({ title: `${s} toast`, body: "Hackathon starts tomorrow! Be ready, adventurer.", severity: s })}
            >
              {s}
            </BlockButton>
          ))}
        </div>

        <BlockModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Confirm registration"
          description="Confirm that you want to register for this event."
          footer={
            <>
              <BlockButton variant="ghost" onClick={() => setModalOpen(false)}>Cancel</BlockButton>
              <BlockButton variant="emerald" onClick={() => setModalOpen(false)}>Register</BlockButton>
            </>
          }
        >
          <p>Register for <strong className="text-mc-emerald-light">Hackathon Mine</strong>? You will earn 50 XP on check-in.</p>
        </BlockModal>

        <BlockModal open={goldModal} onOpenChange={setGoldModal} title="Achievement unlocked!" variant="gold" footer={<BlockButton variant="gold" onClick={() => setGoldModal(false)}>Awesome!</BlockButton>}>
          <div className="flex items-center gap-[calc(var(--mc-unit)*1.5)]">
            <BadgeSlot code="first_steps" name="First Steps" rarity="uncommon" unlocked size={72} />
            <div>
              <p className="font-pixel text-[12px] text-mc-gold-light">First Steps</p>
              <p className="mt-1 text-mc-text-dim">You have joined the Fest Realm!</p>
            </div>
          </div>
        </BlockModal>
      </Section>

      <Section title="Signposts" note="Percentage-positioned so they track the map at any resolution.">
        <div className="relative h-[280px] w-full overflow-hidden bg-mc-grass-dark bevel-inset">
          {WORLD_LOCATIONS.slice(0, 4).map((l) => (
            <Signpost key={l.key} label={l.label} item={l.item} href="#" xPct={l.x} yPct={l.y} />
          ))}
        </div>
      </Section>

      <Section title="Loading">
        <BlockPanel><LoadingBlocks label="Entering the realm" /></BlockPanel>
      </Section>

      <Section
        title={`Asset manifest (${assets.length} declared)`}
        note="Every entry renders its generated placeholder at exact declared dimensions — so nothing breaks and nothing shifts when real art arrives."
      >
        <BlockPanel variant="slot" className="grid gap-[var(--mc-unit)] grid-cols-[repeat(auto-fill,minmax(96px,1fr))]">
          {assets.map(({ group, key, spec }) => (
            <div key={`${group}.${key}`} className="flex flex-col items-center gap-1 text-center">
              <PixelImage
                asset={spec}
                label={key}
                className="max-w-[88px] max-h-[88px] w-auto h-auto object-contain"
              />
              <span className="text-[13px] leading-tight text-mc-text-dim break-all">
                {group}.{key}
                <br />
                {spec.w}×{spec.h}
              </span>
            </div>
          ))}
        </BlockPanel>
      </Section>

      <Section title="Block textures" note="Tiled at intrinsic size × --mc-scale, so tiles stay integer-aligned.">
        <div className="flex flex-wrap gap-[var(--mc-unit)]">
          {Object.entries(ART.blocks).map(([name, spec]) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <PixelImage asset={spec} label={name} scale={4} />
              <span className="text-[13px] text-mc-text-dim">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={`Scenes (${Object.keys(SCENES).length})`}
        note="Layered parallax backgrounds and biome illustrations. Move the pointer over one — layers shift by depth. Every layer is a placeholder silhouette until real art lands in /public/art/scenes/<scene>/<layer>.png"
      >
        <div className="grid gap-[calc(var(--mc-unit)*1.5)] sm:grid-cols-2">
          {Object.values(SCENES).map((s) => (
            <div key={s.key} className="flex flex-col gap-1">
              <BiomeScene
                scene={s.key}
                className="h-[180px] border-[length:var(--mc-bevel)] border-mc-border bevel-inset"
              >
                <div className="mt-auto p-[var(--mc-unit)]">
                  <p
                    className="font-pixel text-[10px] uppercase text-white"
                    style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.85)" }}
                  >
                    {s.name}
                  </p>
                </div>
              </BiomeScene>
              <p className="text-[13px] leading-tight text-mc-text-dim">
                <code>{s.key}</code> · {s.layers.length} layers ·{" "}
                {s.layers.map((l) => `${l.layer}@${l.depth}`).join(", ")}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
