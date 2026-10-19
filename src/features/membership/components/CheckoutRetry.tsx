import Link from "@/components/i18n/Link";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { format, type Messages } from "@/lib/i18n/messages";
import { formatEuro } from "@/lib/format";
import { startCheckout } from "../actions";
import type { Donation } from "../links";
import { routes } from "@/config/routes";

/**
 * With Stripe on, people land on /membership/checkout only when the Stripe
 * Checkout page couldn't be opened (Stripe unreachable, or too many attempts
 * from one address). Says so and posts the same donation again.
 */
export function CheckoutRetry({
  donation,
  reason,
  locale,
  messages,
}: {
  donation: Donation;
  reason: "busy" | "failed";
  locale: Locale;
  messages: Messages;
}) {
  const t = messages.patrons.checkout;
  const amount = formatEuro(donation.amount, locale);
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-display text-[30px] leading-tight font-bold">{t.stripe.title}</h1>
      <p className="mt-4 text-[16px] text-[var(--color-ink-soft)]">
        {format(t.stripe.monthly, { amount })}
      </p>
      <p
        role="alert"
        className="mt-4 rounded-lg bg-[var(--color-warning-soft)] px-4 py-3 text-[14px] font-semibold text-[var(--color-warning)]"
      >
        {reason === "busy" ? t.stripe.busy : t.stripe.failed}
      </p>
      <form action={startCheckout} className="mt-8 flex flex-wrap gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="period" value={donation.period} />
        <input type="hidden" name="amount" value={donation.amount} />
        <Button type="submit" variant="patron">
          {t.stripe.retry}
        </Button>
        <Link href={routes.membership} className={buttonVariants({ variant: "outline" })}>
          {t.back}
        </Link>
      </form>
    </div>
  );
}
