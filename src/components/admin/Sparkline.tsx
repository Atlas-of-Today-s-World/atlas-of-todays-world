const SPARK = { width: 120, height: 28, pad: 2 } as const;

/** One point of a sparkline: its value (null = no data that day) and its tooltip. */
export interface SparkPoint {
  value: number | null;
  label: string;
}

/** "Today", "1 day ago", "5 days ago" — the tooltip prefix of a daily series ending today. */
export function daysAgoLabel(daysAgo: number): string {
  if (daysAgo === 0) return "Today";
  return `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
}

/**
 * A daily series as a 2 px line from zero to its largest value (admin
 * overview). Each point is a hover target with its label (native tooltip); a
 * day without data breaks the line. The reading next to it is the number that
 * counts — the line only shows the shape, so it is hidden from screen readers.
 */
export function Sparkline({ points }: { points: readonly SparkPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.value ?? 0));
  const step = (SPARK.width - SPARK.pad * 2) / Math.max(1, points.length - 1);
  const x = (index: number) => SPARK.pad + index * step;
  const y = (value: number) =>
    SPARK.height - SPARK.pad - (value / max) * (SPARK.height - SPARK.pad * 2);

  // Runs of consecutive days with data, each drawn on its own.
  const runs: { index: number; value: number }[][] = [];
  points.forEach((point, index) => {
    if (point.value === null) return;
    const previous = runs.at(-1);
    const last = previous?.at(-1);
    if (previous && last && last.index === index - 1) previous.push({ index, value: point.value });
    else runs.push([{ index, value: point.value }]);
  });

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}
      width={SPARK.width}
      height={SPARK.height}
      className="shrink-0 overflow-visible text-[var(--color-accent)]"
    >
      {runs.map((run) =>
        run.length === 1 ? (
          <circle
            key={run[0]?.index}
            cx={x(run[0]?.index ?? 0)}
            cy={y(run[0]?.value ?? 0)}
            r={1.5}
            fill="currentColor"
          />
        ) : (
          <polyline
            key={run[0]?.index}
            points={run.map((point) => `${x(point.index)},${y(point.value)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ),
      )}
      {points.map((point, index) => (
        <rect
          key={index}
          x={x(index) - step / 2}
          y={0}
          width={step}
          height={SPARK.height}
          fill="transparent"
        >
          <title>{point.label}</title>
        </rect>
      ))}
    </svg>
  );
}
