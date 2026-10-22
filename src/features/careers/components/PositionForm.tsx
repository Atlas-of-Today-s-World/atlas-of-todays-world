"use client";

import { useRouter } from "next/navigation";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { FormField, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { adminRoutes, routes } from "@/config/routes";
import { deletePosition, savePosition } from "../actions";
import type { PositionRow } from "../editorial";
import { POSITION_TEMPLATE_HTML } from "../template";

const STATUS_LABELS = {
  draft: "Draft — not on the website yet",
  open: "Open — on the careers page, accepting applications",
  closed: "Closed — off the website, its applications stay",
} as const;

/**
 * One position of the careers page (new or existing): title, address, the
 * facts shown on its card (location, type, summary), the profile and the
 * status. A new position starts with the sections of the Editor profile.
 */
export function PositionForm({ position }: { position: PositionRow | null }) {
  const [state, action] = useServerAction(savePosition);
  const errors = state.fieldErrors ?? {};
  const field = (id: string, hint?: string) => describedBy(id, { hint, errors: errors[id] });

  return (
    <ActionForm action={action} className="grid gap-5">
      {position ? <input type="hidden" name="id" value={position.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="title" label="Job title" required errors={errors.title}>
          <Input
            id="title"
            name="title"
            required
            maxLength={120}
            defaultValue={position?.title}
            {...field("title")}
          />
        </FormField>
        <FormField
          id="slug"
          label="Address"
          required
          hint={`The page is ${routes.career("<address>")} — lowercase letters, digits and hyphens.`}
          errors={errors.slug}
        >
          <Input
            id="slug"
            name="slug"
            required
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={position?.slug}
            {...field("slug", "hint")}
          />
        </FormField>
        <FormField
          id="location"
          label="Location"
          hint="E.g. Remote, Prague."
          errors={errors.location}
        >
          <Input
            id="location"
            name="location"
            maxLength={80}
            defaultValue={position?.location ?? "Remote"}
            {...field("location", "hint")}
          />
        </FormField>
        <FormField
          id="job_type"
          label="Job type"
          hint="E.g. Volunteer, Part-time, Internship."
          errors={errors.job_type}
        >
          <Input
            id="job_type"
            name="job_type"
            maxLength={60}
            defaultValue={position?.job_type ?? "Volunteer"}
            {...field("job_type", "hint")}
          />
        </FormField>
      </div>

      <FormField
        id="summary"
        label="Summary"
        hint="One or two sentences for the position's card on the careers page and for search results."
        errors={errors.summary}
      >
        <Textarea
          id="summary"
          name="summary"
          rows={2}
          maxLength={300}
          defaultValue={position?.summary}
          {...field("summary", "hint")}
        />
      </FormField>

      <div className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
          Position profile
        </span>
        <RichTextEditor
          name="body_html"
          label="Position profile"
          initialHtml={position?.body_html ?? POSITION_TEMPLATE_HTML}
          sitePaths
        />
        <p className="text-[12px] text-[var(--color-ink-muted)]">
          About the role, duties, requirements, what we offer and expect. The application form
          (name, e-mail, CV and a message) follows the profile on the page.
        </p>
        {errors.body_html?.length ? (
          <p role="alert" className="text-[12px] text-[var(--color-danger)]">
            {errors.body_html[0]}
          </p>
        ) : null}
      </div>

      <FormField id="status" label="Status" errors={errors.status}>
        <Select
          id="status"
          name="status"
          defaultValue={position?.status ?? "draft"}
          className="max-w-md"
          {...field("status")}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Saving…">{position ? "Save changes" : "Add position"}</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}

export function DeletePosition({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete position"
      variant="danger"
      title={`Delete the position “${title}”?`}
      body="It disappears from the careers page. Its applications stay in the list. To stop accepting applications but keep the position, close it instead."
      confirm="Delete"
      action={() => deletePosition(id)}
      onDone={(state) => {
        if (state.ok) router.push(adminRoutes.careers.list);
      }}
    />
  );
}
