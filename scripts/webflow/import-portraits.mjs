#!/usr/bin/env node
/**
 * Imports the portrait content scraped from the old site (data/old-site/portraits.json):
 * per region / global issue its intro, its key-fact cards and its timeline.
 *
 *   node scripts/webflow/import-portraits.mjs [--data data/old-site/portraits.json]
 *        [--apply --project dev|prod] [--sql <file>] [--replace] [--env .env.local]
 *
 * Without --apply or --sql it is a DRY RUN and prints what it read.
 * What it writes, per page of the old site (its `target`: a region or a global issue):
 *   - the intro — only where the portrait has none yet (paragraphs as plain text,
 *     the intro field is plain text);
 *   - the key-fact cards (portrait_metrics, each with its source) — only where the
 *     portrait has none, or with --replace;
 *   - the timeline: heading, subheading and events with rich text and sources —
 *     only where the portrait has no events, or with --replace.
 * So a repeated run never undoes what editors changed in the admin; --replace
 * overwrites cards and timeline with the old site's.
 *
 * --apply writes with the service key into the project whose ref must match
 * --project. --sql writes the same as one SQL transaction for psql as the
 * database owner (production: the database password, no API key needed);
 * a missing region / issue is reported (WARNING) and skipped.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { htmlToText } from "../lib/html.mjs";
// Before the dynamic import of src/lib/security/sanitize.ts below.
import "../lib/ts-imports.mjs";

const PROJECTS = { dev: "bognwszwhxxyjafqzfuh", prod: "ewbzkxialhtwuqlenjof" };
/** The DB limits (migrations 20261013000105, 20261015000060). */
const LIMIT = {
  intro: 5000,
  value: 30,
  label: 80,
  description: 600,
  source: 200,
  url: 1000,
  date: 60,
  title: 200,
  heading: 120,
  subheading: 300,
  html: 20000,
  text: 2000,
  sourceTitle: 300,
  sources: 20,
  events: 60,
};

const { values: args } = parseArgs({
  options: {
    data: { type: "string", default: "data/old-site/portraits.json" },
    apply: { type: "boolean", default: false },
    project: { type: "string" },
    replace: { type: "boolean", default: false },
    env: { type: "string", default: ".env.local" },
    sql: { type: "string" },
  },
});

const { sanitizeRichHtml } = await import("../../src/lib/security/sanitize.ts");
const pages = JSON.parse(readFileSync(args.data, "utf8"));

const clip = (value, max) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const httpsUrl = (url) => {
  const value = String(url ?? "").trim();
  return /^https:\/\/\S+$/.test(value) && value.length <= LIMIT.url ? value : null;
};

/** Plain text of rich text: blocks separated by a blank line (as src/features/timelines/rows.ts). */
function plainText(html, max) {
  const text = htmlToText(html, { blockEnd: "\n\n", lineBreak: "\n" })
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Everything one page writes, checked against the DB limits, without touching the database. */
function plan(name, page) {
  const { kind, slug } = page.target ?? {};
  // eslint-disable-next-line security/detect-unsafe-regex -- the slug pattern of src/lib/validation/common.ts: linear
  if (!["region", "issue"].includes(kind) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug ?? "")) {
    throw new Error(`${name}: target must be a region or issue slug`);
  }
  const skipped = [];
  const metrics = (page.keyFacts ?? [])
    .filter((fact) => {
      const ok = clip(fact.value, 99) && clip(fact.label, 999) && clip(fact.source, 999);
      if (!ok) skipped.push(`card without value, label or source: ${JSON.stringify(fact.label)}`);
      return ok;
    })
    .map((fact) => ({
      value: clip(fact.value, LIMIT.value),
      label: clip(fact.label, LIMIT.label),
      description: clip(fact.description, LIMIT.description),
      source: clip(fact.source, LIMIT.source),
      source_url: httpsUrl(fact.source_url),
    }));
  const events = (page.timeline?.events ?? []).slice(0, LIMIT.events).map((event) => {
    const body_html = sanitizeRichHtml(event.body_html ?? "");
    if (body_html.length > LIMIT.html) throw new Error(`${name}: "${event.title}" text too long`);
    const sources = (event.sources ?? []).flatMap((source) => {
      const url = httpsUrl(source.url);
      if (!url) skipped.push(`source not https: ${source.url}`);
      return url
        ? [{ title: clip(source.title, LIMIT.sourceTitle) || new URL(url).host, url }]
        : [];
    });
    return {
      date_label: clip(event.date, LIMIT.date),
      title: clip(event.title, LIMIT.title),
      body: plainText(body_html, LIMIT.text),
      body_html,
      sources: sources.slice(0, LIMIT.sources),
    };
  });
  for (const event of events) {
    if (!event.date_label || !event.title)
      throw new Error(`${name}: an event without date or title`);
  }
  return {
    name,
    kind,
    slug,
    intro: plainText(page.intro?.html ?? "", LIMIT.intro),
    metrics,
    timeline: {
      title: clip(page.timeline?.title, LIMIT.heading) || null,
      subtitle: clip(page.timeline?.subtitle, LIMIT.subheading) || null,
      events,
    },
    skipped,
  };
}

