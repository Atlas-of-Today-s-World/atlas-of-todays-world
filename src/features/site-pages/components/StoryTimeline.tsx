import { SafeHtml } from "@/components/atlas/SafeHtml";
import { cn } from "@/lib/cn";
import type { Milestone } from "../render";

/**
 * Milestones of a site page section as a vertical timeline (About → Our
 * story, as the original site drew it): the date on the left, a blue dot on a
 * thin line running down the page, the title and text on the right. On a
 * phone the date moves above the title.
 */
export function StoryTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="story-timeline">
      {milestones.map((milestone, index) => {
        const last = index === milestones.length - 1;
        return (
          <li
            key={`${index}-${milestone.date}`}
            className="grid grid-cols-[1rem_1fr] gap-x-4 sm:grid-cols-[7.5rem_1rem_1fr] sm:gap-x-5"
          >
            {milestone.date ? (
              <p className="story-timeline-date font-display col-start-2 text-[13.5px] leading-snug font-semibold text-[var(--color-ink-muted)] sm:col-start-1 sm:pt-[3px] sm:text-right sm:text-[15px]">
                {milestone.date}
              </p>
            ) : null}
            {/* The line runs from the first dot to the last one. */}
            <div
              aria-hidden
              className="relative col-start-1 row-span-2 row-start-1 flex justify-center sm:col-start-2"
            >
              <span
                className={cn(
                  "absolute w-px bg-[var(--color-line)]",
                  index === 0 ? "top-2" : "top-0",
                  last ? "h-2" : "bottom-0",
                )}
              />
              <span className="relative mt-[5px] size-3.5 rounded-full bg-[var(--color-accent)] ring-4 ring-[var(--color-accent-soft)]" />
            </div>
            <div className={cn("col-start-2 sm:col-start-3 sm:row-start-1", !last && "pb-8")}>
              <h3>{milestone.title}</h3>
              <SafeHtml html={milestone.html} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
