import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { adminRoutes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { TemplateForm } from "@/features/entries/components/TopicTileForms";
import { getTemplate } from "@/features/entries/editorial";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Entry template" };

/** One template: name, headings and tiles. */
export default async function TopicTemplatePage({
  params,
  searchParams,
}: PageProps<"/admin/entry-templates/[id]">) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const template = await getTemplate(id);
  if (!template) notFound();
  const { saved } = await searchParams;

  return (
    <>
      <PageHeader
        title={template.name}
        lead={
          <span className="flex flex-wrap items-center gap-3">
            {template.is_default ? <Badge tone="accent">Default for new entries</Badge> : null}
            <Link
              href={adminRoutes.entryTemplates.list}
              className="text-[var(--color-link)] underline"
            >
              All templates
            </Link>
            {saved ? <span role="status">Template created.</span> : null}
          </span>
        }
      />
      <div>
        <TemplateForm template={template} />
      </div>
    </>
  );
}
