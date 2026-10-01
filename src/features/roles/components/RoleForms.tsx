"use client";

import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Checkbox, FormField, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { saveRole, saveSecurity } from "../actions";
import { ActionForm } from "@/components/ui/action-form";

export interface RoleValues {
  id: string;
  name: string;
  note: string;
  locked: boolean;
  news_scope: string;
  approval_scope: string;
}

export function RoleForm({ role }: { role: RoleValues | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveRole, { ok: false });
  const errors = state.fieldErrors ?? {};
  const prefix = role ? `role-${role.id}` : "role-new";
  return (
    <ActionForm action={action} className="grid gap-4">
      <input type="hidden" name="is_new" value={role ? "false" : "true"} />
      {role ? <input type="hidden" name="id" value={role.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${prefix}-name`} label="Name" required errors={errors.name}>
          <Input
            id={`${prefix}-name`}
            name="name"
            required
            maxLength={60}
            defaultValue={role?.name}
          />
        </FormField>
        {!role ? (
          <FormField id={`${prefix}-id`} label="Identifier" required errors={errors.id}>
            <Input
              id={`${prefix}-id`}
              name="id"
              required
              maxLength={40}
              placeholder="e-g-lecturer"
            />
          </FormField>
        ) : null}
        <FormField
          id={`${prefix}-news`}
          label="Whose articles they edit"
          errors={errors.news_scope}
        >
          <Select id={`${prefix}-news`} name="news_scope" defaultValue={role?.news_scope ?? "none"}>
            <option value="none">none</option>
            <option value="own">own only</option>
            <option value="all">all</option>
          </Select>
        </FormField>
        <FormField
          id={`${prefix}-approval`}
          label="What they approve"
          errors={errors.approval_scope}
        >
          <Select
            id={`${prefix}-approval`}
            name="approval_scope"
            defaultValue={role?.approval_scope ?? "none"}
          >
            <option value="none">nothing</option>
            <option value="assigned">assigned countries and authors</option>
            <option value="global">everything</option>
          </Select>
        </FormField>
      </div>
      <FormField id={`${prefix}-note`} label="Role description" errors={errors.note}>
        <Textarea
          id={`${prefix}-note`}
          name="note"
          maxLength={500}
          rows={2}
          defaultValue={role?.note}
        />
      </FormField>
      <ActionStatus state={state} />
      <div>
        <SubmitButton size="sm">{role ? "Save role" : "Create role"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SecurityForm({
  settings,
  roles,
}: {
  settings: {
    session_hours: number;
    lock_after: number;
    invite_only: boolean;
    require_2fa_roles: string[];
  };
  roles: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveSecurity, { ok: false });
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="session_hours" label="Session length (hours)" errors={errors.session_hours}>
          <Input
            id="session_hours"
            name="session_hours"
            type="number"
            min={1}
            max={720}
            defaultValue={settings.session_hours}
          />
        </FormField>
        <FormField id="lock_after" label="Lock after failed attempts" errors={errors.lock_after}>
          <Input
            id="lock_after"
            name="lock_after"
            type="number"
            min={1}
            max={20}
            defaultValue={settings.lock_after}
          />
        </FormField>
      </div>
      <Checkbox
        name="invite_only"
        defaultChecked={settings.invite_only}
        label="Team by invitation only (and only from allowed addresses, if the list is filled in)"
      />
      <fieldset>
        <legend className="mb-1 text-[12.5px] font-medium text-[var(--color-ink-soft)]">
          Roles that require two-factor authentication (TOTP)
        </legend>
        <div className="grid sm:grid-cols-2">
          {roles.map((role) => (
            <Checkbox
              key={role.id}
              name="require_2fa_roles"
              value={role.id}
              defaultChecked={settings.require_2fa_roles.includes(role.id)}
              label={role.name}
            />
          ))}
        </div>
      </fieldset>
      <ActionStatus state={state} />
      <div>
        <SubmitButton size="sm">Save settings</SubmitButton>
      </div>
    </ActionForm>
  );
}
