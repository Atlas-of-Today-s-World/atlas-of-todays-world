"use client";

import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { duplicatePoint, removePoint } from "../../builder-state";
import { MAP_LIMITS } from "../../types";
import { PointGlyph } from "../PointGlyph";
import { Hint, Section, type PanelProps } from "./fields";
import { isCoordinate, PointEditor } from "./PointEditor";

/**
 * The points: add them (click on the map, the map's centre, or typed
 * coordinates), pick one from the list to edit, copy or delete it.
 */
export function PointsPanel({
  spec,
  edit,
  generation,
  selectedId,
  onSelect,
  adding,
  onToggleAdding,
  onAdd,
}: PanelProps & {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  adding: boolean;
  onToggleAdding: () => void;
  /** Adds a point here (the map's centre when no place is given) and selects it. */
  onAdd: (at?: { lat: number; lon: number }) => void;
}) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [query, setQuery] = useState("");
  const full = spec.points.length >= MAP_LIMITS.points;
  const selected = spec.points.find((point) => point.id === selectedId);
  const q = query.trim().toLowerCase();
  const shown = q
    ? spec.points.filter((point) => point.label.toLowerCase().includes(q))
    : spec.points;
  const coordinatesValid = isCoordinate(lat, MAP_LIMITS.maxLatitude) && isCoordinate(lon, 180);

  return (
    <div className="grid gap-5">
      <Section title="Add points">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={adding ? "primary" : "outline"}
            size="sm"
            aria-pressed={adding}
            disabled={full}
            onClick={onToggleAdding}
          >
            {adding ? "Adding: click the map…" : "Add by clicking the map"}
          </Button>
          <Button variant="outline" size="sm" disabled={full} onClick={() => onAdd()}>
            Add at the map centre
          </Button>
        </div>
        <form
          className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!coordinatesValid) return;
            onAdd({ lat: Number(lat), lon: Number(lon) });
            setLat("");
            setLon("");
          }}
        >
          <FormField id="map-add-lat" label="Latitude">
            <Input
              id="map-add-lat"
              inputMode="decimal"
              placeholder="31.52"
              value={lat}
              onChange={(event) => setLat(event.target.value)}
            />
          </FormField>
          <FormField id="map-add-lon" label="Longitude">
            <Input
              id="map-add-lon"
              inputMode="decimal"
              placeholder="34.45"
              value={lon}
              onChange={(event) => setLon(event.target.value)}
            />
          </FormField>
          <Button type="submit" variant="outline" size="sm" disabled={full || !coordinatesValid}>
            Add
          </Button>
        </form>
        <Hint tone={full ? "warn" : "muted"}>
          {spec.points.length} of {MAP_LIMITS.points} points.
        </Hint>
      </Section>
      {spec.points.length ? (
        <Section title="Points">
          {spec.points.length > 8 ? (
            <FormField id="map-points-filter" label="Find a point">
              <Input
                id="map-points-filter"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </FormField>
          ) : null}
          <ul className="grid max-h-72 gap-0.5 overflow-auto" aria-label="Points on the map">
            {shown.map((point) => {
              const active = point.id === selectedId;
              const name = point.label.trim() || "the point without a title";
              return (
                <li
                  key={point.id}
                  className={cn(
                    "flex items-center gap-1 rounded-lg pr-1",
                    active
                      ? "bg-[var(--color-accent-soft)]"
                      : "hover:bg-[var(--color-surface-hover)]",
                  )}
                >
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => onSelect(active ? null : point.id)}
                    className="flex min-h-(--touch-min) min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left text-[13.5px] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
                  >
                    <span className="grid w-6 shrink-0 place-items-center">
                      <PointGlyph
                        color={point.color}
                        size={Math.min(point.size, 22)}
                        icon={point.icon}
                      />
                    </span>
                    {point.label.trim() ? (
                      <span className="min-w-0 flex-1 truncate">{point.label}</span>
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-danger)]">
                        No title yet
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] text-[var(--color-ink-muted)] tabular-nums">
                      {point.lat.toFixed(2)}, {point.lon.toFixed(2)}
                    </span>
                  </button>
                  <Button
                    variant="quiet"
                    size="denseIcon"
                    title={`Duplicate ${name}`}
                    aria-label={`Duplicate ${name}`}
                    disabled={full}
                    onClick={() => {
                      let copyId: string | null = null;
                      edit((current) => {
                        const result = duplicatePoint(current, point.id);
                        copyId = result.id;
                        return result.spec;
                      });
                      if (copyId) onSelect(copyId);
                    }}
                  >
                    <Copy size={15} aria-hidden />
                  </Button>
                  <Button
                    variant="quietDanger"
                    size="denseIcon"
                    title={`Delete ${name}`}
                    aria-label={`Delete ${name}`}
                    onClick={() => {
                      edit((current) => removePoint(current, point.id));
                      if (active) onSelect(null);
                    }}
                  >
                    <Trash2 size={15} aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
          <Hint>Deleted something by mistake? “Undo last change” is above the map.</Hint>
        </Section>
      ) : null}
      {selected ? <PointEditor edit={edit} generation={generation} point={selected} /> : null}
    </div>
  );
}
