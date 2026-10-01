"use client";

import { useActionState, useState } from "react";
import { GROUP_KIND_LABEL } from "../constants";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { CountryPicker, type CountryOption } from "@/components/admin/CountryPicker";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Checkbox, FormField, Input, Select, Textarea } from "@/components/ui/field";
import { UploadField } from "@/features/entries/components/UploadField";
import { RichTextEditor } from "@/features/entries/components/RichTextEditor";
import type { ActionState } from "@/lib/actions";
import { slugify } from "@/lib/validation/common";
import { saveCountry, saveIssue, saveRegion } from "../actions";
import { ActionForm } from "@/components/ui/action-form";

type Errors = Record<string, string[] | undefined>;

function useSave(action: (prev: ActionState, data: FormData) => Promise<ActionState>) {
  return useActionState<ActionState, FormData>(action, { ok: false });
}

/** Barva výplně a obrysu celku na globusu. */
function ColorFields({ fill, stroke, errors }: { fill: string; stroke: string; errors: Errors }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      <FormField id="fill" label="Map fill" required errors={errors.fill}>
        <Input id="fill" name="fill" type="color" defaultValue={fill} className="h-11 p-1" />
      </FormField>
      <FormField id="stroke" label="Outline" required errors={errors.stroke}>
        <Input id="stroke" name="stroke" type="color" defaultValue={stroke} className="h-11 p-1" />
      </FormField>
    </div>
  );
}

/** Hlavička portrétu (fotka, úvod, nadpis časové osy) — společná pro region i issue. */
function PortraitHead({
  values,
  errors,
}: {
  values: {
    summary: string;
    intro: string;
    hero_url: string | null;
    hero_credit: string;
    timeline_title: string | null;
    timeline_subtitle: string | null;
  };
  errors: Errors;
}) {
  return (
    <>
      <FormField
        id="summary"
        label="Summary"
        hint="Shown in the map panel and in search engines until the editors write an intro."
        errors={errors.summary}
      >
        <Textarea
          id="summary"
          name="summary"
          maxLength={1000}
          rows={3}
          defaultValue={values.summary}
        />
      </FormField>
      <FormField id="intro" label="Portrait intro" errors={errors.intro}>
        <Textarea id="intro" name="intro" maxLength={5000} rows={6} defaultValue={values.intro} />
      </FormField>
      <FormField id="hero_url" label="Header photo" errors={errors.hero_url}>
        <UploadField id="hero_url" name="hero_url" defaultValue={values.hero_url ?? ""} />
      </FormField>
      <FormField id="hero_credit" label="Photo credit" errors={errors.hero_credit}>
        <Input
          id="hero_credit"
          name="hero_credit"
          maxLength={300}
          defaultValue={values.hero_credit}
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="timeline_title" label="Timeline heading" errors={errors.timeline_title}>
          <Input
            id="timeline_title"
            name="timeline_title"
            maxLength={120}
            defaultValue={values.timeline_title ?? ""}
            placeholder="How the present came about"
          />
        </FormField>
        <FormField id="timeline_subtitle" label="Subheading" errors={errors.timeline_subtitle}>
          <Input
            id="timeline_subtitle"
            name="timeline_subtitle"
            maxLength={300}
            defaultValue={values.timeline_subtitle ?? ""}
          />
        </FormField>
      </div>
    </>
  );
}

export function RegionForm({
  region,
}: {
  region: {
    slug: string;
    name: string;
    tagline: string;
    summary: string;
    intro: string;
    hero_url: string | null;
    hero_credit: string;
    fill: string;
    stroke: string;
    timeline_title: string | null;
    timeline_subtitle: string | null;
  };
}) {
  const [state, action] = useSave(saveRegion);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      <input type="hidden" name="slug" value={region.slug} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="name" label="Name" required errors={errors.name}>
          <Input id="name" name="name" required maxLength={120} defaultValue={region.name} />
        </FormField>
        <FormField id="tagline" label="Subtitle" errors={errors.tagline}>
          <Input id="tagline" name="tagline" maxLength={200} defaultValue={region.tagline} />
        </FormField>
      </div>
      <ColorFields fill={region.fill} stroke={region.stroke} errors={errors} />
      <PortraitHead values={region} errors={errors} />
      <ActionStatus state={state} />
      <div>
        <SubmitButton>Save region</SubmitButton>
      </div>
    </ActionForm>
  );
}

export interface IssueValues {
  kind: "issue" | "region";
  slug: string;
  name: string;
  subtitle: string;
  summary: string;
  intro: string;
  hero_url: string | null;
  hero_credit: string;
  fill: string;
  stroke: string;
  center_lon: number;
  center_lat: number;
  zoom: number;
  timeline_title: string | null;
  timeline_subtitle: string | null;
  countries: string[];
}

