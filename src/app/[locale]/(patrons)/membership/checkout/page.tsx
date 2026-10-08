import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { localePath } from "@/features/i18n/config";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { DemoCheckout } from "@/features/membership/components/DemoCheckout";
import { MEMBERSHIP_PATH } from "@/features/membership/config";
import { parseDonation } from "@/features/membership/schema";

// Rendered per request: the proxy sends it a nonce CSP (ADR-025), which a static page couldn't carry.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getMessages(await localeFrom(params)).patrons.checkout;
  return { title: t.title, robots: { index: false, follow: false } };
}

/** DEMO checkout (no payment). Invalid amount or period → back to /membership. */
export default async function CheckoutPage({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const donation = parseDonation(await searchParams);
  if (!donation) redirect(localePath(locale, MEMBERSHIP_PATH));
  return (
    <main>
      <DemoCheckout donation={donation} />
    </main>
  );
}
