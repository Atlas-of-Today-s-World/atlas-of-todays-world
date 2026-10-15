"use client";

import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { UploadField } from "@/components/admin/UploadField";
import { ActionForm } from "@/components/ui/action-form";
import { FormField, Input, Select, Textarea, describedBy } from "@/components/ui/field";
import { EmbedFrame } from "@/components/visuals/EmbedFrame";
import type { ActionState } from "@/lib/action-state";
import { EMBED_HEIGHT, EMBED_PROVIDER_INFO, MAX_EMBED_LENGTH, parseEmbed } from "@/lib/embeds";
import {
  VISUAL_KIND_LABEL,
  VISUAL_KINDS,
  VISUAL_LIMITS,
  type VisualKind,
} from "@/features/visuals/constants";
import { MapVisualBuilder, type MapSpec } from "@/features/visuals/map-slot";
import type { EditableVisual, VisualOwner } from "@/features/visuals/types";

const IDLE: ActionState = { ok: false };

const EMBED_FIELD_HINT =
  "Datawrapper: Publish → embed code (iframe or script). Flourish: Export & publish → embed code or the public link. Our World in Data: Share → Embed. World Bank: a chart's Share → Embed, or the indicator page's link.";

const HEIGHT_HINT = `Empty = the chart's own (Datawrapper and Flourish size themselves). ${EMBED_HEIGHT.min}–${EMBED_HEIGHT.max}.`;

const KIND_HINT: Record<VisualKind, string> = {
  embed:
    "An interactive chart or map from Datawrapper, Flourish, Our World in Data or the World Bank.",
  image: "A static picture: a map or an infographic as an image file.",
  map: "A map drawn in the Atlas itself, on its own data.",
};

/**
 * Add or change one visual (see VisualsEditor). For an embed the editor
 * pastes the embed code or the link; the provider is recognised as they type
 * (the same lib/embeds.ts the server validates with) and the chart previews
 * in the same sandboxed frame the site uses. Nothing pasted is kept but the
 * chart's address. A custom map is edited in the map builder of the map slot
 * — until that update arrives, the form says so.
 */
