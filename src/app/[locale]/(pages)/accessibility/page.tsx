import { SitePage, sitePageMetadata } from "@/features/site-pages/components/SitePage";

export function generateMetadata({ params }: PageProps<"/[locale]/accessibility">) {
  return sitePageMetadata("accessibility", params);
}

/**
 * Accessibility statement (F5, F8) — text edited in the admin (Site pages).
 * Keep it in line with the actual state.
 */
export default function AccessibilityPage({ params }: PageProps<"/[locale]/accessibility">) {
  return <SitePage slug="accessibility" params={params} />;
}
