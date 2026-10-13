import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Atlas Patrons settings and FAQ (migration 20261013000160_patron_settings):
 * the seeded row matches what the site showed before, the CHECKs keep the
 * amounts a sorted list with valid defaults, anyone reads, and only the `site`
 * or `members` section changes them (v / c / e / d as usual).
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000d01",
  permAdmin: "00000000-0000-4000-8000-000000000d02",
  editor: "00000000-0000-4000-8000-000000000d03",
  dataEditor: "00000000-0000-4000-8000-000000000d04",
  observer: "00000000-0000-4000-8000-000000000d05",
  reader: "00000000-0000-4000-8000-000000000d06",
};

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

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

/** One settings change under the service key, undone after `fn` (CHECK tests). */
async function withSettings(set, fn) {
  await q("begin");
  try {
    await fn(q(`update patron_settings set ${set} where id = 1`));
  } finally {
    await q("rollback");
  }
}

const settings = () => one("select * from patron_settings where id = 1");
const faqOrder = async () =>
  (await q("select question from patron_faq order by sort, id")).map((row) => row.question);

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
  const people = [
    [id.admin, "admin", "staff"],
    [id.permAdmin, "permission-admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.dataEditor, "data-editor", "staff"],
    [id.observer, "observer", "staff"],
    [id.reader, "reader", "reader"],
  ];
  for (const [uid, role, kind] of people) {
    await q("insert into auth.users (id, email) values ($1, $2)", [
      uid,
      `${role}@atlasoftodaysworld.org`,
    ]);
    await q("update profiles set role_id = $2, kind = $3, status = 'active' where id = $1", [
      uid,
      role,
      kind,
    ]);
  }
});

test("patron settings: seeded with the values the site showed before", async () => {
  const row = await settings();
  assert.deepEqual(row.monthly_amounts, [5, 10, 15, 25, 50, 100]);
  assert.deepEqual(row.one_time_amounts, [30, 50, 100]);
  assert.equal(row.default_period, "monthly");
  assert.equal(row.default_monthly, 10);
  assert.equal(row.default_one_time, 50);
  assert.deepEqual(row.other_amount_periods, ["one-time"]);
  assert.equal(row.other_amount_min, 1);
  assert.equal(row.other_amount_max, 10000);
  assert.equal(row.goal_patrons, 1000);
  assert.equal(row.goal_monthly_eur, 10000);
  assert.equal(row.goal_counts_from, 10);
});

test("patron settings: amounts are 1–8 ascending whole euros without repeats", async () => {
  const check = /patron_settings_monthly_amounts_check/;
  for (const bad of [
    "'{}'",
    "'{10,5}'",
    "'{5,5,10}'",
    "'{0,10}'",
    "'{10,10001}'",
    "'{1,2,3,4,5,6,7,8,10}'",
    "'{5,null,10}'",
    "'{{5,10},{15,25}}'",
    "'[0:1]={5,10}'",
  ]) {
    assert.equal(
      (await one(`select valid_patron_amounts(${bad}::integer[]) as ok`)).ok,
      false,
      bad,
    );
  }
  await withSettings("monthly_amounts = '{10,5}'", (p) => refused(p, check));
  await withSettings("one_time_amounts = '{50,50}'", (p) =>
    refused(p, /patron_settings_one_time_amounts_check/),
  );
  await withSettings("monthly_amounts = '{1,2,3,4,5,6,7,10000}', default_monthly = 10000", (p) =>
    p.then(() => undefined),
  );
});

test("patron settings: defaults must be offered, other-amount bounds and goal in range", async () => {
  await withSettings("default_monthly = 12", (p) =>
    refused(p, /patron_settings_default_monthly_check/),
  );
  await withSettings("one_time_amounts = '{20,40}'", (p) =>
    refused(p, /patron_settings_default_one_time_check/),
  );
  await withSettings("default_period = 'weekly'", (p) => refused(p, /default_period_check/));
  await withSettings("other_amount_periods = '{weekly}'", (p) =>
    refused(p, /other_amount_periods_check/),
  );
  await withSettings("other_amount_min = 0", (p) => refused(p, /other_amount_check/));
  await withSettings("other_amount_min = 50, other_amount_max = 40", (p) =>
    refused(p, /other_amount_check/),
  );
  await withSettings("other_amount_max = 10001", (p) => refused(p, /other_amount_check/));
  await withSettings("goal_patrons = 0", (p) => refused(p, /goal_patrons_check/));
  await withSettings("goal_monthly_eur = -1", (p) => refused(p, /goal_monthly_eur_check/));
  await refused(
    q(
      "insert into patron_settings (id, monthly_amounts, one_time_amounts, default_monthly, default_one_time, goal_patrons, goal_monthly_eur) values (2, '{5}', '{5}', 5, 5, 1, 1)",
    ),
    /patron_settings_id_check/,
  );
});

