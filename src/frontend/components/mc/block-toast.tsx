"use client";

import { Toaster, toast } from "sonner";
import { cn } from "@/frontend/lib/utils";
import { PixelImage } from "./pixel-image";
import { ART, type ItemName } from "@/frontend/lib/assets/manifest";

/**
 * Notification toast (mockup SCREEN 9).
 *
 * sonner handles stacking, timers, swipe-dismiss, hover-pause and the
 * aria-live region — all fiddly, all solved. We replace only the render
 * surface with a Minecraft panel via toast.custom().
 */

export type ToastSeverity = "info" | "success" | "warning" | "critical";

const SEVERITY: Record<
  ToastSeverity,
  { border: string; accent: string; item: ItemName; label: string }
> = {
  info: { border: "border-mc-diamond", accent: "text-mc-diamond-light", item: "book", label: "Information" },
  success: { border: "border-mc-emerald", accent: "text-mc-emerald-light", item: "trophy", label: "Success" },
  warning: { border: "border-mc-gold", accent: "text-mc-gold-light", item: "compass", label: "Warning" },
  critical: { border: "border-mc-redstone", accent: "text-mc-redstone-light", item: "sword", label: "Alert" },
};

export interface BlockToastProps {
  title: string;
  body?: string;
  severity?: ToastSeverity;
  onDismiss?: () => void;
}

export function BlockToast({
  title,
  body,
  severity = "info",
  onDismiss,
}: BlockToastProps) {
  const s = SEVERITY[severity];

  return (
    <div
      className={cn(
        "flex items-start gap-[var(--mc-unit)]",
        "w-[min(92vw,380px)] p-[calc(var(--mc-unit)*1.25)]",
        "bg-mc-panel border-[length:var(--mc-bevel)] bevel",
        "[--bevel-light:var(--color-mc-panel-light)] [--bevel-dark:var(--color-mc-panel-dark)]",
        s.border,
      )}
    >
      <div className="shrink-0 grid place-items-center w-[32px] h-[32px] bg-mc-slot bevel-inset">
        <PixelImage asset={ART.items[s.item]} label={s.item} className="w-[22px] h-[22px]" alt="" />
      </div>

      <div className="min-w-0 flex-1">
        {/* The severity is conveyed by colour AND this text prefix — colour
            alone fails for colourblind users and screen readers. */}
        <p className={cn("font-pixel text-[10px] uppercase tracking-wide", s.accent)}>
          <span className="sr-only">{s.label}: </span>
          {title}
        </p>
        {body ? (
          <p className="mt-[calc(var(--mc-unit)*0.4)] text-[15px] leading-snug text-mc-text-dim break-words">
            {body}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 px-[6px] font-pixel text-[10px] text-mc-text-dim hover:text-mc-text cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}

/** Show a Minecraft-styled toast. */
export function showToast(opts: {
  title: string;
  body?: string;
  severity?: ToastSeverity;
  duration?: number;
}) {
  return toast.custom(
    (id) => (
      <BlockToast
        title={opts.title}
        body={opts.body}
        severity={opts.severity}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration: opts.duration ?? 5000 },
  );
}

/** Mount once, in the authed layout. */
export function BlockToaster() {
  return (
    <Toaster
      position="bottom-right"
      // Our own markup handles all visuals; sonner's theme would fight it.
      toastOptions={{ unstyled: true, classNames: { toast: "bg-transparent" } }}
      gap={10}
      visibleToasts={4}
    />
  );
}
