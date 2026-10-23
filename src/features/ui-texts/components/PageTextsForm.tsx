"use client";

import { useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { describedBy, FormField, Input, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { MAX_TEXT_LENGTH, placeholders } from "../model";

interface PageTextsField {
  key: string;
  label: string;
  defaultText: string;
  /** The text the site shows now (the team's version, else the default). */
  value: string;
  /** `**bold**` works in this text. */
  rich: boolean;
}

export interface PageTextsGroup {
  id: string;
  title: string;
  note?: string;
  fields: PageTextsField[];
}

/** A text's DOM id (keys are dot paths). */
const fieldId = (key: string) => `text-${key.replace(/[^\w-]/g, "-")}`;

function fieldHint(field: PageTextsField): string | undefined {
  const required = placeholders(field.defaultText);
  const hints = [
    field.rich ? "**Double asterisks** make words bold." : null,
    required.length
      ? `Keep ${required.map((name) => `{${name}}`).join(", ")} — the site fills ${required.length > 1 ? "them" : "it"} in.`
      : null,
  ].filter(Boolean);
  return hints.length ? hints.join(" ") : undefined;
}

/**
 * A page's UI texts in one form, grouped by the page's sections: each text
 * pre-filled with what the site shows, its default next to a changed one and
 * a button to go back to it. Saving (`saveUiTexts`, RLS decides) stores the
 * changes and resets the texts set back to their defaults.
 */
export function PageTextsForm({
  groups,
  save,
}: {
  groups: PageTextsGroup[];
  save: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, action] = useServerAction(save);
  const errors = state.fieldErrors ?? {};
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.flatMap((group) => group.fields.map((f) => [f.key, f.value]))),
  );
  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <ActionForm action={action} className="grid gap-10">
      <nav aria-label="Sections of the page">
        <ul className="flex flex-wrap gap-2 text-[13px]">
          {groups.map((group) => (
            <li key={group.id}>
              <a
                href={`#group-${group.id}`}
                className="inline-block rounded-full border border-[var(--color-line)] px-3 py-1 hover:bg-[var(--color-surface-muted)]"
              >
                {group.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {groups.map((group) => (
        <section
          key={group.id}
          id={`group-${group.id}`}
          aria-labelledby={`group-${group.id}-title`}
          className="grid scroll-mt-20 gap-5"
        >
          <div>
            <h2 id={`group-${group.id}-title`} className="font-display text-[17px] font-bold">
              {group.title}
            </h2>
            {group.note ? (
              <p className="mt-1 text-[13px] text-[var(--color-ink-soft)]">{group.note}</p>
            ) : null}
          </div>
          {group.fields.map((field) => {
            const id = fieldId(field.key);
            const value = values[field.key] ?? field.value;
            const hint = fieldHint(field);
            const changed = value !== field.defaultText;
            const short = field.defaultText.length <= 70 && !field.defaultText.includes("\n");
            const control = {
              id,
              name: field.key,
              required: true,
              maxLength: MAX_TEXT_LENGTH,
              value,
              onChange: (event: { target: { value: string } }) =>
                set(field.key, event.target.value),
              className: cn(changed && "border-[var(--color-accent)]"),
              ...describedBy(id, { hint, errors: errors[field.key] }),
            };
            return (
              <div key={field.key} className="grid gap-1.5">
                <FormField
                  id={id}
                  label={field.label}
                  hint={hint}
                  required
                  errors={errors[field.key]}
                >
                  {short ? (
                    <Input {...control} />
                  ) : (
                    <Textarea
                      {...control}
                      rows={Math.min(8, Math.max(2, Math.ceil(field.defaultText.length / 90)))}
                    />
                  )}
                </FormField>
                {changed ? (
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-[var(--color-ink-muted)]">
                    <span>
                      Changed · default: <span className="italic">{field.defaultText}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => set(field.key, field.defaultText)}
                      className="text-[var(--color-link)] underline"
                    >
                      Use the default
                    </button>
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}

      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] bg-white/95 px-2 py-3 backdrop-blur">
        <SubmitButton>Save texts</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}