test("patron settings: anyone reads; only site or members 'e' changes them", async () => {
  assert.equal((await as(null, () => settings())).default_monthly, 10);
  assert.equal((await as(id.reader, () => settings())).default_monthly, 10);
  await refused(
    as(null, () => q("update patron_settings set goal_patrons = 5 where id = 1")),
    /permission denied/,
  );

  // Without the right the row is simply not there for an update.
  for (const user of [id.reader, id.observer, id.dataEditor]) {
    const rows = await as(user, () =>
      q("update patron_settings set goal_patrons = 5 where id = 1 returning id"),
    );
    assert.equal(rows.length, 0, `user ${user}`);
  }
  assert.equal((await settings()).goal_patrons, 1000);

  // site:e (content editor), members:e (permission admin) and the admin.
  for (const [user, goal] of [
    [id.editor, 1100],
    [id.permAdmin, 1200],
    [id.admin, 1000],
  ]) {
    const rows = await as(user, () =>
      q(
        "update patron_settings set goal_patrons = $1, monthly_amounts = '{5,10,20}' where id = 1 returning id",
        [goal],
      ),
    );
    assert.equal(rows.length, 1, `user ${user}`);
  }
  assert.equal((await settings()).goal_patrons, 1000);
  await q("update patron_settings set monthly_amounts = '{5,10,15,25,50,100}' where id = 1");

  // The id and the timestamp aren't the team's to set; nobody adds or removes the row.
  await as(id.editor, async () => {
    await refused(q("update patron_settings set id = 2"), /permission denied/);
    await refused(q("delete from patron_settings"), /permission denied/);
  });
});

test("patron settings: a change is stamped and lands in the audit log", async () => {
  const before = (await settings()).updated_at;
  await as(id.editor, () => q("update patron_settings set goal_counts_from = 12 where id = 1"));
  const after = await settings();
  assert.ok(after.updated_at >= before);
  const audit = await one(
    "select actor, detail from audit_log where action = 'patron_settings.update' order by id desc limit 1",
  );
  assert.equal(audit.actor, id.editor);
  assert.equal(audit.detail.new.goal_counts_from, 12);
  await q("update patron_settings set goal_counts_from = 10 where id = 1");
});

test("patron FAQ: seeded with today's questions, the legal name fixed", async () => {
  assert.deepEqual(await faqOrder(), [
    "Will the content be free for everyone?",
    "Are you a registered nonprofit organisation?",
    "How can I cancel or change my monthly donation?",
  ]);
  const answers = (await q("select answer_html from patron_faq")).map((row) => row.answer_html);
  assert.ok(answers.some((html) => html.includes("Atlas of Today's World, z. s.")));
  assert.ok(answers.every((html) => !html.includes("Encyklopedie")));
  assert.ok(answers.some((html) => html.includes("{email}")));
});

test("patron FAQ: anon reads visible questions and only the public columns", async () => {
  const hidden = await one(
    "insert into patron_faq (question, answer_html, sort, visible) values ('Draft?', '<p>Not yet.</p>', 40, false) returning id",
  );
  const anon = await as(null, () => q("select id, question, answer_html, sort from patron_faq"));
  assert.equal(anon.length, 3);
  assert.ok(!anon.some((row) => row.id === hidden.id));
  await refused(
    as(null, () => q("select created_at from patron_faq")),
    /permission denied/,
  );
  await refused(
    as(null, () => q("insert into patron_faq (question, answer_html) values ('x', 'y')")),
    /permission denied/,
  );

  // A reader sees the same; the team (site or members "v") also sees the hidden one.
  assert.equal((await as(id.reader, () => q("select id from patron_faq"))).length, 3);
  assert.equal((await as(id.dataEditor, () => q("select id from patron_faq"))).length, 3);
  assert.equal((await as(id.editor, () => q("select id from patron_faq"))).length, 4);
  assert.equal((await as(id.permAdmin, () => q("select id from patron_faq"))).length, 4);
  await q("delete from patron_faq where id = $1", [hidden.id]);
});

