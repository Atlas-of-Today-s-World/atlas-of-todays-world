import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Real visitors' Core Web Vitals (migration 20261027000100_web_vitals, ADR-033):
 * only the server (service role) records a beacon, through record_web_vitals()
 * with its allowlists and value bounds; the table holds daily histograms and
 * nothing that identifies a visitor; web_vitals_p75() reads the 75th
 * percentile from them within 5 %; anon and accounts without members "v" read
 * nothing and write nothing; the housekeeping drops histograms after 400 days.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000003f01",
  permAdmin: "00000000-0000-4000-8000-000000003f02",
  editor: "00000000-0000-4000-8000-000000003f03",
  reader: "00000000-0000-4000-8000-000000003f04",
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

/** Runs `fn` as the server's service key (the /api/v route handler). */
async function asService(fn) {
  await db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const item = (n, v, p = "/", t = "navigate") => ({ n, v, p, t });
const record = (device, metrics) =>
  q("select record_web_vitals($1, $2::jsonb)", [
    device,
    typeof metrics === "string" ? metrics : JSON.stringify(metrics),
  ]).then(() => undefined);

/** Records every value of `values` for one metric (10 per beacon), as the server. */
async function recordAll(metric, values, { device = "mobile", path = "/" } = {}) {
  await asService(async () => {
    for (let at = 0; at < values.length; at += 10) {
      await record(
        device,
        values.slice(at, at + 10).map((value) => item(metric, value, path)),
      );
    }
  });
}

/** Rows of web_vitals_p75() for a staff member with members "v". */
const p75 = (days, byDay = false) =>
  as(id.permAdmin, () =>
    q(
      `select day::text, metric, device, samples::int, p75
       from web_vitals_p75($1, $2) order by day nulls first, metric, device`,
      [days, byDay],
    ),
  );

/** Exact nearest-rank 75th percentile. */
const exactP75 = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.75 * sorted.length) - 1];
};

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
      `${role}-vitals@atlasoftodaysworld.org`,
    ]);
    await q("update profiles set role_id = $2, kind = $3, status = 'active' where id = $1", [
      uid,
      role,
      kind,
    ]);
  }
});

