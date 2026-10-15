import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import {
  deleteAction,
  editAction,
  moveActions,
  openAction,
  visibilityAction,
  type RowAction,
} from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { NAV_MENUS, type NavFlag, type NavMenu } from "@/config/navigation";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import type { Permissions } from "@/config/sections";
import {
  addNavItem,
  deleteNavItem,
  moveNavItem,
  setNavItemVisible,
} from "@/features/navigation/actions";
import { NavItemForm } from "@/features/navigation/components/NavItemForm";
import { listNavItems, type NavItemRecord } from "@/features/navigation/editorial";
import { isExternal } from "@/features/navigation/model";
import { FLAG_LABELS, MENU_LABELS } from "@/features/navigation/pages";

export const metadata: Metadata = { title: "Site menus" };

const VISIBILITY = [
  { value: "shown", label: "Shown", tone: "success" as const },
  { value: "hidden", label: "Hidden", tone: "neutral" as const },
];

const STYLES = [
  { value: "plain", label: "Plain" },
  { value: "pill", label: "Pill", tone: "warning" as const },
  { value: "full-menu", label: "Full menu only" },
];

const LEADS: Record<NavMenu, string> = {
  main: "The header: links over the globe and in the dark bar, and the full-screen menu on phones. The sign-in link stays as it is.",
  legal: "The footer of pages without the globe and the bottom of the phone menu.",
};

const style = (item: NavItemRecord) =>
  item.is_primary ? "pill" : item.compact_hidden ? "full-menu" : "plain";

/** One menu's table (both menus share the columns and actions). */
function MenuTable({
  menu,
  items,
  permissions,
}: {
  menu: NavMenu;
  items: NavItemRecord[];
  permissions: Permissions;
}) {
  const canEdit = can(permissions, "site", "e");
  const canDelete = can(permissions, "site", "d");
  return (
    <DataTable
      tableKey={`admin-site-nav-${menu}`}
      caption={MENU_LABELS[menu]}
      emptyTitle="No items — the site shows none in this menu"
      initialSort={{ key: "order", dir: "asc" }}
      stats={optionStats("visibility", VISIBILITY)}
      maxRowActions={(canEdit ? 4 : 0) + 1 + (canDelete ? 1 : 0)}
      columns={[
        { key: "order", label: "#", kind: "number", sortable: true, width: "64px" },
        {
          key: "label",
          label: "Label",
          link: canEdit,
          sortable: true,
          filter: "text",
          width: "minmax(160px, 1fr)",
        },
        {
          key: "href",
          label: "Address",
          kind: "code",
          filter: "text",
          width: "minmax(180px, 1.5fr)",
        },
        ...(menu === "main"
          ? [
              {
                key: "style",
                label: "Style",
                kind: "badge" as const,
                options: STYLES,
                filter: "select" as const,
                width: "136px",
              },
            ]
          : []),
        { key: "flag", label: "Only while", filter: "select", width: "minmax(140px, 1fr)" },
        {
          key: "visibility",
          label: "On the site",
          kind: "badge",
          options: VISIBILITY,
          sortable: true,
          filter: "select",
          width: "128px",
        },
        { key: "updated", label: "Changed", kind: "date", sortable: true, width: "128px" },
      ]}
      rows={items.map((item, index) => {
        const href = adminRoutes.siteNavigation(item.id);
        const actions: RowAction[] = [
          ...(canEdit
            ? [
                ...moveActions(
                  moveNavItem.bind(null, item.id, true),
                  moveNavItem.bind(null, item.id, false),
                  { first: index === 0, last: index === items.length - 1 },
                ),
                editAction(href),
                visibilityAction(
                  setNavItemVisible.bind(null, item.id, !item.visible),
                  item.visible,
                  `“${item.label}”`,
                ),
              ]
            : []),
          openAction(item.href, isExternal(item.href) ? "Open the link" : "Open on the site"),
          ...(canDelete
            ? [deleteAction(deleteNavItem.bind(null, item.id), `the menu item “${item.label}”`)]
            : []),
        ];
        return {
          id: item.id,
          href: canEdit ? href : undefined,
          values: {
            order: index + 1,
            label: item.label,
            href: item.href,
            style: style(item),
            flag: item.requires_flag ? FLAG_LABELS[item.requires_flag as NavFlag] : "",
            visibility: item.visible ? "shown" : "hidden",
            updated: item.updated_at,
          },
          actions: <RowActions actions={actions} />,
        };
      })}
    />
  );
}

/**
 * Site menus (section `site`): the main menu in the header and the footer
 * links, each in its own hand-ordered table. Who may change them is decided
 * by RLS; the buttons only follow it.
 */
export default async function SiteNavigationPage() {
  const access = await sectionAccess("site");
  if (!access) return <NoAccess />;
  const items = await listNavItems();

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.siteNavigation.list)}
        title="Site menus"
        lead="The links in the site header and footer, in this order. Hidden items stay here but don't show; an item tied to a switch shows only while the switch is on. Changes show on the site within a moment."
      />

      {can(access.permissions, "site", "c") ? (
        <div className="mb-10">
          <NavItemForm action={addNavItem} title="New menu item" submit="Add item" />
        </div>
      ) : null}

      {NAV_MENUS.map((menu) => (
        <section key={menu} aria-labelledby={`menu-${menu}`} className="mb-12">
          <h2 id={`menu-${menu}`} className="font-display mb-1 text-[20px] font-bold">
            {MENU_LABELS[menu]}
          </h2>
          <p className="mb-5 max-w-3xl text-[13.5px] text-[var(--color-ink-soft)]">{LEADS[menu]}</p>
          <MenuTable
            menu={menu}
            items={items.filter((item) => item.menu === menu)}
            permissions={access.permissions}
          />
        </section>
      ))}
    </>
  );
}
