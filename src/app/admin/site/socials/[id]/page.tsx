import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { updateSocialLink } from "@/features/site/actions";
import { SocialLinkForm } from "@/features/site/components/SocialLinkForm";
import { getSocialLink } from "@/features/site/editorial";
import { SocialId } from "@/features/site/schema";

export const metadata: Metadata = { title: "Social link" };

/** Editing one social link (section `site`, "e"); new ones are added on /admin/site. */
export default async function SocialLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await sectionAccess("site", "e");
  if (!access) return <NoAccess />;
  const { id } = await params;
  if (!SocialId.safeParse(id).success) notFound();
  const link = await getSocialLink(id);
  if (!link) notFound();

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.siteSettings)}
        title={link.label}
        lead={
          <Link href={adminRoutes.siteSettings} className="text-[var(--color-link)] underline">
            Back to site settings
          </Link>
        }
      />
      <SocialLinkForm
        action={updateSocialLink.bind(null, link.id)}
        values={{ label: link.label, url: link.url, icon: link.icon, visible: link.visible }}
        title="Social link"
        submit="Save link"
      />
    </>
  );
}
