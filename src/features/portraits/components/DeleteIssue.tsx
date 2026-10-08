"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { deleteIssue } from "../actions";
import { GROUP_KIND_LABEL } from "../constants";

export function DeleteIssue({ slug, kind }: { slug: string; kind: keyof typeof GROUP_KIND_LABEL }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete"
      variant="danger"
      title={`Delete ${GROUP_KIND_LABEL[kind].toLowerCase()}?`}
      body="It disappears from the map along with its portrait (timeline, resources, FAQ). Articles stay but lose the link."
      confirm="Delete"
      action={() => deleteIssue(slug)}
      onDone={(state) => {
        if (state.ok) router.push("/admin/global-issues");
      }}
    />
  );
}
