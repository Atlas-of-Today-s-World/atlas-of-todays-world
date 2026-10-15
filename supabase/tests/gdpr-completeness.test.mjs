import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

/**
 * GDPR completeness (migration 20261013000350, audit S-L14):
 *  - my_personal_data() gives the caller only their own invitations and
 *    volunteer applications (by confirmed e-mail), their linked author profile
 *    and the metadata of revisions they saved — nothing of anyone else's;
 *  - delete_my_personal_data() removes exactly those of the caller's rows that
 *    no foreign key ties to the account, refuses for the last admin and
 *    without a required second factor;
 *  - deleting the account keeps the public author profile (unlinked) and
 *    cascades the rest;
 *  - unreferenced_uploads() keeps every file whose name appears in content;
 *  - the audit log gets no e-mail address and no application text.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite({ extensions: { pg_trgm } });

const id = {
  admin: "00000000-0000-4000-8000-000000000e01",
  reader: "00000000-0000-4000-8000-000000000e02",
  other: "00000000-0000-4000-8000-000000000e03",
  writer: "00000000-0000-4000-8000-000000000e04",
  unconfirmed: "00000000-0000-4000-8000-000000000e05",
  approver: "00000000-0000-4000-8000-000000000e06",
};
const EMAIL = {
  admin: "admin@atlasoftodaysworld.org",
  reader: "ana@example.org",
  other: "bob@example.org",
  writer: "writer@atlasoftodaysworld.org",
  unconfirmed: "eve@example.org",
  approver: "approver@atlasoftodaysworld.org",
};

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

async function account(uid, email, role, confirmed = true) {
  await q("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)", [
    uid,
    email,
    confirmed ? new Date() : null,
  ]);
  await q("update profiles set role_id = $2 where id = $1", [uid, role]);
}

/**
 * Runs `sql` as `user` (null = anon; "service" = service_role) in a transaction
 * that is rolled back; returns the rows or the error code, plus what `after`
 * reads before the rollback.
 */
async function as(user, sql, params = [], { aal = "aal2", after } = {}) {
  await db.exec("begin");
  try {
    const role = user === "service" ? "service_role" : user ? "authenticated" : "anon";
    const sub = user && user !== "service" ? user : "";
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub}', true);
      select set_config('request.jwt.claims', '{"aal":"${aal}"}', true);
      set local role ${role};`);
    let result;
    try {
      result = { rows: (await db.query(sql, params)).rows };
    } catch (error) {
      return { error: error.code ?? String(error.message) };
    }
    await db.exec("reset role");
    if (after) result.after = await q(after);
    return result;
  } finally {
    await db.exec("rollback");
  }
}

let entryId;

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
      ('BRA', 'brazil', 'Brazil', 'latin-america-caribbean');
  `);
  await account(id.admin, EMAIL.admin, "admin");
  await account(id.reader, EMAIL.reader, "reader");
  await account(id.other, EMAIL.other, "reader");
  await account(id.writer, EMAIL.writer, "publisher");
  await account(id.unconfirmed, EMAIL.unconfirmed, "reader", false);
  await account(id.approver, EMAIL.approver, "content-approver");

  // The reader once wrote for the Atlas: an author profile linked to the
  // account and revisions saved on an entry they can no longer edit.
  await q(
    `insert into authors (name, slug, bio, profile_id, photo_url) values
       ('Ana Author', 'ana-author', 'Bio of Ana', $1, 'https://x.supabase.co/storage/v1/object/public/entry-images/${id.reader}/11111111-1111-4111-8111-111111111111.jpg'),
       ('Bob Author', 'bob-author', 'Bio of Bob', $2, null)`,
    [id.reader, id.other],
  );
  entryId = (
    await one(
      `insert into entries (slug, title, summary, category, region_slug, owner_id, status, body_html)
       values ('topic-a', 'Topic A', 'Summary', 'Society', 'latin-america-caribbean', $1, 'draft',
               '<p><img src="https://x.supabase.co/storage/v1/object/public/entry-images/${id.reader}/22222222-2222-4222-8222-222222222222.png"></p>')
       returning id`,
      [id.writer],
    )
  ).id;
  await q(
    `insert into entry_revisions (entry_id, saved_by, snapshot) values
       ($1, $2, '{"status":"draft","title":"Secret draft by Ana"}'),
       ($1, $3, '{"status":"draft","title":"Draft by the writer","audio":"entry-audio/${id.reader}/33333333-3333-4333-8333-333333333333.mp3"}')`,
    [entryId, id.reader, id.writer],
  );

  // Invitations: one accepted and one pending to Ana, one to Bob, one to Eve.
  await q(
    `insert into invitations (email, role_id, note, accepted_at, accepted_by) values
       ($1, 'publisher', 'Old note', now(), null),
       ($1, 'publisher', 'Internal note about Ana', null, null),
       ($2, 'publisher', '', null, null),
       ($3, 'publisher', '', null, null)`,
    [EMAIL.reader, EMAIL.other, EMAIL.unconfirmed],
  );
  await q(
    `insert into volunteer_applications (name, email, topics, message) values
       ('Ana', $1, 'Water', 'I would like to help'),
       ('Bob', $2, 'Food', 'Me too'),
       ('Eve', $3, 'Air', 'Not verified')`,
    [EMAIL.reader, EMAIL.other, EMAIL.unconfirmed],
  );
  await q(
    `insert into page_views_daily (user_id, day, views) values ($1, '2026-10-01', 3), ($2, '2026-10-01', 5)`,
    [id.reader, id.other],
  );
  await q("insert into approver_countries values ($1, 'BRA')", [id.approver]);
  // A legacy audit row (before DB-14) with the actor's e-mail, and one of Bob's.
  await q(
    `insert into audit_log (actor, actor_email, action, target) values
       ($1, $2, 'legacy.action', 'x'), ($3, $4, 'legacy.action', 'y')`,
    [id.reader, EMAIL.reader, id.other, EMAIL.other],
  );
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

