"use client";

import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { FormField, Input, Textarea, describedBy } from "@/components/ui/field";
import { saveFlagNote, saveMaintenanceMessage } from "../actions";
import type { FlagRow, MaintenanceMessage } from "../editorial";
import { MAINTENANCE_LIMITS, type MaintenanceNotice } from "../maintenance";

/**
 * Maintenance title and text the public site shows while the maintenance
 * switch is on. Blank fields use the built-in wording (shown as placeholder).
 */
export function MaintenanceMessageForm({
  message,
  builtIn,
}: {
  message: MaintenanceMessage;
  builtIn: MaintenanceNotice;
}) {
  const [state, action] = useServerAction(saveMaintenanceMessage);
  const errors = state.fieldErrors ?? {};
  const hint = "Leave empty to use the built-in wording shown in grey.";
  return (
    <ActionForm action={action} className="grid max-w-2xl gap-5">
      <FormField id="maintenance_title" label="Title" hint={hint} errors={errors.maintenance_title}>
        <Input
          id="maintenance_title"
          name="maintenance_title"
          maxLength={MAINTENANCE_LIMITS.title}
          defaultValue={message.maintenance_title}
          placeholder={builtIn.title}
          {...describedBy("maintenance_title", { hint, errors: errors.maintenance_title })}
        />
      </FormField>
      <FormField id="maintenance_text" label="Text" hint={hint} errors={errors.maintenance_text}>
        <Textarea
          id="maintenance_text"
          name="maintenance_text"
          rows={4}
          maxLength={MAINTENANCE_LIMITS.text}
          defaultValue={message.maintenance_text}
          placeholder={builtIn.text}
          {...describedBy("maintenance_text", { hint, errors: errors.maintenance_text })}
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Saving…">Save message</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}

/** The admin note next to a switch: what it does and when to use it. */
export function FlagNoteForm({ flag }: { flag: FlagRow }) {
  const [state, action] = useServerAction(saveFlagNote);
  const errors = state.fieldErrors ?? {};
  const hint = "Shown in the list of switches — what it does and when to turn it on or off.";
  return (
    <ActionForm action={action} className="grid max-w-2xl gap-5">
      <input type="hidden" name="key" value={flag.key} />
      <FormField id="flag-note" label="Note" hint={hint} errors={errors.note}>
        <Textarea
          id="flag-note"
          name="note"
          rows={3}
          maxLength={300}
          defaultValue={flag.note}
          {...describedBy("flag-note", { hint, errors: errors.note })}
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Saving…">Save note</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}
