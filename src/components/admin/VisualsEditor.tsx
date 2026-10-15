import Link from "next/link";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import {
  deleteAction,
  editAction,
  moveActions,
  type RowAction,
} from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import type { ActionState } from "@/lib/action-state";
import { EMBED_PROVIDER_INFO } from "@/lib/embeds";
import { VISUAL_KIND_LABEL, VISUAL_KINDS } from "@/features/visuals/constants";
import type { EditableVisual, VisualOwner } from "@/features/visuals/types";
import { ReadOnly } from "./ReadOnly";
import { VisualForm } from "./VisualForm";

const KIND_OPTIONS = VISUAL_KINDS.map((kind) => ({
  value: kind,
  label: VISUAL_KIND_LABEL[kind],
  tone: kind === "map" ? ("warning" as const) : ("neutral" as const),
}));

/** The Server Actions of features/visuals, handed in by the page (components don't import them). */
export interface VisualsActions {
  save: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  remove: (id: string) => Promise<ActionState>;
  move: (id: string, up: boolean) => Promise<ActionState>;
}

/**
 * "Maps & charts" of one owner — a region, a global issue, a topic or a
 * subtopic — in the admin, the same everywhere: the visuals in their order
 * (DataTable: move up / down, edit, delete) and a form below to add one, or
 * to change the one picked with "Edit" (`editing`, the page's `?visual=`).
 * Who may change what is decided by the database (can_edit_visual); `canEdit`
 * / `canRemove` only show the controls accordingly.
 */
export function VisualsEditor({
  owner,
  visuals,
  actions,
  pageHref,
  editing,
  canEdit,
  canRemove = canEdit,
  readOnlyReason = "You can't change these maps and charts.",
  title = "Maps & charts",
  lead,
  headingLevel = 2,
}: {
  owner: VisualOwner;
  visuals: EditableVisual[];
  actions: VisualsActions;
  /** This page with a visual open in the form (`?visual=`; `null`: with the add form). */
  pageHref: (id: string | null) => string;
  /** Id of the visual open in the form, if it is one of these. */
  editing?: string;
  canEdit: boolean;
  canRemove?: boolean;
  readOnlyReason?: string;
  title?: string;
  lead?: string;
  headingLevel?: 2 | 3;
}) {
  const anchor = `visuals-${owner.kind}-${owner.key}`;
  // "Edit" lands on the form, "Done" back on the list.
  const hrefFor = (id: string | null) => `${pageHref(id)}#${id ? `${anchor}-form` : anchor}`;
  const current = visuals.find((visual) => visual.id === editing);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className="scroll-mt-4 rounded-2xl border border-[var(--color-line)] p-5"
    >
      <Heading id={`${anchor}-title`} className="font-display text-[18px] font-bold">
        {title}
      </Heading>
      <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
        {lead ??
          "Interactive charts and maps shown as a carousel, one at a time, in this order. Paste a chart's embed code or link from Datawrapper, Flourish, Our World in Data or the World Bank data site; only the chart's address is kept."}
      </p>

      <div className="mt-4">
        <DataTable
          tableKey={`admin-visuals-${owner.kind}`}
          caption={title}
          compact
          emptyTitle="No maps or charts yet"
          initialSort={{ key: "order", dir: "asc" }}
          stats={optionStats("kind", KIND_OPTIONS)}
          maxRowActions={(canEdit ? 3 : 0) + (canRemove ? 1 : 0)}
          columns={[
            { key: "order", label: "#", kind: "number", sortable: true, width: "56px" },
            {
              key: "title",
              label: "Title",
              link: canEdit,
              sortable: true,
              filter: "text",
              width: "minmax(180px, 2fr)",
            },
            {
              key: "kind",
              label: "Type",
              kind: "badge",
              options: KIND_OPTIONS,
              filter: "select",
              width: "136px",
            },
            { key: "provider", label: "From", filter: "select", width: "minmax(120px, 1fr)" },
            { key: "updated", label: "Changed", kind: "date", sortable: true, width: "120px" },
          ]}
          rows={visuals.map((visual, index) => {
            const href = hrefFor(visual.id);
            const rowActions: RowAction[] = [
              ...(canEdit
                ? [
                    ...moveActions(
                      actions.move.bind(null, visual.id, true),
                      actions.move.bind(null, visual.id, false),
                      { first: index === 0, last: index === visuals.length - 1 },
                    ),
                    editAction(href),
                  ]
                : []),
              ...(canRemove
                ? [deleteAction(actions.remove.bind(null, visual.id), `“${visual.title}”`)]
                : []),
            ];
            return {
              id: visual.id,
              href: canEdit ? href : undefined,
              values: {
                order: index + 1,
                title: visual.title,
                kind: visual.kind,
                provider: visual.provider
                  ? EMBED_PROVIDER_INFO[visual.provider].label
                  : visual.kind === "image"
                    ? "Image"
                    : "Atlas",
                updated: visual.updated_at,
              },
              actions: <RowActions actions={rowActions} />,
            };
          })}
        />
      </div>

      <ReadOnly readOnly={!canEdit} reason={readOnlyReason}>
        <div
          id={`${anchor}-form`}
          className="mt-6 scroll-mt-4 rounded-xl bg-[var(--color-line)]/25 p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Heading className="text-[14px] font-semibold">
              {current ? `Edit “${current.title}”` : "Add a map or chart"}
            </Heading>
            {current ? (
              <Link
                href={hrefFor(null)}
                className="inline-flex min-h-(--touch-min) items-center text-[13px] text-[var(--color-link)] underline"
              >
                Done — add another instead
              </Link>
            ) : null}
          </div>
          <VisualForm
            // A new form for each visual (and back to an empty one).
            key={current?.id ?? "new"}
            idPrefix={anchor}
            owner={owner}
            visual={current}
            action={actions.save}
          />
        </div>
      </ReadOnly>
    </section>
  );
}
