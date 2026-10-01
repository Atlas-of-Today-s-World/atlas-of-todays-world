import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { TileForm } from "@/features/entries/components/TileForm";
import { getTile } from "@/features/entries/editorial";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Learn-more tile" };

/** Editing one default tile (a dossier's own tiles are edited in its Learn more tab). */
export default async function LearnMoreTilePage({ params }: { params: Promise<{ id: string }> }) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const tile = await getTile(id);
  if (!tile || tile.entry_id) notFound();

  return (
    <>
      <PageHeader
        title={tile.label}
        lead={
          <Link href="/admin/learn-more-tiles" className="text-[var(--color-link)] underline">
            All learn-more tiles
          </Link>
        }
      />
      <div className="max-w-3xl">
        <TileForm tile={tile} />
      </div>
    </>
  );
}
