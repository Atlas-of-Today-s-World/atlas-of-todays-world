import Link from "next/link";
import type { Country } from "@/lib/countries";
import { formatPopulation } from "@/lib/countries";
import type { NewsItem } from "@/lib/content";
import { StatIcon } from "./atlas-ui";

/**
 * Karta země po kliknutí na globus (Figma: "Country View").
 *
 * Nahoře drobečková navigace do regionu, jméno, popis a ukazatele. Region není
 * jen textový odkaz kdesi dole – dostal vlastní kartu s obrázkem a tlačítkem,
 * protože z profilu země je to nejčastější cesta dál.
 */
/** Jak se status pojmenuje v profilu země. */
const TERRITORY_STATUS_LABEL: Record<string, string> = {
  disputed: "Disputed territory.",
  "non-self-governing": "UN Non-Self-Governing Territory.",
  occupied: "Territory under foreign administration.",
};

export default function CountryCard({
  country,
  newsItems,
  description,
}: {
  country: Country;
  newsItems: NewsItem[];
  description: string;
}) {
  const region = country.region;
  const highlights = country.stats.slice(0, 6);

  return (
    <article className="px-6 pb-10 pt-6">
      {region ? (
        <nav aria-label="Breadcrumb" className="text-[12px] text-[var(--color-ink-muted)]">
          <Link
            href={`/region/${region.slug}`}
            className="font-medium text-[var(--color-link)] hover:underline"
          >
            {region.name}
          </Link>
          <span aria-hidden className="px-1.5">
            ›
          </span>
          <span className="text-[var(--color-ink)]">{country.name}</span>
        </nav>
      ) : null}

      <h1 className="mt-2 font-display text-[26px] font-bold leading-tight text-[var(--color-ink)]">
        {country.name}
      </h1>

      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
        {description}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6">
        {highlights.map((stat) => (
          <div key={stat.id}>
            <div className="flex items-center gap-2 text-[var(--color-ink)]">
              <StatIcon id={stat.id} />
              <span className="font-display text-[22px] font-semibold leading-none">
                {stat.value}
              </span>
            </div>
            <dt className="mt-1.5 text-[13px] font-medium leading-snug text-[var(--color-ink)]">
              {stat.label}
            </dt>
            <dd className="mt-1 text-[11px] leading-snug text-[var(--color-ink-muted)]">
              {stat.rank ? `Ranked ${stat.rank} of ${stat.rankOf} · ` : ""}
              {stat.year}
              <br />
              <a
                href={stat.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-link)] hover:underline"
              >
                {stat.source}
              </a>
            </dd>
          </div>
        ))}
      </dl>

      {region ? (
        <Link
          href={`/region/${region.slug}`}
          className="group mt-7 block overflow-hidden rounded-xl border border-[var(--color-line)] transition hover:border-[var(--color-accent)]"
        >
          <span
            className="block h-28 w-full bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(10,16,32,0.15), rgba(10,16,32,0.55)), url(${region.hero})`,
            }}
            role="img"
            aria-label={`${region.name} seen from orbit`}
          />
          <span className="block p-4">
            <span className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
              Region
            </span>
            <span className="mt-1 block font-display text-[16px] font-bold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
              {region.name}
            </span>
            <span className="mt-1.5 block text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
              {region.summary.split(". ")[0]}.
            </span>
            <span className="mt-3 inline-flex min-h-11 items-center text-[12.5px] font-medium text-[var(--color-link)]">
              Explore the region →
            </span>
          </span>
        </Link>
      ) : null}

      <div className="mt-7 grid grid-cols-2 gap-4 border-t border-[var(--color-line)] pt-5 text-[12.5px]">
        <div>
          <span className="block text-[var(--color-ink-muted)]">Population</span>
          <span className="font-medium text-[var(--color-ink)]">
            {formatPopulation(country.population)}
          </span>
        </div>
        <div>
          <span className="block text-[var(--color-ink-muted)]">Subregion</span>
          <span className="font-medium text-[var(--color-ink)]">
            {country.unSubregion ?? "—"}
            {region ? (
              <>
                {" · "}
                <Link
                  href={`/region/${region.slug}`}
                  className="font-normal text-[var(--color-link)] hover:underline"
                >
                  {region.name}
                </Link>
              </>
            ) : null}
          </span>
        </div>
      </div>

      {country.territoryNote ? (
        // Atlas kreslí hranice podle praxe OSN. Kde se to liší od faktické
        // kontroly, musí u profilu stát proč a podle čeho – jinak to čtenář
        // čte jako tvrzení Atlasu.
        <p className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft,#f6f7fb)] px-4 py-3 text-[12px] leading-relaxed text-[var(--color-ink-soft)]">
          <span className="font-medium text-[var(--color-ink)]">
            {TERRITORY_STATUS_LABEL[country.territoryNote.status]}
          </span>{" "}
          {country.territoryNote.note}{" "}
          <span className="text-[var(--color-ink-muted)]">
            ({country.territoryNote.basis})
          </span>
        </p>
      ) : null}

      {newsItems.length ? (
        <div className="mt-7">
          <h2 className="font-display text-[15px] font-bold text-[var(--color-ink)]">
            News about {country.name}
          </h2>
          <ul className="mt-3 space-y-2">
            {newsItems.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/news/${item.slug}`}
                  className="group block rounded-xl border border-[var(--color-line)] p-3 transition hover:border-[var(--color-accent)]"
                >
                  <span className="text-[10.5px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                    {item.category}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-[var(--color-ink-muted)]">
                    {item.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
