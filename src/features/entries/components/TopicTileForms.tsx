"use client";

import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, FormField, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { saveTopicTiles } from "../actions";
import type { EditableTile, TemplateSummary } from "../editorial";
import { applyTemplate, saveTemplate, saveTopicAsTemplate } from "../template-actions";
import { TilesEditor } from "./TilesEditor";

const IDLE: ActionState = { ok: false };

/** Labels of the two halves of a topic page (empty = the default text). */
function LabelFields({
  prefix,
  articles,
  learnMore,
  required,
}: {
  prefix: string;
  articles: string;
  learnMore: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        id={`${prefix}-articles`}
        label="Heading of the chapter cards"
        required={required}
        hint={required ? undefined : "Empty = “Chapters”."}
      >
        <Input
          id={`${prefix}-articles`}
          name="articles_label"
          maxLength={40}
          required={required}
          defaultValue={articles}
          placeholder="Chapters"
        />
      </FormField>
      <FormField
        id={`${prefix}-learn`}
        label="Heading of the resource tiles"
        required={required}
        hint={required ? undefined : "Empty = “Learn more”."}
      >
        <Input
          id={`${prefix}-learn`}
          name="learn_more_label"
          maxLength={40}
          required={required}
          defaultValue={learnMore}
          placeholder="Learn more"
        />
      </FormField>
    </div>
  );
}

/** The tiles of one topic and its section headings, saved at once. */
export function TopicTilesForm({
  entryId,
  tiles,
  labels,
}: {
  entryId: string;
  tiles: EditableTile[];
  labels: { articles_label: string; learn_more_label: string };
}) {
  const [state, action] = useActionState(saveTopicTiles, IDLE);
  return (
    <ActionForm action={action} className="grid gap-5">
      <input type="hidden" name="entry_id" value={entryId} />
      <LabelFields
        prefix="topic"
        articles={labels.articles_label}
        learnMore={labels.learn_more_label}
      />
      <TilesEditor
        // A re-applied template changes the tiles on the server: start over from them.
        key={tiles.map((tile) => `${tile.id}:${tile.label}:${tile.icon}`).join("|")}
        initial={tiles}
        note="A removed tile takes its links and text with it when you save."
      />
      <ActionStatus state={state} />
      <div>
        <SubmitButton size="sm">Save tiles</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Re-apply a template to this topic, or keep its tiles as a new template. */
export function TemplateTools({
  entryId,
  templates,
  current,
}: {
  entryId: string;
  templates: TemplateSummary[];
  current: string | null;
}) {
  const [applied, apply] = useActionState(applyTemplate, IDLE);
  const [saved, save] = useActionState(saveTopicAsTemplate, IDLE);
  const used = templates.find((template) => template.id === current);
  return (
    <section
      aria-labelledby="template-tools-title"
      className="grid gap-5 rounded-2xl border border-[var(--color-line)] p-5"
    >
      <div>
        <h2 id="template-tools-title" className="font-display text-[18px] font-bold">
          Template
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
          {used
            ? `Made from “${used.name}”.`
            : "Not linked to a template (an older topic or a deleted template)."}{" "}
          Applying a template updates tiles with the same name and keeps their links.
        </p>
      </div>
      <ActionForm action={apply} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <input type="hidden" name="entry_id" value={entryId} />
        <FormField id="apply-template" label="Apply template">
          <Select id="apply-template" name="template_id" defaultValue={current ?? undefined}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.is_default ? " (default)" : ""} — {template.tiles.length} tiles
              </option>
            ))}
          </Select>
        </FormField>
        <SubmitButton size="sm" variant="outline">
          Apply
        </SubmitButton>
        <Checkbox
          name="remove_missing"
          label="Also remove this topic’s tiles the template doesn’t have (with their links)"
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <ActionStatus state={applied} />
        </div>
      </ActionForm>
      <ActionForm
        action={save}
        className="grid gap-3 border-t border-[var(--color-line)] pt-5 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <input type="hidden" name="entry_id" value={entryId} />
        <FormField id="save-as-template" label="Save these tiles as a new template">
          <Input
            id="save-as-template"
            name="name"
            maxLength={80}
            required
            placeholder="Template name"
          />
        </FormField>
        <SubmitButton size="sm" variant="outline">
          Save as template
        </SubmitButton>
        <div className="sm:col-span-2">
          <ActionStatus state={saved} />
        </div>
      </ActionForm>
    </section>
  );
}

/** A template: name, description, section headings and its tiles. */
export function TemplateForm({ template }: { template: TemplateSummary | null }) {
  const [state, action] = useActionState(saveTemplate, IDLE);
  return (
    <ActionForm action={action} className="grid gap-5">
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="template-name" label="Name" required>
          <Input
            id="template-name"
            name="name"
            required
            maxLength={80}
            defaultValue={template?.name ?? ""}
          />
        </FormField>
        <FormField id="template-description" label="Description">
          <Textarea
            id="template-description"
            name="description"
            rows={1}
            maxLength={300}
            defaultValue={template?.description ?? ""}
          />
        </FormField>
      </div>
      <LabelFields
        prefix="template"
        articles={template?.articles_label ?? "Chapters"}
        learnMore={template?.learn_more_label ?? "Learn more"}
        required
      />
      <TilesEditor
        initial={template?.tiles ?? []}
        note="Topics made from this template get a copy of these tiles; changing the template later doesn’t change them until someone applies it again."
      />
      <ActionStatus state={state} />
      <div>
        <SubmitButton size="sm">{template ? "Save template" : "Create template"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
