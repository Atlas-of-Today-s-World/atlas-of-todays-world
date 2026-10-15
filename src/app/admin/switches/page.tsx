import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { confirmAction, editAction } from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { setFlag } from "@/features/flags/actions";
import { MaintenanceMessageForm } from "@/features/flags/components/SwitchForms";
import { getMaintenanceMessage, listFlags } from "@/features/flags/editorial";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/request";

export const metadata: Metadata = { title: "Switches & maintenance" };

const STATE = [
  { value: "on", label: "On", tone: "success" as const },
  { value: "off", label: "Off", tone: "neutral" as const },
];

/** What turning a switch on does, where it is more than "takes effect immediately". */
const TURN_ON: Record<string, string> = {
  maintenance:
    "Every public page shows the maintenance notice instead of its content, at once. The admin, sign-in and account pages keep working.",
};

/**
 * Feature switches and the maintenance message (F6). Turning a switch and its
 * note is a `permissions` "e" right (security — maintenance takes the site
 * down); the maintenance wording is site content (`site` "e"). Anyone with "v"
 * in either section sees the page; RLS decides every write.
 */
export default async function SwitchesPage() {
  const access = await sectionAccess(["permissions", "site"]);
  if (!access) return <NoAccess />;
  const [flags, message] = await Promise.all([listFlags(), getMaintenanceMessage()]);
  const canSwitch = can(access.permissions, "permissions", "e");
  const canWord = can(access.permissions, "site", "e");
  const t = (await getMessagesFor(DEFAULT_LOCALE)).map;
  const maintenanceOn = flags.some((flag) => flag.key === "maintenance" && flag.enabled);

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.switches.list)}
        title="Switches & maintenance"
        lead="Turn parts of the website on or off without a new release, and say what visitors read while the site is in maintenance."
      />

      <section aria-labelledby="maintenance-heading">
        <h2 id="maintenance-heading" className="font-display mb-1 text-[18px] font-bold">
          Maintenance message
        </h2>
        <p className="mb-4 max-w-2xl text-[13px] text-[var(--color-ink-soft)]">
          {maintenanceOn ? (
            <strong data-testid="maintenance-on">Maintenance is ON — visitors see this now.</strong>
          ) : (
            "Shown on every public page while the maintenance switch below is on."
          )}{" "}
          The admin, sign-in and account pages are never covered.
        </p>
        <ReadOnly
          readOnly={!canWord}
          reason="Changing the message needs the “Site content & settings” edit right."
        >
          <MaintenanceMessageForm
            message={message}
            builtIn={{ title: t.maintenanceTitle, text: t.maintenanceText }}
          />
        </ReadOnly>
      </section>

      <section aria-labelledby="switches-heading" className="mt-10">
        <h2 id="switches-heading" className="font-display mb-1 text-[18px] font-bold">
          Feature switches
        </h2>
        {canSwitch ? null : (
          <p className="mb-3 text-[13px] text-[var(--color-ink-soft)]">
            Turning switches on or off needs the “Roles & permissions” edit right.
          </p>
        )}
        <DataTable
          tableKey="admin-switches"
          caption="Feature switches"
          searchPlaceholder="Search switches…"
          emptyTitle="No switches"
          initialSort={{ key: "key", dir: "asc" }}
          stats={optionStats("state", STATE)}
          maxRowActions={2}
          columns={[
            { key: "key", label: "Switch", kind: "code", sortable: true, width: "200px" },
            {
              key: "state",
              label: "State",
              kind: "badge",
              options: STATE,
              sortable: true,
              filter: "select",
              width: "96px",
            },
            { key: "note", label: "Note", filter: "text", width: "minmax(240px, 3fr)" },
            { key: "updated", label: "Changed", kind: "datetime", sortable: true, width: "160px" },
          ]}
          rows={flags.map((flag) => ({
            id: flag.key,
            values: {
              key: flag.key,
              state: flag.enabled ? "on" : "off",
              note: flag.note,
              updated: flag.updated_at,
            },
            actions: canSwitch ? (
              <RowActions
                actions={[
                  editAction(adminRoutes.switches(flag.key), "Edit note"),
                  confirmAction(
                    flag.enabled ? "off" : "on",
                    flag.enabled ? "Turn off" : "Turn on",
                    setFlag.bind(null, flag.key, !flag.enabled),
                    `${flag.enabled ? "Turn off" : "Turn on"}: ${flag.key}?`,
                    (!flag.enabled && TURN_ON[flag.key]) ||
                      "The change takes effect on the website immediately.",
                  ),
                ]}
              />
            ) : undefined,
          }))}
        />
      </section>
    </>
  );
}
