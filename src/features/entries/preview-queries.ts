import "server-only";
import { DEFAULT_LOCALE } from "@/features/i18n/config";
import { sanitizeRichHtml } from "@/lib/security/sanitize";
import { createPublicClient } from "@/lib/supabase/public";
import type { Entry } from "./queries";
import { toSummary } from "./rows";
import {
  type AuthorRow,
  type ChapterRow,
  type Encyclopedia,
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
  const [base, extra] = await Promise.all([
    client.rpc("entry_preview", { p_token: token }).maybeSingle(),
    client.rpc("entry_preview_parts", { p_token: token }).maybeSingle(),
  ]);
  if (base.error) throw new Error(`[preview] ${base.error.message}`);
  if (extra.error) throw new Error(`[preview] ${extra.error.message}`);
  if (!base.data || !extra.data) return null;
  const { countries, body_html, status, expires_at, ...row } = base.data;
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
  if (extra.data.kind !== "entry") return { ...meta, kind: "news", item };
  return {
    ...meta,
    kind: "entry",
    item: toEncyclopedia(item, {
      summary_points: extra.data.summary_points,
      author: extra.data.author as AuthorRow | null,
      chapters: extra.data.chapters as unknown as ChapterRow[],
      resources: extra.data.resources as unknown as ResourceRow[],
      tiles: extra.data.tiles as unknown as TileRow[],
      notes: extra.data.notes as unknown as NoteRow[],
      labels: {
        articles_label: extra.data.articles_label,
        learn_more_label: extra.data.learn_more_label,
      },
    }),
  };
}
