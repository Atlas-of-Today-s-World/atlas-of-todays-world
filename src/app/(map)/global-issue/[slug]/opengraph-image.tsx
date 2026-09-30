import { getAtlas } from "@/features/geography/queries";
import { OG_SIZE, renderOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Global issue — Atlas of Today's World";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const issue = (await getAtlas()).issueBySlug.get((await params).slug);
  return renderOg({
    kicker: "Global issue",
    title: issue?.name ?? "Atlas of Today's World",
    subtitle: issue?.subtitle || issue?.summary,
    accent: issue?.fill,
  });
}
