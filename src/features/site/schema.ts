import { z } from "zod";
import {
  checkbox,
  emailAddress,
  httpsUrl,
  requiredText,
  text,
  uuid,
} from "@/lib/validation/common";

/**
 * Admin forms of Site settings. Limits match the CHECKs in
 * 20261013000170_site_settings.sql (the shared e-mail shape is stricter than
 * that CHECK, so anything it accepts the DB accepts too).
 */

/** Alternate names: one per line in the form, at most 10 of up to 120 characters. */
const alternateNames = z
  .string()
  .max(2000, "Too long.")
  .transform((value) =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  )
  .pipe(z.array(text(120)).max(10, "At most 10 alternate names."));

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "A date as YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Not a real date.");

/** Wikidata item, e.g. Q106194019; empty = none. */
const wikidataId = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (value) => value === "" || /^Q[1-9][0-9]{0,11}$/.test(value),
    "An item id like Q106194019.",
  )
  .transform((value) => value || null);

/** https:// or a path on this site ("/og-image.png"), never "//host" or "/\host". */
const OG_IMAGE = /^(https:\/\/\S+|\/[^/\\\s]\S*)$/;

export const SettingsInput = z.object({
  name: requiredText(120),
  alternate_names: alternateNames,
  legal_name: requiredText(200),
  company_id: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Eight digits."),
  founding_date: isoDate,
  street_address: requiredText(200),
  postal_code: requiredText(20),
  address_locality: requiredText(120),
  address_country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Two-letter country code, e.g. CZ."),
  description: requiredText(500),
  wikidata_id: wikidataId,
  contact_email: emailAddress,
  seo_title: requiredText(120),
  title_suffix: text(80),
  seo_description: requiredText(300),
  og_image_url: z
    .string()
    .trim()
    .max(1000, "At most 1000 characters.")
    .regex(OG_IMAGE, "An https:// address or a path on this site starting with /."),
  copyright: requiredText(200),
});

export const SocialInput = z.object({
  label: requiredText(60),
  url: httpsUrl,
  icon: z
    .string()
    .trim()
    .regex(/^\S{1,3}$/, "1–3 characters without spaces, e.g. IG."),
  visible: checkbox,
});

export const SocialId = uuid;
