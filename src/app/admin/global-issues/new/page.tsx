import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { IssueForm } from "@/features/portraits/components/HeaderForms";
import { GROUP_KIND_LABEL } from "@/features/portraits/constants";

export const metadata: Metadata = { title: "New global issue" };

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  if (!(await sectionAccess("specials", "c"))) return <NoAccess />;
  const kind = (await searchParams).kind === "region" ? "region" : "issue";
  const { countries } = await getPickerOptions();
  return (
    <>
      <PageHeader
        title={`New ${GROUP_KIND_LABEL[kind].toLowerCase()}`}
        lead={
          kind === "region"
            ? "Pick the countries that make up your region. Once created, add indicators, timeline, sources and articles."
            : "Once created, fill in the portrait sections (indicators, timeline, sources, FAQ…)."
        }
      />
      <IssueForm issue={null} countries={countries} defaultKind={kind} />
    </>
  );
}
