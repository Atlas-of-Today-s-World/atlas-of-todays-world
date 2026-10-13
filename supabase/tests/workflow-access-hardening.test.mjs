import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Workflow and access hardening (migration 20261013000310):
 *  - pending entries are frozen until approved or withdrawn (entry row and
 *    every part), withdraw_entry() takes them back, approve_entry() can pin
 *    the version the approver saw;
 *  - the publication date and the review note belong to the approval;
 *  - every editor keeps planning topics, adding author profiles and
 *    managing redirects as before (owner policy: no extra editorial gates);
 *  - role grants with editorial reach require admin; the kind of account
 *    follows the role; invitation-only fails closed for non-admins;
 *  - profile column privileges, staff_name() for staff only, stale
 *    invitations neither un-block nor override.
 * Same harness as rls.test.mjs: Supabase stubs + every migration in PGlite.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000e01",
  permAdmin: "00000000-0000-4000-8000-000000000e02",
  editor: "00000000-0000-4000-8000-000000000e03",
  pubA: "00000000-0000-4000-8000-000000000e04",
  pubB: "00000000-0000-4000-8000-000000000e05",
  approver: "00000000-0000-4000-8000-000000000e06",
  reader: "00000000-0000-4000-8000-000000000e07",
  newsWriter: "00000000-0000-4000-8000-000000000e08",
  siteEditor: "00000000-0000-4000-8000-000000000e09",
  observer: "00000000-0000-4000-8000-000000000e0a",
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

/** An entry written by the import (service key), in any status. */
async function newEntry(owner, slug, status = "draft", countries = ["BRA"]) {
  const row = await one(
    `insert into entries (slug, title, summary, category, region_slug, owner_id, status)
     values ($1, $1, 'Summary', 'Society', 'latin-america-caribbean', $2, $3) returning id`,
    [slug, owner, status],
  );
  for (const iso3 of countries) {
    await q("insert into entry_countries (entry_id, country_iso3) values ($1, $2)", [row.id, iso3]);
  }
  return row.id;
}

const statusOf = async (entry) =>
  (await one("select status from entries where id = $1", [entry])).status;

/** A signed-up account (verified e-mail), then given a role by the service key. */
async function account(uid, email, role, status = "active") {
  await q("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [
    uid,
    email,
  ]);
  await q("update profiles set role_id = $2, status = $3 where id = $1", [uid, role, status]);
}

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
  await db.exec(`
    insert into regions (slug, name, fill, stroke, center_lon, center_lat) values
      ('latin-america-caribbean', 'Latin America & Caribbean', '#aaaaaa', '#555555', -60, -10);
    insert into countries (iso3, slug, name, region_slug) values
      ('BRA', 'brazil', 'Brazil', 'latin-america-caribbean'),
      ('ARG', 'argentina', 'Argentina', 'latin-america-caribbean');
    -- Writes its own articles, no site section (unlike the built-in publisher).
    insert into roles (id, name, news_scope) values ('news-writer', 'News writer', 'own');
    insert into role_permissions (role_id, section, actions) values ('news-writer', 'news', 'vce');
    -- Edits site content, no articles and no deleting.
    insert into roles (id, name) values ('site-editor', 'Site editor');
    insert into role_permissions (role_id, section, actions) values ('site-editor', 'site', 'vce');
  `);
  await account(id.admin, "admin@atlasoftodaysworld.org", "admin");
  await account(id.permAdmin, "perm@atlasoftodaysworld.org", "permission-admin");
  await account(id.editor, "editor@atlasoftodaysworld.org", "content-editor");
  await account(id.pubA, "pub.a@atlasoftodaysworld.org", "publisher");
  await account(id.pubB, "pub.b@atlasoftodaysworld.org", "publisher");
  await account(id.approver, "approver@atlasoftodaysworld.org", "content-approver");
  await account(id.reader, "reader@example.org", "reader");
  await account(id.newsWriter, "writer@atlasoftodaysworld.org", "news-writer");
  await account(id.siteEditor, "site@atlasoftodaysworld.org", "site-editor");
  await account(id.observer, "observer@atlasoftodaysworld.org", "observer");
  await q("insert into approver_countries values ($1, 'BRA')", [id.approver]);
});

