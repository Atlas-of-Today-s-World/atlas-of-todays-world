---
name: atlas-web
title: Start here — skills and roles
description: Index of all Atlas of Today's World skills and which ones each role should load. Use at the start of any task on the Atlas website or its administration (code, design, content, data, release) to pick the right skills, and whenever you are unsure which rules apply.
roles: [everyone]
---

# Atlas of Today's World — start here

The Atlas team works from one rulebook: these skills. Each rule lives in exactly one
skill; the others link to it. Pick your role, load its skills, and follow them over
any habit or generic advice. When a skill and the code disagree, the code is the
truth: fix the skill in the same pull request.

## Where the skills live

- **Source:** `.claude/skills/<name>/SKILL.md` in the
  [repository](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/tree/main/.claude/skills).
  Claude Code loads them automatically in this repo.
- **Online:** [atlas-of-todays-world.vercel.app/skills](https://atlas-of-todays-world.vercel.app/skills).
  Every skill has a readable page, its raw `SKILL.md` and a ZIP for upload to
  claude.ai (Settings → Capabilities → Skills). You can also download all of them at once.
- **In the administration:** [Admin → Skills](https://atlas-of-todays-world.vercel.app/admin/skills).
  It offers the same links, for editors.
- **Editing:** use "Edit on GitHub" to open a pull request. The change goes live with the
  next deploy, like any code change (see `atlas-testing-release`).

## Skills

| Skill | Use it when you… |
|---|---|
| `atlas-architecture` | change any code, database, auth, admin or CI; review a PR |
| `atlas-dedup` | add a component, helper or pattern, or remove dead code |
| `atlas-frontend` | build or change React components, pages or client behaviour |
| `atlas-backend` | touch Supabase, migrations, RLS, RPCs or Server Actions |
| `atlas-security` | touch auth, permissions, HTML/URLs, embeds, secrets, personal data (GDPR) |
| `atlas-performance` | change anything a reader downloads or waits for; investigate slowness |
| `atlas-seo` | add a public page, change titles, URLs, sitemap or structured data |
| `atlas-geo` | want AI answer engines to find, understand and cite the Atlas |
| `atlas-ux` | design or change what readers see and do |
| `atlas-visual-design` | choose colours, type, spacing, imagery or icons |
| `atlas-accessibility` | build any UI (keyboard, screen readers, contrast, motion) |
| `atlas-admin` | build admin screens, or work in the administration as an editor |
| `atlas-datatable` | add or change any list or table |
| `atlas-content` | write or edit topics, portraits, news, pages, images or UI texts |
| `atlas-maps-data` | work on the globe, data layers, indicators, maps and charts |
| `atlas-testing-release` | test, open a PR, merge, deploy, verify production, handle an incident |

## Roles

| Role | Who | Load |
|---|---|---|
| **Designer** | UX and visual design | `atlas-ux`, `atlas-visual-design`, `atlas-accessibility`, `atlas-dedup` |
| **Frontend developer** | components, pages, client code | `atlas-architecture`, `atlas-frontend`, `atlas-dedup`, `atlas-performance`, `atlas-accessibility`, `atlas-seo` |
| **Backend developer** | database, RLS, Server Actions, API | `atlas-architecture`, `atlas-backend`, `atlas-security`, `atlas-dedup` |
| **Editor** | writes and publishes content in the admin | `atlas-content`, `atlas-admin`, `atlas-seo`, `atlas-geo` |
| **Maps & data** | globe, indicators, maps and charts | `atlas-maps-data`, `atlas-performance`, `atlas-accessibility` |
| **Release / ops** | CI, deploys, production checks, incidents | `atlas-testing-release`, `atlas-security`, `atlas-performance` |
| **Admin user** | any invited team member | `atlas-admin`, `atlas-content` |
| **Reviewer** | reviews a pull request | `atlas-architecture` plus the skills of the changed area |

## Ground rules for everyone

- The site is English only. The admin is English too.
- Public pages stay static or ISR and fast. Never trade that away for a feature;
  see `atlas-architecture` and `atlas-performance`.
- Anyone invited into the admin team can edit any content. Readers have no admin access.
- Changes reach production only through a pull request, green CI and a merge to `main`.
  Nobody deploys by hand.
- The repository is public. Never commit secrets, private notes (`docs/` except
  `docs/architecture/`) or descriptions of unfixed security issues.
- Experiments and tests run against the `atlas-dev` Supabase project
  ([dashboard](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh)), never production.

## Proposing a new skill or role

Add `.claude/skills/atlas-<name>/SKILL.md` with the same frontmatter (`name`, `title`,
`description`, `roles`), add a row to the tables above, and open a pull request.
Candidates the team may need later: analytics and reader research, newsletter and
community, fundraising and patrons, translations (only if the owner adds a language).
