import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Pravidla přístupu ověřená proti skutečnému Postgresu.
 *
 * Migrace se pustí do PGlite (Postgres ve WebAssembly), nad ně malá náhrada
 * za schémata `auth` a `storage` ze Supabase, a pak se za jednotlivé role
 * zkouší, co projde a co ne. Hlídá se to, co v ukázce jen „vypadalo" —
 * tady to musí vynutit databáze, ať aplikace pošle cokoli.
 *
 * Spuštění: npm run test:db
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
 * Spustí `fn` jako přihlášený uživatel (null = anonymní čtenář). Výchozí
 * session má druhý faktor (aal2); `{ aal: "aal1" }` simuluje přihlášení bez TOTP.
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

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

/** Očekávaná chyba z databáze; vrátí její text. */
async function refused(promise, pattern) {
  try {
    await promise;
  } catch (error) {
    if (pattern) assert.match(String(error.message), pattern);
    return error.message;
  }
  assert.fail("čekal jsem odmítnutí, ale prošlo to");
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

  // Minimální geografie pro testy.
  await db.exec(`
    insert into regions (slug, name, fill, stroke, center_lon, center_lat) values
      ('latin-america-caribbean', 'Latin America & Caribbean', '#aaaaaa', '#555555', -60, -10),
      ('east-asia', 'East Asia', '#aaaaaa', '#555555', 110, 35);
    insert into countries (iso3, slug, name, region_slug) values
      ('BRA', 'brazil', 'Brazil', 'latin-america-caribbean'),
      ('JPN', 'japan', 'Japan', 'east-asia'),
      ('USA', 'united-states', 'United States', null);
  `);

  // Účty: registrace vytvoří čtenáře, role rozdá servisní klíč (auth.uid() je null).
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

test("registrace založí profil čtenáře", async () => {
  const p = await one("select role_id, kind, status from profiles where id = $1", [id.newcomer]);
  assert.deepEqual(p, { role_id: "reader", kind: "reader", status: "active" });
});

test("anonymní čtenář vidí jen zveřejněné články", async () => {
  await newEntry(id.pubA, "anon-draft");
  await newEntry(id.pubA, "anon-published", [], "published"); // import servisním klíčem
  const slugs = await as(null, () =>
    q("select slug from entries where slug like 'anon-%' order by slug"),
  );
  assert.deepEqual(
    slugs.map((r) => r.slug),
    ["anon-published"],
  );
});

test("anonym nic nezapíše", async () => {
  await as(null, () =>
    refused(
      q("insert into entries (slug, title, category, owner_id) values ('x', 'x', 'Society', null)"),
      /permission denied/,
    ),
  );
});

test("publisher píše vlastní koncepty, cizí ne", async () => {
  await as(id.pubA, async () => {
    const own = await one(
      `insert into entries (slug, title, category, owner_id) values ('pub-own', 'Own', 'Society', $1) returning id`,
      [id.pubA],
    );
    assert.ok(own.id);
    // Odmítne to už trigger (před RLS) — s hláškou, které redaktor rozumí.
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
  assert.equal(changed.length, 0, "cizí koncept se nesmí dát přepsat");
  const other = await as(id.pubA, () => q("select id from entries where id = $1", [foreign]));
  assert.equal(other.length, 0, "cizí koncept publisher ani nevidí");
});

test("publisher nezveřejní ani přímo, ani přes podstrčený příznak", async () => {
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
        // PGlite nepustí dva příkazy s parametrem v jednom query — zkusíme po sobě.
        await q("select set_config('atlas.approving', 'on', false)");
        return q("update entries set status = 'published' where id = $1", [own]);
      }),
      /through submit, approve|through approval/,
    );
    await refused(q("select approve_entry($1)", [own]), /outside what you may approve/);
  });
});

test("publisher pošle ke schválení", async () => {
  const own = await newEntry(id.pubA, "pub-submit");
  await as(id.pubA, () => q("select submit_entry($1)", [own]));
  assert.equal((await one("select status from entries where id = $1", [own])).status, "pending");
});

