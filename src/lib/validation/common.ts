import { z } from "zod";

/**
 * Stavební kameny Zod schémat administrace — stejné tvary jako CHECK v DB,
 * aby chyba přišla u pole, ne až z databáze.
 */

/** Prázdný řetězec z formuláře → undefined (volitelné pole). */
export const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const slug = (max = 120) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(max)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Jen malá písmena bez diakritiky, číslice a pomlčky.");

export const text = (max: number) => z.string().trim().max(max, `Nejvýš ${max} znaků.`);

export const requiredText = (max: number) => text(max).min(1, "Vyplňte prosím.");

export const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .regex(/^https:\/\/\S+$/, "Adresa musí začínat https://.");

export const optionalHttpsUrl = z.preprocess(blankToUndefined, httpsUrl.optional());

export const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Barva ve tvaru #rrggbb.")
  .transform((value) => value.toLowerCase());

export const iso3 = z.string().regex(/^[A-Z]{3}$/);

/** E-mail ve stejném tvaru jako CHECK v DB (invitations); bez vnořených kvantifikátorů (žádný ReDoS). */
export const emailAddress = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/, "Zadejte platný e-mail.");

export const uuid = z.string().uuid();

/** Číslo z formuláře (prázdné = undefined). */
export const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => (blankToUndefined(value) === undefined ? undefined : Number(value)),
    schema.optional(),
  );

export const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

/** Vytvoří z textu slug (název → adresa). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
