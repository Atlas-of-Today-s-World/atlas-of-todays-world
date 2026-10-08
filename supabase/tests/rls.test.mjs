import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Access rules verified against a real Postgres.
 *
 * Migrations run in PGlite (Postgres in WebAssembly) with a small stand-in
 * for Supabase's `auth` and `storage` schemas on top, then each role is
 * tried to see what passes and what doesn't. This guards what the demo only
 * "looked like" — here the database must enforce it, whatever the app sends.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000001",
  permAdmin: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  pubA: "00000000-0000-4000-8000-000000000004",
  pubB: "00000000-0000-4000-8000-000000000005",
  approverLatam: "00000000-0000-4000-8000-000000000006",
  approverAsia: "00000000-0000-4000-8000-000000000007",
  dataEditor: "00000000-0000-4000-8000-000000000008",
  reader: "00000000-0000-4000-8000-000000000009",
  blocked: "00000000-0000-4000-8000-00000000000a",
  newcomer: "00000000-0000-4000-8000-00000000000b",
};

/**
 * Runs `fn` as a signed-in user (null = anonymous reader). The default
 * session has a second factor (aal2); `{ aal: "aal1" }` simulates a sign-in without TOTP.
 */
async function as(user, fn, { aal = "aal2" } = {}) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false);
    select set_config('request.jwt.claims', '{"aal":"${aal}"}', false);`);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);`);
  }
}

/** Runs `fn` with the service key (the server's own calls, no user session). */
async function asService(fn) {
  await db.exec("reset role; set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

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

async function newEntry(owner, slug, countries = [], status = "draft") {
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

  // Minimal geography for the tests.
  await db.exec(`
    insert into regions (slug, name, fill, stroke, center_lon, center_lat) values
      ('latin-america-caribbean', 'Latin America & Caribbean', '#aaaaaa', '#555555', -60, -10),
      ('east-asia', 'East Asia', '#aaaaaa', '#555555', 110, 35);
    insert into countries (iso3, slug, name, region_slug) values
      ('BRA', 'brazil', 'Brazil', 'latin-america-caribbean'),
      ('JPN', 'japan', 'Japan', 'east-asia'),
      ('USA', 'united-states', 'United States', null);
  `);

  // Accounts: sign-up creates a reader, roles are granted by the service key (auth.uid() is null).
  const people = [
    [id.admin, "admin@atlasoftodaysworld.org", "admin", "staff", "active"],
    [id.permAdmin, "perm@atlasoftodaysworld.org", "permission-admin", "staff", "active"],
    [id.editor, "editor@atlasoftodaysworld.org", "content-editor", "staff", "active"],
    [id.pubA, "pub.a@atlasoftodaysworld.org", "publisher", "staff", "active"],
    [id.pubB, "pub.b@atlasoftodaysworld.org", "publisher", "staff", "active"],
    [id.approverLatam, "latam@atlasoftodaysworld.org", "content-approver", "staff", "active"],
    [id.approverAsia, "asia@atlasoftodaysworld.org", "content-approver", "staff", "active"],
    [id.dataEditor, "data@atlasoftodaysworld.org", "data-editor", "staff", "active"],
    [id.reader, "reader@example.org", "reader", "reader", "active"],
    [id.blocked, "blocked@atlasoftodaysworld.org", "publisher", "staff", "blocked"],
    [id.newcomer, "newcomer@example.org", "reader", "reader", "active"],
  ];
  for (const [uid, email, role, kind, status] of people) {
    await q("insert into auth.users (id, email) values ($1, $2)", [uid, email]);
    await q("update profiles set role_id = $2, kind = $3, status = $4 where id = $1", [
      uid,
      role,
      kind,
      status,
    ]);
  }
  await q("insert into approver_countries values ($1, 'BRA')", [id.approverLatam]);
  await q("insert into approver_authors values ($1, $2)", [id.approverLatam, id.pubB]);
  await q("insert into approver_countries values ($1, 'JPN')", [id.approverAsia]);
});

// ---------------------------------------------------------------------------

test("sign-up creates a reader profile", async () => {
  const p = await one("select role_id, kind, status from profiles where id = $1", [id.newcomer]);
  assert.deepEqual(p, { role_id: "reader", kind: "reader", status: "active" });
});

test("anonymous reader sees only published articles", async () => {
  await newEntry(id.pubA, "anon-draft");
  await newEntry(id.pubA, "anon-published", [], "published"); // import with the service key
  const slugs = await as(null, () =>
    q("select slug from entries where slug like 'anon-%' order by slug"),
  );
  assert.deepEqual(
    slugs.map((r) => r.slug),
    ["anon-published"],
  );
});

test("anonymous user cannot write anything", async () => {
  await as(null, () =>
    refused(
      q("insert into entries (slug, title, category, owner_id) values ('x', 'x', 'Society', null)"),
      /permission denied/,
    ),
  );
});

test("publisher writes own drafts, not others'", async () => {
  await as(id.pubA, async () => {
    const own = await one(
      `insert into entries (slug, title, category, owner_id) values ('pub-own', 'Own', 'Society', $1) returning id`,
      [id.pubA],
    );
    assert.ok(own.id);
    // The trigger refuses it already (before RLS) — with a message editors understand.
    await refused(
      q(
        `insert into entries (slug, title, category, owner_id) values ('pub-fake', 'Fake', 'Society', $1)`,
        [id.pubB],
      ),
      /belong to whoever writes them|row-level security/,
    );
  });
  const foreign = await newEntry(id.pubB, "pub-b-draft");
  const changed = await as(id.pubA, () =>
    q("update entries set title = 'hijack' where id = $1 returning id", [foreign]),
  );
  assert.equal(changed.length, 0, "another author's draft must not be overwritable");
  const other = await as(id.pubA, () => q("select id from entries where id = $1", [foreign]));
  assert.equal(other.length, 0, "publisher can't even see another author's draft");
});

test("publisher can't publish, neither directly nor via a forged flag", async () => {
  const own = await newEntry(id.pubA, "pub-publish-try");
  await as(id.pubA, async () => {
    await refused(
      q("update entries set status = 'published' where id = $1", [own]),
      /through submit, approve|through approval/,
    );
    await refused(
      q(
        `select set_config('atlas.approving', 'on', false);
         update entries set status = 'published' where id = $1`,
        [own],
      ).catch(async () => {
        // PGlite won't run two statements with a parameter in one query — try them in turn.
        await q("select set_config('atlas.approving', 'on', false)");
        return q("update entries set status = 'published' where id = $1", [own]);
      }),
      /through submit, approve|through approval/,
    );
    await refused(q("select approve_entry($1)", [own]), /outside what you may approve/);
  });
});

test("publisher submits for approval", async () => {
  const own = await newEntry(id.pubA, "pub-submit");
  await as(id.pubA, () => q("select submit_entry($1)", [own]));
  assert.equal((await one("select status from entries where id = $1", [own])).status, "pending");
});

test("assigned approver approves only their countries and authors", async () => {
  const brazil = await newEntry(id.pubA, "appr-brazil", ["BRA"], "pending");
  const japan = await newEntry(id.pubA, "appr-japan", ["JPN"], "pending");
  const byB = await newEntry(id.pubB, "appr-by-b", ["USA"], "pending");

  await as(id.approverAsia, () => refused(q("select approve_entry($1)", [brazil]), /outside/));
  await as(id.approverLatam, () => refused(q("select approve_entry($1)", [japan]), /outside/));

  await as(id.approverLatam, () => q("select approve_entry($1)", [brazil]));
  await as(id.approverLatam, () => q("select approve_entry($1)", [byB])); // via the author
  await as(id.approverAsia, () => q("select approve_entry($1)", [japan]));

  const rows = await q(
    "select slug, status, approved_by from entries where slug like 'appr-%' order by slug",
  );
  assert.deepEqual(
    rows.map((r) => [r.slug, r.status]),
    [
      ["appr-brazil", "published"],
      ["appr-by-b", "published"],
      ["appr-japan", "published"],
    ],
  );
  assert.equal(rows[0].approved_by, id.approverLatam);
});

test("assigned approver doesn't approve their own work", async () => {
  await q("update profiles set role_id = 'content-approver' where id = $1", [id.pubB]);
  // pubB is now an approver assigned to Brazil
  await q("insert into approver_countries values ($1, 'BRA')", [id.pubB]);
  const own = await newEntry(id.pubB, "self-approve", ["BRA"], "pending");
  await as(id.pubB, () => refused(q("select approve_entry($1)", [own]), /outside/));
  await q("delete from approver_countries where user_id = $1", [id.pubB]);
  await q("update profiles set role_id = 'publisher' where id = $1", [id.pubB]);
});

test("sending back to the author requires a note", async () => {
  const entry = await newEntry(id.pubA, "send-back", ["BRA"], "pending");
  await as(id.approverLatam, () =>
    refused(q("select send_back_entry($1, '')", [entry]), /Say what needs to change/),
  );
  await as(id.approverLatam, () =>
    q("select send_back_entry($1, 'Sources for the second chapter, please.')", [entry]),
  );
  const row = await one("select status, review_note from entries where id = $1", [entry]);
  assert.equal(row.status, "draft");
  assert.match(row.review_note, /Sources/);
});

test("content editor edits another author's draft and publishes it", async () => {
  const entry = await newEntry(id.pubB, "editor-fix");
  await as(id.editor, async () => {
    const done = await q("update entries set title = 'Fixed' where id = $1 returning id", [entry]);
    assert.equal(done.length, 1);
    // Only a pending article can be approved (DB-09): submit first, then approve.
    await refused(q("select approve_entry($1)", [entry]), /waiting for approval/);
    await q("select submit_entry($1)", [entry]);
    await q("select approve_entry($1)", [entry]);
  });
  assert.equal(
    (await one("select status from entries where id = $1", [entry])).status,
    "published",
  );
});

test("author without approval rights can't edit their published article", async () => {
  const entry = await newEntry(id.pubA, "live-own", [], "published");
  await as(id.pubA, () =>
    refused(
      q("update entries set body_html = '<p>changed</p>' where id = $1", [entry]),
      /changed by someone who may also approve/,
    ),
  );
});

test("every text change keeps the previous version", async () => {
  const entry = await newEntry(id.pubA, "revisions");
  await as(id.pubA, async () => {
    await q("update entries set body_html = '<p>one</p>' where id = $1", [entry]);
    await q("update entries set body_html = '<p>two</p>' where id = $1", [entry]);
  });
  const count = await one("select count(*)::int as n from entry_revisions where entry_id = $1", [
    entry,
  ]);
  assert.equal(count.n, 2);
});

test("permission admin manages permissions, not content", async () => {
  const entry = await newEntry(id.pubA, "perm-admin-try");
  await as(id.permAdmin, async () => {
    const changed = await q("update entries set title = 'x' where id = $1 returning id", [entry]);
    assert.equal(changed.length, 0, "cannot reach content");
    await q("insert into role_permissions values ('observer', 'regions', 'v')");
    await refused(
      q("insert into role_permissions values ('permission-admin', 'news', 'vced')"),
      /own role/,
    );
    await refused(
      q("update profiles set approval_global = true where id = $1", [id.approverAsia]),
      /Only an admin can make an approver global/,
    );
    await refused(
      q("update profiles set role_id = 'admin' where id = $1", [id.reader]),
      /Only an admin can give the admin role/,
    );
    await refused(
      q("update profiles set role_id = 'content-editor' where id = $1", [id.permAdmin]),
      /your own role/,
    );
  });
});

test("admin role is locked and the last admin can't disappear", async () => {
  await as(id.admin, async () => {
    await q("update profiles set approval_global = true where id = $1", [id.approverAsia]);
    await refused(q("delete from roles where id = 'admin'"), /cannot be removed/);
    await refused(q("update roles set locked = false where id = 'admin'"), /locked/);
    await refused(
      q("insert into role_permissions values ('admin', 'news', 'v')"),
      /always has everything/,
    );
  });
  await refused(
    q("update profiles set role_id = 'reader' where id = $1", [id.admin]),
    /one active admin/,
  );
});

test("blocked account can do nothing", async () => {
  await as(id.blocked, async () => {
    await refused(
      q(
        `insert into entries (slug, title, category, owner_id) values ('blocked', 'x', 'Society', $1)`,
        [id.blocked],
      ),
      /row-level security/,
    );
    const perms = await q("select * from my_permissions()");
    assert.equal(perms.length, 0);
  });
});

test("reader sees only their own profile and can't reach the admin", async () => {
  await as(id.reader, async () => {
    const profiles = await q("select id from profiles");
    assert.deepEqual(
      profiles.map((p) => p.id),
      [id.reader],
    );
    assert.equal((await q("select * from audit_log")).length, 0);
    await refused(
      q("update profiles set role_id = 'publisher' where id = $1", [id.reader]),
      /your own|only your own/,
    );
  });
});

test("audit log captures permissions, roles and approvals", async () => {
  const actions = (await q("select action from audit_log")).map((r) => r.action);
  for (const expected of ["role_permissions.insert", "profiles.update", "entries.update"]) {
    assert.ok(actions.includes(expected), `audit log is missing ${expected}`);
  }
  const fromApp = await as(id.admin, () => q("select count(*)::int as n from audit_log"));
  assert.ok(fromApp[0].n > 0, "admin reads the log");
  await as(id.admin, () => refused(q("delete from audit_log"), /permission denied/));
});

test("staff account only from an allowed address (if the list is set)", async () => {
  await as(id.permAdmin, async () => {
    // The list limits staff to domains; an empty list doesn't (invitations protect staff).
    await q("insert into allowed_emails (value, note) values ('@atlasoftodaysworld.org', 'test')");
    await refused(
      q("update profiles set kind = 'staff' where id = $1", [id.newcomer]),
      /allowed e-mails/,
    );
    await q("insert into allowed_emails (value, note) values ('@example.org', 'test')");
    await q("update profiles set kind = 'staff' where id = $1", [id.newcomer]);
    await q("update profiles set kind = 'reader' where id = $1", [id.newcomer]);
    await q("delete from allowed_emails");
  });
});

test("nobody writes a paid membership from the app, only admin a complimentary one", async () => {
  await as(id.reader, () =>
    refused(
      q(
        "insert into memberships (user_id, plan, stripe_subscription_id) values ($1, 'patron', 'sub_x')",
        [id.reader],
      ),
    ),
  );
  await as(id.permAdmin, () =>
    refused(
      q("insert into memberships (user_id, plan, complimentary) values ($1, 'patron', true)", [
        id.reader,
      ]),
    ),
  );
  await as(id.admin, async () => {
    await refused(
      q(
        "insert into memberships (user_id, plan, stripe_subscription_id) values ($1, 'patron', 'sub_x')",
        [id.reader],
      ),
    );
    await q("insert into memberships (user_id, plan, complimentary) values ($1, 'patron', true)", [
      id.reader,
    ]);
  });
  // the webhook (service key) may write paid ones
  await q(
    "insert into memberships (user_id, plan, stripe_subscription_id, started_at) values ($1, 'founding', 'sub_1', now())",
    [id.pubA],
  );
});

test("patron_stats: anon sees only the aggregate, never individual memberships", async () => {
  // Service key (webhook) writes a paid membership with its monthly amount.
  await q(
    `insert into memberships (user_id, plan, stripe_subscription_id, monthly_amount_cents)
     values ($1, 'patron', 'sub_stats', 1500)
     on conflict (user_id) do update set plan = 'patron', status = 'active',
       stripe_subscription_id = 'sub_stats', monthly_amount_cents = 1500`,
    [id.pubB],
  );
  const expected = await one(
    `select count(*)::int patrons, coalesce(sum(monthly_amount_cents), 0)::bigint cents
     from memberships where status = 'active' and plan <> 'none'`,
  );
  assert.ok(expected.patrons >= 1);

  const stats = await as(null, () => one("select * from patron_stats()"));
  assert.equal(stats.patrons, expected.patrons);
  assert.equal(Number(stats.monthly_cents), Number(expected.cents));

  // The aggregate must not open the table itself to anonymous readers.
  await as(null, () => refused(q("select user_id, monthly_amount_cents from memberships")));
  // A complimentary membership cannot carry an amount.
  await refused(
    q(
      "update memberships set complimentary = true, stripe_subscription_id = null where user_id = $1",
      [id.pubB],
    ),
    /memberships_complimentary_no_amount/,
  );
  await q("delete from memberships where user_id = $1", [id.pubB]);
});

test("page views count only towards yourself", async () => {
  await as(id.reader, async () => {
    await q("select record_page_view()");
    await q("select record_page_view()");
    await refused(q("insert into page_views_daily (user_id, views) values ($1, 1000)", [id.admin]));
  });
  const row = await one("select views from page_views_daily where user_id = $1", [id.reader]);
  assert.equal(row.views, 2);
  const overview = await as(id.admin, () =>
    one("select pages_read from members_overview where id = $1", [id.reader]),
  );
  assert.equal(Number(overview.pages_read), 2);
});

test("map areas: only a valid shape and only with the areas permission", async () => {
  const hawaii = JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [-161.2, 22.7],
        [-154, 20.6],
        [-154, 18.4],
        [-161.2, 22.7],
      ],
    ],
  });
  await as(id.dataEditor, () =>
    refused(
      q(
        "insert into map_areas (slug, name, fill, stroke, geometry) values ('hawaii', 'Hawaii', '#4fb3a5', '#1f7166', $1)",
        [hawaii],
      ),
      /row-level security/,
    ),
  );
  await as(id.admin, async () => {
    await refused(
      q(
        "insert into map_areas (slug, name, fill, stroke, geometry) values ('bad', 'Bad', '#4fb3a5', '#1f7166', $1)",
        [
          JSON.stringify({
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          }),
        ],
      ),
      /check constraint/,
    );
    await refused(
      q(
        "insert into map_areas (slug, name, fill, stroke, geometry) values ('junk', 'Junk', '#4fb3a5', '#1f7166', $1)",
        [JSON.stringify({ type: "Polygon", coordinates: "nonsense" })],
      ),
      /check constraint/,
    );
    await q(
      "insert into map_areas (slug, name, fill, stroke, geometry, country_iso3) values ('hawaii', 'Hawaii', '#4fb3a5', '#1f7166', $1, 'USA')",
      [hawaii],
    );
  });
  const areas = await as(null, () => q("select slug from map_areas"));
  assert.deepEqual(
    areas.map((a) => a.slug),
    ["hawaii"],
  );
});

