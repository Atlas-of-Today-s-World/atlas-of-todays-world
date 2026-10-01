import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import { BrandLogo } from "@/components/atlas/BrandLogo";
import Link from "@/components/i18n/Link";
import { buttonVariants } from "@/components/ui/button";
import { format, getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { MEMBERSHIP_PATH } from "@/features/membership/config";
import { parseDonation } from "@/features/membership/schema";
import { formatEuro } from "@/lib/format";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getMessages(await localeFrom(params)).patrons.thankYou;
  return { title: t.title, robots: { index: false, follow: false } };
}

/** After the (demo) payment. The amount line is shown only for a valid donation. */
export default async function ThankYouPage({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const messages = getMessages(locale);
  const t = messages.patrons.thankYou;
  const donation = parseDonation(await searchParams);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <BrandLogo className="h-5" />
      <CircleCheck aria-hidden size={44} className="mt-10 text-[var(--color-success)]" />
      <h1 className="font-display mt-4 text-[34px] leading-tight font-bold">{t.heading}</h1>
      {donation ? (
        <p className="mt-4 text-[17px] text-[var(--color-ink-soft)]">
          {format(donation.period === "monthly" ? t.leadMonthly : t.leadOneTime, {
            amount: formatEuro(donation.amount, locale),
          })}
        </p>
      ) : null}
      <p className="mt-2 text-[14px] font-semibold text-[var(--color-warning)]">{t.demoNote}</p>

      <h2 className="font-display mt-10 text-[20px] font-bold">{t.nextTitle}</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
        {t.next.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/" className={buttonVariants({ variant: "patron" })}>
          {t.backToAtlas}
        </Link>
        <Link href={MEMBERSHIP_PATH} className={buttonVariants({ variant: "outline" })}>
          {messages.patrons.checkout.back}
        </Link>
      </div>
    </main>
  );
}
