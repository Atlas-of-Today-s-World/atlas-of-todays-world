"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonVariants } from "@/components/ui/button";

/** Odesílací tlačítko se stavem „ukládám" (čte stav nadřazeného <form>). */
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
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} name={name} value={value} {...variants}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