test("manual indicator value must have a source", async () => {
  await q(
    `insert into indicators (id, label, domain_min, domain_max) values ('hdi', 'HDI', 0.4, 0.96)`,
  );
  await as(id.dataEditor, async () => {
    await refused(
      q(
        "insert into indicator_values (indicator_id, country_iso3, value) values ('hdi', 'BRA', 0.8)",
      ),
      /needs a source/,
    );
    await q(`insert into indicator_values (indicator_id, country_iso3, value, source_note)
             values ('hdi', 'BRA', 0.8, 'UNDP HDR 2025, table 1')`);
  });
  const row = await one(
    "select is_manual, updated_by from indicator_values where country_iso3 = 'BRA'",
  );
  assert.equal(row.is_manual, true);
  assert.equal(row.updated_by, id.dataEditor);
  await as(id.pubA, () =>
    refused(
      q("update indicator_values set value = 0.1 where country_iso3 = 'BRA' returning 1").then(
        (rows) => {
          if (rows.length === 0) throw new Error("row-level security: nothing changed");
          return rows;
        },
      ),
      /row-level security/,
    ),
  );
});

test("images are uploaded only by writers and only into their own folder", async () => {
  await as(id.pubA, async () => {
    await q("insert into storage.objects (bucket_id, name) values ('entry-images', $1)", [
      `${id.pubA}/a.jpg`,
    ]);
    await refused(
      q("insert into storage.objects (bucket_id, name) values ('entry-images', $1)", [
        `${id.pubB}/a.jpg`,
      ]),
      /row-level security/,
    );
    await refused(
      q("insert into storage.objects (bucket_id, name) values ('entry-images', 'a.jpg')"),
      /row-level security/,
    );
  });
  await as(id.reader, () =>
    refused(
      q("insert into storage.objects (bucket_id, name) values ('entry-images', 'b.jpg')"),
      /row-level security/,
    ),
  );
});

test("an uploaded file can't be overwritten or removed by its uploader", async () => {
  const path = `${id.pubA}/locked.jpg`;
  // Updates and deletes only reach rows a SELECT policy shows; none exists for
  // these buckets today, so add one (as a file listing would) to test the
  // UPDATE/DELETE policies themselves.
  await q(
    "create policy test_storage_list on storage.objects for select to authenticated using (true)",
  );
  await as(id.pubA, () =>
    q("insert into storage.objects (bucket_id, name) values ('entry-images', $1)", [path]),
  );
  await as(id.pubA, async () => {
    await q("update storage.objects set name = $2 where name = $1", [
      path,
      `${id.pubA}/swapped.jpg`,
    ]);
    await q("delete from storage.objects where name = $1", [path]);
  });
  // Still there, unchanged: approved articles keep the very file that was reviewed.
  const left = await q("select count(*)::int as n from storage.objects where name = $1", [path]);
  assert.equal(left[0].n, 1);
  await q("drop policy test_storage_list on storage.objects");
});

// ---------------------------------------------------------------------------
// Security fixes (migration 20260930000001) and invitations (…0002)
// ---------------------------------------------------------------------------

/** Creates an auth user; `confirmed` = verified e-mail (Google always has it). */
async function signUp(uid, email, confirmed = true) {
  await q("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)", [
    uid,
    email,
    confirmed ? new Date().toISOString() : null,
  ]);
}

test("DB-01: a custom role without the permissions right can't bypass allowed e-mails", async () => {
  await q(`insert into roles (id, name) values ('account-helper', 'Account helper')`);
  await q(
    `insert into role_permissions (role_id, section, actions) values ('account-helper', 'users', 've')`,
  );
  const helper = "00000000-0000-4000-8000-00000000ad02";
  const target = "00000000-0000-4000-8000-0000000000a2";
  await signUp(helper, "helper@atlasoftodaysworld.org");
  await signUp(target, "target@example.org");
  await q("update profiles set role_id = 'account-helper', kind = 'staff' where id = $1", [helper]);
  await q("insert into allowed_emails (value) values ('@atlasoftodaysworld.org')");
  try {
    await as(helper, () =>
      refused(q("update profiles set kind = 'staff' where id = $1", [target]), /allowed e-mails/),
    );
  } finally {
    await q("delete from allowed_emails");
  }
});

test('DB-03: deleting needs the "d" right, not just "e"', async () => {
  await q(
    `insert into indicators (id, label, domain_min, domain_max) values ('gini', 'Gini', 20, 60)`,
  );
  await q(
    `insert into indicator_values (indicator_id, country_iso3, value) values ('gini', 'BRA', 52)`,
  );
  // data-editor has layers "vce" — can edit but not delete.
  await as(id.dataEditor, async () => {
    const gone = await q("delete from indicator_values where indicator_id = 'gini' returning 1");
    assert.equal(gone.length, 0);
  });
  assert.equal((await q("select 1 from indicator_values where indicator_id = 'gini'")).length, 1);
});

