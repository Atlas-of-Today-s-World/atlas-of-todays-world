"use client";

import { useEffect, useRef } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { Checkbox, describedBy, FormField, Input } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";

export interface SocialValues {
  label: string;
  url: string;
  icon: string;
  visible: boolean;
}

const EMPTY: SocialValues = { label: "", url: "", icon: "", visible: true };

/**
 * A social network profile: new (`addSocialLink`) or existing
 * (`updateSocialLink` bound to its id). The badge text is what the round
 * button in the header shows.
 */
export function SocialLinkForm({
  action: save,
  values = EMPTY,
  title,
  submit,
  clearOnSuccess = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values?: SocialValues;
  title: string;
  submit: string;
  clearOnSuccess?: boolean;
}) {
  const [state, action] = useServerAction(save);
  const errors = state.fieldErrors ?? {};
  const form = useRef<HTMLFormElement>(null);
  // A new link was added: empty the form for the next one (an edit keeps its values).
  useEffect(() => {
    if (state.ok && clearOnSuccess) form.current?.reset();
  }, [state, clearOnSuccess]);
  return (
    <ActionForm
      ref={form}
      action={action}
      className="grid max-w-3xl gap-4 rounded-2xl border border-[var(--color-line)] p-5"
    >
      <h2 className="font-display text-[17px] font-bold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr_7rem]">
        <FormField id="social-label" label="Network" required errors={errors.label}>
          <Input
            id="social-label"
            name="label"
            required
            maxLength={60}
            placeholder="Instagram"
            defaultValue={values.label}
            {...describedBy("social-label", { errors: errors.label })}
          />
        </FormField>
        <FormField
          id="social-url"
          label="Profile address"
          hint="https:// only"
          required
          errors={errors.url}
        >
          <Input
            id="social-url"
            name="url"
            type="url"
            required
            maxLength={1000}
            placeholder="https://www.instagram.com/…"
            defaultValue={values.url}
            {...describedBy("social-url", { hint: "https:// only", errors: errors.url })}
          />
        </FormField>
        <FormField
          id="social-icon"
          label="Badge"
          hint="1–3 characters"
          required
          errors={errors.icon}
        >
          <Input
            id="social-icon"
            name="icon"
            required
            maxLength={3}
            placeholder="IG"
            defaultValue={values.icon}
            {...describedBy("social-icon", { hint: "1–3 characters", errors: errors.icon })}
          />
        </FormField>
      </div>
      <Checkbox
        name="visible"
        defaultChecked={values.visible}
        label="Show on the site (header badges and the publisher's profiles in search data)"
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{submit}</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}
