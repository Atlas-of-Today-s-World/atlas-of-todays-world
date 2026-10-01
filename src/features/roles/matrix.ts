// Permission matrix rules without React or server (tested by matrix.test.ts).
import { ADMIN_NAV } from "@/config/admin-nav";
import { SECTIONS, type Action, type Section } from "@/features/auth/sections";
import { SECTION_LABEL } from "./labels";

/** Order of actions in the DB string (`role_permissions.actions`). */
export const ACTIONS = ["v", "c", "e", "d"] as const satisfies readonly Action[];

export type RoleGrants = Partial<Record<Section, string>>;

/**
 * New section actions after clicking one checkbox. Same rule as `MatrixInput`
 * and the DB: without "v" nothing else applies, so checking c/e/d also adds
 * "v" and unchecking "v" clears everything.
 */
export function toggleAction(current: string, action: Action, checked: boolean): string {
  const next = new Set(
    current.split("").filter((char) => (ACTIONS as readonly string[]).includes(char)),
  );
  if (checked) {
    next.add(action);
    next.add("v");
  } else if (action === "v") {
    next.clear();
  } else {
    next.delete(action);
  }
  return ACTIONS.filter((item) => next.has(item)).join("");
}

/** FormData for `saveMatrix`: the whole role, `perm:<section>` = individual actions. */
export function matrixFormData(roleId: string, grants: RoleGrants): FormData {
  const data = new FormData();
  data.set("role_id", roleId);
  for (const section of SECTIONS) {
    for (const action of grants[section] ?? "") data.append(`perm:${section}`, action);
  }
  return data;
}

export interface MatrixSection {
  key: Section;
  label: string;
  /** Admin pages the section unlocks (they inherit its rights). */
  pages: { href: string; label: string }[];
}

/** Matrix rows: permission sections with admin menu pages beneath them. */
export function matrixSections(): MatrixSection[] {
  return SECTIONS.map((key) => ({
    key,
    label: SECTION_LABEL[key],
    pages: ADMIN_NAV.filter((item) =>
      item.section === null
        ? false
        : typeof item.section === "string"
          ? item.section === key
          : item.section.includes(key),
    ).map((item) => ({ href: item.href, label: item.label })),
  }));
}
