import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { listAuthors } from "@/features/authors/editorial";
import { EntryForm } from "@/features/entries/components/EntryForm";
import { getPickerOptions } from "@/features/geography/queries";

export const metadata: Metadata = { title: "New article" };

export default async function NewEntryPage() {
  if (!(await sectionAccess("news", "c"))) return <NoAccess />;
  const [options, authors] = await Promise.all([getPickerOptions(), listAuthors()]);
  return (
    <>
      <PageHeader
        title="New article"
        lead="The article is created as your draft. It goes live only after approval."
      />
      <EntryForm entry={null} authors={authors} {...options} />
    </>
  );
}
