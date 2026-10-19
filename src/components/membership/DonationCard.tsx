"use client";

import { useId, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import Link from "@/components/i18n/Link";
import { useLocale, useMessages } from "@/components/i18n/LocaleProvider";
import { buttonVariants } from "@/components/ui/button";
import { format } from "@/lib/i18n/messages";
import type { DonationOptions } from "@/features/membership/config";
import { cn } from "@/lib/cn";
import { TurningCoin } from "./DonateCoin";
import { formatEuro } from "@/lib/format";
import { routes } from "@/config/routes";
import { track } from "@/features/conversions/track";

const OTHER = "other";

/**
 * A choice tile: a native radio (keyboard arrows, form value) styled as a
 * button. White when selected, darker blue otherwise (white text >= 4.5:1).
 * `badge` sits on the top edge and is part of the label, so it is read out too.
 */
function Choice({
  name,
  value,
  checked,
  onSelect,
  badge,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex min-h-(--touch-min) cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white",
        checked
          ? "bg-white text-[var(--color-ink)] shadow-sm"
          : "bg-[var(--color-patron-strong)] text-white hover:bg-blue-800",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {children}
      {badge ? (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[10.5px] leading-tight font-bold tracking-wide whitespace-nowrap text-[var(--color-ink)] uppercase shadow-sm">
          <span className="sr-only">, </span>
          {badge}
        </span>
      ) : null}
    </label>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={buttonVariants({
        variant: "ink",
        block: true,
        className: "group mt-6 gap-2.5 rounded-lg",
      })}
    >
      <TurningCoin />
      {children}
    </button>
  );
}

/**
 * The Atlas Patrons donation card: a monthly donation, preset or own amount;
 * the preselected preset (patron_settings.default_monthly) is marked
 * "Recommended".
 * Rendered twice on /membership — every id comes from useId, and each card is
 * its own form, so the radio groups never mix. `action` is the startCheckout
 * Server Action (passed in, so the card stays a plain UI block); `donation` are
 * the amounts from the settings (patron_settings) that the checkout accepts.
 */
export function DonationCard({
  action,
  donation,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  donation: DonationOptions;
  className?: string;
}) {
  const t = useMessages().patrons.card;
  const locale = useLocale();
  const id = useId();
  const { amounts, defaultAmount, otherAmount } = donation;
  const recommended = String(defaultAmount.monthly);
  const [amount, setAmount] = useState(recommended);
  const hasOther = donation.otherAmountPeriods.includes("monthly");
  const options = [...amounts.monthly.map(String), ...(hasOther ? [OTHER] : [])];
  // Own amount checked here, in the Atlas style (no browser bubble): the server
  // would only send an invalid amount silently back to this page.
  const [otherError, setOtherError] = useState(false);
  const otherInvalid = (value: string) => {
    const euros = Number(value);
    return (
      !value.trim() ||
      !Number.isInteger(euros) ||
      euros < otherAmount.min ||
      euros > otherAmount.max
    );
  };

  return (
    <form
      action={action}
      noValidate
      onSubmit={(event) => {
        const field = event.currentTarget.elements.namedItem("other");
        const invalid =
          amount === OTHER && field instanceof HTMLInputElement && otherInvalid(field.value);
        if (amount === OTHER) setOtherError(invalid);
        if (invalid) {
          event.preventDefault();
          field.focus();
          return;
        }
        // Counted only when the form really goes to the checkout.
        track("donate_click");
      }}
      aria-labelledby={`${id}-intro`}
      className={cn(
        "rounded-[var(--radius-panel)] bg-[var(--color-patron)] p-5 text-white shadow-xl shadow-blue-900/20 sm:p-8",
        className,
      )}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="period" value="monthly" />
      <p id={`${id}-intro`} className="mx-auto max-w-xs text-center text-[15px] leading-snug">
        {t.introMonthly}
      </p>

      <fieldset className="mt-6">
        <legend className="sr-only">{t.amount}</legend>
        {/* Row gap leaves room for the "Recommended" badge on a tile's top edge. */}
        <div
          className={cn(
            "grid gap-x-2 gap-y-4",
            options.length === 4 ? "grid-cols-2" : "grid-cols-3",
          )}
        >
          {options.map((option) => (
            <Choice
              key={option}
              name="amount"
              value={option}
              checked={amount === option}
              onSelect={() => setAmount(option)}
              badge={option === recommended ? t.recommended : undefined}
            >
              {option === OTHER ? t.other : formatEuro(Number(option), locale)}
            </Choice>
          ))}
        </div>
      </fieldset>

      {amount === OTHER ? (
        <div className="mt-4">
          <label htmlFor={`${id}-other`} className="text-[13px] font-semibold">
            {t.otherLabel}
          </label>
          <input
            id={`${id}-other`}
            name="other"
            type="number"
            inputMode="numeric"
            required
            min={otherAmount.min}
            max={otherAmount.max}
            step={1}
            aria-invalid={otherError || undefined}
            aria-describedby={`${id}-other-hint`}
            onChange={() => setOtherError(false)}
            className="mt-1 block min-h-(--touch-min) w-full rounded-lg border-0 bg-white px-3 text-[15px] text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[var(--color-warning-soft)]"
          />
          {/* The range is the hint and, after a wrong amount, the error (announced). */}
          <p
            id={`${id}-other-hint`}
            role={otherError ? "alert" : undefined}
            className={cn("mt-1 text-[12px] text-white", otherError && "font-semibold")}
          >
            {otherError ? `${t.otherError} ` : null}
            {format(t.otherHint, {
              min: formatEuro(otherAmount.min, locale),
              max: formatEuro(otherAmount.max, locale),
            })}
          </p>
        </div>
      ) : null}

      <SubmitButton>{t.submit}</SubmitButton>

      <p className="mt-4 text-center text-[12px] text-white">{t.processedBy}</p>
      <p className="text-center">
        <Link
          href={routes.manageMembership}
          className="inline-flex min-h-(--touch-min) items-center text-[12px] font-semibold underline underline-offset-2 hover:no-underline"
        >
          {t.manage}
        </Link>
      </p>
    </form>
  );
}
