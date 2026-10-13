"use client";

import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { FormField, Select } from "@/components/ui/field";
import { addHomePin, saveHomeSettings } from "../actions";
import { FEATURED_COUNT } from "../config";

export interface SubtopicOption {
  id: string;
  title: string;
  topicTitle: string;
}

const COUNTS = Array.from(
  { length: FEATURED_COUNT.max - FEATURED_COUNT.min + 1 },
  (_, index) => FEATURED_COUNT.min + index,
);

/** How many tiles the home map shows (home_settings). */
export function HomeCountForm({ count, canEdit }: { count: number; canEdit: boolean }) {
  const [state, action] = useServerAction(saveHomeSettings);
  return (
    <ActionForm action={action} className="flex max-w-3xl flex-wrap items-end gap-3">
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

/** Pins one more subtopic (of a published topic) at the end of the list. */
export function AddPinForm({ options }: { options: SubtopicOption[] }) {
  const [state, action] = useServerAction(addHomePin);
  const topics = [...new Set(options.map((option) => option.topicTitle))];
  return (
    <ActionForm action={action} className="flex max-w-3xl flex-wrap items-end gap-3">
      <FormField
        id="chapter_id"
        label="Pin a subtopic"
        errors={state.fieldErrors?.chapter_id}
        className="min-w-0 flex-1 basis-72"
      >
        <Select id="chapter_id" name="chapter_id" required defaultValue="">
          <option value="" disabled>
            {options.length ? "Choose a subtopic…" : "Every published subtopic is pinned"}
          </option>
          {topics.map((topic) => (
            <optgroup key={topic} label={topic}>
              {options
                .filter((option) => option.topicTitle === topic)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </FormField>
      <div className="flex flex-wrap items-center gap-3 pb-0.5">
        <SubmitButton size="sm">Pin</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}
