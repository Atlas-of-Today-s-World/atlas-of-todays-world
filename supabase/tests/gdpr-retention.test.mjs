import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

/**
 * GDPR retention (migration 20261013000360, owner decisions of 2026-10-15):
 *  - the one-time scrub removes volunteer application text and invitation
 *    notes from audit snapshots that existed before the migration, keeps the
 *    rows, and changes nothing when it runs again;
 *  - invitation notes stay out of new audit rows;
 *  - delete_my_personal_data() removes accepted invitations too and the
 *    caller's exact address from allowed_emails (never a domain row, never the
 *    last row), and the address from that row's audit entries;
 *  - my_personal_data() adds invitation notes, the caller's own audit actions
 *    (column names only) and the site page revisions they saved (no content);
 *    the caller reads their own blocked_note under RLS.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const RETENTION = "20261013000360_gdpr_retention.sql";
const db = new PGlite({ extensions: { pg_trgm } });

const id = {
  admin: "00000000-0000-4000-8000-000000000f01",
  reader: "00000000-0000-4000-8000-000000000f02",
  other: "00000000-0000-4000-8000-000000000f03",
  unconfirmed: "00000000-0000-4000-8000-000000000f04",
};
const EMAIL = {
  admin: "admin@atlasoftodaysworld.org",
  reader: "ana@example.org",
  other: "bob@example.org",
  unconfirmed: "eve@example.org",
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
 * Runs `sql` as `user` (null = anon) in a transaction that is rolled back;
 * returns the rows or the error code, plus what `after` reads before the rollback.
 */
