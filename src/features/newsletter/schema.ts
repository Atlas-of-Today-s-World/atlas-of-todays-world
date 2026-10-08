import { z } from "zod";
import { emailAddressWith } from "@/lib/validation/common";

/**
 * What a subscriber can choose to receive (at least one). Sent to Mailchimp as
 * tags, so a campaign about new topics never goes to someone who only wants
 * news about the organisation, and the other way round.
 */
export const NEWSLETTER_INTERESTS = ["topics", "organisation"] as const;
export type NewsletterInterest = (typeof NEWSLETTER_INTERESTS)[number];

/** Mailchimp tag of each interest (the team filters campaigns by these). */
export const INTEREST_TAGS: Record<NewsletterInterest, string> = {
  topics: "New topics",
  organisation: "Organisation news",
};

/** Newsletter form; errors are message codes (newsletterForm.messages). */
export const SubscribeInput = z.object({
  email: emailAddressWith("invalidEmail"),
  consent: z.literal("on", { message: "consent" }),
  interests: z
    .array(z.enum(NEWSLETTER_INTERESTS, { message: "interests" }))
    .min(1, "interests")
    .transform((values) => [...new Set(values)]),
});
