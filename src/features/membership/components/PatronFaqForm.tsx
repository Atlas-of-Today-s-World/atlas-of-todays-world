"use client";

import { useRouter } from "next/navigation";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { Checkbox, FormField, Input, describedBy } from "@/components/ui/field";
import { adminRoutes } from "@/config/routes";
import { deletePatronFaq, savePatronFaq } from "../admin-actions";
import { EMAIL_PLACEHOLDER } from "../config";
import type { PatronFaqRow } from "@/features/membership/types";

const ANSWER_HINT = `Up to 3,000 characters of formatted text. Write {${EMAIL_PLACEHOLDER}} where the contact e-mail address should appear as a link.`;

/** One question of the membership page FAQ (new or existing). */
export function PatronFaqForm({ item }: { item: PatronFaqRow | null }) {
  const [state, action] = useServerAction(savePatronFaq);
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <FormField id="question" label="Question" required errors={errors.question}>
        <Input
          id="question"
          name="question"
          required
          maxLength={300}
          defaultValue={item?.question}
          {...describedBy("question", { errors: errors.question })}
        />
      </FormField>

      <div className="grid gap-1.5">
        <RichTextEditor name="answer_html" label="Answer" initialHtml={item?.answer_html ?? ""} />
        <p className="text-[12px] text-[var(--color-ink-muted)]">{ANSWER_HINT}</p>
        {errors.answer_html?.length ? (
          <p role="alert" className="text-[12px] text-[var(--color-danger)]">
            {errors.answer_html[0]}
          </p>
        ) : null}
      </div>

      <Checkbox
        name="visible"
        defaultChecked={item?.visible ?? true}
        label="Show on the membership page"
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Saving…">{item ? "Save changes" : "Add question"}</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}

export function DeletePatronFaq({ id, question }: { id: string; question: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete question"
      variant="danger"
      title={`Delete the question “${question}”?`}
      body="It disappears from the membership page and its FAQ for search engines. This cannot be undone."
      confirm="Delete"
      action={() => deletePatronFaq(id)}
      onDone={(state) => {
        if (state.ok) router.push(adminRoutes.patrons);
      }}
    />
  );
}
