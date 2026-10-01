import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { IssueForm } from "@/features/portraits/components/HeaderForms";

export const metadata: Metadata = { title: "New global issue" };

export default async function NewIssuePage() {
  if (!(await sectionAccess("specials", "c"))) return <NoAccess />;
  const { countries } = await getPickerOptions();
  return (
    <>
      <PageHeader
        title="New global issue"
        lead="Once created, fill in the portrait sections (timeline, sources, FAQ…)."
      />
      <IssueForm issue={null} countries={countries} />
    </>
  );
}
