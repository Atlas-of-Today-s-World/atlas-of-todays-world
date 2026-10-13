import { SitePage, sitePageMetadata } from "@/features/site-pages/components/SitePage";

type Params = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Params) {
  return sitePageMetadata("accessibility", params);
}

/**
 * Accessibility statement (F5, F8) — text edited in the admin (Site pages).
 * Keep it in line with the actual state.
 */
export default function AccessibilityPage({ params }: Params) {
  return <SitePage slug="accessibility" params={params} />;
}
