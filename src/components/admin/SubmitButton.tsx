"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonVariants } from "@/components/ui/button";
import { useActionPending } from "@/components/ui/action-form";

/** Submit button with a "saving" state (reads the state of the parent <ActionForm> or <form>). */
export function SubmitButton({
  children,
  pending: pendingLabel = "Saving…",
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
