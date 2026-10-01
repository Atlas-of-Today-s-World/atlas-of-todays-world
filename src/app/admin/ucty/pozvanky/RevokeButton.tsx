"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { revokeInvitation } from "@/features/invitations/actions";

export default function RevokeButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Odvolat"
      variant="danger"
      title="Odvolat pozvánku?"
      body={`${email} se po přihlášení nestane členem týmu.`}
      confirm="Odvolat"
      action={() => revokeInvitation(id)}
      onDone={(state) => {
        if (state.ok) router.refresh();
      }}
    />
  );
}
