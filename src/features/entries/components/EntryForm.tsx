"use client";

import { useEffect, useRef, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { CountryPicker, type CountryOption } from "@/components/admin/CountryPicker";
import { RegionSelect, type PlaceOption } from "@/components/admin/RegionSelect";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { Checkbox, FormField, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import {
  ARTICLE_KIND_LABEL,
  ARTICLE_KINDS,
  NEWS_CATEGORIES,
  type ArticleKind,
} from "@/lib/content-types";
import { SlugField, useSlug } from "@/components/admin/SlugField";
import { saveEntry } from "../actions";
import type { EditableEntry } from "@/features/entries/types";
import { UploadField } from "@/components/admin/UploadField";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { useDraftBackup } from "./useDraftBackup";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { MAP_LAYER_LABEL, MAP_LAYERS } from "../constants";
import { routes } from "@/config/routes";

/**
 * News/entry editor: metadata, countries, cover and text (Server Action `saveEntry`).
 * An encyclopedia entry (P9) also has summary bullets, audio and an author from a profile;
 * chapters and sources have their own editors below the form.
 */
export function EntryForm({
  entry,
  regions,
  issues,
  countries,
  authors,
  defaultKind = "entry",
}: {
  entry: EditableEntry | null;
  /** Type of a new item ("entry" = a topic, from the New topic button). */
  defaultKind?: ArticleKind;
  regions: PlaceOption[];
  issues: PlaceOption[];
  countries: CountryOption[];
  authors: { id: string; name: string }[];
}) {
  const [state, action] = useServerAction(saveEntry);
  const formRef = useRef<HTMLFormElement>(null);
  const backup = useDraftBackup(formRef, entry?.id ?? "new", entry?.updated_at ?? null);
  // Default field values: from the database, or from a restored backup (then the fields remount).
  const [values, setValues] = useState<Partial<EditableEntry> | null>(entry);
  const [generation, setGeneration] = useState(0);
  const slug = useSlug(entry?.slug);
  const [kind, setKind] = useState(entry?.kind ?? defaultKind);
  const isEntry = kind === "entry";
  const errors = state.fieldErrors ?? {};
  const published = entry?.status === "published";
  // A translation takes its address and kind from the original (G5.3).
  const translation = Boolean(entry?.translation_of);
  const field = (id: string, hint?: string) => describedBy(id, { hint, errors: errors[id] });
  const { clear } = backup;

  useEffect(() => {
    if (state.ok) clear();
  }, [state, clear]);

  const restore = () => {
    if (!backup.offer) return;
    const restored = { ...entry, ...backup.offer.values };
    setValues(restored);
    slug.restore(published ? undefined : (restored.slug ?? ""));
    if (restored.kind) setKind(restored.kind);
    setGeneration((n) => n + 1);
    backup.accept();
  };

  return (
    <ActionForm key={generation} ref={formRef} action={action} className="grid gap-5">
      {backup.offer ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px]"
        >
          <span>
            You have an unsaved draft from {new Date(backup.offer.savedAt).toLocaleString("en-GB")}.
          </span>
          <Button type="button" size="sm" onClick={restore}>
            Restore
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={backup.dismiss}>
            Discard
          </Button>
        </div>
      ) : null}
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

      <FormField
        id="title"
        label={isEntry ? "Header – title" : "Title"}
        hint={isEntry ? "The big heading over the header photo." : undefined}
        required
        errors={errors.title}
      >
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={values?.title}
          onChange={(event) => slug.follow(event.target.value)}
          {...field("title")}
        />
      </FormField>

      <SlugField
        slug={slug}
        hint={
          translation
            ? "A translation has the same URL as the original, just with a language prefix."
            : published
              ? "A published article keeps its URL — links to it are already out there."
              : `atlasoftodaysworld.org${routes.article(isEntry ? "entry" : "news", slug.value || "…")}`
        }
        errors={errors.slug}
        readOnly={published || translation}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="category" label="Category" required errors={errors.category}>
          <Select id="category" name="category" defaultValue={values?.category ?? ""} required>
            <option value="" disabled>
              Choose…
            </option>
            {NEWS_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </Select>
        </FormField>
        <FormField id="kind" label="Type" errors={errors.kind}>
          <Select
            id="kind"
            name="kind"
            value={kind}
            disabled={translation}
            onChange={(event) => setKind(event.target.value as ArticleKind)}
          >
            {/* News is no longer published (2026-10-17): only an old news item keeps the choice. */}
            {(entry?.kind === "news" ? ARTICLE_KINDS : (["entry"] as const)).map((value) => (
              <option key={value} value={value}>
                {ARTICLE_KIND_LABEL[value]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="region_slug" label="Region" errors={errors.region_slug}>
          <RegionSelect options={regions} defaultValue={values?.region_slug} />
        </FormField>
        <FormField
          id="special_slug"
          label="Global issue or custom region"
          errors={errors.special_slug}
        >
          <RegionSelect
            id="special_slug"
            options={issues}
            defaultValue={values?.special_slug}
            emptyLabel="— none —"
          />
        </FormField>
      </div>

      <FormField
        id="countries"
        label="Countries the article covers"
        hint="The article will appear in each country’s profile."
        errors={errors.countries}
      >
        <CountryPicker
          id="countries"
          name="countries"
          options={countries}
          defaultSelected={values?.countries ?? []}
        />
      </FormField>

      {isEntry ? (
        <fieldset className="grid gap-1">
          <legend className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
            Count on the map
          </legend>
          <p className="text-[12.5px] text-[var(--color-ink-muted)]">
            On which globe layers this entry adds to the number shown over its region, global issue
            or countries. A topic of a region also counts for each of its countries.
          </p>
          <input type="hidden" name="map_layers_shown" value="1" />
          <div className="flex flex-wrap gap-x-5">
            {MAP_LAYERS.map((layer) => (
              <Checkbox
                key={layer}
                name="map_layers"
                value={layer}
                label={MAP_LAYER_LABEL[layer]}
                defaultChecked={(values?.map_layers ?? MAP_LAYERS).includes(layer)}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <FormField
        id="summary"
        label={isEntry ? "Header – lead text" : "Summary"}
        hint={
          isEntry
            ? "The paragraph under the title in the header; also on the Entries list and in search engines."
            : "One or two sentences; shown in listings and search engines."
        }
        errors={errors.summary}
      >
        <Textarea
          id="summary"
          name="summary"
          maxLength={600}
          rows={3}
          defaultValue={values?.summary}
          {...field("summary", "hint")}
        />
      </FormField>

      {isEntry ? (
        <>
          <FormField
            id="summary_points"
            label="Key points box (under the header)"
            hint="3–5 points, one per line."
            errors={errors.summary_points}
          >
            <Textarea
              id="summary_points"
              name="summary_points"
              rows={5}
              defaultValue={values?.summary_points?.join("\n")}
              {...field("summary_points", "hint")}
            />
          </FormField>
          <FormField
            id="author_id"
            label="Author (profile)"
            hint="Byline under the header and the bio at the end come from the profile (Author profiles)."
            errors={errors.author_id}
          >
            <Select id="author_id" name="author_id" defaultValue={values?.author_id ?? ""}>
              <option value="">— no profile —</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </Select>
          </FormField>
        </>
      ) : null}

      <FormField
        id="cover_url"
        label={isEntry ? "Header – background photo" : "Cover image"}
        errors={errors.cover_url}
      >
        <UploadField
          id="cover_url"
          name="cover_url"
          defaultValue={values?.cover_url ?? ""}
          invalid={Boolean(errors.cover_url)}
        />
      </FormField>

      {isEntry ? (
        <FormField id="hero_background" label="Header – background colour">
          <ColorField
            id="hero_background"
            name="hero_background"
            defaultValue={values?.hero_background ?? null}
            label="Use a colour (shown without a photo, or while it loads)"
          />
        </FormField>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField
          id="cover_credit"
          label={isEntry ? "Header – photo credit" : "Photo credit"}
          className="sm:col-span-1"
          errors={errors.cover_credit}
        >
          <Input
            id="cover_credit"
            name="cover_credit"
            maxLength={300}
            defaultValue={values?.cover_credit ?? ""}
          />
        </FormField>
        <FormField id="author_name" label="Text author" errors={errors.author_name}>
          <Input
            id="author_name"
            name="author_name"
            maxLength={120}
            defaultValue={values?.author_name ?? ""}
          />
        </FormField>
        <FormField id="reading_minutes" label="Reading time (min)" errors={errors.reading_minutes}>
          <Input
            id="reading_minutes"
            name="reading_minutes"
            type="number"
            min={1}
            max={180}
            defaultValue={values?.reading_minutes ?? ""}
          />
        </FormField>
      </div>

      <div className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
          {isEntry ? "Introduction text (between the key points and the tiles, optional)" : "Text"}
        </span>
        <RichTextEditor
          name="body_html"
          initialHtml={values?.body_html ?? ""}
          label="Article text"
        />
        {errors.body_html ? (
          <p className="text-[12px] text-red-700">{errors.body_html[0]}</p>
        ) : null}
      </div>

      {!entry || entry.status === "draft" || entry.status === "planned" ? (
        <Checkbox
          name="planned"
          defaultChecked={values?.status === "planned"}
          label="Planned entry only (gray tile on the portrait, not being written yet)"
        />
      ) : null}

      <ActionStatus state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{entry ? "Save changes" : "Create draft"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
