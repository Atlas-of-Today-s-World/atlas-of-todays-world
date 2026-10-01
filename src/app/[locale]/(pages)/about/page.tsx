import type { Metadata } from "next";
import { getAtlas } from "@/features/geography/queries";
import { getMessages } from "@/features/i18n/messages";
import { localeFrom } from "@/features/i18n/request";
import { alternates } from "@/lib/seo";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = getMessages(locale).about;
  return { title: t.title, description: t.description, alternates: alternates("/about", locale) };
}

export default async function AboutPage({ params }: Params) {
  const locale = await localeFrom(params);
  const t = getMessages(locale).about;
  const { indicators } = await getAtlas(locale);
  return (
    <main className="prose-atlas max-w-2xl">
      <h1 className="font-display text-[34px] font-bold text-[var(--color-ink)]">{t.title}</h1>
      <p className="mt-4">{t.intro}</p>

      <h2>{t.dataTitle}</h2>
      <p>{t.dataText}</p>
      <ul>
        {indicators.map((indicator) => (
          <li key={indicator.id}>
            <strong>{indicator.label}</strong> &mdash; {indicator.source} ({indicator.latestYear})
          </li>
        ))}
      </ul>

      <h2>{t.editorialTitle}</h2>
      <p>{t.editorialText}</p>
    </main>
  );
}
