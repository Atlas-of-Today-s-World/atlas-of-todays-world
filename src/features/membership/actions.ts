"use server";

import "server-only";
import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/features/i18n/config";
import { formObject } from "@/lib/actions";
import { checkoutHref, donationFromForm } from "./schema";
import { routes } from "@/config/routes";

/**
 * "Donate & Join" on the donation card.
 *
 * DEMO: redirects to the imitation checkout (/membership/checkout), where no
 * payment is taken. Switching to real Stripe Checkout (ADR G6) means replacing
 * only the last line of this action: create a Checkout Session for `donation`
 * (mode "subscription" for monthly, "payment" for one-time, success_url =
 * thankYouHref(donation)) and `redirect(session.url)`. The demo checkout page
 * and demo-card.ts are then deleted; the card and the page stay as they are.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  const input = formObject(formData);
  const locale =
    typeof input.locale === "string" && isLocale(input.locale) ? input.locale : DEFAULT_LOCALE;
  const donation = donationFromForm(input);
  if (!donation) redirect(localePath(locale, routes.membership));
  redirect(localePath(locale, checkoutHref(donation)));
}
