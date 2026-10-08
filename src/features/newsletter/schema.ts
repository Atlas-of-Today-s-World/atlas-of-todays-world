import { z } from "zod";
import { emailAddressWith } from "@/lib/validation/common";

/** Newsletter form; errors are message codes (newsletterForm.messages). */
export const SubscribeInput = z.object({
  email: emailAddressWith("invalidEmail"),
  consent: z.literal("on", { message: "consent" }),
});
