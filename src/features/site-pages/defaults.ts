import type { SitePageContent, SitePageSlug } from "./pages";

/**
 * Built-in text of the site pages — what the website shows when the page's
 * row is missing, unpublished or the database can't be read. The same texts
 * seed the table (migration 20261013000120_site_pages; `defaults.test.ts`
 * keeps the two equal). Stored in sanitized form, with placeholders.
 */
export const DEFAULT_SITE_PAGES: Record<SitePageSlug, SitePageContent> = {
  about: {
    slug: "about",
    title: "About the Atlas",
    description:
      "Atlas of Today’s World is an independent encyclopedia of the present, built around an interactive 3D globe.",
    lead: "Atlas of Today’s World is an independent encyclopedia of the present. Instead of an A–Z list, it starts from a satellite globe: you spin it, click a country, and the Atlas opens that country’s profile together with the portrait of the world region it belongs to. News opens inside the same map, so the geographic context never disappears.",
    body_html: `<h2 id="mission">Our mission</h2>
<p>Atlas of Today’s World helps anyone understand today’s world in its geographic context — free to read, without advertising and without an account. We are a non-profit, non-governmental organization registered in the Czech Republic since 2016, supported by our readers through Atlas Patrons.</p>
<h2 id="data">Where the data comes from</h2>
<p>Country borders and names come from Natural Earth. The data layers are imported in bulk from Our World in Data and refreshed with a single command, so a yearly update takes minutes rather than manual editing:</p>
<p>{{data-sources}}</p>
<h2>Editorial content</h2>
<p>Region portraits, country profiles and news are written by the Atlas team in the Atlas’s own editorial system, where every change goes through review before it is published.</p>
<h2 id="editorial-standards">Editorial standards and corrections</h2>
<p>Every article names its author and shows when it was published and last updated. Facts link to their sources, and every number comes with the year and the institution that measured it. Each change is reviewed by an editor before it is published. If you find a mistake, write to {{email}}: we correct errors openly and update the article’s date.</p>
<h2 id="cite">How to cite the Atlas</h2>
<p>Atlas of Today’s World, “page title”, page URL (date of access). Data layers can also be cited with their original source, which every page names.</p>
<h2 id="machine-readable">For researchers, search engines and AI tools</h2>
<p>The Atlas is open to search engines and AI assistants. A Markdown overview for language models is at /llms.txt (full text at /llms-full.txt), every article has a Markdown version (add .md to its address), and new articles appear in our RSS and Atom feeds.</p>`,
    last_reviewed: null,
  },
  privacy: {
    slug: "privacy",
    title: "Privacy policy",
    description: "What personal data Atlas of Today's World processes, why, and your rights.",
    lead: "",
    body_html: `<p>Atlas of Today’s World is an independent encyclopedia of the present. You can read everything without an account, and we collect as little about you as we can. Questions and requests about your data: {{contact}}.</p>
<h2>Reading the Atlas</h2>
<ul>
<li>We do not use advertising or tracking cookies, and we do not build profiles of readers.</li>
<li>Our hosting provider (Vercel) keeps short-lived technical logs, including IP addresses, to run and protect the site.</li>
<li>We count visits with Vercel Web Analytics, which uses no cookies and stores no personal data — only anonymous totals such as page views and countries.</li>
<li>To open the globe over your country, the home page asks our server for the country of your IP address (as our hosting provider sees it). Only the two-letter country code is used, in your browser, and it is not stored.</li>
<li>The globe loads map tiles and fonts from MapTiler or Esri and from OpenMapTiles. Your browser contacts those servers directly, so they see your IP address.</li>
<li>Searches are rate-limited to stop abuse. For that we store a one-way hash of your IP address for up to a day, never the address itself.</li>
</ul>
<h2>Accounts</h2>
<p>You can create an account with Google. We receive and store your e-mail address and the name on your Google profile, and we keep a session cookie that is strictly necessary to keep you signed in. Members of the Atlas team also have a role and, for some roles, a second factor (an authenticator app). Changes made in the editorial system are logged for 12 months without personal details.</p>
<p>You can delete your account at any time on the <a href="/ucet" rel="noopener noreferrer">account page</a>. That removes your profile and personal data from our database.</p>
<h2>Newsletter</h2>
<p>If you sign up, your e-mail address goes to Mailchimp, which sends the newsletter on our behalf. You confirm the subscription by clicking a link in a first e-mail (double opt-in), and every newsletter has an unsubscribe link.</p>
<h2>Volunteer editors</h2>
<p>If you apply to write for the Atlas as a volunteer, we keep your name, e-mail address and what you tell us in our database, so the editorial team can get in touch. Only the people who manage accounts can see it, and we delete it on request or when it is no longer needed.</p>
<h2>Who processes the data</h2>
<ul>
<li>Supabase — database and sign-in, hosted in Frankfurt (EU).</li>
<li>Vercel — hosting of the website.</li>
<li>Google — sign-in, only if you choose to sign in.</li>
<li>Mailchimp — newsletter, only if you subscribe.</li>
</ul>
<h2>Your rights</h2>
<p>Under the GDPR you can ask what data we hold about you, have it corrected or deleted, object to processing, and complain to your data protection authority. The legal basis is your consent (newsletter, account) and our legitimate interest in running a secure website (technical logs, abuse protection).</p>`,
    last_reviewed: "2026-09-30",
  },
  terms: {
    slug: "terms",
    title: "Terms of use",
    description: "The rules for using Atlas of Today's World.",
    lead: "",
    body_html: `<h2>Using the Atlas</h2>
<p>You may read, link to and quote the Atlas freely. Please credit “Atlas of Today’s World” with a link to the page you quote.</p>
<h2>Data and sources</h2>
<p>The data layers come from third parties such as Our World in Data, each under its own licence, which is named next to every figure. Country borders follow Natural Earth and the practice of the United Nations; they are not a statement on any territorial dispute.</p>
<h2>Accuracy</h2>
<p>We check our texts and cite our sources, but the Atlas is a work in progress. It is general information, not professional advice. If you find a mistake, tell us: {{contact}}.</p>
<h2>Accounts</h2>
<p>Keep your sign-in to yourself. We may suspend accounts that are used to abuse the site. How we handle your data is described in the <a href="/privacy" rel="noopener noreferrer">privacy policy</a>.</p>`,
    last_reviewed: "2026-09-30",
  },
  accessibility: {
    slug: "accessibility",
    title: "Accessibility statement",
    description: "How accessible Atlas of Today's World is, and how to reach us about barriers.",
    lead: "",
    body_html: `<p>We want everyone to be able to use the Atlas. We aim for the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA, and every change is checked automatically with axe.</p>
<h2>What works</h2>
<ul>
<li>A “Skip to content” link, keyboard navigation and visible focus.</li>
<li>Content panels that take focus when they open and close with Esc.</li>
<li>Carousels you can move with the arrow keys and read with a screen reader.</li>
<li>Touch targets of at least 44 × 44 pixels and respect for reduced motion.</li>
</ul>
<h2>Known limitations</h2>
<p>The 3D globe itself is a visual map. Everything on it is also reachable without it: use <a href="/search" rel="noopener noreferrer">search</a> or the ranked tables of each <a href="/view/hdi" rel="noopener noreferrer">data layer</a>, or the <a href="/countries" rel="noopener noreferrer">list of all countries and regions</a>.</p>
<h2>Tell us about a barrier</h2>
<p>If something does not work for you, write to us: {{contact}}. We reply within 30 days.</p>`,
    last_reviewed: "2026-09-30",
  },
};

/** A site_pages row as the public site reads it. */
export type PublishedRow = Omit<SitePageContent, "slug"> & { published: boolean };

/**
 * What the page shows: the published row, otherwise the built-in default
 * (row missing, unpublished, or the read failed).
 */
export function pageOrDefault(slug: SitePageSlug, row: PublishedRow | null): SitePageContent {
  if (!row?.published) return DEFAULT_SITE_PAGES[slug];
  return {
    slug,
    title: row.title,
    description: row.description,
    lead: row.lead,
    body_html: row.body_html,
    last_reviewed: row.last_reviewed,
  };
}
