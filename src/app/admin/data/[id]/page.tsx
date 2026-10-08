import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { deleteAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { can, sectionAccess } from "@/features/auth/access";
import { getPickerOptions } from "@/features/geography/queries";
import { deleteValue } from "@/features/indicators/actions";
import {
  CategoriesForm,
  IndicatorForm,
  ValueForm,
} from "@/features/indicators/components/IndicatorForms";
import { DeleteIndicator } from "@/features/indicators/components/DeleteIndicator";
import { indicatorForEdit } from "@/features/indicators/editorial";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Indicator" };

const ORIGIN = [
  { value: "import", label: "Import", tone: "neutral" as const },
  { value: "manual", label: "Manual", tone: "accent" as const },
];

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
            {indicator.is_custom ? "Custom editorial indicator." : "Imported indicator."}{" "}
            <Link href={routes.view(indicator.id)} className="text-[var(--color-link)] underline">
              View on site
            </Link>
          </>
        }
        actions={indicator.is_custom && canDelete ? <DeleteIndicator id={indicator.id} /> : null}
      />
      <IndicatorForm indicator={indicator} />

      {indicator.type === "categorical" ? (
        <section className="mt-12">
          <h2 className="font-display mb-4 text-[18px] font-bold">Categories</h2>
          <CategoriesForm id={indicator.id} initial={categories} />
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-display mb-1 text-[18px] font-bold">Manual value</h2>
        <p className="mb-4 text-[13px] text-[var(--color-ink-muted)]">
          Overrides a country&apos;s imported value or fills in a missing one. The next import
          won&apos;t overwrite manual values.
        </p>
        <ValueForm indicatorId={indicator.id} countries={countries} />
      </section>

      <section className="mt-12">
        <h2 className="font-display mb-4 text-[18px] font-bold">Values ({values.length})</h2>
        <DataTable
          tableKey="admin-indicator-values"
          caption={`Values of ${indicator.label}`}
          emptyTitle="No values yet"
          initialSort={{ key: "country", dir: "asc" }}
          stats={optionStats("origin", ORIGIN)}
          actionsWidth="48px"
          columns={[
            {
              key: "country",
              label: "Country",
              sortable: true,
              filter: "text",
              width: "minmax(180px, 2fr)",
            },
            { key: "iso3", label: "ISO3", kind: "code", sortable: true, width: "80px" },
            {
              key: "value",
              label: "Value",
              kind: "number",
              align: "right",
              sortable: true,
              width: "128px",
            },
            { key: "year", label: "Year", sortable: true, filter: "select", width: "88px" },
            {
              key: "origin",
              label: "Origin",
              kind: "badge",
              options: ORIGIN,
              sortable: true,
              filter: "select",
              width: "112px",
            },
            { key: "note", label: "Source note", filter: "text" },
          ]}
          rows={values.map((row) => {
            const country = name.get(row.country_iso3) ?? row.country_iso3;
            return {
              id: row.country_iso3,
              values: {
                country,
                iso3: row.country_iso3,
                value: Number(row.value),
                year: row.year === null ? null : String(row.year),
                origin: row.is_manual ? "manual" : "import",
                note: row.is_manual ? row.source_note : null,
              },
              actions:
                canDelete && row.is_manual ? (
                  <RowActions
                    actions={[
                      deleteAction(
                        deleteValue.bind(null, indicator.id, row.country_iso3),
                        `the value for ${country}`,
                        "The country will have no data in this layer until you enter or import it again.",
                      ),
                    ]}
                  />
                ) : undefined,
            };
          })}
        />
      </section>
    </>
  );
}
