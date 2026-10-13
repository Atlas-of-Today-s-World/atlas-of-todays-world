import type { Period } from "./config";
import { routes } from "@/config/routes";

// Without Zod: the demo checkout (a client component) builds its thank-you link here.

/** A validated donation: whole euros and a period from config.ts. */
export interface Donation {
  period: Period;
  amount: number;
}

const query = ({ period, amount }: Donation) =>
  new URLSearchParams({ period, amount: String(amount) }).toString();

export const checkoutHref = (donation: Donation) => `${routes.checkout}?${query(donation)}`;
export const thankYouHref = (donation: Donation) => `${routes.thankYou}?${query(donation)}`;
