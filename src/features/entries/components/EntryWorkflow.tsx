"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormField, Input, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import {
  approveEntry,
  deleteEntry,
  restoreRevision,
  scheduleEntry,
  sendBackEntry,
  submitEntry,
  unpublishEntry,
  unscheduleEntry,
} from "../actions";
import type { Revision } from "../editorial";
import type { EntryStatus } from "../schema";
import { ActionForm } from "@/components/ui/action-form";

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" });

/**
 * Stav článku a kroky schvalování. Tlačítka se ukazují podle práv, ale o tom,
 * jestli krok projde, rozhodují DB funkce (submit/approve/send_back/unpublish).
 */
export function EntryWorkflow({
  id,
  status,
  canApprove,
  canDelete,
  reviewNote,
  publishAt,
}: {
  id: string;
  status: EntryStatus;
  canApprove: boolean;
  canDelete: boolean;
  reviewNote: string | null;
  publishAt: string | null;
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
          <p className="font-medium">Vráceno k úpravě:</p>
          <p className="mt-1 whitespace-pre-line">{reviewNote}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <ConfirmButton
            label="Odeslat ke schválení"
            variant="primary"
            title="Odeslat ke schválení?"
            body="Článek uvidí schvalovatelé. Do rozhodnutí ho můžete dál upravovat."
            confirm="Odeslat"
            action={() => submitEntry(id)}
            onDone={done}
          />
        ) : null}
        {status === "pending" && canApprove ? (
          <ConfirmButton
            label="Schválit a zveřejnit"
            variant="primary"
            title="Zveřejnit článek?"
            body="Článek se hned objeví na webu."
            confirm="Zveřejnit"
            action={() => approveEntry(id)}
            onDone={done}
          />
        ) : null}
        {status === "published" && canApprove ? (
          <ConfirmButton
            label="Stáhnout z webu"
            variant="danger"
            title="Stáhnout článek z webu?"
            body="Článek zmizí z webu a vrátí se do konceptů. Adresa přestane fungovat."
            confirm="Stáhnout"
            action={() => unpublishEntry(id)}
            onDone={done}
          />
        ) : null}
        {canDelete && status !== "published" ? (
          <ConfirmButton
            label="Smazat"
            variant="danger"
            title="Smazat článek natrvalo?"
            body="Smaže se i historie změn. Tohle nejde vrátit."
            confirm="Smazat"
            action={() => deleteEntry(id)}
            onDone={(state) => {
              setResult(state);
              if (state.ok) router.push("/admin/obsah");
            }}
          />
        ) : null}
      </div>

      <ActionStatus state={result} />

      {status === "pending" && publishAt ? (
        <div className="grid gap-3 rounded-xl border border-[var(--color-line)] p-4 text-[13.5px]">
          <p>
            <span className="font-medium">
              Naplánováno na {/* Server formátuje v UTC, prohlížeč v místním čase. */}
              <time dateTime={publishAt} suppressHydrationWarning>
                {dateFormat.format(new Date(publishAt))}
              </time>
              .
            </span>{" "}
            Na webu se objeví nejpozději hodinu po tomto čase. Když článek mezitím upraví někdo
            jiný, plán se zruší.
          </p>
          {canApprove ? (
            <div>
              <ConfirmButton
                label="Zrušit plán"
                title="Zrušit plánované zveřejnění?"
                body="Článek zůstane ve frontě ke schválení."
                confirm="Zrušit plán"
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
 * „Publikovat v čase…": místní čas z pole datetime-local převede prohlížeč na
 * ISO s posunem (server běží v UTC a časové pásmo redaktora nezná).
 */
function Schedule({ id, onDone }: { id: string; onDone: (state: ActionState) => void }) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, data) => {
      const local = String(data.get("publish_at_local") ?? "");
      const at = new Date(local);
      data.set("publish_at", local && !Number.isNaN(at.getTime()) ? at.toISOString() : "");
      data.delete("publish_at_local");
      const next = await scheduleEntry(prev, data);
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
        id="publish_at_local"
        label="Publikovat v čase…"
        hint="Místo okamžitého zveřejnění. Na webu se článek objeví nejpozději hodinu po zvoleném čase."
        errors={state.fieldErrors?.publish_at}
      >
        <Input id="publish_at_local" name="publish_at_local" type="datetime-local" required />
      </FormField>
      <div>
        <SubmitButton variant="outline" pending="Plánuji…">
          Naplánovat zveřejnění
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

function SendBack({ id, onDone }: { id: string; onDone: (state: ActionState) => void }) {
  const [state, action] = useActionState<ActionState, FormData>(
    async (prev, data) => {
      const next = await sendBackEntry(prev, data);
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
        id="note"
        label="Vrátit autorovi s poznámkou"
        hint="Autor poznámku uvidí u článku."
        errors={state.fieldErrors?.note}
      >
        <Textarea id="note" name="note" rows={3} maxLength={2000} required />
      </FormField>
      <div>
        <SubmitButton variant="outline" pending="Vracím…">
          Vrátit k úpravě
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RevisionList({ entryId, revisions }: { entryId: string; revisions: Revision[] }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionState>({ ok: false });
  if (!revisions.length) {
    return <p className="text-[13px] text-[var(--color-ink-muted)]">Zatím žádné starší verze.</p>;
  }
  return (
    <div className="grid gap-2">
      <ActionStatus state={result} />
      <ul className="grid gap-1 text-[13px]">
        {revisions.map((revision) => (
          <li key={revision.id} className="flex items-center justify-between gap-3">
            <span>
              {dateFormat.format(new Date(revision.saved_at))}
              <span className="text-[var(--color-ink-muted)]"> · {revision.title}</span>
            </span>
            <ConfirmButton
              label="Obnovit"
              title="Obnovit tuto verzi?"
              body="Titulek, perex, obrázek a text se vrátí do této podoby. Současná verze zůstane v historii."
              confirm="Obnovit"
              action={() => restoreRevision(entryId, revision.id)}
              onDone={(state) => {
                setResult(state);
                if (state.ok) router.refresh();
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
