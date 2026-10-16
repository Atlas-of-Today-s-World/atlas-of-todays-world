import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Cookie-less conversion counter (migration 20261016000010_conversion_events):
 * only the server (service role) records an event, through record_event() with
 * its allowlists and length limits; the table holds daily counts and nothing
 * that identifies a visitor; anon and accounts without members "v" read nothing
 * and write nothing, members "v" (and the admin) read the counts.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000003e01",
  permAdmin: "00000000-0000-4000-8000-000000003e02",
  editor: "00000000-0000-4000-8000-000000003e03",
  reader: "00000000-0000-4000-8000-000000003e04",
};

const q = async (sql, params = []) => (await db.query(sql, params)).rows;

/** Expected database error; returns its message. */
async function refused(promise, pattern) {
  try {
    await promise;
  } catch (error) {
    if (pattern) assert.match(String(error.message), pattern);
    return error.message;
  }
  assert.fail("expected a refusal, but it went through");
}

/** Runs `fn` as a signed-in user with a second factor (null = anonymous reader). */
async function as(user, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false);
    select set_config('request.jwt.claims', '{"aal":"aal2"}', false);`);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);`);
  }
}

/** Runs `fn` as the server's service key (the /api/e route handler). */
async function asService(fn) {
  await db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const record = (event, path, ref) =>
  q("select record_event($1, $2, $3)", [event, path, ref]).then(() => undefined);

const counts = async () =>
  (
    await q(
      `select event, path_group, referrer_group, count from conversion_events_daily
       order by event, path_group, referrer_group`,
    )
  ).map((row) => `${row.event} ${row.path_group} ${row.referrer_group} ${row.count}`);

before(async () => {
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    try {
      await db.exec(readFileSync(join(migrations, file), "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
  }
  for (const [uid, role, kind] of [
    [id.admin, "admin", "staff"],
    [id.permAdmin, "permission-admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.reader, "reader", "reader"],
  ]) {
    await q("insert into auth.users (id, email) values ($1, $2)", [
      uid,
      `${role}-conv@atlasoftodaysworld.org`,
    ]);
    await q("update profiles set role_id = $2, kind = $3, status = 'active' where id = $1", [
      uid,
      role,
      kind,
    ]);
  }
});

test("conversions: the table holds counts only — no column for an IP, agent, account or URL", async () => {
  const columns = (
    await q(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'conversion_events_daily'
       order by ordinal_position`,
    )
  ).map((row) => row.column_name);
  assert.deepEqual(columns, [
    "day",
    "event",
    "path_group",
    "referrer_group",
    "count",
    "updated_at",
  ]);
});

test("conversions: the server records a hit; repeats add up in one daily row", async () => {
  await asService(async () => {
    await record("donate_click", "/membership", "");
    await record("donate_click", "/membership?amount=50#card", null);
    await record("share_click", "/topics/some-topic", "none");
    await record("ai_referral", "/", "chatgpt");
    await record("topic_write_click", "/country/ukraine", "perplexity");
  });
  assert.deepEqual(await counts(), [
    "ai_referral / chatgpt 1",
    "donate_click /membership none 2",
    "share_click /topics none 1",
    "topic_write_click /country perplexity 1",
  ]);
});

test("conversions: a page outside the public sections is counted as /other", async () => {
  await q("delete from conversion_events_daily");
  await asService(async () => {
    await record("share_click", "/Some-Made-Up-Path/x", "none");
    await record("share_click", "/admin/members", "none");
    await record("share_click", "//evil.example/topics", "none");
    await record("share_click", "/GLOBAL-ISSUE/climate", "none");
  });
  assert.deepEqual(await counts(), [
    "share_click /global-issue none 1",
    "share_click /other none 3",
  ]);
});

test("conversions: unknown events, referrers and malformed paths are refused, not bucketed", async () => {
  await q("delete from conversion_events_daily");
  await asService(async () => {
    await refused(record("page_view", "/", "none"), /invalid_event/);
    await refused(record("x".repeat(40), "/", "none"), /invalid_event/);
    await refused(record(null, "/", "none"), /invalid_event/);
    await refused(record("donate_click", "membership", "none"), /invalid_path/);
    await refused(record("donate_click", null, "none"), /invalid_path/);
    await refused(record("donate_click", `/${"a".repeat(512)}`, "none"), /invalid_path/);
    await refused(record("donate_click", "/", "google"), /invalid_ref/);
    await refused(record("donate_click", "/", "https://chatgpt.com/c/123"), /invalid_ref/);
    await refused(record("donate_click", "/", "c".repeat(33)), /invalid_ref/);
    // An AI referral needs the assistant's name.
    await refused(record("ai_referral", "/", "none"), /invalid_ref/);
  });
  assert.deepEqual(await counts(), []);
  // The CHECKs hold the same lists for anyone writing past the function.
  await refused(
    q(`insert into conversion_events_daily (event, path_group, referrer_group)
       values ('page_view', '/', 'none')`),
    /conversion_events_daily_event_check/,
  );
  await refused(
    q(`insert into conversion_events_daily (event, path_group, referrer_group)
       values ('share_click', '/topics/x', 'none')`),
    /conversion_events_daily_path_group_check/,
  );
  await refused(
    q(`insert into conversion_events_daily (event, path_group, referrer_group)
       values ('share_click', '/', '1.2.3.4')`),
    /conversion_events_daily_referrer_group_check/,
  );
});

test("conversions: neither anon nor a signed-in account can record or write directly", async () => {
  await q("delete from conversion_events_daily");
  for (const user of [null, id.reader, id.editor, id.permAdmin, id.admin]) {
    await as(user, async () => {
      await refused(record("donate_click", "/membership", "none"), /permission denied/);
      await refused(
        q(`insert into conversion_events_daily (event, path_group, referrer_group, count)
           values ('donate_click', '/', 'none', 1000)`),
        /permission denied/,
      );
      await refused(q("update conversion_events_daily set count = 1000"), /permission denied/);
      await refused(q("delete from conversion_events_daily"), /permission denied/);
    });
  }
  assert.deepEqual(await counts(), []);
});

test("conversions: members 'v' and the admin read the counts; others see nothing", async () => {
  await asService(() => record("newsletter_signup", "/newsletter", "claude"));
  await as(null, () => refused(q("select * from conversion_events_daily"), /permission denied/));
  for (const user of [id.reader, id.editor]) {
    assert.equal((await as(user, () => q("select * from conversion_events_daily"))).length, 0);
  }
  for (const user of [id.permAdmin, id.admin]) {
    const rows = await as(user, () =>
      q("select event, path_group, referrer_group, count from conversion_events_daily"),
    );
    assert.deepEqual(rows, [
      { event: "newsletter_signup", path_group: "/newsletter", referrer_group: "claude", count: 1 },
    ]);
  }
});

test("conversions: the privacy policy says what is counted, once", async () => {
  const [page] = await q("select body_html from site_pages where slug = 'privacy'");
  assert.equal(page.body_html.split("We also count a few actions").length - 1, 1);
  assert.match(page.body_html, /no cookie is set and nothing about you is stored/i);
});
