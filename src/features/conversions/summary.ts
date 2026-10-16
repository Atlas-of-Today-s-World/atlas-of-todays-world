import {
  AI_REFERRERS,
  AI_REFERRER_LABEL,
  CONVERSION_EVENTS,
  EVENT_LABEL,
  type AiReferrer,
  type ConversionEvent,
} from "./events";

/** Days the admin overview looks back. */
export const SUMMARY_DAYS = 30;

/** A row of conversion_events_daily as the admin reads it. */
export interface ConversionRow {
  day: string;
  event: string;
  referrer_group: string;
  count: number;
}

export interface EventSummary {
  event: ConversionEvent;
  label: string;
  total: number;
  /** One count per day, oldest first (SUMMARY_DAYS values). */
  daily: number[];
}

export interface ConversionSummary {
  events: EventSummary[];
  /** Visits from each AI assistant (only those with any). */
  aiReferrals: { group: AiReferrer; label: string; total: number }[];
  /** Conversions (not counting the referrals themselves) of visitors who came from an AI assistant. */
  fromAi: number;
}

/** "YYYY-MM-DD" of `date` minus `days` (UTC, like the database's current_date). */
function isoDay(date: Date, days: number): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - days);
  return day.toISOString().slice(0, 10);
}

/** Daily rows of the last SUMMARY_DAYS days (ending `today`) → totals and series per event. */
export function summarise(rows: readonly ConversionRow[], today: Date): ConversionSummary {
  const days = Array.from({ length: SUMMARY_DAYS }, (_, index) =>
    isoDay(today, SUMMARY_DAYS - 1 - index),
  );
  const position = new Map(days.map((day, index) => [day, index]));
  const daily = new Map<string, number[]>(
    CONVERSION_EVENTS.map((event) => [event, days.map(() => 0)]),
  );
  const referrals = new Map<string, number>();
  let fromAi = 0;

  for (const row of rows) {
    const index = position.get(row.day);
    const series = daily.get(row.event);
    if (index === undefined || !series) continue;
    series[index] = (series[index] ?? 0) + row.count;
    if (row.referrer_group === "none") continue;
    if (row.event === "ai_referral") {
      referrals.set(row.referrer_group, (referrals.get(row.referrer_group) ?? 0) + row.count);
    } else {
      fromAi += row.count;
    }
  }

  return {
    events: CONVERSION_EVENTS.map((event) => {
      const series = daily.get(event) ?? [];
      return {
        event,
        label: EVENT_LABEL[event],
        total: series.reduce((sum, count) => sum + count, 0),
        daily: series,
      };
    }),
    aiReferrals: AI_REFERRERS.filter((group) => referrals.has(group)).map((group) => ({
      group,
      label: AI_REFERRER_LABEL[group],
      total: referrals.get(group) ?? 0,
    })),
    fromAi,
  };
}

/** The first day of the window ending `today` ("YYYY-MM-DD"), for the database filter. */
export const summaryStart = (today: Date) => isoDay(today, SUMMARY_DAYS - 1);
