import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactLink } from "@/components/atlas/ContactLink";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { ORGANIZATION } from "@/config/organization";
import { can, sectionAccess } from "@/features/auth/access";
import { PageRevisions } from "@/features/site-pages/components/PageRevisions";
import { SitePageForm } from "@/features/site-pages/components/SitePageForm";
import { getEditableSitePage, listPageRevisions } from "@/features/site-pages/editorial";
import { isSitePageSlug, PAGE_TOKENS, SITE_PAGE_PATH } from "@/features/site-pages/pages";

export const metadata: Metadata = { title: "Site page" };

/** Editing one site page, with its history (restore any saved version). */
export default async function SitePageEditor({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const access = await sectionAccess("site");
  if (!access) return <NoAccess />;
  const { slug } = await params;
  if (!isSitePageSlug(slug)) notFound();
  const [page, revisions, { saved }] = await Promise.all([
    getEditableSitePage(slug),
    listPageRevisions(slug),
    searchParams,
  ]);
  const canEdit = can(access.permissions, "site", "e");
  const path = SITE_PAGE_PATH[slug];

  return (
    <>
      <PageHeader
        title={page.title}
        lead={
          <>
            {saved ? (
              <span role="status">
                {page.published
                  ? "Saved and published. "
                  : "Saved. The page is unpublished, so the website shows its built-in text. "}
              </span>
            ) : null}
            <a
              href={path}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-link)] underline"
            >
              Open {path} on the site
            </a>
            {page.stored ? null : " · Not saved yet: the website shows the built-in text."}
          </>
        }
      />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ReadOnly readOnly={!canEdit} reason="Your role can view site pages but not edit them.">
          {/* Remount with the stored values after a save or a restore. */}
          <SitePageForm
            key={page.updated_at ?? "default"}
            page={page}
            published={page.stored ? page.published : true}
          />
        </ReadOnly>
        <aside className="grid content-start gap-8">
          <section>
            <h2 className="font-display mb-3 text-[16px] font-bold">Placeholders</h2>
            <dl className="grid gap-2 text-[13px] text-[var(--color-ink-soft)]">
              <div>
                <dt className="font-mono text-[12px]">{PAGE_TOKENS.contact}</dt>
                <dd>
                  The contact link: <ContactLink />
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[12px]">{PAGE_TOKENS.email}</dt>
                <dd>The publisher’s e-mail as text: {ORGANIZATION.email}</dd>
              </div>
              {slug === "about" ? (
                <div>
                  <dt className="font-mono text-[12px]">{PAGE_TOKENS.dataSources}</dt>
                  <dd>
                    In a paragraph of its own: the live list of map data sources. Without it the
                    list goes below the text. The publisher line at the end of the page is added
                    automatically.
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
          <section>
            <h2 className="font-display mb-3 text-[16px] font-bold">History</h2>
            <PageRevisions slug={slug} revisions={revisions} canRestore={canEdit} />
          </section>
        </aside>
      </div>
    </>
  );
}
