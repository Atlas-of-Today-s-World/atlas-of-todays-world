import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { ThemeForm } from "@/features/map/components/MapForms";

export const metadata: Metadata = { title: "Map appearance" };

export default async function AppearancePage() {
  if (!(await sectionAccess("appearance"))) return <NoAccess />;
  const { theme } = await getAtlas();
  return (
    <>
      <PageHeader
        title="Map appearance"
        lead={
          <>
            The overall look of the globe. Region colors are set on each region under{" "}
            <Link href="/admin/regions" className="text-[var(--color-link)] underline">
              Regions & countries
            </Link>
            ; layer colors on each indicator.
          </>
        }
      />
      <ThemeForm saturation={theme.saturation} border={theme.border} />
    </>
  );
}
