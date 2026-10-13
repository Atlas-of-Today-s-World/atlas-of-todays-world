"use client";

import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox, FormField, Input, Select, describedBy } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { savePatronSettings } from "../admin-actions";
import { PATRON_LIMITS } from "../config";
import type { PatronSettingsRow } from "../settings";

const { amount: AMOUNT, presets: PRESETS } = PATRON_LIMITS;
const euros = (value: number) => `${value.toLocaleString("en")} €`;
const HINT = {
  defaultMonthly: "Must be one of the monthly amounts.",
  defaultOneTime: "Must be one of the one-time amounts.",
  countsFrom:
    "Below this many patrons the page shows only the goal and an invitation, not “0 / 1,000”.",
};

/**
 * The donation card's amounts and the public goal (one row, patron_settings).
 * The checkout accepts exactly what is saved here; currency is always EUR.
 */
export function PatronSettingsForm({
  settings,
  canEdit,
}: {
  settings: PatronSettingsRow;
  canEdit: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(savePatronSettings, {
    ok: false,
  });
  const errors = state.fieldErrors ?? {};
  const field = (id: string, hint?: string) => describedBy(id, { hint, errors: errors[id] });
  const number = (id: keyof PatronSettingsRow, min: number, max: number, hint?: string) => (
    <Input
      id={id}
      name={id}
      type="number"
      inputMode="numeric"
      required
      min={min}
      max={max}
      step={1}
      defaultValue={String(settings[id])}
      disabled={!canEdit}
      {...field(id, hint)}
    />
  );
  const amountsHint = `Whole euros separated by commas, up to ${PRESETS}, each ${euros(AMOUNT.min)}–${euros(AMOUNT.max)}. Shown in ascending order.`;
  const otherHint = `Readers type their own whole amount within these bounds (${euros(AMOUNT.min)}–${euros(AMOUNT.max)}).`;

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-8">
      <fieldset className="grid gap-4 rounded-2xl border border-[var(--color-line)] p-5 sm:grid-cols-2">
        <legend className="font-display px-1 text-[17px] font-bold">Donation card</legend>
        <FormField
          id="monthly_amounts"
          label="Monthly amounts"
          hint={amountsHint}
          required
          errors={errors.monthly_amounts}
        >
          <Input
            id="monthly_amounts"
            name="monthly_amounts"
            required
            maxLength={80}
            defaultValue={settings.monthly_amounts.join(", ")}
            disabled={!canEdit}
            {...field("monthly_amounts", amountsHint)}
          />
        </FormField>
        <FormField
          id="one_time_amounts"
          label="One-time amounts"
          hint={amountsHint}
          required
          errors={errors.one_time_amounts}
        >
          <Input
            id="one_time_amounts"
            name="one_time_amounts"
            required
            maxLength={80}
            defaultValue={settings.one_time_amounts.join(", ")}
            disabled={!canEdit}
            {...field("one_time_amounts", amountsHint)}
          />
        </FormField>
        <FormField
          id="default_monthly"
          label="Preselected monthly amount"
          hint={HINT.defaultMonthly}
          required
          errors={errors.default_monthly}
        >
          {number("default_monthly", AMOUNT.min, AMOUNT.max, HINT.defaultMonthly)}
        </FormField>
        <FormField
          id="default_one_time"
          label="Preselected one-time amount"
          hint={HINT.defaultOneTime}
          required
          errors={errors.default_one_time}
        >
          {number("default_one_time", AMOUNT.min, AMOUNT.max, HINT.defaultOneTime)}
        </FormField>
        <FormField
          id="default_period"
          label="Card opens on"
          required
          errors={errors.default_period}
          className="sm:col-span-2"
        >
          <Select
            id="default_period"
            name="default_period"
            defaultValue={settings.default_period}
            disabled={!canEdit}
            {...field("default_period")}
          >
            <option value="monthly">Monthly</option>
            <option value="one-time">One-time</option>
          </Select>
        </FormField>
        <div className="grid gap-1 sm:col-span-2">
          <p className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
            “Other amount” (readers type their own)
          </p>
          <div className="flex flex-wrap gap-x-6">
            <Checkbox
              name="other_monthly"
              label="Offer it for monthly donations"
              defaultChecked={settings.other_amount_periods.includes("monthly")}
              disabled={!canEdit}
            />
            <Checkbox
              name="other_one_time"
              label="Offer it for one-time donations"
              defaultChecked={settings.other_amount_periods.includes("one-time")}
              disabled={!canEdit}
            />
          </div>
        </div>
        <FormField
          id="other_amount_min"
          label="Other amount — minimum (€)"
          hint={otherHint}
          required
          errors={errors.other_amount_min}
        >
          {number("other_amount_min", AMOUNT.min, AMOUNT.max, otherHint)}
        </FormField>
        <FormField
          id="other_amount_max"
          label="Other amount — maximum (€)"
          required
          errors={errors.other_amount_max}
        >
          {number("other_amount_max", AMOUNT.min, AMOUNT.max)}
        </FormField>
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-[var(--color-line)] p-5 sm:grid-cols-3">
        <legend className="font-display px-1 text-[17px] font-bold">Current goal</legend>
        <FormField id="goal_patrons" label="Patrons" required errors={errors.goal_patrons}>
          {number("goal_patrons", 1, PATRON_LIMITS.goalPatrons)}
        </FormField>
        <FormField
          id="goal_monthly_eur"
          label="Monthly sum (€)"
          required
          errors={errors.goal_monthly_eur}
        >
          {number("goal_monthly_eur", 1, PATRON_LIMITS.goalMonthlyEur)}
        </FormField>
        <FormField
          id="goal_counts_from"
          label="Show counts from"
          hint={HINT.countsFrom}
          required
          errors={errors.goal_counts_from}
        >
          {number("goal_counts_from", 0, PATRON_LIMITS.countsFrom, HINT.countsFrom)}
        </FormField>
      </fieldset>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending="Saving…">Save settings</SubmitButton>
          <ActionStatus state={state} />
        </div>
      ) : null}
    </ActionForm>
  );
}
