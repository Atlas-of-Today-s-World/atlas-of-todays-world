"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button, type ButtonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/actions";

/**
 * Button for an irreversible or sensitive action (delete, unpublish…):
 * first a confirmation dialog (`ui/dialog`), then the Server Action.
 */
export function ConfirmButton({
  label,
  title,
  body,
  confirm = label,
  action,
  onDone,
  icon,
  ...variants
}: ButtonVariants & {
  label: string;
  /** Icon only (table row actions); `label` then serves as the screen-reader name and tooltip. */
  icon?: ReactNode;
  title: string;
  body: string;
  confirm?: string;
  action: () => Promise<ActionState>;
  onDone?: (state: ActionState) => void;
}) {
  const danger = variants.variant === "danger" || variants.variant === "quietDanger";
  return (
    <Dialog
      title={title}
      description={body}
      trigger={(open) => (
        <Button
          variant="outline"
          size="sm"
          {...variants}
          aria-label={icon ? label : undefined}
          title={icon ? label : undefined}
          onClick={open}
        >
          {icon ?? label}
        </Button>
      )}
    >
      {(close) => (
        <Confirm confirm={confirm} danger={danger} action={action} onDone={onDone} close={close} />
      )}
    </Dialog>
  );
}

function Confirm({
  confirm,
  danger,
  action,
  onDone,
  close,
}: {
  confirm: string;
  danger: boolean;
  action: () => Promise<ActionState>;
  onDone?: (state: ActionState) => void;
  close: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={close}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant={danger ? "danger" : "primary"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const state = await action();
              if (state.ok) close();
              else setError(state.error ?? "Something went wrong.");
              onDone?.(state);
            })
          }
        >
          {pending ? "Working…" : confirm}
        </Button>
      </div>
    </>
  );
}
