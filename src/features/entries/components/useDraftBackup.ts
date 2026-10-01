"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import type { EditableEntry } from "../editorial";

/** Jak často se rozepsaný článek zálohuje do prohlížeče. */
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
    // úložiště zakázané nebo plné — záloha je jen pojistka
  }
}

/** Hodnoty formuláře článku ve tvaru EditableEntry (pro obnovení do polí). */
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
 * Autosave editoru (G2): rozepsaný článek se každých pár sekund uloží do
 * prohlížeče, takže zavřená karta, pád nebo odhlášení o text nepřipraví.
 * Do databáze se zapisuje dál jen tlačítkem (každé uložení = revize).
 * Záloha novější než poslední uložení se nabídne k obnovení.
 */
export function useDraftBackup(
  formRef: RefObject<HTMLFormElement | null>,
  key: string,
  serverUpdatedAt: string | null,
) {
  const hydrated = useHydrated();
  // Záloha z prohlížeče, jen je-li novější než poslední uložení do DB.
  const stored = useMemo(() => {
    const backup = hydrated ? read(key) : null;
    const fresh =
      backup && (!serverUpdatedAt || Date.parse(backup.savedAt) > Date.parse(serverUpdatedAt));
    return fresh ? backup : null;
  }, [hydrated, key, serverUpdatedAt]);
  /** Nabídka vyřízená (obnoveno, zahozeno nebo uloženo). */
  const [handled, setHandled] = useState(false);
  const offer = handled ? null : stored;
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    // Stav z databáze hned po vykreslení — zálohuje se až skutečná změna.
    if (formRef.current) baseline.current = JSON.stringify(snapshot(formRef.current));
    const timer = window.setInterval(() => {
      const form = formRef.current;
      if (!form) return;
      const values = JSON.stringify(snapshot(form));
      // Po obnovení zálohy se výchozí stav bere znovu (pole se přemontovala).
      if (baseline.current === null) baseline.current = values;
      else if (values !== baseline.current) {
        write(key, { savedAt: new Date().toISOString(), values: JSON.parse(values) });
      }
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [formRef, key]);

  /** Po uložení do databáze záloha už není potřeba. */
  const clear = useCallback(() => {
    write(key, null);
    baseline.current = formRef.current ? JSON.stringify(snapshot(formRef.current)) : null;
    setHandled(true);
  }, [formRef, key]);

  const dismiss = useCallback(() => {
    write(key, null);
    setHandled(true);
  }, [key]);

  /** Po obnovení se do polí dostane záloha — ta je teď nový výchozí stav. */
  const accept = useCallback(() => {
    baseline.current = null;
    setHandled(true);
  }, []);

  return { offer, clear, dismiss, accept };
}
