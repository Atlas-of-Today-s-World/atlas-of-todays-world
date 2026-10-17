"use client";

import {
  CONTENT_STATUS_LABEL,
  FEATURED_MAX,
  REGION_PROGRESS_LABEL,
  GROUP_KIND_LABEL,
  GROUP_KIND_OPTION,
} from "../constants";
import { ActionStatus } from "@/components/admin/ActionStatus";
import {
  CountryPicker,
  type CountryGroups,
  type CountryOption,
} from "@/components/admin/CountryPicker";
import { OrderedPicker } from "@/components/admin/OrderedPicker";
import { RegionSelect, type PlaceOption } from "@/components/admin/RegionSelect";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormField, Input, Select, Textarea } from "@/components/ui/field";
import { UploadField } from "@/components/admin/UploadField";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SlugField, useSlug } from "@/components/admin/SlugField";
import { saveCountry, saveIssue, saveRegion } from "../actions";
import {
  CONTENT_STATUSES,
  REGION_PROGRESS,
  regionProgress,
  type ContentStatus,
} from "@/features/geography/content-status";
import type { GroupKind } from "@/features/geography/kinds";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { routes } from "@/config/routes";

type Errors = Record<string, string[] | undefined>;

/** Fill and outline colour of the unit on the globe. */
function ColorFields({ fill, stroke, errors }: { fill: string; stroke: string; errors: Errors }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      <FormField id="fill" label="Map fill" required errors={errors.fill}>
        <Input
          id="fill"
          name="fill"
          type="color"
          defaultValue={fill}
          className="h-(--touch-min) p-1"
        />
      </FormField>
      <FormField id="stroke" label="Outline" required errors={errors.stroke}>
        <Input
          id="stroke"
          name="stroke"
          type="color"
          defaultValue={stroke}
          className="h-(--touch-min) p-1"
        />
      </FormField>
    </div>
  );
}

/** Where the globe turns when the place opens (the same ranges as the DB CHECKs). */
function MapViewFields({
  values,
  errors,
}: {
  values: { center_lon: number; center_lat: number; zoom: number };
  errors: Errors;
}) {
  return (
    <div className="grid grid-cols-3 gap-5">
      <FormField id="center_lon" label="Center – longitude" required errors={errors.center_lon}>
        <Input
          id="center_lon"
          name="center_lon"
          type="number"
          step="0.1"
          min={-180}
          max={180}
          required
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
          required
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
          required
          defaultValue={values.zoom}
        />
      </FormField>
    </div>
  );
}

/**
 * A region's content: planned for the future or completed. Drives the colour
 * and mark of the topic pills of the region and its countries on the globe,
 * the grey fill of planned regions and the badge in the portrait. The list of
 * regions has the same switch in one click.
 */
function RegionProgressField({ value }: { value: string }) {
  const current = regionProgress(value);
  return (
    <fieldset className="grid gap-2">
      <legend className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">Content</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
        {REGION_PROGRESS.map((progress) => (
          <label key={progress} className="flex min-h-(--touch-min) items-center gap-2">
            <input
              type="radio"
              name="content_progress"
              value={progress}
              defaultChecked={current === progress}
            />
            {REGION_PROGRESS_LABEL[progress]}
          </label>
        ))}
      </div>
      <p className="text-[12px] text-[var(--color-ink-muted)]">
        Shown on the globe (the pills of the region and its countries) and in the portrait header,
        so visitors see what is done and what needs support.
      </p>
    </fieldset>
  );
}

/**
 * How far a global issue's content is: drives the mark next to its topic count
 * on the globe and the badge in the portrait.
 */
