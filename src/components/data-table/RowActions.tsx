"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarPlus,
  CircleCheck,
  ExternalLink,
  Eye,
  EyeOff,
  type LucideIcon,
  Pencil,
  Send,
  Share2,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useId, useState, useTransition, type ReactNode } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import type { RowAction, RowActionIcon } from "./row-actions";

/** Icons by name, so a Server Component can describe actions as plain data. */
const ICONS: Record<RowActionIcon, LucideIcon> = {
  edit: Pencil,
  view: Eye,
  open: ExternalLink,
  approve: CircleCheck,
  return: Undo2,
  send: Send,
  extend: CalendarPlus,
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

type NoteItem = Extract<RowAction, { kind: "note" }>;

/** A "note" row action: a dialog with a required note, then the form Server Action. */
function NoteButton({
  item,
  icon,
  onDone,
}: {
  item: NoteItem;
  icon: ReactNode;
  onDone: (state: ActionState) => void;
}) {
  return (
    <Dialog
      title={item.confirmTitle}
      description={item.confirmBody}
      trigger={(open) => (
        <Button
          variant="quiet"
          size="rowIcon"
          aria-label={item.label}
          title={item.label}
          onClick={open}
        >
          {icon}
        </Button>
      )}
    >
      {(close) => <NoteForm item={item} close={close} onDone={onDone} />}
    </Dialog>
  );
}

function NoteForm({
  item,
  close,
  onDone,
}: {
  item: NoteItem;
  close: () => void;
  onDone: (state: ActionState) => void;
}) {
  const id = useId();
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, data) => {
      const next = await item.action(prev, data);
      if (next.ok) close();
      onDone(next);
      return next;
    },
    { ok: false },
  );
  return (
    <ActionForm action={action} className="mt-4 grid gap-3">
      {Object.entries(item.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <FormField id={id} label={item.noteLabel} required errors={state.fieldErrors?.note}>
        <Textarea id={id} name="note" rows={3} maxLength={item.noteMax} required />
      </FormField>
      <ActionStatus state={state} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={close}>
          Cancel
        </Button>
        <SubmitButton size="sm" pending="Working…">
          {item.confirmLabel ?? item.label}
        </SubmitButton>
      </div>
    </ActionForm>
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
        if (item.kind === "note") {
          return (
            <NoteButton
              key={item.label}
              item={item}
              icon={icon}
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