test("DB-04: publisher can't overwrite another author's bio", async () => {
  const author = await one(
    `insert into authors (name, profile_id, bio) values ('B', $1, 'Original') returning id`,
    [id.pubB],
  );
  await as(id.pubA, async () => {
    const changed = await q("update authors set bio = 'Hacked' where id = $1 returning 1", [
      author.id,
    ]);
    assert.equal(changed.length, 0);
  });
  await as(id.pubB, async () => {
    const changed = await q("update authors set bio = 'Mine' where id = $1 returning 1", [
      author.id,
    ]);
    assert.equal(changed.length, 1);
  });
});

test("DB-05: anonymous user can't see resources of an unpublished entry", async () => {
  const draft = await newEntry(id.pubA, "resource-draft");
  await q(
    `insert into resources (entry_id, kind, title, url) values ($1, 'Lectures & Debates', 'Secret', 'https://x.org')`,
    [draft],
  );
  await as(null, async () => {
    assert.equal((await q("select 1 from resources where title = 'Secret'")).length, 0);
  });
});

test("DB-06: image and cover URLs are https only", async () => {
  const entry = await newEntry(id.pubA, "cover-js");
  await as(id.pubA, () =>
    refused(
      q("update entries set cover_url = 'javascript:alert(1)' where id = $1", [entry]),
      /check constraint/,
    ),
  );
});

test("DB-08: anonymous user can't see the owner or the reviewer note", async () => {
  await as(null, async () => {
    await refused(q("select owner_id from entries limit 1"), /permission denied/);
    await refused(q("select review_note from entries limit 1"), /permission denied/);
    await refused(q("select profile_id from authors limit 1"), /permission denied/);
    const rows = await q("select slug, title from entries where status = 'published' limit 1");
    assert.ok(Array.isArray(rows));
  });
});

test("DB-09: only pending articles are approved and nobody but admin self-approves", async () => {
  const own = await one(
    `insert into entries (slug, title, category, owner_id) values ('editor-own', 'Own', 'Society', $1) returning id`,
    [id.editor],
  );
  await as(id.editor, async () => {
    await q("select submit_entry($1)", [own.id]);
    await refused(q("select approve_entry($1)", [own.id]), /outside what you may approve/);
  });
  // The author can't set "pending" by a direct write.
  const draft = await newEntry(id.pubA, "direct-pending");
  await as(id.pubA, () =>
    refused(q("update entries set status = 'pending' where id = $1", [draft]), /through submit/),
  );
});

test("DB-10: an imported indicator can't be switched to custom", async () => {
  await q(
    `insert into indicators (id, label, domain_min, domain_max) values ('pop', 'Population', 1, 2)`,
  );
  await as(id.dataEditor, () =>
    refused(
      q("update indicators set is_custom = true where id = 'pop'"),
      /fixed when it is created/,
    ),
  );
});

test("DB-13: permission helpers aren't for anonymous users and an empty action fails", async () => {
  await as(null, () => refused(q("select has_perm('news', 'v')"), /permission denied/));
  await as(id.admin, async () => {
    assert.equal((await one("select has_perm('news', '') as ok")).ok, false);
    assert.equal((await one("select has_perm('news', 'v') as ok")).ok, true);
  });
});

test("DB-14: audit log contains no e-mail or phone", async () => {
  await q("update profiles set role_id = 'observer' where id = $1", [id.newcomer]);
  await q("update profiles set role_id = 'reader' where id = $1", [id.newcomer]);
  const rows = await q(
    "select target, detail::text as detail from audit_log where action = 'profiles.update'",
  );
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.doesNotMatch(row.detail, /@|"email"|"phone"/);
    assert.doesNotMatch(row.target ?? "", /@/);
  }
});

test("DB-15: not even admin can delete a paid membership", async () => {
  await q(
    `insert into memberships (user_id, plan, complimentary, stripe_customer_id, stripe_subscription_id)
     values ($1, 'patron', false, 'cus_db15', 'sub_db15')
     on conflict (user_id) do update set plan = 'patron', complimentary = false,
       stripe_customer_id = 'cus_db15', stripe_subscription_id = 'sub_db15'`,
    [id.reader],
  );
  await as(id.admin, async () => {
    const gone = await q("delete from memberships where user_id = $1 returning 1", [id.reader]);
    assert.equal(gone.length, 0);
  });
});

test("invitation: permission-admin invites a publisher, not an admin or account manager", async () => {
  await as(id.permAdmin, async () => {
    await q(
      "insert into invitations (email, role_id) values ('new.publisher@example.org', 'publisher')",
    );
    await refused(
      q("insert into invitations (email, role_id) values ('boss@example.org', 'admin')"),
      /Only an admin can invite an admin/,
    );
    await refused(
      q(
        "insert into invitations (email, role_id) values ('perm2@example.org', 'permission-admin')",
      ),
      /manages accounts or permissions/,
    );
    await refused(
      q("insert into invitations (email, role_id) values ('reader2@example.org', 'reader')"),
      /Readers register on their own/,
    );
  });
  await as(id.pubA, () =>
    refused(
      q("insert into invitations (email, role_id) values ('x@example.org', 'publisher')"),
      /row-level security/,
    ),
  );
});

test("invitation: accepted only by the invited, verified e-mail", async () => {
  await as(id.admin, () =>
    q(
      `insert into invitations (email, role_id, approver_countries) values ('invited@example.org', 'content-approver', '{BRA}')`,
    ),
  );

  // A different e-mail doesn't take over the invitation.
  const stranger = "00000000-0000-4000-8000-0000000000b1";
  await signUp(stranger, "stranger@example.org");
  assert.equal(
    (await one("select role_id from profiles where id = $1", [stranger])).role_id,
    "reader",
  );

  // An unverified e-mail (code sign-up, not yet confirmed) gets no role…
  const invited = "00000000-0000-4000-8000-0000000000b2";
  await signUp(invited, "Invited@Example.org", false);
  let profile = await one("select role_id, kind from profiles where id = $1", [invited]);
  assert.deepEqual(profile, { role_id: "reader", kind: "reader" });
  await as(invited, async () => {
    assert.equal((await one("select claim_invitation() as role")).role, null);
  });

  // …until it is verified.
  await q("update auth.users set email_confirmed_at = now() where id = $1", [invited]);
  profile = await one("select role_id, kind from profiles where id = $1", [invited]);
  assert.deepEqual(profile, { role_id: "content-approver", kind: "staff" });
  assert.equal(
    (await one("select count(*)::int as n from approver_countries where user_id = $1", [invited]))
      .n,
    1,
  );
  const invite = await one(
    "select accepted_by from invitations where email = 'invited@example.org'",
  );
  assert.equal(invite.accepted_by, invited);
});

test("invitation: expired or revoked isn't accepted, accepted can't be changed", async () => {
  await q(
    `insert into invitations (email, role_id, created_at, expires_at)
     values ('late@example.org', 'publisher', now() - interval '10 days', now() - interval '5 days')`,
  );
  const late = "00000000-0000-4000-8000-0000000000c1";
  await signUp(late, "late@example.org");
  assert.equal((await one("select role_id from profiles where id = $1", [late])).role_id, "reader");

  await as(id.admin, async () => {
    await q("insert into invitations (email, role_id) values ('revoked@example.org', 'publisher')");
    await q("update invitations set revoked_at = now() where email = 'revoked@example.org'");
  });
  const revoked = "00000000-0000-4000-8000-0000000000c2";
  await signUp(revoked, "revoked@example.org");
  assert.equal(
    (await one("select role_id from profiles where id = $1", [revoked])).role_id,
    "reader",
  );

  await as(id.admin, () =>
    refused(
      q("update invitations set role_id = 'admin' where email = 'invited@example.org'"),
      /cannot be changed/,
    ),
  );
});

test("invitation: an existing reader accepts it on next sign-in", async () => {
  // The reader verified their e-mail long ago; the invitation comes later.
  await q("update auth.users set email_confirmed_at = now() where id = $1", [id.reader]);
  await as(id.admin, () =>
    q("insert into invitations (email, role_id) values ('reader@example.org', 'observer')"),
  );
  await as(id.reader, async () => {
    assert.equal((await one("select claim_invitation() as role")).role, "observer");
  });
  assert.equal((await one("select kind from profiles where id = $1", [id.reader])).kind, "staff");
});

test("search finds published items, not drafts", async () => {
  await newEntry(id.pubA, "brazil-secret-draft");
  await as(null, async () => {
    const hits = await q("select id, kind from search('brazil', 10)");
    assert.ok(hits.some((hit) => hit.id === "country:BRA"));
    assert.ok(!hits.some((hit) => hit.id === "news:brazil-secret-draft"));
    assert.equal((await q("select * from search('', 10)")).length, 0);
    assert.equal(
      (await q("select * from search('a''); drop table entries; --', 10)")).length >= 0,
      true,
    );
  });
});

test("rate limit: allows only the set count per window and clients can't reach it", async () => {
  const results = [];
  for (let i = 0; i < 4; i += 1) {
    results.push((await one("select hit_rate_limit('test:1', 3, 600) as ok")).ok);
  }
  assert.deepEqual(results, [true, true, true, false]);
  await as(id.admin, () =>
    refused(q("select hit_rate_limit('test:2', 3, 600)"), /permission denied/),
  );
});

test("portrait: only permitted editors replace a collection, in one transaction", async () => {
  const items = JSON.stringify([
    { date_label: "1990", title: "Start", body: "B" },
    { date_label: "2000", title: "Next", body: "C" },
  ]);
  const call = "select replace_portrait_items('region', 'east-asia', 'timeline', $1::jsonb)";

  // A publisher writes only their own articles — portrait content isn't theirs.
  await as(id.pubA, () => refused(q(call, [items])));
  // An anonymous user can't run the function at all.
  await as(null, () => refused(q(call, [items])));

  await as(id.editor, () => q(call, [items]));
  const rows = await q(
    "select position, title from timeline_events where region_slug = 'east-asia' order by position",
  );
  assert.deepEqual(
    rows.map((r) => r.title),
    ["Start", "Next"],
  );

  // An invalid item (source without https) rolls back the whole call — old content stays.
  await as(id.editor, () =>
    refused(
      q("select replace_portrait_items('region', 'east-asia', 'resources', $1::jsonb)", [
        JSON.stringify([
          { kind: "Videos & Documentaries", title: "x", url: "https://ok.example" },
          { kind: "Videos & Documentaries", title: "y", url: "http://bad.example" },
        ]),
      ]),
    ),
  );
  assert.equal(
    (await one("select count(*)::int n from resources where region_slug = 'east-asia'")).n,
    0,
  );

  // Manual metric cards belong to the regions section — data-editor yes, publisher no.
  const metrics = JSON.stringify([{ value: "5", label: "Castles", source: "Atlas" }]);
  await as(id.dataEditor, () =>
    q("select replace_portrait_items('country', 'JPN', 'metrics', $1::jsonb)", [metrics]),
  );
  await as(id.pubA, () =>
    refused(q("select replace_portrait_items('country', 'JPN', 'metrics', $1::jsonb)", [metrics])),
  );
  assert.equal(
    (await one("select count(*)::int n from portrait_metrics where country_iso3 = 'JPN'")).n,
    1,
  );
});

