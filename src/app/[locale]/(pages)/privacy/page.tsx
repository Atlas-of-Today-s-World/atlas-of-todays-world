import { SitePage, sitePageMetadata } from "@/features/site-pages/components/SitePage";

export function generateMetadata({ params }: PageProps<"/[locale]/privacy">) {
  return sitePageMetadata("privacy", params);
}

/**
 * Privacy policy (F5, SEC-11) — text edited in the admin (Site pages), the
 * built-in version in features/site-pages/defaults.ts. Describes only what
 * the app actually does — update it when data processing changes.
 */
export default function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  return <SitePage slug="privacy" params={params} />;
}
