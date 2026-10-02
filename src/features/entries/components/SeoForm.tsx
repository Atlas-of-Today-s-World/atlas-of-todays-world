"use client";

import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, FormField, Input, Textarea, describedBy } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { saveEntrySeo } from "../actions";
import { GEO_SUMMARY_MAX, SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from "../constants";
import type { EditableSeo } from "../editorial";
import { UploadField } from "./UploadField";

/** Characters used / allowed; turns amber close to the limit search engines show. */
function Counter({ value, max }: { value: string; max: number }) {
  const near = value.length > max * 0.9;
  return (
    <span
      aria-hidden
      className={`text-[11.5px] tabular-nums ${near ? "text-amber-700" : "text-[var(--color-ink-muted)]"}`}
    >
      {value.length}/{max}
    </span>
  );
}

/**
 * SEO & GEO of a dossier. Every field is optional: left empty, the site uses
 * a default derived from the article (shown as the placeholder), so writers
 * only override what they want to tune.
 */
export function SeoForm({
  entryId,
  seo,
  defaults,
}: {
  entryId: string;
  seo: EditableSeo;
  defaults: { title: string; description: string };
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveEntrySeo, { ok: false });
  const errors = state.fieldErrors ?? {};
  const [title, setTitle] = useState(seo.seo_title);
  const [description, setDescription] = useState(seo.seo_description);
  const [geo, setGeo] = useState(seo.geo_summary);
  const shownTitle = title || defaults.title;
  const shownDescription = description || defaults.description;

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      <input type="hidden" name="entry_id" value={entryId} />

      <section aria-labelledby="seo-preview" className="rounded-xl bg-[var(--color-line)]/25 p-4">
        <h3 id="seo-preview" className="text-[12px] font-medium text-[var(--color-ink-muted)]">
          Search result preview
        </h3>
        <p className="mt-2 truncate text-[17px] text-[#1a0dab]">
          {shownTitle} — Atlas of Today&apos;s World
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-[var(--color-ink-soft)]">
          {shownDescription}
        </p>
      </section>

      <FormField
        id="seo_title"
        label="SEO title"
        hint={`Empty = the article title. Up to ${SEO_TITLE_MAX} characters; put the key phrase first.`}
        errors={errors.seo_title}
      >
        <Input
          id="seo_title"
          name="seo_title"
          maxLength={SEO_TITLE_MAX}
          value={title}
          placeholder={defaults.title}
          onChange={(event) => setTitle(event.target.value)}
          {...describedBy("seo_title", { hint: "hint", errors: errors.seo_title })}
        />
        <Counter value={title} max={SEO_TITLE_MAX} />
      </FormField>

      <FormField
        id="seo_description"
        label="Meta description"
        hint="Empty = the summary, shortened. One or two sentences that answer why to read it."
        errors={errors.seo_description}
      >
        <Textarea
          id="seo_description"
          name="seo_description"
          rows={3}
          maxLength={SEO_DESCRIPTION_MAX}
          value={description}
          placeholder={defaults.description}
          onChange={(event) => setDescription(event.target.value)}
          {...describedBy("seo_description", { hint: "hint", errors: errors.seo_description })}
        />
        <Counter value={description} max={SEO_DESCRIPTION_MAX} />
      </FormField>

      <FormField
        id="seo_keywords"
        label="Keywords"
        hint="Comma-separated, at most 12. Used in structured data, not stuffed into the text."
        errors={errors.seo_keywords}
      >
        <Input
          id="seo_keywords"
          name="seo_keywords"
          defaultValue={seo.seo_keywords.join(", ")}
          placeholder="migrant smuggling, irregular migration, Mediterranean route"
          {...describedBy("seo_keywords", { hint: "hint", errors: errors.seo_keywords })}
        />
      </FormField>

      <FormField
        id="geo_summary"
        label="In short (GEO)"
        hint="2–4 self-contained sentences that answer the topic's main question with facts and a source. AI search engines quote passages like this; it is shown at the top of the dossier."
        errors={errors.geo_summary}
      >
        <Textarea
          id="geo_summary"
          name="geo_summary"
          rows={5}
          maxLength={GEO_SUMMARY_MAX}
          value={geo}
          onChange={(event) => setGeo(event.target.value)}
          {...describedBy("geo_summary", { hint: "hint", errors: errors.geo_summary })}
        />
        <Counter value={geo} max={GEO_SUMMARY_MAX} />
      </FormField>

      <FormField
        id="og_image_url"
        label="Social sharing image"
        hint="Empty = the cover image. 1200×630 px works everywhere."
        errors={errors.og_image_url}
      >
        <UploadField id="og_image_url" name="og_image_url" defaultValue={seo.og_image_url} />
      </FormField>

      <Checkbox
        name="noindex"
        defaultChecked={seo.noindex}
        label="Hide from search engines (noindex) — e.g. a dossier still being completed"
      />

      <ActionStatus state={state} />
      <div>
        <SubmitButton size="sm">Save SEO &amp; GEO</SubmitButton>
      </div>
    </ActionForm>
  );
}
