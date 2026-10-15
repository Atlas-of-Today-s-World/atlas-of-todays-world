"use client";

import { useState } from "react";
import { CountryPicker, type CountryGroups } from "@/components/admin/CountryPicker";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/field";
import { addHighlights } from "../../builder-state";
import { COUNTRY_BOXES, COUNTRY_OPTIONS } from "../../country-data";
import { boundsOfCountries } from "../../geo";
import type { MapViewMode } from "../../types";
import { Choice, Hint, Section, type PanelProps } from "./fields";

const MODES: { value: MapViewMode; label: string }[] = [
  { value: "countries", label: "Countries" },
  { value: "region", label: "Region" },
  { value: "bounds", label: "Free view" },
];

/**
 * What the map frames (countries, a region, or the view panned to on the
 * map), its projection and background. Whatever is chosen ends up as one
 * box in the spec — the reader's map fits it at any size.
 */
export function ViewPanel({
  spec,
  edit,
  generation,
  groups,
  onUseView,
}: PanelProps & { groups?: CountryGroups[]; onUseView: () => void }) {
  const { view } = spec;
  const [note, setNote] = useState("");
  const options = groups?.flatMap((set) =>
    set.options.map((option) => ({ ...option, set: set.label })),
  );
  const region = options?.find((option) => option.key === view.region?.slug);

  const frameCountries = (iso3s: string[]) =>
    edit((current) => {
      const bounds = boundsOfCountries(iso3s, COUNTRY_BOXES);
      return {
        ...current,
        view: {
          ...current.view,
          mode: "countries",
          countries: iso3s,
          ...(bounds ? { bounds } : {}),
        },
      };
    }, "view.countries");

  const frameRegion = (key: string) => {
    const option = options?.find((candidate) => candidate.key === key);
    if (!option) return;
    edit((current) => {
      const bounds = boundsOfCountries(option.countries, COUNTRY_BOXES);
      return {
        ...current,
        view: {
          ...current.view,
          mode: "region",
          region: { slug: option.key, name: option.name },
          countries: [...option.countries],
          ...(bounds ? { bounds } : {}),
        },
      };
    });
  };

  return (
    <div className="grid gap-5">
      <Section title="What the map shows">
        <Choice
          legend="Frame"
          name="map-view-mode"
          value={view.mode}
          options={MODES}
          onChange={(mode) => edit((current) => ({ ...current, view: { ...current.view, mode } }))}
        />
        {view.mode === "countries" ? (
          <div className="grid gap-1.5">
            <label
              htmlFor="map-view-countries"
              className="text-[12.5px] font-medium text-[var(--color-ink-soft)]"
            >
              Countries to frame
            </label>
            <CountryPicker
              key={generation}
              id="map-view-countries"
              options={COUNTRY_OPTIONS}
              defaultSelected={view.countries}
              groups={groups}
              onChange={frameCountries}
            />
            <Hint>The map fits these countries on every screen size.</Hint>
          </div>
        ) : null}
        {view.mode === "region" ? (
          options?.length ? (
            <div className="grid gap-2">
              <label
                htmlFor="map-view-region"
                className="text-[12.5px] font-medium text-[var(--color-ink-soft)]"
              >
                Region or custom region
              </label>
              <Select
                id="map-view-region"
                value={region?.key ?? ""}
                onChange={(event) => frameRegion(event.target.value)}
              >
                <option value="">Choose…</option>
                {groups?.map((set) => (
                  <optgroup key={set.label} label={set.label}>
                    {set.options.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              {view.region && !region ? (
                <Hint tone="warn">
                  {view.region.name} is no longer among the regions; the view stays as it was.
                </Hint>
              ) : null}
              {region ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      edit((current) => addHighlights(current, region.countries));
                      setNote(`The countries of ${region.name} are highlighted (Countries tab).`);
                    }}
                  >
                    Highlight its countries
                  </Button>
                  <span aria-live="polite" className="text-[12px] text-[var(--color-ink-muted)]">
                    {note}
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <Hint tone="warn">
              Regions aren&apos;t available here — pick countries or a free view.
            </Hint>
          )
        ) : null}
        {view.mode === "bounds" ? (
          <div className="grid gap-2">
            <Hint>
              Pan and zoom the map on the left, then press <strong>Use this view</strong>. Readers
              see at least this area, whatever their screen.
            </Hint>
            <Button variant="outline" size="sm" onClick={onUseView} className="justify-self-start">
              Use this view
            </Button>
          </div>
        ) : null}
        <Hint>
          Framed: {view.bounds.map((value) => value.toFixed(1)).join(", ")} (west, south, east,
          north)
        </Hint>
      </Section>
      <Section title="Look">
        <Choice
          legend="Projection"
          name="map-view-projection"
          value={view.projection}
          options={[
            { value: "mercator", label: "Flat map" },
            { value: "globe", label: "Globe" },
          ]}
          onChange={(projection) =>
            edit((current) => ({ ...current, view: { ...current.view, projection } }))
          }
        />
        <Choice
          legend="Background"
          name="map-view-basemap"
          value={view.basemap}
          options={[
            { value: "light", label: "Plain light map" },
            { value: "satellite", label: "Satellite" },
          ]}
          onChange={(basemap) =>
            edit((current) => ({ ...current, view: { ...current.view, basemap } }))
          }
        />
        <Checkbox
          label="Country names"
          checked={view.labels}
          onChange={(event) => {
            const labels = event.target.checked;
            edit((current) => ({ ...current, view: { ...current.view, labels } }));
          }}
        />
      </Section>
    </div>
  );
}
