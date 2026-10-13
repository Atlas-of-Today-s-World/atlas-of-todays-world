import { z } from "zod";
import { emailAddressWith } from "@/lib/validation/common";
import { NEWSLETTER_INTERESTS } from "./interests";

/** Newsletter form; errors are message codes (newsletterForm.messages). */
export const SubscribeInput = z.object({
  email: emailAddressWith("invalidEmail"),
  consent: z.literal("on", { message: "consent" }),
  interests: z
    .array(z.enum(NEWSLETTER_INTERESTS, { message: "interests" }))
    .min(1, "interests")
    .transform((values) => [...new Set(values)]),
});
