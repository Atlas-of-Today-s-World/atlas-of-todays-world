"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { revokeInvitation } from "@/features/invitations/actions";

export default function RevokeButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Revoke"
      variant="danger"
      title="Revoke invitation?"
      body={`${email} will not become a team member after signing in.`}
      confirm="Revoke"
      action={() => revokeInvitation(id)}
      onDone={(state) => {
        if (state.ok) router.refresh();
      }}
    />
  );
}
