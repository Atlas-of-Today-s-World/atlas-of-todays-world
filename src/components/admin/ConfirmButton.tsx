"use client";

import { useRef, useState, useTransition } from "react";
import { Button, type ButtonVariants } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";

/**
 * Tlačítko pro nevratnou nebo citlivou akci (smazat, stáhnout z webu…):
 * nejdřív potvrzovací dialog, pak Server Action. Nativní <dialog> drží
 * ohnisko uvnitř a zavírá se klávesou Esc.
 */
export function ConfirmButton({
  label,
  title,
  body,
  confirm = label,
  action,
  onDone,
  ...variants
}: ButtonVariants & {
  label: string;
  title: string;
  body: string;
  confirm?: string;
  action: () => Promise<ActionState>;
  onDone?: (state: ActionState) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        {...variants}
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        {label}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        className="m-auto w-[min(92vw,26rem)] rounded-2xl p-6 text-[var(--color-ink)] backdrop:bg-black/40"
      >
        <h2 id="confirm-title" className="font-display text-[18px] font-bold">
          {title}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">{body}</p>
        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => dialog.current?.close()}>
            Zrušit
          </Button>
          <Button
            size="sm"
            variant={variants.variant === "danger" ? "danger" : "primary"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const state = await action();
                if (state.ok) dialog.current?.close();
                else setError(state.error ?? "Nepovedlo se.");
                onDone?.(state);
              })
            }
          >
            {pending ? "Pracuji…" : confirm}
          </Button>
        </div>
      </dialog>
    </>
  );
}
