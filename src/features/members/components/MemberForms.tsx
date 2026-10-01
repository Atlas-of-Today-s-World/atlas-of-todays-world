"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormField, Select } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { grantMembership, revokeMembership } from "../actions";
import { ActionForm } from "@/components/ui/action-form";

export const PLAN_LABEL: Record<string, string> = {
  none: "—",
  patron: "Patron",
  founding: "Founding patron",
  institution: "Institution",
};

export function GrantForm({ accounts }: { accounts: { id: string; label: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(grantMembership, { ok: false });
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm
      action={action}
      className="grid max-w-2xl gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
    >
      <FormField id="user_id" label="Account" errors={errors.user_id}>
        <Select id="user_id" name="user_id" required defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="plan" label="Membership" errors={errors.plan}>
        <Select id="plan" name="plan" defaultValue="patron">
          {["patron", "founding", "institution"].map((plan) => (
            <option key={plan} value={plan}>
              {PLAN_LABEL[plan]}
            </option>
          ))}
        </Select>
      </FormField>
      <SubmitButton size="sm">Grant for free</SubmitButton>
      <div className="sm:col-span-3">
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}

export function RevokeMembership({ userId, label }: { userId: string; label: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Revoke"
      variant="danger"
      title={`Revoke complimentary membership – ${label}?`}
      body="The account will no longer be an Atlas Patron."
      confirm="Revoke"
      action={() => revokeMembership(userId)}
      onDone={(state) => {
        if (state.ok) router.refresh();
      }}
    />
  );
}
