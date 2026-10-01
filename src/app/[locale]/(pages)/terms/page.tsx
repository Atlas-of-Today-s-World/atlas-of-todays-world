import { EnglishOnly } from "@/components/i18n/EnglishOnly";
import { localeFrom } from "@/features/i18n/request";
import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { ContactLink } from "@/components/atlas/ContactLink";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using Atlas of Today's World.",
};

/** Podmínky použití (F5). */
export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  return (
    <EnglishOnly locale={locale}>
      <main className="prose-atlas max-w-2xl">
        <h1 className="font-display text-[34px] font-bold text-[var(--color-ink)]">Terms of use</h1>
        <p className="text-[13px] text-[var(--color-ink-muted)]">Last updated 30 September 2026</p>

        <h2>Using the Atlas</h2>
        <p>
          You may read, link to and quote the Atlas freely. Please credit &ldquo;Atlas of
          Today&rsquo;s World&rdquo; with a link to the page you quote.
        </p>

        <h2>Data and sources</h2>
        <p>
          The data layers come from third parties such as Our World in Data, each under its own
          licence, which is named next to every figure. Country borders follow Natural Earth and the
          practice of the United Nations; they are not a statement on any territorial dispute.
        </p>

        <h2>Accuracy</h2>
        <p>
          We check our texts and cite our sources, but the Atlas is a work in progress. It is
          general information, not professional advice. If you find a mistake, tell us:{" "}
          <ContactLink />.
        </p>

        <h2>Accounts</h2>
        <p>
          Keep your sign-in to yourself. We may suspend accounts that are used to abuse the site.
          How we handle your data is described in the <Link href="/privacy">privacy policy</Link>.
        </p>
      </main>
    </EnglishOnly>
  );
}
