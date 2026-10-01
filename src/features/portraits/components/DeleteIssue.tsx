"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteIssue } from "../actions";

export function DeleteIssue({ slug }: { slug: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Smazat"
      variant="danger"
      title="Smazat global issue?"
      body="Zmizí z mapy i jeho portrét (časová osa, zdroje, FAQ). Novinky zůstanou, jen ztratí vazbu."
      confirm="Smazat"
      action={() => deleteIssue(slug)}
      onDone={(state) => {
        if (state.ok) router.push("/admin/global-issues");
      }}
    />
  );
}
