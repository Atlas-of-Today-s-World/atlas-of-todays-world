"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import type { EditableEntry } from "../editorial";

/** How often an unsaved article is backed up to the browser. */
const INTERVAL_MS = 5000;
const PREFIX = "atlas:entry-draft:";

export interface DraftBackup {
  savedAt: string;
  values: Partial<EditableEntry>;
}

function read(key: string): DraftBackup | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as DraftBackup) : null;
  } catch {
    return null;
  }
}

function write(key: string, backup: DraftBackup | null) {
  try {
    if (backup) localStorage.setItem(PREFIX + key, JSON.stringify(backup));
    else localStorage.removeItem(PREFIX + key);
  } catch {
    // storage disabled or full — the backup is only a safety net
  }
}

/** Article form values in the EditableEntry shape (for restoring into fields). */
function snapshot(form: HTMLFormElement): Partial<EditableEntry> {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "");
  const minutes = Number(text("reading_minutes"));
  return {
    title: text("title"),
    slug: text("slug"),
    category: text("category"),
    kind: text("kind") === "entry" ? "entry" : "news",
    region_slug: text("region_slug") || null,
    special_slug: text("special_slug") || null,
    countries: data.getAll("countries").map(String),
    summary: text("summary"),
    cover_url: text("cover_url") || null,
    cover_credit: text("cover_credit") || null,
    author_name: text("author_name") || null,
    reading_minutes: minutes > 0 ? minutes : null,
    body_html: text("body_html"),
    ...(form.elements.namedItem("planned")
      ? { status: data.get("planned") ? ("planned" as const) : ("draft" as const) }
      : {}),
  };
}

/**
 * Editor autosave (G2): the unsaved article is stored in the browser every few
 * seconds, so a closed tab, crash or sign-out doesn't lose the text.
 * The database is still written only via the button (each save = a revision).
 * A backup newer than the last save is offered for restore.
 */
export function useDraftBackup(
  formRef: RefObject<HTMLFormElement | null>,
  key: string,
  serverUpdatedAt: string | null,
) {
  const hydrated = useHydrated();
  // Browser backup, only if newer than the last save to the DB.
  const stored = useMemo(() => {
    const backup = hydrated ? read(key) : null;
    const fresh =
      backup && (!serverUpdatedAt || Date.parse(backup.savedAt) > Date.parse(serverUpdatedAt));
    return fresh ? backup : null;
  }, [hydrated, key, serverUpdatedAt]);
  /** Offer resolved (restored, discarded or saved). */
  const [handled, setHandled] = useState(false);
  const offer = handled ? null : stored;
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    // State from the database right after render — only a real change gets backed up.
    if (formRef.current) baseline.current = JSON.stringify(snapshot(formRef.current));
    const timer = window.setInterval(() => {
      const form = formRef.current;
      if (!form) return;
      const values = JSON.stringify(snapshot(form));
      // After restoring a backup the initial state is taken again (the fields remounted).
      if (baseline.current === null) baseline.current = values;
      else if (values !== baseline.current) {
        write(key, { savedAt: new Date().toISOString(), values: JSON.parse(values) });
      }
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [formRef, key]);

  // Leaving the page with unsaved changes: the browser asks (the browser backup
  // is only a safety net; saving to the database is done via the button).
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      const form = formRef.current;
      if (!form || baseline.current === null) return;
      if (JSON.stringify(snapshot(form)) === baseline.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [formRef]);

  /** After saving to the database the backup is no longer needed. */
  const clear = useCallback(() => {
    write(key, null);
    baseline.current = formRef.current ? JSON.stringify(snapshot(formRef.current)) : null;
    setHandled(true);
  }, [formRef, key]);

  const dismiss = useCallback(() => {
    write(key, null);
    setHandled(true);
  }, [key]);

  /** After restore the backup is in the fields — it is now the new initial state. */
  const accept = useCallback(() => {
    baseline.current = null;
    setHandled(true);
  }, []);

  return { offer, clear, dismiss, accept };
}
