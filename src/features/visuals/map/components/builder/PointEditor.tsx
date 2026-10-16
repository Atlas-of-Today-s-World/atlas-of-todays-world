"use client";

import { useState } from "react";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Checkbox, describedBy, FormField, Input, Select } from "@/components/ui/field";
import { applyPopupStyleToAll, newPopup, updatePoint } from "../../builder-state";
import {
  MAP_LIMITS,
  type MapPoint,
  type MapPopup,
  type PopupFont,
  type PopupSize,
} from "../../types";
import { ColorInput, Hint, RangeNumber, Section, type PanelProps } from "./fields";
import { IconPicker } from "./IconPicker";

const FONTS: { value: PopupFont; label: string }[] = [
  { value: "sans", label: "Inter (text)" },
  { value: "display", label: "Manrope (headings)" },
  { value: "serif", label: "Serif" },
];

const SIZES: { value: PopupSize; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Normal" },
  { value: "lg", label: "Large" },
];

const TITLE_HINT =
  "The point's name for screen readers, its popup heading and its label on the map.";
const UNTITLED_ERROR = "Give the point a title: the map can't be saved without one.";

/** A latitude or longitude field: half-typed values stay in the field, valid ones move the point. */
function CoordinateField({
  id,
  label,
  value,
  limit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  limit: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && !isCoordinate(draft, limit);
  return (
    <FormField
      id={id}
      label={label}
      errors={invalid ? [`A number from −${limit} to ${limit}.`] : undefined}
    >
      <Input
        id={id}
        inputMode="decimal"
        value={draft ?? String(value)}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          if (isCoordinate(event.target.value, limit)) onChange(Number(event.target.value));
        }}
        onBlur={() => setDraft(null)}
      />
    </FormField>
  );
}

export const isCoordinate = (raw: string, limit: number) => {
  const number = Number(raw.trim());
  return raw.trim() !== "" && Number.isFinite(number) && Math.abs(number) <= limit;
};

/** Everything about the selected point: name, place, look and popup. */
export function PointEditor({
  edit,
  generation,
  point,
}: Omit<PanelProps, "spec"> & { point: MapPoint }) {
  const key = `map-point-${point.id}`;
  const set = (patch: Partial<MapPoint>, field?: string) =>
    edit((current) => updatePoint(current, point.id, patch), field && `${key}-${field}`);
  const setPopup = (patch: Partial<MapPopup>, field?: string) =>
    edit(
      (current) => {
        const target = current.points.find((candidate) => candidate.id === point.id);
        return target?.popup
          ? updatePoint(current, point.id, { popup: { ...target.popup, ...patch } })
          : current;
      },
      field && `${key}-popup-${field}`,
    );
  const popup = point.popup;
  // Shown as soon as the title is empty, not only after a refused save.
  const titleErrors = point.label.trim() ? undefined : [UNTITLED_ERROR];

  return (
    <div className="grid gap-5 rounded-xl border border-[var(--color-line)] p-3">
      <Section title={titleErrors ? "Point without a title" : `Point: ${point.label}`}>
        <FormField
          id={`${key}-label`}
          label="Title"
          required
          hint={TITLE_HINT}
          errors={titleErrors}
        >
          <Input
            id={`${key}-label`}
            value={point.label}
            maxLength={MAP_LIMITS.label}
            onChange={(event) => set({ label: event.target.value }, "label")}
            {...describedBy(`${key}-label`, { hint: TITLE_HINT, errors: titleErrors })}
          />
        </FormField>
        <Checkbox
          label="Show the title on the map"
          checked={point.showLabel}
          onChange={(event) => set({ showLabel: event.target.checked })}
        />
        <div className="grid grid-cols-2 gap-3">
          <CoordinateField
            id={`${key}-lat`}
            label="Latitude"
            value={point.lat}
            limit={MAP_LIMITS.maxLatitude}
            onChange={(lat) => set({ lat }, "lat")}
          />
          <CoordinateField
            id={`${key}-lon`}
            label="Longitude"
            value={point.lon}
            limit={180}
            onChange={(lon) => set({ lon }, "lon")}
          />
        </div>
        <Hint>Or drag the point on the map.</Hint>
      </Section>
      <Section title="Look">
        <div className="flex flex-wrap items-end gap-4">
          <ColorInput
            id={`${key}-color`}
            label="Colour"
            value={point.color}
            onChange={(color) => set({ color }, "color")}
          />
          <IconPicker
            value={point.icon}
            noneLabel="Plain circle"
            onChange={(icon) => set({ icon })}
          />
        </div>
        <RangeNumber
          id={`${key}-size`}
          label="Size"
          unit="px"
          min={MAP_LIMITS.pointSize.min}
          max={MAP_LIMITS.pointSize.max}
          value={point.size}
          onChange={(size) => set({ size }, "size")}
        />
        <Checkbox
          label="Pulse (not shown to readers who reduce motion)"
          checked={point.pulse}
          onChange={(event) => set({ pulse: event.target.checked })}
        />
      </Section>
      <Section title="Popup">
        <Checkbox
          label="Show a popup (on hover, tap or Enter)"
          checked={Boolean(popup)}
          onChange={(event) => set({ popup: event.target.checked ? newPopup() : null })}
        />
        {popup ? (
          <>
            <RichTextEditor
              key={`${point.id}:${generation}`}
              variant="popup"
              label={`Popup text of ${point.label}`}
              initialHtml={popup.html}
              onChange={(html) => setPopup({ html }, "html")}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField id={`${key}-font`} label="Font">
                <Select
                  id={`${key}-font`}
                  value={popup.font}
                  onChange={(event) => setPopup({ font: event.target.value as PopupFont })}
                >
                  {FONTS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id={`${key}-text-size`} label="Text size">
                <Select
                  id={`${key}-text-size`}
                  value={popup.size}
                  onChange={(event) => setPopup({ size: event.target.value as PopupSize })}
                >
                  {SIZES.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="flex flex-wrap gap-4">
              <ColorInput
                id={`${key}-popup-color`}
                label="Text colour"
                value={popup.color}
                onChange={(color) => setPopup({ color }, "color")}
              />
              <ColorInput
                id={`${key}-popup-background`}
                label="Background"
                value={popup.background}
                onChange={(background) => setPopup({ background }, "background")}
              />
            </div>
            <RangeNumber
              id={`${key}-popup-width`}
              label="Widest"
              unit="px"
              min={MAP_LIMITS.popupWidth.min}
              max={MAP_LIMITS.popupWidth.max}
              step={10}
              value={popup.maxWidth}
              onChange={(maxWidth) => setPopup({ maxWidth }, "width")}
            />
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => edit((current) => applyPopupStyleToAll(current, popup))}
            >
              Use this popup style for all points
            </Button>
          </>
        ) : null}
      </Section>
    </div>
  );
}
