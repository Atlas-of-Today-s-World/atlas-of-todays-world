"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, FormField, Input } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { addRedirect, deleteRedirect } from "../actions";

/** Nové přesměrování staré cesty na novou (obě na tomto webu). */
export function RedirectForm() {
  const [state, action] = useActionState<ActionState, FormData>(addRedirect, { ok: false });
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm
      action={action}
      className="grid max-w-2xl gap-4 rounded-2xl border border-[var(--color-line)] p-5"
    >
      <h2 className="font-display text-[17px] font-bold">Nové přesměrování</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="redirect-from"
          label="Stará cesta"
          hint="Např. /news/stary-nazev"
          required
          errors={errors.from_path}
        >
          <Input
            id="redirect-from"
            name="from_path"
            required
            maxLength={300}
            placeholder="/news/stary-nazev"
          />
        </FormField>
        <FormField
          id="redirect-to"
          label="Nová cesta"
          hint="Např. /news/novy-nazev"
          required
          errors={errors.to_path}
        >
          <Input
            id="redirect-to"
            name="to_path"
            required
            maxLength={300}
            placeholder="/news/novy-nazev"
          />
        </FormField>
      </div>
      <Checkbox
        name="permanent"
        defaultChecked
        label="Trvalé (308) — vyhledávače si zapamatují novou adresu"
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Ukládám…">Přidat přesměrování</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}

export function DeleteRedirect({ id, from }: { id: string; from: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Smazat"
      variant="danger"
      title="Smazat přesměrování?"
      body={`Adresa ${from} pak skončí na stránce „nenalezeno".`}
      confirm="Smazat"
      action={() => deleteRedirect(id)}
      onDone={(state) => {
        if (state.ok) router.refresh();
      }}
    />
  );
}
