"use client";

import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { CountryPicker, type CountryOption } from "@/components/admin/CountryPicker";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Checkbox, FormField, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { saveAccount } from "../actions";
import { ActionForm } from "@/components/ui/action-form";

interface Role {
  id: string;
  name: string;
  note: string;
  approval_scope: string;
}

/** Role, blokace a přiřazení schvalovatele (země, autoři). */
export function AccountForm({
  account,
  roles,
  countries,
  authors,
  isAdmin,
  isSelf,
}: {
  account: {
    id: string;
    role_id: string;
    status: string;
    blocked_note: string | null;
    approval_global: boolean;
    countries: string[];
    authors: string[];
  };
  roles: Role[];
  countries: CountryOption[];
  authors: { id: string; label: string }[];
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveAccount, { ok: false });
  const [roleId, setRoleId] = useState(account.role_id);
  const [status, setStatus] = useState(account.status === "blocked" ? "blocked" : "active");
  const errors = state.fieldErrors ?? {};
  const role = roles.find((r) => r.id === roleId);

  return (
    <ActionForm action={action} className="grid max-w-3xl gap-5">
      <input type="hidden" name="id" value={account.id} />
      {isSelf ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px]">
          You can’t change your own role or status — ask another admin.
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="role_id" label="Role" hint={role?.note} errors={errors.role_id}>
          <Select
            id="role_id"
            name="role_id"
            value={roleId}
            disabled={isSelf}
            onChange={(event) => setRoleId(event.target.value)}
          >
            {roles.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="status" label="Status" errors={errors.status}>
          <Select
            id="status"
            name="status"
            value={status}
            disabled={isSelf}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </Select>
        </FormField>
      </div>
      {isSelf ? (
        <>
          <input type="hidden" name="role_id" value={account.role_id} />
          <input type="hidden" name="status" value={status} />
        </>
      ) : null}
      {status === "blocked" ? (
        <FormField
          id="blocked_note"
          label="Reason for blocking"
          required
          errors={errors.blocked_note}
        >
          <Textarea
            id="blocked_note"
            name="blocked_note"
            maxLength={500}
            rows={2}
            defaultValue={account.blocked_note ?? ""}
          />
        </FormField>
      ) : null}

      {role?.approval_scope === "assigned" ? (
        <fieldset className="grid gap-4 rounded-xl border border-[var(--color-line)] p-4">
          <legend className="px-1 text-[13px] font-medium">
            Which articles this account approves
          </legend>
          {isAdmin ? (
            <Checkbox
              name="approval_global"
              defaultChecked={account.approval_global}
              label="All articles (global article approver)"
            />
          ) : (
            <input
              type="hidden"
              name="approval_global"
              value={account.approval_global ? "true" : "false"}
            />
          )}
          <FormField id="countries" label="Articles about these countries">
            <CountryPicker
              id="countries"
              name="countries"
              options={countries}
              defaultSelected={account.countries}
            />
          </FormField>
          <fieldset>
            <legend className="mb-1 text-[12.5px] font-medium text-[var(--color-ink-soft)]">
              Articles by these authors
            </legend>
            <div className="grid sm:grid-cols-2">
              {authors.map((author) => (
                <Checkbox
                  key={author.id}
                  name="authors"
                  value={author.id}
                  defaultChecked={account.authors.includes(author.id)}
                  label={author.label}
                />
              ))}
            </div>
          </fieldset>
        </fieldset>
      ) : (
        <>
          <input
            type="hidden"
            name="approval_global"
            value={account.approval_global ? "true" : "false"}
          />
          {account.countries.map((iso3) => (
            <input key={iso3} type="hidden" name="countries" value={iso3} />
          ))}
          {account.authors.map((author) => (
            <input key={author} type="hidden" name="authors" value={author} />
          ))}
        </>
      )}

      <ActionStatus state={state} />
      <div>
        <SubmitButton>Save account</SubmitButton>
      </div>
    </ActionForm>
  );
}
