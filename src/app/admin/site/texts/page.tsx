import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { confirmAction, editAction, type RowAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { resetUiText } from "@/features/ui-texts/actions";
import { listUiTextOverrides } from "@/features/ui-texts/editorial";
import { EDITABLE_TEXTS, editableText, overrideProblem } from "@/features/ui-texts/model";

export const metadata: Metadata = { title: "UI texts" };

const STATUS = [
  { value: "changed", label: "Changed", tone: "success" as const },
  { value: "default", label: "Default", tone: "neutral" as const },
  // A saved change that no longer fits the code (text renamed or removed, placeholders
  // changed): the site ignores it and shows the default.
  { value: "unused", label: "Not used", tone: "warning" as const },
];

/**
 * UI texts (section `site`): every public text of the site's interface —
 * buttons, headings, labels, page titles, feed and preview-image texts — with
 * its default from en.json and the team's version. Sign-in, the account and
 * the invitation stay in the code (features/ui-texts/model.ts). Who may save
 * is decided by RLS; the buttons only follow it.
 */
export default async function UiTextsPage() {
  const access = await sectionAccess("site");
  if (!access) forbidden();
  const overrides = await listUiTextOverrides();
  const canWrite = can(access.permissions, "site", "c") || can(access.permissions, "site", "e");
  const canReset = can(access.permissions, "site", "d");
  const changed = new Map(overrides.map((row) => [row.key, row]));

  const rows = [
    ...EDITABLE_TEXTS.map((text) => ({ ...text, override: changed.get(text.key) })),
    // Saved changes the code no longer has: shown so they can be reset.
    ...overrides
      .filter((row) => !editableText(row.key))
      .map((row) => ({
        key: row.key,
        namespace: row.key.split(".")[0] ?? row.key,
        defaultText: "",
        override: row,
      })),
  ];

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.uiTexts)}
        title="UI texts"
        lead="The words of the public site's interface: buttons, headings, labels, page titles, feed and preview-image texts. Change a text here and the site shows it within a minute or so — each page updates on its next visit. Keep the {placeholders}; the site fills them in."
      />

      <DataTable
        tableKey="admin-ui-texts"
        caption="UI texts"
        searchPlaceholder="Search keys and texts…"
        emptyTitle="No texts"
        initialSort={{ key: "key", dir: "asc" }}
        stats={optionStats("status", STATUS)}
        actionsWidth="96px"
        columns={[
          {
            key: "key",
            label: "Key",
            kind: "code",
            link: canWrite,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 1.2fr)",
          },
          {
            key: "namespace",
            label: "Group",
            sortable: true,
            filter: "select",
            width: "140px",
          },
          {
            key: "defaultText",
            label: "Default (en.json)",
            filter: "text",
            width: "minmax(220px, 2fr)",
          },
          {
            key: "current",
            label: "On the site",
            filter: "text",
            width: "minmax(220px, 2fr)",
          },
          {
            key: "status",
            label: "Changed?",
            kind: "badge",
            options: STATUS,
            sortable: true,
            filter: "select",
            width: "120px",
          },
          { key: "updated", label: "Changed on", kind: "date", sortable: true, width: "128px" },
        ]}
        rows={rows.map((text) => {
          const href = adminRoutes.uiText(text.key);
          const known = Boolean(text.defaultText);
          // The site shows a saved change only while it fits the current en.json (overrideProblem).
          const shown =
            text.override && overrideProblem(text.key, text.override.value) === null
              ? text.override.value
              : undefined;
          const status = shown !== undefined ? "changed" : text.override ? "unused" : "default";
          const actions: RowAction[] = [
            ...(canWrite && known ? [editAction(href)] : []),
            ...(canReset && text.override
              ? [
                  confirmAction(
                    "restore",
                    "Reset to default",
                    resetUiText.bind(null, text.key),
                    `Reset “${text.key}” to its default?`,
                    "The site shows the built-in text from en.json again.",
                  ),
                ]
              : []),
          ];
          return {
            id: text.key,
            href: canWrite && known ? href : undefined,
            values: {
              key: text.key,
              namespace: text.namespace,
              defaultText: text.defaultText,
              current: shown ?? text.defaultText,
              status,
              updated: text.override?.updated_at,
            },
            actions: <RowActions actions={actions} />,
          };
        })}
      />
    </>
  );
}
