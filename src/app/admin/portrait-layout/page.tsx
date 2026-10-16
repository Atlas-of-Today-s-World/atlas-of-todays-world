import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { SectionOrderEditor } from "@/features/portraits/components/SectionOrderEditor";
import { savePortraitSections } from "@/features/site/actions";
import { getSiteSettings } from "@/features/site/queries";

export const metadata: Metadata = { title: "Portrait layout" };

/**
 * The order of the portrait sections — one for the whole site (owner's
 * request of 2026-10-16). It applies to every country, region and global
 * issue, in the side-panel preview and on the full page alike; the region's
 * profile under each of its countries follows it too.
 */
export default async function PortraitLayoutPage() {
  const access = await sectionAccess("site");
  if (!access) return <NoAccess />;
  const canEdit = can(access.permissions, "site", "e");
  const { sectionOrder } = await getSiteSettings();

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.portraitLayout)}
        title="Portrait layout"
        lead="The order of the sections on every country, region and global issue — the same in the preview beside the globe and on the full page. A section an editor hasn't written yet is left out wherever it would stand. Changes show on the site within a moment."
      />
      <ReadOnly
        readOnly={!canEdit}
        reason="The layout is changed by roles allowed to edit site settings."
      >
        <SectionOrderEditor initial={sectionOrder} canEdit={canEdit} save={savePortraitSections} />
      </ReadOnly>
    </>
  );
}
