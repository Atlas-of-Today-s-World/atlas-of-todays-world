import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction, editAction, openAction } from "@/components/data-table/row-actions";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { deleteIssue } from "@/features/portraits/actions";
import { GROUP_KIND_LABEL } from "@/features/portraits/constants";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Global issues" };

export default async function IssuesPage() {
  const access = await sectionAccess("specials");
  if (!access) return <NoAccess />;
  const { issues } = await getAtlas();
  const canDelete = can(access.permissions, "specials", "d");

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/global-issues")}
        title="Global issues"
        lead="Made by hand from selected countries: global issues around a theme (routes, conflicts, crises) and custom regions."
        actions={
          can(access.permissions, "specials", "c") ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/global-issues/new?kind=region"
                className={buttonVariants({ size: "sm" })}
              >
                New custom region
              </Link>
              <Link
                href="/admin/global-issues/new"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                New global issue
              </Link>
            </div>
          ) : null
        }
      />
      <DataTable
        tableKey="admin-issues"
        caption="Global issues and custom regions"
        emptyTitle="No global issues yet"
        initialSort={{ key: "name", dir: "asc" }}
        actionsWidth={canDelete ? "96px" : "72px"}
        columns={[
          { key: "color", label: "Colour", kind: "color", width: "64px", noExport: true },
          {
            key: "name",
            label: "Name",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 2fr)",
          },
          { key: "type", label: "Type", sortable: true, filter: "select", width: "140px" },
          { key: "subtitle", label: "Subtitle", sortable: true, filter: "text" },
          { key: "countries", label: "Countries", kind: "tags", filter: "select" },
          {
            key: "count",
            label: "Count",
            kind: "number",
            align: "right",
            sortable: true,
            width: "88px",
          },
        ]}
        rows={issues.map((issue) => ({
          id: issue.slug,
          href: `/admin/global-issues/${issue.slug}`,
          values: {
            color: issue.fill,
            name: issue.name,
            type: GROUP_KIND_LABEL[issue.kind],
            subtitle: issue.subtitle,
            countries: issue.countries,
            count: issue.countries.length,
          },
          actions: (
            <RowActions
              actions={[
                editAction(`/admin/global-issues/${issue.slug}`),
                openAction(routes.issue(issue.slug)),
                ...(canDelete
                  ? [
                      deleteAction(
                        deleteIssue.bind(null, issue.slug),
                        `${GROUP_KIND_LABEL[issue.kind].toLowerCase()} ${issue.name}`,
                        "Its portrait disappears from the site. The countries stay.",
                      ),
                    ]
                  : []),
              ]}
            />
          ),
        }))}
      />
    </>
  );
}
