import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { editAction, openAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes, routes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { isPatronsText } from "@/features/membership/page-texts";
import { listSitePages } from "@/features/site-pages/editorial";
import { listUiTextOverrides } from "@/features/ui-texts/editorial";
import { SITE_PAGE_PATH } from "@/features/site-pages/pages";

export const metadata: Metadata = { title: "Site pages" };

const STATUS = [
  { value: "published", label: "Published", tone: "success" as const },
  { value: "default", label: "Built-in text", tone: "neutral" as const },
];

/**
 * Site pages (About, Privacy, Terms, Accessibility): text edited here and
 * published directly; every save is kept in the page's history. Atlas Patrons
 * is listed too: its texts are UI texts, edited section by section.
 */
export default async function SitePagesPage() {
  const access = await sectionAccess("site");
  if (!access) return <NoAccess />;
  const [pages, overrides] = await Promise.all([listSitePages(), listUiTextOverrides()]);
  const patronChanges = overrides.filter((row) => isPatronsText(row.key));
  const patronsHref = adminRoutes.sitePages("patrons");

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.sitePages.list)}
        title="Site pages"
        lead="About, privacy, terms, accessibility and Atlas Patrons. A save is published right away; every version of the text pages is kept and can be restored. An unpublished page shows its built-in text on the website."
      />
      <DataTable
        tableKey="admin-site-pages"
        caption="Site pages"
        searchPlaceholder="Search pages…"
        emptyTitle="No site pages"
        initialSort={{ key: "title", dir: "asc" }}
        stats={optionStats("status", STATUS)}
        maxRowActions={2}
        columns={[
          {
            key: "title",
            label: "Title",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(220px, 2fr)",
          },
          { key: "slug", label: "Address", kind: "code", sortable: true, width: "170px" },
          {
            key: "status",
            label: "Status",
            kind: "badge",
            options: STATUS,
            sortable: true,
            filter: "select",
            width: "150px",
          },
          {
            key: "updated",
            label: "Last updated",
            kind: "datetime",
            sortable: true,
            width: "170px",
          },
        ]}
        rows={[
          ...pages.map((page) => {
            const href = adminRoutes.sitePages(page.slug);
            return {
              id: page.slug,
              href,
              values: {
                title: page.title,
                slug: SITE_PAGE_PATH[page.slug],
                status: page.published ? "published" : "default",
                updated: page.updated_at,
              },
              actions: (
                <RowActions actions={[editAction(href), openAction(SITE_PAGE_PATH[page.slug])]} />
              ),
            };
          }),
          {
            id: "patrons",
            href: patronsHref,
            values: {
              title: "Atlas Patrons",
              slug: routes.membership,
              status: patronChanges.length ? "published" : "default",
              updated: patronChanges
                .map((row) => row.updated_at)
                .sort()
                .at(-1),
            },
            actions: (
              <RowActions actions={[editAction(patronsHref), openAction(routes.membership)]} />
            ),
          },
        ]}
      />
    </>
  );
}
