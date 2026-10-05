import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { TemplateForm } from "@/features/entries/components/TopicTileForms";
import { listTemplates } from "@/features/entries/editorial";

export const metadata: Metadata = { title: "New topic template" };

/** A new template starts as a copy of the default one. */
export default async function NewTopicTemplatePage() {
  const access = await sectionAccess("news");
  if (!access || !can(access.permissions, "news", "c")) return <NoAccess />;
  const base = (await listTemplates()).find((template) => template.is_default);

  return (
    <>
      <PageHeader
        title="New topic template"
        lead={
          <Link href="/admin/topic-templates" className="text-[var(--color-link)] underline">
            All templates
          </Link>
        }
      />
      <div className="max-w-5xl">
        <TemplateForm
          template={
            base
              ? {
                  ...base,
                  id: "",
                  name: "",
                  is_default: false,
                  tiles: base.tiles.map((tile) => ({ ...tile, id: "" })),
                }
              : null
          }
        />
      </div>
    </>
  );
}
