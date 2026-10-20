import type { VisualItem } from "@/lib/content-types";
import { canonicalEmbedUrl, isEmbedProvider } from "@/lib/embeds";
import { safeUrl } from "@/lib/security/urls";
import { VISUAL_KINDS, type VisualKind } from "./constants";
import type { MapSpec } from "./map/types";
import { parseMapSpec } from "./map-spec";
import type { EditableVisual } from "./types";

/**
 * Visual rows ↔ what the site and the editor work with. Pure functions,
 * shared by the public reads (portrait(), the topic page) and the editor.
 */

/**
 * Columns of a visual for the site — the ones anon may read. Not `html`: a
 * custom code's frame loads it by the visual's id (/api/visual-html), so the
 * pages and the cached portrait never carry it.
 */
export const VISUAL_COLUMNS =
  "id, position, kind, title, caption, source_label, source_url, provider, embed_url, image_url, height, map_spec";

/** A row of `visuals` (or an item of portrait()'s `visuals`, which has the same keys). */
export interface VisualRow {
  id: string;
  position?: number;
  kind: string;
  title: string;
  caption?: string | null;
  source_label?: string | null;
  source_url?: string | null;
  provider?: string | null;
  embed_url?: string | null;
  image_url?: string | null;
  height?: number | null;
  map_spec?: unknown;
  html?: string | null;
  updated_at?: string;
}

const byPosition = (a: { position?: number }, b: { position?: number }) =>
  (a.position ?? 0) - (b.position ?? 0);

/** An https URL, or nothing (relative paths, http:, javascript: … never). */
const httpsOnly = (value: unknown) => {
  const url = safeUrl(value);
  return url?.startsWith("https://") ? url : null;
};

const isKind = (value: unknown): value is VisualKind =>
  typeof value === "string" && (VISUAL_KINDS as readonly string[]).includes(value);

/**
 * A stored map spec validated again as it is read: popup HTML is sanitized on
 * render as well as on save (ARCHITEKTURA 8.3), and a spec that no longer
 * passes (written another way, or by an older version) is left out.
 */
function storedMapSpec(value: unknown): MapSpec | null {
  if (value === null || value === undefined) return null;
  const parsed = parseMapSpec(value);
  return parsed.ok ? parsed.spec : null;
}

/**
 * Rows → the carousel's items, in order. Each is checked again here (the DB
 * checks them on write, this is the safety net of what the page frames): an
 * embed only in its provider's canonical shape, an image and a source link
 * only over https, a map only with a spec object. Custom code needs only its
 * id here: its sandboxed frame loads it. Anything else is left out.
 */
export function toVisualItems(rows: readonly VisualRow[] | null | undefined): VisualItem[] {
  return [...(rows ?? [])].sort(byPosition).flatMap((row): VisualItem[] => {
    const title = row.title?.trim();
    if (!title || !isKind(row.kind)) return [];
    const sourceLabel = row.source_label?.trim() ?? "";
    const sourceUrl = httpsOnly(row.source_url) ?? undefined;
    const base = {
      id: row.id,
      title,
      caption: row.caption?.trim() || undefined,
      source: sourceLabel || sourceUrl ? { label: sourceLabel, url: sourceUrl } : undefined,
      height: row.height ?? undefined,
    };
    switch (row.kind) {
      case "embed": {
        const url = canonicalEmbedUrl(row.provider, row.embed_url);
        return url && isEmbedProvider(row.provider)
          ? [{ ...base, kind: "embed", provider: row.provider, url }]
          : [];
      }
      case "image": {
        const url = httpsOnly(row.image_url);
        return url ? [{ ...base, kind: "image", url }] : [];
      }
      case "map": {
        const spec = storedMapSpec(row.map_spec);
        return spec ? [{ ...base, kind: "map", spec }] : [];
      }
      case "html":
        return [{ ...base, kind: "html" }];
    }
  });
}

/** Rows → the editor's visuals (strings for the form, nulls kept where they mean something). */
export function toEditableVisuals(rows: readonly VisualRow[]): EditableVisual[] {
  return [...rows].sort(byPosition).flatMap((row) =>
    isKind(row.kind)
      ? [
          {
            id: row.id,
            kind: row.kind,
            title: row.title,
            caption: row.caption ?? "",
            source_label: row.source_label ?? "",
            source_url: row.source_url ?? "",
            provider: isEmbedProvider(row.provider) ? row.provider : null,
            embed_url: row.embed_url ?? "",
            image_url: row.image_url ?? "",
            height: row.height ?? null,
            map_spec: storedMapSpec(row.map_spec),
            html: row.html ?? "",
            updated_at: row.updated_at ?? "",
          },
        ]
      : [],
  );
}
