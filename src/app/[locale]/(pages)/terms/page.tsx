import { SitePage, sitePageMetadata } from "@/features/site-pages/components/SitePage";

export function generateMetadata({ params }: PageProps<"/[locale]/terms">) {
  return sitePageMetadata("terms", params);
}

/** Terms of use (F5) — text edited in the admin (Site pages). */
export default function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  return <SitePage slug="terms" params={params} />;
}
