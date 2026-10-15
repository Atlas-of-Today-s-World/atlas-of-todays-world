"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormField, Input, Textarea } from "@/components/ui/field";
import { adminRoutes } from "@/config/routes";
import type { ActionState } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { deleteEntry, restoreRevision } from "../actions";
import {
  approveEntry,
  scheduleEntry,
  sendBackEntry,
  submitEntry,
  unpublishEntry,
  unscheduleEntry,
  withdrawEntry,
} from "../workflow-actions";
import type { Revision } from "../revisions";
import type { EntryStatus } from "../constants";
import { ActionForm } from "@/components/ui/action-form";

/**
 * Article status and approval steps. Buttons are shown per permissions, but
 * whether a step succeeds is decided by DB functions
 * (submit/withdraw/approve/send_back/unpublish). A pending article is frozen
 * for everyone but its approvers; its editors withdraw it to change it.
 */
export function EntryWorkflow({
  id,
  status,
  canApprove,
  canWithdraw,
  canDelete,
  reviewNote,
  publishAt,
  updatedAt,
}: {
  id: string;
  status: EntryStatus;
  canApprove: boolean;
  /** Edits the article (its author, or an editor of everyone's articles). */
  canWithdraw: boolean;
  canDelete: boolean;
  reviewNote: string | null;
  publishAt: string | null;
  /** The version shown on this page — approval is refused if the article changed since. */
  updatedAt: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionState>({ ok: false });
  const done = (state: ActionState) => {
    setResult(state);
    if (state.ok) router.refresh();
  };

  return (
    <div className="grid gap-4">
      {reviewNote && status === "draft" ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[13.5px]">
          <p className="font-medium">Returned for changes:</p>
          <p className="mt-1 whitespace-pre-line">{reviewNote}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <ConfirmButton
            label="Submit for approval"
            variant="primary"
            title="Submit for approval?"
            body="Article approvers will see it. While it waits for approval it can't be changed; withdraw it from review if you need to edit it again."
            confirm="Submit"
            action={() => submitEntry(id)}
            onDone={done}
          />
        ) : null}
        {status === "pending" && canApprove ? (
          <ConfirmButton
            label="Approve and publish"
            variant="primary"
            title="Publish the article?"
            body="The article will appear on the website right away, exactly as shown on this page."
            confirm="Publish"
            action={() => approveEntry(id, updatedAt)}
            onDone={done}
          />
        ) : null}
        {status === "pending" && canWithdraw ? (
          <ConfirmButton
            label="Withdraw from review"
            title="Withdraw the article from review?"
            body="It returns to drafts so you can edit it, and any scheduled publication is canceled. Submit it again when it's ready."
            confirm="Withdraw"
            action={() => withdrawEntry(id)}
            onDone={done}
          />
        ) : null}
        {status === "published" && canApprove ? (
          <ConfirmButton
            label="Unpublish"
            variant="danger"
            title="Unpublish the article?"
            body="The article will disappear from the website and return to drafts. Its URL will stop working."
            confirm="Unpublish"
            action={() => unpublishEntry(id)}
            onDone={done}
          />
        ) : null}
        {canDelete && status !== "published" ? (
          <ConfirmButton
            label="Delete"
            variant="danger"
            title="Delete the article permanently?"
            body="Its change history will be deleted too. This can't be undone."
            confirm="Delete"
            action={() => deleteEntry(id)}
            onDone={(state) => {
              setResult(state);
              if (state.ok) router.push(adminRoutes.content.list);
            }}
          />
        ) : null}
      </div>

      <ActionStatus state={result} />

      {status === "pending" && publishAt ? (
        <div className="grid gap-3 rounded-xl border border-[var(--color-line)] p-4 text-[13.5px]">
          <p>
            <span className="font-medium">
              Scheduled for {/* The server formats in UTC, the browser in local time. */}
              <time dateTime={publishAt} suppressHydrationWarning>
                {formatDateTime(publishAt)}
              </time>
              .
            </span>{" "}
            It will appear on the website within an hour of this time. If someone else edits the
            article in the meantime, the schedule is canceled.
          </p>
          {canApprove ? (
            <div>
              <ConfirmButton
                label="Cancel schedule"
                title="Cancel the scheduled publication?"
                body="The article will stay in the approval queue."
                confirm="Cancel schedule"
                action={() => unscheduleEntry(id)}
                onDone={done}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {status === "pending" && canApprove && !publishAt ? <Schedule id={id} onDone={done} /> : null}
      {status === "pending" && canApprove ? <SendBack id={id} onDone={done} /> : null}
    </div>
  );
}

/**
 * "Publish at a set time…": the browser converts local time from the datetime-local
 * field to ISO with offset (the server runs in UTC and doesn't know the editor's time zone).
 */
function Schedule({ id, onDone }: { id: string; onDone: (state: ActionState) => void }) {
  return (
    <WorkflowNoteForm
      id={id}
      onDone={onDone}
      action={scheduleEntry}
      prepare={(data) => {
        const local = String(data.get("publish_at_local") ?? "");
        const at = new Date(local);
        data.set("publish_at", local && !Number.isNaN(at.getTime()) ? at.toISOString() : "");
        data.delete("publish_at_local");
      }}
      field={{
        id: "publish_at_local",
        errorKey: "publish_at",
        label: "Publish at a set time…",
        hint: "Instead of publishing now. The article will appear on the website within an hour of the chosen time.",
      }}
      submit={{ label: "Schedule publication", pending: "Scheduling…" }}
    >
      <Input id="publish_at_local" name="publish_at_local" type="datetime-local" required />
    </WorkflowNoteForm>
  );
}

function SendBack({ id, onDone }: { id: string; onDone: (state: ActionState) => void }) {
  return (
    <WorkflowNoteForm
      id={id}
      onDone={onDone}
      action={sendBackEntry}
      field={{
        id: "note",
        label: "Return to the author with a note",
        hint: "The author will see the note on the article.",
      }}
      submit={{ label: "Request changes", pending: "Returning…" }}
    >
      <Textarea id="note" name="note" rows={3} maxLength={2000} required />
    </WorkflowNoteForm>
  );
}

/**
 * A workflow step that needs one input first (a publication time, a note for
 * the author): a framed form with the article id, the field and its errors,
 * and an outline submit button. `prepare` adjusts the data before it's sent.
 */
function WorkflowNoteForm({
  id,
  onDone,
  action: serverAction,
  prepare,
  field,
  submit,
  children,
}: {
  id: string;
  onDone: (state: ActionState) => void;
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  prepare?: (data: FormData) => void;
  /** The control's id; `errorKey` when the server reports errors under another name. */
  field: { id: string; errorKey?: string; label: string; hint: string };
  submit: { label: string; pending: string };
  children: ReactNode;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, data) => {
      prepare?.(data);
      const next = await serverAction(prev, data);
      onDone(next);
      return next;
    },
    { ok: false },
  );
  return (
    <ActionForm
      action={action}
      className="grid gap-3 rounded-xl border border-[var(--color-line)] p-4"
    >
      <input type="hidden" name="id" value={id} />
      <FormField
        id={field.id}
        label={field.label}
        hint={field.hint}
        errors={state.fieldErrors?.[field.errorKey ?? field.id]}
      >
        {children}
      </FormField>
      <div>
        <SubmitButton variant="outline" pending={submit.pending}>
          {submit.label}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Saved versions of the article (last 30) with restore — a compact DataTable. */
export function RevisionList({ entryId, revisions }: { entryId: string; revisions: Revision[] }) {
  return (
    <DataTable
      compact
      tableKey="admin-entry-revisions"
      caption="Earlier versions"
      emptyTitle="No earlier versions yet"
      columns={[
        { key: "saved", label: "Saved", kind: "datetime", width: "150px" },
        { key: "title", label: "Title", width: "minmax(160px, 1fr)" },
      ]}
      rows={revisions.map((revision) => ({
        id: String(revision.id),
        values: { saved: revision.saved_at, title: revision.title },
        actions: (
          <RowActions
            actions={[
              {
                kind: "action",
                icon: "restore",
                label: "Restore",
                action: () => restoreRevision(entryId, revision.id),
                confirmTitle: "Restore this version?",
                confirmBody:
                  "The title, summary, image and text will revert to this version. The current version stays in the history.",
              },
            ]}
          />
        ),
      }))}
    />
  );
}
