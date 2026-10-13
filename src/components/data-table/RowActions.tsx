"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Ban,
  CircleCheck,
  ExternalLink,
  Eye,
  EyeOff,
  type LucideIcon,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";
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
  hide: EyeOff,
  show: Eye,
  up: ArrowUp,
  down: ArrowDown,
};

/** An "instant" row action: runs without a dialog, refreshes the table, announces a failure. */
function InstantButton({
  label,
  icon,
  action,
  disabled,
  onDone,
}: {
  label: string;
  icon: ReactNode;
  action: () => Promise<ActionState>;
  disabled?: boolean;
  onDone: (state: ActionState) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <Button
        variant="quiet"
        size="rowIcon"
        aria-label={label}
        title={error || label}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        onClick={() =>
          start(async () => {
            const state = await action();
            setError(state.ok ? "" : (state.error ?? "Something went wrong."));
            onDone(state);
          })
        }
      >
        {icon}
      </Button>
      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </>
  );
}

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
        if (item.kind === "instant") {
          return (
            <InstantButton
              key={item.label}
              label={item.label}
              icon={icon}
              action={item.action}
              disabled={item.disabled}
              onDone={(state) => {
                if (state.ok) router.refresh();
              }}
            />
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
