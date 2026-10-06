import { z } from "zod";

/** Limits match the CHECKs in 20261006000050_volunteer_applications.sql. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A volunteer editor's application (errors are message codes for the public form). */
export const ApplicationInput = z.object({
  name: z.string().trim().min(1, "name").max(120, "name"),
  email: z.string().trim().toLowerCase().max(254, "invalidEmail").regex(EMAIL, "invalidEmail"),
  topics: z.string().trim().max(300, "tooLong"),
  message: z.string().trim().max(2000, "tooLong"),
  consent: z.literal("on", { message: "consent" }),
});

/** Where applications are sent; empty = nowhere yet. */
export const SettingsInput = z.object({
  notify_email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Too long.")
    .refine((value) => value === "" || EMAIL.test(value), "Enter a valid e-mail address."),
});

export const APPLICATION_STATUSES = ["new", "contacted", "closed"] as const;
