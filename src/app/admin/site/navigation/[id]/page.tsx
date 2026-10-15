import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { navIcon } from "@/config/admin-nav";
import type { NavFlag, NavMenu } from "@/config/navigation";
import { adminRoutes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { updateNavItem } from "@/features/navigation/actions";
import { NavItemForm } from "@/features/navigation/components/NavItemForm";
import { getNavItem } from "@/features/navigation/editorial";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Menu item" };

/** Editing one menu item (section `site`, "e"); new ones are added on the list. */
export default async function NavItemPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await sectionAccess("site", "e");
  if (!access) forbidden();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const item = await getNavItem(id);
  if (!item) notFound();

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.siteNavigation.list)}
        title={item.label}
        lead={
          <Link
            href={adminRoutes.siteNavigation.list}
            className="text-[var(--color-link)] underline"
          >
            Back to site menus
          </Link>
        }
      />
      <NavItemForm
        action={updateNavItem}
        id={item.id}
        values={{
          menu: item.menu as NavMenu,
          label: item.label,
          href: item.href,
          visible: item.visible,
          is_primary: item.is_primary,
          compact_hidden: item.compact_hidden,
          requires_flag: item.requires_flag as NavFlag | null,
        }}
        title="Menu item"
        submit="Save item"
      />
    </>
  );
}
