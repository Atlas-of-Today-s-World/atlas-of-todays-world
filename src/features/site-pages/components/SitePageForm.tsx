"use client";

import { ActionStatus } from "@/components/admin/ActionStatus";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { Checkbox, FormField, Input, Textarea, describedBy } from "@/components/ui/field";
import { saveSitePage } from "../actions";
import { SITE_PAGE_LIMITS, type SitePageContent } from "../pages";

/**
 * Editing one site page: title and description (search results), "Last
 * updated" date, lead, body and the published switch. Saving publishes right
 * away; every save is kept in the page's history.
 */
export function SitePageForm({ page, published }: { page: SitePageContent; published: boolean }) {
  const [state, action] = useServerAction(saveSitePage);
  const errors = state.fieldErrors ?? {};
  const field = (id: string, hint?: string) => describedBy(id, { hint, errors: errors[id] });

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      <input type="hidden" name="slug" value={page.slug} />

      <FormField id="title" label="Title" required errors={errors.title}>
        <Input
          id="title"
          name="title"
          required
          maxLength={SITE_PAGE_LIMITS.title}
          defaultValue={page.title}
          {...field("title")}
        />
      </FormField>

      <FormField
        id="description"
        label="Description"
        required
        hint="One or two sentences for search results and link previews."
        errors={errors.description}
      >
        <Textarea
          id="description"
          name="description"
          rows={2}
          required
          maxLength={SITE_PAGE_LIMITS.description}
          defaultValue={page.description}
          {...field("description", "hint")}
        />
      </FormField>

      <FormField
        id="last_reviewed"
        label="Last updated"
        hint="Shown under the title as “Last updated …”. Leave empty to hide it."
        errors={errors.last_reviewed}
      >
        <Input
          id="last_reviewed"
          name="last_reviewed"
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          defaultValue={page.last_reviewed ?? ""}
          className="max-w-56"
          {...field("last_reviewed", "hint")}
        />
      </FormField>

      <FormField
        id="lead"
        label="Introduction"
        hint="Optional plain-text paragraph under the title."
        errors={errors.lead}
      >
        <Textarea
          id="lead"
          name="lead"
          rows={3}
          maxLength={SITE_PAGE_LIMITS.lead}
          defaultValue={page.lead}
          {...field("lead", "hint")}
        />
      </FormField>

      <div className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">Text</span>
        <RichTextEditor name="body_html" initialHtml={page.body_html} label="Page text" sitePaths />
        {errors.body_html ? (
          <p className="text-[12px] text-[var(--color-danger)]">{errors.body_html[0]}</p>
        ) : null}
      </div>

      <Checkbox
        name="published"
        defaultChecked={published}
        label="Published (when off, the website shows the built-in text of this page)"
      />

      <ActionStatus state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
