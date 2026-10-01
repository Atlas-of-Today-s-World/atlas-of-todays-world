"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/atlas/ErrorState";
import { Button } from "@/components/ui/button";

/** Error in the admin (loading from DB). Message without details; details are in the server log. */
export default function AdminError({
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
      title="This section failed to load"
      lead="Try again. If the error persists, send the error code to an administrator."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
