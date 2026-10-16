"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, useTransition } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import {
  DEFAULT_SECTION_ORDER,
  SECTION_LABEL,
  type SectionKey,
} from "@/features/portraits/section-order";

/**
 * The one order of the portrait sections (Admin → Portrait layout). Up and
 * down buttons rather than dragging: they work from the keyboard and on a
 * phone, and a list of five needs no more. Nothing is saved until "Save
 * order", so trying out an order costs nothing.
 */
export function SectionOrderEditor({
  initial,
  canEdit,
  save,
}: {
  initial: readonly SectionKey[];
  canEdit: boolean;
  save: (order: SectionKey[]) => Promise<ActionState>;
}) {
  const [order, setOrder] = useState<SectionKey[]>([...initial]);
  const [saved, setSaved] = useState<SectionKey[]>([...initial]);
  const [state, setState] = useState<ActionState>({ ok: false });
  const [pending, startTransition] = useTransition();

  const changed = order.join() !== saved.join();
  const isDefault = order.join() === DEFAULT_SECTION_ORDER.join();

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    const here = order[index];
    const there = order[target];
    if (here === undefined || there === undefined) return;
    const next = [...order];
    next[index] = there;
    next[target] = here;
    setOrder(next);
    setState({ ok: false });
  }

  function submit() {
    startTransition(async () => {
      const result = await save(order);
      setState(result);
      if (result.ok) setSaved(order);
    });
  }

  return (
    <div className="max-w-xl">
      <ol className="grid gap-2" aria-label="Portrait sections in their order">
        <li className="flex min-h-(--touch-min) items-center rounded-xl border border-dashed border-[var(--color-line)] px-4 text-[13px] text-[var(--color-ink-muted)]">
          Intro and key facts — always first
        </li>
        {order.map((key, index) => (
          <li
            key={key}
            className="flex min-h-(--touch-min) items-center gap-3 rounded-xl border border-[var(--color-line)] bg-white px-4"
          >
            <span className="w-6 text-[13px] text-[var(--color-ink-muted)] tabular-nums">
              {index + 1}.
            </span>
            <span className="flex-1 text-[14px] font-medium text-[var(--color-ink)]">
              {SECTION_LABEL[key]}
            </span>
            {canEdit ? (
              <span className="flex gap-1">
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label={`Move ${SECTION_LABEL[key]} up`}
                  disabled={index === 0 || pending}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden className="size-4" />
                </Button>
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label={`Move ${SECTION_LABEL[key]} down`}
                  disabled={index === order.length - 1 || pending}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden className="size-4" />
                </Button>
              </span>
            ) : null}
          </li>
        ))}
        <li className="flex min-h-(--touch-min) items-center rounded-xl border border-dashed border-[var(--color-line)] px-4 text-[13px] text-[var(--color-ink-muted)]">
          Call for support — always last
        </li>
      </ol>

      {canEdit ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={!changed || pending}>
            {pending ? "Saving…" : "Save order"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOrder([...DEFAULT_SECTION_ORDER]);
              setState({ ok: false });
            }}
            disabled={isDefault || pending}
          >
            Back to the agreed order
          </Button>
        </div>
      ) : null}
      <div className="mt-4">
        <ActionStatus state={state} />
      </div>
    </div>
  );
}