test("visuals: a Datawrapper chart only as its exact chart URL; portrait() says which is which", async () => {
  const call = "select replace_portrait_items('region', 'east-asia', 'visuals', $1::jsonb)";
  const chart = "https://datawrapper.dwcdn.net/aB3dE/2/";
  await as(id.editor, () =>
    q(call, [
      JSON.stringify([
        { provider: "datawrapper", title: "Refugees", url: chart },
        { provider: "image", title: "Map", url: "https://example.org/map.png" },
      ]),
    ]),
  );

  // Whatever the app sends, the database stores no other host and no pasted HTML.
  for (const url of [
    "https://datawrapper.dwcdn.net.evil.com/aB3dE/2/",
    "https://evil.example/aB3dE/2/",
    "https://datawrapper.dwcdn.net/aB3dE/2/?x=1",
    `https://datawrapper.dwcdn.net/aB3dE/2/"><script>alert(1)</script>`,
    `<iframe src="${chart}"></iframe>`,
  ]) {
    await as(id.editor, () =>
      refused(
        q(call, [JSON.stringify([{ provider: "datawrapper", title: "x", url }])]),
        /visual_embeds_datawrapper_url|visual_embeds_url_check/,
      ),
    );
  }
  await as(id.editor, () =>
    refused(
      q(call, [JSON.stringify([{ provider: "youtube", title: "x", url: chart }])]),
      /visual_embeds_provider_check/,
    ),
  );

  const portrait = await as(null, () => one("select portrait('region', 'east-asia') p"));
  assert.deepEqual(
    portrait.p.visuals.map((v) => [v.provider, v.image]),
    [
      ["datawrapper", chart],
      ["image", "https://example.org/map.png"],
    ],
  );
});

test("role change: permission admin can't promote to account management, admin can", async () => {
  await as(id.permAdmin, () =>
    refused(
      q("update profiles set role_id = 'permission-admin' where id = $1", [id.pubB]),
      /Only an admin can give a role that manages/,
    ),
  );
  // A permission admin may grant an ordinary editorial role.
  await as(id.permAdmin, () =>
    q("update profiles set role_id = 'content-editor' where id = $1", [id.pubB]),
  );
  await as(id.admin, () =>
    q("update profiles set role_id = 'permission-admin' where id = $1", [id.pubB]),
  );
  assert.equal(
    (await one("select role_id from profiles where id = $1", [id.pubB])).role_id,
    "permission-admin",
  );
  // Restore, so later tests get the original role.
  await q("update profiles set role_id = 'publisher' where id = $1", [id.pubB]);
});

test("permission matrix: only admin grants account and permission management", async () => {
  await as(id.permAdmin, () =>
    refused(
      q(
        "insert into role_permissions (role_id, section, actions) values ('publisher', 'users', 'v')",
      ),
      /Only an admin can let a role manage/,
    ),
  );
  // A permission admin may set content sections.
  await as(id.permAdmin, () =>
    q(
      "update role_permissions set actions = 'v' where role_id = 'publisher' and section = 'layers'",
    ),
  );
  await as(id.admin, () =>
    q("insert into role_permissions (role_id, section, actions) values ('observer', 'users', 'v')"),
  );
  await q("delete from role_permissions where role_id = 'observer' and section = 'users'");
});

test("2FA: admin without a second factor can do nothing, publisher doesn't need it", async () => {
  // Without TOTP (aal1) the admin is like roleless to the DB.
  const aal1 = await as(
    id.admin,
    () =>
      one(
        "select is_admin() a, has_perm('users', 'v') u, (select count(*)::int from my_permissions()) n",
      ),
    { aal: "aal1" },
  );
  assert.deepEqual(aal1, { a: false, u: false, n: 0 });
  // A write under RLS without permission changes nothing (0 rows).
  const changed = await as(
    id.admin,
    () => q("update security_settings set session_hours = 5 where id = 1 returning id"),
    { aal: "aal1" },
  );
  assert.equal(changed.length, 0);
  const status = await as(id.admin, () => one("select mfa_status() s"), { aal: "aal1" });
  assert.deepEqual(status.s, { required: true, aal: "aal1" });

  // With TOTP (aal2), full rights.
  const aal2 = await as(id.admin, () => one("select is_admin() a, has_perm('users', 'v') u"));
  assert.deepEqual(aal2, { a: true, u: true });

  // Roles outside require_2fa_roles don't need a second factor.
  const pub = await as(id.pubA, () => one("select has_perm('news', 'c') c"), { aal: "aal1" });
  assert.equal(pub.c, true);
});

test("feature flags: everyone reads them, only permission management changes them", async () => {
  const flags = await as(null, () => q("select key, enabled from feature_flags order by key"));
  assert.deepEqual(
    flags.map((f) => f.key),
    ["email_auth", "maintenance", "news_menu", "news_menu_auto", "newsletter"],
  );
  // E-mail sign-in and invitations (G1) are off until we have our own SMTP (U5).
  assert.equal(flags.find((f) => f.key === "email_auth").enabled, false);
  await as(null, () =>
    refused(q("update feature_flags set enabled = true where key = 'maintenance'")),
  );
  const byPublisher = await as(id.pubA, () =>
    q("update feature_flags set enabled = true where key = 'maintenance' returning key"),
  );
  assert.equal(byPublisher.length, 0);
  await as(id.admin, () => q("update feature_flags set enabled = true where key = 'maintenance'"));
  const flag = await one("select enabled, updated_by from feature_flags where key = 'maintenance'");
  assert.deepEqual(flag, { enabled: true, updated_by: id.admin });
  await q("update feature_flags set enabled = false where key = 'maintenance'");

  // News in the menu: off by hand, back on with the next published news article.
  await q("update feature_flags set enabled = false where key = 'news_menu'");
  const news = await newEntry(id.pubA, "news-menu-on");
  assert.equal(
    (await one("select enabled from feature_flags where key = 'news_menu'")).enabled,
    false,
  );
  await q("update entries set status = 'published' where id = $1", [news]);
  assert.equal(
    (await one("select enabled from feature_flags where key = 'news_menu'")).enabled,
    true,
  );
  // Without the automatic switch it stays as set.
  await q("update feature_flags set enabled = false where key in ('news_menu', 'news_menu_auto')");
  const quiet = await newEntry(id.pubA, "news-menu-quiet");
  await q("update entries set status = 'published' where id = $1", [quiet]);
  assert.equal(
    (await one("select enabled from feature_flags where key = 'news_menu'")).enabled,
    false,
  );
  await q("update feature_flags set enabled = true where key = 'news_menu_auto'");
});

test("scheduled publishing: only an approver schedules, cron publishes", async () => {
  const entry = await newEntry(id.pubA, "scheduled-ok", ["BRA"], "pending");
  const tomorrow = "now() + interval '1 day'";

  await as(null, () => refused(q(`select schedule_entry($1, ${tomorrow})`, [entry])));
  await as(id.pubA, () =>
    refused(q(`select schedule_entry($1, ${tomorrow})`, [entry]), /outside what you may approve/),
  );
  await as(id.dataEditor, () =>
    refused(q(`select schedule_entry($1, ${tomorrow})`, [entry]), /outside/),
  );
  await as(id.approverLatam, () =>
    refused(q("select schedule_entry($1, now() + interval '1 minute')", [entry]), /5 minutes/),
  );
  await as(id.approverLatam, () => q(`select schedule_entry($1, ${tomorrow})`, [entry]));
  const planned = await one("select status, publish_at, scheduled_by from entries where id = $1", [
    entry,
  ]);
  assert.equal(planned.status, "pending");
  assert.ok(planned.publish_at > new Date());
  assert.equal(planned.scheduled_by, id.approverLatam);

  // A schedule can't be forged by a direct write or triggered from the app.
  await as(id.pubA, () =>
    refused(q("update entries set publish_at = now() where id = $1", [entry]), /schedule_entry/),
  );
  await as(id.editor, () =>
    refused(
      q("update entries set scheduled_by = $2 where id = $1", [entry, id.editor]),
      /schedule_entry/,
    ),
  );
  await as(id.approverLatam, () => refused(q("select publish_due_entries()"), /permission denied/));

  // Not due yet → nothing.
  assert.equal((await one("select publish_due_entries() n")).n, 0);
  // Now due (like cron: no session).
  await q("update entries set publish_at = now() - interval '1 minute' where id = $1", [entry]);
  assert.equal((await one("select publish_due_entries() n")).n, 1);
  const live = await one(
    "select status, approved_by, publish_at, scheduled_by from entries where id = $1",
    [entry],
  );
  assert.deepEqual(live, {
    status: "published",
    approved_by: id.approverLatam,
    publish_at: null,
    scheduled_by: null,
  });
  const seen = await as(null, () => q("select slug from entries where slug = 'scheduled-ok'"));
  assert.equal(seen.length, 1);
});

test("scheduled publishing: schedule lapses after an edit, send-back or lost rights", async () => {
  const schedule = (entry) =>
    as(id.approverLatam, () => q("select schedule_entry($1, now() + interval '1 day')", [entry]));
  const planOf = (entry) =>
    one("select status, publish_at, scheduled_by from entries where id = $1", [entry]);

  // Author edits text after scheduling → approved version is void, schedule gone.
  const edited = await newEntry(id.pubA, "scheduled-edited", ["BRA"], "pending");
  await schedule(edited);
  await as(id.pubA, () => q("update entries set body_html = '<p>new</p>' where id = $1", [edited]));
  assert.equal((await planOf(edited)).publish_at, null);

  // Sending back to the author cancels the schedule.
  const sentBack = await newEntry(id.pubA, "scheduled-sent-back", ["BRA"], "pending");
  await schedule(sentBack);
  await as(id.approverLatam, () => q("select send_back_entry($1, 'Not yet.')", [sentBack]));
  assert.equal((await planOf(sentBack)).publish_at, null);

  // Only an approver may cancel the schedule.
  const cancelled = await newEntry(id.pubA, "scheduled-cancelled", ["BRA"], "pending");
  await schedule(cancelled);
  await as(id.pubA, () => refused(q("select unschedule_entry($1)", [cancelled]), /outside/));
  await as(id.approverLatam, () => q("select unschedule_entry($1)", [cancelled]));
  assert.deepEqual(await planOf(cancelled), {
    status: "pending",
    publish_at: null,
    scheduled_by: null,
  });

  // The scheduler was blocked meanwhile → not published when due, schedule lapses.
  const orphan = await newEntry(id.pubA, "scheduled-orphan", ["BRA"], "pending");
  await schedule(orphan);
  await q("update entries set publish_at = now() - interval '1 minute' where id = $1", [orphan]);
  await q("update profiles set status = 'blocked' where id = $1", [id.approverLatam]);
  try {
    assert.equal((await one("select publish_due_entries() n")).n, 0);
  } finally {
    await q("update profiles set status = 'active' where id = $1", [id.approverLatam]);
  }
  assert.deepEqual(await planOf(orphan), {
    status: "pending",
    publish_at: null,
    scheduled_by: null,
  });
  const dropped = await one(
    "select count(*)::int n from audit_log where action = 'entries.schedule_dropped' and target = 'scheduled-orphan'",
  );
  assert.equal(dropped.n, 1);
});

test('redirects: everyone reads, editors with "c" add, only "d" deletes', async () => {
  await as(id.pubA, () =>
    q("insert into redirects (from_path, to_path) values ('/news/old-slug', '/news/new-slug')"),
  );
  const row = await one(
    "select created_by, permanent from redirects where from_path = '/news/old-slug'",
  );
  assert.deepEqual(row, { created_by: id.pubA, permanent: true });

  // An anonymous user sees only public columns and writes nothing.
  const pub = await as(null, () => q("select from_path, to_path, permanent from redirects"));
  assert.equal(pub.length, 1);
  await as(null, () => refused(q("select created_by from redirects"), /permission denied/));
  await as(null, () =>
    refused(q("insert into redirects (from_path, to_path) values ('/x', '/y')"), /permission/),
  );

  // An approver (news only "v") can't add; a publisher (no "d") can't delete.
  await as(id.approverLatam, () =>
    refused(q("insert into redirects (from_path, to_path) values ('/x', '/y')"), /row-level/),
  );
  const notDeleted = await as(id.pubA, () =>
    q("delete from redirects where from_path = '/news/old-slug' returning id"),
  );
  assert.equal(notDeleted.length, 0);
  // The author can't be forged.
  await as(id.editor, () =>
    refused(
      q("insert into redirects (from_path, to_path, created_by) values ('/x', '/y', $1)", [
        id.pubA,
      ]),
      /permission denied/,
    ),
  );
  const deleted = await as(id.editor, () =>
    q("delete from redirects where from_path = '/news/old-slug' returning id"),
  );
  assert.equal(deleted.length, 1);
});