export function VisualForm({
  idPrefix,
  owner,
  visual,
  action,
}: {
  idPrefix: string;
  owner: VisualOwner;
  /** The visual being edited; none = a new one. */
  visual?: EditableVisual;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [kind, setKind] = useState<VisualKind>(visual?.kind ?? "embed");
  const [embed, setEmbed] = useState(visual?.embed_url ?? "");
  const [spec, setSpec] = useState<MapSpec | null>(visual?.map_spec ?? null);
  // A new, empty form after each added visual (an edited one keeps its values).
  const [round, setRound] = useState(0);
  const [state, submit] = useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await action(previous, formData);
    if (result.ok && !visual) {
      setKind("embed");
      setEmbed("");
      setSpec(null);
      setRound((value) => value + 1);
    }
    return result;
  }, IDLE);

  const id = (field: string) => `${idPrefix}-${field}`;
  const errors = (field: string) => state.fieldErrors?.[field];
  const detected = kind === "embed" ? parseEmbed(embed) : null;

  return (
    <ActionForm key={round} action={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="owner_kind" value={owner.kind} />
      <input type="hidden" name="owner_key" value={owner.key} />
      <input type="hidden" name="id" value={visual?.id ?? ""} />

      <FormField id={id("kind")} label="Type" hint={KIND_HINT[kind]} required>
        <Select
          id={id("kind")}
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as VisualKind)}
          {...describedBy(id("kind"), { hint: KIND_HINT[kind] })}
        >
          {VISUAL_KINDS.map((option) => (
            <option key={option} value={option}>
              {VISUAL_KIND_LABEL[option]}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField id={id("title")} label="Title" errors={errors("title")} required>
        <Input
          id={id("title")}
          name="title"
          required
          maxLength={VISUAL_LIMITS.title}
          defaultValue={visual?.title ?? ""}
          {...describedBy(id("title"), { errors: errors("title") })}
        />
      </FormField>

      {kind === "embed" ? (
        <div className="grid gap-3 sm:col-span-2">
          <FormField
            id={id("embed")}
            label="Embed code or link"
            hint={EMBED_FIELD_HINT}
            errors={errors("embed")}
            required
          >
            <Textarea
              id={id("embed")}
              name="embed"
              rows={3}
              maxLength={MAX_EMBED_LENGTH}
              value={embed}
              onChange={(event) => setEmbed(event.target.value)}
              spellCheck={false}
              className="font-mono text-[12.5px]"
              {...describedBy(id("embed"), { hint: EMBED_FIELD_HINT, errors: errors("embed") })}
            />
          </FormField>
          <p
            role="status"
            className="text-[12.5px] text-[var(--color-ink-soft)]"
            data-testid="visual-provider"
          >
            {detected
              ? `Recognised: ${EMBED_PROVIDER_INFO[detected.provider].label} — ${detected.url}`
              : embed.trim()
                ? "Not recognised: only charts from Datawrapper, Flourish, Our World in Data and the World Bank data site can be embedded."
                : null}
          </p>
          {detected ? (
            <EmbedFrame
              key={detected.url}
              provider={detected.provider}
              url={detected.url}
              title="Preview"
              openLabel="Open the chart"
              className="border border-[var(--color-line)]"
            />
          ) : null}
        </div>
      ) : null}

      {kind === "image" ? (
        <FormField
          id={id("image")}
          label="Image"
          hint="Upload the picture, or paste its https address."
          errors={errors("image_url")}
          required
          className="sm:col-span-2"
        >
          <UploadField
            id={id("image")}
            name="image_url"
            defaultValue={visual?.image_url ?? ""}
            invalid={Boolean(errors("image_url")?.length)}
          />
        </FormField>
      ) : null}

      {kind === "map" ? (
        <div className="grid gap-2 sm:col-span-2">
          <input type="hidden" name="map_spec" value={spec ? JSON.stringify(spec) : ""} />
          {MapVisualBuilder ? (
            <MapVisualBuilder value={spec} onChange={setSpec} />
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--color-line)] p-4 text-[13px] text-[var(--color-ink-soft)]">
              Custom map editor coming in the next update. Until then, embed a map from Datawrapper,
              Flourish or Our World in Data.
            </p>
          )}
          {errors("map_spec")?.length ? (
            <p className="text-[12px] text-[var(--color-danger)]">{errors("map_spec")![0]}</p>
          ) : null}
        </div>
      ) : null}

      <FormField
        id={id("caption")}
        label="Caption"
        hint="One or two sentences under the visual: what it shows."
        errors={errors("caption")}
        className="sm:col-span-2"
      >
        <Textarea
          id={id("caption")}
          name="caption"
          rows={2}
          maxLength={VISUAL_LIMITS.caption}
          defaultValue={visual?.caption ?? ""}
          {...describedBy(id("caption"), { errors: errors("caption") })}
        />
      </FormField>

      <FormField id={id("source")} label="Source" errors={errors("source_label")}>
        <Input
          id={id("source")}
          name="source_label"
          maxLength={VISUAL_LIMITS.sourceLabel}
          placeholder="UNHCR, World Bank…"
          defaultValue={visual?.source_label ?? ""}
          {...describedBy(id("source"), { errors: errors("source_label") })}
        />
      </FormField>

      <FormField id={id("source-url")} label="Source link (https)" errors={errors("source_url")}>
        <Input
          id={id("source-url")}
          name="source_url"
          type="url"
          maxLength={VISUAL_LIMITS.url}
          defaultValue={visual?.source_url ?? ""}
          {...describedBy(id("source-url"), { errors: errors("source_url") })}
        />
      </FormField>

      <FormField
        id={id("height")}
        label="Height in pixels"
        hint={HEIGHT_HINT}
        errors={errors("height")}
      >
        <Input
          id={id("height")}
          name="height"
          type="number"
          inputMode="numeric"
          min={EMBED_HEIGHT.min}
          max={EMBED_HEIGHT.max}
          step={10}
          defaultValue={visual?.height ?? ""}
          {...describedBy(id("height"), { hint: HEIGHT_HINT, errors: errors("height") })}
        />
      </FormField>

      <div className="grid gap-3 sm:col-span-2">
        <ActionStatus state={state} />
        <div>
          <SubmitButton size="sm">{visual ? "Save changes" : "Add map or chart"}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
