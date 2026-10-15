"use client";

import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { IconAction } from "@/components/admin/IconAction";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/field";
import type { TimelineSource } from "@/lib/content-types";
import { cn } from "@/lib/cn";
import { swap } from "@/lib/array";
import { saveTimeline } from "../actions";
import type { EditableTimeline } from "../editorial";
import type { EditableEvent } from "../rows";
import { MAX_EVENTS, MAX_SOURCES, type TimelineOwnerKind } from "../constants";

type Event = Omit<EditableEvent, "body_html"> & {
  key: string;
  /** Only the starting text: the rich text editor keeps the edits and posts them itself. */
  initialHtml: string;
  open: boolean;
};

const blank = (): Event => ({
  key: crypto.randomUUID(),
  date_label: "",
  title: "",
  initialHtml: "",
  sources: [],
  image_url: "",
  open: true,
});

/**
 * The one timeline editor, for a region, a global issue (or custom region), a
 * country and a topic: the heading and subheading of the section, then the
 * events — date, title, rich text and the sources it rests on — added,
 * removed and reordered with buttons (keyboard too). Saved whole in one
 * transaction (saveTimeline). Fields are named the same in every event and
 * read in page order, like the subtopics editor; a key per event keeps the
 * unsaved text when moving it. Events start folded (a portrait has ~20), each
 * opens with its toggle — folded fields are still sent.
 */