test("redirects: only paths on our own site and no loops", async () => {
  await as(id.editor, async () => {
    for (const [from, to] of [
      ["/old", "https://evil.example"],
      ["/old", "//evil.example"],
      ["/old", "javascript:alert(1)"],
      ["/", "/news"],
      ["/old/", "/news"],
      ["/same", "/same"],
    ]) {
      await refused(
        q("insert into redirects (from_path, to_path) values ($1, $2)", [from, to]),
        /check constraint|loop back/,
      );
    }
    await q("insert into redirects (from_path, to_path) values ('/loop-a', '/loop-b')");
    await q("insert into redirects (from_path, to_path) values ('/loop-b', '/loop-c?x=1')");
    await refused(
      q("insert into redirects (from_path, to_path) values ('/loop-c', '/loop-a')"),
      /loop/,
    );
    await q("delete from redirects where from_path like '/loop-%'");
  });
});

test("preview: only the article's editors create a link, anyone with the token opens it until expiry", async () => {
  const entry = await newEntry(id.pubA, "preview-draft", ["BRA"]);
  // No rights to the article: reader, anonymous, another publisher.
  await as(id.reader, () => refused(q("select create_preview_link($1, 24)", [entry]), /sdílet/));
  await as(null, () => refused(q("select create_preview_link($1, 24)", [entry])));
  await as(id.pubB, () => refused(q("select create_preview_link($1, 24)", [entry]), /sdílet/));
  await as(id.pubA, () => refused(q("select create_preview_link($1, 0)", [entry]), /1 až 720/));

  const { token } = await as(id.pubA, () =>
    one("select create_preview_link($1, 24) as token", [entry]),
  );
  assert.match(token, /^[0-9a-f]{64}$/);
  const stored = await one("select token_hash from preview_links where entry_id = $1", [entry]);
  assert.notEqual(stored.token_hash, token); // only the hash in the DB

  const preview = await as(null, () =>
    one("select slug, status, countries from entry_preview($1)", [token]),
  );
  assert.deepEqual(preview, { slug: "preview-draft", status: "draft", countries: ["BRA"] });
  assert.equal(
    (await as(null, () => q("select 1 from entry_preview($1)", ["0".repeat(64)]))).length,
    0,
  );
  assert.equal((await as(null, () => q("select 1 from entry_preview('nesmysl')"))).length, 0);

  // No direct writes; anonymous can't see the table; the region's approver may create one.
  await as(id.pubA, () =>
    refused(
      q(
        "insert into preview_links (entry_id, token_hash, expires_at) values ($1, $2, now() + interval '1 hour')",
        [entry, "a".repeat(64)],
      ),
    ),
  );
  await as(null, () => refused(q("select id from preview_links")));
  await as(id.approverLatam, () => one("select create_preview_link($1, 1)", [entry]));

  // An expired link no longer returns the article; the link's creator may delete it.
  await q(
    "update preview_links set created_at = now() - interval '2 days', expires_at = now() - interval '1 second' where entry_id = $1",
    [entry],
  );
  assert.equal((await as(null, () => q("select 1 from entry_preview($1)", [token]))).length, 0);
  const removed = await as(id.pubA, () =>
    q("delete from preview_links where entry_id = $1 returning id", [entry]),
  );
  assert.ok(removed.length >= 1);
});

test("entry: only the entry's editors save chapters and resources, in one transaction", async () => {
  const entry = await newEntry(id.pubA, "encyclopedia-draft", ["BRA"]);
  const chapters = JSON.stringify([
    { title: "Roots", summary_points: ["One", "Two", "Three"], body_html: "<p>A</p>" },
    {
      title: "Today",
      summary_points: ["Four"],
      body_html: "<p>B</p>",
      illustration_url: "https://img.example/b.webp",
      illustration_credit: "Photo: X",
    },
  ]);
  const call = "select replace_entry_parts($1, 'chapters', $2::jsonb)";

  // Another publisher, a reader or anonymous can't change chapters — not even with an empty list.
  await as(id.pubB, () => refused(q(call, [entry, "[]"]), /may not edit/));
  await as(id.reader, () => refused(q(call, [entry, chapters])));
  await as(null, () => refused(q(call, [entry, chapters])));

  await as(id.pubA, () => q(call, [entry, chapters]));
  const rows = await q(
    "select position, title, summary_points from entry_chapters where entry_id = $1 order by position",
    [entry],
  );
  assert.deepEqual(rows, [
    { position: 0, title: "Roots", summary_points: ["One", "Two", "Three"] },
    { position: 1, title: "Today", summary_points: ["Four"] },
  ]);

  // Six bullets or a non-https illustration roll back the whole call — chapters stay.
  await as(id.pubA, () =>
    refused(
      q(call, [
        entry,
        JSON.stringify([{ title: "Too many", summary_points: ["1", "2", "3", "4", "5", "6"] }]),
      ]),
    ),
  );
  await as(id.pubA, () =>
    refused(q(call, [entry, JSON.stringify([{ title: "X", illustration_url: "http://bad" }])])),
  );
  await as(id.pubA, () =>
    refused(q(call, [entry, JSON.stringify(Array.from({ length: 13 }, () => ({ title: "C" })))])),
  );
  assert.equal(
    (await one("select count(*)::int n from entry_chapters where entry_id = $1", [entry])).n,
    2,
  );

  // Entry resources: same rules, an unknown part fails.
  const resources = JSON.stringify([
    { kind: "Lectures & Debates", title: "Talk", url: "https://talk.example" },
  ]);
  await as(id.pubA, () =>
    q("select replace_entry_parts($1, 'resources', $2::jsonb)", [entry, resources]),
  );
  await as(id.pubA, () =>
    refused(q("select replace_entry_parts($1, 'timeline', '[]'::jsonb)", [entry]), /Unknown/),
  );

  // An anonymous user sees neither chapters nor resources of a draft.
  await as(null, async () => {
    assert.equal((await q("select 1 from entry_chapters where entry_id = $1", [entry])).length, 0);
    assert.equal((await q("select 1 from resources where entry_id = $1", [entry])).length, 0);
  });
});

test("entry: summary bullets and chapter audio within limits, anonymous may list columns", async () => {
  const entry = await newEntry(id.pubA, "encyclopedia-header");
  await as(id.pubA, () =>
    q("update entries set kind = 'entry', summary_points = $2 where id = $1", [
      entry,
      ["A", "B", "C"],
    ]),
  );
  await as(id.pubA, () =>
    refused(q("update entries set summary_points = $2 where id = $1", [entry, ["x".repeat(301)]])),
  );

  // Audio belongs to a chapter: https passes, http rolls back the whole save.
  const call = "select replace_entry_parts($1, 'chapters', $2::jsonb)";
  await as(id.pubA, () =>
    q(call, [entry, JSON.stringify([{ title: "One", audio_url: "https://cdn.example/1.mp3" }])]),
  );
  await as(id.pubA, () =>
    refused(
      q(call, [entry, JSON.stringify([{ title: "One", audio_url: "http://cdn.example/1.mp3" }])]),
    ),
  );
  assert.equal(
    (await one("select audio_url from entry_chapters where entry_id = $1", [entry])).audio_url,
    "https://cdn.example/1.mp3",
  );

  // Column grants: anonymous may name the new columns (but can't see the draft).
  await as(null, () => q("select summary_points from entries where false"));
  await as(null, () => q("select audio_url from entry_chapters where false"));
});

test("entry: everyone sees planned entries, but only title and classification", async () => {
  const entry = await newEntry(id.pubA, "planned-entry", ["BRA"], "planned");
  await q("update entries set kind = 'entry', body_html = '<p>secret</p>' where id = $1", [entry]);
  await newEntry(id.pubA, "planned-news", [], "planned"); // news items don't count

  const rows = await as(null, () => q("select * from planned_entries()"));
  const mine = rows.filter((row) => row.title === "planned-entry");
  assert.equal(mine.length, 1);
  assert.deepEqual(Object.keys(mine[0]).sort(), [
    "category",
    "countries",
    "region_slug",
    "special_slug",
    "title",
  ]);
  assert.deepEqual(mine[0].countries, ["BRA"]);
  assert.equal(rows.filter((row) => row.title === "planned-news").length, 0);
  // Anonymous still can't see the row itself.
  await as(null, async () =>
    assert.equal((await q("select 1 from entries where id = $1", [entry])).length, 0),
  );
});

test("entry: audio is uploaded only by writers, only into their own folder", async () => {
  const bucket = await one(
    "select allowed_mime_types from storage.buckets where id = 'entry-audio'",
  );
  for (const mime of ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/flac"]) {
    assert.ok(bucket.allowed_mime_types.includes(mime), mime);
  }
  await as(id.pubA, () =>
    q("insert into storage.objects (bucket_id, name) values ('entry-audio', $1)", [
      `${id.pubA}/a.mp3`,
    ]),
  );
  await as(id.pubA, () =>
    refused(
      q("insert into storage.objects (bucket_id, name) values ('entry-audio', $1)", [
        `${id.pubB}/a.mp3`,
      ]),
    ),
  );
  await as(id.reader, () =>
    refused(
      q("insert into storage.objects (bucket_id, name) values ('entry-audio', $1)", [
        `${id.reader}/a.mp3`,
      ]),
    ),
  );
});

test("entry: preview via link also returns chapters, author and resources", async () => {
  const entry = await newEntry(id.pubA, "preview-encyclopedia");
  const author = await one(
    "insert into authors (name, positionality) values ('Ana', 'I grew up there.') returning id",
  );
  await q("update entries set kind = 'entry', author_id = $2, summary_points = $3 where id = $1", [
    entry,
    author.id,
    ["Point"],
  ]);
  await as(id.pubA, () =>
    q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [
      entry,
      JSON.stringify([{ title: "One", body_html: "<p>x</p>" }]),
    ]),
  );
  const { token } = await as(id.pubA, () =>
    one("select create_preview_link($1, 24) as token", [entry]),
  );
  const parts = await as(null, () => one("select * from entry_preview_parts($1)", [token]));
  assert.equal(parts.kind, "entry");
  assert.deepEqual(parts.summary_points, ["Point"]);
  assert.equal(parts.author.positionality, "I grew up there.");
  assert.equal(parts.chapters[0].title, "One");
  assert.deepEqual(parts.resources, []);
  assert.equal(
    (await as(null, () => q("select 1 from entry_preview_parts($1)", ["0".repeat(64)]))).length,
    0,
  );
});

test("translations: everyone reads them, only the unit's section writes", async () => {
  // blurb: not in the migration with Czech country names, the test creates it.
  const row = ["country", "BRA", "blurb", "cs", "Brazílie"];
  const insert =
    "insert into translations (entity, entity_key, field, locale, value) values ($1, $2, $3, $4, $5)";
  await as(null, () => refused(q(insert, row)));
  await as(id.reader, () => refused(q(insert, row)));
  // publisher lacks the regions section; data-editor has indicators (layers), not countries
  await as(id.pubA, () => refused(q(insert, row)));
  await as(id.admin, () => q(insert, row));
  await as(id.admin, () =>
    refused(q(insert, ["country", "BRA", "name", "en", "Brazil"]), /check constraint/),
  );
  await as(id.admin, () =>
    refused(q(insert, ["planet", "X", "name", "cs", "X"]), /check constraint/),
  );

  const seen = await as(null, () =>
    q(
      "select value from translations where entity = 'country' and entity_key = 'BRA' and field = 'blurb'",
    ),
  );
  assert.deepEqual(seen, [{ value: "Brazílie" }]);
  await as(null, () => refused(q("select updated_by from translations")));

  const byPublisher = await as(id.pubA, () =>
    q(
      "update translations set value = 'X' where entity_key = 'BRA' and field = 'blurb' returning value",
    ),
  );
  assert.equal(byPublisher.length, 0);
  await as(id.admin, () =>
    q("delete from translations where entity_key = 'BRA' and field = 'blurb'"),
  );
});

