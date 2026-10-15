import { PagesFrame } from "@/components/PagesFrame";

/**
 * Atlas Patrons pages: same header and footer, full-width content bands;
 * maintenance applies. No floating actions — the pages are the call to action.
 */
export default function PatronsLayout(props: LayoutProps<"/[locale]">) {
  return <PagesFrame {...props} gated bleed floatingActions={false} />;
}
