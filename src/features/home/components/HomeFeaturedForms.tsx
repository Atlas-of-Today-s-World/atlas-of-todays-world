"use client";

import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { FormField, Select } from "@/components/ui/field";
import { saveHomeSettings } from "../actions";
import { FEATURED_COUNT } from "../config";

const COUNTS = Array.from(
  { length: FEATURED_COUNT.max - FEATURED_COUNT.min + 1 },
  (_, index) => FEATURED_COUNT.min + index,
);

/** How many of the newest entries the home map shows (home_settings). */
export function HomeCountForm({ count, canEdit }: { count: number; canEdit: boolean }) {
  const [state, action] = useServerAction(saveHomeSettings);
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-3">
      <FormField
        id="featured_count"
        label="Tiles on the home map"
        errors={state.fieldErrors?.featured_count}
      >
        <Select
          id="featured_count"
          name="featured_count"
          defaultValue={String(count)}
          disabled={!canEdit}
          className="w-28"
        >
          {COUNTS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </FormField>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3 pb-0.5">
          <SubmitButton size="sm">Save</SubmitButton>
          <ActionStatus state={state} />
        </div>
      ) : null}
    </ActionForm>
  );
}
