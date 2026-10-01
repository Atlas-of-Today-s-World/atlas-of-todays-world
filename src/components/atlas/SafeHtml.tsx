import "server-only";
import { sanitizeRichHtml } from "@/lib/security/sanitize";

/**
 * The only place where HTML from data is inserted into the page (ARCHITEKTURA 5.1).
 * Input is sanitized again at render time — a defense in case something got
 * into the data that wasn't sanitized on save.
 */
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }} />;
}
