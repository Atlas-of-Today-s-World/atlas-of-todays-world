import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { AuthorForm, DeleteAuthor } from "@/features/authors/components/AuthorForm";
import { getAuthor } from "@/features/authors/editorial";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Author profile" };

/** New author (`/admin/authors/new`), or editing an existing one. */
export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const access = await sectionAccess("news");
  if (!access) forbidden();
  const { id } = await params;

  if (id === "new") {
    if (!can(access.permissions, "news", "c")) forbidden();
    return (
      <>
        <PageHeader title="New author profile" />
        <AuthorForm author={null} />
      </>
    );
  }

  if (!uuid.safeParse(id).success) notFound();
  const author = await getAuthor(id);
  if (!author) notFound();
  const { saved } = await searchParams;

  return (
    <>
      <PageHeader
        title={author.name}
        lead={saved ? <span role="status">Author profile added.</span> : undefined}
      />
      <AuthorForm author={author} />
      {can(access.permissions, "news", "d") ? (
        <div className="mt-10">
          <DeleteAuthor id={author.id} name={author.name} />
        </div>
      ) : null}
    </>
  );
}
