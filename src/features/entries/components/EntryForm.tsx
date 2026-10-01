"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { CountryPicker, type CountryOption } from "@/components/admin/CountryPicker";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Button } from "@/components/ui/button";
import { Checkbox, FormField, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { NEWS_CATEGORIES } from "@/lib/content-types";
import { slugify } from "@/lib/validation/common";
import { saveEntry } from "../actions";
import type { EditableEntry } from "../editorial";
import { UploadField } from "./UploadField";
import { RichTextEditor } from "./RichTextEditor";
import { useDraftBackup } from "./useDraftBackup";
import { ActionForm } from "@/components/ui/action-form";

interface Option {
  slug: string;
  name: string;
}

/**
 * Editor novinky/hesla: metadata, země, obálka a text (Server Action `saveEntry`).
 * Encyklopedické heslo (P9) má navíc odrážky shrnutí, zvuk a autora z profilu;
 * kapitoly a zdroje mají vlastní editory pod formulářem.
 */
export function EntryForm({
  entry,
  regions,
  issues,
  countries,
  authors,
}: {
  entry: EditableEntry | null;
  regions: Option[];
  issues: Option[];
  countries: CountryOption[];
  authors: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveEntry, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);
  const backup = useDraftBackup(formRef, entry?.id ?? "new", entry?.updated_at ?? null);
  // Výchozí hodnoty polí: z databáze, nebo z obnovené zálohy (pak se pole přemontují).
  const [values, setValues] = useState<Partial<EditableEntry> | null>(entry);
  const [generation, setGeneration] = useState(0);
  const [slug, setSlug] = useState(entry?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(entry));
  const [kind, setKind] = useState(entry?.kind ?? "news");
  const isEntry = kind === "entry";
  const errors = state.fieldErrors ?? {};
  const published = entry?.status === "published";
  const field = (id: string, hint?: string) => describedBy(id, { hint, errors: errors[id] });
  const { clear } = backup;

  useEffect(() => {
    if (state.ok) clear();
  }, [state, clear]);

  const restore = () => {
    if (!backup.offer) return;
    const restored = { ...entry, ...backup.offer.values };
    setValues(restored);
    if (!published) setSlug(restored.slug ?? "");
    if (restored.kind) setKind(restored.kind);
    setSlugTouched(true);
    setGeneration((n) => n + 1);
    backup.accept();
  };

  return (
    <ActionForm key={generation} ref={formRef} action={action} className="grid max-w-3xl gap-5">
      {backup.offer ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px]"
        >
          <span>
            Máte neuloženou rozepsanou verzi z{" "}
            {new Date(backup.offer.savedAt).toLocaleString("cs-CZ")}.
          </span>
          <Button type="button" size="sm" onClick={restore}>
            Obnovit
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={backup.dismiss}>
            Zahodit
          </Button>
        </div>
      ) : null}
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

      <FormField id="title" label="Titulek" required errors={errors.title}>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={values?.title}
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
            : `atlasoftodaysworld.org/${isEntry ? "entry" : "news"}/${slug || "…"}`
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
          <Select id="category" name="category" defaultValue={values?.category ?? ""} required>
            <option value="" disabled>
              Vyberte…
            </option>
            {NEWS_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </Select>
        </FormField>
        <FormField id="kind" label="Druh" errors={errors.kind}>
          <Select
            id="kind"
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as "news" | "entry")}
          >
            <option value="news">Novinka</option>
            <option value="entry">Encyklopedické heslo</option>
          </Select>
        </FormField>
        <FormField id="region_slug" label="Region" errors={errors.region_slug}>
          <Select id="region_slug" name="region_slug" defaultValue={values?.region_slug ?? ""}>
            <option value="">— bez regionu —</option>
            {regions.map((region) => (
              <option key={region.slug} value={region.slug}>
                {region.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="special_slug" label="Global Issue" errors={errors.special_slug}>
          <Select id="special_slug" name="special_slug" defaultValue={values?.special_slug ?? ""}>
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
          defaultSelected={values?.countries ?? []}
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
          defaultValue={values?.summary}
          {...field("summary", "hint")}
        />
      </FormField>

      {isEntry ? (
        <>
          <FormField
            id="summary_points"
            label="Shrnutí v odrážkách"
            hint="3–5 odrážek, každá na vlastní řádek. Ukazují se v hlavičce hesla."
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
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="author_id"
              label="Autor (profil)"
              hint="Fotka, životopis a positionality se berou z profilu (sekce Autoři)."
              errors={errors.author_id}
            >
              <Select id="author_id" name="author_id" defaultValue={values?.author_id ?? ""}>
                <option value="">— bez profilu —</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              id="audio_url"
              label="Zvuková verze"
              hint="MP3, M4A/AAC, Ogg/Opus, WAV nebo FLAC do 50 MB. Na webu se přehrávač ukáže jen se stopou."
              errors={errors.audio_url}
            >
              <UploadField
                id="audio_url"
                name="audio_url"
                kind="audio"
                defaultValue={values?.audio_url ?? ""}
                invalid={Boolean(errors.audio_url)}
              />
            </FormField>
          </div>
        </>
      ) : null}

      <FormField id="cover_url" label="Titulní obrázek" errors={errors.cover_url}>
        <UploadField
          id="cover_url"
          name="cover_url"
          defaultValue={values?.cover_url ?? ""}
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
            defaultValue={values?.cover_credit ?? ""}
          />
        </FormField>
        <FormField id="author_name" label="Autor textu" errors={errors.author_name}>
          <Input
            id="author_name"
            name="author_name"
            maxLength={120}
            defaultValue={values?.author_name ?? ""}
          />
        </FormField>
        <FormField id="reading_minutes" label="Minut čtení" errors={errors.reading_minutes}>
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
          {isEntry ? "Úvod hesla (před kapitolami, nepovinný)" : "Text"}
        </span>
        <RichTextEditor
          name="body_html"
          initialHtml={values?.body_html ?? ""}
          label="Text článku"
        />
        {errors.body_html ? (
          <p className="text-[12px] text-red-700">{errors.body_html[0]}</p>
        ) : null}
      </div>

      {!entry || entry.status === "draft" || entry.status === "planned" ? (
        <Checkbox
          name="planned"
          defaultChecked={values?.status === "planned"}
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
