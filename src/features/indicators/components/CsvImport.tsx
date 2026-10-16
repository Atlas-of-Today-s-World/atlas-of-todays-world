"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { DataTable } from "@/components/data-table/DataTable";
import { optionStats } from "@/components/data-table/stats";
import type { FilterOption } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/field";
import { countryMatcher, type MatchCountry } from "@/features/geography/country-match";
import type { ActionState } from "@/lib/action-state";
import { CSV_DELIMITERS, parseCsv, type CsvDelimiter } from "@/lib/csv";
import { importValues } from "../actions";
import { IMPORT_LIMITS } from "../constants";
import {
  buildPreview,
  guessMapping,
  SKIP,
  toTable,
  yearInHeading,
  type Category,
  type CurrentValue,
  type DecimalMark,
  type Mapping,
  type RowStatus,
  type Table,
} from "../import-model";

const DELIMITER_LABEL: Record<CsvDelimiter, string> = {
  ",": "Comma",
  ";": "Semicolon",
  "\t": "Tab",
};

const STATUS: (FilterOption & { value: RowStatus })[] = [
  { value: "add", label: "New", tone: "success" },
  { value: "change", label: "Changed", tone: "accent" },
  { value: "same", label: "Same", tone: "neutral" },
  { value: "remove", label: "Removed", tone: "danger" },
  { value: "skip", label: "Skipped", tone: "warning" },
  { value: "error", label: "Error", tone: "danger" },
];

const IDLE: ActionState = { ok: false };

const bytes = (text: string) => new TextEncoder().encode(text).length;

interface Loaded {
  text: string;
  name: string;
  table: Table;
  delimiter: "auto" | CsvDelimiter;
  mapping: Mapping;
  warning: string;
}

/**
 * "Import CSV" on a data layer's page: read a file (or pasted text) in the
 * browser, pick the columns, match the countries, see what changes, then
 * write it in one call (importValues → import_indicator_values). Nothing
 * reaches the server before the confirmation.
 */
