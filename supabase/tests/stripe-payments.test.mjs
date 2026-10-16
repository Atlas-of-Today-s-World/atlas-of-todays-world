import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Stripe payments (migration 20261016000500_stripe_payments):
 *  - only the service key records webhook events and applies subscriptions;
 *    anon and accounts can't, and can't read the two server-only tables;
 *  - a subscription is matched to the account Checkout was opened with, else
 *    to a CONFIRMED account e-mail; otherwise it waits in pending_memberships;
 *  - claim_my_donations() moves the caller's pending donation (confirmed
 *    e-mail only) to their membership; an unconfirmed e-mail claims nothing;
 *  - a running paid membership is never replaced; an ended pending donation
 *    is deleted; patron_stats() counts pending patrons too;
 *  - the hand-written membership guard still refuses non-admins.
 *
 * Run: npm run test:db
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");
const db = new PGlite();

const id = {
  admin: "00000000-0000-4000-8000-000000005e01",
  ana: "00000000-0000-4000-8000-000000005e02",
  bob: "00000000-0000-4000-8000-000000005e03",
  eve: "00000000-0000-4000-8000-000000005e04",
  cyd: "00000000-0000-4000-8000-000000005e05",
};

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

async function refused(promise, pattern) {
  try {
    await promise;
  } catch (error) {
    if (pattern) assert.match(String(error.message), pattern);
    return error.message;
  }
  assert.fail("expected a refusal, but it went through");
}

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

async function asService(fn) {
  await db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const apply = (
  sub,
  {
    customer = `cus_${sub.slice(4)}`,
    email = "",
    user = null,
    status = "active",
    cents = 1000,
  } = {},
) =>
  asService(
    async () =>
      (
        await one(
          `select apply_stripe_subscription($1, $2, $3, $4, $5, $6, now(), now() + interval '1 month') as result`,
          [sub, customer, email, status, user, cents],
        )
      ).result,
  );

const membership = (user) =>
  one(
    "select plan, status, complimentary, stripe_subscription_id, monthly_amount_cents from memberships where user_id = $1",
    [user],
  );
const pending = () =>
  q(
    "select stripe_subscription_id, email, status from pending_memberships order by stripe_subscription_id",
  );

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
  for (const [uid, email, role, confirmed] of [
    [id.admin, "admin-pay@atlasoftodaysworld.org", "admin", true],
    [id.ana, "ana-pay@example.org", "reader", true],
    [id.bob, "bob-pay@example.org", "reader", true],
    [id.eve, "eve-pay@example.org", "reader", false],
    [id.cyd, "cyd-pay@example.org", "reader", true],
  ]) {
    await q("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)", [
      uid,
      email,
      confirmed ? new Date() : null,
    ]);
    await q("update profiles set role_id = $2 where id = $1", [uid, role]);
  }
});

test("only the service key records events and applies subscriptions", async () => {
  for (const user of [null, id.ana, id.admin]) {
    await as(user, () =>
      refused(
        q("select stripe_event_seen('evt_1', 'checkout.session.completed')"),
        /permission denied/,
      ),
    );
    await as(user, () =>
      refused(
        q("select apply_stripe_subscription('sub_x', 'cus_x', 'x@example.org', 'active')"),
        /permission denied/,
      ),
    );
    await as(user, () => refused(q("select * from pending_memberships"), /permission denied/));
    await as(user, () => refused(q("select * from stripe_events"), /permission denied/));
  }
  await as(null, () => refused(q("select claim_my_donations()"), /permission denied/));
});

test("a redelivered event is seen; a forgotten one is handled again", async () => {
  const seen = (eventId) =>
    asService(async () => (await one("select stripe_event_seen($1, 'x') as seen", [eventId])).seen);
  assert.equal(await seen("evt_dup"), false);
  assert.equal(await seen("evt_dup"), true);
  await asService(() => q("select stripe_event_forget('evt_dup')"));
  assert.equal(await seen("evt_dup"), false);
  await asService(() => refused(q("select stripe_event_seen('not-an-id', 'x')"), /check/));
});

