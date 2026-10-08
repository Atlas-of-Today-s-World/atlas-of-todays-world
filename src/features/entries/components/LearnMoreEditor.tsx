"use client";

import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/field";
import { IconAction } from "@/features/portraits/components/CollectionEditor";
import type { ActionState } from "@/lib/actions";
import { swap } from "@/lib/array";
import { withPreviews } from "@/lib/previews/merge";
import { saveLearnMore } from "../actions";
import { MAX_LINKS } from "../constants";
import type { EditableLink, EditableTile } from "../editorial";
import { RichTextEditor } from "./RichTextEditor";

const blankLink = (): EditableLink => ({
  title: "",
  source: "",
  description: "",
  url: "",
  image_url: "",
});

const LINK_FIELDS: { name: keyof EditableLink; label: string; max: number; url?: boolean }[] = [
  { name: "title", label: "Title", max: 200 },
  { name: "source", label: "Publisher", max: 120 },
  { name: "url", label: "URL (https)", max: 1000, url: true },
  {
    name: "image_url",
    label: "Thumbnail image (https; empty = taken from the page)",
    max: 1000,
    url: true,
  },
];

/**
 * "Learn more" of one topic: every tile with its links and its own rich text —
 * e.g. hand-written notes. A tile with neither is shown greyed out on the
 * site. Everything is saved at once.
 */
export function LearnMoreEditor({
  entryId,
  tiles,
  links: initialLinks,
  notes,
}: {
  entryId: string;
  tiles: EditableTile[];
  links: Record<string, EditableLink[]>;
  notes: Record<string, string>;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [state, action] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await saveLearnMore(previous, formData);
      // Preview images the server found for links without one appear in the form.
      const { previews } = result;
      if (previews) {
        setLinks((current) =>
          Object.fromEntries(
            Object.entries(current).map(([tile, list]) => [tile, withPreviews(list, previews)]),
          ),
        );
      }
      return result;
    },
    { ok: false },
  );
  const total = Object.values(links).reduce((sum, list) => sum + list.length, 0);

  const change = (tileId: string, update: (list: EditableLink[]) => EditableLink[]) =>
    setLinks((current) => ({ ...current, [tileId]: update(current[tileId] ?? []) }));

  return (
    <ActionForm action={action} className="grid gap-4">
      <input type="hidden" name="entry_id" value={entryId} />
      <input
        type="hidden"
        name="tiles"
        value={JSON.stringify(
          tiles.map((tile) => ({ tile_id: tile.id, links: links[tile.id] ?? [] })),
        )}
      />

      {tiles.map((tile) => {
        const list = links[tile.id] ?? [];
        const hasNotes = Boolean(notes[tile.id]?.trim());
        return (
          <details
            key={tile.id}
            open={list.length > 0 || hasNotes}
            className="group rounded-xl border border-[var(--color-line)]"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
              <span className="font-display text-[15px] font-bold">{tile.label}</span>
              <span className="ml-auto text-[12px] text-[var(--color-ink-muted)]">
                {list.length} {list.length === 1 ? "link" : "links"}
                {hasNotes ? " · text" : ""}
              </span>
              <ChevronDown
                aria-hidden
                className="size-4 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="grid gap-4 border-t border-[var(--color-line)] p-4">
              {list.map((link, index) => {
                const id = (field: string) => `learn-${tile.id}-${index}-${field}`;
                const label = `${tile.label} link ${index + 1}`;
                const set = (name: keyof EditableLink, value: string) =>
                  change(tile.id, (items) =>
                    items.map((item, i) => (i === index ? { ...item, [name]: value } : item)),
                  );
                return (
                  <fieldset
                    key={index}
                    className="grid gap-3 rounded-xl bg-[var(--color-line)]/25 p-4 sm:grid-cols-2"
                  >
                    <legend className="sr-only">{label}</legend>
                    <div className="flex items-center justify-between sm:col-span-2">
                      <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                        Link {index + 1}
                      </span>
                      <span className="flex gap-1">
                        <IconAction
                          label={`Move ${label} up`}
                          disabled={index === 0}
                          onClick={() => change(tile.id, (items) => swap(items, index, index - 1))}
                          icon={<ArrowUp size={16} aria-hidden />}
                        />
                        <IconAction
                          label={`Move ${label} down`}
                          disabled={index === list.length - 1}
                          onClick={() => change(tile.id, (items) => swap(items, index, index + 1))}
                          icon={<ArrowDown size={16} aria-hidden />}
                        />
                        <IconAction
                          label={`Remove ${label}`}
                          onClick={() =>
                            change(tile.id, (items) => items.filter((_, i) => i !== index))
                          }
                          icon={<Trash2 size={16} aria-hidden />}
                        />
                      </span>
                    </div>
                    {LINK_FIELDS.map((field) => (
                      <FormField
                        key={field.name}
                        id={id(field.name)}
                        label={field.label}
                        required={field.name === "title" || field.name === "url"}
                      >
                        <Input
                          id={id(field.name)}
                          value={link[field.name]}
                          maxLength={field.max}
                          inputMode={field.url ? "url" : undefined}
                          placeholder={field.url ? "https://…" : undefined}
                          onChange={(event) => set(field.name, event.target.value)}
                        />
                      </FormField>
                    ))}
                    <FormField id={id("description")} label="Description" className="sm:col-span-2">
                      <Textarea
                        id={id("description")}
                        value={link.description}
                        maxLength={600}
                        rows={2}
                        onChange={(event) => set("description", event.target.value)}
                      />
                    </FormField>
                  </fieldset>
                );
              })}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={total >= MAX_LINKS}
                  onClick={() => change(tile.id, (items) => [...items, blankLink()])}
                >
                  <Plus size={16} aria-hidden /> Add link to {tile.label}
                </Button>
              </div>
              <div className="grid gap-1.5">
                <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
                  Text of this tile (optional)
                </span>
                <RichTextEditor
                  name={`notes:${tile.id}`}
                  initialHtml={notes[tile.id] ?? ""}
                  label={`${tile.label} — text`}
                />
              </div>
            </div>
          </details>
        );
      })}

      <ActionStatus state={state} />
      <div>
        <SubmitButton size="sm">Save Learn more</SubmitButton>
      </div>
    </ActionForm>
  );
}
