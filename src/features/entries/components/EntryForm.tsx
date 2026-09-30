"use client";

import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { CountryPicker, type CountryOption } from "@/components/admin/CountryPicker";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Checkbox, FormField, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { NEWS_CATEGORIES } from "@/lib/content-types";
import { slugify } from "@/lib/validation/common";
import { saveEntry } from "../actions";
import type { EditableEntry } from "../editorial";
import { ImageField } from "./ImageField";
import { RichTextEditor } from "./RichTextEditor";
import { ActionForm } from "@/components/ui/action-form";

interface Option {
  slug: string;
  name: string;
}

/** Editor novinky/hesla: metadata, země, obálka a text (Server Action `saveEntry`). */
export function EntryForm({
  entry,
  regions,
  issues,
  countries,
}: {
  entry: EditableEntry | null;
  regions: Option[];
  issues: Option[];
  countries: CountryOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveEntry, { ok: false });
  const [slug, setSlug] = useState(entry?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(entry));
  const errors = state.fieldErrors ?? {};
  const published = entry?.status === "published";
  const field = (id: string, hint?: string) => describedBy(id, { hint, errors: errors[id] });

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

      <FormField id="title" label="Titulek" required errors={errors.title}>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={entry?.title}
          onChange={(event) => {
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          {...field("title")}
        />
      </FormField>

      <FormField
        id="slug"
        label="Adresa (slug)"
        required
        hint={
          published
            ? "Zveřejněný článek adresu nemění — odkazy na něj už kolují."
            : `atlasoftodaysworld.org/news/${slug || "…"}`
        }
        errors={errors.slug}
      >
        <Input
          id="slug"
          name="slug"
          required
          maxLength={120}
          value={slug}
          readOnly={published}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          {...field("slug", "hint")}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="category" label="Kategorie" required errors={errors.category}>
          <Select id="category" name="category" defaultValue={entry?.category ?? ""} required>
            <option value="" disabled>
              Vyberte…
            </option>
            {NEWS_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </Select>
        </FormField>
        <FormField id="kind" label="Druh" errors={errors.kind}>
          <Select id="kind" name="kind" defaultValue={entry?.kind ?? "news"}>
            <option value="news">Novinka</option>
            <option value="entry">Encyklopedické heslo</option>
          </Select>
        </FormField>
        <FormField id="region_slug" label="Region" errors={errors.region_slug}>
          <Select id="region_slug" name="region_slug" defaultValue={entry?.region_slug ?? ""}>
            <option value="">— bez regionu —</option>
            {regions.map((region) => (
              <option key={region.slug} value={region.slug}>
                {region.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="special_slug" label="Global Issue" errors={errors.special_slug}>
          <Select id="special_slug" name="special_slug" defaultValue={entry?.special_slug ?? ""}>
            <option value="">— žádný —</option>
            {issues.map((issue) => (
              <option key={issue.slug} value={issue.slug}>
                {issue.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        id="countries"
        label="Země, kterých se článek týká"
        hint="Článek se ukáže v profilu každé z nich."
        errors={errors.countries}
      >
        <CountryPicker
          id="countries"
          name="countries"
          options={countries}
          defaultSelected={entry?.countries ?? []}
        />
      </FormField>

      <FormField
        id="summary"
        label="Perex"
        hint="Jedna až dvě věty; ukazují se v seznamech a vyhledávačích."
        errors={errors.summary}
      >
        <Textarea
          id="summary"
          name="summary"
          maxLength={600}
          rows={3}
          defaultValue={entry?.summary}
          {...field("summary", "hint")}
        />
      </FormField>

      <FormField id="cover_url" label="Titulní obrázek" errors={errors.cover_url}>
        <ImageField
          id="cover_url"
          name="cover_url"
          defaultValue={entry?.cover_url ?? ""}
          invalid={Boolean(errors.cover_url)}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField
          id="cover_credit"
          label="Autor fotky"
          className="sm:col-span-1"
          errors={errors.cover_credit}
        >
          <Input
            id="cover_credit"
            name="cover_credit"
            maxLength={300}
            defaultValue={entry?.cover_credit ?? ""}
          />
        </FormField>
        <FormField id="author_name" label="Autor textu" errors={errors.author_name}>
          <Input
            id="author_name"
            name="author_name"
            maxLength={120}
            defaultValue={entry?.author_name ?? ""}
          />
        </FormField>
        <FormField id="reading_minutes" label="Minut čtení" errors={errors.reading_minutes}>
          <Input
            id="reading_minutes"
            name="reading_minutes"
            type="number"
            min={1}
            max={180}
            defaultValue={entry?.reading_minutes ?? ""}
          />
        </FormField>
      </div>

      <div className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">Text</span>
        <RichTextEditor name="body_html" initialHtml={entry?.body_html ?? ""} label="Text článku" />
        {errors.body_html ? (
          <p className="text-[12px] text-red-700">{errors.body_html[0]}</p>
        ) : null}
      </div>

      {!entry || entry.status === "draft" || entry.status === "planned" ? (
        <Checkbox
          name="planned"
          defaultChecked={entry?.status === "planned"}
          label="Jen plánované téma (na portrétu šedá dlaždice, zatím se nepíše)"
        />
      ) : null}

      <ActionStatus state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{entry ? "Uložit změny" : "Vytvořit koncept"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
