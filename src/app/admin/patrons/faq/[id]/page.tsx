import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { getAccess } from "@/features/auth/access";
import { DeletePatronFaq, PatronFaqForm } from "@/features/membership/components/PatronFaqForm";
import { getPatronFaqItem, patronRight } from "@/features/membership/editorial";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Membership FAQ question" };

/** New FAQ question (`/admin/patrons/faq/new`), or editing an existing one. */
export default async function PatronFaqPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const access = await getAccess();
  if (!access || !patronRight(access.permissions, "v")) forbidden();
  const { id } = await params;

  if (id === "new") {
    if (!patronRight(access.permissions, "c")) forbidden();
    return (
      <>
        <PageHeader
          title="New question"
          lead="Added at the end of the FAQ on the membership page."
        />
        <PatronFaqForm item={null} />
      </>
    );
  }

  if (!uuid.safeParse(id).success) notFound();
  const item = await getPatronFaqItem(id);
  if (!item) notFound();
  if (!patronRight(access.permissions, "e")) forbidden();
  const { saved } = await searchParams;

  return (
    <>
      <PageHeader
        title={item.question}
        lead={saved ? <span role="status">Question added.</span> : undefined}
      />
      <PatronFaqForm item={item} />
      {patronRight(access.permissions, "d") ? (
        <div className="mt-10">
          <DeletePatronFaq id={item.id} question={item.question} />
        </div>
      ) : null}
    </>
  );
}
