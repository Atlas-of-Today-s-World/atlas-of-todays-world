"use client";

import { useActionState } from "react";
import { deleteAccount, type ActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { useMessages } from "@/components/i18n/LocaleProvider";

export default function DeleteAccount({ email }: { email: string }) {
  const t = useMessages().account;
  // "{email}" in the text is replaced by the bold address (word order differs by language).
  const [before, after = ""] = t.deleteText.split("{email}");
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteAccount, {
    ok: false,
  });

  return (
    <details className="mt-12 rounded-xl border border-[var(--color-line)] p-4">
      <summary className="cursor-pointer text-[13px] font-medium text-red-700">{t.delete}</summary>
      <ActionForm action={action} className="mt-4 grid gap-3">
        <p className="text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
          {before}
          <strong>{email}</strong>
          {after}
        </p>
        <label htmlFor="confirm" className="sr-only">
          {t.emailLabel}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="email"
          required
          autoComplete="off"
          className="min-h-11 rounded-lg border border-[var(--color-line)] px-3 text-[14px]"
        />
        {state.error ? (
          <p role="alert" className="text-[13px] text-red-700">
            {state.error ? t.errors[state.error] : null}
          </p>
        ) : null}
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? t.deleting : t.delete}
        </Button>
      </ActionForm>
    </details>
  );
}
