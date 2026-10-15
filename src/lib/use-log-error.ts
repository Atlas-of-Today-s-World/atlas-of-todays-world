"use client";

import { useEffect } from "react";

/**
 * Logs an error caught by an error boundary to the browser console, once per
 * error. The visitor sees only a short message and the digest; the full error
 * (and its server-side counterpart under the same digest) is in the logs.
 */
export function useLogError(error: Error) {
  useEffect(() => {
    console.error(error);
  }, [error]);
}
