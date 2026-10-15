import "server-only";
import type { ReactNode } from "react";
import { contactTarget } from "@/components/atlas/ContactLink";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/messages";
import { formatLongDate } from "@/lib/format";
import { xmlEscape } from "@/lib/seo/xml";
import { PAGE_TOKENS, type SitePageContent } from "../pages";
import { fillInline, linkHtml, splitAtBlock } from "../render";
import { getMessagesFor } from "@/lib/i18n/request";

/**
 * An editable site page (About, Privacy, Terms, Accessibility): heading,
 * "Last updated", lead and the body from the admin with its placeholders
 * filled in. `dataSources` is rendered by code where the body has the
 * {{data-sources}} paragraph (below the body if it has none); `children`
 * follow the body (parts that stay in code, e.g. the publisher line).
 */
export async function SitePageView({
  page,
  locale,
  dataSources,
  children,
}: {
  page: SitePageContent;
  locale: Locale;
  dataSources?: ReactNode;
  children?: ReactNode;
}) {
  // {{contact}} and {{email}}: the one contact address of the site settings.
  const contact = await contactTarget();
  const html = fillInline(page.body_html, {
    [PAGE_TOKENS.contact]: linkHtml(contact.href, contact.label),
    [PAGE_TOKENS.email]: xmlEscape(contact.label),
  });
  const { before, after } = splitAtBlock(html, PAGE_TOKENS.dataSources);

  return (
    <main className="prose-atlas max-w-2xl">
      <h1 className="font-display text-[34px] font-bold text-[var(--color-ink)]">{page.title}</h1>
      {page.last_reviewed ? (
        <p className="text-[13px] text-[var(--color-ink-muted)]">
          {format((await getMessagesFor(locale)).sitePages.lastUpdated, {
            date: formatLongDate(`${page.last_reviewed}T12:00:00Z`, locale),
          })}
        </p>
      ) : null}
      {page.lead ? <p className="mt-4">{page.lead}</p> : null}
      <SafeHtml html={before} />
      {dataSources}
      {after ? <SafeHtml html={after} /> : null}
      {children}
    </main>
  );
}