const plans = Object.entries(pages).map(([name, page]) => plan(name, page));
for (const item of plans) {
  console.log(
    `${item.name} → ${item.kind} ${item.slug}: intro ${item.intro.length} chars, ` +
      `${item.metrics.length} key facts, timeline "${item.timeline.title ?? ""}" with ` +
      `${item.timeline.events.length} events (${item.timeline.events.reduce((n, e) => n + e.sources.length, 0)} sources)` +
      (item.skipped.length ? `\n  skipped: ${item.skipped.join("; ")}` : ""),
  );
}

if (args.sql) {
  writeSql(args.sql);
  process.exit(0);
}
if (!args.apply) {
  console.log(
    `\nDry run — ${plans.length} portraits, nothing written. Live: --apply --project dev, or --sql <file>.`,
  );
  process.exit(0);
}

/**
 * The same import as one SQL transaction (psql as the database owner). Each
 * portrait is one DO block that decides from the database what to write.
 */
function writeSql(file) {
  const blocks = plans.map(({ kind, slug, intro, metrics, timeline }) => {
    const payload = JSON.stringify({ kind, slug, intro, metrics, timeline });
    if (payload.includes("$portrait$")) throw new Error(`${slug}: payload contains the quote tag`);
    return `do $do$
declare
  p jsonb := $portrait$${payload}$portrait$::jsonb;
  v_region text;
  v_special text;
  v_replace boolean := ${args.replace ? "true" : "false"};
  n integer;
begin
  if p ->> 'kind' = 'region' then
    select slug into v_region from regions where slug = p ->> 'slug';
  else
    select slug into v_special from special_regions where slug = p ->> 'slug';
  end if;
  if v_region is null and v_special is null then
    raise warning 'skipped %: no such %', p ->> 'slug', p ->> 'kind';
    return;
  end if;

  -- The intro only where the portrait has none.
  if p ->> 'intro' <> '' then
    update regions set intro = p ->> 'intro' where slug = v_region and btrim(intro) = '';
    get diagnostics n = row_count;
    if n = 0 then
      update special_regions set intro = p ->> 'intro' where slug = v_special and btrim(intro) = '';
      get diagnostics n = row_count;
    end if;
    raise notice '%: intro %', p ->> 'slug', case when n > 0 then 'written' else 'kept' end;
  end if;

  -- Key facts where there are none (or --replace).
  if jsonb_array_length(p -> 'metrics') > 0
     and (v_replace or not exists (select 1 from portrait_metrics
                                    where region_slug = v_region or special_slug = v_special)) then
    delete from portrait_metrics where region_slug = v_region or special_slug = v_special;
    insert into portrait_metrics (region_slug, special_slug, position, value, label, description,
                                  source, source_url)
    select v_region, v_special, (ord - 1)::int, m ->> 'value', m ->> 'label', m ->> 'description',
           m ->> 'source', m ->> 'source_url'
      from jsonb_array_elements(p -> 'metrics') with ordinality as t(m, ord);
    raise notice '%: % key facts written', p ->> 'slug', jsonb_array_length(p -> 'metrics');
  else
    raise notice '%: key facts kept', p ->> 'slug';
  end if;

  -- The timeline where it has no events (or --replace): heading and events together.
  if jsonb_array_length(p -> 'timeline' -> 'events') > 0
     and (v_replace or not exists (select 1 from timeline_events
                                    where region_slug = v_region or special_slug = v_special)) then
    delete from timeline_events where region_slug = v_region or special_slug = v_special;
    insert into timeline_events (region_slug, special_slug, position, date_label, title, body,
                                 body_html, sources)
    select v_region, v_special, (ord - 1)::int, e ->> 'date_label', e ->> 'title', e ->> 'body',
           e ->> 'body_html', e -> 'sources'
      from jsonb_array_elements(p -> 'timeline' -> 'events') with ordinality as t(e, ord);
    update regions set timeline_title = p -> 'timeline' ->> 'title',
                       timeline_subtitle = p -> 'timeline' ->> 'subtitle'
     where slug = v_region;
    update special_regions set timeline_title = p -> 'timeline' ->> 'title',
                               timeline_subtitle = p -> 'timeline' ->> 'subtitle'
     where slug = v_special;
    raise notice '%: timeline with % events written', p ->> 'slug',
      jsonb_array_length(p -> 'timeline' -> 'events');
  else
    raise notice '%: timeline kept', p ->> 'slug';
  end if;
end
$do$;`;
  });
  writeFileSync(file, `begin;\n${blocks.join("\n\n")}\ncommit;\n`);
  console.log(`\nSQL for ${plans.length} portraits → ${file}${args.replace ? " (--replace)" : ""}`);
}

