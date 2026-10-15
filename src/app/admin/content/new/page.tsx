import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { listAuthors } from "@/features/authors/editorial";
import { EntryForm } from "@/features/entries/components/EntryForm";
import { getPickerOptions } from "@/features/geography/queries";

export const metadata: Metadata = { title: "New article" };

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  if (!(await sectionAccess("news", "c"))) return <NoAccess />;
  const topic = (await searchParams).kind === "entry";
  const [options, authors] = await Promise.all([getPickerOptions(), listAuthors()]);
  return (
    <>
      <PageHeader
        title={topic ? "New topic" : "New article"}
        lead={
          topic
            ? "The topic is created as your draft with the default template's resource tiles; add subtopics and links after saving. It goes live only after approval."
            : "The article is created as your draft. It goes live only after approval."
        }
      />
      <EntryForm
        entry={null}
        authors={authors}
        defaultKind={topic ? "entry" : "news"}
        {...options}
      />
    </>
  );
}
