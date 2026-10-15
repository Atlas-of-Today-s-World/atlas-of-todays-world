"use client";

import { useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { describedBy, FormField, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { MAX_TEXT_LENGTH, placeholders } from "../model";

/**
 * One UI text: the team's version in a textarea, the default next to it, the
 * placeholders it must keep and a live character count. "Reset to default"
 * deletes the team's version. Saving / resetting is `saveUiText` /
 * `resetUiText` (Server Actions, RLS decides); this form only follows the rules.
 */
export function UiTextForm({
  textKey,
  defaultText,
  value: saved,
  changed,
  save,
  reset,
  canSave,
  canReset,
}: {
  textKey: string;
  defaultText: string;
  /** The text the site shows now (the team's version, else the default). */
  value: string;
  /** Has the team changed this text (a row exists)? */
  changed: boolean;
  save: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  reset: () => Promise<ActionState>;
  canSave: boolean;
  canReset: boolean;
}) {
  // The status line shows the latest result: of a save, or of a reset.
  const [resetState, setResetState] = useState<ActionState | null>(null);
  const [state, action] = useServerAction(async (prev, formData) => {
    const result = await save(prev, formData);
    setResetState(null);
    return result;
  });
  const [value, setValue] = useState(saved);
  const errors = state.fieldErrors ?? {};
  const required = placeholders(defaultText);
  const missing = required.filter((name) => !value.includes(`{${name}}`));
  const length = value.replace(/\r\n?/g, "\n").length;
  const hint = required.length
    ? `Keep these placeholders — the site fills them in: ${required.map((name) => `{${name}}`).join(", ")}.`
    : "Plain text only, no HTML.";

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-4">
      <input type="hidden" name="key" value={textKey} />

      <section
        aria-labelledby="ui-text-default"
        className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-muted)] p-4"
      >
        <h2 id="ui-text-default" className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
          Default text (en.json)
        </h2>
        <p className="mt-1 text-[14px] whitespace-pre-wrap">{defaultText}</p>
      </section>

      <FormField
        id="ui-text-value"
        label="Text on the site"
        hint={hint}
        required
        errors={errors.value}
      >
        <Textarea
          id="ui-text-value"
          name="value"
          required
          rows={Math.min(12, Math.max(3, Math.ceil(defaultText.length / 70)))}
          maxLength={MAX_TEXT_LENGTH}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          readOnly={!canSave}
          {...describedBy("ui-text-value", { hint, errors: errors.value })}
        />
      </FormField>

      <p
        aria-live="polite"
        className={cn(
          "-mt-2 text-[12px] text-[var(--color-ink-muted)]",
          (length > MAX_TEXT_LENGTH || missing.length > 0) && "text-[var(--color-danger)]",
        )}
      >
        {length} / {MAX_TEXT_LENGTH} characters
        {missing.length
          ? ` · missing placeholder${missing.length > 1 ? "s" : ""}: ${missing.map((name) => `{${name}}`).join(", ")}`
          : ""}
        {value.includes("<") ? " · the “<” character isn't allowed" : ""}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {canSave ? <SubmitButton>Save text</SubmitButton> : null}
        {canReset && changed ? (
          <ConfirmButton
            label="Reset to default"
            title="Reset this text to its default?"
            body="The site shows the built-in text from en.json again. Your version is deleted."
            confirm="Reset"
            action={reset}
            onDone={(result) => {
              setResetState(result);
              if (result.ok) setValue(defaultText);
            }}
          />
        ) : null}
        <ActionStatus state={resetState ?? state} />
      </div>
    </ActionForm>
  );
}
