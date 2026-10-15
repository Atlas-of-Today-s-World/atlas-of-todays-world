"use client";

import { useEffect } from "react";
import { THEME_COLORS } from "@/config/palette";

/**
 * The page's texts, kept here on purpose: this boundary replaces the root
 * layout, so it can't wait for data (the team's text changes from the
 * database) and must work even when everything else failed. Not editable in
 * the admin.
 */
const TEXT = {
  title: "Atlas of Today’s World is having a problem",
  lead: "Please try again in a moment.",
  errorCode: (digest: string) => ` (Error ${digest})`,
  tryAgain: "Try again",
} as const;

/**
 * Last resort when even the root layout fails. It must have its own <html>
 * and work without the app's styles.
 */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: THEME_COLORS.space,
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24 }}>
          <h1 style={{ fontSize: 26 }}>{TEXT.title}</h1>
          <p style={{ lineHeight: 1.6, opacity: 0.8 }}>
            {TEXT.lead}
            {error.digest ? TEXT.errorCode(error.digest) : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 999,
              border: 0,
              cursor: "pointer",
            }}
          >
            {TEXT.tryAgain}
          </button>
        </main>
      </body>
    </html>
  );
}