export function TimelineEditor({
  kind,
  ownerKey,
  initial,
  lead,
}: {
  kind: TimelineOwnerKind;
  /** Region / issue slug, country ISO3, topic id. */
  ownerKey: string;
  initial: EditableTimeline;
  /** What the timeline shows on the site (differs per owner). */
  lead: string;
}) {
  // Keys of saved events by order — the same on the server and in the browser (hydration).
  const [events, setEvents] = useState<Event[]>(() =>
    initial.events.map(({ body_html, ...event }, index) => ({
      ...event,
      initialHtml: body_html,
      key: `saved-${index}`,
      open: false,
    })),
  );
  const [state, action] = useServerAction(saveTimeline);
  const errors = state.fieldErrors ?? {};
  const change = (key: string, fields: Partial<Event>) =>
    setEvents((current) =>
      current.map((item) => (item.key === key ? { ...item, ...fields } : item)),
    );
  const move = (index: number, by: -1 | 1) =>
    setEvents((current) => swap(current, index, index + by));

  return (
    <section
      aria-labelledby={`timeline-${kind}-title`}
      className="rounded-2xl border border-[var(--color-line)] p-5"
    >
      <h2 id={`timeline-${kind}-title`} className="font-display text-[18px] font-bold">
        Timeline
      </h2>
      <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">{lead}</p>

      <ActionForm action={action} className="mt-5 grid gap-4">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="key" value={ownerKey} />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id={`timeline-${kind}-heading`}
            label="Heading"
            hint="Empty = “How the present came about”."
            errors={errors.timeline_title}
            className="content-start"
          >
            <Input
              id={`timeline-${kind}-heading`}
              name="timeline_title"
              maxLength={120}
              defaultValue={initial.title}
              placeholder="Historical Context of the Region"
            />
          </FormField>
          <FormField
            id={`timeline-${kind}-subheading`}
            label="Subheading"
            errors={errors.timeline_subtitle}
            className="content-start"
          >
            <Input
              id={`timeline-${kind}-subheading`}
              name="timeline_subtitle"
              maxLength={300}
              defaultValue={initial.subtitle}
              placeholder="An overview of the key events."
            />
          </FormField>
        </div>

        <ol className="grid gap-3">
          {events.map((event, index) => {
            const id = (field: string) => `timeline-${event.key}-${field}`;
            const label = `event ${index + 1}`;
            return (
              <li key={event.key}>
                <fieldset className="grid gap-3 rounded-xl bg-[var(--color-line)]/25 p-4">
                  <legend className="sr-only">Event {index + 1}</legend>
                  <input type="hidden" name="image_url" value={event.image_url} />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      aria-expanded={event.open}
                      aria-controls={id("fields")}
                      onClick={() => change(event.key, { open: !event.open })}
                      className="flex min-h-(--touch-min) min-w-0 flex-1 items-center gap-2 rounded-lg text-left text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-link)]"
                    >
                      <ChevronDown
                        size={16}
                        aria-hidden
                        className={cn("shrink-0 transition", event.open && "rotate-180")}
                      />
                      <span className="text-[var(--color-ink-muted)]">{index + 1}.</span>
                      <span className="truncate">
                        {event.title || "New event"}
                        {event.date_label ? (
                          <span className="font-normal text-[var(--color-ink-muted)]">
                            {" "}
                            · {event.date_label}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <span className="flex shrink-0 gap-1">
                      <IconAction
                        label={`Move ${label} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        icon={<ArrowUp size={16} aria-hidden />}
                      />
                      <IconAction
                        label={`Move ${label} down`}
                        disabled={index === events.length - 1}
                        onClick={() => move(index, 1)}
                        icon={<ArrowDown size={16} aria-hidden />}
                      />
                      <IconAction
                        label={`Remove ${label}`}
                        onClick={() =>
                          setEvents((current) => current.filter((item) => item.key !== event.key))
                        }
                        icon={<Trash2 size={16} aria-hidden />}
                      />
                    </span>
                  </div>

                  {/* Folded = hidden, not removed: the fields are still posted. */}
                  <div id={id("fields")} hidden={!event.open} className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                      <FormField id={id("date")} label="Date (“1924”, “March 2014”)" required>
                        <Input
                          id={id("date")}
                          name="date_label"
                          maxLength={60}
                          value={event.date_label}
                          onChange={(e) => change(event.key, { date_label: e.target.value })}
                        />
                      </FormField>
                      <FormField id={id("title")} label="Title" required>
                        <Input
                          id={id("title")}
                          name="title"
                          maxLength={200}
                          value={event.title}
                          onChange={(e) => change(event.key, { title: e.target.value })}
                        />
                      </FormField>
                    </div>
                    <div className="grid gap-1.5">
                      <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
                        Text (cut after ten lines on the site, with “More”)
                      </span>
                      <RichTextEditor
                        name="body_html"
                        initialHtml={event.initialHtml}
                        label={`Event ${index + 1} text`}
                        compact
                      />
                    </div>
                    <SourceList
                      idPrefix={id("source")}
                      sources={event.sources}
                      onChange={(sources) => change(event.key, { sources })}
                    />
                  </div>
                  <input type="hidden" name="sources" value={JSON.stringify(event.sources)} />
                </fieldset>
              </li>
            );
          })}
        </ol>

        {!events.length ? (
          <p className="text-[13px] text-[var(--color-ink-muted)]">
            No events yet — the timeline isn’t shown on the site.
          </p>
        ) : null}

        <ActionStatus state={state} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEvents((current) => [...current, blank()])}
            disabled={events.length >= MAX_EVENTS}
          >
            <Plus size={16} aria-hidden /> Add event
          </Button>
          <SubmitButton size="sm">Save timeline</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}

/** The sources of one event: name and https link, added and removed one by one. */
function SourceList({
  idPrefix,
  sources,
  onChange,
}: {
  idPrefix: string;
  sources: TimelineSource[];
  onChange: (sources: TimelineSource[]) => void;
}) {
  const update = (index: number, field: keyof TimelineSource, value: string) =>
    onChange(sources.map((source, i) => (i === index ? { ...source, [field]: value } : source)));
  return (
    <div className="grid gap-2">
      <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
        Sources (shown under the text)
      </span>
      {sources.map((source, index) => (
        <div
          key={index}
          className="grid items-end gap-2 sm:grid-cols-[2fr_3fr_auto]"
          role="group"
          aria-label={`Source ${index + 1}`}
        >
          <FormField id={`${idPrefix}-${index}-title`} label="Name (empty = the site’s address)">
            <Input
              id={`${idPrefix}-${index}-title`}
              maxLength={300}
              value={source.title}
              onChange={(e) => update(index, "title", e.target.value)}
              placeholder="Britannica – Iranian Revolution"
            />
          </FormField>
          <FormField id={`${idPrefix}-${index}-url`} label="Link (https)">
            <Input
              id={`${idPrefix}-${index}-url`}
              maxLength={1000}
              inputMode="url"
              value={source.url}
              onChange={(e) => update(index, "url", e.target.value)}
              placeholder="https://…"
            />
          </FormField>
          <IconAction
            label={`Remove source ${index + 1}`}
            onClick={() => onChange(sources.filter((_, i) => i !== index))}
            icon={<X size={16} aria-hidden />}
          />
        </div>
      ))}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...sources, { title: "", url: "" }])}
          disabled={sources.length >= MAX_SOURCES}
        >
          <Plus size={16} aria-hidden /> Add source
        </Button>
      </div>
    </div>
  );
}
