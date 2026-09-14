import type { Metadata } from "next";
import { INDICATORS } from "@/lib/indicators";

export const metadata: Metadata = {
  title: "About the Atlas",
  description:
    "Atlas of Today's World is an independent encyclopedia of the present, built around an interactive 3D globe.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="prose-atlas max-w-2xl">
      <h1 className="font-display text-[34px] font-bold text-[var(--color-ink)]">
        About the Atlas
      </h1>
      <p className="mt-4">
        Atlas of Today&rsquo;s World is an independent encyclopedia of the
        present. Instead of an A&ndash;Z list, it starts from a satellite globe:
        you spin it, click a country, and the Atlas opens that country&rsquo;s
        profile together with the portrait of the world region it belongs to.
        Entries open inside the same map, so the geographic context never
        disappears.
      </p>

      <h2>Where the data comes from</h2>
      <p>
        Country borders and names come from Natural Earth. The data layers are
        imported in bulk from Our World in Data and refreshed with a single
        command, so a yearly update takes minutes rather than manual editing:
      </p>
      <ul>
        {INDICATORS.map((indicator) => (
          <li key={indicator.id}>
            <strong>{indicator.label}</strong> &mdash; {indicator.source} (
            {indicator.latestYear})
          </li>
        ))}
      </ul>

      <h2>Editorial content</h2>
      <p>
        Region portraits, country profiles and encyclopedia entries are written
        by the Atlas team and stored as plain Markdown, so writers never have to
        touch the codebase.
      </p>
    </main>
  );
}
