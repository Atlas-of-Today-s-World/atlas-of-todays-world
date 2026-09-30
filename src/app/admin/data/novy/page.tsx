import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { IndicatorForm } from "@/features/indicators/components/IndicatorForms";

export const metadata: Metadata = { title: "Nový ukazatel" };

export default async function NewIndicatorPage() {
  if (!(await sectionAccess("layers", "c"))) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Nový ukazatel"
        lead="Po založení zadáte hodnoty pro jednotlivé země — každou se zdrojem."
      />
      <IndicatorForm indicator={null} />
    </>
  );
}