test("export: only the caller's own invitations, applications, author profile and revisions", async () => {
  const { rows } = await as(id.reader, "select public.my_personal_data() as data");
  const data = rows[0].data;
  assert.equal(data.authorProfile.slug, "ana-author");
  assert.equal(data.authorProfile.bio, "Bio of Ana");
  assert.deepEqual(
    data.invitations.map((i) => i.email),
    [EMAIL.reader, EMAIL.reader],
  );
  assert.ok(
    // Notes about the person are exported since 20261013000360; the inviter is not.
    data.invitations.every((i) => !("invitedBy" in i)),
    "no inviter",
  );
  assert.deepEqual(
    data.volunteerApplications.map((v) => [v.name, v.message]),
    [["Ana", "I would like to help"]],
  );
  assert.equal(data.entryRevisions.length, 1, "only revisions Ana saved");
  assert.equal(data.entryRevisions[0].entryId, entryId);
  assert.ok(!("snapshot" in data.entryRevisions[0]), "metadata only, not the content");
  assert.doesNotMatch(JSON.stringify(data), /Bob|bob@|writer/);
});

test("export: an unconfirmed e-mail gets nothing matched by address", async () => {
  const { rows } = await as(id.unconfirmed, "select public.my_personal_data() as data");
  assert.deepEqual(rows[0].data.invitations, []);
  assert.deepEqual(rows[0].data.volunteerApplications, []);
  assert.equal(rows[0].data.authorProfile, null);
});

test("export: anon may not call it; the rest of the export is readable under RLS", async () => {
  assert.equal((await as(null, "select public.my_personal_data()")).error, "42501");
  const own = async (table, column = "user_id") =>
    (await as(id.reader, `select ${column} from ${table}`)).rows.map((row) => row[column]);
  assert.deepEqual(await own("page_views_daily"), [id.reader]);
  assert.deepEqual(
    (await as(id.approver, "select user_id, country_iso3 from approver_countries")).rows,
    [{ user_id: id.approver, country_iso3: "BRA" }],
  );
  assert.deepEqual(await own("approver_countries"), []);
});

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

test("deletion: removes the caller's invitations and applications, nothing else", async () => {
  const result = await as(id.reader, "select public.delete_my_personal_data() as removed", [], {
    after: `select
      (select json_agg(json_build_object('email', email, 'accepted', accepted_at is not null) order by email, accepted_at)
         from invitations) as invitations,
      (select json_agg(email order by email) from volunteer_applications) as applications,
      (select json_agg(json_build_object('actor', actor, 'email', actor_email) order by target)
         from audit_log where action = 'legacy.action') as legacy,
      (select json_agg(detail) from audit_log where action = 'volunteer_applications.delete') as audit`,
  });
  // Accepted invitations go too since 20261013000360.
  assert.deepEqual(result.rows[0].removed, {
    invitations: 2,
    volunteerApplications: 1,
    allowedEmails: 0,
  });
  const [after] = result.after;
  assert.deepEqual(after.invitations, [
    { email: EMAIL.other, accepted: false },
    { email: EMAIL.unconfirmed, accepted: false },
  ]);
  assert.deepEqual(after.applications, [EMAIL.other, EMAIL.unconfirmed]);
  assert.deepEqual(after.legacy, [
    { actor: id.reader, email: null },
    { actor: id.other, email: EMAIL.other },
  ]);
  // The application's text didn't move into the audit log.
  assert.equal(after.audit.length, 1);
  assert.doesNotMatch(JSON.stringify(after.audit), /Ana|help|Water|example\.org/);
});

test("deletion: an unconfirmed e-mail removes nothing matched by address", async () => {
  const result = await as(id.unconfirmed, "select public.delete_my_personal_data() as removed");
  assert.deepEqual(result.rows[0].removed, {
    invitations: 0,
    volunteerApplications: 0,
    allowedEmails: 0,
  });
});