test("entry translation: a writer creates it as their own draft with copied content", async () => {
  const original = await newEntry(id.pubB, "translated-original", ["BRA"]);
  await q("update entries set kind = 'entry', summary_points = $2 where id = $1", [
    original,
    ["Point"],
  ]);
  await q(
    "insert into entry_chapters (entry_id, position, title, body_html, audio_url) values ($1, 0, 'One', '<p>x</p>', 'https://cdn.example/1.mp3')",
    [original],
  );
  await q("update entries set status = 'published' where id = $1", [original]);

  // A reader doesn't write, anonymous can't run the function.
  await as(id.reader, () => refused(q("select create_entry_translation($1, 'cs')", [original])));
  await as(null, () => refused(q("select create_entry_translation($1, 'cs')", [original])));

  const { id: translation } = await as(id.pubA, () =>
    one("select create_entry_translation($1, 'cs') as id", [original]),
  );
  const row = await one(
    "select slug, kind, locale, status, owner_id, translation_of, summary_points from entries where id = $1",
    [translation],
  );
  assert.deepEqual(row, {
    slug: "translated-original",
    kind: "entry",
    locale: "cs",
    status: "draft",
    owner_id: id.pubA,
    translation_of: original,
    summary_points: ["Point"],
  });
  const chapter = await one("select title, audio_url from entry_chapters where entry_id = $1", [
    translation,
  ]);
  assert.deepEqual(chapter, { title: "One", audio_url: null }); // audio is in the original's language
  assert.deepEqual(
    (await q("select country_iso3 from entry_countries where entry_id = $1", [translation])).map(
      (r) => r.country_iso3,
    ),
    ["BRA"],
  );

  // No second Czech translation of the same original; no translation of a translation.
  await as(id.pubA, () =>
    refused(q("select create_entry_translation($1, 'cs')", [original]), /duplicate|unique/i),
  );
  await as(id.pubA, () =>
    refused(q("select create_entry_translation($1, 'de')", [translation]), /original/i),
  );
});

test("entry translation: slug and kind match the original, original is fixed, slug propagates", async () => {
  const original = await newEntry(id.pubA, "slug-original");
  const other = await newEntry(id.pubA, "slug-other");
  const { id: translation } = await as(id.pubA, () =>
    one("select create_entry_translation($1, 'cs') as id", [original]),
  );

  await refused(
    q(
      `insert into entries (slug, locale, title, category, status, translation_of)
       values ('different-slug', 'de', 'X', 'Society', 'draft', $1)`,
      [original],
    ),
    /slug and kind/,
  );
  await refused(
    q(
      `insert into entries (slug, locale, title, category, status, translation_of)
       values ('slug-original', 'en', 'X', 'Society', 'draft', $1)`,
      [original],
    ),
  );
  await as(id.pubA, () =>
    refused(q("update entries set translation_of = $2 where id = $1", [translation, other])),
  );
  await as(id.pubA, () =>
    refused(q("update entries set slug = 'own-slug' where id = $1", [translation])),
  );

  // Renaming the original's draft takes the translation along.
  await as(id.pubA, () => q("update entries set slug = 'slug-renamed' where id = $1", [original]));
  assert.equal(
    (await one("select slug from entries where id = $1", [translation])).slug,
    "slug-renamed",
  );
  // The same slug in another language is fine, in the same one it isn't.
  await refused(newEntry(id.pubA, "slug-renamed"), /duplicate|unique/i);
});

test("entry translation: search returns only the original, entry links to /entry", async () => {
  const original = await newEntry(id.pubA, "searchable-hydrology", [], "draft");
  await q(
    "update entries set kind = 'entry', title = 'Hydrology of the Andes', status = 'published' where id = $1",
    [original],
  );
  const { id: translation } = await as(id.pubA, () =>
    one("select create_entry_translation($1, 'cs') as id", [original]),
  );
  await q("update entries set title = 'Hydrologie And', status = 'published' where id = $1", [
    translation,
  ]);

  const hits = await as(null, () =>
    q("select url from search('hydrology hydrologie', 20) where kind = 'news'"),
  );
  assert.deepEqual(
    hits.map((hit) => hit.url),
    ["/entry/searchable-hydrology"],
  );
  // Anonymous may name translation_of (column grants).
  await as(null, () => q("select translation_of from entries where false"));
});

test("custom region: country group with a kind and metrics under the specials permission", async () => {
  await q(`insert into roles (id, name) values ('groups-editor', 'Groups editor')`);
  await q(
    `insert into role_permissions (role_id, section, actions) values ('groups-editor', 'specials', 'vce')`,
  );
  const editor = "00000000-0000-4000-8000-0000000003c1";
  await signUp(editor, "groups@atlasoftodaysworld.org");
  await q("update profiles set role_id = 'groups-editor', kind = 'staff' where id = $1", [editor]);

  // A custom region of countries: same table as global issues, kind 'region'.
  await as(editor, () =>
    q(`insert into special_regions (slug, name, fill, stroke, center_lon, center_lat, kind)
       values ('visegrad', 'Visegrád Group', '#336699', '#224466', 17, 49, 'region')`),
  );
  await as(editor, () =>
    q(`insert into special_region_countries (special_slug, country_iso3)
       values ('visegrad', 'BRA'), ('visegrad', 'JPN')`),
  );
  await refused(
    q(`insert into special_regions (slug, name, fill, stroke, center_lon, center_lat, kind)
       values ('bad-kind', 'X', '#336699', '#224466', 0, 0, 'continent')`),
  );
  // Without a kind (existing groups and the old form) a group is a global issue.
  await as(editor, () =>
    q(`insert into special_regions (slug, name, fill, stroke, center_lon, center_lat)
       values ('default-kind', 'Default', '#336699', '#224466', 0, 0)`),
  );
  assert.equal(
    (await one("select kind from special_regions where slug = 'default-kind'")).kind,
    "issue",
  );

  // Group metrics: the specials permission suffices; not for Atlas regions or countries.
  const metrics = JSON.stringify([{ value: "64M", label: "People", source: "Eurostat" }]);
  await as(editor, () =>
    q("select replace_portrait_items('issue', 'visegrad', 'metrics', $1::jsonb)", [metrics]),
  );
  await as(editor, () =>
    q("select replace_portrait_items('issue', 'visegrad', 'metrics', $1::jsonb)", [metrics]),
  );
  assert.equal(
    (await one("select count(*)::int n from portrait_metrics where special_slug = 'visegrad'")).n,
    1, // replacing the section doesn't duplicate cards
  );
  await as(editor, () =>
    refused(
      q("select replace_portrait_items('region', 'east-asia', 'metrics', $1::jsonb)", [metrics]),
    ),
  );
  await as(editor, () =>
    refused(q("select replace_portrait_items('country', 'JPN', 'metrics', $1::jsonb)", [metrics])),
  );
  // A publisher (no specials "e") can't change group metrics.
  await as(id.pubA, () =>
    refused(
      q("select replace_portrait_items('issue', 'visegrad', 'metrics', $1::jsonb)", [metrics]),
    ),
  );
});

test("dossier: learn-more tiles, tile notes, FAQ and SEO follow the dossier's rights", async () => {
  const entry = await newEntry(id.pubA, "dossier-tiles");
  const other = await newEntry(id.pubB, "dossier-other");
  const call = "select replace_entry_parts($1, $2, $3::jsonb)";

  // A topic owns its tiles: turning the article into a topic copies the
  // default template ("Standard" = the five original resource kinds).
  await q("update entries set kind = 'entry' where id = any($1)", [[entry, other]]);
  const own = await q(
    "select id, slug from learn_more_tiles where entry_id = $1 order by position",
    [entry],
  );
  assert.deepEqual(
    own.map((tile) => tile.slug),
    ["videos", "stats", "reading", "education", "lectures"],
  );
  const notes = own.find((tile) => tile.slug === "videos");
  // The old shared tiles are only the legacy-kind mapping: nobody reads them.
  assert.equal(
    (await as(null, () => q("select 1 from learn_more_tiles where entry_id is null"))).length,
    0,
  );
  await as(id.admin, () =>
    refused(q("insert into learn_more_tiles (slug, label) values ('notes', 'Notes')")),
  );

  // A custom tile of one dossier: its writer yes, another publisher no.
  const custom = await as(id.pubA, () =>
    one(
      "insert into learn_more_tiles (entry_id, slug, label) values ($1, 'podcasts', 'Podcasts') returning id",
      [entry],
    ),
  );
  await as(id.pubB, () =>
    refused(
      q("insert into learn_more_tiles (entry_id, slug, label) values ($1, 'x', 'X')", [entry]),
    ),
  );
  // The draft's tile is not public.
  assert.equal(
    (await as(null, () => q("select 1 from learn_more_tiles where id = $1", [custom.id]))).length,
    0,
  );

  // Resources: legacy kind gets its tile, a tile gets its kind, a foreign tile is refused.
  await as(id.pubA, () =>
    q(call, [
      entry,
      "resources",
      JSON.stringify([
        { kind: "Videos & Documentaries", title: "Doc", url: "https://example.org/a" },
        { tile_id: custom.id, title: "Pod", url: "https://example.org/b" },
      ]),
    ]),
  );
  const links = await q(
    "select r.kind, t.slug from resources r join learn_more_tiles t on t.id = r.tile_id where r.entry_id = $1 order by r.position",
    [entry],
  );
  assert.deepEqual(links, [
    { kind: "Videos & Documentaries", slug: "videos" },
    { kind: null, slug: "podcasts" },
  ]);
  await as(id.pubB, () =>
    refused(
      q(call, [
        other,
        "resources",
        JSON.stringify([{ tile_id: custom.id, title: "X", url: "https://example.org" }]),
      ]),
      /another dossier/,
    ),
  );

  // Tile notes: on a default or own tile; empty notes are dropped.
  await as(id.pubA, () =>
    q(call, [
      entry,
      "tile_notes",
      JSON.stringify([
        { tile_id: notes.id, body_html: "<p>Field notes</p>" },
        { tile_id: custom.id, body_html: " " },
      ]),
    ]),
  );
  assert.equal(
    (await one("select count(*)::int n from entry_tile_notes where entry_id = $1", [entry])).n,
    1,
  );
  await as(id.pubB, () =>
    refused(
      q(call, [
        other,
        "tile_notes",
        JSON.stringify([{ tile_id: custom.id, body_html: "<p>x</p>" }]),
      ]),
    ),
  );

  // FAQ: the dossier's writer; limits from the schema.
  await as(id.pubA, () =>
    q(call, [entry, "faq", JSON.stringify([{ question: "What is it?", answer: "A crime." }])]),
  );
  await as(id.pubA, () =>
    refused(q(call, [entry, "faq", JSON.stringify([{ question: "", answer: "x" }])])),
  );
  await as(id.pubB, () =>
    refused(
      q(call, [entry, "faq", JSON.stringify([{ question: "Q", answer: "A" }])]),
      /may not edit/,
    ),
  );

  // SEO & GEO: optional overrides with the limits search engines use.
  await as(id.pubA, () =>
    q("update entries set seo_title = $2, seo_keywords = $3 where id = $1", [
      entry,
      "Migrant smuggling — routes, actors, policy",
      ["migration", "smuggling"],
    ]),
  );
  await as(id.pubA, () =>
    refused(q("update entries set seo_description = $2 where id = $1", [entry, "x".repeat(171)])),
  );

  // Published: anon reads the parts; anon never writes them.
  await q("update entries set status = 'published' where id = $1", [entry]);
  assert.equal(
    (await as(null, () => q("select 1 from entry_faq where entry_id = $1", [entry]))).length,
    1,
  );
  assert.equal(
    (await as(null, () => q("select 1 from learn_more_tiles where id = $1", [custom.id]))).length,
    1,
  );
  await as(null, () =>
    refused(
      q("insert into entry_faq (entry_id, position, question, answer) values ($1, 5, 'Q', 'A')", [
        entry,
      ]),
    ),
  );
});

