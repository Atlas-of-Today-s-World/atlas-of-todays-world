"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useLocale, useMessages } from "@/components/i18n/LocaleProvider";
import { useLocalizedRouter } from "@/components/i18n/useLocalizedRouter";
import { Button } from "@/components/ui/button";
import { describedBy, FormField, Input, RequiredNote, Select } from "@/components/ui/field";
import { format } from "@/features/i18n/messages";
import { formatEuro } from "@/lib/format";
import {
  cardErrors,
  demoPayment,
  formatCardNumber,
  formatExpiry,
  type CardField,
} from "../demo-card";
import { thankYouHref, type Donation } from "../schema";
import { routes } from "@/config/routes";

/** A short list is enough for the demo; names come from Intl in the page language. */
const COUNTRIES = ["CZ", "SK", "DE", "AT", "PL", "FR", "IT", "ES", "NL", "GB", "US", "CA"] as const;
const PROCESSING_MS = 1500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = "email" | "name" | CardField;
type Errors = Partial<Record<Field, string>>;

/**
 * DEMO imitation of a Stripe Checkout page. Every input is unnamed (state
 * only) and the form has no action, so nothing is ever submitted, logged or stored — the
 * check runs in the browser (demo-card.ts) and success just navigates to the
 * thank-you page. Real Stripe Checkout (ADR G6) replaces this whole page.
 */
export function DemoCheckout({ donation }: { donation: Donation }) {
  const messages = useMessages();
  const t = messages.patrons.checkout;
  const locale = useLocale();
  const router = useLocalizedRouter();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [processing, setProcessing] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const amount = formatEuro(donation.amount, locale);
  const monthly = donation.period === "monthly";
  const regions = new Intl.DisplayNames([locale], { type: "region" });

  useEffect(() => {
    if (!processing) return;
    const timer = window.setTimeout(() => router.push(thankYouHref(donation)), PROCESSING_MS);
    return () => window.clearTimeout(timer);
  }, [processing, router, donation]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Errors = {};
    if (!EMAIL.test(email.trim())) next.email = email.trim() ? t.errors.email : t.errors.required;
    if (!name.trim()) next.name = t.errors.required;
    // Every card field at once — not the expiry only after the number is fixed.
    const card = { number, expiry, cvc };
    const invalid = cardErrors(card);
    for (const key of invalid) next[key] = card[key].trim() ? t.errors[key] : t.errors.required;
    if (!invalid.length) {
      const result = demoPayment(card);
      if (!result.ok) {
        next[result.field] =
          result.reason === "declined" ? t.errors.declined : t.errors[result.field];
      }
    }
    setErrors(next);
    const first = (["email", "number", "expiry", "cvc", "name"] as const).find((key) => next[key]);
    if (first) {
      form.current?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-${first}`)}`)?.focus();
      return;
    }
    setProcessing(true);
  };

  const field = (key: Field) => ({
    id: `${id}-${key}`,
    ...describedBy(`${id}-${key}`, { errors: errors[key] ? [errors[key]] : undefined }),
  });
  const fieldErrors = (key: Field) => (errors[key] ? [errors[key]] : undefined);

  return (
    <div>
      <p
        role="note"
        className="bg-[var(--color-warning-soft)] px-6 py-3 text-center text-[14px] font-semibold text-[var(--color-warning)]"
      >
        {t.demoBanner}
      </p>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <section aria-labelledby={`${id}-summary`}>
          <Link
            href={routes.membership}
            className="inline-flex min-h-(--touch-min) items-center gap-2 text-[14px] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <ArrowLeft size={16} aria-hidden />
            {t.back}
          </Link>
          <h1 id={`${id}-summary`} className="mt-8 text-[15px] text-[var(--color-ink-soft)]">
            {t.product} – {monthly ? t.monthly : t.oneTime}
          </h1>
          <p className="font-display mt-2 text-[40px] font-bold">
            {monthly ? format(t.perMonth, { amount }) : amount}
          </p>
          <dl className="mt-8 flex justify-between border-t border-[var(--color-line)] pt-4 text-[15px]">
            <dt>{t.total}</dt>
            <dd className="font-semibold">{amount}</dd>
          </dl>
        </section>

        <form ref={form} noValidate onSubmit={onSubmit} aria-label={t.title} className="grid gap-5">
          <RequiredNote label={t.requiredNote} />
          <fieldset className="grid gap-4" disabled={processing}>
            <legend className="font-display mb-1 text-[17px] font-bold">{t.contact}</legend>
            <FormField id={`${id}-email`} label={t.email} errors={fieldErrors("email")} required>
              <Input
                {...field("email")}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
          </fieldset>

          <fieldset className="grid gap-4" disabled={processing}>
            <legend className="font-display mb-1 text-[17px] font-bold">{t.payment}</legend>
            <FormField
              id={`${id}-number`}
              label={t.cardNumber}
              errors={fieldErrors("number")}
              required
            >
              <Input
                {...field("number")}
                inputMode="numeric"
                autoComplete="off"
                placeholder="1234 1234 1234 1234"
                value={number}
                onChange={(event) => setNumber(formatCardNumber(event.target.value))}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                id={`${id}-expiry`}
                label={t.expiry}
                errors={fieldErrors("expiry")}
                required
              >
                <Input
                  {...field("expiry")}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="MM / YY"
                  value={expiry}
                  onChange={(event) => setExpiry(formatExpiry(event.target.value))}
                />
              </FormField>
              <FormField id={`${id}-cvc`} label={t.cvc} errors={fieldErrors("cvc")} required>
                <Input
                  {...field("cvc")}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="CVC"
                  value={cvc}
                  onChange={(event) => setCvc(event.target.value.replace(/\D/g, ""))}
                />
              </FormField>
            </div>
            <FormField id={`${id}-name`} label={t.name} errors={fieldErrors("name")} required>
              <Input
                {...field("name")}
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
            <FormField id={`${id}-country`} label={t.country}>
              <Select id={`${id}-country`} defaultValue="CZ">
                {COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {regions.of(code) ?? code}
                  </option>
                ))}
              </Select>
            </FormField>
          </fieldset>

          <Button type="submit" variant="patron" block disabled={processing} aria-busy={processing}>
            {processing ? t.processing : monthly ? t.subscribe : format(t.pay, { amount })}
          </Button>
          <p className="flex items-start gap-2 text-[12.5px] text-[var(--color-ink-muted)]">
            <Lock size={14} aria-hidden className="mt-0.5 shrink-0" />
            {t.privacy}
          </p>
          <p aria-live="polite" className="sr-only">
            {processing ? t.processing : ""}
          </p>
        </form>
      </div>
    </div>
  );
}
