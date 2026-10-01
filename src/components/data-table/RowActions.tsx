"use client";

import {
  Archive,
  ArchiveRestore,
  Ban,
  CircleCheck,
  ExternalLink,
  Eye,
  type LucideIcon,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { buttonVariants } from "@/components/ui/button";
import type { RowAction, RowActionIcon } from "./row-actions";

/** Icons by name, so a Server Component can describe actions as plain data. */
const ICONS: Record<RowActionIcon, LucideIcon> = {
  edit: Pencil,
  view: Eye,
  open: ExternalLink,
  approve: CircleCheck,
  share: Share2,
  archive: Archive,
  restore: ArchiveRestore,
  revoke: Ban,
  delete: Trash2,
};

/**
 * Row actions as icon buttons right in the row (TealHub owner rule: one click,
 * not a "⋯" menu). Order is the caller's; put delete last. Every button has
 * an accessible name and tooltip; on touch screens it grows to 44 px.
 */
export function RowActions({ actions }: { actions: readonly RowAction[] }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-end gap-0.5">
      {actions.map((item) => {
        const Icon = ICONS[item.icon];
        const icon = <Icon aria-hidden className="size-3.5" />;
        if (item.kind === "link") {
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              target={item.newTab ? "_blank" : undefined}
              rel={item.newTab ? "noopener" : undefined}
              className={buttonVariants({ variant: "quiet", size: "rowIcon" })}
            >
              {icon}
            </Link>
          );
        }
        return (
          <ConfirmButton
            key={item.label}
            label={item.label}
            icon={icon}
            variant={item.danger ? "quietDanger" : "quiet"}
            size="rowIcon"
            title={item.confirmTitle}
            body={item.confirmBody}
            confirm={item.confirmLabel ?? item.label}
            action={item.action}
            onDone={(state) => {
              if (state.ok) router.refresh();
            }}
          />
        );
      })}
    </div>
  );
}
