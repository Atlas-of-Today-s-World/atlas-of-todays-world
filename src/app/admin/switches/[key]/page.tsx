import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { adminRoutes } from "@/config/routes";
import { sectionAccess } from "@/features/auth/access";
import { FlagNoteForm } from "@/features/flags/components/SwitchForms";
import { getFlag } from "@/features/flags/editorial";
import { FlagKey } from "@/features/flags/schema";

export const metadata: Metadata = { title: "Switch note" };

/** The note next to one switch (permissions "e", like the switch itself; RLS decides). */
export default async function SwitchPage({ params }: { params: Promise<{ key: string }> }) {
  const access = await sectionAccess("permissions", "e");
  if (!access) forbidden();
  const { key } = await params;
  if (!FlagKey.safeParse(key).success) notFound();
  const flag = await getFlag(key);
  if (!flag) notFound();

  return (
    <>
      <PageHeader
        title={flag.key}
        lead={`Currently ${flag.enabled ? "on" : "off"}. Turn it on or off in the list of switches.`}
        actions={
          <Link
            href={adminRoutes.switches.list}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to switches
          </Link>
        }
      />
      <FlagNoteForm flag={flag} />
    </>
  );
}
