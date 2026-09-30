"use client";

import { useActionState } from "react";
import { deleteAccount, type ActionState } from "@/features/auth/actions";

export default function DeleteAccount({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteAccount, {
    ok: false,
  });

  return (
    <details className="mt-12 rounded-xl border border-[var(--color-line)] p-4">
      <summary className="cursor-pointer text-[13px] font-medium text-red-700">
        Delete my account
      </summary>
      <form action={action} className="mt-4 grid gap-3">
        <p className="text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
          This removes your account and personal data for good. Type <strong>{email}</strong> to
          confirm.
        </p>
        <label htmlFor="confirm" className="sr-only">
          Your e-mail address
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
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-full bg-red-700 px-6 text-[14px] font-medium text-white disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </details>
  );
}