// ---------------------------------------------------------------------------
// Pending entries are frozen until approved or withdrawn
// ---------------------------------------------------------------------------

test("pending: the author can't change the entry or any of its parts", async () => {
  const entry = await newEntry(id.pubA, "frozen");
  await q(
    "insert into entry_chapters (entry_id, position, title, body_html) values ($1, 0, 'One', '<p>a</p>')",
    [entry],
  );
  await as(id.pubA, () => q("select submit_entry($1)", [entry]));
  assert.equal(await statusOf(entry), "pending");

  await as(id.pubA, async () => {
    await refused(
      q("update entries set title = 'Swapped' where id = $1", [entry]),
      /waiting for approval/,
    );
    await refused(
      q("insert into entry_chapters (entry_id, position, title) values ($1, 1, 'Smuggled')", [
        entry,
      ]),
      /row-level security/,
    );
    const chapters = await q(
      "update entry_chapters set body_html = '<p>b</p>' where entry_id = $1 returning id",
      [entry],
    );
    assert.equal(chapters.length, 0);
    const gone = await q("delete from entry_chapters where entry_id = $1 returning id", [entry]);
    assert.equal(gone.length, 0);
    await refused(
      q("insert into entry_countries (entry_id, country_iso3) values ($1, 'ARG')", [entry]),
      /row-level security/,
    );
    const countries = await q("delete from entry_countries where entry_id = $1 returning 1", [
      entry,
    ]);
    assert.equal(countries.length, 0);
    await refused(
      q(
        "insert into resources (entry_id, kind, title, url) values ($1, 'Lectures & Debates', 'X', 'https://x.org')",
        [entry],
      ),
      /row-level security/,
    );
    await refused(
      q("insert into entry_faq (entry_id, position, question, answer) values ($1, 0, 'Q?', 'A.')", [
        entry,
      ]),
      /row-level security/,
    );
    for (const part of ["chapters", "resources", "faq", "tile_notes"]) {
      await refused(
        q("select replace_entry_parts($1, $2, '[]'::jsonb)", [entry, part]),
        /may not edit this entry/,
      );
    }
    await refused(
      q("select replace_tiles($1, null, '[]'::jsonb)", [entry]),
      /may not edit this entry/,
    );
  });
  assert.equal(
    (await one("select body_html from entry_chapters where entry_id = $1", [entry])).body_html,
    "<p>a</p>",
  );
  assert.equal((await one("select title from entries where id = $1", [entry])).title, "frozen");
});

test("pending: an editor who may approve it still edits it and its parts", async () => {
  const entry = await newEntry(id.pubA, "frozen-editor", "pending");
  await as(id.editor, async () => {
    const changed = await q("update entries set title = 'Polished' where id = $1 returning id", [
      entry,
    ]);
    assert.equal(changed.length, 1);
    await q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [
      entry,
      JSON.stringify([{ title: "Fixed", body_html: "<p>fixed</p>" }]),
    ]);
    await q("insert into entry_countries (entry_id, country_iso3) values ($1, 'ARG')", [entry]);
  });
  assert.equal(
    (await one("select count(*)::int n from entry_chapters where entry_id = $1", [entry])).n,
    1,
  );
});

test("withdraw_entry: the author takes a pending entry back to draft, nobody else", async () => {
  const entry = await newEntry(id.pubA, "withdrawn", "pending");
  await as(id.approver, () => q("select schedule_entry($1, now() + interval '1 day')", [entry]));

  await as(null, () => refused(q("select withdraw_entry($1)", [entry]), /permission denied/));
  await as(id.pubB, () =>
    refused(q("select withdraw_entry($1)", [entry]), /Only a pending article you may edit/),
  );
  await as(id.approver, () =>
    refused(q("select withdraw_entry($1)", [entry]), /Only a pending article you may edit/),
  );
  await as(id.pubA, () => q("select withdraw_entry($1)", [entry]));
  const row = await one("select status, publish_at, scheduled_by from entries where id = $1", [
    entry,
  ]);
  assert.deepEqual({ ...row }, { status: "draft", publish_at: null, scheduled_by: null });

  // Back in the author's hands; withdrawing a draft is refused.
  await as(id.pubA, async () => {
    await q("update entries set title = 'Reworked' where id = $1", [entry]);
    await refused(q("select withdraw_entry($1)", [entry]), /Only a pending article/);
  });
  const audit = await one(
    "select count(*)::int n from audit_log where action = 'entries.update' and target = 'withdrawn'",
  );
  assert.ok(audit.n >= 1, "the status change is in the audit log");
});

