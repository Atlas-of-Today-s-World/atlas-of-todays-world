import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Spojí třídy a vyřeší konflikty Tailwindu (poslední vyhrává) — standard shadcn/ui. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
