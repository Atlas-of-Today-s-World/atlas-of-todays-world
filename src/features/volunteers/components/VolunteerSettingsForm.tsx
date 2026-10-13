"use client";

import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { FormField, Input } from "@/components/ui/field";
import { saveVolunteerSettings } from "../actions";

/** The address new volunteer applications will be e-mailed to. */
export function VolunteerSettingsForm({
  email,
  canEdit,
}: {
  email: string | null;
  canEdit: boolean;
}) {
  const [state, action] = useServerAction(saveVolunteerSettings);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm
      action={action}
      className="grid max-w-2xl gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
    >
      <FormField
        id="notify_email"
        label="Send new applications to"
        hint="E-mail sending is not switched on yet — until then, applications are only listed below."
        errors={errors.notify_email}
      >
        <Input
          id="notify_email"
          name="notify_email"
          type="email"
          maxLength={254}
          defaultValue={email ?? ""}
          placeholder="editors@atlasoftodaysworld.org"
          disabled={!canEdit}
        />
      </FormField>
      {canEdit ? <SubmitButton size="sm">Save</SubmitButton> : null}
      <div className="sm:col-span-2">
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}
