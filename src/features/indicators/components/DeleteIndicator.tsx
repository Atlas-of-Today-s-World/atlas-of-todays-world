"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteIndicator } from "../actions";

export function DeleteIndicator({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Smazat ukazatel"
      variant="danger"
      title="Smazat ukazatel i všechny jeho hodnoty?"
      body="Vrstva zmizí z mapy. Tohle nejde vrátit."
      confirm="Smazat"
      action={() => deleteIndicator(id)}
      onDone={(state) => {
        if (state.ok) router.push("/admin/data");
      }}
    />
  );
}
