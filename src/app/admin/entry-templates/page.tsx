import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { confirmAction, deleteAction, editAction } from "@/components/data-table/row-actions";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { listTemplates } from "@/features/entries/editorial";
import { deleteTemplate, setDefaultTemplate } from "@/features/entries/template-actions";

export const metadata: Metadata = { title: "Entry templates" };

/**
 * Topic templates: named sets of "Learn more" tiles and section headings. A new
 * topic starts from the default one; any topic can re-apply another template.
 * Changing templates needs the right over all articles (RLS).
 */
export default async function TopicTemplatesPage() {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const templates = await listTemplates();
  const canEdit = can(access.permissions, "news", "e");
  const canDelete = can(access.permissions, "news", "d");

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.entryTemplates.list)}
        title="Entry templates"
        lead="Resource tiles an entry starts with (Videos & Documentaries, Stats…) with their icons, backgrounds and section headings. A new entry copies the default template; an entry’s Learn more tab can apply another one."
        actions={
          can(access.permissions, "news", "c") ? (
            <Link href={adminRoutes.entryTemplates.new} className={buttonVariants({ size: "sm" })}>
              New template
            </Link>
          ) : null
        }
      />
      <DataTable
        tableKey="admin-topic-templates"
        caption="Entry templates"
        emptyTitle="No templates"
        initialSort={{ key: "name", dir: "asc" }}
        maxRowActions={1 + (canEdit ? 1 : 0) + (canDelete ? 1 : 0)}
        columns={[
          {
            key: "name",
            label: "Name",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 2fr)",
          },
          { key: "tiles", label: "Tiles", filter: "text", width: "minmax(220px, 3fr)" },
          { key: "count", label: "Count", kind: "number", align: "right", width: "90px" },
          { key: "default", label: "Default", filter: "select", width: "110px" },
        ]}
        rows={templates.map((template) => ({
          id: template.id,
          href: adminRoutes.entryTemplates(template.id),
          values: {
            name: template.name,
            tiles: template.tiles.map((tile) => tile.label).join(" · "),
            count: template.tiles.length,
            default: template.is_default ? "Default" : "",
          },
          actions: (
            <RowActions
              actions={[
                editAction(adminRoutes.entryTemplates(template.id)),
                ...(canEdit && !template.is_default
                  ? [
                      confirmAction(
                        "approve",
                        "Make default",
                        setDefaultTemplate.bind(null, template.id),
                        `Make “${template.name}” the default?`,
                        "New entries will start from this template. Existing entries don’t change.",
                      ),
                    ]
                  : []),
                ...(canDelete && !template.is_default
                  ? [
                      deleteAction(
                        deleteTemplate.bind(null, template.id),
                        `template ${template.name}`,
                        "Entries made from it keep their tiles.",
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
