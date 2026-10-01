"use client";

import { ChevronRight, Eye, Lock, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button } from "@/components/ui/button";
import { CheckboxControl } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import type { Action, Section } from "@/features/auth/sections";
import { cn } from "@/lib/cn";
import { deleteRole, saveMatrix } from "../actions";
import { ACTIONS, matrixFormData, matrixSections, toggleAction, type RoleGrants } from "../matrix";
import { RoleForm, type RoleValues } from "./RoleForms";

const ACTION_META: Record<Action, { label: string; icon: LucideIcon }> = {
  v: { label: "View", icon: Eye },
  c: { label: "Create", icon: Plus },
  e: { label: "Edit", icon: Pencil },
  d: { label: "Delete", icon: Trash2 },
};

export interface MatrixRole extends RoleValues {
  holders: number;
}

type Grants = Record<string, RoleGrants>;

/**
 * Role × section × view/create/edit/delete as one compact matrix (TealHub
 * "Roles and permissions"). Each click saves at once through the existing
 * `saveMatrix` Server Action (whole column of that role), so the database
 * stays the only judge — `guard_role_permissions` refuses what the user may
 * not change and the column snaps back with the reason.
 *
 * Saves of one role run one after another and always send the latest state,
 * so quick clicks cannot overtake each other.
 */
