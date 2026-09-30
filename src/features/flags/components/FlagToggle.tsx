"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { setFlag } from "../actions";

/** Přepínač funkce s potvrzením (režim údržby vypne veřejný web). */
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
      label={enabled ? "Vypnout" : "Zapnout"}
      variant={enabled ? "outline" : "primary"}
      title={`${enabled ? "Vypnout" : "Zapnout"}: ${label}?`}
      body="Změna se na webu projeví hned."
      confirm={enabled ? "Vypnout" : "Zapnout"}
      action={() => setFlag(flagKey, !enabled)}
      onDone={(state) => {
        if (state.ok) router.refresh();
      }}
    />
  );
}
