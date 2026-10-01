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
      <h2 className="font-display text-[17px] font-bold">New redirect</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="redirect-from"
          label="Old path"
          hint="E.g. /news/old-title"
          required
          errors={errors.from_path}
        >
          <Input
            id="redirect-from"
            name="from_path"
            required
            maxLength={300}
            placeholder="/news/old-title"
          />
        </FormField>
        <FormField
          id="redirect-to"
          label="New path"
          hint="E.g. /news/new-title"
          required
          errors={errors.to_path}
        >
          <Input
            id="redirect-to"
            name="to_path"
            required
            maxLength={300}
            placeholder="/news/new-title"
          />
        </FormField>
      </div>
      <Checkbox
        name="permanent"
        defaultChecked
        label="Permanent (308) — search engines will remember the new URL"
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Saving…">Add redirect</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}

export function DeleteRedirect({ id, from }: { id: string; from: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete"
      variant="danger"
      title="Delete the redirect?"
      body={`The URL ${from} will then lead to the “not found” page.`}
      confirm="Delete"
      action={() => deleteRedirect(id)}
      onDone={(state) => {
        if (state.ok) router.refresh();
      }}
    />
  );
}
