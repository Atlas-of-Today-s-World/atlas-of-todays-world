"use client";

import { useEffect } from "react";
import ContentRail from "@/components/ContentRail";
import { ErrorState } from "@/components/atlas/ErrorState";
import { Button } from "@/components/ui/button";

/** Chyba při načítání obsahu panelu — globus zůstává a jde to zkusit znovu. */
export default function MapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ContentRail>
      <ErrorState
        code={error.digest ? `Error ${error.digest}` : "Error"}
        title="This panel did not load"
        lead="Something went wrong on our side. Try again in a moment; the globe still works."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </ContentRail>
  );
}
