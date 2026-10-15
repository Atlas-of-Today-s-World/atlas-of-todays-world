import { Select } from "@/components/ui/field";

/** A place to pick: a region, a global issue or a custom region. */
export interface PlaceOption {
  slug: string;
  name: string;
}

/**
 * Pick one region (or group) by slug, with an empty first choice — the
 * select the article and country forms share. The form receives the slug,
 * or "" for none.
 */
export function RegionSelect({
  id = "region_slug",
  name = id,
  options,
  defaultValue,
  emptyLabel = "— no region —",
}: {
  id?: string;
  name?: string;
  options: PlaceOption[];
  defaultValue: string | null | undefined;
  emptyLabel?: string;
}) {
  return (
    <Select id={id} name={name} defaultValue={defaultValue ?? ""}>
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option.slug} value={option.slug}>
          {option.name}
        </option>
      ))}
    </Select>
  );
}