// ---------------------------------------------------------------------------
// Writing through the API (only with --apply)
// ---------------------------------------------------------------------------

const env = { ...readEnvFile(args.env), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const expected = PROJECTS[args.project];
if (!expected || !url.includes(`${expected}.supabase.co`)) {
  console.error(
    `Refused: --project ${args.project ?? "(missing)"} doesn't match the Supabase URL.`,
  );
  process.exit(2);
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const { createClient } = await import("@supabase/supabase-js");
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (result, what) => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
};
async function countOf(table, column, slug) {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, slug);
  if (error) throw new Error(`${table} ${slug}: ${error.message}`);
  return count ?? 0;
}

for (const { kind, slug, intro, metrics, timeline } of plans) {
  const table = kind === "region" ? "regions" : "special_regions";
  const column = kind === "region" ? "region_slug" : "special_slug";
  const owner = must(
    await db.from(table).select("slug, intro").eq("slug", slug).maybeSingle(),
    `${kind} ${slug}`,
  );
  if (!owner) {
    console.warn(`! skipped ${slug}: no such ${kind}`);
    continue;
  }
  const done = [];

  if (intro && !owner.intro.trim()) {
    must(await db.from(table).update({ intro }).eq("slug", slug), `${slug} intro`);
    done.push("intro");
  }

  const cards = await countOf("portrait_metrics", column, slug);
  if (metrics.length && (args.replace || !cards)) {
    must(await db.from("portrait_metrics").delete().eq(column, slug), `${slug} key facts`);
    must(
      await db
        .from("portrait_metrics")
        .insert(metrics.map((metric, position) => ({ ...metric, [column]: slug, position }))),
      `${slug} key facts`,
    );
    done.push(`${metrics.length} key facts`);
  }

  const events = await countOf("timeline_events", column, slug);
  if (timeline.events.length && (args.replace || !events)) {
    must(await db.from("timeline_events").delete().eq(column, slug), `${slug} timeline`);
    must(
      await db
        .from("timeline_events")
        .insert(timeline.events.map((event, position) => ({ ...event, [column]: slug, position }))),
      `${slug} timeline`,
    );
    must(
      await db
        .from(table)
        .update({ timeline_title: timeline.title, timeline_subtitle: timeline.subtitle })
        .eq("slug", slug),
      `${slug} timeline heading`,
    );
    done.push(`timeline with ${timeline.events.length} events`);
  }
  console.log(`✓ ${slug}: ${done.length ? done.join(", ") : "nothing new (all kept)"}`);
}
console.log(
  `\nWritten to ${args.project}. Refresh the portraits: save them once in the admin, or wait up to an hour.`,
);

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}
