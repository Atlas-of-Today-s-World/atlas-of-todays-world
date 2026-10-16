"use server";

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n/config";
import { formObject } from "@/lib/actions";
import { allowRequest } from "@/lib/security/rate-limit";
import { stripeEnabled } from "@/lib/stripe";
import { currentUser } from "@/lib/supabase/server";
import { checkoutHref } from "./links";
import { getPatronSettings } from "./queries";
import { donationFromForm } from "./schema";
import { createCheckoutUrl } from "./stripe";
import { routes } from "@/config/routes";

/** Checkout pages one address may open (each one is a Stripe API call). */
const CHECKOUT_LIMIT = { limit: 10, windowSeconds: 600 };

/**
 * "Donate & Join" on the donation card. The amount is checked against the
 * current settings (patron_settings) — the same ones the card was drawn from —
 * so an amount no longer offered goes back to the membership page.
 *
 * With Stripe configured (lib/stripe.ts) it opens a hosted Stripe Checkout
 * page; a signed-in reader's account is passed along so the membership lands
 * on it. Without Stripe it goes to the demo checkout (/membership/checkout),
 * where no payment is taken. Anyone can post here, so it is rate-limited
 * before Stripe is called; when Stripe can't be reached (or the limit is hit)
 * the checkout page explains it and offers to try again.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  const input = formObject(formData);
  const locale =
    typeof input.locale === "string" && isLocale(input.locale) ? input.locale : DEFAULT_LOCALE;
  const { donation: options } = await getPatronSettings();
  const donation = donationFromForm(input, options);
  if (!donation) redirect(localePath(locale, routes.membership));
  if (!stripeEnabled()) redirect(localePath(locale, checkoutHref(donation)));

  if (!(await allowRequest("checkout", await headers(), CHECKOUT_LIMIT))) {
    redirect(localePath(locale, `${checkoutHref(donation)}&error=busy`));
  }
  const user = await currentUser();
  let url: string;
  try {
    url = await createCheckoutUrl(
      donation,
      locale,
      user ? { id: user.id, email: user.email } : null,
    );
  } catch (error) {
    console.error("[checkout]", error instanceof Error ? error.message : "failed");
    redirect(localePath(locale, `${checkoutHref(donation)}&error=failed`));
  }
  redirect(url);
}
