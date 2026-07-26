"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Form primitives with recessed (inset-bevel) wells, matching Minecraft's
 * text fields.
 *
 * These are hand-rolled rather than shadcn/ui reskins. shadcn's Input is a
 * single <input> with class names — wrapping it would add a dependency layer
 * that buys nothing, since every visual token here is ours. We DO use shadcn
 * for genuinely complex primitives (Dialog, Select popovers) where the
 * accessibility behaviour is the value.
 *
 * Label + error + hint wiring is built in: an input without a programmatic
 * label is the single most common a11y defect in forms, so it is not optional
 * here.
 */

interface FieldShellProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}

function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-[calc(var(--mc-unit)*0.5)]", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="font-pixel text-[10px] uppercase tracking-wide text-mc-text-dim"
        >
          {label}
          {required ? (
            <span className="text-mc-redstone-light" aria-hidden>
              {" "}
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {children}

      {/* aria-live so async validation (e.g. player-name availability) is
          announced to screen readers rather than silently appearing. */}
      <p
        id={`${htmlFor}-msg`}
        aria-live="polite"
        className={cn(
          "text-[15px] leading-tight min-h-[1.2em]",
          error ? "text-mc-redstone-light" : "text-mc-text-dim",
        )}
      >
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}

const wellClasses = [
  "w-full bg-mc-slot text-mc-text bevel-inset",
  "border-0 outline-none",
  "px-[calc(var(--mc-unit)*1)] py-[calc(var(--mc-unit)*0.85)]",
  "text-[17px] font-body",
  "min-h-[44px]",
  "placeholder:text-mc-text-dim/60",
  "disabled:brightness-75 disabled:cursor-not-allowed",
];

export interface BlockInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Rendered inside the field on the right — e.g. a password reveal toggle. */
  adornment?: React.ReactNode;
  wrapperClassName?: string;
}

export const BlockInput = forwardRef<HTMLInputElement, BlockInputProps>(
  function BlockInput(
    { label, hint, error, adornment, className, wrapperClassName, id, required, ...props },
    ref,
  ) {
    const auto = useId();
    const fieldId = id ?? auto;

    return (
      <FieldShell
        label={label}
        hint={hint}
        error={error}
        required={required}
        htmlFor={fieldId}
        className={wrapperClassName}
      >
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={fieldId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${fieldId}-msg`}
            className={cn(
              wellClasses,
              adornment && "pr-[calc(var(--mc-unit)*4)]",
              error && "outline-[length:var(--mc-bevel)] outline-mc-redstone",
              className,
            )}
            {...props}
          />
          {adornment ? (
            <span className="absolute right-[calc(var(--mc-unit)*0.5)] flex items-center">
              {adornment}
            </span>
          ) : null}
        </div>
      </FieldShell>
    );
  },
);

export interface BlockSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  wrapperClassName?: string;
}

/**
 * Native <select> on purpose. On mobile the OS picker is far better than any
 * custom dropdown, and it is keyboard- and screen-reader-correct for free. The
 * arrow is drawn with a CSS triangle so it still looks blocky.
 */
export const BlockSelect = forwardRef<HTMLSelectElement, BlockSelectProps>(
  function BlockSelect(
    { label, hint, error, className, wrapperClassName, id, required, children, ...props },
    ref,
  ) {
    const auto = useId();
    const fieldId = id ?? auto;

    return (
      <FieldShell
        label={label}
        hint={hint}
        error={error}
        required={required}
        htmlFor={fieldId}
        className={wrapperClassName}
      >
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={fieldId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${fieldId}-msg`}
            className={cn(
              wellClasses,
              "appearance-none pr-[calc(var(--mc-unit)*3)] cursor-pointer",
              error && "outline-[length:var(--mc-bevel)] outline-mc-redstone",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute right-[calc(var(--mc-unit)*1)]",
              "w-0 h-0 border-x-[6px] border-x-transparent border-t-[7px] border-t-mc-text-dim",
            )}
          />
        </div>
      </FieldShell>
    );
  },
);

export interface BlockCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
}

export const BlockCheckbox = forwardRef<HTMLInputElement, BlockCheckboxProps>(
  function BlockCheckbox({ label, className, id, ...props }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;

    return (
      <div className="flex items-center gap-[calc(var(--mc-unit)*0.75)]">
        {/* The real input stays in the DOM (not display:none) so it remains
            focusable and announced; the visual box is a sibling driven by
            :checked / :focus-visible via peer-*. */}
        <input
          ref={ref}
          type="checkbox"
          id={fieldId}
          className={cn("peer sr-only", className)}
          {...props}
        />
        {/* The tick is a stepped SVG path, not a rotated bordered box: a
            rotated edge antialiases, and a soft diagonal in a pixel UI is
            immediately visible as wrong. */}
        <label
          htmlFor={fieldId}
          className={cn(
            "relative grid shrink-0 cursor-pointer place-items-center",
            "w-[22px] h-[22px] bg-mc-slot bevel-inset",
            "peer-checked:bg-mc-portal",
            "peer-focus-visible:outline peer-focus-visible:outline-[length:var(--mc-bevel)] peer-focus-visible:outline-mc-gold peer-focus-visible:outline-offset-2",
            "[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
          )}
          aria-hidden
        >
          <svg viewBox="0 0 9 8" className="w-[13px]" shapeRendering="crispEdges">
            <path
              d="M7 1h2v2H7z M6 2h2v2H6z M5 3h2v2H5z M4 4h2v2H4z M3 5h2v2H3z M2 4h2v2H2z M1 3h2v2H1z M0 2h2v2H0z"
              fill="#ffffff"
            />
          </svg>
        </label>
        <label
          htmlFor={fieldId}
          className="cursor-pointer text-[16px] text-mc-text-dim select-none"
        >
          {label}
        </label>
      </div>
    );
  },
);