function ContentStatusField({ value, errors }: { value: string; errors: Errors }) {
  return (
    <FormField
      id="content_status"
      label="Content status"
      hint="Shown on the globe and in the portrait header, so visitors see what is done and what needs support."
      errors={errors.content_status}
    >
      <Select id="content_status" name="content_status" defaultValue={value}>
        {CONTENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {CONTENT_STATUS_LABEL[status]}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

/** Portrait header (photo, intro) — shared by region and issue. The timeline has its own editor. */
function PortraitHead({
  values,
  errors,
}: {
  values: {
    summary: string;
    intro: string;
    hero_url: string | null;
    hero_credit: string;
  };
  errors: Errors;
}) {
  return (
    <>
      <FormField
        id="summary"
        label="Summary"
        hint="A region: in its map panel until the editors write an intro. A global issue: the lead under the title of its page. Both: in search engines."
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
      <FormField
        id="intro"
        label="Portrait intro"
        hint="The opening paragraphs below the header."
        errors={errors.intro}
      >
        <Textarea id="intro" name="intro" maxLength={5000} rows={6} defaultValue={values.intro} />
      </FormField>
      <FormField
        id="hero_url"
        label="Header photo"
        hint="Behind the title. A global issue without one gets a wash of its map fill colour."
        errors={errors.hero_url}
      >
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
    center_lon: number;
    center_lat: number;
    zoom: number;
    content_progress: string;
  };
}) {
  const [state, action] = useServerAction(saveRegion);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-5">
      <input type="hidden" name="slug" value={region.slug} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="name" label="Name" required errors={errors.name}>
          <Input id="name" name="name" required maxLength={120} defaultValue={region.name} />
        </FormField>
        <FormField
          id="tagline"
          label="Subtitle"
          hint="Under the name in the portrait and on the Countries page."
          errors={errors.tagline}
        >
          <Input id="tagline" name="tagline" maxLength={200} defaultValue={region.tagline} />
        </FormField>
      </div>
      <ColorFields fill={region.fill} stroke={region.stroke} errors={errors} />
      <MapViewFields values={region} errors={errors} />
      <RegionProgressField value={region.content_progress} />
      <PortraitHead values={region} errors={errors} />
      <ActionStatus state={state} />
      <div>
        <SubmitButton>Save region</SubmitButton>
      </div>
    </ActionForm>
  );
}

export interface IssueValues {
  kind: GroupKind;
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
  content_status: ContentStatus;
  countries: string[];
}

export function IssueForm({
  issue,
  countries,
  groups,
  defaultKind = "issue",
}: {
  issue: IssueValues | null;
  countries: CountryOption[];
  /** Regions and custom regions whose countries can be added or removed at once. */
  groups?: CountryGroups[];
  /** Type of the new group (button „New custom region" / „New global issue"). */
  defaultKind?: GroupKind;
}) {
  const [state, action] = useServerAction(saveIssue);
  const slug = useSlug(issue?.slug);
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
    content_status: "none",
    countries: [],
  };

  return (
    <ActionForm action={action} className="grid gap-5">
      {issue ? <input type="hidden" name="original_slug" value={issue.slug} /> : null}
      <fieldset className="grid gap-2">
        <legend className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">Type</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          <label className="flex min-h-(--touch-min) items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="region"
              defaultChecked={values.kind === "region"}
            />
            {GROUP_KIND_OPTION.region}
            <span className="text-[12px] text-[var(--color-ink-muted)]">
              — your own selection, not tied to a theme
            </span>
          </label>
          <label className="flex min-h-(--touch-min) items-center gap-2">
            <input
              type="radio"
              name="kind"
              value="issue"
              defaultChecked={values.kind !== "region"}
            />
            {GROUP_KIND_OPTION.issue}
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
            onChange={(event) => slug.follow(event.target.value)}
          />
        </FormField>
        <SlugField slug={slug} hint={routes.issue(slug.value || "…")} errors={errors.slug} />
      </div>
      <FormField id="subtitle" label="Subtitle" errors={errors.subtitle}>
        <Input id="subtitle" name="subtitle" maxLength={200} defaultValue={values.subtitle} />
      </FormField>
      <FormField
        id="countries"
        label="Countries in this group"
        hint="Pick any countries — a group can freely cross Atlas region boundaries. To assign it to a whole region or custom region, add all of its countries at once below."
        errors={errors.countries}
      >
        <CountryPicker
          id="countries"
          name="countries"
          options={countries}
          defaultSelected={values.countries}
          groups={groups}
        />
      </FormField>
      <ColorFields fill={values.fill} stroke={values.stroke} errors={errors} />
      <MapViewFields values={values} errors={errors} />
      <ContentStatusField value={values.content_status} errors={errors} />
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

/**
 * The country's facts: imported first (Natural Earth), corrected here. The map
 * position and outline are not — they come with the map geometry.
 */
function CountryFacts({
  country,
  subregions,
  territoryStatus,
  errors,
}: {
  country: {
    name: string;
    name_formal: string | null;
    population: number | null;
    un_subregion: string | null;
    territory_note: string | null;
  };
  subregions: string[];
  territoryStatus: string | null;
  errors: Errors;
}) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="name"
          label="Name"
          required
          hint="In headings, lists and search. An abbreviated name (“Dem. Rep. Congo”) is spelled out from the formal name; the label on the globe comes with the map."
          errors={errors.name}
        >
          <Input id="name" name="name" required maxLength={120} defaultValue={country.name} />
        </FormField>
        <FormField id="name_formal" label="Formal name" errors={errors.name_formal}>
          <Input
            id="name_formal"
            name="name_formal"
            maxLength={200}
            defaultValue={country.name_formal ?? ""}
          />
        </FormField>
        <FormField
          id="population"
          label="Population"
          hint="Totals of regions and groups, and the order of lists, follow it."
          errors={errors.population}
        >
          <Input
            id="population"
            name="population"
            type="number"
            min={0}
            max={20_000_000_000}
            step={1}
            defaultValue={country.population ?? ""}
          />
        </FormField>
        <FormField id="un_subregion" label="UN subregion" errors={errors.un_subregion}>
          <Input
            id="un_subregion"
            name="un_subregion"
            maxLength={60}
            list="un-subregions"
            defaultValue={country.un_subregion ?? ""}
          />
        </FormField>
        <datalist id="un-subregions">
          {subregions.map((subregion) => (
            <option key={subregion} value={subregion} />
          ))}
        </datalist>
      </div>
      <FormField
        id="territory_note"
        label="Status note"
        hint={
          territoryStatus
            ? `Shown in a box on the profile after the status from the map data (“${territoryStatus}”). Say what the border shows and on what basis. Empty = the note that comes with the map data.`
            : "For a territory whose status or border needs explaining. Shown in a box on the profile; empty = none."
        }
        errors={errors.territory_note}
      >
        <Textarea
          id="territory_note"
          name="territory_note"
          maxLength={1000}
          rows={3}
          defaultValue={country.territory_note ?? ""}
        />
      </FormField>
    </>
  );
}

