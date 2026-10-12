"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PhotoTile } from "@/components/atlas/PhotoTile";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { FormField, Input } from "@/components/ui/field";
import { IconAction } from "@/features/portraits/components/CollectionEditor";
import { swap } from "@/lib/array";
import { slugify } from "@/lib/validation/common";
import { MAX_TILES } from "../constants";
import type { EditableTile } from "../editorial";
import { IconPicker } from "./IconPicker";
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
              <IconPicker
                id={id("icon")}
                value={row.icon}
                label={name}
                onChange={(icon) => set(index, { icon })}
              />
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
              <PhotoTile
                className="min-h-32 sm:min-h-36"
                image={row.image_url}
                background={row.background}
                badge={
                  row.icon ? (
                    <span className="mb-auto grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
                      <TileIcon name={row.icon} className="size-4.5" />
                    </span>
                  ) : null
                }
                title={row.label || "Label"}
                titleClassName={row.icon ? "mt-3" : undefined}
              >
                <span className="mt-0.5 text-[11px] text-white/70">
                  {row.description || "Resources"}
                </span>
              </PhotoTile>
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
