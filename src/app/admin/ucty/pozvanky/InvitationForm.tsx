"use client";

import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { CountryPicker, type CountryOption } from "@/components/admin/CountryPicker";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Checkbox, FormField, Input, Select } from "@/components/ui/field";
import { createInvitation } from "@/features/invitations/actions";
import type { ActionState } from "@/lib/actions";
import { ActionForm } from "@/components/admin/ActionForm";

interface RoleOption {
  id: string;
  name: string;
  note: string;
  approval_scope: string;
}

export default function InvitationForm({
  roles,
  countries,
  isAdmin,
}: {
  roles: RoleOption[];
  countries: CountryOption[];
  isAdmin: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createInvitation, { ok: false });
  const [roleId, setRoleId] = useState(roles.find((r) => r.id === "publisher")?.id ?? roles[0]?.id);
  const role = roles.find((r) => r.id === roleId);
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm
      action={action}
      className="grid max-w-xl gap-4 rounded-2xl border border-[var(--color-line)] p-5"
    >
      <h2 className="font-display text-[17px] font-bold">Pozvat do týmu</h2>
      <FormField id="invite-email" label="E-mail (Google účet)" required errors={errors.email}>
        <Input id="invite-email" name="email" type="email" required maxLength={254} />
      </FormField>
      <FormField id="invite-role" label="Role" hint={role?.note} errors={errors.roleId}>
        <Select
          id="invite-role"
          name="roleId"
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
        >
          {roles.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      </FormField>
      {role?.approval_scope === "assigned" ? (
        <fieldset className="grid gap-3 rounded-xl bg-[var(--color-line)]/25 p-4">
          <legend className="sr-only">Co bude schvalovat</legend>
          {isAdmin ? (
            <Checkbox name="approvalGlobal" label="Všechno (globální schvalovatel)" />
          ) : null}
          <FormField id="invite-countries" label="Články o těchto zemích">
            <CountryPicker
              id="invite-countries"
              name="countries"
              options={countries}
              defaultSelected={[]}
            />
          </FormField>
        </fieldset>
      ) : null}
      <FormField id="invite-note" label="Poznámka (interní, nepovinná)" errors={errors.note}>
        <Input id="invite-note" name="note" maxLength={300} />
      </FormField>
      <ActionStatus state={state} />
      <div>
        <SubmitButton>Vytvořit pozvánku</SubmitButton>
      </div>
    </ActionForm>
  );
}
