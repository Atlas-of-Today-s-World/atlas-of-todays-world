import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Toggle or tab in the table toolbar that changes what the server loads
 * ("Only mine", "Archived", Team / Readers). A link, so it works without
 * JavaScript and the state lives in the URL.
 */
export function ToolbarLink({
  href,
  active,
  children,
  kind = "toggle",
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  /** `toggle` = on/off filter (aria-pressed), `tab` = one of several views (aria-current). */
  kind?: "toggle" | "tab";
}) {
  return (
    <Link
      href={href}
      aria-pressed={kind === "toggle" ? active : undefined}
      aria-current={kind === "tab" && active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: "outline", size: "dense" }),
        active &&
          "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]",
      )}
    >
      {children}
    </Link>
  );
}
