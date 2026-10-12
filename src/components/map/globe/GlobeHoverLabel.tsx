"use client";

import { useMessages } from "@/components/i18n/LocaleProvider";

/** What the label under the cursor says. */
export interface HoverLabel {
  name: string;
  /** The active metric for this country (countries mode with a metric on). */
  metric?: { label: string; value: string | null; year?: number };
  topics?: string;
  /** How far the group's content is (group modes). */
  status?: string;
}

function Separator() {
  return (
    <span aria-hidden className="text-white/45">
      {" · "}
    </span>
  );
}

/** The place under the cursor, at the bottom of the globe: "Name · Metric: value (year) · topics · status". */
export function GlobeHoverLabel({ label }: { label: HoverLabel }) {
  const t = useMessages();
  return (
    <div className="glass pointer-events-none absolute bottom-6 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-3xl px-5 py-[9px] text-center text-[15px] tracking-wide text-white/90 sm:text-[18px]">
      <span className="font-semibold text-white">{label.name}</span>
      {label.metric ? (
        <>
          <Separator />
          {label.metric.label}:{" "}
          <span className="font-semibold text-white tabular-nums">
            {label.metric.value ?? t.map.noData}
          </span>
          {label.metric.year ? <span className="text-white/70"> ({label.metric.year})</span> : null}
        </>
      ) : null}
      {label.topics ? (
        <>
          <Separator />
          {label.topics}
        </>
      ) : null}
      {label.status ? (
        <>
          <Separator />
          <span className="text-white/70">{label.status}</span>
        </>
      ) : null}
    </div>
  );
}
