import type { ConversionSummary, EventSummary } from "../summary";
import { SUMMARY_DAYS } from "../summary";

const SPARK = { width: 120, height: 28, pad: 2 } as const;

/**
 * Thirty days of one event as a 2 px line; each day is a hover target with its
 * count (native tooltip). The total next to it is the reading — the line only
 * shows the shape, so it is hidden from screen readers.
 */
function Sparkline({ daily }: { daily: number[] }) {
  const max = Math.max(1, ...daily);
  const step = (SPARK.width - SPARK.pad * 2) / Math.max(1, daily.length - 1);
  const x = (index: number) => SPARK.pad + index * step;
  const y = (count: number) =>
    SPARK.height - SPARK.pad - (count / max) * (SPARK.height - SPARK.pad * 2);
  const points = daily.map((count, index) => `${x(index)},${y(count)}`).join(" ");
  const daysAgo = (index: number) => daily.length - 1 - index;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}
      width={SPARK.width}
      height={SPARK.height}
      className="shrink-0 overflow-visible text-[var(--color-accent)]"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {daily.map((count, index) => (
        <rect
          key={index}
          x={x(index) - step / 2}
          y={0}
          width={step}
          height={SPARK.height}
          fill="transparent"
        >
          <title>
            {daysAgo(index) === 0
              ? `Today: ${count}`
              : `${daysAgo(index)} day${daysAgo(index) === 1 ? "" : "s"} ago: ${count}`}
          </title>
        </rect>
      ))}
    </svg>
  );
}

function EventRow({ item }: { item: EventSummary }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-line)] px-4 py-3">
      <span className="min-w-0">
        <span className="font-display block text-[24px] leading-none font-bold">{item.total}</span>
        <span className="mt-1 block text-[13px] text-[var(--color-ink-soft)]">{item.label}</span>
      </span>
      <Sparkline daily={item.daily} />
    </li>
  );
}

/**
 * Admin overview: the cookie-less conversion counts (features/conversions) of
 * the last 30 days. `summary` null = the read failed.
 */
export function ConversionsCard({ summary }: { summary: ConversionSummary | null }) {
  return (
    <section className="mt-10" aria-labelledby="conversions-heading">
      <h2 id="conversions-heading" className="font-display mb-1 text-[17px] font-bold">
        Conversions — last {SUMMARY_DAYS} days
      </h2>
      <p className="mb-3 text-[13px] text-[var(--color-ink-soft)]">
        Daily totals counted without cookies or personal data.
      </p>
      {summary ? (
        <>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.events.map((item) => (
              <EventRow key={item.event} item={item} />
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-[var(--color-ink-soft)]">
            {summary.aiReferrals.length
              ? `AI assistants: ${summary.aiReferrals
                  .map((referral) => `${referral.label} ${referral.total}`)
                  .join(" · ")}. Conversions by their visitors: ${summary.fromAi}.`
              : "No visits from AI assistants yet."}
          </p>
        </>
      ) : (
        <p className="rounded-xl border border-[var(--color-line)] px-4 py-3 text-[13px] text-[var(--color-ink-soft)]">
          The numbers are unavailable right now.
        </p>
      )}
    </section>
  );
}
