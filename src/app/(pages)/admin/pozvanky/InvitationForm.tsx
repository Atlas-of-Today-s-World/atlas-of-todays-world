"use client";

import { useActionState } from "react";
import { createInvitation, type InvitationState } from "@/features/invitations/actions";

export default function InvitationForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<InvitationState, FormData>(createInvitation, {
    ok: false,
  });

  return (
    <form
      action={action}
      className="mt-8 grid max-w-xl gap-3 rounded-xl border border-[var(--color-line)] p-5"
    >
      <h2 className="font-display text-[16px] font-bold">Pozvat do týmu</h2>

      <label
        htmlFor="invite-email"
        className="text-[12px] font-medium text-[var(--color-ink-muted)]"
      >
        E-mail (Google účet)
      </label>
      <input
        id="invite-email"
        name="email"
        type="email"
        required
        maxLength={254}
        aria-invalid={Boolean(state.fieldErrors?.email)}
        className="min-h-11 rounded-lg border border-[var(--color-line)] px-3 text-[14px]"
      />
      {state.fieldErrors?.email ? (
        <p className="text-[12px] text-red-700">{state.fieldErrors.email[0]}</p>
      ) : null}

      <label
        htmlFor="invite-role"
        className="text-[12px] font-medium text-[var(--color-ink-muted)]"
      >
        Role
      </label>
      <select
        id="invite-role"
        name="roleId"
        required
        defaultValue="publisher"
        className="min-h-11 rounded-lg border border-[var(--color-line)] bg-white px-3 text-[14px]"
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>

      <label
        htmlFor="invite-note"
        className="text-[12px] font-medium text-[var(--color-ink-muted)]"
      >
        Poznámka (interní, nepovinná)
      </label>
      <input
        id="invite-note"
        name="note"
        maxLength={300}
        className="min-h-11 rounded-lg border border-[var(--color-line)] px-3 text-[14px]"
      />

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-[13px] text-green-800">
          Pozvánka je vytvořená. Pošlete pozvanému odkaz na stránku /pozvanka.
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-full bg-[var(--color-accent)] px-6 text-[14px] font-medium text-white disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Vytvořit pozvánku"}
        </button>
      </div>
    </form>
  );
}
