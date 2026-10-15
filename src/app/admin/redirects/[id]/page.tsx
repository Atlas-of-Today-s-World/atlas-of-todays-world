import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { adminRoutes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { RedirectForm } from "@/features/redirects/components/RedirectForms";
import { getRedirect } from "@/features/redirects/editorial";
import { RedirectId } from "@/features/redirects/schema";

export const metadata: Metadata = { title: "Edit URL redirect" };

/** Editing one redirect (news "e" or site "e"; RLS decides, the DB refuses loops). */
export default async function RedirectPage({ params }: PageProps<"/admin/redirects/[id]">) {
  const access = await sectionAccess(["news", "site"], "e");
  if (!access) return <NoAccess />;
  const { id } = await params;
  if (!RedirectId.safeParse(id).success) notFound();
  const redirect = await getRedirect(id);
  if (!redirect) notFound();

  return (
    <>
      <PageHeader
        title={redirect.from_path}
        lead="Changes apply on the website at once. A redirect only replaces a “not found” page — it never overrides an existing page."
        actions={
          <Link
            href={adminRoutes.redirects.list}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to redirects
          </Link>
        }
      />
      <RedirectForm redirect={redirect} />
    </>
  );
}
