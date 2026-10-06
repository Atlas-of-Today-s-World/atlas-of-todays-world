import { EnglishOnly } from "@/components/i18n/EnglishOnly";
import { localeFrom } from "@/features/i18n/request";
import type { Metadata } from "next";
import { englishOnlyMetadata } from "@/lib/seo/metadata";
import Link from "@/components/i18n/Link";
import { ContactLink } from "@/components/atlas/ContactLink";

const TITLE = "Privacy policy";
const DESCRIPTION = "What personal data Atlas of Today's World processes, why, and your rights.";

/** English only for now: /cs/privacy canonicalizes to the English original. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return englishOnlyMetadata(await localeFrom(params), "/privacy", TITLE, DESCRIPTION);
}

/**
 * Privacy policy (F5, SEC-11). Describes only what the app actually
 * does — update it when data processing changes (new service, analytics).
 */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  return (
    <EnglishOnly locale={locale}>
      <main className="prose-atlas max-w-2xl">
        <h1 className="font-display text-[34px] font-bold text-[var(--color-ink)]">
          Privacy policy
        </h1>
        <p className="text-[13px] text-[var(--color-ink-muted)]">Last updated 30 September 2026</p>

        <p>
          Atlas of Today&rsquo;s World is an independent encyclopedia of the present. You can read
          everything without an account, and we collect as little about you as we can. Questions and
          requests about your data: <ContactLink />.
        </p>

        <h2>Reading the Atlas</h2>
        <ul>
          <li>
            We do not use advertising or tracking cookies, and we do not build profiles of readers.
          </li>
          <li>
            Our hosting provider (Vercel) keeps short-lived technical logs, including IP addresses,
            to run and protect the site.
          </li>
          <li>
            We count visits with Vercel Web Analytics, which uses no cookies and stores no personal
            data — only anonymous totals such as page views and countries.
          </li>
          <li>
            To open the globe over your country, the home page asks our server for the country of
            your IP address (as our hosting provider sees it). Only the two-letter country code is
            used, in your browser, and it is not stored.
          </li>
          <li>
            The globe loads map tiles and fonts from MapTiler or Esri and from OpenMapTiles. Your
            browser contacts those servers directly, so they see your IP address.
          </li>
          <li>
            Searches are rate-limited to stop abuse. For that we store a one-way hash of your IP
            address for up to a day, never the address itself.
          </li>
        </ul>

        <h2>Accounts</h2>
        <p>
          You can create an account with Google. We receive and store your e-mail address and the
          name on your Google profile, and we keep a session cookie that is strictly necessary to
          keep you signed in. Members of the Atlas team also have a role and, for some roles, a
          second factor (an authenticator app). Changes made in the editorial system are logged for
          12 months without personal details.
        </p>
        <p>
          You can delete your account at any time on the <Link href="/ucet">account page</Link>.
          That removes your profile and personal data from our database.
        </p>

        <h2>Newsletter</h2>
        <p>
          If you sign up, your e-mail address goes to Mailchimp, which sends the newsletter on our
          behalf. You confirm the subscription by clicking a link in a first e-mail (double opt-in),
          and every newsletter has an unsubscribe link.
        </p>

        <h2>Volunteer editors</h2>
        <p>
          If you apply to write for the Atlas as a volunteer, we keep your name, e-mail address and
          what you tell us in our database, so the editorial team can get in touch. Only the people
          who manage accounts can see it, and we delete it on request or when it is no longer
          needed.
        </p>

        <h2>Who processes the data</h2>
        <ul>
          <li>Supabase — database and sign-in, hosted in Frankfurt (EU).</li>
          <li>Vercel — hosting of the website.</li>
          <li>Google — sign-in, only if you choose to sign in.</li>
          <li>Mailchimp — newsletter, only if you subscribe.</li>
        </ul>

        <h2>Your rights</h2>
        <p>
          Under the GDPR you can ask what data we hold about you, have it corrected or deleted,
          object to processing, and complain to your data protection authority. The legal basis is
          your consent (newsletter, account) and our legitimate interest in running a secure website
          (technical logs, abuse protection).
        </p>
      </main>
    </EnglishOnly>
  );
}
