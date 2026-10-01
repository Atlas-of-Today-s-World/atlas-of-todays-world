import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { can, sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";

export const metadata: Metadata = { title: "Global Issues" };

export default async function IssuesPage() {
  const access = await sectionAccess("specials");
  if (!access) return <NoAccess />;
  const { issues } = await getAtlas();

  return (
    <>
      <PageHeader
        title="Global Issues"
        lead="Groups of countries across regions (war, migration, climate…). Each has its own portrait on the site."
        actions={
          can(access.permissions, "specials", "c") ? (
            <Link href="/admin/global-issues/new" className={buttonVariants()}>
              New global issue
            </Link>
          ) : null
        }
      />
      <DataTable
        caption="Global Issues"
        rows={issues}
        rowKey={(issue) => issue.slug}
        columns={[
          {
            key: "color",
            header: "",
            cell: (issue) => (
              <span
                aria-hidden
                className="block size-4 rounded-full"
                style={{ background: issue.fill }}
              />
            ),
          },
          {
            key: "name",
            header: "Name",
            cell: (issue) => (
              <Link
                href={`/admin/global-issues/${issue.slug}`}
                className="font-medium hover:underline"
              >
                {issue.name}
              </Link>
            ),
          },
          { key: "subtitle", header: "Subtitle", cell: (issue) => issue.subtitle, wide: true },
          {
            key: "countries",
            header: "Countries",
            cell: (issue) => issue.countries.length,
            end: true,
          },
        ]}
      />
    </>
  );
}
