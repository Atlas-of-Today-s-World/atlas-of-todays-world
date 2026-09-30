"use client";

import { useState, useTransition } from "react";
import { revokeInvitation } from "@/features/invitations/actions";

export default function RevokeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Odvolat tuto pozvánku?")) return;
          start(async () => {
            const result = await revokeInvitation(id);
            setError(result.ok ? "" : (result.error ?? "Nepovedlo se."));
          });
        }}
        className="min-h-11 px-2 text-[13px] text-red-700 underline disabled:opacity-60"
      >
        Odvolat
      </button>
      {error ? <span className="ml-2 text-[12px] text-red-700">{error}</span> : null}
    </span>
  );
}
