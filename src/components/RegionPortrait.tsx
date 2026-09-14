import Link from "next/link";
import type { Region } from "@/data/regions";
import type { Entry, RegionDossier } from "@/lib/content";
import EntryTabs from "./EntryTabs";
import { EntriesBadge, PrimaryButton, SectionLabel, TaglinePill } from "./atlas-ui";

/**
 * Plný portrét regionu (Figma: "Full view Desktop"), ale vykreslený uvnitř
 * mapového panelu, ne na samostatné stránce.
 */
export default function RegionPortrait({
  region,
  entries,
  dossier,
}: {
  region: Region;
  entries: Entry[];
  dossier: RegionDossier;
}) {
  return (
    <article>
      <div
        className="h-56 w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${region.hero})` }}
        role="img"
        aria-label={`${region.name} seen from orbit`}
      />

      <header className="px-6 pb-9 pt-7 text-center sm:px-10">
        <TaglinePill>{region.tagline}</TaglinePill>
        <h1 className="mt-4 font-display text-[32px] font-bold leading-tight text-[var(--color-ink)]">
          {region.name}
        </h1>
        <div className="mt-3">
          <EntriesBadge count={entries.length} />
        </div>
        <div className="mt-4">
          <PrimaryButton href="/support">Join us to help complete it!</PrimaryButton>
        </div>
        <p className="mx-auto mt-5 max-w-xl text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
          {region.summary}
        </p>
      </header>

      {dossier.timeline?.length ? (
        <section className="border-t border-[var(--color-line)] px-6 py-9 sm:px-10">
          <div className="text-center">
            <SectionLabel>Timeline</SectionLabel>
            <h2 className="mt-4 font-display text-[24px] font-bold text-[var(--color-ink)]">
              {dossier.timelineTitle ?? "Historical Context of the Region"}
            </h2>
            {dossier.timelineSubtitle ? (
              <p className="mx-auto mt-2 max-w-lg text-[12.5px] text-[var(--color-ink-muted)]">
                {dossier.timelineSubtitle}
              </p>
            ) : null}
          </div>

          <div className="panel-scroll -mx-1 mt-7 flex snap-x gap-6 overflow-x-auto px-1 pb-3">
            {dossier.timeline.map((item) => (
              <div key={item.title} className="w-60 shrink-0 snap-start">
                <h3 className="font-display text-[14px] font-bold leading-snug text-[var(--color-ink)]">
                  {item.title}
                </h3>
                <p className="mt-1 text-[11.5px] text-[var(--color-ink-muted)]">
                  {item.date}
                </p>
                <div className="my-3 flex items-center">
                  <span className="h-3 w-3 rounded-full bg-[var(--color-accent)]" />
                  <span className="h-px flex-1 bg-[var(--color-line)]" />
                </div>
                <p className="text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
            ↔ Drag to navigate the timeline
          </p>
        </section>
      ) : null}

      <EntryTabs
        entries={entries.map((entry) => ({
          slug: entry.slug,
          title: entry.title,
          summary: entry.summary,
          category: entry.category,
          hero: entry.hero,
        }))}
      />

      {dossier.visuals?.length ? (
        <section className="px-6 py-9 sm:px-10">
          <SectionLabel>Maps &amp; Charts</SectionLabel>
          <h2 className="mt-4 font-display text-[24px] font-bold text-[var(--color-ink)]">
            Visualising the Region
          </h2>
          <p className="mt-2 text-[12.5px] text-[var(--color-ink-muted)]">
            Preview of selected maps and charts from specialized organizations,
            which illustrate crucial aspects of the region.
          </p>
          <div className="panel-scroll -mx-1 mt-5 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {dossier.visuals.map((visual) => (
              <figure key={visual.title} className="w-[22rem] shrink-0 snap-start">
                <img
                  src={visual.image}
                  alt={visual.title}
                  className="h-48 w-full rounded-xl object-cover"
                />
                <figcaption className="mt-2 text-[11px] text-[var(--color-ink-muted)]">
                  {visual.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {dossier.resources?.length ? (
        <section className="bg-[var(--color-band)] px-6 py-9 text-white sm:px-10">
          <h2 className="font-display text-[22px] font-bold">
            Learn More from Other Resources
          </h2>
          <p className="mt-2 text-[12.5px] text-white/65">
            From documentaries to databases, these resources, selected by our team
            from across the web, will help you understand the region in full context.
          </p>
          <div className="panel-scroll -mx-1 mt-5 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {dossier.resources.map((resource) => (
              <div
                key={resource.url}
                className="w-52 shrink-0 snap-start overflow-hidden rounded-xl bg-white text-[var(--color-ink)]"
              >
                {resource.image ? (
                  <div
                    className="h-24 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${resource.image})` }}
                  />
                ) : null}
                <div className="p-3">
                  <h3 className="font-display text-[13px] font-bold leading-snug">
                    {resource.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                    {resource.source}
                  </p>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2.5 block rounded-full bg-[var(--color-accent)] py-1.5 text-center text-[12px] font-medium text-white transition hover:bg-[var(--color-accent-strong)]"
                  >
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {dossier.faq?.length ? (
        <section className="px-6 py-9 sm:px-10">
          <h2 className="font-display text-[24px] font-bold text-[var(--color-ink)]">
            Common Questions About the Region
          </h2>
          <div className="mt-5 space-y-2">
            {dossier.faq.map((item) => (
              <details
                key={item.question}
                className="group rounded-xl border border-[var(--color-line)] px-4 py-3"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-[var(--color-ink)]">
                  {item.question}
                  <span
                    aria-hidden
                    className="text-[var(--color-ink-muted)] transition group-open:rotate-180"
                  >
                    ⌄
                  </span>
                </summary>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-[var(--color-line)] px-6 py-10 text-center sm:px-10">
        <h2 className="font-display text-[26px] font-bold text-[var(--color-ink)]">
          Together We Can Build a New Encyclopedia
        </h2>
        <p className="mx-auto mt-2.5 max-w-lg text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
          By joining our membership community, you can support Atlas development
          and gradually secure its independent funding. And you can directly
          participate in the development.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "Help Us Build Atlas",
              text: "Help build the encyclopedia and power its long-term, independent future through a strong membership community.",
            },
            {
              title: "Participate on Its Development",
              text: "Create content. Build powerful partnerships. Drive global impact.",
            },
            {
              title: "Join Our Community",
              text: "Connect with our team, members, and future authors and partners.",
            },
          ].map((card, index) => (
            <div
              key={card.title}
              className="rounded-xl border border-[var(--color-line)] p-4 text-left"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-line)] text-[11px] text-[var(--color-ink-muted)]">
                {index + 1}
              </span>
              <h3 className="mt-2.5 font-display text-[14px] font-bold text-[var(--color-ink)]">
                {card.title}
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
                {card.text}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-7">
          <PrimaryButton href="/support">Donate &amp; Join</PrimaryButton>
        </div>
        <p className="mt-5 text-[11.5px] text-[var(--color-ink-muted)]">
          <Link href={`/region/${region.slug}`} className="hover:underline">
            ← Back to the compact region panel
          </Link>
        </p>
      </section>
    </article>
  );
}
