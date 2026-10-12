"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Icon-only row action (move up/down, remove) of the admin list editors. */
export function IconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}
