import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Editable site pages (migration 20261013000150_site_pages): who reads and
 * writes site_pages, the append-only revision history and restore_site_page().
 * Same harness as rls.test.mjs: Supabase stubs + every migration in PGlite.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000d01",
  editor: "00000000-0000-4000-8000-000000000d02",
  publisher: "00000000-0000-4000-8000-000000000d03",
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

const PUBLIC_COLUMNS =
  "slug, title, description, lead, body_html, last_reviewed, published, created_at, updated_at";

const revisionCount = async (slug) =>
  (await one("select count(*)::int n from site_page_revisions where page_slug = $1", [slug])).n;

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
    [id.editor, "content-editor", "staff"],
    [id.publisher, "publisher", "staff"],
    [id.dataEditor, "data-editor", "staff"],
    [id.observer, "observer", "staff"],
    [id.reader, "reader", "reader"],
  ];
  for (const [uid, role, kind] of people) {
    await q("insert into auth.users (id, email) values ($1, $2)", [
      uid,
      `${role}.pages@atlasoftodaysworld.org`,
    ]);
    await q("update profiles set role_id = $2, kind = $3, status = 'active' where id = $1", [
      uid,
      role,
      kind,
    ]);
  }
});

test("site pages: the four pages are seeded and published, each with its first revision", async () => {
  const rows = await q(
    "select slug, published, last_reviewed::text d, body_html from site_pages order by slug",
  );
  assert.deepEqual(
    rows.map((row) => [row.slug, row.published, row.d]),
    [
      ["about", true, null],
      ["accessibility", true, "2026-09-30"],
      ["privacy", true, "2026-10-15"], // reviewed again by 20261015000010
      ["terms", true, "2026-09-30"],
    ],
  );
  const about = rows.find((row) => row.slug === "about").body_html;
  assert.match(about, /<p>\{\{data-sources\}\}<\/p>/);
  assert.match(about, /<h2 id="editorial-standards">/);
  // The story, partners and team from the original About page (20261015000020),
  // between the mission and the data sources.
  for (const id of ["what-why-how", "our-story", "partnerships", "team", "collaborate", "join"]) {
    assert.match(about, new RegExp(`<h2 id="${id}">`));
  }
  assert.ok(about.indexOf('id="mission"') < about.indexOf('id="our-story"'));
  assert.ok(about.indexOf('id="our-story"') < about.indexOf('id="data"'));
  assert.match(rows.find((row) => row.slug === "privacy").body_html, /\{\{contact\}\}/);
  for (const { slug } of rows) {
    const first = await one(
      "select saved_by, title from site_page_revisions where page_slug = $1 order by id limit 1",
      [slug],
    );
    assert.equal(first.saved_by, null, `${slug}: seeded by the migration`);
  }
});

test("site pages: anonymous readers see published pages and public columns only", async () => {
  await q("update site_pages set published = false where slug = 'terms'");
  try {
    const slugs = await as(null, () => q(`select ${PUBLIC_COLUMNS} from site_pages order by slug`));
    assert.deepEqual(
      slugs.map((row) => row.slug),
      ["about", "accessibility", "privacy"],
    );
    await as(null, () => refused(q("select updated_by from site_pages"), /permission denied/));
    await as(null, () => refused(q("select * from site_page_revisions"), /permission denied/));
    await as(null, () =>
      refused(q("update site_pages set title = 'x' where slug = 'about'"), /permission denied/),
    );
    await as(null, () => refused(q("select restore_site_page(1)"), /permission denied/));
  } finally {
    await q("update site_pages set published = true where slug = 'terms'");
  }
});

test("site pages: a signed-in reader sees published pages, no history, and can't write", async () => {
  await q("update site_pages set published = false where slug = 'terms'");
  try {
    for (const user of [id.reader, id.dataEditor]) {
      const slugs = await as(user, () => q("select slug from site_pages order by slug"));
      assert.deepEqual(
        slugs.map((row) => row.slug),
        ["about", "accessibility", "privacy"],
        `user ${user}`,
      );
      assert.equal(
        (await as(user, () => q("select id from site_page_revisions"))).length,
        0,
        `user ${user}: no revisions`,
      );
      const changed = await as(user, () =>
        q("update site_pages set title = 'Hacked' where slug = 'privacy' returning slug"),
      );
      assert.equal(changed.length, 0, `user ${user}: RLS filters the update`);
      await as(user, () =>
        refused(
          q(
            "insert into site_pages (slug, title, description) values ('terms', 'x', 'y') on conflict do nothing",
          ),
          /row-level security|permission denied/,
        ),
      );
    }
    assert.equal(
      (await one("select title from site_pages where slug = 'privacy'")).title,
      "Privacy policy",
    );
  } finally {
    await q("update site_pages set published = true where slug = 'terms'");
  }
});

test("site pages: the team with site:v sees unpublished pages and the history", async () => {
  await q("update site_pages set published = false where slug = 'terms'");
  try {
    for (const user of [id.admin, id.editor, id.publisher]) {
      const slugs = await as(user, () => q("select slug from site_pages order by slug"));
      assert.equal(slugs.length, 4, `user ${user}`);
      const history = await as(user, () =>
        q("select id from site_page_revisions where page_slug = 'privacy'"),
      );
      assert.ok(history.length >= 1, `user ${user}`);
    }
  } finally {
    await q("update site_pages set published = true where slug = 'terms'");
  }
});