export function CountryForm({
  country,
  regions,
  indicators,
  subregions,
  territoryStatus,
}: {
  country: {
    iso3: string;
    name: string;
    name_formal: string | null;
    population: number | null;
    un_subregion: string | null;
    territory_note: string | null;
    region_slug: string | null;
    blurb: string | null;
    tagline: string;
    profile_html: string;
    featured_indicators: string[];
  };
  regions: PlaceOption[];
  indicators: { id: string; label: string }[];
  /** UN subregions already in use (suggestions for the field). */
  subregions: string[];
  /** Status of the territory from the map data ("disputed"…), if it has one. */
  territoryStatus: string | null;
}) {
  const [state, action] = useServerAction(saveCountry);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-5">
      <input type="hidden" name="iso3" value={country.iso3} />
      <CountryFacts
        country={country}
        subregions={subregions}
        territoryStatus={territoryStatus}
        errors={errors}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="region_slug"
          label="Atlas region"
          hint="Without a region, the country has no profile."
          errors={errors.region_slug}
        >
          <RegionSelect options={regions} defaultValue={country.region_slug} />
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
      <FormField
        id="featured_indicators"
        label="Automatic indicators on the card"
        hint={`Up to ${FEATURED_MAX}, in the order the card shows them. None chosen = the first ${FEATURED_MAX} data layers.`}
        errors={errors.featured_indicators}
      >
        <OrderedPicker
          id="featured_indicators"
          name="featured_indicators"
          options={indicators.map(({ id, label }) => ({ value: id, label }))}
          defaultSelected={country.featured_indicators}
          max={FEATURED_MAX}
          itemLabel="indicator"
        />
      </FormField>
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
