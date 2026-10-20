import { z } from "zod";
import { EMBED_HEIGHT, MAX_EMBED_LENGTH, parseEmbed } from "@/lib/embeds";
import {
  blankToUndefined,
  optionalHttpsUrl,
  optionalNumber,
  requiredText,
  SLUG,
  text,
  uuid,
} from "@/lib/validation/common";
import { VISUAL_KINDS, VISUAL_LIMITS, VISUAL_OWNERS, type VisualOwnerKind } from "./constants";
import { parseMapSpec } from "./map-spec";

/**
 * A visual as the admin form posts it and the `visuals` table stores it
 * (migration 20261015000100). Limits match the DB CHECKs. The form posts the
 * embed as the editor pasted it (code or link); only the provider and the
 * canonical URL parsed out of it are stored — never the HTML. Custom code
 * (kind 'html', ADR-032) is the one exception: it is stored as pasted, and
 * the site only ever serves it sandboxed, on its own (lib/visual-html.ts).
 */

/** The owner's key: a region / issue slug, a topic's or subtopic's id. */
const KEY: Record<VisualOwnerKind, z.ZodType<string>> = {
  region: z.string().regex(SLUG).max(120),
  issue: z.string().regex(SLUG).max(120),
  entry: uuid,
  chapter: uuid,
};

const VisualOwnerInput = z
  .object({ owner_kind: z.enum(VISUAL_OWNERS), owner_key: z.string() })
  .refine((owner) => KEY[owner.owner_kind].safeParse(owner.owner_key).success, "Invalid owner.");

export const EMBED_HINT =
  "Paste the embed code or the chart's link from Datawrapper, Flourish, Our World in Data or the World Bank data site.";

export const HTML_TOO_LONG = `The code is too long: at most ${VISUAL_LIMITS.html / 1024} kB.`;

/** Columns a save writes, besides the owner (the same for insert and update). */
interface StoredVisual {
  kind: (typeof VISUAL_KINDS)[number];
  title: string;
  caption: string;
  source_label: string;
  source_url: string | null;
  provider: string | null;
  embed_url: string | null;
  image_url: string | null;
  height: number | null;
  map_spec: Record<string, unknown> | null;
  html: string | null;
}

/** JSON text of the map builder → its value; a bad or oversized text → an issue. */
function mapSpecOf(raw: string, ctx: z.RefinementCtx) {
  if (new TextEncoder().encode(raw).length > VISUAL_LIMITS.mapSpec) {
    ctx.addIssue({ code: "custom", path: ["map_spec"], message: "The map is too large." });
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw || "null");
  } catch {
    ctx.addIssue({ code: "custom", path: ["map_spec"], message: "The map could not be read." });
    return null;
  }
  const parsed = parseMapSpec(json);
  if (!parsed.ok) {
    ctx.addIssue({ code: "custom", path: ["map_spec"], message: parsed.error });
    return null;
  }
  return parsed.spec;
}

export const VisualInput = VisualOwnerInput.and(
  z.object({
    // Empty = a new visual.
    id: z.preprocess(blankToUndefined, uuid.optional()),
    kind: z.enum(VISUAL_KINDS),
    title: requiredText(VISUAL_LIMITS.title),
    caption: text(VISUAL_LIMITS.caption).default(""),
    source_label: text(VISUAL_LIMITS.sourceLabel).default(""),
    source_url: optionalHttpsUrl,
    // The pasted embed code or link (kind 'embed').
    embed: z.string().max(MAX_EMBED_LENGTH, "The embed code is too long.").default(""),
    image_url: optionalHttpsUrl,
    height: optionalNumber(
      z
        .number()
        .int("A whole number of pixels.")
        .min(EMBED_HEIGHT.min, `At least ${EMBED_HEIGHT.min} px.`)
        .max(EMBED_HEIGHT.max, `At most ${EMBED_HEIGHT.max} px.`),
    ),
    // The map builder's spec as JSON text (kind 'map').
    map_spec: z.string().default(""),
    // Custom code (kind 'html'); the byte limit is checked below.
    html: z.string().max(VISUAL_LIMITS.html, HTML_TOO_LONG).default(""),
  }),
).transform((input, ctx) => {
  const stored: StoredVisual = {
    kind: input.kind,
    title: input.title,
    caption: input.caption,
    source_label: input.source_label,
    source_url: input.source_url ?? null,
    provider: null,
    embed_url: null,
    image_url: null,
    height: input.height ?? null,
    map_spec: null,
    html: null,
  };
  if (input.kind === "embed") {
    const embed = parseEmbed(input.embed);
    if (!embed) ctx.addIssue({ code: "custom", path: ["embed"], message: EMBED_HINT });
    else Object.assign(stored, { provider: embed.provider, embed_url: embed.url });
  } else if (input.kind === "image") {
    if (!input.image_url) {
      ctx.addIssue({ code: "custom", path: ["image_url"], message: "Add the image." });
    } else stored.image_url = input.image_url;
  } else if (input.kind === "html") {
    if (!input.html.trim()) {
      ctx.addIssue({ code: "custom", path: ["html"], message: "Paste the code." });
    } else if (new TextEncoder().encode(input.html).length > VISUAL_LIMITS.html) {
      ctx.addIssue({ code: "custom", path: ["html"], message: HTML_TOO_LONG });
    } else stored.html = input.html;
  } else {
    stored.map_spec = mapSpecOf(input.map_spec, ctx);
  }
  return {
    id: input.id,
    owner: { kind: input.owner_kind, key: input.owner_key },
    visual: stored,
  };
});
export type VisualInput = z.output<typeof VisualInput>;
