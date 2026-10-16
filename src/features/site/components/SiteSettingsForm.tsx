"use client";

import { type ComponentProps } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { describedBy, FormField, Input, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { saveSiteSettings } from "../actions";

/** What the form starts from: the saved row, or the built-in values when it is missing. */
export interface SettingsValues {
  name: string;
  alternate_names: readonly string[];
  legal_name: string;
  company_id: string;
  founding_date: string;
  street_address: string;
  postal_code: string;
  address_locality: string;
  address_country: string;
  description: string;
  wikidata_id: string | null;
  contact_email: string;
  seo_title: string;
  title_suffix: string;
  seo_description: string;
  og_image_url: string;
  copyright: string;
}

type Errors = ActionState["fieldErrors"];

/** One labelled field; `multiline` = textarea. Errors and hint are tied to the control. */
function Field({
  name,
  label,
  hint,
  errors,
  required = false,
  multiline = false,
  ...control
}: {
  name: keyof SettingsValues;
  label: string;
  hint?: string;
  errors: Errors;
  required?: boolean;
  multiline?: boolean;
} & Omit<ComponentProps<"input"> & ComponentProps<"textarea">, "name">) {
  const id = `site-${name}`;
  const fieldErrors = errors?.[name];
  const props = {
    id,
    name,
    required,
    ...describedBy(id, { hint, errors: fieldErrors }),
    ...control,
  };
  return (
    <FormField id={id} label={label} hint={hint} errors={fieldErrors} required={required}>
      {multiline ? (
        <Textarea {...(props as ComponentProps<"textarea">)} />
      ) : (
        <Input {...(props as ComponentProps<"input">)} />
      )}
    </FormField>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-2xl border border-[var(--color-line)] p-5">
      <legend className="font-display px-1 text-[16px] font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Site settings: the publisher's facts (structured data, About, llms.txt,
 * feeds), the one contact address, search and sharing defaults and the footer.
 */
export function SiteSettingsForm({
  values,
  canEdit,
}: {
  values: SettingsValues;
  canEdit: boolean;
}) {
  const [state, action] = useServerAction(saveSiteSettings);
  const errors = state.fieldErrors;
  return (
    <ReadOnly readOnly={!canEdit} reason="You can see the site settings but not change them.">
      <ActionForm action={action} className="grid gap-6">
        <Group title="Organisation">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="name"
              label="Name"
              hint="The site's brand: header of structured data, feeds, breadcrumbs."
              required
              maxLength={120}
              defaultValue={values.name}
              errors={errors}
            />
            <Field
              name="legal_name"
              label="Legal name"
              required
              maxLength={200}
              defaultValue={values.legal_name}
              errors={errors}
            />
          </div>
          <Field
            name="alternate_names"
            label="Alternate names"
            hint="One per line, at most 10 (e.g. spellings people search for)."
            multiline
            rows={3}
            defaultValue={values.alternate_names.join("\n")}
            errors={errors}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              name="company_id"
              label="Company ID (IČO)"
              required
              inputMode="numeric"
              maxLength={8}
              defaultValue={values.company_id}
              errors={errors}
            />
            <Field
              name="founding_date"
              label="Founded"
              type="date"
              required
              defaultValue={values.founding_date}
              errors={errors}
            />
            <Field
              name="wikidata_id"
              label="Wikidata item"
              hint="E.g. Q106194019; empty = none."
              maxLength={13}
              defaultValue={values.wikidata_id ?? ""}
              errors={errors}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field
              name="street_address"
              label="Street address"
              required
              maxLength={200}
              defaultValue={values.street_address}
              errors={errors}
            />
            <Field
              name="postal_code"
              label="Postal code"
              required
              maxLength={20}
              defaultValue={values.postal_code}
              errors={errors}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field
              name="address_locality"
              label="Town"
              required
              maxLength={120}
              defaultValue={values.address_locality}
              errors={errors}
            />
            <Field
              name="address_country"
              label="Country code"
              hint="Two letters, e.g. CZ."
              required
              maxLength={2}
              defaultValue={values.address_country}
              errors={errors}
            />
          </div>
          <Field
            name="description"
            label="About the organisation"
            hint="Used in structured data and at the top of llms.txt."
            multiline
            required
            maxLength={500}
            defaultValue={values.description}
            errors={errors}
          />
          <Field
            name="contact_email"
            label="Contact e-mail"
            hint="The one public address: About, privacy, terms, accessibility, Atlas Patrons FAQ, feeds."
            type="email"
            required
            maxLength={254}
            defaultValue={values.contact_email}
            errors={errors}
          />
        </Group>

        <Group title="Search and sharing">
          <Field
            name="seo_title"
            label="Default title"
            hint="Home page and pages without their own title (about 60 characters show in search)."
            required
            maxLength={120}
            defaultValue={values.seo_title}
            errors={errors}
          />
          <Field
            name="title_suffix"
            label="Title suffix"
            hint="Added after every page title, after a space (e.g. “— Atlas of Today's World”). Empty = none."
            maxLength={80}
            defaultValue={values.title_suffix}
            errors={errors}
          />
          <Field
            name="seo_description"
            label="Default description"
            hint="Search result text of pages without their own (about 160 characters show)."
            multiline
            required
            maxLength={300}
            defaultValue={values.seo_description}
            errors={errors}
          />
          <Field
            name="og_image_url"
            label="Default preview image"
            hint="Shown when a page is shared: an https:// address or a path on this site (/og-image.png), 1200 × 630 px."
            required
            maxLength={1000}
            defaultValue={values.og_image_url}
            errors={errors}
          />
        </Group>

        <Group title="Footer">
          <Field
            name="copyright"
            label="Copyright line"
            required
            maxLength={200}
            defaultValue={values.copyright}
            errors={errors}
          />
        </Group>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>Save settings</SubmitButton>
            <ActionStatus state={state} />
          </div>
        ) : null}
      </ActionForm>
    </ReadOnly>
  );
}
