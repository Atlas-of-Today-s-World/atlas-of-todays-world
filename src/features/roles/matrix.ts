// Pravidla matice oprávnění bez Reactu a bez serveru (testuje je matrix.test.ts).
import { ADMIN_NAV } from "@/config/admin-nav";
import { SECTIONS, type Action, type Section } from "@/features/auth/sections";
import { SECTION_LABEL } from "./labels";

/** Pořadí akcí v DB řetězci (`role_permissions.actions`). */
export const ACTIONS = ["v", "c", "e", "d"] as const satisfies readonly Action[];

export type RoleGrants = Partial<Record<Section, string>>;

/**
 * Nové akce sekce po kliknutí na jedno zaškrtávátko. Stejné pravidlo jako
 * `MatrixInput` a DB: bez „v" nic dalšího neplatí, takže zaškrtnutí c/e/d
 * přidá i „v" a odškrtnutí „v" smaže všechno.
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

/** FormData pro `saveMatrix`: celá role, `perm:<sekce>` = jednotlivé akce. */
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
  /** Stránky administrace, které sekce odemyká (dědí její práva). */
  pages: { href: string; label: string }[];
}

/** Řádky matice: sekce oprávnění a pod nimi stránky z menu administrace. */
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
