import "server-only";
import { z } from "zod";

/** Secret environment variables — server only (ARCHITEKTURA 3.4). */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const schema = z.object({
  MAILCHIMP_API_KEY: optional(z.string().regex(/-us\d+$/, "Mailchimp klíč končí na -usNN")),
  MAILCHIMP_LIST_ID: optional(z.string().min(4)),
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(20)),
  // Key for the hashed IP/e-mail rate-limit keys (lib/security/rate-limit.ts).
  // Empty = the previous derivation; setting it starts fresh rate-limit windows once.
  RATE_LIMIT_SECRET: optional(z.string().min(32, "RATE_LIMIT_SECRET: at least 32 characters")),
  // Cloudflare Turnstile secret for the public forms (lib/security/turnstile.ts). Together
  // with NEXT_PUBLIC_TURNSTILE_SITE_KEY it turns the check on; empty = forms as before.
  // Deliberately lenient: a wrong value must not stop the app from starting (siteverify
  // reports it and the forms stay open).
  TURNSTILE_SECRET_KEY: optional(z.string().min(1)),
  // Stripe (ADR G6, lib/stripe.ts): with both set, "Donate & Join" opens Stripe Checkout
  // and /api/stripe/webhook writes memberships; without them the demo checkout stays.
  // Test (sk_test_) or live (sk_live_) keys, or a restricted key (rk_).
  STRIPE_SECRET_KEY: optional(
    z
      .string()
      .regex(/^(sk|rk)_(test|live)_\w{10,}$/, "Stripe klíč začíná sk_test_, sk_live_ nebo rk_"),
  ),
  STRIPE_WEBHOOK_SECRET: optional(
    z.string().regex(/^whsec_\w{10,}$/, "Podpisový klíč webhooku začíná whsec_"),
  ),
  // IndexNow (ADR-021): public by design (served at /indexnow-key.txt); empty = pings off.
  // Search console ownership tokens (public, rendered as <meta>); empty = verify by DNS instead.
  GOOGLE_SITE_VERIFICATION: optional(z.string().regex(/^[\w-]{10,100}$/)),
  BING_SITE_VERIFICATION: optional(z.string().regex(/^[\w-]{10,100}$/)),
  SEZNAM_SITE_VERIFICATION: optional(z.string().regex(/^[\w-]{10,100}$/)),
  INDEXNOW_KEY: optional(
    z.string().regex(/^[a-zA-Z0-9-]{8,128}$/, "IndexNow klíč: 8–128 znaků a-z, 0-9, -"),
  ),
});

export const serverEnv = schema.parse(process.env);
