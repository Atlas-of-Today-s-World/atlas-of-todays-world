import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { EntryForm } from "@/features/entries/components/EntryForm";
import { getPickerOptions } from "@/features/geography/queries";

export const metadata: Metadata = { title: "Nový článek" };

export default async function NewEntryPage() {
  if (!(await sectionAccess("news", "c"))) return <NoAccess />;
  const options = await getPickerOptions();
  return (
    <>
      <PageHeader
        title="Nový článek"
        lead="Článek vznikne jako váš koncept. Na web se dostane až po schválení."
      />
      <EntryForm entry={null} {...options} />
    </>
  );
}
