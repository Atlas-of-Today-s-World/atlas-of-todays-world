"use client";

import { useState } from "react";
import { CountryPicker, type CountryGroups } from "@/components/admin/CountryPicker";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { addHighlights, DEFAULT_HIGHLIGHT_COLOR, updateHighlight } from "../../builder-state";
import { COUNTRY_OPTIONS } from "../../country-data";
import { MAP_LIMITS, type MapSpec } from "../../types";
import { ColorInput, Hint, RangeNumber, Section, type PanelProps } from "./fields";

const NAMES = new Map(COUNTRY_OPTIONS.map((option) => [option.iso3, option.name]));

/** The highlights after the picker's selection: new ones added, unpicked ones removed. */
function syncHighlights(spec: MapSpec, selected: string[]): MapSpec {
  const keep = new Set(selected);
  const kept = { ...spec, countries: spec.countries.filter((country) => keep.has(country.iso3)) };
  return addHighlights(kept, selected);
}

/**
 * Countries painted in their own colour: pick them here (or click them on
 * the map while this tab is open), then set each one's fill, opacity and
 * outline — or one colour for all.
 */
export function CountriesPanel({
  spec,
  edit,
  generation,
  groups,
}: PanelProps & { groups?: CountryGroups[] }) {
  const [allColor, setAllColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [refused, setRefused] = useState(0);
  const full = spec.countries.length >= MAP_LIMITS.countries;
  return (
    <div className="grid gap-5">
      <Section title="Highlighted countries">
        <CountryPicker
          // Starts again from the spec after a map click, an undo or a refused addition.
          key={`${generation}:${refused}`}
          id="map-highlight-countries"
          options={COUNTRY_OPTIONS}
          defaultSelected={spec.countries.map((country) => country.iso3)}
          groups={groups}
          onChange={(selected) => {
            edit((current) => syncHighlights(current, selected));
            if (selected.length > MAP_LIMITS.countries) setRefused((count) => count + 1);
          }}
        />
        <Hint tone={full ? "warn" : "muted"}>
          {spec.countries.length} of {MAP_LIMITS.countries} countries. Tip: with this tab open, a
          click on a country on the map highlights it or removes its highlight.
        </Hint>
      </Section>
      {spec.countries.length ? (
        <Section title="Colours">
          <div className="flex flex-wrap items-end gap-3">
            <ColorInput
              id="map-highlight-all"
              label="One colour for all"
              value={allColor}
              onChange={setAllColor}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                edit((current) => ({
                  ...current,
                  countries: current.countries.map((country) => ({ ...country, fill: allColor })),
                }))
              }
            >
              Apply to all
            </Button>
          </div>
          <ul className="grid gap-3">
            {spec.countries.map((country) => {
              const name = NAMES.get(country.iso3) ?? country.iso3;
              const key = `map-highlight-${country.iso3}`;
              return (
                <li
                  key={country.iso3}
                  className="grid gap-3 rounded-xl border border-[var(--color-line)] p-3"
                >
                  <p className="flex items-center gap-2 text-[13.5px] font-medium">
                    <span
                      aria-hidden
                      className="size-4 rounded"
                      style={{ background: country.fill, opacity: Math.max(country.opacity, 0.15) }}
                    />
                    {name}
                  </p>
                  <div className="flex flex-wrap items-end gap-4">
                    <ColorInput
                      id={`${key}-fill`}
                      label={`Fill of ${name}`}
                      value={country.fill}
                      onChange={(fill) =>
                        edit(
                          (current) => updateHighlight(current, country.iso3, { fill }),
                          `${key}-fill`,
                        )
                      }
                    />
                    <div className="min-w-48 flex-1">
                      <RangeNumber
                        id={`${key}-opacity`}
                        label="Opacity"
                        unit="%"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round(country.opacity * 100)}
                        onChange={(percent) =>
                          edit(
                            (current) =>
                              updateHighlight(current, country.iso3, { opacity: percent / 100 }),
                            `${key}-opacity`,
                          )
                        }
                      />
                    </div>
                  </div>
                  <ColorField
                    key={generation}
                    id={`${key}-outline`}
                    label="Outline"
                    defaultValue={country.outline}
                    onChange={(outline) =>
                      edit(
                        (current) => updateHighlight(current, country.iso3, { outline }),
                        `${key}-outline`,
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
