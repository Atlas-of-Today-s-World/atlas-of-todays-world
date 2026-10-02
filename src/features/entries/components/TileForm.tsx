"use client";

import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ActionForm } from "@/components/ui/action-form";
import { FormField, Input, Select, describedBy } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { saveTile } from "../actions";
import { TILE_ICON_LABEL, TILE_ICONS } from "../constants";
import type { EditableTile } from "../editorial";
import { UploadField } from "./UploadField";

/**
 * A learn-more tile: default (shown on every dossier) or one dossier's own
 * (`entryId`). Label, icon, short description and an optional background photo.
 */
export function TileForm({
  tile,
  entryId,
  submitLabel,
}: {
  tile: EditableTile | null;
  entryId?: string;
  submitLabel?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveTile, { ok: false });
  const errors = state.fieldErrors ?? {};
  const prefix = tile?.id ?? `new-${entryId ?? "default"}`;
  const id = (name: string) => `tile-${prefix}-${name}`;

  return (
    // A new tile's form starts empty again after a successful save.
    <ActionForm
      key={tile ? tile.id : String(state.ok && state.message)}
      action={action}
      className="grid gap-4"
    >
      {tile ? <input type="hidden" name="id" value={tile.id} /> : null}
      {entryId ? <input type="hidden" name="entry_id" value={entryId} /> : null}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <FormField id={id("label")} label="Label" required errors={errors.label}>
          <Input
            id={id("label")}
            name="label"
            required
            maxLength={60}
            defaultValue={tile?.label ?? ""}
            placeholder="Hand-written notes"
            {...describedBy(id("label"), { errors: errors.label })}
          />
        </FormField>
        <FormField id={id("icon")} label="Icon" errors={errors.icon}>
          <Select id={id("icon")} name="icon" defaultValue={tile?.icon ?? "link"}>
            {TILE_ICONS.map((icon) => (
              <option key={icon} value={icon}>
                {TILE_ICON_LABEL[icon]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        id={id("description")}
        label="Short description"
        hint="Shown on the tile while it has no links yet, and above its panel."
        errors={errors.description}
      >
        <Input
          id={id("description")}
          name="description"
          maxLength={200}
          defaultValue={tile?.description ?? ""}
          {...describedBy(id("description"), { hint: "hint", errors: errors.description })}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_6rem]">
        <FormField id={id("image")} label="Background photo" errors={errors.image_url}>
          <UploadField id={id("image")} name="image_url" defaultValue={tile?.image_url ?? ""} />
        </FormField>
        <FormField id={id("credit")} label="Photo credit" errors={errors.image_credit}>
          <Input
            id={id("credit")}
            name="image_credit"
            maxLength={300}
            defaultValue={tile?.image_credit ?? ""}
          />
        </FormField>
        <FormField id={id("position")} label="Order" errors={errors.position}>
          <Input
            id={id("position")}
            name="position"
            type="number"
            min={0}
            max={99}
            defaultValue={tile?.position ?? ""}
          />
        </FormField>
      </div>
      <ActionStatus state={state} />
      <div>
        <SubmitButton size="sm">{submitLabel ?? (tile ? "Save tile" : "Add tile")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
