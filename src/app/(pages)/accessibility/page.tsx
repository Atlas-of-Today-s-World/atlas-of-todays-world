import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink } from "@/components/atlas/ContactLink";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "How accessible Atlas of Today's World is, and how to reach us about barriers.",
  alternates: { canonical: "/accessibility" },
};

/** Prohlášení o přístupnosti (F5, F8). Držet v souladu se skutečným stavem. */
export default function AccessibilityPage() {
  return (
    <main className="prose-atlas max-w-2xl">
      <h1 className="font-display text-[34px] font-bold text-[var(--color-ink)]">
        Accessibility statement
      </h1>
      <p className="text-[13px] text-[var(--color-ink-muted)]">Last updated 30 September 2026</p>

      <p>
        We want everyone to be able to use the Atlas. We aim for the Web Content Accessibility
        Guidelines (WCAG) 2.1 at level AA, and every change is checked automatically with axe.
      </p>

      <h2>What works</h2>
      <ul>
        <li>A &ldquo;Skip to content&rdquo; link, keyboard navigation and visible focus.</li>
        <li>Content panels that take focus when they open and close with Esc.</li>
        <li>Carousels you can move with the arrow keys and read with a screen reader.</li>
        <li>Touch targets of at least 44 × 44 pixels and respect for reduced motion.</li>
      </ul>

      <h2>Known limitations</h2>
      <p>
        The 3D globe itself is a visual map. Everything on it is also reachable without it: use{" "}
        <Link href="/search">search</Link> or the ranked tables of each{" "}
        <Link href="/view/hdi">data layer</Link>. Screen readers also get a full list of regions and
        countries on the home page.
      </p>

      <h2>Tell us about a barrier</h2>
      <p>
        If something does not work for you, write to us: <ContactLink />. We reply within 30 days.
      </p>
    </main>
  );
}