test("site pages: a save stamps the editor and appends a revision and an audit entry", async () => {
  const before = await revisionCount("accessibility");
  await as(id.editor, () =>
    q(
      `update site_pages set lead = 'Short intro.', last_reviewed = '2026-10-13'
       where slug = 'accessibility'`,
    ),
  );
  const page = await one(
    "select updated_by, lead, updated_at > created_at as stamped from site_pages where slug = 'accessibility'",
  );
  assert.equal(page.updated_by, id.editor);
  assert.equal(page.lead, "Short intro.");
  assert.equal(await revisionCount("accessibility"), before + 1);
  const newest = await one(
    `select saved_by, lead, last_reviewed::text d from site_page_revisions
     where page_slug = 'accessibility' order by id desc limit 1`,
  );
  assert.deepEqual({ ...newest }, { saved_by: id.editor, lead: "Short intro.", d: "2026-10-13" });
  const audit = await one(
    `select actor, detail from audit_log where action = 'site_pages.update' and target = 'accessibility'
     order by id desc limit 1`,
  );
  assert.equal(audit.actor, id.editor);
  assert.equal(audit.detail.published, true);
  assert.equal(audit.detail.body_html, undefined, "the body stays in the revision only");

  // Saving the same content again is not a new version.
  await as(id.editor, () =>
    q("update site_pages set lead = 'Short intro.' where slug = 'accessibility'"),
  );
  assert.equal(await revisionCount("accessibility"), before + 1);
});

test("site pages: unpublishing hides the page from the public right away", async () => {
  await as(id.publisher, () => q("update site_pages set published = false where slug = 'privacy'"));
  try {
    assert.equal(
      (await as(null, () => q("select slug from site_pages where slug = 'privacy'"))).length,
      0,
    );
    assert.equal(
      (await as(id.editor, () => q("select slug from site_pages where slug = 'privacy'"))).length,
      1,
    );
  } finally {
    await as(id.publisher, () =>
      q("update site_pages set published = true where slug = 'privacy'"),
    );
  }
});

test("site pages: restore brings a version back as a new revision, keeping the published switch", async () => {
  const first = await one(
    "select id, body_html from site_page_revisions where page_slug = 'terms' order by id limit 1",
  );
  await as(id.editor, () =>
    q(
      "update site_pages set body_html = '<p>Changed.</p>', title = 'Terms', published = false where slug = 'terms'",
    ),
  );
  const count = await revisionCount("terms");

  // Without site:e (or site:v) the restore is refused.
  for (const user of [id.observer, id.reader, id.dataEditor]) {
    await as(user, () =>
      refused(q("select restore_site_page($1)", [first.id]), /can't be restored/),
    );
  }
  assert.equal(await revisionCount("terms"), count);

  const restored = await as(id.editor, () =>
    one("select restore_site_page($1) as slug", [first.id]),
  );
  assert.equal(restored.slug, "terms");
  const page = await one("select title, body_html, published from site_pages where slug = 'terms'");
  assert.equal(page.title, "Terms of use");
  assert.equal(page.body_html, first.body_html);
  assert.equal(page.published, false, "restore changes the text, not visibility");
  assert.equal(await revisionCount("terms"), count + 1);

  await as(id.editor, () => refused(q("select restore_site_page(999999)"), /can't be restored/));
  await q("update site_pages set published = true where slug = 'terms'");
});

test("site pages: the history is append-only for everyone", async () => {
  for (const user of [id.admin, id.editor]) {
    await as(user, () =>
      refused(
        q(
          `insert into site_page_revisions (page_slug, title, description, lead, body_html, published)
           values ('about', 'x', 'y', '', '', true)`,
        ),
        /permission denied/,
      ),
    );
    await as(user, () =>
      refused(q("update site_page_revisions set title = 'x'"), /permission denied/),
    );
    await as(user, () => refused(q("delete from site_page_revisions"), /permission denied/));
  }
});

test("site pages: pages can't be deleted, only unpublished", async () => {
  for (const user of [id.admin, id.editor]) {
    await as(user, () =>
      refused(q("delete from site_pages where slug = 'about'"), /permission denied/),
    );
  }
  assert.equal((await one("select count(*)::int n from site_pages")).n, 4);
});

test("site pages: internal columns stay out of reach for writers too", async () => {
  await as(id.editor, () =>
    refused(
      q(`update site_pages set updated_by = '${id.reader}' where slug = 'about'`),
      /permission denied/,
    ),
  );
  await as(id.editor, () =>
    refused(q("update site_pages set slug = 'imprint' where slug = 'about'"), /permission denied/),
  );
});

test("site pages: CHECKs guard the slug list, required texts and the body length", async () => {
  await refused(
    q("insert into site_pages (slug, title, description) values ('imprint', 'Imprint', 'x')"),
    /site_pages_slug_check/,
  );
  await as(id.admin, async () => {
    await refused(
      q("update site_pages set title = '   ' where slug = 'about'"),
      /check constraint/,
    );
    await refused(
      q("update site_pages set description = '' where slug = 'about'"),
      /check constraint/,
    );
    await refused(
      q("update site_pages set body_html = repeat('x', 100001) where slug = 'about'"),
      /check constraint/,
    );
    await refused(
      q("update site_pages set last_reviewed = '1999-12-31' where slug = 'about'"),
      /check constraint/,
    );
  });
});

test("site pages: has_perm-based policies are evaluated once per query", async () => {
  const policies = await q(
    `select policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') expr
     from pg_policies where tablename in ('site_pages', 'site_page_revisions')`,
  );
  assert.ok(policies.length >= 5);
  for (const policy of policies) {
    if (!policy.expr.includes("has_perm")) continue;
    assert.match(policy.expr, /SELECT has_perm/i, policy.policyname);
  }
});
