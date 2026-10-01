"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteIndicator } from "../actions";

export function DeleteIndicator({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete indicator"
      variant="danger"
      title="Delete the indicator and all its values?"
      body="The layer disappears from the map. This can't be undone."
      confirm="Delete"
      action={() => deleteIndicator(id)}
      onDone={(state) => {
        if (state.ok) router.push("/admin/data");
      }}
    />
  );
}
