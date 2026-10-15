import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import {
  deleteAction,
  editAction,
  moveActions,
  openAction,
} from "@/components/data-table/row-actions";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes, routes } from "@/config/routes";
import { getAccess } from "@/features/auth/access";
import { deletePatronFaq, movePatronFaq } from "@/features/membership/admin-actions";
import { PatronSettingsForm } from "@/features/membership/components/PatronSettingsForm";
import { getPatronSettingsRow, listPatronFaq, patronRight } from "@/features/membership/editorial";
import { htmlToText } from "@/lib/text/html";

export const metadata: Metadata = { title: "Patron settings" };

const SHOWN = [
  { value: "shown", label: "Shown", tone: "success" as const },
  { value: "hidden", label: "Hidden", tone: "neutral" as const },
];

/**
 * Atlas Patrons settings (/membership): the donation card's amounts, the goal
 * and the FAQ. Open to the `site` or `members` section; RLS decides every write.
 * Payments stay in demo mode — nothing here touches a payment provider.
 */
export default async function PatronSettingsPage() {
  const access = await getAccess();
  if (!access || !patronRight(access.permissions, "v")) return <NoAccess />;
  const [settings, faq] = await Promise.all([getPatronSettingsRow(), listPatronFaq()]);
  const canEdit = patronRight(access.permissions, "e");
  const canDelete = patronRight(access.permissions, "d");
  // Edit + move up + move down, open on the site, delete.
  const maxActions = (canEdit ? 3 : 0) + 1 + (canDelete ? 1 : 0);

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.patrons)}
        title="Patron settings"
        lead="What the Atlas Patrons page offers: the donation amounts (in euros), the current goal and the questions people ask. The checkout accepts exactly the amounts saved here."
      />

      <PatronSettingsForm settings={settings} canEdit={canEdit} />

      <section aria-labelledby="patron-faq-title" className="mt-12">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="patron-faq-title" className="font-display text-[17px] font-bold">
            Questions and answers
          </h2>
          {patronRight(access.permissions, "c") ? (
            <Link href={adminRoutes.patronFaq.new} className={buttonVariants({ size: "sm" })}>
              Add question
            </Link>
          ) : null}
        </div>
        <DataTable
          tableKey="admin-patron-faq"
          caption="Questions and answers on the membership page"
          searchPlaceholder="Search questions…"
          emptyTitle="No questions yet — the page leaves the FAQ out"
          initialSort={{ key: "position", dir: "asc" }}
          stats={[
            { key: "all", label: "All" },
            { key: "hidden", label: "Hidden", column: "shown", value: "hidden" },
          ]}
          maxRowActions={maxActions}
          columns={[
            {
              key: "position",
              label: "#",
              kind: "number",
              align: "right",
              sortable: true,
              width: "56px",
            },
            {
              key: "question",
              label: "Question",
              link: true,
              sortable: true,
              filter: "text",
              width: "minmax(220px, 2fr)",
            },
            { key: "answer", label: "Answer", filter: "text", width: "minmax(220px, 3fr)" },
            {
              key: "shown",
              label: "On the page",
              kind: "badge",
              options: SHOWN,
              sortable: true,
              filter: "select",
              width: "128px",
            },
            { key: "updated", label: "Updated", kind: "date", sortable: true, width: "128px" },
          ]}
          rows={faq.map((row, index) => ({
            id: row.id,
            href: canEdit ? adminRoutes.patronFaq(row.id) : undefined,
            values: {
              position: index + 1,
              question: row.question,
              answer: htmlToText(row.answer_html, { blockEnd: " ", collapse: true }),
              shown: row.visible ? "shown" : "hidden",
              updated: row.updated_at,
            },
            actions: (
              <RowActions
                actions={[
                  ...(canEdit ? [editAction(adminRoutes.patronFaq(row.id))] : []),
                  ...(row.visible ? [openAction(routes.membership)] : []),
                  ...(canEdit
                    ? moveActions(
                        movePatronFaq.bind(null, row.id, true),
                        movePatronFaq.bind(null, row.id, false),
                        { first: index === 0, last: index === faq.length - 1 },
                      )
                    : []),
                  ...(canDelete
                    ? [
                        deleteAction(
                          deletePatronFaq.bind(null, row.id),
                          `the question “${row.question}”`,
                          "It disappears from the membership page. This cannot be undone.",
                        ),
                      ]
                    : []),
                ]}
              />
            ),
          }))}
        />
      </section>
    </>
  );
}
