"use client";

import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { FormField, Select } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { saveHomeFeatured } from "../actions";

export interface SubtopicOption {
  id: string;
  title: string;
  topicTitle: string;
}

/** Two slots; each either a chosen subtopic or "newest" (filled automatically). */
export function HomeFeaturedForm({
  options,
  first,
  second,
  canEdit,
}: {
  options: SubtopicOption[];
  first: string | null;
  second: string | null;
  canEdit: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveHomeFeatured, { ok: false });
  const errors = state.fieldErrors ?? {};
  const topics = [...new Set(options.map((option) => option.topicTitle))];
  const select = (name: "first_chapter" | "second_chapter", value: string | null) => (
    <Select id={name} name={name} defaultValue={value ?? ""} disabled={!canEdit}>
      <option value="">Newest subtopic (automatic)</option>
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
  );
  return (
    <ActionForm action={action} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <FormField id="first_chapter" label="First tile" errors={errors.first_chapter}>
        {select("first_chapter", first)}
      </FormField>
      <FormField id="second_chapter" label="Second tile" errors={errors.second_chapter}>
        {select("second_chapter", second)}
      </FormField>
      {canEdit ? (
        <div className="sm:col-span-2">
          <SubmitButton size="sm">Save</SubmitButton>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}