test("approve_entry: an expected timestamp pins the version the approver saw", async () => {
  const entry = await newEntry(id.pubA, "pinned", "pending");
  const seen = (await one("select updated_at::text t from entries where id = $1", [entry])).t;
  // An editor polishes it after the approver opened it.
  await as(id.editor, () => q("update entries set summary = 'Changed' where id = $1", [entry]));

  await as(id.approver, () =>
    refused(
      q("select approve_entry($1, $2::timestamptz)", [entry, seen]),
      /changed after you opened it/,
    ),
  );
  assert.equal(await statusOf(entry), "pending");

  const fresh = (await one("select updated_at::text t from entries where id = $1", [entry])).t;
  await as(id.approver, () => q("select approve_entry($1, $2::timestamptz)", [entry, fresh]));
  const row = await one("select status, published_on from entries where id = $1", [entry]);
  assert.equal(row.status, "published");
  assert.ok(row.published_on, "approval sets the publication date");

  // Without a timestamp it works as before; a non-pending entry is still refused.
  const other = await newEntry(id.pubA, "unpinned", "pending");
  await as(id.approver, () => q("select approve_entry($1)", [other]));
  assert.equal(await statusOf(other), "published");
  await as(id.approver, () =>
    refused(q("select approve_entry($1, now())", [other]), /waiting for approval/),
  );
});

// ---------------------------------------------------------------------------
// Publication date and review note belong to the approval
// ---------------------------------------------------------------------------

test("published_on and review_note: not set by the author", async () => {
  const entry = await newEntry(id.pubA, "dated");
  await as(id.pubA, async () => {
    await refused(
      q("update entries set published_on = '2001-01-01' where id = $1", [entry]),
      /set by the approval/,
    );
    await refused(
      q("update entries set review_note = 'Looks great' where id = $1", [entry]),
      /set by the approval/,
    );
    await refused(
      q(
        `insert into entries (slug, title, category, owner_id, published_on)
         values ('dated-new', 'Dated', 'Society', $1, '2030-01-01')`,
        [id.pubA],
      ),
      /set by the approval/,
    );
  });
  // Someone who may approve the entry may correct the date.
  await as(id.editor, () =>
    q("update entries set published_on = '2026-10-01' where id = $1", [entry]),
  );
  assert.equal(
    (await one("select published_on::text d from entries where id = $1", [entry])).d,
    "2026-10-01",
  );
});

// ---------------------------------------------------------------------------
// Editorial abilities stay as they were (owner policy: no extra gates)
// ---------------------------------------------------------------------------

test("publishers still plan topics, with their countries, and turn them into drafts", async () => {
  const planned = await as(id.pubA, () =>
    one(
      `insert into entries (slug, title, category, owner_id, status, kind)
       values ('plan-pub', 'Plan', 'Society', $1, 'planned', 'entry') returning id`,
      [id.pubA],
    ),
  );
  await as(id.pubA, async () => {
    await q("insert into entry_countries (entry_id, country_iso3) values ($1, 'BRA')", [
      planned.id,
    ]);
    await q("update entries set title = 'Planned topic' where id = $1", [planned.id]);
    await q("select replace_entry_parts($1, 'faq', $2::jsonb)", [
      planned.id,
      JSON.stringify([{ question: "Why?", answer: "Because." }]),
    ]);
  });
  const shown = await as(null, () => q("select title, countries from planned_entries()"));
  assert.deepEqual(
    shown.map((row) => ({ ...row })),
    [{ title: "Planned topic", countries: ["BRA"] }],
  );
  await as(id.pubA, () => q("update entries set status = 'draft' where id = $1", [planned.id]));
  assert.equal(await statusOf(planned.id), "draft");
});

test("publishers still add author profiles and edit their own bio", async () => {
  const created = await as(id.pubA, () =>
    one("insert into authors (name, slug, profile_id) values ('Pub A', '', $1) returning id", [
      id.pubA,
    ]),
  );
  const changed = await as(id.pubA, () =>
    q("update authors set bio = 'About me' where id = $1 returning id", [created.id]),
  );
  assert.equal(changed.length, 1);
});