test("přidělený schvalovatel schválí jen své země a autory", async () => {
  const brazil = await newEntry(id.pubA, "appr-brazil", ["BRA"], "pending");
  const japan = await newEntry(id.pubA, "appr-japan", ["JPN"], "pending");
  const byB = await newEntry(id.pubB, "appr-by-b", ["USA"], "pending");

  await as(id.approverAsia, () => refused(q("select approve_entry($1)", [brazil]), /outside/));
  await as(id.approverLatam, () => refused(q("select approve_entry($1)", [japan]), /outside/));

  await as(id.approverLatam, () => q("select approve_entry($1)", [brazil]));
  await as(id.approverLatam, () => q("select approve_entry($1)", [byB])); // přes autora
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

test("přidělený schvalovatel neschvaluje sám sebe", async () => {
  await q("update profiles set role_id = 'content-approver' where id = $1", [id.pubB]);
  // pubB je teď schvalovatel s přidělenou Brazílií
  await q("insert into approver_countries values ($1, 'BRA')", [id.pubB]);
  const own = await newEntry(id.pubB, "self-approve", ["BRA"], "pending");
  await as(id.pubB, () => refused(q("select approve_entry($1)", [own]), /outside/));
  await q("delete from approver_countries where user_id = $1", [id.pubB]);
  await q("update profiles set role_id = 'publisher' where id = $1", [id.pubB]);
});

test("vrácení autorovi chce vzkaz", async () => {
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

test("content editor upraví cizí koncept a zveřejní ho", async () => {
  const entry = await newEntry(id.pubB, "editor-fix");
  await as(id.editor, async () => {
    const done = await q("update entries set title = 'Fixed' where id = $1 returning id", [entry]);
    assert.equal(done.length, 1);
    // Schvaluje se jen čekající článek (DB-09): nejdřív odeslat, pak schválit.
    await refused(q("select approve_entry($1)", [entry]), /waiting for approval/);
    await q("select submit_entry($1)", [entry]);
    await q("select approve_entry($1)", [entry]);
  });
  assert.equal(
    (await one("select status from entries where id = $1", [entry])).status,
    "published",
  );
});

test("autor bez práva schvalovat nepřepíše svůj zveřejněný článek", async () => {
  const entry = await newEntry(id.pubA, "live-own", [], "published");
  await as(id.pubA, () =>
    refused(
      q("update entries set body_html = '<p>changed</p>' where id = $1", [entry]),
      /changed by someone who may also approve/,
    ),
  );
});

test("každá změna textu nechá předchozí verzi", async () => {
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

test("permission admin spravuje oprávnění, ne obsah", async () => {
  const entry = await newEntry(id.pubA, "perm-admin-try");
  await as(id.permAdmin, async () => {
    const changed = await q("update entries set title = 'x' where id = $1 returning id", [entry]);
    assert.equal(changed.length, 0, "na obsah nedosáhne");
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

test("admin je zamčený a nesmí zmizet poslední", async () => {
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

test("zablokovaný účet nesmí nic", async () => {
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

test("čtenář vidí jen svůj profil a do administrace nedosáhne", async () => {
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

test("záznam změn zachytí oprávnění, role i schválení", async () => {
  const actions = (await q("select action from audit_log")).map((r) => r.action);
  for (const expected of ["role_permissions.insert", "profiles.update", "entries.update"]) {
    assert.ok(actions.includes(expected), `v záznamu chybí ${expected}`);
  }
  const fromApp = await as(id.admin, () => q("select count(*)::int as n from audit_log"));
  assert.ok(fromApp[0].n > 0, "admin záznam čte");
  await as(id.admin, () => refused(q("delete from audit_log"), /permission denied/));
});

test("redakční účet jen z povolené adresy (je-li seznam vyplněný)", async () => {
  await as(id.permAdmin, async () => {
    // Seznam omezuje tým na domény; prázdný seznam neomezuje (tým chrání pozvánky).
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

test("placené členství nezapíše nikdo z aplikace, dárkové jen admin", async () => {
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
  // webhook (servisní klíč) smí placené
  await q(
    "insert into memberships (user_id, plan, stripe_subscription_id, started_at) values ($1, 'founding', 'sub_1', now())",
    [id.pubA],
  );
});

test("návštěvnost se sčítá jen sobě", async () => {
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

test("plochy: jen platný obrazec a jen s právem na plochy", async () => {
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

test("ruční hodnota ukazatele musí mít zdroj", async () => {
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
          if (rows.length === 0) throw new Error("row-level security: nic se nezměnilo");
          return rows;
        },
      ),
      /row-level security/,
    ),
  );
});

test("obrázky nahraje jen ten, kdo smí psát, a jen do vlastní složky", async () => {
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

// ---------------------------------------------------------------------------
// Bezpečnostní opravy (migrace 20260930000001) a pozvánky (…0002)
// ---------------------------------------------------------------------------

/** Založí auth uživatele; `confirmed` = ověřený e-mail (Google jej má vždy). */
async function signUp(uid, email, confirmed = true) {
  await q("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)", [
    uid,
    email,
    confirmed ? new Date().toISOString() : null,
  ]);
}

test("DB-01: vlastní role bez práva na oprávnění neobejde seznam povolených e-mailů", async () => {
  await q(`insert into roles (id, name) values ('account-helper', 'Account helper')`);
  await q(
    `insert into role_permissions (role_id, section, actions) values ('account-helper', 'users', 've')`,
  );
  const helper = "00000000-0000-4000-8000-0000000000a1";
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

test("DB-03: mazání chce právo „d“, ne jen „e“", async () => {
  await q(
    `insert into indicators (id, label, domain_min, domain_max) values ('gini', 'Gini', 20, 60)`,
  );
  await q(
    `insert into indicator_values (indicator_id, country_iso3, value) values ('gini', 'BRA', 52)`,
  );
  // data-editor má layers „vce“ — upraví, ale nesmaže.
  await as(id.dataEditor, async () => {
    const gone = await q("delete from indicator_values where indicator_id = 'gini' returning 1");
    assert.equal(gone.length, 0);
  });
  assert.equal((await q("select 1 from indicator_values where indicator_id = 'gini'")).length, 1);
});

test("DB-04: publisher nepřepíše cizí bio autora", async () => {
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

test("DB-05: anonym nevidí zdroje nezveřejněného hesla", async () => {
  const draft = await newEntry(id.pubA, "resource-draft");
  await q(
    `insert into resources (entry_id, kind, title, url) values ($1, 'Lectures & Debates', 'Secret', 'https://x.org')`,
    [draft],
  );
  await as(null, async () => {
    assert.equal((await q("select 1 from resources where title = 'Secret'")).length, 0);
  });
});

test("DB-06: URL obrázků a obálek jen https", async () => {
  const entry = await newEntry(id.pubA, "cover-js");
  await as(id.pubA, () =>
    refused(
      q("update entries set cover_url = 'javascript:alert(1)' where id = $1", [entry]),
      /check constraint/,
    ),
  );
});

test("DB-08: anonym nevidí vlastníka ani poznámku recenzenta", async () => {
  await as(null, async () => {
    await refused(q("select owner_id from entries limit 1"), /permission denied/);
    await refused(q("select review_note from entries limit 1"), /permission denied/);
    await refused(q("select profile_id from authors limit 1"), /permission denied/);
    const rows = await q("select slug, title from entries where status = 'published' limit 1");
    assert.ok(Array.isArray(rows));
  });
});

test("DB-09: schvaluje se jen čekající článek a nikdo kromě admina sám sebe", async () => {
  const own = await one(
    `insert into entries (slug, title, category, owner_id) values ('editor-own', 'Own', 'Society', $1) returning id`,
    [id.editor],
  );
  await as(id.editor, async () => {
    await q("select submit_entry($1)", [own.id]);
    await refused(q("select approve_entry($1)", [own.id]), /outside what you may approve/);
  });
  // Autor si stav „pending" nenastaví přímým zápisem.
  const draft = await newEntry(id.pubA, "direct-pending");
  await as(id.pubA, () =>
    refused(q("update entries set status = 'pending' where id = $1", [draft]), /through submit/),
  );
});

test("DB-10: importovaný ukazatel nejde přepnout na vlastní", async () => {
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

test("DB-13: pomocné funkce oprávnění nejsou pro anonyma a prázdná akce neprojde", async () => {
  await as(null, () => refused(q("select has_perm('news', 'v')"), /permission denied/));
  await as(id.admin, async () => {
    assert.equal((await one("select has_perm('news', '') as ok")).ok, false);
    assert.equal((await one("select has_perm('news', 'v') as ok")).ok, true);
  });
});

test("DB-14: záznam změn neobsahuje e-mail ani telefon", async () => {
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

test("DB-15: placené členství nesmaže ani admin", async () => {
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

test("pozvánka: permission-admin pozve publishera, ne admina ani správce účtů", async () => {
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

test("pozvánka: přijme ji jen ověřený e-mail z pozvánky", async () => {
  await as(id.admin, () =>
    q(
      `insert into invitations (email, role_id, approver_countries) values ('invited@example.org', 'content-approver', '{BRA}')`,
    ),
  );

  // Jiný e-mail pozvánku nepřevezme.
  const stranger = "00000000-0000-4000-8000-0000000000b1";
  await signUp(stranger, "stranger@example.org");
  assert.equal(
    (await one("select role_id from profiles where id = $1", [stranger])).role_id,
    "reader",
  );

  // Neověřený e-mail (registrace kódem, ještě nepotvrzená) roli nedostane…
  const invited = "00000000-0000-4000-8000-0000000000b2";
  await signUp(invited, "Invited@Example.org", false);
  let profile = await one("select role_id, kind from profiles where id = $1", [invited]);
  assert.deepEqual(profile, { role_id: "reader", kind: "reader" });
  await as(invited, async () => {
    assert.equal((await one("select claim_invitation() as role")).role, null);
  });

  // …dokud ho neověří.
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

test("pozvánka: prošlá ani odvolaná se nepřijme, přijatou nejde měnit", async () => {
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

test("pozvánka: existující čtenář ji přijme při dalším přihlášení", async () => {
  // Čtenář má e-mail ověřený dávno; pozvánka přijde až potom.
  await q("update auth.users set email_confirmed_at = now() where id = $1", [id.reader]);
  await as(id.admin, () =>
    q("insert into invitations (email, role_id) values ('reader@example.org', 'observer')"),
  );
  await as(id.reader, async () => {
    assert.equal((await one("select claim_invitation() as role")).role, "observer");
  });
  assert.equal((await one("select kind from profiles where id = $1", [id.reader])).kind, "staff");
});

test("vyhledávání najde zveřejněné, ne koncepty", async () => {
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

test("rate limit: v okně pustí jen daný počet a klient na něj nedosáhne", async () => {
  const results = [];
  for (let i = 0; i < 4; i += 1) {
    results.push((await one("select hit_rate_limit('test:1', 3, 600) as ok")).ok);
  }
  assert.deepEqual(results, [true, true, true, false]);
  await as(id.admin, () =>
    refused(q("select hit_rate_limit('test:2', 3, 600)"), /permission denied/),
  );
});

test("portrét: kolekci nahradí v jedné transakci jen redakce s právem", async () => {
  const items = JSON.stringify([
    { date_label: "1990", title: "Start", body: "B" },
    { date_label: "2000", title: "Next", body: "C" },
  ]);
  const call = "select replace_portrait_items('region', 'east-asia', 'timeline', $1::jsonb)";

  // Publisher píše jen své články — obsah portrétu mu nepatří.
  await as(id.pubA, () => refused(q(call, [items])));
  // Anonym funkci vůbec nespustí.
  await as(null, () => refused(q(call, [items])));

  await as(id.editor, () => q(call, [items]));
  const rows = await q(
    "select position, title from timeline_events where region_slug = 'east-asia' order by position",
  );
  assert.deepEqual(
    rows.map((r) => r.title),
    ["Start", "Next"],
  );

  // Neplatná položka (zdroj bez https) vrátí celé volání — původní obsah zůstane.
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

  // Ruční karty ukazatelů patří sekci regions — data-editor ano, publisher ne.
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

test("změna role: správce oprávnění nepovýší nikoho na správu účtů, admin ano", async () => {
  await as(id.permAdmin, () =>
    refused(
      q("update profiles set role_id = 'permission-admin' where id = $1", [id.pubB]),
      /Only an admin can give a role that manages/,
    ),
  );
  // Obyčejnou redakční roli správce oprávnění dát smí.
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
  // Vrátit, ať další testy počítají s původní rolí.
  await q("update profiles set role_id = 'publisher' where id = $1", [id.pubB]);
});

test("matice práv: správu účtů a oprávnění přidá roli jen admin", async () => {
  await as(id.permAdmin, () =>
    refused(
      q(
        "insert into role_permissions (role_id, section, actions) values ('publisher', 'users', 'v')",
      ),
      /Only an admin can let a role manage/,
    ),
  );
  // Obsahové sekce správce oprávnění nastavit smí.
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

test("2FA: admin bez druhého faktoru nesmí nic, publisher ho nepotřebuje", async () => {
  // Bez TOTP (aal1) je admin pro DB jako bez role.
  const aal1 = await as(
    id.admin,
    () =>
      one(
        "select is_admin() a, has_perm('users', 'v') u, (select count(*)::int from my_permissions()) n",
      ),
    { aal: "aal1" },
  );
  assert.deepEqual(aal1, { a: false, u: false, n: 0 });
  // Zápis pod RLS bez práva nic nezmění (0 řádků).
  const changed = await as(
    id.admin,
    () => q("update security_settings set session_hours = 5 where id = 1 returning id"),
    { aal: "aal1" },
  );
  assert.equal(changed.length, 0);
  const status = await as(id.admin, () => one("select mfa_status() s"), { aal: "aal1" });
  assert.deepEqual(status.s, { required: true, aal: "aal1" });

  // S TOTP (aal2) plná práva.
  const aal2 = await as(id.admin, () => one("select is_admin() a, has_perm('users', 'v') u"));
  assert.deepEqual(aal2, { a: true, u: true });

  // Role mimo require_2fa_roles druhý faktor nepotřebuje.
  const pub = await as(id.pubA, () => one("select has_perm('news', 'c') c"), { aal: "aal1" });
  assert.equal(pub.c, true);
});

test("přepínače: čte je každý, mění jen správa oprávnění", async () => {
  const flags = await as(null, () => q("select key, enabled from feature_flags order by key"));
  assert.deepEqual(
    flags.map((f) => f.key),
    ["maintenance", "newsletter"],
  );
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
});
