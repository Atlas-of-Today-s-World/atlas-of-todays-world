import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { AreaForm, DeleteArea } from "@/features/map/components/MapForms";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mapová plocha" };

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const creating = slug === "nova";
  const access = await sectionAccess("areas", creating ? "c" : "v");
  if (!access) return <NoAccess />;

  const [{ countries }, area] = await Promise.all([
    getPickerOptions(),
    creating
      ? Promise.resolve(null)
      : createServerClient().then((db) =>
          db
            .from("map_areas")
            .select("slug, name, label, note, fill, stroke, country_iso3, geometry")
            .eq("slug", slug)
            .maybeSingle()
            .then(({ data }) => data),
        ),
  ]);
  if (!creating && !area) notFound();

  return (
    <>
      <PageHeader
        title={area?.name ?? "Nová plocha"}
        actions={
          area && can(access.permissions, "areas", "d") ? <DeleteArea slug={area.slug} /> : null
        }
      />
      <AreaForm area={area} countries={countries} />
    </>
  );
}
