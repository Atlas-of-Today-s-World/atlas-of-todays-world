import type { Metadata } from "next";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { alternates } from "@/lib/seo";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).patrons;
  return {
    title: t.title,
    description: t.description,
    alternates: alternates("/patrons", locale),
  };
}

export default async function SupportPage({ params }: Params) {
  const t = getMessages(await localeFrom(params)).patrons;
  const cards = [
    { title: t.card1Title, text: t.card1Text },
    { title: t.card2Title, text: t.card2Text },
    { title: t.card3Title, text: t.card3Text },
  ];

  return (
    <main className="max-w-2xl">
      <h1 className="font-display text-[34px] font-bold">{t.heading}</h1>
      <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">{t.intro}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {cards.map((card, index) => (
          <div key={card.title} className="rounded-xl border border-[var(--color-line)] p-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] text-[12px] text-[var(--color-ink-muted)]">
              {index + 1}
            </span>
            <h2 className="font-display mt-3 text-[15px] font-bold">{card.title}</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
              {card.text}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-[12.5px] text-[var(--color-ink-muted)]">{t.paymentsSoon}</p>
    </main>
  );
}
