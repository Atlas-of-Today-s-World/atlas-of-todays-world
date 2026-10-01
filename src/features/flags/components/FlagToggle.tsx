"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { setFlag } from "../actions";

/** Feature flag toggle with confirmation (maintenance mode takes the public site down). */
export function FlagToggle({
  flagKey,
  enabled,
  label,
}: {
  flagKey: string;
  enabled: boolean;
  label: string;
}) {
  const router = useRouter();
  return (
    <ConfirmButton
      label={enabled ? "Turn off" : "Turn on"}
      variant={enabled ? "outline" : "primary"}
      title={`${enabled ? "Turn off" : "Turn on"}: ${label}?`}
      body="The change takes effect on the website immediately."
      confirm={enabled ? "Turn off" : "Turn on"}
      action={() => setFlag(flagKey, !enabled)}
      onDone={(state) => {
        if (state.ok) router.refresh();
      }}
    />
  );
}
