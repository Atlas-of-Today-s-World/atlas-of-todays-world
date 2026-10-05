import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { sectionAccess } from "@/features/auth/access";
import { TemplateForm } from "@/features/entries/components/TopicTileForms";
import { getTemplate } from "@/features/entries/editorial";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Topic template" };

/** One template: name, headings and tiles. */
export default async function TopicTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
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
            {template.is_default ? <Badge tone="accent">Default for new topics</Badge> : null}
            <Link href="/admin/topic-templates" className="text-[var(--color-link)] underline">
              All templates
            </Link>
            {saved ? <span role="status">Template created.</span> : null}
          </span>
        }
      />
      <div className="max-w-5xl">
        <TemplateForm template={template} />
      </div>
    </>
  );
}
