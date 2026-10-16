import { PhotoTile } from "@/components/atlas/PhotoTile";
import { NoTopicsCta } from "@/components/topics/NoTopicsCta";
import { TopicsInvite } from "@/components/topics/TopicsInvite";
import { TopicsLink } from "@/components/topics/RelatedTopics";
import type { EntrySummary } from "@/features/entries/types";
import { getT } from "@/lib/i18n/request";
import { cn } from "@/lib/cn";
import { routes } from "@/config/routes";
import { DOSSIER_GAP, DOSSIER_HEADING, SUBTOPIC_GRID, SUBTOPIC_HEIGHT } from "./dossier-tiles";

/** Id of the section heading (also a link target, `#subtopics`). */
const HEADING_ID = "subtopics";

/**
 * "Subtopics" of a place on its full-width page (a global issue): the topics
 * written about it as the same photo tiles a topic shows for its own
 * subtopics, each leading to the topic. More than fit go through "See all N
 * topics" to the filtered Topics list; with none yet, the loud invitation to
 * write the first one (NoTopicsCta), otherwise the quiet one-line invite.
 */
export async function SubtopicTiles({
  items,
  href,
  place,
  limit = 8,
  className,
}: {
  items: EntrySummary[];
  /** The Topics list filtered to this place. */
  href: string;
  /** Name of the place, for the invitations. */
  place: string;
  /** Tiles shown at most (two rows of four on wide screens). */
  limit?: number;
  className?: string;
}) {
  const messages = await getT();
  return (
    <section aria-labelledby={HEADING_ID} className={cn("mt-12 scroll-mt-24", className)}>
      <h2 id={HEADING_ID} className={DOSSIER_HEADING}>
        {messages.article.chapters}
      </h2>
      {items.length ? (
        <>
          <ul className={cn(SUBTOPIC_GRID, DOSSIER_GAP, "lg:grid-cols-4")}>
            {items.slice(0, limit).map((item) => (
              <li key={item.slug}>
                <PhotoTile
                  href={routes.topic(item.slug)}
                  size="lg"
                  effect="raised"
                  className={SUBTOPIC_HEIGHT}
                  image={item.hero}
                  title={item.title}
                />
              </li>
            ))}
          </ul>
          {items.length > limit ? (
            <TopicsLink count={items.length} href={href} className="mt-5" />
          ) : null}
          <TopicsInvite t={messages.topics} place={place} className="mt-4" />
        </>
      ) : (
        <NoTopicsCta count={0} place={place} className="mt-5 max-w-2xl" />
      )}
    </section>
  );
}
