"use client";

import { ArrowRight } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { format } from "@/features/i18n/messages";
import { cn } from "@/lib/cn";

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

const LABEL =
  "glass absolute bottom-6 left-1/2 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-3xl px-5 py-[9px] text-center text-[15px] tracking-wide text-white/90 sm:text-[18px]";

/**
 * The place under the cursor, at the bottom of the globe: "Name · Metric: value (year) · topics · status".
 * With `href` (a place previewed by a tap on a touch screen) it is a link that
 * opens the place: "Open Name · … →", at least a touch target high.
 */
export function GlobeHoverLabel({
  label,
  href,
  onOpen,
  className,
}: {
  label: HoverLabel;
  href?: string | null;
  /** Called as the link is followed (the globe marks the place being opened). */
  onOpen?: () => void;
  /** Placement on phones (above the legend or the bottom sheet). */
  className?: string;
}) {
  const t = useMessages();
  const details = (
    <>
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
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onOpen}
        className={cn(
          LABEL,
          "glass-hover pointer-events-auto flex min-h-(--touch-min) items-center gap-2 transition focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          className,
        )}
      >
        <span>
          <span className="font-semibold text-white">
            {format(t.map.openPlace, { name: label.name })}
          </span>
          {details}
        </span>
        <ArrowRight aria-hidden className="size-4 shrink-0 text-white sm:size-5" />
      </Link>
    );
  }

  return (
    <div className={cn(LABEL, "pointer-events-none", className)}>
      <span className="font-semibold text-white">{label.name}</span>
      {details}
    </div>
  );
}
