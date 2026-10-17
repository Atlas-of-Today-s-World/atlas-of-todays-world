import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction, moveActions, openAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes, routes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { moveHomePin, removeHomePin } from "@/features/home/actions";
import { AddPinForm, HomeCountForm } from "@/features/home/components/HomeFeaturedForms";
import { getFeaturedCount, homeRight, listHomePins } from "@/features/home/editorial";
import { getSubtopicTiles, pickFeatured } from "@/features/topics/featured";

export const metadata: Metadata = { title: "Home page" };

const SHOWN = [
  { value: "shown", label: "On the map", tone: "success" as const },
  { value: "over", label: "Over the count", tone: "neutral" as const },
  { value: "unpublished", label: "Not published", tone: "warning" as const },
];

/**
 * Home page: the subtopic tiles under the search field on the home map — the
 * pinned ones first, in this order, the rest filled with the newest. Open to
 * the `news` or `site` section; RLS decides every write.
 */
export default async function HomeAdminPage() {
  const access = await sectionAccess(["news", "site"]);
  if (!access) return <NoAccess />;
  const [pins, count, tiles] = await Promise.all([
    listHomePins(),
    getFeaturedCount(),
    getSubtopicTiles(),
  ]);
  const canEdit = homeRight(access.permissions, "e");
  const published = new Map(tiles.map((tile) => [tile.id, tile]));
  const onMap = pickFeatured(
    tiles,
    pins.map((pin) => pin.chapterId),
    count,
  );
  const shownIds = new Set(onMap.map((tile) => tile.id));
  const pinnedIds = new Set(pins.map((pin) => pin.chapterId));
  const newest = onMap.filter((tile) => !pinnedIds.has(tile.id));
  // Open on the site, move up + down, unpin.
  const maxActions = 1 + (canEdit ? 3 : 0);

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.homePage)}
        title="Home page"
        lead="Subtopic tiles under the search field on the home map. The pinned ones come first, in this order; the newest published subtopics fill the rest."
      />

      <HomeCountForm count={count} canEdit={canEdit} />

      <section aria-labelledby="home-pins-title" className="mt-10">
        <h2 id="home-pins-title" className="font-display mb-3 text-[17px] font-bold">
          Pinned subtopics
        </h2>
        {canEdit ? (
          <div className="mb-4">
            <AddPinForm
              options={tiles
                .filter((tile) => !pinnedIds.has(tile.id))
                .map(({ id, title, topicTitle }) => ({ id, title, topicTitle }))}
            />
          </div>
        ) : null}
        <DataTable
          tableKey="admin-home-pins"
          caption="Subtopics pinned on the home map"
          searchPlaceholder="Search pinned subtopics…"
          emptyTitle="Nothing pinned — the home map shows the newest subtopics"
          initialSort={{ key: "position", dir: "asc" }}
          stats={optionStats("shown", SHOWN)}
          maxRowActions={maxActions}
          columns={[
            {
              key: "position",
              label: "#",
              kind: "number",
              align: "right",
              sortable: true,
              width: "56px",
            },
            {
              key: "title",
              label: "Subtopic",
              sortable: true,
              filter: "text",
              width: "minmax(200px, 2fr)",
            },
            {
              key: "topic",
              label: "Entry",
              sortable: true,
              filter: "select",
              width: "minmax(160px, 1fr)",
            },
            {
              key: "shown",
              label: "On the home map",
              kind: "badge",
              options: SHOWN,
              sortable: true,
              filter: "select",
              width: "150px",
            },
            { key: "pinned", label: "Pinned", kind: "date", sortable: true, width: "120px" },
          ]}
          rows={pins.map((pin, index) => {
            const tile = published.get(pin.chapterId);
            const title = tile?.title ?? pin.title ?? "Subtopic not available";
            return {
              id: pin.id,
              values: {
                position: index + 1,
                title,
                topic: tile?.topicTitle ?? pin.topicTitle ?? "",
                shown: !tile ? "unpublished" : shownIds.has(tile.id) ? "shown" : "over",
                pinned: pin.createdAt,
              },
              actions: (
                <RowActions
                  actions={[
                    ...(tile ? [openAction(routes.entry(tile.topicSlug, tile.anchor))] : []),
                    ...(canEdit
                      ? [
                          ...moveActions(
                            moveHomePin.bind(null, pin.id, true),
                            moveHomePin.bind(null, pin.id, false),
                            { first: index === 0, last: index === pins.length - 1 },
                          ),
                          deleteAction(
                            removeHomePin.bind(null, pin.id),
                            `the pin “${title}”`,
                            "The subtopic stays; it only leaves this list. The newest subtopic takes its place on the home map.",
                          ),
                        ]
                      : []),
                  ]}
                />
              ),
            };
          })}
        />
        <p className="mt-3 text-[13px] text-[var(--color-ink-soft)]">
          {newest.length
            ? `Filled with the newest: ${newest
                .map((tile) => `${tile.title} (${tile.topicTitle})`)
                .join(", ")}.`
            : "Every tile on the home map is a pinned subtopic."}
        </p>
      </section>
    </>
  );
}
