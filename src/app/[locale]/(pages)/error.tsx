"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/atlas/ErrorState";
import { Button } from "@/components/ui/button";

export default function PagesError({
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
    <ErrorState
      code={error.digest ? `Error ${error.digest}` : "Error"}
      title="Something went wrong"
      lead="Try again in a moment. If it keeps happening, let us know."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
