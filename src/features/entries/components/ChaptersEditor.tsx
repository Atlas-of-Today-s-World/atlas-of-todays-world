"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { FormField, Input, Textarea } from "@/components/ui/field";
import { IconAction } from "@/features/portraits/components/CollectionEditor";
import type { ActionState } from "@/lib/actions";
import { saveChapters } from "../actions";
import type { EditableChapter } from "../editorial";
import { MAX_CHAPTERS } from "../constants";
import { RichTextEditor } from "./RichTextEditor";
import { UploadField } from "./UploadField";
import { swap } from "@/lib/array";

type Chapter = EditableChapter & { key: string };

const blank = (): Chapter => ({
  key: crypto.randomUUID(),
  title: "",
  summary_points: [],
  body_html: "",
  illustration_url: null,
  illustration_credit: null,
  audio_url: null,
  tile_background: null,
});

/**
 * Chapters of a topic (stored as entry chapters): each has a title, 3–5 summary
 * bullets, a tile photo or colour, audio and full text. Fields are uncontrolled
 * and named the same in every chapter — the Server Action reads them in page
 * order. The key keeps unsaved text when moving up/down.
 */
export function ChaptersEditor({
  entryId,
  initial,
}: {
  entryId: string;
  initial: EditableChapter[];
}) {
  // Keys of saved chapters by order — same on the server and in the browser (hydration).
  const [chapters, setChapters] = useState<Chapter[]>(() =>
    initial.map((chapter, index) => ({ ...chapter, key: `saved-${index}` })),
  );
  const [state, action] = useActionState<ActionState, FormData>(saveChapters, { ok: false });
  const move = (index: number, by: -1 | 1) =>
    setChapters((current) => swap(current, index, index + by));

  return (
    <section
      aria-labelledby="articles-title"
      className="rounded-2xl border border-[var(--color-line)] p-5"
    >
      <h2 id="articles-title" className="font-display text-[18px] font-bold">
        Chapters
      </h2>
      <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
        A topic has up to 12 chapters, shown as a row of cards (photo, or a colour when there is
        none). A click on a card opens the chapter: photo, summary bullets, audio and full text.
      </p>

      <ActionForm action={action} className="mt-5 grid gap-4">
        <input type="hidden" name="entry_id" value={entryId} />

        {chapters.map((chapter, index) => {
          const id = (field: string) => `chapter-${chapter.key}-${field}`;
          const label = `chapter ${index + 1}`;
          return (
            <fieldset
              key={chapter.key}
              className="grid gap-3 rounded-xl bg-[var(--color-line)]/25 p-4"
            >
              <legend className="sr-only">Chapter {index + 1}</legend>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                  Chapter {index + 1}
                </span>
                <span className="flex gap-1">
                  <IconAction
                    label={`Move ${label} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    icon={<ArrowUp size={16} aria-hidden />}
                  />
                  <IconAction
                    label={`Move ${label} down`}
                    disabled={index === chapters.length - 1}
                    onClick={() => move(index, 1)}
                    icon={<ArrowDown size={16} aria-hidden />}
                  />
                  <IconAction
                    label={`Remove ${label}`}
                    onClick={() =>
                      setChapters((current) => current.filter((item) => item.key !== chapter.key))
                    }
                    icon={<Trash2 size={16} aria-hidden />}
                  />
                </span>
              </div>
              <FormField id={id("title")} label="Title" required>
                <Input
                  id={id("title")}
                  name="title"
                  required
                  maxLength={200}
                  defaultValue={chapter.title}
                />
              </FormField>
              <FormField
                id={id("summary")}
                label="Summary bullet points"
                hint="3–5 bullet points, one per line."
              >
                <Textarea
                  id={id("summary")}
                  name="summary_points"
                  rows={4}
                  defaultValue={chapter.summary_points.join("\n")}
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <FormField id={id("illustration")} label="Tile photo">
                  <UploadField
                    id={id("illustration")}
                    name="illustration_url"
                    defaultValue={chapter.illustration_url ?? ""}
                  />
                </FormField>
                <FormField id={id("credit")} label="Photo credit">
                  <Input
                    id={id("credit")}
                    name="illustration_credit"
                    maxLength={300}
                    defaultValue={chapter.illustration_credit ?? ""}
                  />
                </FormField>
              </div>
              <FormField id={id("color")} label="Tile colour">
                <ColorField
                  id={id("color")}
                  name="tile_background"
                  defaultValue={chapter.tile_background}
                  label="Use a colour when the tile has no photo"
                />
              </FormField>
              <FormField
                id={id("audio")}
                label="Chapter audio"
                hint="MP3, M4A/AAC, Ogg/Opus, WAV or FLAC up to 50 MB. A chapter in MP3 (64 kbps) is about 7–10 MB; WAV and FLAC are 5–10× larger."
              >
                <UploadField
                  id={id("audio")}
                  name="audio_url"
                  kind="audio"
                  defaultValue={chapter.audio_url ?? ""}
                />
              </FormField>
              <div className="grid gap-1.5">
                <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
                  Full text
                </span>
                <RichTextEditor
                  name="body_html"
                  initialHtml={chapter.body_html}
                  label={`Chapter ${index + 1} text`}
                />
              </div>
            </fieldset>
          );
        })}

        {!chapters.length ? (
          <p className="text-[13px] text-[var(--color-ink-muted)]">
            This topic has no chapters yet — only the introduction will appear on the website.
          </p>
        ) : null}

        <ActionStatus state={state} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChapters((current) => [...current, blank()])}
            disabled={chapters.length >= MAX_CHAPTERS}
          >
            <Plus size={16} aria-hidden /> Add chapter
          </Button>
          <SubmitButton size="sm">Save chapters</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
