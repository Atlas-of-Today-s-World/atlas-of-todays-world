import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { sectionAccess } from "@/features/auth/access";
import { getAtlas } from "@/features/geography/queries";
import { ThemeForm } from "@/features/map/components/MapForms";

export const metadata: Metadata = { title: "Vzhled mapy" };

export default async function AppearancePage() {
  if (!(await sectionAccess("appearance"))) return <NoAccess />;
  const { theme } = await getAtlas();
  return (
    <>
      <PageHeader
        title="Vzhled mapy"
        lead={
          <>
            Celkový dojem z globusu. Barvy jednotlivých regionů se nastavují u regionu v sekci{" "}
            <Link href="/admin/regiony" className="text-[var(--color-link)] underline">
              Regiony a země
            </Link>
            , barvy vrstev u ukazatele.
          </>
        }
      />
      <ThemeForm saturation={theme.saturation} border={theme.border} />
    </>
  );
}
