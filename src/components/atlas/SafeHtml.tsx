import "server-only";
import { sanitizeRichHtml } from "@/lib/security/sanitize";

/**
 * Jediné místo, kde se do stránky vkládá HTML z dat (ARCHITEKTURA 5.1).
 * Vstup se čistí znovu i při vykreslení — obrana pro případ, že se do dat
 * dostalo něco, co neprošlo sanitizací při uložení.
 */
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }} />;
}
