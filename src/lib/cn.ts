import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges classes and resolves Tailwind conflicts (last one wins) — the shadcn/ui standard. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