export function IssueForm({
  issue,
  countries,
  defaultKind = "issue",
}: {
  issue: IssueValues | null;
  countries: CountryOption[];
  /** Typ nové skupiny (tlačítko „New custom region" / „New global issue"). */
  defaultKind?: "issue" | "region";
}) {
  const [state, action] = useSave(saveIssue);
  const [slug, setSlug] = useState(issue?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(issue));
  const errors = state.fieldErrors ?? {};
  const values: IssueValues = issue ?? {
    kind: defaultKind,
    slug: "",
    name: "",
    subtitle: "",
    summary: "",
    intro: "",
    hero_url: null,
    hero_credit: "",
    fill: "#e8a0b4",
    stroke: "#b3476a",
    center_lon: 20,
    center_lat: 30,
    zoom: 2.6,
    timeline_title: null,
    timeline_subtitle: null,
    countries: [],
  };

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      {issue ? <input type="hidden" name="original_slug" value={issue.slug} /> : null}
      <fieldset className="grid gap-2">
        <legend className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">Type</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="region"
              defaultChecked={values.kind === "region"}
            />
            {GROUP_KIND_LABEL.region}
            <span className="text-[12px] text-[var(--color-ink-muted)]">
              — your own region from selected countries
            </span>
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="issue"
              defaultChecked={values.kind !== "region"}
            />
            {GROUP_KIND_LABEL.issue}
            <span className="text-[12px] text-[var(--color-ink-muted)]">
              — a topic across regions (war, migration, climate…)
            </span>
          </label>
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="name" label="Name" required errors={errors.name}>
          <Input
            id="name"
            name="name"
            required
            maxLength={120}
            defaultValue={values.name}
            onChange={(event) => {
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
        </FormField>
        <FormField
          id="slug"
          label="URL (slug)"
          required
          hint={`/global-issue/${slug || "…"}`}
          errors={errors.slug}
        >
          <Input
            id="slug"
            name="slug"
            required
            maxLength={120}
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
          />
        </FormField>
      </div>
      <FormField id="subtitle" label="Subtitle" errors={errors.subtitle}>
        <Input id="subtitle" name="subtitle" maxLength={200} defaultValue={values.subtitle} />
      </FormField>
      <FormField
        id="countries"
        label="Countries in this group"
        hint="Pick any countries — a group can freely cross Atlas region boundaries."
        errors={errors.countries}
      >
        <CountryPicker
          id="countries"
          name="countries"
          options={countries}
          defaultSelected={values.countries}
        />
      </FormField>
      <ColorFields fill={values.fill} stroke={values.stroke} errors={errors} />
      <div className="grid grid-cols-3 gap-5">
        <FormField id="center_lon" label="Center – longitude" required errors={errors.center_lon}>
          <Input
            id="center_lon"
            name="center_lon"
            type="number"
            step="0.1"
            min={-180}
            max={180}
            defaultValue={values.center_lon}
          />
        </FormField>
        <FormField id="center_lat" label="Center – latitude" required errors={errors.center_lat}>
          <Input
            id="center_lat"
            name="center_lat"
            type="number"
            step="0.1"
            min={-90}
            max={90}
            defaultValue={values.center_lat}
          />
        </FormField>
        <FormField id="zoom" label="Zoom" required errors={errors.zoom}>
          <Input
            id="zoom"
            name="zoom"
            type="number"
            step="0.1"
            min={0.5}
            max={9}
            defaultValue={values.zoom}
          />
        </FormField>
      </div>
      <PortraitHead values={values} errors={errors} />
      <ActionStatus state={state} />
      <div>
        <SubmitButton>
          {issue ? "Save" : `Create ${GROUP_KIND_LABEL[values.kind].toLowerCase()}`}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CountryForm({
  country,
  regions,
  indicators,
}: {
  country: {
    iso3: string;
    name: string;
    region_slug: string | null;
    blurb: string | null;
    tagline: string;
    profile_html: string;
    featured_indicators: string[];
  };
  regions: { slug: string; name: string }[];
  indicators: { id: string; label: string }[];
}) {
  const [state, action] = useSave(saveCountry);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      <input type="hidden" name="iso3" value={country.iso3} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="region_slug"
          label="Atlas region"
          hint="Without a region, the country has no profile."
          errors={errors.region_slug}
        >
          <Select id="region_slug" name="region_slug" defaultValue={country.region_slug ?? ""}>
            <option value="">— no region —</option>
            {regions.map((region) => (
              <option key={region.slug} value={region.slug}>
                {region.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="tagline" label="Subtitle" errors={errors.tagline}>
          <Input id="tagline" name="tagline" maxLength={300} defaultValue={country.tagline} />
        </FormField>
      </div>
      <FormField
        id="blurb"
        label="Summary"
        hint="One or two sentences under the name. Without them, a sentence is built from imported data."
        errors={errors.blurb}
      >
        <Textarea
          id="blurb"
          name="blurb"
          maxLength={1000}
          rows={3}
          defaultValue={country.blurb ?? ""}
        />
      </FormField>
      <fieldset className="grid gap-1">
        <legend className="mb-1 text-[12.5px] font-medium text-[var(--color-ink-soft)]">
          Automatic indicators on the card (none selected = first six)
        </legend>
        <div className="grid sm:grid-cols-2">
          {indicators.map((indicator) => (
            <Checkbox
              key={indicator.id}
              name="featured_indicators"
              value={indicator.id}
              defaultChecked={country.featured_indicators.includes(indicator.id)}
              label={indicator.label}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">Long text</span>
        <RichTextEditor
          name="profile_html"
          initialHtml={country.profile_html}
          label={`Profile text – ${country.name}`}
        />
      </div>
      <ActionStatus state={state} />
      <div>
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}
