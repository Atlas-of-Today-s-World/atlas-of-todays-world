"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { createPreviewLink } from "../actions";
import { PREVIEW_HOURS } from "../constants";

const LABELS: Record<(typeof PREVIEW_HOURS)[number], string> = {
  24: "1 den",
  72: "3 dny",
  168: "7 dní",
  720: "30 dní",
};

/**
 * Náhled článku tak, jak bude vypadat na webu, a odkaz pro lidi bez účtu
 * (G2). Odkaz platí zvolenou dobu; kdo ho má, článek uvidí i nezveřejněný.
 */
export function PreviewShare({ entryId }: { entryId: string }) {
  const [hours, setHours] = useState<number>(PREVIEW_HOURS[0]);
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>({ ok: false });
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const result = await createPreviewLink(entryId, hours);
      setState(result);
      setCopied(false);
      setUrl(result.token ? `${window.location.origin}/preview/${result.token}` : null);
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <FormField id="preview-hours" label="Platnost odkazu">
          <Select
            id="preview-hours"
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
          >
            {PREVIEW_HOURS.map((value) => (
              <option key={value} value={value}>
                {LABELS[value]}
              </option>
            ))}
          </Select>
        </FormField>
        <Button type="button" variant="outline" disabled={pending} onClick={create}>
          {pending ? "Vytvářím…" : "Vytvořit náhled"}
        </Button>
      </div>
      <ActionStatus state={state} />
      {url ? (
        <div className="grid gap-2">
          <Input
            readOnly
            value={url}
            aria-label="Odkaz na náhled"
            onFocus={(e) => e.target.select()}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              <Copy aria-hidden className="size-4" /> {copied ? "Zkopírováno" : "Kopírovat"}
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-(--touch-min) items-center gap-1.5 px-2 text-[13px] text-[var(--color-link)] underline"
            >
              <ExternalLink aria-hidden className="size-4" /> Otevřít náhled
            </a>
          </div>
          <p className="text-[12px] text-[var(--color-ink-muted)]">
            Kdo odkaz má, uvidí článek bez přihlášení. Zrušit jde smazáním článku nebo vypršením.
          </p>
        </div>
      ) : null}
    </div>
  );
}
