"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/field";
import { IconAction } from "@/features/portraits/components/CollectionEditor";
import type { ActionState } from "@/lib/actions";
import { saveChapters } from "../actions";
import type { EditableChapter } from "../editorial";
import { MAX_CHAPTERS } from "../schema";
import { RichTextEditor } from "./RichTextEditor";
import { UploadField } from "./UploadField";

type Chapter = EditableChapter & { key: string };

const blank = (): Chapter => ({
  key: crypto.randomUUID(),
  title: "",
  summary_points: [],
  body_html: "",
  illustration_url: null,
  illustration_credit: null,
  audio_url: null,
});

/**
 * Kapitoly encyklopedického hesla (P9): každá má titulek, 3–5 odrážek
 * shrnutí, ilustraci, zvuk a plný text. Pole jsou nekontrolovaná a pojmenovaná
 * stejně u každé kapitoly — Server Action je přečte v pořadí na stránce.
 * Klíč kapitoly drží rozepsaný text i při posunu nahoru/dolů.
 */
export function ChaptersEditor({
  entryId,
  initial,
}: {
  entryId: string;
  initial: EditableChapter[];
}) {
  // Klíče uložených kapitol podle pořadí — stejné na serveru i v prohlížeči (hydratace).
  const [chapters, setChapters] = useState<Chapter[]>(() =>
    initial.map((chapter, index) => ({ ...chapter, key: `saved-${index}` })),
  );
  const [state, action] = useActionState<ActionState, FormData>(saveChapters, { ok: false });
  const move = (index: number, by: -1 | 1) =>
    setChapters((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });

  return (
    <section
      aria-labelledby="chapters-title"
      className="rounded-2xl border border-[var(--color-line)] p-5"
    >
      <h2 id="chapters-title" className="font-display text-[18px] font-bold">
        Kapitoly
      </h2>
      <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
        Heslo má 4–6 kapitol. Čtenář vidí titulek, ilustraci a shrnutí; plný text si rozbalí.
      </p>

      <ActionForm action={action} className="mt-5 grid gap-4">
        <input type="hidden" name="entry_id" value={entryId} />

        {chapters.map((chapter, index) => {
          const id = (field: string) => `chapter-${chapter.key}-${field}`;
          const label = `kapitolu ${index + 1}`;
          return (
            <fieldset
              key={chapter.key}
              className="grid gap-3 rounded-xl bg-[var(--color-line)]/25 p-4"
            >
              <legend className="sr-only">Kapitola {index + 1}</legend>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                  Kapitola {index + 1}
                </span>
                <span className="flex gap-1">
                  <IconAction
                    label={`Posunout ${label} nahoru`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    icon={<ArrowUp size={16} aria-hidden />}
                  />
                  <IconAction
                    label={`Posunout ${label} dolů`}
                    disabled={index === chapters.length - 1}
                    onClick={() => move(index, 1)}
                    icon={<ArrowDown size={16} aria-hidden />}
                  />
                  <IconAction
                    label={`Odebrat ${label}`}
                    onClick={() =>
                      setChapters((current) => current.filter((item) => item.key !== chapter.key))
                    }
                    icon={<Trash2 size={16} aria-hidden />}
                  />
                </span>
              </div>
              <FormField id={id("title")} label="Titulek" required>
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
                label="Shrnutí v odrážkách"
                hint="3–5 odrážek, každá na vlastní řádek."
              >
                <Textarea
                  id={id("summary")}
                  name="summary_points"
                  rows={4}
                  defaultValue={chapter.summary_points.join("\n")}
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <FormField id={id("illustration")} label="Ilustrace">
                  <UploadField
                    id={id("illustration")}
                    name="illustration_url"
                    defaultValue={chapter.illustration_url ?? ""}
                  />
                </FormField>
                <FormField id={id("credit")} label="Kredit ilustrace">
                  <Input
                    id={id("credit")}
                    name="illustration_credit"
                    maxLength={300}
                    defaultValue={chapter.illustration_credit ?? ""}
                  />
                </FormField>
              </div>
              <FormField
                id={id("audio")}
                label="Zvuková verze kapitoly"
                hint="MP3, M4A/AAC, Ogg/Opus, WAV nebo FLAC do 50 MB. Kapitola v MP3 (64 kbps) má asi 7–10 MB; WAV a FLAC jsou 5–10× větší."
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
                  Plný text
                </span>
                <RichTextEditor
                  name="body_html"
                  initialHtml={chapter.body_html}
                  label={`Text kapitoly ${index + 1}`}
                />
              </div>
            </fieldset>
          );
        })}

        {!chapters.length ? (
          <p className="text-[13px] text-[var(--color-ink-muted)]">
            Heslo zatím nemá kapitoly — na webu se ukáže jen úvod.
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
            <Plus size={16} aria-hidden /> Přidat kapitolu
          </Button>
          <SubmitButton size="sm">Uložit kapitoly</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
