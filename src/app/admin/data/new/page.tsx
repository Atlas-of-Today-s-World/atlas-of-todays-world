import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { IndicatorForm } from "@/features/indicators/components/IndicatorForms";

export const metadata: Metadata = { title: "New indicator" };

export default async function NewIndicatorPage() {
  if (!(await sectionAccess("layers", "c"))) forbidden();
  return (
    <>
      <PageHeader
        title="New indicator"
        lead="Once created, enter values for individual countries — each with a source."
      />
      <IndicatorForm indicator={null} />
    </>
  );
}
