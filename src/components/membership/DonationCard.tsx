"use client";

import { useId, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Heart } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useLocale, useMessages } from "@/components/i18n/LocaleProvider";
import { buttonVariants } from "@/components/ui/button";
import { format } from "@/features/i18n/messages";
import {
  AMOUNTS,
  DEFAULT_AMOUNT,
  DEFAULT_PERIOD,
  OTHER_AMOUNT,
  OTHER_AMOUNT_PERIODS,
  type Period,
} from "@/features/membership/config";
import { cn } from "@/lib/cn";
import { formatEuro } from "@/lib/format";
import { routes } from "@/config/routes";

/** Tab order as on the original page: One-time | Monthly. */
const PERIOD_ORDER: readonly Period[] = ["one-time", "monthly"];
const OTHER = "other";

/**
 * A choice tile: a native radio (keyboard arrows, form value) styled as a
 * button. White when selected, darker blue otherwise (white text >= 4.5:1).
 */
function Choice({
  name,
  value,
  checked,
  onSelect,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-(--touch-min) cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition",
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
      className={buttonVariants({ variant: "ink", block: true, className: "mt-6 rounded-lg" })}
    >
      {children}
    </button>
  );
}

/**
 * The Atlas Patrons donation card (one-time / monthly, preset or own amount).
 * Rendered twice on /membership — every id comes from useId, and each card is
 * its own form, so the radio groups never mix. `action` is the startCheckout
 * Server Action (passed in, so the card stays a plain UI block).
 */
export function DonationCard({
  action,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
}) {
  const t = useMessages().patrons.card;
  const locale = useLocale();
  const id = useId();
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [amount, setAmount] = useState(String(DEFAULT_AMOUNT[DEFAULT_PERIOD]));

  const choosePeriod = (next: Period) => {
    setPeriod(next);
    setAmount(String(DEFAULT_AMOUNT[next]));
  };
  const hasOther = OTHER_AMOUNT_PERIODS.includes(period);
  const options = [...AMOUNTS[period].map(String), ...(hasOther ? [OTHER] : [])];
  // Own amount checked here, in the Atlas style (no browser bubble): the server
  // would only send an invalid amount silently back to this page.
  const [otherError, setOtherError] = useState(false);
  const otherInvalid = (value: string) => {
    const euros = Number(value);
    return (
      !value.trim() ||
      !Number.isInteger(euros) ||
      euros < OTHER_AMOUNT.min ||
      euros > OTHER_AMOUNT.max
    );
  };

  return (
    <form
      action={action}
      noValidate
      onSubmit={(event) => {
        const field = event.currentTarget.elements.namedItem("other");
        if (amount !== OTHER || !(field instanceof HTMLInputElement)) return;
        const invalid = otherInvalid(field.value);
        setOtherError(invalid);
        if (invalid) {
          event.preventDefault();
          field.focus();
        }
      }}
      aria-labelledby={`${id}-intro`}
      className={cn(
        "rounded-[var(--radius-panel)] bg-[var(--color-patron)] p-5 text-white shadow-xl shadow-blue-900/20 sm:p-8",
        className,
      )}
    >
      <input type="hidden" name="locale" value={locale} />
      <p id={`${id}-intro`} className="mx-auto max-w-xs text-center text-[15px] leading-snug">
        {period === "monthly" ? t.introMonthly : t.introOneTime}
      </p>

      <fieldset className="mt-5">
        <legend className="sr-only">{t.frequency}</legend>
        <div className="grid grid-cols-2 gap-2">
          {PERIOD_ORDER.map((item) => (
            <Choice
              key={item}
              name="period"
              value={item}
              checked={period === item}
              onSelect={() => choosePeriod(item)}
            >
              {item === "monthly" ? (
                <Heart
                  size={15}
                  aria-hidden
                  fill="currentColor"
                  className={period === item ? "text-[var(--color-patron)]" : undefined}
                />
              ) : null}
              {item === "monthly" ? t.monthly : t.oneTime}
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="sr-only">{t.amount}</legend>
        <div className={cn("grid gap-2", options.length === 4 ? "grid-cols-2" : "grid-cols-3")}>
          {options.map((option) => (
            <Choice
              key={`${period}-${option}`}
              name="amount"
              value={option}
              checked={amount === option}
              onSelect={() => setAmount(option)}
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
            min={OTHER_AMOUNT.min}
            max={OTHER_AMOUNT.max}
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
              min: formatEuro(OTHER_AMOUNT.min, locale),
              max: formatEuro(OTHER_AMOUNT.max, locale),
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
