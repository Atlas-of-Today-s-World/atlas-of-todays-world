"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteIssue } from "../actions";

export function DeleteIssue({ slug }: { slug: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete"
      variant="danger"
      title="Delete special region?"
      body="It disappears from the map along with its portrait (timeline, resources, FAQ). Articles stay but lose the link."
      confirm="Delete"
      action={() => deleteIssue(slug)}
      onDone={(state) => {
        if (state.ok) router.push("/admin/global-issues");
      }}
    />
  );
}