test("redirects: rules as before (news 'c' adds, news or site 'e' edits, news 'd' deletes)", async () => {
  // A writer of their own articles (news "vce", no site section) adds and edits.
  await as(id.newsWriter, async () => {
    await q("insert into redirects (from_path, to_path) values ('/news/a', '/news/b')");
    const edited = await q(
      "update redirects set to_path = '/news/c' where from_path = '/news/a' returning id",
    );
    assert.equal(edited.length, 1);
    const gone = await q("delete from redirects where from_path = '/news/a' returning id");
    assert.equal(gone.length, 0);
  });
  // A site editor edits; a content editor (news "d") deletes.
  await as(id.siteEditor, async () => {
    const edited = await q(
      "update redirects set to_path = '/news/d' where from_path = '/news/a' returning id",
    );
    assert.equal(edited.length, 1);
  });
  await as(id.editor, async () => {
    const gone = await q("delete from redirects where from_path = '/news/a' returning id");
    assert.equal(gone.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Role grants with editorial reach require admin
// ---------------------------------------------------------------------------

test("roles: a permission admin can't create or reshape a role with editorial reach", async () => {
  await as(id.permAdmin, async () => {
    for (const scope of ["news_scope = 'all'", "approval_scope = 'global'"]) {
      const [column, value] = scope.split(" = ");
      await refused(
        q(`insert into roles (id, name, ${column}) values ('reach-${column}', 'Reach', ${value})`),
        /Only an admin can create, change or remove a role/,
      );
    }
    // An ordinary role is still theirs to create and shape.
    await q(
      "insert into roles (id, name, news_scope) values ('fact-checker', 'Fact checker', 'own')",
    );
    await q(
      "insert into role_permissions (role_id, section, actions) values ('fact-checker', 'news', 'vce')",
    );
    await q("update roles set note = 'Checks facts.' where id = 'fact-checker'");
    for (const [section, actions] of [
      ["approvals", "ve"],
      ["members", "v"],
      ["users", "v"],
      ["permissions", "v"],
    ]) {
      await refused(
        q(
          "insert into role_permissions (role_id, section, actions) values ('fact-checker', $1, $2)",
          [section, actions],
        ),
        /Only an admin can let a role approve articles or manage accounts, members or permissions/,
      );
    }
    // Seeing the approval queue without approving is fine.
    await q(
      "insert into role_permissions (role_id, section, actions) values ('fact-checker', 'approvals', 'v')",
    );
    await refused(
      q(
        "update role_permissions set actions = 've' where role_id = 'fact-checker' and section = 'approvals'",
      ),
      /Only an admin can let a role approve/,
    );
    await refused(
      q("update roles set news_scope = 'all' where id = 'fact-checker'"),
      /Only an admin can create, change or remove a role/,
    );

    // A role that already has reach: not renamed, not re-permissioned, not removed.
    await refused(
      q("update roles set name = 'Renamed' where id = 'content-editor'"),
      /Only an admin can create, change or remove a role/,
    );
    await refused(
      q(
        "update role_permissions set actions = 'v' where role_id = 'content-approver' and section = 'news'",
      ),
      /Only an admin can change the permissions of a role/,
    );
    await refused(
      q(
        "delete from role_permissions where role_id = 'content-approver' and section = 'approvals'",
      ),
      /Only an admin can change the permissions of a role/,
    );
  });
  await as(id.admin, async () => {
    await q(
      "insert into roles (id, name, approval_scope) values ('global-checker', 'Global checker', 'global')",
    );
    await q(
      "insert into role_permissions (role_id, section, actions) values ('global-checker', 'approvals', 've')",
    );
  });
  await as(id.permAdmin, () =>
    refused(
      q("delete from roles where id = 'global-checker'"),
      /Only an admin can create, change or remove/,
    ),
  );
  await as(id.admin, () => q("delete from roles where id = 'global-checker'"));
  assert.equal((await q("select 1 from roles where id = 'global-checker'")).length, 0);
});

test("roles: only an admin assigns or invites to a role with editorial reach", async () => {
  await as(id.permAdmin, async () => {
    for (const role of ["content-editor", "content-approver", "permission-admin"]) {
      await refused(
        q("update profiles set role_id = $2 where id = $1", [id.observer, role]),
        /Only an admin can give a role/,
      );
      await refused(
        q("insert into invitations (email, role_id) values ($1, $2)", [
          `${role}@example.org`,
          role,
        ]),
        /Only an admin can invite someone to a role/,
      );
    }
    // Ordinary editorial roles stay with the permission admin.
    await q("update profiles set role_id = 'publisher' where id = $1", [id.observer]);
    await q(
      "insert into invitations (email, role_id) values ('fresh.publisher@example.org', 'publisher')",
    );
  });
  await as(id.admin, () =>
    q("update profiles set role_id = 'content-approver' where id = $1", [id.observer]),
  );
  assert.equal(
    (await one("select role_id from profiles where id = $1", [id.observer])).role_id,
    "content-approver",
  );
  // A permission admin may still move someone off such a role.
  await as(id.permAdmin, () =>
    q("update profiles set role_id = 'observer' where id = $1", [id.observer]),
  );
});

test("kind of account follows the role; invitation-only fails closed for non-admins", async () => {
  // Demoting to reader makes a reader; the service key can't leave a mismatch either.
  await as(id.admin, () => q("update profiles set role_id = 'reader' where id = $1", [id.pubB]));
  assert.equal((await one("select kind from profiles where id = $1", [id.pubB])).kind, "reader");
  await q("update profiles set role_id = 'publisher', kind = 'reader' where id = $1", [id.pubB]);
  assert.equal((await one("select kind from profiles where id = $1", [id.pubB])).kind, "staff");

  // With invitation-only on and no allowed list, a permission admin doesn't
  // promote a reader directly…
  await as(id.permAdmin, () =>
    refused(
      q("update profiles set role_id = 'observer' where id = $1", [id.reader]),
      /join by invitation/,
    ),
  );
  // …an admin does (and may give a role with editorial reach)…
  await as(id.admin, async () => {
    await q("update profiles set role_id = 'content-editor' where id = $1", [id.reader]);
    await q("update profiles set role_id = 'reader' where id = $1", [id.reader]);
  });
  assert.equal((await one("select kind from profiles where id = $1", [id.reader])).kind, "reader");
  // …and an admin's invitation works.
  const invitee = "00000000-0000-4000-8000-000000000e20";
  await as(id.admin, () =>
    q(
      "insert into invitations (email, role_id) values ('invitee@example.org', 'content-approver')",
    ),
  );
  await q(
    "insert into auth.users (id, email, email_confirmed_at) values ($1, 'invitee@example.org', now())",
    [invitee],
  );
  assert.deepEqual(
    { ...(await one("select role_id, kind from profiles where id = $1", [invitee])) },
    { role_id: "content-approver", kind: "staff" },
  );

  // With the switch off, a permission admin may promote directly too.
  await as(id.admin, () => q("update security_settings set invite_only = false where id = 1"));
  await as(id.permAdmin, async () => {
    await q("update profiles set role_id = 'observer' where id = $1", [id.reader]);
    await q("update profiles set role_id = 'reader' where id = $1", [id.reader]);
  });
  await as(id.admin, () => q("update security_settings set invite_only = true where id = 1"));

  // A filled-in allowed list limits invitations too.
  await q("insert into allowed_emails (value) values ('@atlasoftodaysworld.org')");
  try {
    await as(id.admin, () =>
      refused(
        q("insert into invitations (email, role_id) values ('outsider@example.org', 'observer')"),
        /allowed e-mails/,
      ),
    );
    await as(id.admin, () =>
      q(
        "insert into invitations (email, role_id) values ('insider@atlasoftodaysworld.org', 'observer')",
      ),
    );
  } finally {
    await q("delete from allowed_emails");
  }
});

// ---------------------------------------------------------------------------
// Profiles, staff names, stale invitations
// ---------------------------------------------------------------------------

test("profiles: the app updates display fields; e-mail, kind and timestamps are the database's", async () => {
  await as(id.reader, async () => {
    const changed = await q(
      "update profiles set name = 'Reader', phone = '+420 123' where id = $1 returning id",
      [id.reader],
    );
    assert.equal(changed.length, 1);
    for (const change of [
      "email = 'other@example.org'",
      "kind = 'staff'",
      "created_at = now()",
      "last_seen_at = now()",
      "deleted_at = now()",
    ]) {
      await refused(
        q(`update profiles set ${change} where id = $1`, [id.reader]),
        /permission denied/,
      );
    }
  });
  await as(id.permAdmin, () =>
    refused(
      q("update profiles set email = 'swap@example.org' where id = $1", [id.pubA]),
      /permission denied/,
    ),
  );
  // Account management keeps its paths: role and block.
  await as(id.permAdmin, async () => {
    await q("update profiles set status = 'blocked', blocked_note = 'Test' where id = $1", [
      id.pubB,
    ]);
    await q("update profiles set status = 'active', blocked_note = null where id = $1", [id.pubB]);
  });
});

test("staff_name: resolves team members only", async () => {
  await q("update profiles set name = 'Reader Name' where id = $1", [id.reader]);
  await q("update profiles set name = 'Editor Name' where id = $1", [id.editor]);
  await as(id.pubA, async () => {
    assert.equal((await one("select staff_name($1) n", [id.editor])).n, "Editor Name");
    assert.equal((await one("select staff_name($1) n", [id.reader])).n, null);
  });
});

test("stale invitations: no un-blocking, no overriding a newer role, revoked on block or role change", async () => {
  // A reader with an open invitation is blocked → the invitation is revoked.
  const blocked = "00000000-0000-4000-8000-000000000e30";
  await q("insert into auth.users (id, email) values ($1, 'blocked.reader@example.org')", [
    blocked,
  ]);
  await as(id.admin, () =>
    q("insert into invitations (email, role_id) values ('blocked.reader@example.org', 'observer')"),
  );
  await as(id.permAdmin, () =>
    q("update profiles set status = 'blocked', blocked_note = 'Spam' where id = $1", [blocked]),
  );
  const revoked = await one(
    "select revoked_at is not null as revoked from invitations where email = 'blocked.reader@example.org'",
  );
  assert.equal(revoked.revoked, true);

  // Even an invitation that slipped through doesn't un-block the account.
  await q(
    "insert into invitations (email, role_id) values ('blocked.reader@example.org', 'observer')",
  );
  await q("update auth.users set email_confirmed_at = now() where id = $1", [blocked]);
  await as(blocked, async () => assert.equal((await one("select claim_invitation() r")).r, null));
  assert.deepEqual(
    { ...(await one("select role_id, status from profiles where id = $1", [blocked])) },
    { role_id: "reader", status: "blocked" },
  );

  // A team member with another role keeps it (an old invitation doesn't override).
  await q(
    "insert into invitations (email, role_id) values ('pub.a@atlasoftodaysworld.org', 'observer')",
  );
  await as(id.pubA, async () => assert.equal((await one("select claim_invitation() r")).r, null));
  assert.equal(
    (await one("select role_id from profiles where id = $1", [id.pubA])).role_id,
    "publisher",
  );

  // A role change revokes what is still open for that address.
  await as(id.permAdmin, () =>
    q("update profiles set role_id = 'news-writer' where id = $1", [id.pubA]),
  );
  const open = await one(
    `select count(*)::int n from invitations
      where email = 'pub.a@atlasoftodaysworld.org' and revoked_at is null and accepted_at is null`,
  );
  assert.equal(open.n, 0);
  await q("update profiles set role_id = 'publisher' where id = $1", [id.pubA]);
});

test("new helpers: grants as intended", async () => {
  await as(null, async () => {
    await refused(q("select withdraw_entry(gen_random_uuid())"), /permission denied/);
    await refused(q("select approve_entry(gen_random_uuid())"), /permission denied/);
  });
  await as(id.pubA, () => refused(q("select role_needs_admin('publisher')"), /permission denied/));
  assert.equal((await one("select role_needs_admin('publisher') r")).r, false);
  assert.equal((await one("select role_needs_admin('content-approver') r")).r, true);
  assert.equal((await one("select role_needs_admin('content-editor') r")).r, true);
  assert.equal((await one("select role_needs_admin('permission-admin') r")).r, true);
});
