// Without Zod: the newsletter form in the header (on every page) imports these.

/**
 * What a subscriber can choose to receive (at least one). Sent to Mailchimp as
 * tags, so a campaign about new topics never goes to someone who only wants
 * news about the organisation, and the other way round.
 */
export const NEWSLETTER_INTERESTS = ["topics", "organisation"] as const;
type NewsletterInterest = (typeof NEWSLETTER_INTERESTS)[number];

/** Mailchimp tag of each interest (the team filters campaigns by these). */
export const INTEREST_TAGS: Record<NewsletterInterest, string> = {
  topics: "New topics",
  organisation: "Organisation news",
};