test("a donor with a confirmed account becomes a patron; updates follow Stripe", async () => {
  assert.equal(await apply("sub_ana", { email: "ANA-pay@example.org" }), "member");
  assert.deepEqual(await membership(id.ana), {
    plan: "patron",
    status: "active",
    complimentary: false,
    stripe_subscription_id: "sub_ana",
    monthly_amount_cents: 1000,
  });
  assert.equal(
    await apply("sub_ana", { email: "ana-pay@example.org", status: "past_due", cents: 2500 }),
    "member",
  );
  assert.equal((await membership(id.ana)).status, "past_due");
  assert.equal((await membership(id.ana)).monthly_amount_cents, 2500);
  assert.equal(await apply("sub_ana", { status: "canceled" }), "member");
  assert.equal((await membership(id.ana)).status, "canceled");
});

test("the account Checkout was opened with wins over the e-mail", async () => {
  assert.equal(
    await apply("sub_bob", { email: "someone-else@example.org", user: id.bob }),
    "member",
  );
  assert.equal((await membership(id.bob)).stripe_subscription_id, "sub_bob");
});

test("a running paid membership is never replaced", async () => {
  // Nor is a Stripe customer that already belongs to another account moved.
  assert.equal(
    await apply("sub_cyd", { customer: "cus_bob", email: "cyd-pay@example.org" }),
    "pending",
  );
  assert.equal(await membership(id.cyd), undefined);
  assert.equal(await apply("sub_cyd", { customer: "cus_bob", status: "canceled" }), "removed");
  assert.equal(await apply("sub_bob2", { email: "bob-pay@example.org" }), "pending");
  assert.equal((await membership(id.bob)).stripe_subscription_id, "sub_bob");
  assert.equal(
    await apply("sub_bob2", { email: "bob-pay@example.org", status: "canceled" }),
    "removed",
  );
});

test("without a confirmed account the donation waits, and the confirmed owner claims it", async () => {
  assert.equal(await apply("sub_eve", { email: "eve-pay@example.org" }), "pending");
  assert.equal(await apply("sub_new", { email: "new-pay@example.org", cents: 500 }), "pending");
  assert.deepEqual(await pending(), [
    { stripe_subscription_id: "sub_eve", email: "eve-pay@example.org", status: "active" },
    { stripe_subscription_id: "sub_new", email: "new-pay@example.org", status: "active" },
  ]);

  // Eve's e-mail isn't confirmed: nothing moves.
  assert.equal(
    await as(id.eve, async () => (await one("select claim_my_donations() as ok")).ok),
    false,
  );
  assert.equal(await membership(id.eve), undefined);

  // Cyd has nothing pending.
  assert.equal(
    await as(id.cyd, async () => (await one("select claim_my_donations() as ok")).ok),
    false,
  );

  await q("update auth.users set email_confirmed_at = now() where id = $1", [id.eve]);
  assert.equal(
    await as(id.eve, async () => (await one("select claim_my_donations() as ok")).ok),
    true,
  );
  assert.equal((await membership(id.eve)).stripe_subscription_id, "sub_eve");
  assert.deepEqual(
    (await pending()).map((row) => row.stripe_subscription_id),
    ["sub_new"],
  );
  // Later webhooks update the claimed membership.
  assert.equal(await apply("sub_eve", { status: "past_due" }), "member");
  assert.equal((await membership(id.eve)).status, "past_due");
});

test("patron_stats counts pending patrons; an ended pending donation is deleted", async () => {
  const stats = () => as(null, () => one("select patrons, monthly_cents from patron_stats()"));
  const before = await stats();
  assert.equal(
    await apply("sub_new", { email: "new-pay@example.org", status: "canceled" }),
    "removed",
  );
  const after = await stats();
  assert.equal(after.patrons, before.patrons - 1);
  assert.equal(Number(after.monthly_cents), Number(before.monthly_cents) - 500);
  assert.deepEqual(await pending(), []);
});

test("the hand-written guard still refuses non-admins and paid rows", async () => {
  await as(id.cyd, () =>
    refused(
      q("insert into memberships (user_id, plan, complimentary) values ($1, 'patron', true)", [
        id.cyd,
      ]),
    ),
  );
  await as(id.admin, () =>
    refused(
      q(
        "insert into memberships (user_id, plan, complimentary, stripe_subscription_id) values ($1, 'patron', false, 'sub_fake')",
        [id.cyd],
      ),
      /payment provider/,
    ),
  );
  // RLS hides paid rows from the admin's delete: nothing goes.
  await as(id.admin, () => q("delete from memberships where user_id = $1", [id.ana]));
  assert.equal((await membership(id.ana)).stripe_subscription_id, "sub_ana");
});
