import { Sparkline, daysAgoLabel } from "@/components/admin/Sparkline";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge, type Tone } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import {
  RATING_LABEL,
  THRESHOLDS,
  VITAL_LABEL,
  WEB_VITALS,
  formatVital,
  type Device,
  type Rating,
  type WebVital,
} from "../metrics";
import {
  TREND_DAYS,
  TREND_METRICS,
  VITALS_WINDOWS,
  type TrendMetric,
  type VitalReading,
  type VitalsSummary,
} from "../summary";

const TONE: Record<Rating, Tone> = {
  good: "success",
  "needs-improvement": "warning",
  poor: "danger",
};

const DEVICE_LABEL: Record<Device, string> = { mobile: "Mobile", desktop: "Desktop" };

const NO_DATA = "—";

/** The p75 as a coloured pill with its rating in words (colour is never the only cue). */
function Reading({ metric, reading }: { metric: WebVital; reading: VitalReading | null }) {
  if (!reading) return <span className="text-[var(--color-ink-muted)]">{NO_DATA}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Badge tone={TONE[reading.rating]} size="md">
        {formatVital(metric, reading.p75)}
      </Badge>
      <span className="truncate text-[12px] text-[var(--color-ink-soft)]">
        {RATING_LABEL[reading.rating]}
      </span>
    </span>
  );
}

const shown = (metric: WebVital, reading: VitalReading | null) =>
  reading ? formatVital(metric, reading.p75) : null;

/** "LCP on mobile": the last 28 days of daily p75 as a line, the 28-day p75 as the reading. */
function TrendTile({ metric, summary }: { metric: TrendMetric; summary: VitalsSummary }) {
  const month = summary.table.find((row) => row.metric === metric && row.device === "mobile");
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-line)] px-4 py-3">
      <span className="min-w-0">
        <span className="font-display block text-[24px] leading-none font-bold">
          {month?.month ? formatVital(metric, month.month.p75) : NO_DATA}
        </span>
        <span className="mt-1 block text-[13px] text-[var(--color-ink-soft)]">
          {metric} on mobile, p75 of {VITALS_WINDOWS.month} days
        </span>
      </span>
      <Sparkline
        points={summary.trend.map((day, index) => {
          const reading = day.readings[metric];
          return {
            value: reading?.p75 ?? null,
            label: `${daysAgoLabel(summary.trend.length - 1 - index)}: ${
              reading ? `${formatVital(metric, reading.p75)} (${reading.samples} views)` : "no data"
            }`,
          };
        })}
      />
    </li>
  );
}

const thresholdsLine = WEB_VITALS.map(
  (metric) =>
    `${metric} ${formatVital(metric, THRESHOLDS[metric][0])} / ${formatVital(metric, THRESHOLDS[metric][1])}`,
).join(" · ");

/**
 * Admin overview: real visitors' Core Web Vitals (features/web-vitals), the
 * 75th percentile per device for the last 7 and 28 days and the daily trend of
 * LCP and INP on mobile. `summary` null = the read failed.
 */
export function WebVitalsCard({ summary }: { summary: VitalsSummary | null }) {
  return (
    <section className="mt-10" aria-labelledby="web-vitals-heading">
      <h2 id="web-vitals-heading" className="font-display mb-1 text-[17px] font-bold">
        Core Web Vitals (real visitors)
      </h2>
      <p className="mb-3 max-w-3xl text-[13px] text-[var(--color-ink-soft)]">
        The 75th percentile of page views, measured in visitors&apos; browsers without cookies or
        personal data — the number Google&apos;s Core Web Vitals assessment uses. Good up to the
        first value, poor above the second: {thresholdsLine}.
      </p>
      {summary ? (
        <>
          <DataTable
            compact
            tableKey="admin-web-vitals"
            caption="Core Web Vitals, 75th percentile"
            emptyTitle="No page views measured yet"
            columns={[
              { key: "metric", label: "Metric", width: "minmax(220px, 2fr)" },
              { key: "device", label: "Device", width: "110px" },
              {
                key: "week",
                label: `p75, ${VITALS_WINDOWS.week} days`,
                width: "minmax(190px, 1.5fr)",
              },
              {
                key: "weekViews",
                label: "Page views",
                kind: "number",
                align: "right",
                width: "110px",
              },
              {
                key: "month",
                label: `p75, ${VITALS_WINDOWS.month} days`,
                width: "minmax(190px, 1.5fr)",
              },
              {
                key: "monthViews",
                label: "Page views",
                kind: "number",
                align: "right",
                width: "110px",
              },
            ]}
            rows={summary.table.map((row) => ({
              id: `${row.metric}-${row.device}`,
              values: {
                metric: row.metric,
                device: DEVICE_LABEL[row.device],
                week: shown(row.metric, row.week),
                weekViews: row.week?.samples ?? 0,
                month: shown(row.metric, row.month),
                monthViews: row.month?.samples ?? 0,
              },
              cells: {
                metric: (
                  <span className="min-w-0 truncate">
                    <strong>{row.metric}</strong>{" "}
                    <span className="text-[var(--color-ink-soft)]">{VITAL_LABEL[row.metric]}</span>
                  </span>
                ),
                week: <Reading metric={row.metric} reading={row.week} />,
                month: <Reading metric={row.metric} reading={row.month} />,
              },
            }))}
          />

          <h3 className="font-display mt-6 mb-3 text-[15px] font-bold">
            Mobile trend — last {TREND_DAYS} days
          </h3>
          <ul className="mb-4 grid gap-2 sm:grid-cols-2">
            {TREND_METRICS.map((metric) => (
              <TrendTile key={metric} metric={metric} summary={summary} />
            ))}
          </ul>
          <DataTable
            tableKey="admin-web-vitals-trend"
            caption="Daily 75th percentile on mobile"
            emptyTitle="No page views measured yet"
            initialSort={{ key: "day", dir: "desc" }}
            columns={[
              { key: "day", label: "Day", kind: "date", sortable: true, width: "140px" },
              ...TREND_METRICS.flatMap((metric) => [
                {
                  key: metric,
                  label: `${metric} p75`,
                  width: "minmax(190px, 1.5fr)",
                },
                {
                  key: `${metric}Views`,
                  label: `${metric} page views`,
                  kind: "number" as const,
                  align: "right" as const,
                  sortable: true,
                  width: "140px",
                },
              ]),
            ]}
            rows={summary.trend.map((day) => ({
              id: day.day,
              values: {
                day: day.day,
                ...Object.fromEntries(
                  TREND_METRICS.flatMap((metric) => [
                    [metric, shown(metric, day.readings[metric])],
                    [`${metric}Views`, day.readings[metric]?.samples ?? 0],
                  ]),
                ),
              },
              cells: Object.fromEntries(
                TREND_METRICS.map((metric) => [
                  metric,
                  <Reading key={metric} metric={metric} reading={day.readings[metric]} />,
                ]),
              ),
            }))}
          />
          <p className="mt-3 text-[13px] text-[var(--color-ink-soft)]">
            Page views measured in the last {VITALS_WINDOWS.month} days:{" "}
            {formatNumber(
              summary.table
                .filter((row) => row.metric === "TTFB")
                .reduce((sum, row) => sum + (row.month?.samples ?? 0), 0),
              0,
            )}
            . A percentile from a few dozen views moves a lot from day to day.
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
