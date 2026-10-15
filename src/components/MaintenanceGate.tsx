import type { ReactNode } from "react";
import ContentRail from "@/components/ContentRail";
import { ErrorState } from "@/components/atlas/ErrorState";
import { getT } from "@/features/i18n/request";
import { getMaintenance } from "@/features/flags/queries";

/**
 * Maintenance mode for the public site: while feature_flags.maintenance is on,
 * the page is replaced by the maintenance notice (title/text from site_notices,
 * else the built-in wording). Every public layout wraps its pages in this, so
 * the switch is checked in one place; the admin, sign-in, the invitation and the
 * reader's account (route group `(account)`), API routes, auth callbacks,
 * robots and sitemaps are outside it.
 *
 * Next sets no custom status from a layout (only 404/redirects), so the page is
 * kept out of search engines with `noindex` instead of a 503 (React hoists the
 * <meta> into <head>). `inRail`: on map pages the notice sits in the side panel
 * and the globe stays.
 */
export async function MaintenanceGate({
  children,
  inRail = false,
}: {
  children: ReactNode;
  inRail?: boolean;
}) {
  const t = await getT();
  const notice = await getMaintenance({
    title: t.map.maintenanceTitle,
    text: t.map.maintenanceText,
  });
  if (!notice) return children;
  const screen = (
    // Centred like the reading column, also in full-width frames (membership).
    <div data-testid="maintenance" className="mx-auto w-full max-w-4xl">
      <meta name="robots" content="noindex" />
      <ErrorState
        code={t.map.maintenance}
        title={notice.title}
        lead={notice.text}
        backLabel={t.common.backToGlobe}
      />
    </div>
  );
  return inRail ? <ContentRail>{screen}</ContentRail> : screen;
}
