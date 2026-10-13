import { SitePage, sitePageMetadata } from "@/features/site-pages/components/SitePage";

type Params = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Params) {
  return sitePageMetadata("terms", params);
}

/** Terms of use (F5) — text edited in the admin (Site pages). */
export default function TermsPage({ params }: Params) {
  return <SitePage slug="terms" params={params} />;
}
