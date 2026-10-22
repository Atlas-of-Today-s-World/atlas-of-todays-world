import { Clock, MapPin } from "lucide-react";

/** Location and job type of a position, as a line of small facts. */
export function PositionFacts({
  location,
  jobType,
  labels,
  className = "mt-2",
}: {
  location: string;
  jobType: string;
  labels: { location: string; jobType: string };
  className?: string;
}) {
  if (!location && !jobType) return null;
  return (
    <span
      className={`${className} flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-[var(--color-ink-muted)]`}
    >
      {location ? (
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden className="size-4" />
          <span className="sr-only">{labels.location}: </span>
          {location}
        </span>
      ) : null}
      {jobType ? (
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden className="size-4" />
          <span className="sr-only">{labels.jobType}: </span>
          {jobType}
        </span>
      ) : null}
    </span>
  );
}
