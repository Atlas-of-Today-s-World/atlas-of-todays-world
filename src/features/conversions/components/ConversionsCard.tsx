import { Sparkline, daysAgoLabel } from "@/components/admin/Sparkline";
import type { ConversionSummary, EventSummary } from "../summary";
import { SUMMARY_DAYS } from "../summary";

function EventRow({ item }: { item: EventSummary }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-line)] px-4 py-3">
      <span className="min-w-0">
        <span className="font-display block text-[24px] leading-none font-bold">{item.total}</span>
        <span className="mt-1 block text-[13px] text-[var(--color-ink-soft)]">{item.label}</span>
      </span>
      <Sparkline
        points={item.daily.map((count, index) => ({
          value: count,
          label: `${daysAgoLabel(item.daily.length - 1 - index)}: ${count}`,
        }))}
      />
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
