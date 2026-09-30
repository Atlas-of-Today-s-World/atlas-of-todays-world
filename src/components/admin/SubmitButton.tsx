"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonVariants } from "@/components/ui/button";
import { useActionPending } from "./ActionForm";

/** Odesílací tlačítko se stavem „ukládám" (čte stav nadřazeného <ActionForm> či <form>). */
export function SubmitButton({
  children,
  pending: pendingLabel = "Ukládám…",
  name,
  value,
  ...variants
}: ButtonVariants & {
  children: React.ReactNode;
  pending?: string;
  name?: string;
  value?: string;
}) {
  const inActionForm = useActionPending();
  const { pending: inNativeForm } = useFormStatus();
  const pending = inActionForm || inNativeForm;
  return (
    <Button type="submit" disabled={pending} name={name} value={value} {...variants}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
