"use client";

import { useActionState, useId } from "react";
import { deleteAccount, type ActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import type { Messages } from "@/lib/i18n/messages";

/**
 * Deleting one's own account, collapsed until opened and confirmed by typing
 * the e-mail address (the action checks it again, plus the second factor and
 * the last-admin rule). The texts come from the page: the reader's /account
 * and the admin's My account (which has no language provider) share it.
 */
export default function DeleteAccount({ email, t }: { email: string; t: Messages["account"] }) {
  const id = useId();
  // "{email}" in the text is replaced by the bold address (word order differs by language).
  const [before, after = ""] = t.deleteText.split("{email}");
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteAccount, {
    ok: false,
  });

  return (
    <details className="mt-10 rounded-xl border border-[var(--color-line)] p-4">
      <summary className="cursor-pointer text-[13px] font-medium text-red-700">{t.delete}</summary>
      <ActionForm action={action} className="mt-4 grid gap-3">
        <p className="text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
          {before}
          <strong>{email}</strong>
          {after}
        </p>
        <label htmlFor={id} className="sr-only">
          {t.emailLabel}
        </label>
        <input
          id={id}
          name="confirm"
          type="email"
          required
          autoComplete="off"
          className="min-h-(--touch-min) rounded-lg border border-[var(--color-line)] px-3 text-[14px]"
        />
        {state.error ? (
          <p role="alert" className="text-[13px] text-red-700">
            {t.errors[state.error]}
          </p>
        ) : null}
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? t.deleting : t.delete}
        </Button>
      </ActionForm>
    </details>
  );
}
