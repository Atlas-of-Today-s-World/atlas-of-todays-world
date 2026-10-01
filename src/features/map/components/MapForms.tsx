"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormField, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { slugify } from "@/lib/validation/common";
import { deleteArea, saveArea, saveTheme } from "../actions";
import { ActionForm } from "@/components/ui/action-form";

/** Posuvník s číselnou hodnotou vedle (sytost, hranice). */
function Range({
  id,
  label,
  hint,
  min,
  max,
  defaultValue,
}: {
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  defaultValue: number;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <FormField id={id} label={`${label}: ${value.toFixed(2)}×`} hint={hint}>
      <input
        id={id}
        name={id}
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="min-h-(--touch-min) w-full accent-[var(--color-accent)]"
      />
    </FormField>
  );
}

export function ThemeForm({ saturation, border }: { saturation: number; border: number }) {
  const [state, action] = useActionState<ActionState, FormData>(saveTheme, { ok: false });
  return (
    <ActionForm action={action} className="grid max-w-xl gap-6">
      <Range
        id="saturation"
        label="Layer color saturation"
        hint="Applies to regions, indicators and global issues. 1 = original colors."
        min={0.2}
        max={2}
        defaultValue={saturation}
      />
      <Range
        id="border"
        label="Border weight"
        hint="Thickness of country borders and area outlines."
        min={0.4}
        max={2.2}
        defaultValue={border}
      />
      <ActionStatus state={state} />
      <div>
        <SubmitButton>Save appearance</SubmitButton>
      </div>
    </ActionForm>
  );
}

export interface AreaValues {
  slug: string;
  name: string;
  label: string;
  note: string;
  fill: string;
  stroke: string;
  country_iso3: string | null;
  geometry: unknown;
}

export function AreaForm({
  area,
  countries,
}: {
  area: AreaValues | null;
  countries: { iso3: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveArea, { ok: false });
  const [slug, setSlug] = useState(area?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(area));
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      {area ? <input type="hidden" name="original_slug" value={area.slug} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="name" label="Name" required errors={errors.name}>
          <Input
            id="name"
            name="name"
            required
            maxLength={120}
            defaultValue={area?.name}
            onChange={(event) => {
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
        </FormField>
        <FormField id="slug" label="Identifier" required errors={errors.slug}>
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
        <FormField id="label" label="Map label" hint="Empty = name." errors={errors.label}>
          <Input id="label" name="label" maxLength={60} defaultValue={area?.label} />
        </FormField>
        <FormField id="country_iso3" label="Country (optional)" errors={errors.country_iso3}>
          <Select id="country_iso3" name="country_iso3" defaultValue={area?.country_iso3 ?? ""}>
            <option value="">—</option>
            {countries.map((country) => (
              <option key={country.iso3} value={country.iso3}>
                {country.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="fill" label="Fill" required errors={errors.fill}>
          <Input
            id="fill"
            name="fill"
            type="color"
            className="p-1"
            defaultValue={area?.fill ?? "#e0a040"}
          />
        </FormField>
        <FormField id="stroke" label="Outline" required errors={errors.stroke}>
          <Input
            id="stroke"
            name="stroke"
            type="color"
            className="p-1"
            defaultValue={area?.stroke ?? "#a06010"}
          />
        </FormField>
      </div>
      <FormField id="note" label="Note" errors={errors.note}>
        <Textarea id="note" name="note" maxLength={1000} rows={2} defaultValue={area?.note} />
      </FormField>
      <FormField
        id="geometry"
        label="Shape (GeoJSON Polygon)"
        required
        hint="Draw it e.g. on geojson.io and paste it here. One closed ring, at most 2000 points."
        errors={errors.geometry}
      >
        <Textarea
          id="geometry"
          name="geometry"
          required
          rows={8}
          className="font-mono text-[12px]"
          defaultValue={area ? JSON.stringify(area.geometry) : ""}
        />
      </FormField>
      <ActionStatus state={state} />
      <div>
        <SubmitButton>{area ? "Save map area" : "Create map area"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteArea({ slug }: { slug: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete"
      variant="danger"
      title="Delete area from the map?"
      body="The area disappears from the globe. Articles linked to it remain."
      confirm="Delete"
      action={() => deleteArea(slug)}
      onDone={(state) => {
        if (state.ok) router.push("/admin/areas");
      }}
    />
  );
}
