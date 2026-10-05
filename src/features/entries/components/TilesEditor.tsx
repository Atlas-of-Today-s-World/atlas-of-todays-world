"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { FormField, Input } from "@/components/ui/field";
import { IconAction } from "@/features/portraits/components/CollectionEditor";
import { swap } from "@/lib/array";
import { cn } from "@/lib/cn";
import { slugify } from "@/lib/validation/common";
import { MAX_TILES, TILE_ICON_LABEL, TILE_ICONS } from "../constants";
import type { EditableTile } from "../editorial";
import { TILE, TileFace, tileStyle } from "./TileFace";
import { TileIcon } from "./TileIcon";
import { UploadField } from "./UploadField";

/** A tile while editing; `key` keeps React rows stable, `id` is empty for a new one. */
type Row = Omit<EditableTile, "id"> & { id: string; key: string };

const blank = (key: string): Row => ({
  id: "",
  key,
  slug: "",
  label: "",
  description: "",
  icon: "link",
  image_url: null,
  image_credit: null,
  background: null,
});

/** A new tile's address from its label, unique among the other tiles. */
function freeSlug(label: string, taken: Set<string>) {
  const base = slugify(label).slice(0, 50) || "tile";
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

/**
 * The "Learn more" tiles of a topic or a template: label, icon, short
 * description, background photo or colour; add, remove, reorder. Lives inside
 * the parent's form and posts everything as one JSON field `tiles`.
 * An existing tile keeps its address (slug), so a template re-applied later
 * still finds it; a new one gets it from the label.
 */
export function TilesEditor({ initial, note }: { initial: EditableTile[]; note?: string }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((tile) => ({ ...tile, key: tile.id })));
  const [counter, setCounter] = useState(0);

  const set = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const payload = rows.map((row, index) => {
    const taken = new Set(rows.filter((_, i) => i !== index).map((other) => other.slug));
    return {
      ...(row.id ? { id: row.id } : {}),
      slug: row.id ? row.slug : freeSlug(row.label, taken),
      label: row.label,
      description: row.description,
      icon: row.icon,
      image_url: row.image_url ?? "",
      image_credit: row.image_credit ?? "",
      background: row.background ?? "",
    };
  });

  return (
    <div className="grid gap-4">
      <input type="hidden" name="tiles" value={JSON.stringify(payload)} />
      {note ? <p className="text-[13px] text-[var(--color-ink-soft)]">{note}</p> : null}

      {rows.map((row, index) => {
        const id = (field: string) => `tile-${row.key}-${field}`;
        const name = row.label || `Tile ${index + 1}`;
        return (
          <fieldset
            key={row.key}
            className="grid gap-4 rounded-xl border border-[var(--color-line)] p-4 lg:grid-cols-[1fr_11rem]"
          >
            <legend className="sr-only">{name}</legend>
            <div className="grid content-start gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                  Tile {index + 1}
                </span>
                <span className="ml-auto flex gap-1">
                  <IconAction
                    label={`Move ${name} up`}
                    disabled={index === 0}
                    onClick={() => setRows((current) => swap(current, index, index - 1))}
                    icon={<ArrowUp size={16} aria-hidden />}
                  />
                  <IconAction
                    label={`Move ${name} down`}
                    disabled={index === rows.length - 1}
                    onClick={() => setRows((current) => swap(current, index, index + 1))}
                    icon={<ArrowDown size={16} aria-hidden />}
                  />
                  <IconAction
                    label={`Remove ${name}`}
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    icon={<Trash2 size={16} aria-hidden />}
                  />
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id={id("label")} label="Label" required>
                  <Input
                    id={id("label")}
                    value={row.label}
                    maxLength={60}
                    required
                    placeholder="Videos & Documentaries"
                    onChange={(event) => set(index, { label: event.target.value })}
                  />
                </FormField>
                <FormField id={id("description")} label="Short description">
                  <Input
                    id={id("description")}
                    value={row.description}
                    maxLength={200}
                    onChange={(event) => set(index, { description: event.target.value })}
                  />
                </FormField>
              </div>
              <div role="radiogroup" aria-label={`Icon of ${name}`} className="grid gap-1.5">
                <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">Icon</span>
                <div className="flex flex-wrap gap-1.5">
                  {TILE_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      role="radio"
                      aria-checked={row.icon === icon}
                      aria-label={TILE_ICON_LABEL[icon]}
                      title={TILE_ICON_LABEL[icon]}
                      onClick={() => set(index, { icon })}
                      className={cn(
                        "grid size-(--touch-min) place-items-center rounded-lg border transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none",
                        row.icon === icon
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                          : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-muted)]",
                      )}
                    >
                      <TileIcon name={icon} className="size-4.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <FormField id={id("image")} label="Background photo">
                  <UploadField
                    id={id("image")}
                    defaultValue={row.image_url ?? ""}
                    onChange={(url) => set(index, { image_url: url || null })}
                  />
                </FormField>
                <FormField id={id("credit")} label="Photo credit">
                  <Input
                    id={id("credit")}
                    value={row.image_credit ?? ""}
                    maxLength={300}
                    onChange={(event) => set(index, { image_credit: event.target.value })}
                  />
                </FormField>
              </div>
              <ColorField
                id={id("color")}
                defaultValue={row.background}
                label="Background colour (shown when there is no photo)"
                onChange={(background) => set(index, { background })}
              />
            </div>
            <div aria-hidden className="grid content-start gap-1.5">
              <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">Preview</span>
              <div className={TILE} style={tileStyle(row.image_url, row.background)}>
                <TileFace
                  icon={row.icon}
                  label={row.label || "Label"}
                  note={row.description || "Resources"}
                />
              </div>
            </div>
          </fieldset>
        );
      })}

      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length >= MAX_TILES}
          onClick={() => {
            setRows((current) => [...current, blank(`new-${counter}`)]);
            setCounter((n) => n + 1);
          }}
        >
          <Plus size={16} aria-hidden /> Add tile
        </Button>
      </div>
    </div>
  );
}
