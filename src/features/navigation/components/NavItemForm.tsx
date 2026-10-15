"use client";

import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useAddForm } from "@/components/ui/action-form";
import { Checkbox, describedBy, FormField, Input, Select } from "@/components/ui/field";
import type { NavFlag, NavMenu } from "@/config/navigation";
import type { ActionState } from "@/lib/action-state";
import { FLAG_LABELS, MENU_LABELS, NAV_PAGE_CHOICES } from "../pages";

export interface NavItemValues {
  menu: NavMenu;
  label: string;
  href: string;
  visible: boolean;
  is_primary: boolean;
  compact_hidden: boolean;
  requires_flag: NavFlag | null;
}

const EMPTY: NavItemValues = {
  menu: "main",
  label: "",
  href: "",
  visible: true,
  is_primary: false,
  compact_hidden: false,
  requires_flag: null,
};

const HREF_HINT = "A page of this site (/about) or an https:// address";

/**
 * A menu item: new (`addNavItem`, the menu is picked here) or existing
 * (`updateNavItem`; the id and the menu travel as hidden fields, the menu
 * isn't changed). The address field suggests the site's common pages.
 */
export function NavItemForm({
  action: save,
  id,
  values = EMPTY,
  title,
  submit,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** The item being edited; none = a new item (the form empties after each one added). */
  id?: string;
  values?: NavItemValues;
  title: string;
  submit: string;
}) {
  const [state, action, form] = useAddForm(save, !id);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm
      ref={form}
      action={action}
      className="grid max-w-3xl gap-4 rounded-2xl border border-[var(--color-line)] p-5"
    >
      <h2 className="font-display text-[17px] font-bold">{title}</h2>
      {id ? (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="menu" value={values.menu} />
        </>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr_2fr]">
        {id ? (
          <FormField id="nav-menu" label="Menu">
            <Input id="nav-menu" value={MENU_LABELS[values.menu]} readOnly disabled />
          </FormField>
        ) : (
          <FormField id="nav-menu" label="Menu" required errors={errors.menu}>
            <Select
              id="nav-menu"
              name="menu"
              required
              defaultValue={values.menu}
              {...describedBy("nav-menu", { errors: errors.menu })}
            >
              {Object.entries(MENU_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField id="nav-label" label="Label" required errors={errors.label}>
          <Input
            id="nav-label"
            name="label"
            required
            maxLength={60}
            placeholder="About"
            defaultValue={values.label}
            {...describedBy("nav-label", { errors: errors.label })}
          />
        </FormField>
        <FormField id="nav-href" label="Address" hint={HREF_HINT} required errors={errors.href}>
          <Input
            id="nav-href"
            name="href"
            required
            maxLength={500}
            list="nav-pages"
            placeholder="/about"
            autoComplete="off"
            defaultValue={values.href}
            {...describedBy("nav-href", { hint: HREF_HINT, errors: errors.href })}
          />
        </FormField>
        <datalist id="nav-pages">
          {NAV_PAGE_CHOICES.map((page) => (
            <option key={page.href} value={page.href}>
              {page.label}
            </option>
          ))}
        </datalist>
      </div>
      <FormField id="nav-flag" label="Shown" errors={errors.requires_flag}>
        <Select
          id="nav-flag"
          name="requires_flag"
          defaultValue={values.requires_flag ?? ""}
          className="max-w-sm"
          {...describedBy("nav-flag", { errors: errors.requires_flag })}
        >
          <option value="">Always</option>
          {Object.entries(FLAG_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid gap-2">
        <Checkbox name="visible" defaultChecked={values.visible} label="Show on the site" />
        <Checkbox
          name="is_primary"
          defaultChecked={values.is_primary}
          label="Highlighted pill, like “Atlas Patrons” (main menu only)"
        />
        <Checkbox
          name="compact_hidden"
          defaultChecked={values.compact_hidden}
          label="Over the globe only in the full menu — there is little room there (main menu only)"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{submit}</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}
