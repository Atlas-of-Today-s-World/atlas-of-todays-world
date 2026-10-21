import "server-only";
import type { ReactNode } from "react";
import { contactTarget } from "@/components/atlas/ContactLink";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/messages";
import { formatLongDate } from "@/lib/format";
import { xmlEscape } from "@/lib/seo/xml";
import { PAGE_TOKENS, type SitePageContent } from "../pages";
import { fillInline, linkHtml, splitAtBlock, splitTimeline } from "../render";
import { getMessagesFor } from "@/lib/i18n/request";
import { StoryTimeline } from "./StoryTimeline";

/**
 * An editable site page (About, Privacy, Terms, Accessibility): heading,
 * "Last updated", lead and the body from the admin with its placeholders
 * filled in. `dataSources` is rendered by code where the body has the
 * {{data-sources}} paragraph (below the body if it has none); `children`
 * follow the body (parts that stay in code, e.g. the publisher line).
 * `timeline` is the id of a section whose `<h3>` milestones are drawn as a
 * vertical timeline (About → Our story).
 */
export async function SitePageView({
  page,
  locale,
  dataSources,
  timeline,
  children,
}: {
  page: SitePageContent;
  locale: Locale;
  dataSources?: ReactNode;
  timeline?: string;
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
      <Body html={before} timeline={timeline} />
      {dataSources}
      {after ? <Body html={after} timeline={timeline} /> : null}
      {children}
    </main>
  );
}

/** A part of the body, with the timeline section's milestones drawn as one. */
function Body({ html, timeline }: { html: string; timeline?: string }) {
  const split = timeline ? splitTimeline(html, timeline) : null;
  if (!split) return <SafeHtml html={html} />;
  return (
    <>
      <SafeHtml html={split.before} />
      <StoryTimeline milestones={split.milestones} />
      {split.after ? <SafeHtml html={split.after} /> : null}
    </>
  );
}
