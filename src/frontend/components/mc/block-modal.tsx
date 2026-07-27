"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/frontend/lib/utils";
import { BlockButton } from "./block-button";

/**
 * Modal dialog.
 *
 * Built on Radix Dialog for the parts that are genuinely hard and easy to get
 * subtly wrong: focus trapping, focus restoration on close, scroll locking,
 * Escape handling, and aria-modal wiring. Everything visual is ours.
 *
 * Animation is Framer Motion (a component reacting to presence), per the
 * GSAP-vs-Framer split. The achievement-unlock cinematic layers an additional
 * GSAP timeline on its own contents — see achievement-modal.tsx — which is
 * allowed because it animates different elements, not the same properties.
 */

export interface BlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Visually hidden description for screen readers when there is no body text. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "panel" | "gold" | "portal";
  /** Hides the default close button — for flows that must be resolved. */
  hideClose?: boolean;
  className?: string;
}

const VARIANT_CLASSES = {
  panel: "bg-mc-panel border-mc-border",
  gold: "bg-mc-panel border-mc-gold",
  portal: "bg-mc-obsidian border-mc-portal",
} as const;

export function BlockModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  variant = "panel",
  hideClose,
  className,
}: BlockModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {/* forceMount + AnimatePresence so the exit animation can play; without
          forceMount Radix removes the node instantly and the exit is skipped. */}
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px]"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
                  "w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto",
                  "border-[length:var(--mc-bevel)] bevel",
                  VARIANT_CLASSES[variant],
                  className,
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between gap-[var(--mc-unit)]",
                    "px-[calc(var(--mc-unit)*1.5)] py-[var(--mc-unit)]",
                    "border-b-[length:var(--mc-bevel)] border-inherit bg-black/25",
                  )}
                >
                  <Dialog.Title className="font-pixel text-[12px] uppercase tracking-wider">
                    {title}
                  </Dialog.Title>
                  {!hideClose ? (
                    <Dialog.Close asChild>
                      <BlockButton variant="ghost" size="sm" aria-label="Close">
                        ✕
                      </BlockButton>
                    </Dialog.Close>
                  ) : null}
                </div>

                {description ? (
                  <Dialog.Description className="sr-only">
                    {description}
                  </Dialog.Description>
                ) : null}

                <div className="p-[calc(var(--mc-unit)*2)]">{children}</div>

                {footer ? (
                  <div
                    className={cn(
                      "flex flex-wrap justify-end gap-[var(--mc-unit)]",
                      "px-[calc(var(--mc-unit)*2)] pb-[calc(var(--mc-unit)*2)]",
                    )}
                  >
                    {footer}
                  </div>
                ) : null}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