export function PermissionMatrix({
  roles,
  granted,
  ownRoleId,
  canEdit,
  canCreate,
  canDelete,
}: {
  roles: MatrixRole[];
  granted: Grants;
  ownRoleId: string | null;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const sections = matrixSections();
  // Rozdíly proti databázi jen po dobu ukládání; jinak platí `granted` ze serveru
  // (saveMatrix obnoví stránku), takže matice ukazuje, co DB opravdu uložila.
  const [pending, setPending] = useState<Grants>({});
  const grants: Grants = { ...granted, ...pending };
  const [expanded, setExpanded] = useState<Set<Section>>(new Set());
  const [status, setStatus] = useState<{ tone: "ok" | "error" | "busy"; text: string } | null>(
    null,
  );
  const latest = useRef<Grants>({});
  const queues = useRef(new Map<string, Promise<void>>());

  const readOnly = (role: MatrixRole) => role.locked || !canEdit || role.id === ownRoleId;

  const save = (roleId: string) => {
    const run = async () => {
      const sent = latest.current[roleId] ?? {};
      setStatus({ tone: "busy", text: "Saving…" });
      const state = await saveMatrix({ ok: false }, matrixFormData(roleId, sent));
      setStatus(
        state.ok
          ? { tone: "ok", text: "Permissions saved." }
          : { tone: "error", text: state.error ?? "Could not save the permissions." },
      );
      // Newer clicks are still queued: keep showing them.
      if (latest.current[roleId] !== sent) return;
      delete latest.current[roleId];
      setPending((current) => {
        const next = { ...current };
        delete next[roleId];
        return next;
      });
    };
    const queued = (queues.current.get(roleId) ?? Promise.resolve()).then(run, run);
    queues.current.set(roleId, queued);
  };

  const toggle = (roleId: string, section: Section, action: Action, checked: boolean) => {
    const role = { ...(latest.current[roleId] ?? granted[roleId] ?? {}) };
    role[section] = toggleAction(role[section] ?? "", action, checked);
    latest.current[roleId] = role;
    setPending((current) => ({ ...current, [roleId]: role }));
    save(roleId);
  };

  const toggleSection = (section: Section) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });

  return (
    <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 scheme-light">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-display text-[18px] font-bold">Permission matrix</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
            What each role may view, create, edit and delete. Changes are saved at once and enforced
            by the database. Admin always has full access; nobody can change their own role.
          </p>
        </div>
        {canCreate ? (
          <Dialog
            title="Add new role"
            className="w-[min(92vw,40rem)]"
            trigger={(open) => (
              <Button size="dense" onClick={open}>
                <Plus aria-hidden className="size-3.5" /> Add new role
              </Button>
            )}
          >
            {() => (
              <div className="mt-4">
                <RoleForm role={null} />
              </div>
            )}
          </Dialog>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status?.tone !== "error" ? status?.text : ""}
      </p>
      {status?.tone === "error" ? (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[var(--color-danger)]"
        >
          {status.text}
        </p>
      ) : null}

      <div className="relative overflow-x-auto rounded-xl border border-[var(--color-line)]">
        <table className="min-w-max table-fixed border-collapse text-[13px]">
          <caption className="sr-only">Permissions of roles by section</caption>
          <thead className="bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]">
            <tr>
              <th
                scope="col"
                rowSpan={2}
                className="sticky left-0 z-10 w-56 min-w-56 border-r border-b border-[var(--color-line)] bg-[var(--color-surface-muted)] px-3 py-2 text-left align-bottom text-[11px] font-medium tracking-wide uppercase"
              >
                Section
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  scope="colgroup"
                  colSpan={ACTIONS.length}
                  className="w-32 min-w-32 border-l border-[var(--color-line)] px-2 pt-2 pb-1 text-center font-medium text-[var(--color-ink)]"
                >
                  <span className="flex items-center justify-center gap-1">
                    <RoleName role={role} editable={canEdit && !role.locked} />
                    {role.locked ? (
                      <Lock
                        aria-label="Locked"
                        className="size-3 shrink-0 text-[var(--color-ink-muted)]"
                      />
                    ) : null}
                    {canDelete && !role.locked ? (
                      role.holders === 0 ? (
                        <ConfirmButton
                          label={`Delete role ${role.name}`}
                          icon={<Trash2 aria-hidden className="size-3" />}
                          variant="quietDanger"
                          size="rowIcon"
                          title={`Delete role ${role.name}?`}
                          body="Only a role nobody holds can be deleted."
                          confirm="Delete"
                          action={() => deleteRole(role.id)}
                          onDone={(state) => {
                            if (state.ok) router.refresh();
                          }}
                        />
                      ) : (
                        <span
                          className="text-[11px] font-normal text-[var(--color-ink-muted)]"
                          title={`${role.holders} ${role.holders === 1 ? "account holds" : "accounts hold"} this role`}
                        >
                          ({role.holders})
                        </span>
                      )
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              {roles.map((role) =>
                ACTIONS.map((action, index) => {
                  const { label, icon: Icon } = ACTION_META[action];
                  return (
                    <th
                      key={`${role.id}-${action}`}
                      scope="col"
                      className={cn(
                        "w-8 border-b border-[var(--color-line)] pb-1.5 font-normal",
                        index === 0 && "border-l",
                      )}
                    >
                      <Icon aria-hidden className="mx-auto size-3.5" />
                      <span className="sr-only">{label}</span>
                    </th>
                  );
                }),
              )}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => {
              const open = expanded.has(section.key);
              return (
                <Fragment key={section.key}>
                  <tr className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-b border-[var(--color-line)] bg-white px-2 py-1 text-left font-medium group-hover:bg-[var(--color-surface-hover)]"
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        {section.pages.length ? (
                          <button
                            type="button"
                            onClick={() => toggleSection(section.key)}
                            aria-expanded={open}
                            aria-label={`${open ? "Collapse" : "Expand"} ${section.label}`}
                            className="flex size-5 shrink-0 items-center justify-center rounded text-[var(--color-ink-muted)] hover:bg-[var(--color-line)] hover:text-[var(--color-ink)] pointer-coarse:size-(--touch-min)"
                          >
                            <ChevronRight
                              aria-hidden
                              className={cn("size-3.5 transition-transform", open && "rotate-90")}
                            />
                          </button>
                        ) : (
                          <span className="w-5 shrink-0" />
                        )}
                        <span className="truncate">{section.label}</span>
                      </span>
                      <code className="block truncate pl-6 font-mono text-[10.5px] font-normal text-[var(--color-ink-muted)]">
                        {section.key}
                      </code>
                    </th>
                    {roles.map((role) =>
                      ACTIONS.map((action, index) => {
                        const locked = readOnly(role);
                        const checked =
                          role.locked || (grants[role.id]?.[section.key] ?? "").includes(action);
                        return (
                          <td
                            key={`${role.id}-${action}`}
                            className={cn(
                              "border-b border-[var(--color-line)] p-0 text-center group-hover:bg-[var(--color-surface-hover)]",
                              index === 0 && "border-l",
                            )}
                          >
                            <label
                              className={cn(
                                "flex h-9 items-center justify-center pointer-coarse:h-(--touch-min)",
                                locked ? "cursor-not-allowed" : "cursor-pointer",
                              )}
                              title={
                                role.locked
                                  ? "Admin always has full access"
                                  : role.id === ownRoleId
                                    ? "You cannot change your own role"
                                    : ACTION_META[action].label
                              }
                            >
                              <CheckboxControl
                                aria-label={`${ACTION_META[action].label} – ${section.label} – ${role.name}`}
                                checked={checked}
                                disabled={locked}
                                onChange={(event) =>
                                  toggle(role.id, section.key, action, event.target.checked)
                                }
                              />
                            </label>
                          </td>
                        );
                      }),
                    )}
                  </tr>
                  {open
                    ? section.pages.map((page) => (
                        <tr
                          key={`${section.key}-${page.href}`}
                          className="group text-[var(--color-ink-soft)]"
                        >
                          <th
                            scope="row"
                            className="sticky left-0 z-10 border-r border-b border-[var(--color-line)] bg-white py-1 pr-2 pl-8 text-left font-normal group-hover:bg-[var(--color-surface-hover)]"
                          >
                            <span className="block truncate">{page.label}</span>
                            <code className="block truncate font-mono text-[10.5px] text-[var(--color-ink-muted)]">
                              {page.href}
                            </code>
                          </th>
                          {roles.map((role) =>
                            ACTIONS.map((action, index) => (
                              <td
                                key={`${role.id}-${action}`}
                                className={cn(
                                  "border-b border-[var(--color-line)] text-center group-hover:bg-[var(--color-surface-hover)]",
                                  index === 0 && "border-l",
                                )}
                                title={`Inherited from ${section.label}`}
                              >
                                <CheckboxControl
                                  aria-label={`${ACTION_META[action].label} – ${page.label} – ${role.name} (inherited from ${section.label})`}
                                  checked={
                                    role.locked ||
                                    (grants[role.id]?.[section.key] ?? "").includes(action)
                                  }
                                  disabled
                                  readOnly
                                />
                              </td>
                            )),
                          )}
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Role name in the header; opens the role details (name, scopes, note) when editable. */
function RoleName({ role, editable }: { role: MatrixRole; editable: boolean }) {
  if (!editable) {
    return (
      <span className="truncate" title={role.note || role.name}>
        {role.name}
      </span>
    );
  }
  return (
    <Dialog
      title={`Role ${role.name}`}
      className="w-[min(92vw,40rem)]"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          title={`Edit role ${role.name}`}
          className="truncate rounded px-0.5 underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
        >
          {role.name}
        </button>
      )}
    >
      {() => (
        <div className="mt-4">
          <RoleForm role={role} />
        </div>
      )}
    </Dialog>
  );
}
