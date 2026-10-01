"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { FormField, Input, Textarea, describedBy } from "@/components/ui/field";
import { UploadField } from "@/features/entries/components/UploadField";
import type { ActionState } from "@/lib/actions";
import { deleteAuthor, saveAuthor } from "../actions";
import type { AuthorRow } from "../editorial";

/** Profil autora hesel: jméno, fotka, životopis a positionality statement (P9). */
export function AuthorForm({ author }: { author: AuthorRow | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveAuthor, { ok: false });
  const errors = state.fieldErrors ?? {};
  const field = (id: string, hint?: string) => describedBy(id, { hint, errors: errors[id] });

  return (
    <ActionForm action={action} className="grid max-w-2xl gap-5">
      {author ? <input type="hidden" name="id" value={author.id} /> : null}

      <FormField id="name" label="Name" required errors={errors.name}>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={author?.name}
          {...field("name")}
        />
      </FormField>

      <FormField
        id="photo_url"
        label="Photo"
        hint="Square; cropped to a circle on the website."
        errors={errors.photo_url}
      >
        <UploadField
          id="photo_url"
          name="photo_url"
          defaultValue={author?.photo_url ?? ""}
          invalid={Boolean(errors.photo_url)}
        />
      </FormField>

      <FormField
        id="bio"
        label="Bio"
        hint="Who the author is and what they work on. Shown below the entry."
        errors={errors.bio}
      >
        <Textarea
          id="bio"
          name="bio"
          rows={5}
          maxLength={2000}
          defaultValue={author?.bio}
          {...field("bio", "hint")}
        />
      </FormField>

      <FormField
        id="positionality"
        label="Positionality statement"
        hint="Where the author writes from — personal experience, relationship to the place, possible biases."
        errors={errors.positionality}
      >
        <Textarea
          id="positionality"
          name="positionality"
          rows={5}
          maxLength={2000}
          defaultValue={author?.positionality}
          {...field("positionality", "hint")}
        />
      </FormField>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Saving…">{author ? "Save changes" : "Add author"}</SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}

export function DeleteAuthor({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete author"
      variant="danger"
      title={`Delete author ${name}?`}
      body="Their entries will remain, but without the photo, bio and positionality statement."
      confirm="Delete"
      action={() => deleteAuthor(id)}
      onDone={(state) => {
        if (state.ok) router.push("/admin/authors");
      }}
    />
  );
}