test("deletion: anon can't call it, the last admin and a missing second factor are refused", async () => {
  assert.equal((await as(null, "select public.delete_my_personal_data()")).error, "42501");
  assert.equal((await as(id.admin, "select public.delete_my_personal_data()")).error, "42501");

  await q("update security_settings set require_2fa_roles = array['publisher'] where id = 1");
  try {
    const call = "select public.delete_my_personal_data()";
    assert.equal((await as(id.writer, call, [], { aal: "aal1" })).error, "42501");
    assert.ok((await as(id.writer, call, [], { aal: "aal2" })).rows);
    assert.ok((await as(id.reader, call, [], { aal: "aal1" })).rows, "readers need no 2FA");
  } finally {
    await q("update security_settings set require_2fa_roles = '{}' where id = 1");
  }
});

test("deleting the account keeps the author profile, unlinked, and cascades personal rows", async () => {
  await db.exec("begin");
  try {
    await q("delete from auth.users where id = $1", [id.reader]);
    const author = await one("select name, bio, profile_id from authors where slug = 'ana-author'");
    assert.deepEqual(author, { name: "Ana Author", bio: "Bio of Ana", profile_id: null });
    assert.equal(
      (await one("select count(*)::int as n from page_views_daily where user_id = $1", [id.reader]))
        .n,
      0,
    );
    const revision = await one(
      "select saved_by from entry_revisions where snapshot->>'title' = 'Secret draft by Ana'",
    );
    assert.equal(revision.saved_by, null, "the revision stays, without the account");
  } finally {
    await db.exec("rollback");
  }
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

test("unreferenced uploads: files named anywhere in content stay, only unused ones are returned", async () => {
  const path = (file) => `${id.reader}/${file}`;
  const author = path("11111111-1111-4111-8111-111111111111.jpg");
  const inBody = path("22222222-2222-4222-8222-222222222222.png");
  const inRevision = path("33333333-3333-4333-8333-333333333333.mp3");
  const inSettings = path("44444444-4444-4444-8444-444444444444.webp");
  const unused = path("55555555-5555-4555-8555-555555555555.jpg");
  await q("update site_settings set og_image_url = $1", [
    `https://x.supabase.co/storage/v1/render/image/public/entry-images/${inSettings}?width=1200`,
  ]);
  const paths = [author, inBody, inRevision, inSettings, unused, unused, "../etc/passwd", "a/b"];
  const result = await as("service", "select public.unreferenced_uploads($1) as paths", [paths]);
  assert.deepEqual(result.rows[0].paths, [unused]);

  // Only mentioned in the audit log: not in use.
  await q("insert into audit_log (action, target, detail) values ('x', 'y', $1)", [
    JSON.stringify({ photo_url: unused }),
  ]);
  assert.deepEqual(
    (await as("service", "select public.unreferenced_uploads($1) as paths", [[unused]])).rows[0]
      .paths,
    [unused],
  );
  assert.deepEqual(
    (await as("service", "select public.unreferenced_uploads(null) as paths")).rows[0].paths,
    [],
  );
});

test("unreferenced uploads: only the service role may ask", async () => {
  for (const user of [null, id.reader, id.admin]) {
    assert.equal(
      (await as(user, "select public.unreferenced_uploads(array['x'])")).error,
      "42501",
      `${user ?? "anon"} is refused`,
    );
  }
});

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

test("audit: an e-mail change is logged without the address", async () => {
  await db.exec("begin");
  try {
    await q("update auth.users set email = 'ana.new@example.org' where id = $1", [id.reader]);
    const row = await one(
      "select target, detail, actor_email from audit_log where action = 'profiles.email'",
    );
    assert.deepEqual(row, { target: id.reader, detail: { changed: ["email"] }, actor_email: null });
    assert.equal(
      (await one("select count(*)::int as n from audit_log where action = 'profiles.email'")).n,
      1,
    );
  } finally {
    await db.exec("rollback");
  }
});

test("audit: other tables log as before; application status changes are still logged", async () => {
  await db.exec("begin");
  try {
    await q("update volunteer_applications set status = 'contacted' where email = $1", [
      EMAIL.other,
    ]);
    const update = await one(
      "select detail from audit_log where action = 'volunteer_applications.update'",
    );
    assert.equal(update.detail.old.status, "new");
    assert.equal(update.detail.new.status, "contacted");
    await q(
      "insert into invitations (email, role_id, note) values ('new@example.org', 'publisher', 'n')",
    );
    const invite = await one(
      "select detail from audit_log where action = 'invitations.insert' order by id desc limit 1",
    );
    assert.equal(invite.detail.new.role_id, "publisher");
    // The note stays out of the log since 20261013000360.
    assert.ok(!("note" in invite.detail.new));
    assert.ok(!("email" in invite.detail.new));
  } finally {
    await db.exec("rollback");
  }
});

test("write_audit stores only the actor id (DB-14)", async () => {
  const result = await as(id.writer, "select public.my_personal_data()", [], {
    after:
      "select count(*)::int as n from audit_log where actor_email is not null and action <> 'legacy.action'",
  });
  assert.equal(result.after[0].n, 0);
  const def = await one(
    "select pg_get_functiondef('public.write_audit(text, text, jsonb)'::regprocedure) as def",
  );
  assert.doesNotMatch(def.def, /actor_email/);
});
