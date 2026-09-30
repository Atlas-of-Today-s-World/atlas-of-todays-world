"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/atlas/ErrorState";
import { Button } from "@/components/ui/button";

/** Chyba v administraci (načtení z DB). Hláška bez detailů; detail je v logu serveru. */
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
      code={error.digest ? `Chyba ${error.digest}` : "Chyba"}
      title="Tuto část se nepodařilo načíst"
      lead="Zkuste to znovu. Pokud chyba trvá, pošlete kód chyby správci."
      action={<Button onClick={reset}>Zkusit znovu</Button>}
    />
  );
}
