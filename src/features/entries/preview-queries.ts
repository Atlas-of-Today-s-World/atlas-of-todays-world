import "server-only";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { must } from "@/lib/db/result";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { createPublicClient } from "@/lib/supabase/public";
import type { VisualRow } from "@/features/visuals/rows";
import type { Encyclopedia, Entry } from "./types";
import { toSummary } from "./rows";
import {
  type AuthorRow,
  type ChapterRow,
  type NoteRow,
  type ResourceRow,
  type TileRow,
  toEncyclopedia,
} from "./topic-queries";

/** Preview by link token (any status): a news item, or an entry including chapters. */
export type Preview = { status: string; expiresAt: string } & (
  { kind: "news"; item: Entry } | { kind: "entry"; item: Encyclopedia }
);

/** null = invalid or expired link. */
export async function getPreview(token: string): Promise<Preview | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  // No cache: the link may be revoked or expired and draft text keeps changing.
  const client = createPublicClient();
  const [base, extra, visuals] = await Promise.all([
    client.rpc("entry_preview", { p_token: token }).maybeSingle(),
    client.rpc("entry_preview_parts", { p_token: token }).maybeSingle(),
    client.rpc("entry_preview_visuals", { p_token: token }),
  ]);
  const baseRow = must(base, "preview");
  const parts = must(extra, "preview");
  if (!baseRow || !parts) return null;
  const { countries, body_html, status, expires_at, ...row } = baseRow;
  // The RPC doesn't return the preview language; previews aren't indexed and need no hreflang or note.
  const item: Entry = {
    ...toSummary({
      ...row,
      locale: DEFAULT_LOCALE,
      entry_countries: countries.map((iso3) => ({ country_iso3: iso3 })),
      authors: null,
    }),
    html: sanitizeRichHtml(body_html),
    locale: DEFAULT_LOCALE,
  };
  const meta = { status, expiresAt: expires_at };
  if (parts.kind !== "entry") return { ...meta, kind: "news", item };
  // Maps & charts (migration 20261016000300). A database without the function yet
  // still shows the rest of the preview, just without the carousel.
  if (visuals.error) console.error("[preview] visuals:", visuals.error.message);
  const rows = (visuals.data ?? []) as (VisualRow & { chapter_position: number | null })[];
  const chapters = (parts.chapters as unknown as ChapterRow[]).map((chapter) => ({
    ...chapter,
    visuals: rows.filter((row) => row.chapter_position === chapter.position),
  }));
  return {
    ...meta,
    kind: "entry",
    item: toEncyclopedia(item, {
      summary_points: parts.summary_points,
      author: parts.author as AuthorRow | null,
      chapters,
      resources: parts.resources as unknown as ResourceRow[],
      tiles: parts.tiles as unknown as TileRow[],
      notes: parts.notes as unknown as NoteRow[],
      labels: {
        articles_label: parts.articles_label,
        learn_more_label: parts.learn_more_label,
      },
      visuals: rows.filter((row) => row.chapter_position === null),
    }),
  };
}
