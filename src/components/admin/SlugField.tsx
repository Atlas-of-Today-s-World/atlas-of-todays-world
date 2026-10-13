"use client";

import { useState } from "react";
import { FormField, Input, describedBy } from "@/components/ui/field";
import { slugify } from "@/lib/slug";

/**
 * The slug of a form whose URL follows its title or name: a new record's slug
 * is derived from the text (`follow`) until the editor types into the slug
 * field (`edit`); an existing record (`initial` given) keeps its slug.
 */
export function useSlug(initial: string | undefined) {
  const [value, setValue] = useState(initial ?? "");
  const [touched, setTouched] = useState(initial !== undefined);
  return {
    value,
    /** onChange of the title / name field. */
    follow: (text: string) => {
      if (!touched) setValue(slugify(text));
    },
    /** onChange of the slug field itself: from now on the slug is the editor's. */
    edit: (next: string) => {
      setTouched(true);
      setValue(next);
    },
    /** A restored draft: its slug (if it may change) and no more following. */
    restore: (next?: string) => {
      if (next !== undefined) setValue(next);
      setTouched(true);
    },
  };
}

type SlugState = ReturnType<typeof useSlug>;

/** The "slug" field of an admin form (state from `useSlug`). */
export function SlugField({
  slug,
  label = "URL (slug)",
  hint,
  errors,
  readOnly,
}: {
  slug: SlugState;
  label?: string;
  hint?: string;
  errors?: string[];
  readOnly?: boolean;
}) {
  return (
    <FormField id="slug" label={label} required hint={hint} errors={errors}>
      <Input
        id="slug"
        name="slug"
        required
        maxLength={120}
        value={slug.value}
        readOnly={readOnly}
        onChange={(event) => slug.edit(event.target.value)}
        {...describedBy("slug", { hint, errors })}
      />
    </FormField>
  );
}
