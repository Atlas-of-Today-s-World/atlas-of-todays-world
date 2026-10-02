import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/seo/robots";

/**
 * Open to search engines and AI crawlers (ADR-021): the Atlas is a non-profit
 * with an open-access mission, so being read, cited and summarised by answer
 * engines is the goal. Private and transactional paths stay closed.
 */
export default function robots(): MetadataRoute.Robots {
  return robotsRules();
}
