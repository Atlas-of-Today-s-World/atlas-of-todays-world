#!/usr/bin/env node
/**
 * One-off: monthly donations started on the old Webflow site become
 * memberships (ADR G6). Their Stripe subscriptions carry no `atlas=patron`
 * metadata, so the webhook knows them only by their donation product
 * (STRIPE_LEGACY_PRODUCT_IDS, features/membership/subscription.ts) — and only
 * from their next change on. This script brings the running ones in now,
 * through the same apply_stripe_subscription() the webhook calls.
 *
 *   node scripts/stripe-legacy-patrons.mjs [--products prod_a,prod_b]
 *        [--apply --project dev] [--sql import.sql --live] [--env .env.local]
 *
 * Reads the active and past_due subscriptions (STRIPE_SECRET_KEY from the
 * environment or --env; Subscriptions + Customers read are enough) and
 * reports counts and sums only: per product, and for the selected legacy
 * products (--products, else STRIPE_LEGACY_PRODUCT_IDS). Never an e-mail,
 * a customer or a subscription id.
 *
 * Without --apply or --sql it is a DRY RUN. --apply writes through the
 * service key of --project (test Stripe keys only, so real donors never land
 * in atlas-dev). --sql writes the calls to a file (mode 600, it holds
 * e-mails) for psql on production (.github/workflows/stripe-legacy-patrons.yml);
 * a live key needs --live. Running it again is harmless: each call sets a
 * subscription to its current state.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Stripe from "stripe";
import {
  ATLAS_PATRON,
  accountId,
  isPatronSubscription,
  membershipStatus,
  monthlyCents,
  periodEnd,
  productIds,
  refId,
  startedAt,
} from "../src/features/membership/subscription.ts";

const PROJECTS = { dev: "bognwszwhxxyjafqzfuh", prod: "ewbzkxialhtwuqlenjof" };
const STATUSES = ["active", "past_due"];

const { values: args } = parseArgs({
  options: {
    products: { type: "string" },
    apply: { type: "boolean", default: false },
    project: { type: "string" },
    sql: { type: "string" },
    live: { type: "boolean", default: false },
    env: { type: "string", default: ".env.local" },
  },
});

function readEnvFile(path) {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  return Object.fromEntries(
    text.split("\n").flatMap((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      return match ? [[match[1], match[2].trim().replace(/^"(.*)"$/, "$1")]] : [];
    }),
  );
}

const refuse = (message) => {
  console.error(`Refused: ${message}`);
  process.exit(2);
};

const env = { ...readEnvFile(args.env), ...process.env };
const key = env.STRIPE_SECRET_KEY ?? "";
const live = /^(sk|rk)_live_/.test(key);
if (!/^(sk|rk)_(test|live)_\w{10,}$/.test(key)) refuse("STRIPE_SECRET_KEY is missing.");
if (live && !args.live) refuse("a live Stripe key needs --live (production runs in CI).");
if (args.apply && args.sql) refuse("choose one: --apply or --sql.");
if (args.apply && live) refuse("--apply takes test keys only; production uses --sql.");

const legacy = productIds(args.products ?? env.STRIPE_LEGACY_PRODUCT_IDS);
const writing = args.apply || Boolean(args.sql);
if (writing && legacy.size === 0)
  refuse("no legacy products (--products or STRIPE_LEGACY_PRODUCT_IDS).");

/** The service-key client of --project (refuses a mismatch with the Supabase URL). */
async function db() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const expected = PROJECTS[args.project];
  if (!expected || !url.includes(`${expected}.supabase.co`)) {
    refuse(`--project ${args.project ?? "(missing)"} doesn't match the Supabase URL.`);
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) refuse("SUPABASE_SERVICE_ROLE_KEY is missing.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
// A refused --apply fails before reading Stripe.
const supabase = args.apply ? await db() : null;

const stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 });
const subscriptions = [];
for (const status of STATUSES) {
  // The customer (for the e-mail) only when it will be written.
  const list = stripe.subscriptions.list({
    status,
    limit: 100,
    ...(writing ? { expand: ["data.customer"] } : {}),
  });
  for await (const subscription of list) subscriptions.push(subscription);
}

const euros = (cents) => `€${(cents / 100).toFixed(2)}`;
const productsOf = (subscription) =>
  [...new Set(subscription.items.data.map((item) => refId(item.price.product) ?? "?"))]
    .sort()
    .join("+");

