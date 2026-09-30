/** Počet obyvatel pro kartu země i portrét („1.43 bn", „38.0 m", „520 k"). */
export function formatPopulation(value: number | null): string {
  if (!value) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} bn`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} k`;
  return String(value);
}