async function as(user, sql, params = [], { after } = {}) {
  await db.exec("begin");
  try {
    await db.exec(`select set_config('request.jwt.claim.sub', '${user ?? ""}', true);
      select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
      set local role ${user ? "authenticated" : "anon"};`);
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

const migrationFiles = readdirSync(migrations)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function migrate(files) {
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(migrations, file), "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }
  }
}

const auditSnapshot = () =>
  q("select id, at, actor, action, target, detail from audit_log order by id");

/** Audit rows as they were before 20261013000350/360, written straight into the log. */
const LEGACY = [
  [
    "volunteer_applications.delete",
    "v-1",
    {
      old: {
        id: "v-1",
        name: "Ana Legacy",
        topics: "Water",
        message: "I would like to help",
        status: "new",
      },
    },
  ],
  [
    "volunteer_applications.update",
    "v-2",
    {
      old: { message: "Old text", status: "new", updated_at: "2026-10-01" },
      new: { message: "New text", status: "contacted", updated_at: "2026-10-02" },
    },
  ],
  ["invitations.insert", "i-1", { new: { id: "i-1", role_id: "publisher", note: "Knows Ana" } }],
  ["invitations.update", "i-1", { old: { note: "Knows Ana" }, new: { note: "Met Ana" } }],
  // Not snapshots of those tables, or nothing to remove: left exactly as they are.
  ["roles.update", "publisher", { old: { name: "Publisher" }, new: { name: "Editor" } }],
  ["allowed_emails.insert", "x@example.org", { new: { value: "x@example.org", note: "Note" } }],
  ["invitations.delete", "i-2", { old: { id: "i-2", role_id: "publisher" } }],
  ["volunteer_applications.custom", "v-3", ["name", "message"]],
];

let preScrub;
let postScrub;

before(async () => {
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  const at = migrationFiles.indexOf(RETENTION);
  assert.ok(at > 0, `${RETENTION} exists`);
  await migrate(migrationFiles.slice(0, at));

  // Production-like data from before the retention migration.
  const actor = "00000000-0000-4000-8000-0000000000aa";
  for (const [action, target, detail] of LEGACY) {
    await q(
      "insert into audit_log (at, actor, action, target, detail) values ('2026-10-01', $1::uuid, $2, $3, $4::jsonb)",
      [actor, action, target, JSON.stringify(detail)],
    );
  }
  preScrub = await auditSnapshot();

  await migrate(migrationFiles.slice(at));
  postScrub = await auditSnapshot();

  await account(id.admin, EMAIL.admin, "admin");
  await account(id.reader, EMAIL.reader, "reader");
  await account(id.other, EMAIL.other, "reader");
  await account(id.unconfirmed, EMAIL.unconfirmed, "reader", false);
});

// ---------------------------------------------------------------------------
// One-time scrub
// ---------------------------------------------------------------------------

test("scrub: application text and invitation notes leave existing snapshots, the rows stay", () => {
  const by = Object.fromEntries(postScrub.map((row) => [`${row.action}:${row.target}`, row]));
  assert.equal(postScrub.length, preScrub.length, "no row removed");
  assert.deepEqual(
    postScrub.map((row) => [row.id, row.at, row.actor, row.action, row.target]),
    preScrub.map((row) => [row.id, row.at, row.actor, row.action, row.target]),
    "ids, timestamps, actors, actions and targets unchanged",
  );
  assert.deepEqual(by["volunteer_applications.delete:v-1"].detail, {
    old: { id: "v-1", status: "new" },
  });
  assert.deepEqual(by["volunteer_applications.update:v-2"].detail, {
    old: { status: "new", updated_at: "2026-10-01" },
    new: { status: "contacted", updated_at: "2026-10-02" },
  });
  assert.deepEqual(by["invitations.insert:i-1"].detail, {
    new: { id: "i-1", role_id: "publisher" },
  });
  assert.deepEqual(by["invitations.update:i-1"].detail, { old: {}, new: {} });
  assert.doesNotMatch(
    JSON.stringify(
      postScrub.filter((row) => /^(volunteer_applications|invitations)\./.test(row.action)),
    ),
    /Ana|help|Water|Old text|New text|Knows|Met/,
  );
});

test("scrub: other tables and rows with nothing to remove are untouched", () => {
  const untouched = [
    "roles.update",
    "allowed_emails.insert",
    "invitations.delete",
    "volunteer_applications.custom",
  ];
  for (const action of untouched) {
    const before = preScrub.find((row) => row.action === action);
    const after = postScrub.find((row) => row.action === action);
    assert.deepEqual(after.detail, before.detail, action);
  }
});

test("scrub: running the migration again changes nothing", async () => {
  await db.exec("begin");
  try {
    const before = await auditSnapshot();
    await db.exec(readFileSync(join(migrations, RETENTION), "utf8"));
    assert.deepEqual(await auditSnapshot(), before);
    assert.deepEqual(before.slice(0, postScrub.length), postScrub);
  } finally {
    await db.exec("rollback");
  }
});

// ---------------------------------------------------------------------------
// New audit rows
// ---------------------------------------------------------------------------

test("audit: an invitation's note is not logged on insert, update or delete", async () => {
  await db.exec("begin");
  try {
    const invite = await one(
      "insert into invitations (email, role_id, note) values ('new@example.org', 'publisher', 'About the person') returning id",
    );
    await q(
      "update invitations set note = 'Changed note', expires_at = expires_at + interval '1 day' where id = $1",
      [invite.id],
    );
    await q("delete from invitations where id = $1", [invite.id]);
    const rows = await q(
      "select action, target, detail from audit_log where target = $1 order by id",
      [invite.id],
    );
    assert.deepEqual(
      rows.map((row) => row.action),
      ["invitations.insert", "invitations.update", "invitations.delete"],
    );
    assert.equal(rows[0].detail.new.role_id, "publisher");
    assert.ok("expires_at" in rows[1].detail.new, "other changes are still logged");
    assert.equal(rows[2].detail.old.id, invite.id);
    assert.doesNotMatch(JSON.stringify(rows), /About the person|Changed note|new@example/);
  } finally {
    await db.exec("rollback");
  }
});

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

/** Ana: one accepted and one pending invitation; Bob: one pending. */
async function invitations() {
  await q(
    `insert into invitations (email, role_id, note, accepted_at, accepted_by) values
       ($1, 'publisher', 'Accepted note', now(), $3),
       ($1, 'content-approver', 'Pending note', null, null),
       ($2, 'publisher', 'Bob note', null, null)`,
    [EMAIL.reader, EMAIL.other, id.reader],
  );
}

test("deletion: removes every invitation to the verified e-mail, accepted ones too", async () => {
  await db.exec("begin");
  try {
    await invitations();
    const result = await as(id.reader, "select public.delete_my_personal_data() as removed", [], {
      after: `select
        (select json_agg(email order by email) from invitations) as left,
        (select json_agg(detail order by id) from audit_log
           where action = 'invitations.delete' and at >= now()) as audit`,
    });
    assert.deepEqual(result.rows[0].removed, {
      invitations: 2,
      volunteerApplications: 0,
      allowedEmails: 0,
    });
    const [after] = result.after;
    assert.deepEqual(after.left, [EMAIL.other], "Bob's invitation stays");
    // The audit rows of the deletion stay, with ids and no note or address.
    const audit = after.audit;
    assert.equal(audit.length, 2);
    assert.ok(audit.every((detail) => detail.old.id && !("note" in detail.old)));
    assert.doesNotMatch(JSON.stringify(audit), /note|example\.org/i);
  } finally {
    await db.exec("rollback");
  }
});

test("deletion: an invitation the account accepted goes even under another address", async () => {
  await db.exec("begin");
  try {
    await q(
      `insert into invitations (email, role_id, accepted_at, accepted_by)
       values ('ana.old@example.org', 'publisher', now(), $1)`,
      [id.reader],
    );
    const result = await as(id.reader, "select public.delete_my_personal_data() as removed", [], {
      after: "select count(*)::int as n from invitations",
    });
    assert.equal(result.rows[0].removed.invitations, 1);
    assert.equal(result.after[0].n, 0);
  } finally {
    await db.exec("rollback");
  }
});

test("deletion: the exact address leaves the allowed list and its audit rows; domains stay", async () => {
  await db.exec("begin");
  try {
    await q(
      `insert into allowed_emails (value, note) values
         ($1, 'Ana from the workshop'), ($2, ''), ('@atlasoftodaysworld.org', 'Team domain')`,
      [EMAIL.reader, EMAIL.other],
    );
    const result = await as(id.reader, "select public.delete_my_personal_data() as removed", [], {
      after: `select
        (select json_agg(value order by value) from allowed_emails) as list,
        (select json_agg(json_build_object('action', action, 'target', target, 'detail', detail) order by id)
           from audit_log where action like 'allowed\\_emails.%' and at >= now()) as audit`,
    });
    assert.equal(result.rows[0].removed.allowedEmails, 1);
    const [after] = result.after;
    assert.deepEqual(after.list, ["@atlasoftodaysworld.org", EMAIL.other]);
    const audit = JSON.stringify(after.audit);
    assert.doesNotMatch(audit, /ana@example\.org|workshop/, "Ana's address left the log");
    assert.match(audit, /bob@example\.org/, "other addresses' rows stay as they were");
    assert.ok(
      after.audit.some((row) => row.action === "allowed_emails.delete" && row.target === null),
      "the removal itself is logged, without the address",
    );
  } finally {
    await db.exec("rollback");
  }
});

test("deletion: the last row of the allowed list stays (an empty list would allow any invitation)", async () => {
  await db.exec("begin");
  try {
    await q("insert into allowed_emails (value) values ($1)", [EMAIL.reader]);
    const result = await as(id.reader, "select public.delete_my_personal_data() as removed", [], {
      after: "select json_agg(value) as list from allowed_emails",
    });
    assert.equal(result.rows[0].removed.allowedEmails, 0);
    assert.deepEqual(result.after[0].list, [EMAIL.reader]);
  } finally {
    await db.exec("rollback");
  }
});

test("deletion: an unconfirmed e-mail removes nothing matched by address", async () => {
  await db.exec("begin");
  try {
    await q("insert into invitations (email, role_id) values ($1, 'publisher')", [
      EMAIL.unconfirmed,
    ]);
    await q("insert into allowed_emails (value) values ($1), ($2)", [
      EMAIL.unconfirmed,
      EMAIL.other,
    ]);
    const result = await as(
      id.unconfirmed,
      "select public.delete_my_personal_data() as removed",
      [],
      {
        after: `select (select count(*)::int from invitations) as invitations,
                     (select count(*)::int from allowed_emails) as allowed`,
      },
    );
    assert.deepEqual(result.rows[0].removed, {
      invitations: 0,
      volunteerApplications: 0,
      allowedEmails: 0,
    });
    assert.deepEqual(result.after[0], { invitations: 1, allowed: 2 });
  } finally {
    await db.exec("rollback");
  }
});

test("re-invite: while the allowed list is in use, the removed address must be added back first", async () => {
  await db.exec("begin");
  try {
    await q("insert into allowed_emails (value) values ($1)", [EMAIL.other]);
    const invite = "insert into invitations (email, role_id) values ($1, 'publisher')";
    assert.equal((await as(id.admin, invite, [EMAIL.reader])).error, "42501");
    await q("insert into allowed_emails (value) values ($1)", [EMAIL.reader]);
    assert.ok((await as(id.admin, invite, [EMAIL.reader])).rows, "invited once it is listed");
  } finally {
    await db.exec("rollback");
  }
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

test("export: invitation notes, including invitations the account accepted", async () => {
  await db.exec("begin");
  try {
    await invitations();
    await q(
      `insert into invitations (email, role_id, note, accepted_at, accepted_by)
       values ('ana.old@example.org', 'publisher', 'Old address', now(), $1)`,
      [id.reader],
    );
    const { rows } = await as(id.reader, "select public.my_personal_data() as data");
    const notes = rows[0].data.invitations.map((i) => i.note).sort();
    assert.deepEqual(notes, ["Accepted note", "Old address", "Pending note"]);
    assert.ok(rows[0].data.invitations.every((i) => !("invitedBy" in i)));
    assert.doesNotMatch(JSON.stringify(rows[0].data), /Bob note|bob@/);
  } finally {
    await db.exec("rollback");
  }
});

test("export: the caller's own audit actions, column names only", async () => {
  await db.exec("begin");
  try {
    await q(
      `insert into audit_log (actor, action, target, detail) values
         ($1::uuid, 'profiles.update', $2::text, '{"old":{"name":"Old name"},"new":{"name":"New name"}}'),
         ($1::uuid, 'allowed_emails.insert', 'someone@example.org', '{"new":{"value":"someone@example.org","note":"Secret"}}'),
         ($1::uuid, 'profiles.email', $1::text, '{"changed":["email"]}'),
         ($1::uuid, 'entries.schedule', 'topic-a', '{"at":"2026-11-01"}'),
         ($2::uuid, 'roles.update', 'publisher', '{"old":{"name":"Bob was here"}}')`,
      [id.reader, id.other],
    );
    const { rows } = await as(id.reader, "select public.my_personal_data() as data");
    const actions = rows[0].data.auditActions;
    assert.deepEqual(
      actions.map(({ action, table, targetId, columns }) => ({ action, table, targetId, columns })),
      [
        { action: "profiles.update", table: "profiles", targetId: id.other, columns: ["name"] },
        {
          action: "allowed_emails.insert",
          table: "allowed_emails",
          targetId: null,
          columns: ["note", "value"],
        },
        { action: "profiles.email", table: "profiles", targetId: id.reader, columns: ["email"] },
        { action: "entries.schedule", table: "entries", targetId: "topic-a", columns: [] },
      ],
    );
    assert.ok(actions.every((a) => typeof a.at === "string"));
    assert.doesNotMatch(JSON.stringify(actions), /Old name|New name|someone@|Secret|Bob was here/);
  } finally {
    await db.exec("rollback");
  }
});

test("export: site page revisions the caller saved, without the page content", async () => {
  await db.exec("begin");
  try {
    await q(
      `insert into site_page_revisions (page_slug, saved_by, title, description, lead, body_html, published) values
         ('about', $1, 'Ana title', 'Ana description', 'Ana lead', '<p>Secret body</p>', true),
         ('privacy', $2, 'Bob title', '', '', '<p>Bob body</p>', true)`,
      [id.reader, id.other],
    );
    const { rows } = await as(id.reader, "select public.my_personal_data() as data");
    const revisions = rows[0].data.sitePageRevisions;
    assert.equal(revisions.length, 1);
    assert.deepEqual(Object.keys(revisions[0]).sort(), ["id", "savedAt", "slug"]);
    assert.equal(revisions[0].slug, "about");
    assert.doesNotMatch(JSON.stringify(rows[0].data), /Secret body|Ana title|Bob/);
  } finally {
    await db.exec("rollback");
  }
});

test("export: an account without any of it gets empty lists; anon is refused", async () => {
  const { rows } = await as(id.other, "select public.my_personal_data() as data");
  assert.deepEqual(rows[0].data.sitePageRevisions, []);
  assert.deepEqual(rows[0].data.auditActions, []);
  assert.equal((await as(null, "select public.my_personal_data()")).error, "42501");
});

test("export: a user reads their own blocked_note under RLS, not anyone else's", async () => {
  await db.exec("begin");
  try {
    await q("update profiles set blocked_note = 'Spam in comments' where id = $1", [id.reader]);
    await q("update profiles set blocked_note = 'Bob note' where id = $1", [id.other]);
    const own = await as(id.reader, "select id, blocked_note from profiles");
    assert.deepEqual(own.rows, [{ id: id.reader, blocked_note: "Spam in comments" }]);
  } finally {
    await db.exec("rollback");
  }
});

test("the helpers are not callable by app roles", async () => {
  for (const fn of [
    "public.audit_detail_without('{}'::jsonb, array['x'])",
    "public.audit_detail_has('{}'::jsonb, array['x'])",
  ]) {
    assert.equal((await as(id.admin, `select ${fn}`)).error, "42501", fn);
    assert.equal((await as(null, `select ${fn}`)).error, "42501", fn);
  }
});