/** Counts and sums of a list of subscriptions; no ids, no e-mails. */
function tally(list) {
  const out = { active: 0, past_due: 0, activeCents: 0, amounts: new Set() };
  for (const subscription of list) {
    const cents = monthlyCents(subscription) ?? 0;
    out[subscription.status] += 1;
    if (subscription.status === "active") out.activeCents += cents;
    out.amounts.add(euros(cents));
  }
  return out;
}
const line = (t) =>
  `active ${t.active} (${euros(t.activeCents)}/month), past_due ${t.past_due}; amounts ${[...t.amounts].sort().join(", ")}`;

const tagged = subscriptions.filter((s) => s.metadata?.atlas === ATLAS_PATRON.atlas);
const others = subscriptions.filter((s) => s.metadata?.atlas !== ATLAS_PATRON.atlas);
console.log(
  `Stripe ${live ? "LIVE" : "test"} mode — active + past_due subscriptions: ${subscriptions.length}`,
);
console.log(`  created by this site (atlas=patron): ${tagged.length}`);
console.log(`  without Atlas metadata: ${others.length}, by product:`);
const byProduct = Map.groupBy(others, productsOf);
for (const [products, list] of [...byProduct].sort((a, b) => b[1].length - a[1].length)) {
  const mark = products.split("+").some((id) => legacy.has(id)) ? "*" : " ";
  console.log(`  ${mark} ${products}: ${list.length} — ${line(tally(list))}`);
}

const selected = others.filter((s) => isPatronSubscription(s, legacy));
console.log(`\nLegacy products selected (*): ${legacy.size ? [...legacy].join(", ") : "none"}`);
if (selected.length) {
  const perCustomer = Map.groupBy(selected, (s) => refId(s.customer));
  const repeat = [...perCustomer.values()].filter((list) => list.length > 1).length;
  console.log(`  ${selected.length} subscriptions — ${line(tally(selected))}`);
  console.log(`  donors: ${perCustomer.size}, of whom ${repeat} with more than one`);
}
if (!writing) {
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

/** The webhook's arguments for apply_stripe_subscription (features/membership/stripe.ts). */
const calls = [];
let withoutEmail = 0;
for (const subscription of selected) {
  const customer = subscription.customer;
  const email = typeof customer === "object" && !customer.deleted ? (customer.email ?? "") : "";
  if (!email) {
    withoutEmail += 1;
    continue;
  }
  calls.push({
    p_subscription: subscription.id,
    p_customer: refId(customer) ?? "",
    p_email: email,
    p_user: accountId(subscription),
    p_status: membershipStatus(subscription.status),
    p_monthly_cents: monthlyCents(subscription),
    p_started_at: startedAt(subscription),
    p_period_end: periodEnd(subscription),
  });
}
if (withoutEmail) console.log(`  ${withoutEmail} without a customer e-mail: skipped`);

if (args.sql) {
  const literal = (value) =>
    value === null || value === undefined
      ? "null"
      : typeof value === "number"
        ? String(Math.trunc(value))
        : `'${String(value).replaceAll("'", "''")}'`;
  const statements = calls.map(
    (call) =>
      `insert into legacy_import select public.apply_stripe_subscription(${Object.entries(call)
        .map(([name, value]) => `${name} => ${literal(value)}`)
        .join(", ")});`,
  );
  writeFileSync(
    args.sql,
    [
      "begin;",
      "create temp table legacy_import (outcome text) on commit drop;",
      ...statements,
      "select 'outcome ' || outcome || ': ' || count(*) from legacy_import group by outcome order by outcome;",
      "select 'patron_stats: ' || patrons || ' patrons, ' || monthly_cents || ' cents/month' from public.patron_stats();",
      "commit;",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  console.log(`\n${calls.length} calls written to ${args.sql}.`);
  process.exit(0);
}

const outcomes = {};
for (const call of calls) {
  const { data, error } = await supabase.rpc("apply_stripe_subscription", call);
  // The message only: a DB error may quote the arguments.
  if (error) throw new Error(`apply_stripe_subscription failed (${error.code ?? "?"})`);
  outcomes[data] = (outcomes[data] ?? 0) + 1;
}
const { data: stats, error } = await supabase.rpc("patron_stats");
if (error) throw new Error(`patron_stats failed (${error.code ?? "?"})`);
console.log(`\nApplied to ${args.project}:`, outcomes);
console.log("patron_stats:", stats?.[0] ?? stats);
