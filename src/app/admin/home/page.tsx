import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { openAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes, routes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { HomeCountForm } from "@/features/home/components/HomeFeaturedForms";
import { getFeaturedCount, homeRight, listNewestEntries } from "@/features/home/editorial";

export const metadata: Metadata = { title: "Home page" };

const SHOWN = [
  { value: "shown", label: "On the map", tone: "success" as const },
  { value: "over", label: "Over the count", tone: "neutral" as const },
];

/**
 * Home page: the entry tiles under the search field on the home map (desktop
 * only) — the newest published entries, as many as set here. Open to the
 * `news` or `site` section; RLS decides the write.
 */
export default async function HomeAdminPage() {
  const access = await sectionAccess(["news", "site"]);
  if (!access) return <NoAccess />;
  const [count, entries] = await Promise.all([getFeaturedCount(), listNewestEntries()]);
  const canEdit = homeRight(access.permissions, "e");

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.homePage)}
        title="Home page"
        lead={`Entry tiles under the search field on the home map (computers and tablets; phones leave the globe the room). It shows the ${count === 1 ? "newest published entry" : `${count} newest published entries`}, by publish date — publish an entry and it takes the first tile.`}
      />

      <HomeCountForm count={count} canEdit={canEdit} />

      <section aria-labelledby="home-newest-title" className="mt-10">
        <h2 id="home-newest-title" className="font-display mb-3 text-[17px] font-bold">
          Newest published entries
        </h2>
        <DataTable
          tableKey="admin-home-newest"
          caption="The newest published entries and whether the home map shows them"
          searchPlaceholder="Search entries…"
          emptyTitle="No published entry yet — the home map shows no tiles"
          initialSort={{ key: "position", dir: "asc" }}
          stats={optionStats("shown", SHOWN)}
          maxRowActions={1}
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
              label: "Entry",
              sortable: true,
              filter: "text",
              width: "minmax(200px, 2fr)",
            },
            {
              key: "published",
              label: "Published",
              kind: "date",
              sortable: true,
              width: "130px",
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
          ]}
          rows={entries.map((entry, index) => ({
            id: entry.slug,
            values: {
              position: index + 1,
              title: entry.title,
              published: entry.publishedOn,
              shown: index < count ? "shown" : "over",
            },
            actions: <RowActions actions={[openAction(routes.entry(entry.slug))]} />,
          }))}
        />
      </section>
    </>
  );
}