test("topic templates: default copy, re-apply by slug, own tiles, rights", async () => {
  const entry = await newEntry(id.pubA, "topic-templates");
  await q("update entries set kind = 'entry' where id = $1", [entry]);
  const tiles = () =>
    q("select id, slug, label, icon from learn_more_tiles where entry_id = $1 order by position", [
      entry,
    ]);
  const videos = (await tiles()).find((tile) => tile.slug === "videos");
  await as(id.pubA, () =>
    q("select replace_entry_parts($1, 'resources', $2::jsonb)", [
      entry,
      JSON.stringify([{ tile_id: videos.id, title: "Doc", url: "https://example.org/doc" }]),
    ]),
  );

  // Templates: readable by writers, changed only with the right over all articles.
  const standard = await as(id.pubA, () => one("select id from topic_templates where is_default"));
  assert.ok(standard.id);
  await as(null, () => refused(q("select * from topic_templates")));
  await as(id.pubA, () => refused(q("insert into topic_templates (name) values ('Mine')")));
  const short = await as(id.admin, () =>
    one(
      "insert into topic_templates (name, learn_more_label) values ('Short', 'Go deeper') returning id",
    ),
  );
  await as(id.admin, () =>
    q("select replace_tiles(null, $1, $2::jsonb)", [
      short.id,
      JSON.stringify([
        { slug: "videos", label: "Watch", icon: "podcast", background: "#123456" },
        { slug: "maps", label: "Maps", icon: "map" },
      ]),
    ]),
  );
  await as(id.admin, () =>
    refused(
      q("select replace_tiles(null, $1, $2::jsonb)", [
        short.id,
        JSON.stringify([{ slug: "x", label: "X", icon: "Not an icon!" }]),
      ]),
    ),
  );

  // Re-applying keeps links on tiles of the same slug; removing drops the rest.
  await as(id.pubA, () => q("select apply_topic_template($1, $2, true)", [entry, short.id]));
  assert.deepEqual(
    (await tiles()).map(({ slug, label }) => [slug, label]),
    [
      ["videos", "Watch"],
      ["maps", "Maps"],
    ],
  );
  assert.equal(
    (await one("select count(*)::int n from resources where entry_id = $1", [entry])).n,
    1,
  );
  const topic = await one(
    "select template_id, learn_more_label, articles_label from entries where id = $1",
    [entry],
  );
  assert.deepEqual(topic, {
    template_id: short.id,
    learn_more_label: "Go deeper",
    articles_label: null,
  });
  await as(id.pubB, () =>
    refused(q("select apply_topic_template($1, $2)", [entry, standard.id]), /may not edit/),
  );

  // Own tiles saved at once: rename, reorder, add, delete (links go with the tile).
  const [watch, maps] = await tiles();
  await as(id.pubA, () =>
    q("select replace_tiles($1, null, $2::jsonb)", [
      entry,
      JSON.stringify([
        { id: maps.id, slug: "maps", label: "Atlas maps", icon: "map" },
        { slug: "podcasts", label: "Podcasts", icon: "podcast" },
      ]),
    ]),
  );
  assert.deepEqual(
    (await tiles()).map(({ slug }) => slug),
    ["maps", "podcasts"],
  );
  assert.equal(
    (await one("select count(*)::int n from resources where tile_id = $1", [watch.id])).n,
    0,
  );

  // The topic's tiles become a new template; another one can be the default.
  const saved = await as(id.admin, () =>
    one("select save_topic_as_template($1, 'From topic') as id", [entry]),
  );
  assert.deepEqual(
    (
      await q("select slug from topic_template_tiles where template_id = $1 order by position", [
        saved.id,
      ])
    ).map((row) => row.slug),
    ["maps", "podcasts"],
  );
  await as(id.pubA, () =>
    refused(q("select set_default_topic_template($1)", [saved.id]), /may not change/),
  );
  await as(id.admin, () => q("select set_default_topic_template($1)", [saved.id]));
  assert.equal((await one("select name from topic_templates where is_default")).name, "From topic");
  // A new topic starts from the new default; the default can't be deleted.
  const fresh = await newEntry(id.pubA, "topic-fresh");
  await q("update entries set kind = 'entry' where id = $1", [fresh]);
  assert.equal(
    (await one("select count(*)::int n from learn_more_tiles where entry_id = $1", [fresh])).n,
    2,
  );
  await as(id.admin, () => q("delete from topic_templates where id = $1", [saved.id]));
  assert.equal(
    (await one("select count(*)::int n from topic_templates where id = $1", [saved.id])).n,
    1,
  );
  await as(id.admin, () => q("select set_default_topic_template($1)", [standard.id]));

  // Map layers: only the three known globe layers.
  await as(id.pubA, () => q("update entries set map_layers = '{regions}' where id = $1", [entry]));
  await as(id.pubA, () =>
    refused(q("update entries set map_layers = '{continents}' where id = $1", [entry])),
  );
});

test("subtopics: who created and edited them, kept across saves", async () => {
  const entry = await newEntry(id.pubA, "subtopic-stamps");
  const save = (who, items) =>
    as(who, () =>
      q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [entry, JSON.stringify(items)]),
    );
  await save(id.pubA, [
    { title: "One", body_html: "<p>a</p>" },
    { title: "Two", body_html: "<p>b</p>" },
  ]);
  const first = await q(
    "select id, title, created_by, updated_at from entry_chapters where entry_id = $1 order by position",
    [entry],
  );
  assert.deepEqual(
    first.map((row) => row.created_by),
    [id.pubA, id.pubA],
  );

  // Saved again by an editor: order swapped, only "Two" changed.
  await new Promise((done) => setTimeout(done, 20));
  await save(id.admin, [
    { id: first[1].id, title: "Two (revised)", body_html: "<p>b</p>" },
    { id: first[0].id, title: "One", body_html: "<p>a</p>" },
  ]);
  const second = await q(
    "select id, title, position, created_by, updated_by, updated_at from entry_chapters where entry_id = $1 order by position",
    [entry],
  );
  assert.deepEqual(
    second.map((row) => row.id),
    [first[1].id, first[0].id],
  );
  assert.equal(second[0].created_by, id.pubA);
  assert.equal(second[0].updated_by, id.admin);
  assert.ok(second[0].updated_at > first[1].updated_at);
  // The untouched one keeps its stamp.
  assert.equal(second[1].updated_by, id.pubA);
  assert.equal(String(second[1].updated_at), String(first[0].updated_at));

  // The topic itself records its last editor; staff names only for writers.
  await as(id.admin, () => q("update entries set title = 'Stamped' where id = $1", [entry]));
  assert.equal(
    (await one("select updated_by from entries where id = $1", [entry])).updated_by,
    id.admin,
  );
  assert.ok((await as(id.pubA, () => one("select staff_name($1) as n", [id.admin]))).n);
  assert.equal(
    (await as(id.newcomer, () => one("select staff_name($1) as n", [id.admin]))).n,
    null,
  );
});

test("author profiles: slug from the name, unique, stable on rename, readable by anon", async () => {
  const first = await one(
    "insert into authors (name) values ('Jiří Nováková-Šťastná') returning id, slug",
  );
  assert.equal(first.slug, "jiri-novakova-stastna");
  const second = await one(
    "insert into authors (name) values ('Jiří Nováková Šťastná') returning slug",
  );
  assert.equal(second.slug, "jiri-novakova-stastna-2");
  const odd = await one("insert into authors (name) values ('!!!') returning slug");
  assert.equal(odd.slug, "author");

  // Renaming keeps the URL; clearing the slug regenerates it from the new name.
  const slugOf = async () => (await one("select slug from authors where id = $1", [first.id])).slug;
  await q("update authors set name = 'Jana Dvořáková' where id = $1", [first.id]);
  assert.equal(await slugOf(), "jiri-novakova-stastna");
  await q("update authors set slug = null where id = $1", [first.id]);
  assert.equal(await slugOf(), "jana-dvorakova");
  await refused(q("update authors set slug = 'Not A Slug' where id = $1", [first.id]), /check/);

  await as(null, async () => {
    const row = await one("select slug, name from authors where id = $1", [first.id]);
    assert.equal(row.slug, "jana-dvorakova");
    await refused(q("select profile_id from authors limit 1"), /permission denied/);
    await refused(q("select slugify_text('x')"), /permission denied/);
  });
});

test("volunteer applications: the server submits them, only account managers see and handle them", async () => {
  // A visitor applies through the server action (service key); the public key
  // can't call the function, so nobody can exhaust the shared cap directly.
  await as(null, () =>
    refused(
      q("select submit_volunteer_application('Ana Writer', 'ana@example.org', '', '')"),
      /permission denied/,
    ),
  );
  await asService(() =>
    q("select submit_volunteer_application('Ana Writer', ' Ana@Example.org ', 'Sahel', 'Hi')"),
  );
  await as(null, () => refused(q("select * from volunteer_applications")));
  await as(null, () =>
    refused(q("insert into volunteer_applications (name, email) values ('x', 'x@y.zz')")),
  );
  await asService(() =>
    refused(q("select submit_volunteer_application('', 'not-an-email', '', '')"), /check/),
  );

  // Someone without the accounts right sees nothing and can't set the address.
  assert.equal((await as(id.pubA, () => q("select id from volunteer_applications"))).length, 0);
  const notMine = await as(id.pubA, () =>
    q("update volunteer_settings set notify_email = 'me@x.org' returning id"),
  );
  assert.equal(notMine.length, 0);

  // The accounts manager reads it, marks it and sets where applications go.
  const [row] = await as(id.permAdmin, () =>
    q("select id, email, status from volunteer_applications"),
  );
  assert.deepEqual(
    { email: row.email, status: row.status },
    { email: "ana@example.org", status: "new" },
  );
  await as(id.permAdmin, () =>
    q("update volunteer_applications set status = 'contacted' where id = $1", [row.id]),
  );
  await as(id.permAdmin, () =>
    refused(q("update volunteer_applications set email = 'x@y.zz' where id = $1", [row.id])),
  );
  await as(id.permAdmin, () =>
    q("update volunteer_settings set notify_email = 'team@atlasoftodaysworld.org'"),
  );
  await as(id.permAdmin, () =>
    refused(q("update volunteer_settings set notify_email = 'nope'"), /check/),
  );
  assert.equal(
    (await one("select notify_email from volunteer_settings")).notify_email,
    "team@atlasoftodaysworld.org",
  );

  // At most 30 applications an hour for everyone together.
  for (let n = 1; n < 30; n++) {
    await asService(() =>
      q("select submit_volunteer_application('N', $1, '', '')", [`n${n}@x.org`]),
    );
  }
  await asService(() =>
    refused(q("select submit_volunteer_application('N', 'late@x.org', '', '')"), /rate_limited/),
  );
  await as(id.permAdmin, () => q("delete from volunteer_applications"));
  assert.equal((await one("select count(*)::int as n from volunteer_applications")).n, 0);
});

