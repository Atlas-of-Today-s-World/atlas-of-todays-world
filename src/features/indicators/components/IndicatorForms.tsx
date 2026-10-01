"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Button } from "@/components/ui/button";
import { Checkbox, FormField, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { saveCategories, saveIndicator, setValue } from "../actions";
import { ActionForm } from "@/components/ui/action-form";

export interface IndicatorValues {
  id: string;
  label: string;
  short_label: string;
  description: string;
  unit: string;
  decimals: number;
  source: string;
  source_url: string | null;
  type: "sequential" | "categorical";
  scale: "linear" | "log";
  domain_min: number | null;
  domain_max: number | null;
  ramp: string[];
  higher_is_better: boolean;
}

const NEW: IndicatorValues = {
  id: "",
  label: "",
  short_label: "",
  description: "",
  unit: "",
  decimals: 1,
  source: "",
  source_url: null,
  type: "sequential",
  scale: "linear",
  domain_min: 0,
  domain_max: 100,
  ramp: ["#eef2f7", "#1d3a8a"],
  higher_is_better: true,
};

/** Indicator description and scale; for a new one also id and kind (unchangeable after creation). */
export function IndicatorForm({ indicator }: { indicator: IndicatorValues | null }) {
  const values = indicator ?? NEW;
  const [state, action] = useActionState<ActionState, FormData>(saveIndicator, { ok: false });
  const [type, setType] = useState(values.type);
  const [ramp, setRamp] = useState(values.ramp.length ? values.ramp : NEW.ramp);
  const errors = state.fieldErrors ?? {};

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      <input type="hidden" name="is_new" value={indicator ? "false" : "true"} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="label" label="Name" required errors={errors.label}>
          <Input id="label" name="label" required maxLength={120} defaultValue={values.label} />
        </FormField>
        <FormField
          id="id"
          label="Identifier"
          required
          hint={
            indicator
              ? "Can't be changed after creation."
              : "URL /view/…, lowercase letters and hyphens."
          }
          errors={errors.id}
        >
          <Input
            id="id"
            name="id"
            required
            maxLength={60}
            defaultValue={values.id}
            readOnly={Boolean(indicator)}
          />
        </FormField>
        <FormField id="short_label" label="Short name" errors={errors.short_label}>
          <Input
            id="short_label"
            name="short_label"
            maxLength={60}
            defaultValue={values.short_label}
          />
        </FormField>
        <FormField
          id="type"
          label="Type"
          hint={indicator ? "Can't be changed after creation." : undefined}
        >
          {indicator ? (
            <>
              <input type="hidden" name="type" value={values.type} />
              <Input
                id="type"
                readOnly
                value={values.type === "categorical" ? "Categories" : "Continuous scale"}
              />
            </>
          ) : (
            <Select
              id="type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as IndicatorValues["type"])}
            >
              <option value="sequential">Continuous scale</option>
              <option value="categorical">Categories</option>
            </Select>
          )}
        </FormField>
      </div>
      <FormField id="description" label="Description" errors={errors.description}>
        <Textarea
          id="description"
          name="description"
          maxLength={1000}
          rows={3}
          defaultValue={values.description}
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="source" label="Source" errors={errors.source}>
          <Input id="source" name="source" maxLength={200} defaultValue={values.source} />
        </FormField>
        <FormField id="source_url" label="Source link" errors={errors.source_url}>
          <Input
            id="source_url"
            name="source_url"
            inputMode="url"
            placeholder="https://…"
            defaultValue={values.source_url ?? ""}
          />
        </FormField>
        <FormField id="unit" label="Unit (after the number)" errors={errors.unit}>
          <Input id="unit" name="unit" maxLength={20} defaultValue={values.unit} />
        </FormField>
        <FormField id="decimals" label="Decimal places" errors={errors.decimals}>
          <Input
            id="decimals"
            name="decimals"
            type="number"
            min={0}
            max={4}
            defaultValue={values.decimals}
          />
        </FormField>
      </div>

      {type === "sequential" ? (
        <fieldset className="grid gap-4 rounded-xl border border-[var(--color-line)] p-4">
          <legend className="px-1 text-[13px] font-medium">Scale & palette</legend>
          <div className="grid gap-5 sm:grid-cols-3">
            <FormField id="scale" label="Scale type" errors={errors.scale}>
              <Select id="scale" name="scale" defaultValue={values.scale}>
                <option value="linear">Linear</option>
                <option value="log">Logarithmic</option>
              </Select>
            </FormField>
            <FormField id="domain_min" label="From" errors={errors.domain_min}>
              <Input
                id="domain_min"
                name="domain_min"
                type="number"
                step="any"
                defaultValue={values.domain_min ?? ""}
              />
            </FormField>
            <FormField id="domain_max" label="To" errors={errors.domain_max}>
              <Input
                id="domain_max"
                name="domain_max"
                type="number"
                step="any"
                defaultValue={values.domain_max ?? ""}
              />
            </FormField>
          </div>
          <div className="grid gap-2">
            <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
              Colors from lowest to highest value
            </span>
            <div
              aria-hidden
              className="h-3 rounded-full"
              style={{ background: `linear-gradient(to right, ${ramp.join(", ")})` }}
            />
            <div className="flex flex-wrap items-center gap-2">
              {ramp.map((color, index) => (
                <span key={index} className="flex items-center">
                  <input
                    type="color"
                    name="ramp"
                    value={color}
                    aria-label={`Color ${index + 1}`}
                    onChange={(event) =>
                      setRamp((current) =>
                        current.map((c, i) => (i === index ? event.target.value : c)),
                      )
                    }
                    className="h-11 w-12 cursor-pointer rounded-lg border border-[var(--color-field-border)] p-1"
                  />
                  {ramp.length > 2 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove color ${index + 1}`}
                      onClick={() => setRamp((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={15} aria-hidden />
                    </Button>
                  ) : null}
                </span>
              ))}
              {ramp.length < 9 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRamp((current) => [...current, current.at(-1) ?? "#888888"])}
                >
                  <Plus size={15} aria-hidden /> Color
                </Button>
              ) : null}
            </div>
            {errors.ramp ? <p className="text-[12px] text-red-700">{errors.ramp[0]}</p> : null}
          </div>
          <Checkbox
            name="higher_is_better"
            defaultChecked={values.higher_is_better}
            label="Higher is better (rank countries from highest)"
          />
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="scale" value="linear" />
          <input type="hidden" name="higher_is_better" value="true" />
        </>
      )}

      <ActionStatus state={state} />
      <div>
        <SubmitButton>{indicator ? "Save indicator" : "Create indicator"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

interface Category {
  value: number;
  label: string;
  color: string;
}

/** Code list of a categorical indicator. */
export function CategoriesForm({ id, initial }: { id: string; initial: Category[] }) {
  const [items, setItems] = useState(initial);
  const [state, action] = useActionState<ActionState, FormData>(saveCategories, { ok: false });
  return (
    <ActionForm action={action} className="grid max-w-2xl gap-3">
      <input type="hidden" name="indicator_id" value={id} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[5rem_1fr_3.5rem_auto] items-end gap-2">
          <FormField id={`cat-${index}-value`} label="Value">
            <Input
              id={`cat-${index}-value`}
              type="number"
              value={item.value}
              onChange={(event) =>
                setItems((c) =>
                  c.map((x, i) => (i === index ? { ...x, value: Number(event.target.value) } : x)),
                )
              }
            />
          </FormField>
          <FormField id={`cat-${index}-label`} label="Label">
            <Input
              id={`cat-${index}-label`}
              maxLength={80}
              value={item.label}
              onChange={(event) =>
                setItems((c) =>
                  c.map((x, i) => (i === index ? { ...x, label: event.target.value } : x)),
                )
              }
            />
          </FormField>
          <FormField id={`cat-${index}-color`} label="Color">
            <Input
              id={`cat-${index}-color`}
              type="color"
              className="p-1"
              value={item.color}
              onChange={(event) =>
                setItems((c) =>
                  c.map((x, i) => (i === index ? { ...x, color: event.target.value } : x)),
                )
              }
            />
          </FormField>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove category ${index + 1}`}
            onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
          >
            <Trash2 size={15} aria-hidden />
          </Button>
        </div>
      ))}
      <ActionStatus state={state} />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setItems((c) => [
              ...c,
              { value: (c.at(-1)?.value ?? -1) + 1, label: "", color: "#9aa3b8" },
            ])
          }
        >
          <Plus size={15} aria-hidden /> Category
        </Button>
        <SubmitButton size="sm">Save categories</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Manual value for one country (new or a correction of an imported one). */
export function ValueForm({
  indicatorId,
  countries,
}: {
  indicatorId: string;
  countries: { iso3: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, data) => {
      const next = await setValue(prev, data);
      if (next.ok) router.refresh();
      return next;
    },
    { ok: false },
  );
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <input type="hidden" name="indicator_id" value={indicatorId} />
      <FormField id="country_iso3" label="Country" required errors={errors.country_iso3}>
        <Select id="country_iso3" name="country_iso3" required defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          {countries.map((country) => (
            <option key={country.iso3} value={country.iso3}>
              {country.name}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="value" label="Value" required errors={errors.value}>
          <Input id="value" name="value" type="number" step="any" required />
        </FormField>
        <FormField id="year" label="Year" errors={errors.year}>
          <Input id="year" name="year" type="number" min={1800} max={2100} />
        </FormField>
      </div>
      <FormField
        id="source_note"
        label="Value source"
        required
        hint="A manual value can't be saved without a source."
        errors={errors.source_note}
      >
        <Input id="source_note" name="source_note" required maxLength={300} />
      </FormField>
      <FormField id="note" label="Value note (“estimate”)" errors={errors.note}>
        <Input id="note" name="note" maxLength={120} />
      </FormField>
      <div className="grid gap-3 sm:col-span-2">
        <ActionStatus state={state} />
        <div>
          <SubmitButton>Save value</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