test("web vitals: the table holds histograms only — no column for an IP, agent, account or URL", async () => {
  const columns = (
    await q(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'web_vitals_daily'
       order by ordinal_position`,
    )
  ).map((row) => row.column_name);
  assert.deepEqual(columns, [
    "day",
    "metric",
    "path_group",
    "device",
    "nav_type",
    "counts",
    "updated_at",
  ]);
});

test("web vitals: buckets are exact below 40 and at most 5 % wide above, up to 60000", async () => {
  const { bounds } = await one("select web_vital_bounds() as bounds");
  assert.equal(bounds.length, 195);
  assert.deepEqual(
    bounds.slice(0, 41),
    Array.from({ length: 41 }, (_, index) => index),
  );
  for (let index = 1; index < bounds.length - 1; index++) {
    assert.ok(bounds[index + 1] > bounds[index], "strictly increasing");
    if (bounds[index] >= 20) {
      assert.ok((bounds[index + 1] - bounds[index]) / bounds[index] <= 0.05, `${bounds[index]}`);
    }
  }
  assert.ok(bounds.at(-1) <= 60000 && bounds.at(-1) * 1.05 > 60000);
});

test("web vitals: the server records a beacon; repeats add up in one daily histogram", async () => {
  await q("delete from web_vitals_daily");
  await asService(async () => {
    await record("mobile", [
      item("LCP", 2400, "/topics"),
      item("CLS", 0, "/topics"),
      item("TTFB", 0, "/topics", "reload"),
    ]);
    await record("mobile", [item("LCP", 2410, "/topics")]);
    await record("desktop", [item("INP", 60000, "/country", "soft")]);
    await record("mobile", [item("FCP", 900, "/", "back-forward")]);
  });
  const rows = await q(
    `select metric, path_group, device, nav_type, cardinality(counts) as size,
            (select sum(c)::int from unnest(counts) c) as total,
            (select array_agg(i::int order by i) from unnest(counts) with ordinality u(c, i) where c > 0) as filled
     from web_vitals_daily order by metric, device, nav_type`,
  );
  const { bounds } = await one("select web_vital_bounds() as bounds");
  const bucketOf = (value) => bounds.filter((bound) => bound <= value).length;
  assert.deepEqual(
    rows.map((row) => ({ ...row })),
    [
      {
        metric: "CLS",
        path_group: "/topics",
        device: "mobile",
        nav_type: "navigate",
        size: 195,
        total: 1,
        filled: [1],
      },
      {
        metric: "FCP",
        path_group: "/",
        device: "mobile",
        nav_type: "back-forward",
        size: 195,
        total: 1,
        filled: [bucketOf(900)],
      },
      {
        metric: "INP",
        path_group: "/country",
        device: "desktop",
        nav_type: "soft",
        size: 195,
        total: 1,
        filled: [195],
      },
      // 2400 and 2410 share a bucket ([2378, 2496)).
      {
        metric: "LCP",
        path_group: "/topics",
        device: "mobile",
        nav_type: "navigate",
        size: 195,
        total: 2,
        filled: [bucketOf(2400)],
      },
      {
        metric: "TTFB",
        path_group: "/topics",
        device: "mobile",
        nav_type: "reload",
        size: 195,
        total: 1,
        filled: [1],
      },
    ],
  );
  assert.equal(bucketOf(2400), bucketOf(2410));
});

test("web vitals: a page outside the public sections is grouped as /other", async () => {
  await q("delete from web_vitals_daily");
  await asService(() =>
    record("desktop", [
      item("LCP", 1000, "/admin"),
      item("LCP", 1000, "/made-up"),
      item("LCP", 1000, "/GLOBAL-ISSUE"),
      item("LCP", 1000, "/global-issue"),
    ]),
  );
  const rows = await q(
    `select path_group, (select sum(c)::int from unnest(counts) c) as total
     from web_vitals_daily order by path_group`,
  );
  assert.deepEqual(
    rows.map((row) => `${row.path_group} ${row.total}`),
    ["/global-issue 2", "/other 2"],
  );
});

test("web vitals: unknown metrics, devices, navigation types and out-of-range values are refused", async () => {
  await q("delete from web_vitals_daily");
  await asService(async () => {
    await refused(record("tablet", [item("LCP", 100)]), /invalid_device/);
    await refused(record(null, [item("LCP", 100)]), /invalid_device/);
    await refused(record("mobile", []), /invalid_metrics/);
    await refused(
      record(
        "mobile",
        Array.from({ length: 11 }, () => item("LCP", 100)),
      ),
      /invalid_metrics/,
    );
    await refused(record("mobile", { n: "LCP", v: 100, p: "/", t: "navigate" }), /invalid_metrics/);
    await refused(record("mobile", ["LCP"]), /invalid_metrics/);
    await refused(record("mobile", [item("FID", 100)]), /invalid_metric/);
    await refused(record("mobile", [item("LCP", -1)]), /invalid_value/);
    await refused(record("mobile", [item("LCP", 12.5)]), /invalid_value/);
    await refused(record("mobile", [item("LCP", "100")]), /invalid_value/);
    await refused(record("mobile", [item("LCP", 60001)]), /invalid_value/);
    await refused(record("mobile", [item("CLS", 10001)]), /invalid_value/);
    await refused(record("mobile", [item("LCP", 100, "topics")]), /invalid_path/);
    await refused(record("mobile", [item("LCP", 100, `/${"a".repeat(64)}`)]), /invalid_path/);
    await refused(record("mobile", [item("LCP", 100, "/", "prerender")]), /invalid_nav/);
    // One bad item refuses the whole beacon.
    await refused(record("mobile", [item("LCP", 100), item("LCP", 70000)]), /invalid_value/);
  });
  assert.equal((await one("select count(*)::int as n from web_vitals_daily")).n, 0);
  // The bounds still hold for the largest allowed values.
  await asService(() => record("mobile", [item("LCP", 60000), item("CLS", 10000)]));

  // The CHECKs hold the same lists for anyone writing past the function.
  const insert = (metric, path, device, nav, counts = "{1}") =>
    q(
      `insert into web_vitals_daily (metric, path_group, device, nav_type, counts)
       values ($1, $2, $3, $4, $5)`,
      [metric, path, device, nav, counts],
    );
  await refused(insert("FID", "/", "mobile", "navigate"), /web_vitals_daily_metric_check/);
  await refused(
    insert("LCP", "/topics/x", "mobile", "navigate"),
    /web_vitals_daily_path_group_check/,
  );
  await refused(insert("LCP", "/", "1.2.3.4", "navigate"), /web_vitals_daily_device_check/);
  await refused(insert("LCP", "/", "mobile", "Mozilla/5.0"), /web_vitals_daily_nav_type_check/);
  await refused(
    insert("LCP", "/", "mobile", "navigate", "{1,-1}"),
    /web_vitals_daily_counts_check/,
  );
  await refused(
    insert("LCP", "/", "mobile", "navigate", "{1,NULL}"),
    /web_vitals_daily_counts_check/,
  );
});

test("web vitals: neither anon nor a signed-in account can record or write directly", async () => {
  await q("delete from web_vitals_daily");
  for (const user of [null, id.reader, id.editor, id.permAdmin, id.admin]) {
    await as(user, async () => {
      await refused(record("mobile", [item("LCP", 100)]), /permission denied/);
      await refused(
        q(`insert into web_vitals_daily (metric, path_group, device, nav_type, counts)
           values ('LCP', '/', 'mobile', 'navigate', '{1000}')`),
        /permission denied/,
      );
      await refused(q("update web_vitals_daily set counts = '{1}'"), /permission denied/);
      await refused(q("delete from web_vitals_daily"), /permission denied/);
    });
  }
  assert.equal((await one("select count(*)::int as n from web_vitals_daily")).n, 0);
});

test("web vitals: p75 of 1..100 is exactly 75; zeros stay zero", async () => {
  await q("delete from web_vitals_daily");
  await recordAll(
    "LCP",
    Array.from({ length: 100 }, (_, index) => index + 1),
  );
  await recordAll("CLS", [0, 0, 0, 1]);
  await recordAll("CLS", [0, 0, 0, 0, 0, 0, 0, 30, 90, 260], { device: "desktop" });
  assert.deepEqual(
    (await p75(7)).map((row) => ({ ...row })),
    [
      { day: null, metric: "CLS", device: "desktop", samples: 10, p75: 30 },
      { day: null, metric: "CLS", device: "mobile", samples: 4, p75: 0 },
      { day: null, metric: "LCP", device: "mobile", samples: 100, p75: 75 },
    ],
  );
});

test("web vitals: p75 from the histogram is within 5 % of the exact p75 of the raw values", async () => {
  // Deterministic, skewed like real timings (a long tail), across several pages and navigation types.
  let seed = 7;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const sample = (median, spread) =>
    Math.min(60000, Math.round(median * Math.exp(spread * (random() + random() + random() - 1.5))));
  const lcp = Array.from({ length: 600 }, () => sample(2300, 1.2));
  const inp = Array.from({ length: 400 }, () => sample(140, 1.6));
  const ttfb = Array.from({ length: 300 }, () => sample(450, 0.9));

  await q("delete from web_vitals_daily");
  await recordAll("LCP", lcp.slice(0, 300), { path: "/topics" });
  await recordAll("LCP", lcp.slice(300), { path: "/country" });
  await recordAll("INP", inp);
  await recordAll("TTFB", ttfb, { device: "desktop" });

  const got = Object.fromEntries(
    (await p75(28)).map((row) => [`${row.metric} ${row.device}`, row]),
  );
  for (const [key, values] of [
    ["LCP mobile", lcp],
    ["INP mobile", inp],
    ["TTFB desktop", ttfb],
  ]) {
    const exact = exactP75(values);
    assert.equal(got[key].samples, values.length, key);
    const error = Math.abs(got[key].p75 - exact) / exact;
    assert.ok(
      error < 0.05,
      `${key}: ${got[key].p75} vs exact ${exact} (${(error * 100).toFixed(1)} %)`,
    );
  }
});

test("web vitals: the window counts only its days; by day gives one p75 per day", async () => {
  await q("delete from web_vitals_daily");
  await recordAll("LCP", [1000, 1000, 1000, 1000]);
  await recordAll("INP", [100]);
  // Move a copy back in time: yesterday, 10 days ago (outside 7) and 40 days ago (outside 28).
  for (const [days, factor] of [
    [1, 2],
    [10, 3],
    [40, 4],
  ]) {
    await q(
      `insert into web_vitals_daily (day, metric, path_group, device, nav_type, counts)
       select current_date - $1::int, metric, path_group, device, nav_type,
              (select array_agg(c * $2::int order by i) from unnest(counts) with ordinality u(c, i))
       from web_vitals_daily where day = current_date and metric = 'LCP'`,
      [days, factor],
    );
  }
  const samples = (rows) => rows.filter((row) => row.metric === "LCP").map((row) => row.samples);
  assert.deepEqual(samples(await p75(1)), [4]);
  assert.deepEqual(samples(await p75(7)), [4 + 8]);
  assert.deepEqual(samples(await p75(28)), [4 + 8 + 12]);
  const daily = (await p75(28, true)).filter((row) => row.metric === "LCP");
  assert.equal(daily.length, 3);
  assert.deepEqual(
    daily.map((row) => row.samples),
    [12, 8, 4],
  );
  // Every day holds only 1000s: each p75 lies in their bucket, within 5 %.
  assert.ok(daily.every((row) => row.day !== null && Math.abs(row.p75 - 1000) / 1000 < 0.05));
  await as(id.permAdmin, async () => {
    await refused(q("select * from web_vitals_p75(0)"), /invalid_days/);
    await refused(q("select * from web_vitals_p75(401)"), /invalid_days/);
    await refused(q("select * from web_vitals_p75(null)"), /invalid_days/);
  });
});

test("web vitals: members 'v' and the admin read them; others see nothing", async () => {
  await q("delete from web_vitals_daily");
  await recordAll("LCP", [1200]);
  await as(null, async () => {
    await refused(q("select * from web_vitals_daily"), /permission denied/);
    await refused(q("select * from web_vitals_p75(7)"), /permission denied/);
  });
  for (const user of [id.reader, id.editor]) {
    assert.equal((await as(user, () => q("select * from web_vitals_daily"))).length, 0);
    await as(user, () => refused(q("select * from web_vitals_p75(7)"), /permission/));
  }
  for (const user of [id.permAdmin, id.admin]) {
    const rows = await as(user, () => q("select metric, device, nav_type from web_vitals_daily"));
    assert.deepEqual(
      rows.map((row) => ({ ...row })),
      [{ metric: "LCP", device: "mobile", nav_type: "navigate" }],
    );
    const percentiles = await as(user, () =>
      q("select metric, samples::int, p75 from web_vitals_p75(7)"),
    );
    assert.deepEqual(
      percentiles.map((row) => ({ metric: row.metric, samples: row.samples })),
      [{ metric: "LCP", samples: 1 }],
    );
    assert.ok(Math.abs(percentiles[0].p75 - 1200) / 1200 < 0.05, `${percentiles[0].p75}`);
  }
});

test("web vitals: the daily housekeeping drops histograms older than 400 days", async () => {
  await q("delete from web_vitals_daily");
  await q(
    `insert into web_vitals_daily (day, metric, path_group, device, nav_type, counts)
     values (current_date - 401, 'LCP', '/', 'mobile', 'navigate', '{1}'),
            (current_date - 400, 'LCP', '/', 'mobile', 'navigate', '{1}')`,
  );
  const result = await one("select public.db_housekeeping() as r");
  assert.equal(result.r.web_vitals, 1);
  assert.equal(
    (await one("select count(*)::int as n from web_vitals_daily")).n,
    1,
    "the 400-day-old row stays",
  );
});

test("web vitals: the privacy policy says performance is measured, once, next to the counter", async () => {
  const [page] = await q("select body_html from site_pages where slug = 'privacy'");
  assert.equal(page.body_html.split("we measure how quickly pages load").length - 1, 1);
  assert.ok(
    page.body_html.indexOf("We also count a few actions") <
      page.body_html.indexOf("we measure how quickly pages load"),
  );
  // Re-running the update changes nothing.
  const migration = readFileSync(join(migrations, "20261027000100_web_vitals.sql"), "utf8");
  await db.exec(migration.slice(migration.indexOf("update public.site_pages")));
  const [again] = await q("select body_html from site_pages where slug = 'privacy'");
  assert.equal(again.body_html, page.body_html);
});
