import { SOCIALS } from "@/config/navigation";
import { ORGANIZATION } from "@/config/organization";
import type { Tables } from "@/lib/db/types.gen";
import { safeUrl } from "@/lib/security/urls";

/**
 * Site settings and social links (Admin → Site settings; tables site_settings
 * and site_social_links). Plain data and mappers, no server dependency: the
 * public reads are in queries.ts, the admin's in editorial.ts.
 *
 * The defaults are the values the code had before the admin took them over —
 * the same values the migration seeds — so a missing row or a failed read
 * shows exactly what the site showed before.
 */

export interface SiteSettings {
  /** The publisher's name (and the site's brand). */
  name: string;
  alternateNames: readonly string[];
  legalName: string;
  /** Czech company registration number (IČO). */
  companyId: string;
  /** YYYY-MM-DD. */
  foundingDate: string;
  address: {
    streetAddress: string;
    postalCode: string;
    addressLocality: string;
    /** ISO 3166-1 alpha-2. */
    addressCountry: string;
  };
  description: string;
  /** Wikidata item (Q…), null = none. */
  wikidataId: string | null;
  /** The one public contact address. */
  email: string;
  /** Title of the home page and of pages without their own. */
  seoTitle: string;
  /** Appended to page titles after a space; empty = none. */
  titleSuffix: string;
  seoDescription: string;
  /** Default preview image: https:// or a path on this site. */
  ogImage: string;
  /** Footer line. */
  copyright: string;
}

/** A social network profile: header badge and `sameAs` of the publisher. */
export interface SocialLink {
  label: string;
  href: string;
  /** Text of the round badge ("IG", "in"…). */
  icon: string;
}

export const SITE_DEFAULTS: SiteSettings = {
  name: ORGANIZATION.name,
  alternateNames: ORGANIZATION.alternateName,
  legalName: ORGANIZATION.legalName,
  companyId: ORGANIZATION.companyId,
  foundingDate: ORGANIZATION.foundingDate,
  address: ORGANIZATION.address,
  description: ORGANIZATION.description,
  wikidataId: ORGANIZATION.wikidataId,
  email: ORGANIZATION.email,
  seoTitle: `${ORGANIZATION.name} — interactive atlas of every country`,
  titleSuffix: `— ${ORGANIZATION.name}`,
  seoDescription:
    "Explore every country and world region on an interactive satellite globe: political systems, living conditions, human development and the stories behind them.",
  ogImage: "/og-image.png",
  copyright: "© Atlas of Today’s World",
};

export const SOCIAL_DEFAULTS: readonly SocialLink[] = SOCIALS;

/** The columns the public site reads (anon has a grant on exactly these and a few more). */
export const SETTINGS_COLUMNS =
  "name, alternate_names, legal_name, company_id, founding_date, street_address, postal_code, address_locality, address_country, description, wikidata_id, contact_email, seo_title, title_suffix, seo_description, og_image_url, copyright";

export type SettingsRow = Omit<Tables<"site_settings">, "id" | "updated_at">;

export function settingsFromRow(row: SettingsRow): SiteSettings {
  return {
    name: row.name,
    alternateNames: row.alternate_names,
    legalName: row.legal_name,
    companyId: row.company_id,
    foundingDate: row.founding_date,
    address: {
      streetAddress: row.street_address,
      postalCode: row.postal_code,
      addressLocality: row.address_locality,
      addressCountry: row.address_country,
    },
    description: row.description,
    wikidataId: row.wikidata_id,
    email: row.contact_email,
    seoTitle: row.seo_title,
    titleSuffix: row.title_suffix,
    seoDescription: row.seo_description,
    // The DB CHECK allows only https:// or a path on this site; safeUrl guards the page anyway.
    ogImage: safeUrl(row.og_image_url) ?? SITE_DEFAULTS.ogImage,
    copyright: row.copyright,
  };
}

/** Public social links; a row whose address isn't a safe https URL is left out. */
export function socialsFromRows(
  rows: readonly Pick<Tables<"site_social_links">, "label" | "url" | "icon">[],
): SocialLink[] {
  return rows.flatMap((row) => {
    const href = safeUrl(row.url);
    return href ? [{ label: row.label, href, icon: row.icon }] : [];
  });
}

/** What the root layout appends to page titles (" — Atlas of Today's World"). */
export const titleSuffix = (site: Pick<SiteSettings, "titleSuffix">) =>
  site.titleSuffix ? ` ${site.titleSuffix}` : "";

/** Street, postal code and town on one line (About page). */
export const postalAddress = ({ address }: Pick<SiteSettings, "address">) =>
  `${address.streetAddress}, ${address.postalCode} ${address.addressLocality}`;
