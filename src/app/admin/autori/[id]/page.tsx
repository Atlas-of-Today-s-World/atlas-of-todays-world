import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { can, sectionAccess } from "@/features/auth/access";
import { AuthorForm, DeleteAuthor } from "@/features/authors/components/AuthorForm";
import { getAuthor } from "@/features/authors/editorial";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Autor" };

/** Nový autor (`/admin/autori/novy`), nebo úprava existujícího. */
export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ulozeno?: string }>;
}) {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const { id } = await params;

  if (id === "novy") {
    if (!can(access.permissions, "news", "c")) return <NoAccess />;
    return (
      <>
        <PageHeader title="Nový autor" />
        <AuthorForm author={null} />
      </>
    );
  }

  if (!uuid.safeParse(id).success) notFound();
  const author = await getAuthor(id);
  if (!author) notFound();
  const { ulozeno } = await searchParams;

  return (
    <>
      <PageHeader
        title={author.name}
        lead={ulozeno ? <span role="status">Autor přidán.</span> : undefined}
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
