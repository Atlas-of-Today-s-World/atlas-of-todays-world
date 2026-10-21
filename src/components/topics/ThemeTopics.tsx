import { PhotoTile } from "@/components/atlas/PhotoTile";
import { Rail } from "@/components/atlas/Rail";
import { PortraitSection } from "@/components/portrait/sections";
import { TopicsLink } from "@/components/topics/RelatedTopics";
import { TopicsInvite } from "@/components/topics/TopicsInvite";
import type { EntrySummary, PlannedTopic } from "@/features/entries/types";
import { ENTRY_CATEGORIES, categoryLabel, entryCategory } from "@/lib/content-types";
import { getT } from "@/lib/i18n/request";
import { routes } from "@/config/routes";

/** Id of the section's heading, which names it as a landmark. */
const HEADING_ID = "theme-topics";

/**
 * A place's topics in the four themes, each a horizontal row of photo tiles
 * (owner's request of 2026-10-16, from the call with the Atlas team; the rows
 * first came in #117 and were lost when the portrait was slimmed down). The
 * same block on a country, a region and a global issue — preview and full
 * page — in the slot the admin's Portrait layout gives it.
 *
 * All four rows are drawn even when one is empty: the reader sees what the
 * Atlas covers and what is still in preparation. A planned topic (admin:
 * "Planned entry only") follows the written ones in its row as a greyed tile
 * with its title and no link. With no topic at all there
 * is nothing to sort, so under the heading only the invitation to write or
 * support the first. The section is a named landmark ("Subtopics").
 */
export async function ThemeTopics({
  items,
  planned,
  href,
  place,
}: {
  items: EntrySummary[];
  /** Planned topics of the place: greyed tiles after the written ones. */
  planned: PlannedTopic[];
  /** The Topics list filtered to this place. */
  href: string;
  /** Name of the place, for the invitation. */
  place: string;
}) {
  const t = await getT();
  if (!items.length && !planned.length) {
    return (
      <PortraitSection title={t.article.chapters} headingId={HEADING_ID}>
        <div className="mt-4">
          <TopicsInvite t={t.topics} place={place} full />
        </div>
      </PortraitSection>
    );
  }
  return (
    <PortraitSection title={t.article.chapters} headingId={HEADING_ID}>
      {ENTRY_CATEGORIES.map((category) => {
        const label = categoryLabel(category, t);
        const group = items.filter((item) => entryCategory(item.category) === category);
        const upcoming = planned.filter((topic) => entryCategory(topic.category) === category);
        return (
          <div key={category} className="mt-5">
            <h3 className="text-[11px] font-medium tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
              {label}
            </h3>
            {group.length || upcoming.length ? (
              <Rail label={label} gap="sm" className="mt-2.5">
                {group.map((item) => (
                  <div key={item.slug} className="w-48 shrink-0 snap-start">
                    <PhotoTile
                      href={routes.entry(item.slug)}
                      className="min-h-32"
                      image={item.hero}
                      title={item.title}
                    />
                  </div>
                ))}
                {upcoming.map((topic) => (
                  <div key={topic.title} className="w-48 shrink-0 snap-start">
                    <PhotoTile
                      disabled
                      className="min-h-32"
                      kicker={t.portrait.inPreparation}
                      title={topic.title}
                    />
                  </div>
                ))}
              </Rail>
            ) : (
              <p className="mt-2.5 text-[12px] text-[var(--color-ink-muted)]">
                {t.portrait.inPreparation}
              </p>
            )}
          </div>
        );
      })}
      {items.length ? <TopicsLink count={items.length} href={href} className="mt-6" /> : null}
      <TopicsInvite t={t.topics} place={place} className="mt-3" />
    </PortraitSection>
  );
}
