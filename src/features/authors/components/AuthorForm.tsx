"use client";

import { useRouter } from "next/navigation";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SlugField, useSlug } from "@/components/admin/SlugField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { FormField, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { UploadField } from "@/components/admin/UploadField";
import { adminRoutes, routes } from "@/config/routes";
import { deleteAuthor, saveAuthor, saveAuthorAccount } from "../actions";
import type { AuthorRow } from "@/features/authors/types";

/** Entry author profile: name, photo, bio and positionality statement (P9). */
export function AuthorForm({ author }: { author: AuthorRow | null }) {
  const [state, action] = useServerAction(saveAuthor);
  const slug = useSlug(author?.slug);
  const errors = state.fieldErrors ?? {};
  const field = (id: string, hint?: string) => describedBy(id, { hint, errors: errors[id] });

  return (
    <ActionForm action={action} className="grid gap-5">
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

      {/* A new profile gets its URL from the name (unique, made by the DB). */}
      {author ? (
        <SlugField
          slug={slug}
          label="Profile URL (slug)"
          hint={`atlasoftodaysworld.org${routes.author(slug.value || "…")} — changing it redirects the old URL to the new one.`}
          errors={errors.slug}
        />
      ) : null}

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

      <div className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
          Selected works (shown under the bio)
        </span>
        <RichTextEditor
          name="works_html"
          initialHtml={author?.works_html ?? ""}
          label="Selected works"
          compact
        />
        {errors.works_html ? (
          <p className="text-[12px] text-[var(--color-danger)]">{errors.works_html.join(" ")}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Saving…">
          {author ? "Save changes" : "Add author profile"}
        </SubmitButton>
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
        if (state.ok) router.push(adminRoutes.authors.list);
      }}
    />
  );
}

/**
 * The team account this author profile belongs to (account managers only):
 * the linked account may then edit the bio itself. Saved through the DB
 * function set_author_account, which also checks the right.
 */
export function AuthorAccountForm({
  authorId,
  accountId,
  accounts,
}: {
  authorId: string;
  accountId: string | null;
  accounts: { id: string; label: string }[];
}) {
  const [state, action] = useServerAction(saveAuthorAccount);
  return (
    <ActionForm action={action} className="grid gap-3">
      <input type="hidden" name="id" value={authorId} />
      <FormField
        id="profile_id"
        label="Team account"
        hint="The linked account can edit this profile itself. One account per author profile."
        errors={state.fieldErrors?.profile_id}
      >
        <Select id="profile_id" name="profile_id" defaultValue={accountId ?? ""}>
          <option value="">Not linked</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="outline" pending="Saving…">
          Save account link
        </SubmitButton>
        <ActionStatus state={state} />
      </div>
    </ActionForm>
  );
}
