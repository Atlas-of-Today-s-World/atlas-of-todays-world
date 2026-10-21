import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes, routes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { patronsPageGroups } from "@/features/membership/page-texts";
import { saveUiTexts } from "@/features/ui-texts/actions";
import { PageTextsForm } from "@/features/ui-texts/components/PageTextsForm";
import { listUiTextOverrides } from "@/features/ui-texts/editorial";
import { validOverrides } from "@/features/ui-texts/model";

export const metadata: Metadata = { title: "Atlas Patrons" };

/**
 * The Atlas Patrons page's texts (section `site`), grouped by the page's
 * sections. They are UI texts (`patrons.*`, table ui_text_overrides), so
 * Admin → UI texts lists the same changes; the amounts, the goal and the FAQ
 * are in Patron settings.
 */
export default async function PatronsPageEditor() {
  const access = await sectionAccess("site");
  if (!access) return <NoAccess />;
  const overrides = validOverrides(await listUiTextOverrides());
  const canEdit = can(access.permissions, "site", "c") || can(access.permissions, "site", "e");
  const groups = patronsPageGroups().map((group) => ({
    ...group,
    fields: group.fields.map((field) => ({
      key: field.key,
      label: field.label,
      defaultText: field.defaultText,
      value: overrides[field.key] ?? field.defaultText,
      rich: field.rich,
    })),
  }));

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.sitePages.list)}
        title="Atlas Patrons"
        lead={
          <>
            The texts of the membership page, section by section. A save shows on the site within a
            minute.{" "}
            <a
              href={routes.membership}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-link)] underline"
            >
              Open {routes.membership} on the site
            </a>
            {" · "}
            The donation amounts, the goal and the questions are in{" "}
            <Link href={adminRoutes.patrons} className="text-[var(--color-link)] underline">
              Patron settings
            </Link>
            .
          </>
        }
      />
      <ReadOnly readOnly={!canEdit} reason="Your role can view site pages but not edit them.">
        <PageTextsForm groups={groups} save={saveUiTexts} />
      </ReadOnly>
    </>
  );
}
