import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { IssueForm } from "@/features/portraits/components/HeaderForms";

export const metadata: Metadata = { title: "Nový global issue" };

export default async function NewIssuePage() {
  if (!(await sectionAccess("specials", "c"))) return <NoAccess />;
  const { countries } = await getPickerOptions();
  return (
    <>
      <PageHeader
        title="Nový global issue"
        lead="Po založení doplníte sekce portrétu (časová osa, zdroje, FAQ…)."
      />
      <IssueForm issue={null} countries={countries} />
    </>
  );
}
