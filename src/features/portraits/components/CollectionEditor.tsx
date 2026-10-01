"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/cn";
import type { Collection } from "../schema";
import { COLLECTION_UI } from "./fields";
import { ActionForm } from "@/components/ui/action-form";
import { swap } from "@/lib/array";

type Item = Record<string, string>;

/**
 * Editor jedné sekce portrétu (nebo zdrojů hesla): položky přidat, odebrat,
 * posunout (tlačítky, ať to jde i z klávesnice). Uloží se celá sekce najednou
 * — v jedné transakci — Server Action `save`; `target` říká, kam patří
 * (u portrétu kind + slug, u hesla entry_id).
 */
export function CollectionEditor({
  save,
  target,
  collection,
  initial,
}: {
  save: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  target: Record<string, string>;
  collection: Collection;
  initial: Item[];
}) {
  const ui = COLLECTION_UI[collection];
  const [items, setItems] = useState<Item[]>(initial);
  const [state, action] = useActionState<ActionState, FormData>(save, { ok: false });
  const blank = () => Object.fromEntries(ui.fields.map((f) => [f.name, f.options?.[0] ?? ""]));

  const update = (index: number, name: string, value: string) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [name]: value } : item)),
    );
  const move = (index: number, by: -1 | 1) =>
    setItems((current) => swap(current, index, index + by));

  return (
    <section
      aria-labelledby={`${collection}-title`}
      className="rounded-2xl border border-[var(--color-line)] p-5"
    >
      <h2 id={`${collection}-title`} className="font-display text-[18px] font-bold">
        {ui.title}
      </h2>
      <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">{ui.lead}</p>

      <ActionForm action={action} className="mt-5 grid gap-4">
        {Object.entries(target).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input type="hidden" name="collection" value={collection} />
        <input type="hidden" name="items" value={JSON.stringify(items)} />

        {items.map((item, index) => (
          <fieldset
            key={index}
            className="grid gap-3 rounded-xl bg-[var(--color-line)]/25 p-4 sm:grid-cols-2"
          >
            <legend className="sr-only">
              {ui.itemLabel} {index + 1}
            </legend>
            <div className="flex items-center justify-between sm:col-span-2">
              <span className="text-[12px] font-medium text-[var(--color-ink-muted)]">
                {ui.itemLabel} {index + 1}
              </span>
              <span className="flex gap-1">
                <IconAction
                  label={`Posunout ${ui.itemLabel.toLowerCase()} ${index + 1} nahoru`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  icon={<ArrowUp size={16} aria-hidden />}
                />
                <IconAction
                  label={`Posunout ${ui.itemLabel.toLowerCase()} ${index + 1} dolů`}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  icon={<ArrowDown size={16} aria-hidden />}
                />
                <IconAction
                  label={`Odebrat ${ui.itemLabel.toLowerCase()} ${index + 1}`}
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  icon={<Trash2 size={16} aria-hidden />}
                />
              </span>
            </div>
            {ui.fields.map((field) => {
              const id = `${collection}-${index}-${field.name}`;
              const value = item[field.name] ?? "";
              const onChange = (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                >,
              ) => update(index, field.name, event.target.value);
              return (
                <FormField
                  key={field.name}
                  id={id}
                  label={field.label}
                  required={field.required}
                  className={cn(field.full && "sm:col-span-2")}
                >
                  {field.kind === "select" ? (
                    <Select id={id} value={value} onChange={onChange}>
                      {field.options?.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </Select>
                  ) : field.kind === "textarea" ? (
                    <Textarea
                      id={id}
                      value={value}
                      onChange={onChange}
                      maxLength={field.max}
                      rows={3}
                    />
                  ) : (
                    <Input
                      id={id}
                      value={value}
                      onChange={onChange}
                      maxLength={field.max ?? 1000}
                      inputMode={field.kind === "url" ? "url" : undefined}
                      placeholder={field.kind === "url" ? "https://…" : undefined}
                    />
                  )}
                </FormField>
              );
            })}
          </fieldset>
        ))}

        {!items.length ? (
          <p className="text-[13px] text-[var(--color-ink-muted)]">
            Sekce je prázdná — na webu se ukáže šedě s výzvou k podpoře.
          </p>
        ) : null}

        <ActionStatus state={state} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((current) => [...current, blank()])}
            disabled={items.length >= 50}
          >
            <Plus size={16} aria-hidden /> Přidat {ui.itemLabel.toLowerCase()}
          </Button>
          <SubmitButton size="sm">Uložit sekci</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}

export function IconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}
