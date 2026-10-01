"use client";

import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { FormField, Input, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { saveTranslations } from "../actions";
import { FIELD_LABELS } from "../labels";

/** Fields that are long text in the original (multi-line input). */
const LONG = new Set(["summary", "blurb", "profile_html", "description"]);

/**
 * Translation of one unit: for each field the English original and a translation input.
 * Empty field = no translation (the site shows English).
 */
export function TranslationForm({
  entity,
  entityKey,
  locale,
  fields,
}: {
  entity: string;
  entityKey: string;
  locale: string;
  fields: { field: string; original: string; value: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveTranslations, { ok: false });
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-6">
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="key" value={entityKey} />
      <input type="hidden" name="locale" value={locale} />
      {fields.map(({ field, original, value }) => {
        const id = `field-${field}`;
        return (
          <FormField
            key={field}
            id={id}
            label={FIELD_LABELS[field] ?? field}
            hint={
              original
                ? `Original: ${original.slice(0, 400)}${original.length > 400 ? "…" : ""}`
                : "Empty in the original."
            }
            errors={errors.fields}
          >
            {LONG.has(field) ? (
              <Textarea
                id={id}
                name={`field.${field}`}
                rows={field === "profile_html" ? 10 : 4}
                defaultValue={value}
              />
            ) : (
              <Input id={id} name={`field.${field}`} defaultValue={value} />
            )}
          </FormField>
        );
      })}
      <ActionStatus state={state} />
      <div>
        <SubmitButton>Save translation</SubmitButton>
      </div>
    </ActionForm>
  );
}
