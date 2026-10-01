import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/admin/DataTable";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import {
  CategoriesForm,
  DeleteValue,
  IndicatorForm,
  ValueForm,
} from "@/features/indicators/components/IndicatorForms";
import { DeleteIndicator } from "@/features/indicators/components/DeleteIndicator";
import { indicatorForEdit } from "@/features/indicators/editorial";

export const metadata: Metadata = { title: "Ukazatel" };

export default async function IndicatorPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await sectionAccess("layers");
  if (!access) return <NoAccess />;
  const { id } = await params;
  const [data, { countries }] = await Promise.all([indicatorForEdit(id), getPickerOptions()]);
  if (!data) notFound();
  const { indicator, categories, values } = data;
  const name = new Map(countries.map((c) => [c.iso3, c.name]));
  const canDelete = can(access.permissions, "layers", "d");

  return (
    <>
      <PageHeader
        title={indicator.label}
        lead={
          <>
            {indicator.is_custom ? "Vlastní ukazatel redakce." : "Importovaný ukazatel."}{" "}
            <Link href={`/view/${indicator.id}`} className="text-[var(--color-link)] underline">
              Zobrazit na webu
            </Link>
          </>
        }
        actions={indicator.is_custom && canDelete ? <DeleteIndicator id={indicator.id} /> : null}
      />
      <IndicatorForm indicator={indicator} />

      {indicator.type === "categorical" ? (
        <section className="mt-12">
          <h2 className="font-display mb-4 text-[18px] font-bold">Kategorie</h2>
          <CategoriesForm id={indicator.id} initial={categories} />
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display mb-1 text-[18px] font-bold">Ruční hodnota</h2>
        <p className="mb-4 text-[13px] text-[var(--color-ink-muted)]">
          Přepíše importovanou hodnotu země, nebo doplní chybějící. Příští import ruční hodnoty
          nepřepíše.
        </p>
        <ValueForm indicatorId={indicator.id} countries={countries} />
      </section>

      <section className="mt-12">
        <h2 className="font-display mb-4 text-[18px] font-bold">Hodnoty ({values.length})</h2>
        <DataTable
          caption="Hodnoty ukazatele"
          rows={values}
          rowKey={(row) => row.country_iso3}
          columns={[
            {
              key: "country",
              header: "Země",
              cell: (row) => name.get(row.country_iso3) ?? row.country_iso3,
            },
            {
              key: "value",
              header: "Hodnota",
              cell: (row) => Number(row.value).toLocaleString("cs-CZ"),
            },
            { key: "year", header: "Rok", cell: (row) => row.year ?? "—" },
            {
              key: "source",
              header: "Původ",
              wide: true,
              cell: (row) => (row.is_manual ? `Ručně: ${row.source_note}` : "Import"),
            },
            {
              key: "actions",
              header: "",
              end: true,
              cell: (row) =>
                canDelete && row.is_manual ? (
                  <DeleteValue
                    indicatorId={indicator.id}
                    iso3={row.country_iso3}
                    name={name.get(row.country_iso3) ?? row.country_iso3}
                  />
                ) : null,
            },
          ]}
        />
      </section>
    </>
  );
}
