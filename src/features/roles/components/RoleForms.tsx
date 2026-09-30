"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Checkbox, FormField, Input, Select, Textarea } from "@/components/ui/field";
import { SECTIONS } from "@/features/auth/sections";
import type { ActionState } from "@/lib/actions";
import { deleteRole, saveMatrix, saveRole, saveSecurity } from "../actions";
import { ACTION_LABEL, SECTION_LABEL } from "../schema";
import { ActionForm } from "@/components/admin/ActionForm";

const ACTIONS = ["v", "c", "e", "d"] as const;

/**
 * Oprávnění jedné role: tabulka sekce × akce. Bez „zobrazit" ostatní akce
 * nic neznamenají — DB je uloží jen spolu s „v".
 */
export function MatrixForm({
  roleId,
  roleName,
  granted,
  readOnly,
}: {
  roleId: string;
  roleName: string;
  granted: Record<string, string>;
  readOnly: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveMatrix, { ok: false });
  return (
    <ActionForm action={action} className="grid gap-3">
      <input type="hidden" name="role_id" value={roleId} />
      <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Oprávnění role {roleName}</caption>
          <thead className="bg-[var(--color-line)]/30 text-[12px] text-[var(--color-ink-muted)]">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Sekce
              </th>
              {ACTIONS.map((a) => (
                <th key={a} scope="col" className="px-2 py-2 font-medium">
                  {ACTION_LABEL[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((section) => (
              <tr key={section} className="border-t border-[var(--color-line)]">
                <th scope="row" className="px-3 py-1 text-left font-normal">
                  {SECTION_LABEL[section]}
                </th>
                {ACTIONS.map((a) => (
                  <td key={a} className="px-2 text-center">
                    <input
                      type="checkbox"
                      name={`perm:${section}`}
                      value={a}
                      defaultChecked={readOnly || (granted[section] ?? "").includes(a)}
                      disabled={readOnly}
                      aria-label={`${SECTION_LABEL[section]}: ${ACTION_LABEL[a]}`}
                      className="size-5 accent-[var(--color-accent)]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {readOnly ? (
        <p className="text-[12.5px] text-[var(--color-ink-muted)]">
          Admin má vždy všechno; jeho oprávnění se nedají omezit.
        </p>
      ) : (
        <>
          <ActionStatus state={state} />
          <div>
            <SubmitButton size="sm">Uložit oprávnění</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export interface RoleValues {
  id: string;
  name: string;
  note: string;
  locked: boolean;
  news_scope: string;
  approval_scope: string;
}

export function RoleForm({ role }: { role: RoleValues | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveRole, { ok: false });
  const errors = state.fieldErrors ?? {};
  const prefix = role ? `role-${role.id}` : "role-new";
  return (
    <ActionForm action={action} className="grid gap-4">
      <input type="hidden" name="is_new" value={role ? "false" : "true"} />
      {role ? <input type="hidden" name="id" value={role.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${prefix}-name`} label="Název" required errors={errors.name}>
          <Input
            id={`${prefix}-name`}
            name="name"
            required
            maxLength={60}
            defaultValue={role?.name}
          />
        </FormField>
        {!role ? (
          <FormField id={`${prefix}-id`} label="Identifikátor" required errors={errors.id}>
            <Input
              id={`${prefix}-id`}
              name="id"
              required
              maxLength={40}
              placeholder="napr-lektor"
            />
          </FormField>
        ) : null}
        <FormField id={`${prefix}-news`} label="Čí články upravuje" errors={errors.news_scope}>
          <Select id={`${prefix}-news`} name="news_scope" defaultValue={role?.news_scope ?? "none"}>
            <option value="none">žádné</option>
            <option value="own">jen své</option>
            <option value="all">všechny</option>
          </Select>
        </FormField>
        <FormField id={`${prefix}-approval`} label="Co schvaluje" errors={errors.approval_scope}>
          <Select
            id={`${prefix}-approval`}
            name="approval_scope"
            defaultValue={role?.approval_scope ?? "none"}
          >
            <option value="none">nic</option>
            <option value="assigned">přidělené země a autory</option>
            <option value="global">všechno</option>
          </Select>
        </FormField>
      </div>
      <FormField id={`${prefix}-note`} label="Popis role" errors={errors.note}>
        <Textarea
          id={`${prefix}-note`}
          name="note"
          maxLength={500}
          rows={2}
          defaultValue={role?.note}
        />
      </FormField>
      <ActionStatus state={state} />
      <div>
        <SubmitButton size="sm">{role ? "Uložit roli" : "Založit roli"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteRole({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Smazat roli"
      variant="danger"
      title={`Smazat roli ${name}?`}
      body="Jde to jen u role, kterou nikdo nemá. Účty nejdřív převeďte jinam."
      confirm="Smazat"
      action={() => deleteRole(id)}
      onDone={(state) => {
        if (state.ok) router.refresh();
      }}
    />
  );
}

export function SecurityForm({
  settings,
  roles,
}: {
  settings: {
    session_hours: number;
    lock_after: number;
    invite_only: boolean;
    require_2fa_roles: string[];
  };
  roles: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveSecurity, { ok: false });
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="session_hours"
          label="Délka přihlášení (hodin)"
          errors={errors.session_hours}
        >
          <Input
            id="session_hours"
            name="session_hours"
            type="number"
            min={1}
            max={720}
            defaultValue={settings.session_hours}
          />
        </FormField>
        <FormField
          id="lock_after"
          label="Zamknout po neúspěšných pokusech"
          errors={errors.lock_after}
        >
          <Input
            id="lock_after"
            name="lock_after"
            type="number"
            min={1}
            max={20}
            defaultValue={settings.lock_after}
          />
        </FormField>
      </div>
      <Checkbox
        name="invite_only"
        defaultChecked={settings.invite_only}
        label="Do týmu jen pozvánkou (a jen z povolených adres, je-li seznam vyplněný)"
      />
      <fieldset>
        <legend className="mb-1 text-[12.5px] font-medium text-[var(--color-ink-soft)]">
          Role, které musí mít dvoufázové ověření (TOTP)
        </legend>
        <div className="grid sm:grid-cols-2">
          {roles.map((role) => (
            <Checkbox
              key={role.id}
              name="require_2fa_roles"
              value={role.id}
              defaultChecked={settings.require_2fa_roles.includes(role.id)}
              label={role.name}
            />
          ))}
        </div>
      </fieldset>
      <ActionStatus state={state} />
      <div>
        <SubmitButton size="sm">Uložit nastavení</SubmitButton>
      </div>
    </ActionForm>
  );
}