export function CsvImport({
  indicator,
  categories,
  countries,
  current,
  canRemove,
}: {
  indicator: { id: string; label: string; source: string; categorical: boolean };
  categories: Category[];
  /** Atlas countries sorted by name. */
  countries: MatchCountry[];
  current: CurrentValue[];
  /** Layers "d": replacing may remove values. */
  canRemove: boolean;
}) {
  const router = useRouter();
  const match = useMemo(() => countryMatcher(countries), [countries]);
  const names = useMemo(() => new Map(countries.map((c) => [c.iso3, c.name])), [countries]);
  const codeList = indicator.categorical ? categories : null;

  const [pasted, setPasted] = useState("");
  const [readError, setReadError] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [replace, setReplace] = useState(canRemove);
  const [source, setSource] = useState(indicator.source);
  const [result, setResult] = useState<ActionState>(IDLE);

  /** Reads the text into a table and guesses the columns (a new file starts over). */
  function load(text: string, name: string, delimiter: "auto" | CsvDelimiter = "auto") {
    setResult(IDLE);
    if (bytes(text) > IMPORT_LIMITS.bytes) {
      setReadError(`The file is larger than ${IMPORT_LIMITS.bytes / 1_000_000} MB.`);
      return;
    }
    const records = delimiter === "auto" ? parseCsv(text) : parseCsv(text, delimiter);
    if (records.length > IMPORT_LIMITS.records + 10) {
      setReadError(
        `The file has more than ${IMPORT_LIMITS.records.toLocaleString("en")} rows. Keep only the years you need.`,
      );
      return;
    }
    const table = toTable(records);
    if (!table || !table.rows.length) {
      setReadError("No table found: the file needs a row of column names and rows of data.");
      return;
    }
    setReadError("");
    setChoices({});
    setLoaded({
      text,
      name,
      table,
      delimiter,
      mapping: guessMapping(table, match, codeList),
      warning: text.includes("\ufffd")
        ? "The file isn't saved as UTF-8, so letters with accents may be wrong. In Excel use Save as → CSV UTF-8."
        : "",
    });
  }

  const setMapping = (change: Partial<Mapping>) =>
    setLoaded((now) => (now ? { ...now, mapping: { ...now.mapping, ...change } } : now));

  const ready = loaded && loaded.mapping.country >= 0 && loaded.mapping.value >= 0;
  const preview = useMemo(
    () =>
      ready
        ? buildPreview({
            table: loaded.table,
            mapping: loaded.mapping,
            match,
            choices,
            categories: codeList,
            current,
            replace,
          })
        : null,
    [ready, loaded, match, choices, codeList, current, replace],
  );

  const counts = preview?.counts;
  const tooMany = preview ? preview.rows.length > IMPORT_LIMITS.rows : false;
  const canImport = Boolean(preview?.rows.length) && !tooMany && source.trim() !== "";
  const header = loaded?.table.header ?? [];
  const columnOptions = header.map((heading, index) => (
    <option key={index} value={index}>
      {heading}
    </option>
  ));

  return (
    <div className="grid gap-6 rounded-2xl border border-[var(--color-line)] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="csv-file"
          label="CSV file"
          hint={`Up to ${IMPORT_LIMITS.bytes / 1_000_000} MB, separated by commas, semicolons or tabs. World Bank and Our World in Data downloads work as they are.`}
        >
          <Input
            id="csv-file"
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            className="py-2"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > IMPORT_LIMITS.bytes) {
                setReadError(`The file is larger than ${IMPORT_LIMITS.bytes / 1_000_000} MB.`);
                return;
              }
              load(await file.text(), file.name);
            }}
          />
        </FormField>
        <details className="rounded-xl border border-[var(--color-line)] p-3 sm:self-start">
          <summary className="cursor-pointer text-[13px] font-medium">Or paste the data</summary>
          <div className="mt-3 grid gap-2">
            <label htmlFor="csv-paste" className="sr-only">
              Pasted CSV
            </label>
            <Textarea
              id="csv-paste"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder={"Country,Value,Year\nCzechia,12.5,2024"}
              className="font-mono text-[12.5px]"
            />
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={!pasted.trim()}
                onClick={() => load(pasted, "Pasted data")}
              >
                Read pasted data
              </Button>
            </div>
          </div>
        </details>
      </div>
      {readError ? (
        <p
          role="alert"
          className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[var(--color-danger)]"
        >
          {readError}
        </p>
      ) : null}

      {loaded ? (
        <div className="grid gap-4">
          <h3 className="font-display text-[16px] font-bold">
            Columns of “{loaded.name}” ({loaded.table.rows.length.toLocaleString("en")} rows)
          </h3>
          {loaded.warning ? (
            <p className="rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-[13px] text-[var(--color-warning)]">
              {loaded.warning}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              id="csv-country"
              label="Country column"
              required
              hint="ISO3 or ISO2 codes, or country names."
            >
              <Select
                id="csv-country"
                required
                value={loaded.mapping.country}
                onChange={(event) => {
                  setChoices({});
                  setMapping({ country: Number(event.target.value) });
                }}
              >
                <option value={-1} disabled>
                  Choose…
                </option>
                {columnOptions}
              </Select>
            </FormField>
            <FormField
              id="csv-value"
              label="Value column"
              required
              hint={
                indicator.categorical
                  ? "Category codes or category names."
                  : "Numbers like 1234.5, 1,234.5, 1 234,5 or 12.5% (read as 12.5)."
              }
            >
              <Select
                id="csv-value"
                required
                value={loaded.mapping.value}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setMapping({
                    value,
                    defaultYear: yearInHeading(header[value] ?? "") ?? loaded.mapping.defaultYear,
                  });
                }}
              >
                <option value={-1} disabled>
                  Choose…
                </option>
                {columnOptions}
              </Select>
            </FormField>
            <FormField id="csv-year" label="Year column" hint="Optional.">
              <Select
                id="csv-year"
                value={loaded.mapping.year}
                onChange={(event) => setMapping({ year: Number(event.target.value) })}
              >
                <option value={-1}>None</option>
                {columnOptions}
              </Select>
            </FormField>
            <FormField
              id="csv-note"
              label="Note column"
              hint={`Optional, up to ${IMPORT_LIMITS.note} characters (“estimate”).`}
            >
              <Select
                id="csv-note"
                value={loaded.mapping.note}
                onChange={(event) => setMapping({ note: Number(event.target.value) })}
              >
                <option value={-1}>None</option>
                {columnOptions}
              </Select>
            </FormField>
            <FormField
              id="csv-year-default"
              label="Year for rows without one"
              hint="Optional. Filled in when the value column's heading is a year."
            >
              <Input
                id="csv-year-default"
                type="number"
                min={IMPORT_LIMITS.yearMin}
                max={IMPORT_LIMITS.yearMax}
                value={loaded.mapping.defaultYear ?? ""}
                onChange={(event) => {
                  const year = Number(event.target.value);
                  setMapping({
                    defaultYear:
                      event.target.value &&
                      Number.isInteger(year) &&
                      year >= IMPORT_LIMITS.yearMin &&
                      year <= IMPORT_LIMITS.yearMax
                        ? year
                        : null,
                  });
                }}
              />
            </FormField>
            {indicator.categorical ? null : (
              <FormField id="csv-decimal" label="Decimal mark">
                <Select
                  id="csv-decimal"
                  value={loaded.mapping.decimal}
                  onChange={(event) =>
                    setMapping({ decimal: event.target.value as "auto" | DecimalMark })
                  }
                >
                  <option value="auto">
                    Detect ({preview?.decimal === "," ? "comma" : "dot"})
                  </option>
                  <option value=".">Dot: 1,234.5</option>
                  <option value=",">Comma: 1 234,5</option>
                </Select>
              </FormField>
            )}
            <FormField id="csv-delimiter" label="Separator">
              <Select
                id="csv-delimiter"
                value={loaded.delimiter}
                onChange={(event) =>
                  load(loaded.text, loaded.name, event.target.value as "auto" | CsvDelimiter)
                }
              >
                <option value="auto">Detect</option>
                {CSV_DELIMITERS.map((delimiter) => (
                  <option key={delimiter} value={delimiter}>
                    {DELIMITER_LABEL[delimiter]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>
      ) : null}

      {preview && counts ? (
        <div className="grid gap-4">
          <h3 className="font-display text-[16px] font-bold">Preview</h3>
          <p className="text-[13.5px] leading-relaxed">
            <strong>{preview.rows.length}</strong> countries ready: {counts.add} new,{" "}
            {counts.change} changed, {counts.same} already the same
            {replace ? `, ${counts.remove} removed (not in the file)` : ""}. Skipped rows:{" "}
            {counts.aggregates} groups of countries (world, regions, income groups),{" "}
            {counts.duplicates} repeats of a country, {counts.error} with errors,{" "}
            {counts.skip - counts.aggregates - counts.duplicates} without a value or an unknown
            country.
          </p>
          {tooMany ? (
            <p role="alert" className="text-[13px] text-[var(--color-danger)]">
              At most {IMPORT_LIMITS.rows} countries can be imported at once.
            </p>
          ) : null}

          {preview.unmatched.length ? (
            <div className="grid gap-2">
              <h4 className="text-[14px] font-semibold">
                Names not recognised ({preview.unmatched.length})
              </h4>
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                Pick the country each name means, or skip it. Rows left on “Choose…” are skipped.
              </p>
              <DataTable
                tableKey="admin-indicator-import-unmatched"
                caption="Names not recognised"
                compact
                columns={[
                  {
                    key: "cell",
                    label: "Name in the file",
                    sortable: true,
                    width: "minmax(180px, 2fr)",
                  },
                  { key: "rows", label: "Rows", width: "minmax(100px, 1fr)" },
                  { key: "choice", label: "Country", width: "minmax(220px, 2fr)" },
                ]}
                rows={preview.unmatched.map((item, index) => ({
                  id: item.cell,
                  values: {
                    cell: item.cell,
                    rows: item.rows.slice(0, 8).join(", ") + (item.rows.length > 8 ? " …" : ""),
                    choice: choices[item.cell] ?? "",
                  },
                  cells: {
                    choice: (
                      <Select
                        aria-label={`Country for “${item.cell}”`}
                        id={`csv-choice-${index}`}
                        value={choices[item.cell] ?? ""}
                        onChange={(event) =>
                          setChoices((now) => ({ ...now, [item.cell]: event.target.value }))
                        }
                        className="min-h-8"
                      >
                        <option value="">Choose…</option>
                        <option value={SKIP}>Skip this name</option>
                        {countries.map((country) => (
                          <option key={country.iso3} value={country.iso3}>
                            {country.name}
                          </option>
                        ))}
                      </Select>
                    ),
                  },
                }))}
              />
            </div>
          ) : null}

          <DataTable
            tableKey="admin-indicator-import-preview"
            caption={`Import preview for ${indicator.label}`}
            emptyTitle="No rows"
            stats={optionStats("status", STATUS)}
            initialSort={{ key: "row", dir: "asc" }}
            columns={[
              { key: "row", label: "Row", kind: "number", sortable: true, width: "72px" },
              {
                key: "cell",
                label: "In the file",
                sortable: true,
                filter: "text",
                width: "minmax(140px, 1.5fr)",
              },
              {
                key: "country",
                label: "Country",
                sortable: true,
                filter: "text",
                width: "minmax(160px, 1.5fr)",
              },
              {
                key: "value",
                label: "Value",
                kind: "number",
                align: "right",
                sortable: true,
                width: "112px",
              },
              { key: "year", label: "Year", sortable: true, filter: "select", width: "80px" },
              {
                key: "status",
                label: "Result",
                kind: "badge",
                options: STATUS,
                sortable: true,
                filter: "select",
                width: "112px",
              },
              { key: "message", label: "Note", filter: "text", width: "minmax(200px, 3fr)" },
            ]}
            rows={preview.lines.map((line, index) => ({
              id: String(index),
              values: {
                row: line.row,
                cell: line.cell,
                country: line.iso3 ? (names.get(line.iso3) ?? line.iso3) : null,
                value: line.value,
                year: line.year === null ? null : String(line.year),
                status: line.status,
                message: line.note ? `${line.message} Note: ${line.note}` : line.message,
              },
            }))}
          />

          <fieldset className="grid gap-2">
            <legend className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
              What to do with the current values
            </legend>
            <label className="flex min-h-(--touch-min) items-start gap-2 text-[14px]">
              <input
                type="radio"
                name="csv-mode"
                className="mt-1"
                checked={replace}
                disabled={!canRemove}
                onChange={() => setReplace(true)}
              />
              <span>
                Replace all values of this layer
                <span className="block text-[12px] text-[var(--color-ink-muted)]">
                  {canRemove
                    ? "Countries missing from the file lose their value."
                    : "Needs delete permission for data layers, because countries missing from the file lose their value."}
                </span>
              </span>
            </label>
            <label className="flex min-h-(--touch-min) items-start gap-2 text-[14px]">
              <input
                type="radio"
                name="csv-mode"
                className="mt-1"
                checked={!replace}
                onChange={() => setReplace(false)}
              />
              <span>
                Update only the countries in the file
                <span className="block text-[12px] text-[var(--color-ink-muted)]">
                  The other countries keep their values.
                </span>
              </span>
            </label>
          </fieldset>

          <FormField
            id="csv-source"
            label="Source of the imported values"
            required
            hint="Who published the numbers, and which edition (“World Bank WDI, July 2026”). Saved with every imported value."
          >
            <Input
              id="csv-source"
              required
              maxLength={IMPORT_LIMITS.source}
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </FormField>
          <p className="text-[12.5px] text-[var(--color-ink-muted)]">
            Imported values count as manual values: they keep the source above, and the next
            automatic data update won&apos;t overwrite them.
          </p>

          <ActionStatus state={result} />
          <div>
            {canImport ? (
              <ConfirmButton
                label={replace ? "Replace values" : "Import values"}
                variant={replace && counts.remove > 0 ? "danger" : "primary"}
                size="md"
                title={`${replace ? "Replace the values of" : "Import into"} “${indicator.label}”?`}
                body={`${counts.add} values will be added, ${counts.change} changed${
                  replace
                    ? ` and ${counts.remove} removed (the countries missing from the file)`
                    : "; countries missing from the file keep their values"
                }. ${counts.same} are already the same.`}
                action={() =>
                  importValues({
                    indicator_id: indicator.id,
                    replace,
                    source_note: source,
                    rows: preview.rows,
                  })
                }
                onDone={(state) => {
                  setResult(state);
                  if (state.ok) router.refresh();
                }}
              />
            ) : (
              <Button disabled>{replace ? "Replace values" : "Import values"}</Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
