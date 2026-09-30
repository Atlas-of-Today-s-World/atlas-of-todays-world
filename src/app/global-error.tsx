"use client";

import { useEffect } from "react";

/**
 * Poslední záchrana, když selže i kořenový layout. Musí mít vlastní <html>
 * a obejít se bez stylů aplikace.
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
          background: "#0a1020",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24 }}>
          <h1 style={{ fontSize: 26 }}>Atlas of Today&rsquo;s World is having a problem</h1>
          <p style={{ lineHeight: 1.6, opacity: 0.8 }}>
            Please try again in a moment.{error.digest ? ` (Error ${error.digest})` : ""}
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
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
