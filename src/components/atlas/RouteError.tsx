"use client";

import { ErrorState } from "@/components/atlas/ErrorState";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/button";
import { format } from "@/features/i18n/messages";
import { useLogError } from "@/lib/use-log-error";

/** Props Next.js passes to a route's `error.tsx`. */
export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The one body of every route `error.tsx` (a load error under a layout):
 * - map — the content panel's texts (the globe stays and works; the boundary
 *   puts it in the ContentRail);
 * - page — the pages outside the map (also account and patrons);
 * - admin — the administration (its own English texts).
 *
 * All show the same code line ("Error <digest>"): the digest is what the
 * visitor sends us and what the server log is searched by.
 */
export function RouteError({
  variant,
  error,
  reset,
}: RouteErrorProps & { variant: "map" | "page" | "admin" }) {
  // Outside the LocaleProvider (the admin) these are the built-in en.json texts.
  const t = useMessages();
  useLogError(error);
  const code = error.digest ? format(t.errors.errorCode, { digest: error.digest }) : t.panel.error;
  const action = <Button onClick={reset}>{t.panel.tryAgain}</Button>;

  if (variant === "admin") {
    return (
      <ErrorState
        live
        code={code}
        title="This section failed to load"
        lead="Try again. If the error persists, send the error code to an administrator."
        action={action}
      />
    );
  }
  return (
    <ErrorState
      live
      code={code}
      title={variant === "map" ? t.panel.errorTitle : t.errors.pageErrorTitle}
      lead={variant === "map" ? t.panel.errorText : t.errors.pageErrorLead}
      backLabel={t.common.backToGlobe}
      action={action}
    />
  );
}
