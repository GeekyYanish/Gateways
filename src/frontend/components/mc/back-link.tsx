"use client";

import Link from "next/link";
import { blockButton } from "./block-button";
import { cn } from "@/frontend/lib/utils";

/**
 * A deterministic route link for moving up one level in the product.
 *
 * This intentionally uses an explicit href instead of router.back(): a visitor
 * who opens a page from an email, search result, or external site should stay
 * inside Parallax rather than being sent back out of the app.
 */
export function BackLink({
  href,
  label = "Back",
  className,
  onClick,
}: {
  href: string;
  label?: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        blockButton({ variant: "ghost", size: "sm" }),
        "w-fit no-underline",
        className,
      )}
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}
