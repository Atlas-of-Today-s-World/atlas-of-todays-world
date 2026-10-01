import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction, editAction } from "@/components/data-table/row-actions";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { deleteTile } from "@/features/entries/actions";
import { TILE_ICON_LABEL, type TileIcon } from "@/features/entries/constants";
import { TileForm } from "@/features/entries/components/TileForm";
import { listDefaultTiles } from "@/features/entries/editorial";

export const metadata: Metadata = { title: "Learn-more tiles" };

/**
 * Default "Learn more" tiles: they appear on every dossier (right half), each
 * dossier fills them with its own links and text. The five original resource
 * types can be renamed but not deleted; RLS requires rights over all articles.
 */
export default async function LearnMoreTilesPage() {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const tiles = await listDefaultTiles();
  const canDelete = can(access.permissions, "news", "d");

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/learn-more-tiles")}
        title="Learn-more tiles"
        lead="Default tiles on the right half of every dossier (videos, stats, hand-written notes…). Each dossier adds its own links and text to them in its Learn more tab."
      />
      <DataTable
        tableKey="admin-learn-more-tiles"
        caption="Learn-more tiles"
        emptyTitle="No default tiles"
        initialSort={{ key: "position", dir: "asc" }}
        actionsWidth={canDelete ? "72px" : "48px"}
        columns={[
          {
            key: "label",
            label: "Label",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 2fr)",
          },
          { key: "icon", label: "Icon", sortable: true, filter: "select", width: "120px" },
          { key: "description", label: "Description", filter: "text" },
          {
            key: "position",
            label: "Order",
            kind: "number",
            sortable: true,
            align: "right",
            width: "90px",
          },
        ]}
        rows={tiles.map((tile) => ({
          id: tile.id,
          href: `/admin/learn-more-tiles/${tile.id}`,
          values: {
            label: tile.label,
            icon: TILE_ICON_LABEL[tile.icon as TileIcon] ?? tile.icon,
            description: tile.description,
            position: tile.position,
          },
          actions: (
            <RowActions
              actions={[
                editAction(`/admin/learn-more-tiles/${tile.id}`),
                ...(canDelete && !tile.legacy_kind
                  ? [
                      deleteAction(
                        deleteTile.bind(null, tile.id),
                        `tile ${tile.label}`,
                        "The tile disappears from every dossier, with the links and text dossiers put in it.",
                      ),
                    ]
                  : []),
              ]}
            />
          ),
        }))}
      />
      {can(access.permissions, "news", "c") ? (
        <section
          aria-labelledby="new-tile-title"
          className="mt-10 max-w-3xl rounded-2xl border border-[var(--color-line)] p-5"
        >
          <h2 id="new-tile-title" className="font-display text-[18px] font-bold">
            Add a default tile
          </h2>
          <p className="mt-1 mb-4 text-[13px] text-[var(--color-ink-muted)]">
            It appears on every dossier, greyed out until a dossier puts links or text in it.
          </p>
          <TileForm tile={null} />
        </section>
      ) : null}
    </>
  );
}