test("home featured subtopics: everyone reads them, only editors with the news right pin them", async () => {
  const entry = await newEntry(id.editor, "home-featured");
  const [chapter] = await q(
    "insert into entry_chapters (entry_id, position, title) values ($1, 0, 'Pinned') returning id",
    [entry],
  );
  const slots = await as(null, () => q("select first_chapter, second_chapter from home_featured"));
  assert.deepEqual(slots, [{ first_chapter: null, second_chapter: null }]);
  await as(null, () => refused(q("update home_featured set first_chapter = $1", [chapter.id])));
  const byReader = await as(id.reader, () =>
    q("update home_featured set first_chapter = $1 returning id", [chapter.id]),
  );
  assert.equal(byReader.length, 0);

  await as(id.editor, () => q("update home_featured set first_chapter = $1", [chapter.id]));
  await as(id.editor, () =>
    refused(q("update home_featured set second_chapter = $1", [chapter.id]), /check/),
  );
  assert.equal((await one("select first_chapter from home_featured")).first_chapter, chapter.id);

  // A deleted subtopic frees its slot.
  await q("delete from entry_chapters where id = $1", [chapter.id]);
  assert.equal((await one("select first_chapter from home_featured")).first_chapter, null);
});

// ---------------------------------------------------------------------------
// Privilege guards (migration 20261007000010)
// ---------------------------------------------------------------------------

test("admin accounts: only an admin changes, blocks or removes them", async () => {
  // A second admin, so keep_one_admin isn't what stops the attempts.
  const second = "00000000-0000-4000-8000-0000000a2d01";
  await q("insert into auth.users (id, email) values ($1, 'admin2@example.org')", [second]);
  await q(
    "update profiles set role_id = 'admin', kind = 'staff', status = 'active' where id = $1",
    [second],
  );

  // The permission admin manages accounts, but not the admins'.
  for (const change of [
    "status = 'blocked', blocked_note = 'x'",
    "role_id = 'reader'",
    "email = 'attacker@example.org'",
    "deleted_at = now()",
  ]) {
    await as(id.permAdmin, () =>
      refused(q(`update profiles set ${change} where id = $1`, [second]), /Only an admin/),
    );
  }
  // Removing the profile is refused (or matches no row under RLS); it stays.
  await as(id.permAdmin, () => q("delete from profiles where id = $1", [second]).catch(() => []));
  assert.equal(
    (await one("select status from profiles where id = $1", [second]))?.status,
    "active",
  );

  // An admin may.
  await as(id.admin, () =>
    q("update profiles set status = 'blocked', blocked_note = 'test' where id = $1", [second]),
  );
  assert.equal(
    (await one("select status from profiles where id = $1", [second])).status,
    "blocked",
  );
  await q("delete from auth.users where id = $1", [second]);
});

test("sign-in security: only an admin turns off 2FA or invite-only", async () => {
  await as(id.permAdmin, () =>
    refused(
      q("update security_settings set require_2fa_roles = '{}' where id = 1"),
      /Only an admin can change sign-in security/,
    ),
  );
  await as(id.permAdmin, () =>
    refused(q("update security_settings set invite_only = false where id = 1"), /Only an admin/),
  );
  // Other settings stay with the permission admin.
  const changed = await as(id.permAdmin, () =>
    q("update security_settings set session_hours = 10 where id = 1 returning id"),
  );
  assert.equal(changed.length, 1);
  await as(id.admin, () => q("update security_settings set invite_only = true where id = 1"));
  assert.deepEqual(
    (await one("select require_2fa_roles from security_settings")).require_2fa_roles,
    ["admin", "permission-admin"],
  );
  await q("update security_settings set session_hours = 12 where id = 1");
});

test("invitations: a revoked one stays revoked, an extension is short", async () => {
  const [inv] = await as(id.admin, () =>
    q(
      "insert into invitations (email, role_id) values ('guard.test@example.org', 'permission-admin') returning id",
    ),
  );
  await as(id.admin, () => q("update invitations set revoked_at = now() where id = $1", [inv.id]));
  // Nobody revives it, not even its sender.
  await as(id.permAdmin, () =>
    refused(q("update invitations set revoked_at = null where id = $1", [inv.id]), /stays revoked/),
  );
  await as(id.admin, () =>
    refused(q("update invitations set revoked_at = null where id = $1", [inv.id]), /stays revoked/),
  );

  // A live invitation for a privileged role is extended only by an admin, at most five days.
  const [live] = await as(id.admin, () =>
    q(
      "insert into invitations (email, role_id) values ('guard.live@example.org', 'permission-admin') returning id",
    ),
  );
  await as(id.permAdmin, () =>
    refused(
      q("update invitations set expires_at = now() + interval '2 days' where id = $1", [live.id]),
      /Only an admin can extend/,
    ),
  );
  await as(id.admin, () =>
    refused(
      q("update invitations set expires_at = now() + interval '30 days' where id = $1", [live.id]),
      /at most five days/,
    ),
  );
  await as(id.admin, () =>
    q("update invitations set expires_at = now() + interval '4 days' where id = $1", [live.id]),
  );
  await q("delete from invitations where id in ($1, $2)", [inv.id, live.id]);
});

test("scheduled publishing: an author's edit of subtopics or FAQ drops the schedule", async () => {
  const entry = await newEntry(id.pubA, "scheduled-parts", ["BRA"], "pending");
  const schedule = () =>
    as(id.approverLatam, () => q("select schedule_entry($1, now() + interval '1 day')", [entry]));
  const planned = async () =>
    (await one("select publish_at from entries where id = $1", [entry])).publish_at !== null;

  await schedule();
  assert.equal(await planned(), true);
  // The author rewrites a subtopic after approval was scheduled → the plan is void.
  await as(id.pubA, () =>
    q("select replace_entry_parts($1, 'chapters', $2::jsonb)", [
      entry,
      JSON.stringify([{ title: "Rewritten", body_html: "<p>new text</p>" }]),
    ]),
  );
  assert.equal(await planned(), false);

  // Scheduled again, it holds while nobody else touches the text.
  await schedule();
  assert.equal(await planned(), true);
});

test("approval stamps and creators are set by the database, not the client", async () => {
  const entry = await as(id.pubA, () =>
    one(
      `insert into entries (slug, title, summary, category, region_slug, owner_id, status, approved_by, approved_at)
       values ('forged-approval', 'Forged', 'S', 'Society', 'latin-america-caribbean', $1, 'draft', $2, now())
       returning approved_by, approved_at`,
      [id.pubA, id.editor],
    ),
  );
  assert.deepEqual(entry, { approved_by: null, approved_at: null });
});

test("staff names: not for a blocked team member", async () => {
  assert.equal((await as(id.blocked, () => one("select staff_name($1) as n", [id.admin]))).n, null);
});

test("content status: everyone reads it, only the region / issue editors change it", async () => {
  // The migration's starting statuses touch only existing slugs; other regions start untouched.
  assert.equal(
    (await as(null, () => one("select content_status from regions where slug = 'east-asia'")))
      .content_status,
    "none",
  );

  // Atlas regions: the `regions` e right (data editor), not a publisher with view only.
  const changed = await as(id.dataEditor, () =>
    q(`update regions set content_status = 'ready' where slug = 'east-asia' returning slug`),
  );
  assert.equal(changed.length, 1);
  const blocked = await as(id.pubA, () =>
    q(`update regions set content_status = 'none' where slug = 'east-asia' returning slug`),
  );
  assert.equal(blocked.length, 0);
  await as(id.dataEditor, () =>
    refused(
      q(`update regions set content_status = 'done' where slug = 'east-asia'`),
      /content_status/,
    ),
  );
  assert.equal(
    (await as(null, () => one("select content_status from regions where slug = 'east-asia'")))
      .content_status,
    "ready",
  );

  // Global issues: the `specials` e right; a new one starts untouched.
  await as(id.dataEditor, () =>
    q(`insert into special_regions (slug, name, fill, stroke, center_lon, center_lat)
       values ('status-war', 'War', '#336699', '#224466', 30, 50)`),
  );
  assert.equal(
    (
      await as(null, () =>
        one("select content_status from special_regions where slug = 'status-war'"),
      )
    ).content_status,
    "none",
  );
  await as(id.dataEditor, () =>
    q(`update special_regions set content_status = 'preparing' where slug = 'status-war'`),
  );
  const notAllowed = await as(id.editor, () =>
    q(
      `update special_regions set content_status = 'ready' where slug = 'status-war' returning slug`,
    ),
  );
  assert.equal(notAllowed.length, 0);
  assert.equal(
    (
      await as(null, () =>
        one("select content_status from special_regions where slug = 'status-war'"),
      )
    ).content_status,
    "preparing",
  );
  await as(null, () => refused(q(`update special_regions set content_status = 'ready'`)));
});

test("readers: team metadata of published entries and author accounts stay with the team", async () => {
  const entry = await newEntry(id.pubA, "team-metadata", [], "published");
  const internal =
    "select owner_id, approved_by, approved_at, scheduled_by, publish_at from entries";
  // A fresh sign-up (the shared test reader has joined the team by now).
  const reader = "00000000-0000-4000-8000-0000000000f1";
  await q("insert into auth.users (id, email) values ($1, 'fresh.reader@example.org')", [reader]);

  // A self-registered reader reads the public site as anon does, not through the session.
  await as(reader, async () => {
    assert.equal((await q(`${internal} where id = $1`, [entry])).length, 0);
    await refused(q("select profile_id from authors limit 1"), /permission denied/);
    assert.ok(Array.isArray(await q("select id, name, slug, bio from authors limit 1")));
  });
  // A blocked team member sees no more than a reader.
  assert.equal((await as(id.blocked, () => q(`${internal} where id = $1`, [entry]))).length, 0);

  // The team keeps what the admin needs — also a team member without the news right.
  for (const member of [id.editor, id.dataEditor]) {
    const rows = await as(member, () => q("select owner_id from entries where id = $1", [entry]));
    assert.equal(rows[0]?.owner_id, id.pubA);
  }
  // Anyone still reads the public columns of a published entry anonymously.
  const open = await as(null, () => q("select slug from entries where id = $1", [entry]));
  assert.equal(open.length, 1);
});

test("portrait: a section save without the right is refused even when the list is empty", async () => {
  const call = "select replace_portrait_items('region', 'east-asia', 'faq', '[]'::jsonb)";
  // Before, an empty list "succeeded" for anyone (RLS removed nothing) and the app refreshed caches.
  await as(id.newcomer, () => refused(q(call), /may not edit/));
  await as(id.pubA, () => refused(q(call), /may not edit/));
  await as(id.editor, () => q(call));
  const metrics = "select replace_portrait_items('country', 'JPN', 'metrics', '[]'::jsonb)";
  await as(id.pubA, () => refused(q(metrics), /may not edit/));
});

test("daily housekeeping trims what only grows, and only the database runs it", async () => {
  await q(
    "insert into rate_limits (key, window_start, hits) values ('old', now() - interval '2 days', 1), ('now', now(), 1)",
  );
  await q(
    "insert into audit_log (at, action) values (now() - interval '13 months', 'test.old'), (now(), 'test.new')",
  );
  const result = await one("select public.db_housekeeping() as r");
  assert.ok(result.r.rate_limits >= 1 && result.r.audit_log >= 1);
  const left = await one(
    `select (select count(*)::int from rate_limits where key in ('old', 'now')) as limits,
            (select count(*)::int from audit_log where action in ('test.old', 'test.new')) as audit`,
  );
  assert.deepEqual(left, { limits: 1, audit: 1 });
  await as(id.admin, () => refused(q("select public.db_housekeeping()"), /permission denied/));
});
