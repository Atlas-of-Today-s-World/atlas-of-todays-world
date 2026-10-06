"use client";

import { usePathname } from "next/navigation";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { RAIL_OFFSET, railKind } from "@/config/layout";
import { cn } from "@/lib/cn";
import { DonateCoin } from "./DonateCoin";

/**
 * The gold-coin "Support the Atlas" button bottom right on every public page:
 * the map layout and the pages layout render it (not the admin, not the
 * donation pages, whose layout leaves it out). On the map it moves left of the
 * right panel, and on phones it gives way to the panel's bottom sheet.
 */
export function FloatingDonate({ onMap = false }: { onMap?: boolean }) {
  const pathname = usePathname();
  const t = useMessages().home;
  const rail = onMap ? railKind(pathname) : "none";

  return (
    <DonateCoin
      label={t.support}
      className={cn(
        "fixed right-3 bottom-3 z-[47] sm:right-5",
        rail !== "none" && ["max-md:hidden", RAIL_OFFSET[rail]],
      )}
    />
  );
}
