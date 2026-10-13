import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import {
  deleteAction,
  editAction,
  moveActions,
  openAction,
  type RowAction,
} from "@/components/data-table/row-actions";
import { optionStats } from "@/components/data-table/stats";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { addSocialLink, deleteSocialLink, moveSocialLink } from "@/features/site/actions";
import { SiteSettingsForm, type SettingsValues } from "@/features/site/components/SiteSettingsForm";
import { SocialLinkForm } from "@/features/site/components/SocialLinkForm";
import { getSettingsRecord, listSocialLinks } from "@/features/site/editorial";
import { SITE_DEFAULTS } from "@/features/site/model";

export const metadata: Metadata = { title: "Site settings" };

const VISIBILITY = [
  { value: "shown", label: "Shown", tone: "success" as const },
  { value: "hidden", label: "Hidden", tone: "neutral" as const },
];

/** The form's starting values when the settings row is missing (it is seeded, so rarely). */
const DEFAULT_VALUES: SettingsValues = {
  name: SITE_DEFAULTS.name,
  alternate_names: SITE_DEFAULTS.alternateNames,
  legal_name: SITE_DEFAULTS.legalName,
  company_id: SITE_DEFAULTS.companyId,
  founding_date: SITE_DEFAULTS.foundingDate,
  street_address: SITE_DEFAULTS.address.streetAddress,
  postal_code: SITE_DEFAULTS.address.postalCode,
  address_locality: SITE_DEFAULTS.address.addressLocality,
  address_country: SITE_DEFAULTS.address.addressCountry,
  description: SITE_DEFAULTS.description,
  wikidata_id: SITE_DEFAULTS.wikidataId,
  contact_email: SITE_DEFAULTS.email,
  seo_title: SITE_DEFAULTS.seoTitle,
  title_suffix: SITE_DEFAULTS.titleSuffix,
  seo_description: SITE_DEFAULTS.seoDescription,
  og_image_url: SITE_DEFAULTS.ogImage,
  copyright: SITE_DEFAULTS.copyright,
};

/**
 * Site settings (section `site`): the publisher's facts and contact, search
 * and sharing defaults, the footer line, and the social network links in the
 * header. Who may save is decided by RLS; the buttons only follow it.
 */
export default async function SiteSettingsPage() {
  const access = await sectionAccess("site");
  if (!access) return <NoAccess />;
  const [settings, links] = await Promise.all([getSettingsRecord(), listSocialLinks()]);
  const canCreate = can(access.permissions, "site", "c");
  const canEdit = can(access.permissions, "site", "e");
  const canDelete = can(access.permissions, "site", "d");

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/site")}
        title="Site settings"
        lead="Facts about the publisher, the contact address, what search engines and shared links show by default, the footer and the social network links. Changes show on the site within a moment."
      />

      <SiteSettingsForm values={settings ?? DEFAULT_VALUES} canEdit={canEdit} />

      <section aria-labelledby="social-links" className="mt-12">
        <h2 id="social-links" className="font-display mb-1 text-[20px] font-bold">
          Social links
        </h2>
        <p className="mb-5 max-w-3xl text-[13.5px] text-[var(--color-ink-soft)]">
          Round badges in the site header, in this order; search engines also get them as the
          publisher&rsquo;s profiles. Hidden links stay here but don&rsquo;t show.
        </p>

        {canCreate ? (
          <div className="mb-8">
            <SocialLinkForm
              action={addSocialLink}
              title="New social link"
              submit="Add link"
              clearOnSuccess
            />
          </div>
        ) : null}

        <DataTable
          tableKey="admin-site-socials"
          caption="Social links"
          emptyTitle="No social links — the header shows no badges"
          initialSort={{ key: "order", dir: "asc" }}
          stats={optionStats("visibility", VISIBILITY)}
          actionsWidth="160px"
          columns={[
            { key: "order", label: "#", kind: "number", sortable: true, width: "64px" },
            {
              key: "label",
              label: "Network",
              link: canEdit,
              sortable: true,
              filter: "text",
              width: "minmax(140px, 1fr)",
            },
            {
              key: "url",
              label: "Address",
              kind: "code",
              filter: "text",
              width: "minmax(220px, 2fr)",
            },
            { key: "icon", label: "Badge", kind: "code", width: "88px" },
            {
              key: "visibility",
              label: "On the site",
              kind: "badge",
              options: VISIBILITY,
              sortable: true,
              filter: "select",
              width: "128px",
            },
            { key: "updated", label: "Changed", kind: "date", sortable: true, width: "128px" },
          ]}
          rows={links.map((link, index) => {
            const href = `/admin/site/socials/${link.id}`;
            const actions: RowAction[] = [
              ...(canEdit
                ? [
                    ...moveActions(
                      moveSocialLink.bind(null, link.id, true),
                      moveSocialLink.bind(null, link.id, false),
                      { first: index === 0, last: index === links.length - 1 },
                    ),
                    editAction(href),
                  ]
                : []),
              openAction(link.url, "Open the profile"),
              ...(canDelete
                ? [deleteAction(deleteSocialLink.bind(null, link.id), `the ${link.label} link`)]
                : []),
            ];
            return {
              id: link.id,
              href: canEdit ? href : undefined,
              values: {
                order: index + 1,
                label: link.label,
                url: link.url,
                icon: link.icon,
                visibility: link.visible ? "shown" : "hidden",
                updated: link.updated_at,
              },
              actions: <RowActions actions={actions} />,
            };
          })}
        />
      </section>
    </>
  );
}
