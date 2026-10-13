import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Permission section `site` (migration 20261013000100_site_permission_section):
 * the CHECK on role_permissions.section accepts it, my_permissions() lists it,
 * and the built-in roles that edit articles get it by default.
 *
 * The harness stops before that migration and adds a custom role that can
 * edit articles, so the default grant is shown to touch only built-in roles.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const FIRST_NEW = "20261013000100";
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000000c01",
  permAdmin: "00000000-0000-4000-8000-000000000c02",
  editor: "00000000-0000-4000-8000-000000000c03",
  publisher: "00000000-0000-4000-8000-000000000c04",
  approver: "00000000-0000-4000-8000-000000000c05",
  dataEditor: "00000000-0000-4000-8000-000000000c06",
  observer: "00000000-0000-4000-8000-000000000c07",
  reader: "00000000-0000-4000-8000-000000000c08",
  custom: "00000000-0000-4000-8000-000000000c09",
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

/** The `site` actions my_permissions() returns for `user` (undefined = no row). */
const sitePerms = (user) =>
  as(
    user,
    async () => (await one("select actions from my_permissions() where section = 'site'"))?.actions,
  );

before(async () => {
  await db.exec(readFileSync(join(here, "supabase-stubs.sql"), "utf8"));
  const files = readdirSync(migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const apply = async (list) => {
    for (const file of list) {
      try {
        await db.exec(readFileSync(join(migrations, file), "utf8"));
      } catch (error) {
        throw new Error(`${file}: ${error.message}`);
      }
    }
  };
  await apply(files.filter((f) => f < FIRST_NEW));
  // A role created in the admin before the migration, with article edit rights.
  await db.exec(`
    insert into roles (id, name, news_scope) values ('custom-writer', 'Custom writer', 'own');
    insert into role_permissions (role_id, section, actions) values ('custom-writer', 'news', 'vce');
  `);
  await apply(files.filter((f) => f >= FIRST_NEW));

  const people = [
    [id.admin, "admin", "staff"],
    [id.permAdmin, "permission-admin", "staff"],
    [id.editor, "content-editor", "staff"],
    [id.publisher, "publisher", "staff"],
    [id.approver, "content-approver", "staff"],
    [id.dataEditor, "data-editor", "staff"],
    [id.observer, "observer", "staff"],
    [id.reader, "reader", "reader"],
    [id.custom, "custom-writer", "staff"],
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

test("site: the CHECK accepts the section and still rejects unknown ones", async () => {
  await q(
    "insert into role_permissions (role_id, section, actions) values ('observer', 'site', 'v')",
  );
  await q("delete from role_permissions where role_id = 'observer' and section = 'site'");
  await refused(
    q("insert into role_permissions (role_id, section, actions) values ('observer', 'sites', 'v')"),
    /role_permissions_section_check/,
  );
});

test("site: default grants are vced for the built-in roles that edit articles", async () => {
  const rows = await q(
    "select role_id, actions from role_permissions where section = 'site' order by role_id",
  );
  assert.deepEqual(
    rows.map((row) => ({ ...row })),
    [
      { role_id: "content-editor", actions: "vced" },
      { role_id: "publisher", actions: "vced" },
    ],
    "admin is locked (never stored); custom roles are left to the admin",
  );
});

test("site: my_permissions() returns it for roles that have it", async () => {
  assert.equal(await sitePerms(id.admin), "vced", "locked admin has everything");
  assert.equal(await sitePerms(id.editor), "vced");
  assert.equal(await sitePerms(id.publisher), "vced");
});

test("site: roles without it get an empty grant and no has_perm", async () => {
  for (const user of [
    id.permAdmin,
    id.approver,
    id.dataEditor,
    id.observer,
    id.reader,
    id.custom,
  ]) {
    assert.equal(await sitePerms(user), "", `user ${user}`);
    assert.equal(
      (await as(user, () => one("select has_perm('site', 'v') ok"))).ok,
      false,
      `user ${user}`,
    );
  }
  assert.equal((await as(id.editor, () => one("select has_perm('site', 'e') ok"))).ok, true);
});

test("site: the permission admin can grant it to another role", async () => {
  await as(id.permAdmin, () =>
    q("insert into role_permissions (role_id, section, actions) values ('observer', 'site', 'v')"),
  );
  assert.equal(await sitePerms(id.observer), "v");
  await q("delete from role_permissions where role_id = 'observer' and section = 'site'");
  assert.equal(await sitePerms(id.observer), "");
});

test("site: anonymous readers can't read permissions", async () => {
  await refused(
    as(null, () => q("select * from my_permissions()")),
    /permission denied/,
  );
});
