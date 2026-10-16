import type { Metadata } from "next";
import { Download, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/data-table/DataTable";
import { RowActions } from "@/components/data-table/RowActions";
import { buttonVariants } from "@/components/ui/button";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes, routes, skillFiles } from "@/config/routes";
import { roleLabel, SKILLS_FOLDER, SKILLS_ON_GITHUB, skillLinks } from "@/features/skills/model";
import { getSkills } from "@/features/skills/queries";

export const metadata: Metadata = { title: "Claude skills" };

/**
 * The project's Claude skills as the public site shows them (/skills), with
 * their links (every team member, no section right needed). Nothing is edited
 * here: skills are files in the repository, changed by pull request.
 */
export default function SkillsAdminPage() {
  const skills = getSkills();
  const roles = [...new Set(skills.flatMap((skill) => skill.roles))].sort();

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.skills)}
        title="Claude skills"
        lead={
          <>
            Instructions that teach Claude how the Atlas is built, published at{" "}
            <a href={routes.skills} target="_blank" rel="noopener" className="underline">
              {routes.skills}
            </a>{" "}
            for anyone to read, download and load. They are files in the repository (
            <code>{SKILLS_FOLDER}/&lt;name&gt;/SKILL.md</code>): change one with a pull request on{" "}
            <a href={SKILLS_ON_GITHUB} target="_blank" rel="noopener" className="underline">
              GitHub
            </a>{" "}
            — the site shows the change after the next deploy.
          </>
        }
        actions={
          <>
            <a
              href={routes.skills}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink aria-hidden className="size-4" />
              Public page
            </a>
            <a
              href={skillFiles.all}
              download
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              <Download aria-hidden className="size-4" />
              All skills (ZIP)
            </a>
          </>
        }
      />
      <DataTable
        tableKey="admin-skills"
        caption="Claude skills"
        searchPlaceholder="Search skills…"
        emptyTitle="No skills in the repository yet"
        initialSort={{ key: "name", dir: "asc" }}
        maxRowActions={4}
        columns={[
          {
            key: "title",
            label: "Title",
            link: true,
            sortable: true,
            filter: "text",
            width: "minmax(200px, 1.5fr)",
          },
          {
            key: "name",
            label: "Name",
            kind: "code",
            sortable: true,
            filter: "text",
            width: "minmax(160px, 1fr)",
          },
          {
            key: "description",
            label: "Description",
            filter: "text",
            width: "minmax(260px, 3fr)",
          },
          {
            key: "roles",
            label: "Roles",
            kind: "tags",
            options: roles.map((role) => ({ value: role, label: roleLabel(role) })),
            filter: "select",
            width: "minmax(140px, 1fr)",
          },
          { key: "files", label: "Files", kind: "number", sortable: true, width: "80px" },
        ]}
        rows={skills.map((skill) => {
          const links = skillLinks(skill.name);
          return {
            id: skill.name,
            href: links.page,
            values: {
              title: skill.title,
              name: skill.name,
              description: skill.description,
              roles: skill.roles,
              files: skill.files.length,
            },
            actions: (
              <RowActions
                actions={[
                  {
                    kind: "link",
                    icon: "edit",
                    label: "Edit on GitHub",
                    href: links.edit,
                    newTab: true,
                  },
                  { kind: "link", icon: "view", label: "Read", href: links.page, newTab: true },
                  {
                    kind: "link",
                    icon: "source",
                    label: "Raw SKILL.md",
                    href: links.raw,
                    newTab: true,
                  },
                  {
                    kind: "link",
                    icon: "download",
                    label: "Download ZIP",
                    href: links.zip,
                    download: true,
                  },
                ]}
              />
            ),
          };
        })}
      />
    </>
  );
}
