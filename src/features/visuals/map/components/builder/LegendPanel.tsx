"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { Checkbox, FormField, Input, Select } from "@/components/ui/field";
import {
  addLegendItem,
  legendFromPoints,
  moveLegendItem,
  removeLegendItem,
  updateLegendItem,
} from "../../builder-state";
import { MAP_CORNERS, MAP_LIMITS, type MapCorner, type MapLegend, type MapSpec } from "../../types";
import { Hint, Section, type PanelProps } from "./fields";
import { IconPicker } from "./IconPicker";

const CORNER_LABELS: Record<MapCorner, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};

/** The legend: whether it shows, its title, corner and items (colour and/or icon + label). */
export function LegendPanel({ spec, edit, generation }: PanelProps) {
  const { legend } = spec;
  const setLegend = (patch: Partial<MapLegend>, key?: string) =>
    edit((current) => ({ ...current, legend: { ...current.legend, ...patch } }), key);
  const full = legend.items.length >= MAP_LIMITS.legendItems;
  // Items moved, removed or replaced: the uncontrolled colour fields start again.
  const [layout, setLayout] = useState(0);
  const reorder = (update: (spec: MapSpec) => MapSpec) => {
    edit(update);
    setLayout((count) => count + 1);
  };

  return (
    <div className="grid gap-5">
      <Section title="Legend">
        <Checkbox
          label="Show a legend on the map (readers can fold it away)"
          checked={legend.visible}
          onChange={(event) => setLegend({ visible: event.target.checked })}
        />
        <FormField id="map-legend-title" label="Title" hint="Empty: “Legend”.">
          <Input
            id="map-legend-title"
            value={legend.title}
            maxLength={MAP_LIMITS.legendTitle}
            onChange={(event) => setLegend({ title: event.target.value }, "legend-title")}
          />
        </FormField>
        <FormField id="map-legend-position" label="Corner">
          <Select
            id="map-legend-position"
            value={legend.position}
            onChange={(event) => setLegend({ position: event.target.value as MapCorner })}
          >
            {MAP_CORNERS.map((corner) => (
              <option key={corner} value={corner}>
                {CORNER_LABELS[corner]}
              </option>
            ))}
          </Select>
        </FormField>
      </Section>
      <Section title="Items">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() =>
              edit((current) =>
                addLegendItem(current, { label: "New item", color: "#c0392b", icon: null }),
              )
            }
          >
            Add item
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!spec.points.length}
            onClick={() =>
              reorder((current) => ({
                ...current,
                legend: {
                  ...current.legend,
                  visible: true,
                  items: legendFromPoints(current.points),
                },
              }))
            }
          >
            Make from the points
          </Button>
        </div>
        <Hint tone={full ? "warn" : "muted"}>
          {legend.items.length} of {MAP_LIMITS.legendItems} items. “Make from the points” replaces
          them with one item per point colour and icon.
        </Hint>
        <ol className="grid gap-3">
          {legend.items.map((item, index) => {
            const key = `map-legend-${index}`;
            return (
              <li
                key={`${generation}:${layout}:${index}`}
                className="grid gap-3 rounded-xl border border-[var(--color-line)] p-3"
              >
                <FormField id={`${key}-label`} label={`Item ${index + 1}`}>
                  <Input
                    id={`${key}-label`}
                    value={item.label}
                    maxLength={MAP_LIMITS.legendLabel}
                    onChange={(event) =>
                      edit(
                        (current) =>
                          updateLegendItem(current, index, { label: event.target.value }),
                        `${key}-label`,
                      )
                    }
                  />
                </FormField>
                <div className="flex flex-wrap items-center gap-3">
                  <ColorField
                    id={`${key}-color`}
                    label="Colour"
                    defaultValue={item.color}
                    onChange={(color) =>
                      edit((current) => updateLegendItem(current, index, { color }), `${key}-color`)
                    }
                  />
                  <IconPicker
                    value={item.icon}
                    noneLabel="none"
                    onChange={(icon) =>
                      edit((current) => updateLegendItem(current, index, { icon }))
                    }
                  />
                </div>
                {!item.color && !item.icon ? (
                  <Hint tone="warn">Give the item a colour, an icon or both.</Hint>
                ) : null}
                <div className="flex gap-1">
                  <Button
                    variant="quiet"
                    size="denseIcon"
                    aria-label={`Move item ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => reorder((current) => moveLegendItem(current, index, -1))}
                  >
                    <ArrowUp size={15} aria-hidden />
                  </Button>
                  <Button
                    variant="quiet"
                    size="denseIcon"
                    aria-label={`Move item ${index + 1} down`}
                    disabled={index === legend.items.length - 1}
                    onClick={() => reorder((current) => moveLegendItem(current, index, 1))}
                  >
                    <ArrowDown size={15} aria-hidden />
                  </Button>
                  <Button
                    variant="quietDanger"
                    size="denseIcon"
                    aria-label={`Delete item ${index + 1}`}
                    onClick={() => reorder((current) => removeLegendItem(current, index))}
                  >
                    <Trash2 size={15} aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      </Section>
    </div>
  );
}
