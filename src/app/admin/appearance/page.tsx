import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { adminRoutes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { ThemeForm } from "@/features/map/components/MapForms";

export const metadata: Metadata = { title: "Map appearance" };

export default async function AppearancePage() {
  if (!(await sectionAccess("appearance"))) forbidden();
  const { theme } = await getAtlas();
  return (
    <>
      <PageHeader
        title="Map appearance"
        lead={
          <>
            The overall look of the globe. Region colors are set on each region under{" "}
            <Link href={adminRoutes.regions.list} className="text-[var(--color-link)] underline">
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
