import { PagesFrame } from "@/components/PagesFrame";

/** Simple light layout for the pages outside the map (About, News, Search…); maintenance applies. */
export default function PagesLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <PagesFrame {...props} gated />;
}
