import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { listAccounts } from "@/features/accounts/editorial";
import { can, sectionAccess } from "@/features/auth/access";
import {
  AuthorAccountForm,
  AuthorForm,
  DeleteAuthor,
} from "@/features/authors/components/AuthorForm";
import { getAuthor, getAuthorAccount } from "@/features/authors/editorial";
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
  if (!access) return <NoAccess />;
  const { id } = await params;

  if (id === "new") {
    if (!can(access.permissions, "news", "c")) return <NoAccess />;
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
  // Linking to a team account is for account managers (users "e"); the DB checks it again.
  const linking = can(access.permissions, "users", "e");
  const [accountId, accounts] = linking
    ? await Promise.all([getAuthorAccount(author.id), listAccounts("staff")])
    : [null, []];

  return (
    <>
      <PageHeader
        title={author.name}
        lead={saved ? <span role="status">Author profile added.</span> : undefined}
        actions={
          <Link
            href={routes.author(author.slug)}
            target="_blank"
            rel="noopener"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ExternalLink aria-hidden className="size-3.5" /> Open on the site
          </Link>
        }
      />
      <AuthorForm author={author} />
      {linking ? (
        <section className="mt-10">
          <h2 className="font-display mb-3 text-[17px] font-bold">Team account</h2>
          <AuthorAccountForm
            authorId={author.id}
            accountId={accountId}
            accounts={accounts.map((account) => ({
              id: account.id,
              label: account.name ? `${account.name} (${account.email})` : account.email,
            }))}
          />
        </section>
      ) : null}
      {can(access.permissions, "news", "d") ? (
        <div className="mt-10">
          <DeleteAuthor id={author.id} name={author.name} />
        </div>
      ) : null}
    </>
  );
}