test("patron FAQ: add 'c', change 'e', delete 'd' in site or members", async () => {
  // Content editor: site vced.
  const added = await as(id.editor, () =>
    one(
      "insert into patron_faq (question, answer_html, sort) values ('New?', '<p>Yes.</p>', 50) returning id",
    ),
  );
  // Permission admin: members "ve" — edits, but neither adds nor deletes.
  await refused(
    as(id.permAdmin, () =>
      q("insert into patron_faq (question, answer_html) values ('Mine?', '<p>No.</p>')"),
    ),
    /row-level security/,
  );
  const changed = await as(id.permAdmin, () =>
    q("update patron_faq set question = 'New, edited?' where id = $1 returning id", [added.id]),
  );
  assert.equal(changed.length, 1);
  const notDeleted = await as(id.permAdmin, () =>
    q("delete from patron_faq where id = $1 returning id", [added.id]),
  );
  assert.equal(notDeleted.length, 0);

  // Nothing at all without the sections.
  for (const user of [id.observer, id.dataEditor, id.reader]) {
    await refused(
      as(user, () => q("insert into patron_faq (question, answer_html) values ('x', '<p>y</p>')")),
      /row-level security/,
    );
    const rows = await as(user, () =>
      q("update patron_faq set question = 'x' where id = $1 returning id", [added.id]),
    );
    assert.equal(rows.length, 0, `user ${user}`);
  }

  // Server-set columns stay the database's.
  await refused(
    as(id.editor, () => q("update patron_faq set created_at = now() where id = $1", [added.id])),
    /permission denied/,
  );

  const deleted = await as(id.editor, () =>
    q("delete from patron_faq where id = $1 returning id", [added.id]),
  );
  assert.equal(deleted.length, 1);
});

test("patron FAQ: question ≤ 300 and answer ≤ 3,000 characters, neither empty", async () => {
  const insert = (question, answer) =>
    q("insert into patron_faq (question, answer_html) values ($1, $2)", [question, answer]);
  await refused(insert("x".repeat(301), "<p>a</p>"), /patron_faq_question_check/);
  await refused(insert("   ", "<p>a</p>"), /patron_faq_question_check/);
  await refused(insert("Q?", "x".repeat(3001)), /patron_faq_answer_html_check/);
  await refused(insert("Q?", " "), /patron_faq_answer_html_check/);
  await refused(
    q("insert into patron_faq (question, answer_html, sort) values ('Q?', '<p>a</p>', -1)"),
    /patron_faq_sort_check/,
  );
  await q("begin");
  await insert("x".repeat(300), "x".repeat(3000));
  await q("rollback");
});

test("patron FAQ: move_patron_faq swaps neighbours, only with the edit right", async () => {
  const [first, second, third] = await faqOrder();
  const secondId = (await one("select id from patron_faq where question = $1", [second])).id;

  await as(id.editor, () => q("select move_patron_faq($1, true)", [secondId]));
  assert.deepEqual(await faqOrder(), [second, first, third]);
  // Already first: nothing to do.
  await as(id.editor, () => q("select move_patron_faq($1, true)", [secondId]));
  assert.deepEqual(await faqOrder(), [second, first, third]);
  await as(id.permAdmin, () => q("select move_patron_faq($1, false)", [secondId]));
  assert.deepEqual(await faqOrder(), [first, second, third]);
  assert.deepEqual(
    (await q("select sort from patron_faq order by sort")).map((row) => row.sort),
    [10, 20, 30],
  );

  await refused(
    as(id.observer, () => q("select move_patron_faq($1, false)", [secondId])),
    /can't reorder/,
  );
  await refused(
    as(null, () => q("select move_patron_faq($1, false)", [secondId])),
    /permission denied/,
  );
  await refused(
    as(id.editor, () => q("select move_patron_faq('00000000-0000-4000-8000-0000000000ff', true)")),
    /no longer exists/,
  );
  assert.deepEqual(await faqOrder(), [first, second, third]);
});

test("memberships: members c/d don't let a non-admin grant or revoke (the UI hides it too)", async () => {
  // /admin/members shows grant / revoke only to the admin role (Access.isAdmin),
  // matching the memberships policies and guard_memberships (is_admin()).
  await q(
    "insert into role_permissions (role_id, section, actions) values ('observer', 'members', 'vced')",
  );
  const grant =
    "insert into memberships (user_id, plan, complimentary) values ($1, 'patron', true)";
  const revoke = "delete from memberships where user_id = $1 returning user_id";
  try {
    await refused(
      as(id.observer, () => q(grant, [id.reader])),
      /row-level security|admin/,
    );
    await as(id.admin, () => q(grant, [id.reader]));
    assert.equal((await as(id.observer, () => q(revoke, [id.reader]))).length, 0);
    assert.equal((await as(id.admin, () => q(revoke, [id.reader]))).length, 1);
  } finally {
    await q("delete from role_permissions where role_id = 'observer' and section = 'members'");
  }
});
