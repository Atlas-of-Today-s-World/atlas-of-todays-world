-- =============================================================================
-- Editable site pages: About, Privacy, Terms, Accessibility (section `site`)
-- =============================================================================
--
-- The texts of these pages were hard-coded in the app. They move into the
-- database so team members with the `site` permission can edit them in the
-- admin (/admin/pages). Owner decision: site pages publish directly (no
-- approval workflow), but every save keeps a revision that can be restored.
--
-- 1. site_pages: one row per page. `slug` comes from a fixed list (named CHECK
--    site_pages_slug_check — a later migration adds a page by replacing it and
--    seeding the row); each slug is a page the app renders at a fixed route.
--    body_html is sanitized by the app on save and again on render
--    (lib/security/sanitize.ts); the CHECK caps its length. Placeholders in
--    the body ({{contact}}, {{email}}, {{data-sources}}) are filled in by the
--    app at render time, never stored expanded.
-- 2. site_page_revisions: append-only. A SECURITY DEFINER trigger stores the
--    saved state after every insert and every update that changes content, and
--    writes one lean audit_log entry (the body stays in the revision, not
--    twice in the audit log). Nobody writes revisions directly; the team with
--    site:v reads them; anonymous readers never see them.
-- 3. restore_site_page(revision): copies a revision's content (title,
--    description, lead, body, last reviewed — not the published switch) back
--    onto its page as the caller (SECURITY INVOKER — RLS decides: site:v to
--    read the revision, site:e to update the page). The restore is itself a
--    save, so it adds a new revision and nothing is lost.
-- 4. Visibility: anon reads only published rows and only public columns
--    (updated_by stays internal); the team with site:v reads every row.
--    Insert needs site:c, update site:e; there is no delete (unpublish
--    instead — the website then shows the built-in default text).
-- 5. Seed: today's exact texts, so nothing visible changes on deploy.
-- =============================================================================

create table public.site_pages (
  slug           text primary key
                 constraint site_pages_slug_check
                 check (slug in ('about', 'privacy', 'terms', 'accessibility')),
  title          text not null check (length(btrim(title)) between 1 and 200),
  description    text not null check (length(btrim(description)) between 1 and 300),
  lead           text not null default '' check (length(lead) <= 1000),
  body_html      text not null default '' check (length(body_html) <= 100000),
  last_reviewed  date check (last_reviewed between date '2000-01-01' and date '2100-12-31'),
  published      boolean not null default true,
  updated_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index site_pages_updated_by on public.site_pages (updated_by);

comment on table public.site_pages is
  'Editable site pages (About, Privacy, Terms, Accessibility); the app falls back to built-in text when a row is missing or unpublished.';

create table public.site_page_revisions (
  id             bigint generated always as identity primary key,
  page_slug      text not null references public.site_pages (slug) on delete cascade,
  saved_at       timestamptz not null default now(),
  saved_by       uuid references public.profiles (id) on delete set null,
  title          text not null check (length(title) <= 200),
  description    text not null check (length(description) <= 300),
  lead           text not null check (length(lead) <= 1000),
  body_html      text not null check (length(body_html) <= 100000),
  last_reviewed  date,
  published      boolean not null
);
create index site_page_revisions_page on public.site_page_revisions (page_slug, saved_at desc, id desc);
create index site_page_revisions_saved_by on public.site_page_revisions (saved_by);

comment on table public.site_page_revisions is
  'Append-only history of site_pages: the saved state after every change (written by a trigger).';

-- Who saved: the signed-in editor (null for migrations and the service key).
create or replace function public.stamp_site_page_editor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke execute on function public.stamp_site_page_editor() from public, anon, authenticated;

create trigger site_pages_stamp
  before update on public.site_pages
  for each row execute function public.stamp_row();
create trigger site_pages_stamp_editor
  before insert or update on public.site_pages
  for each row execute function public.stamp_site_page_editor();

-- Revision + audit entry after every save that changes content. SECURITY
-- DEFINER: editors have no insert right on the revisions table.
create or replace function public.keep_site_page_revision()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  revision bigint;
begin
  if tg_op = 'UPDATE'
     and (old.title, old.description, old.lead, old.body_html, old.last_reviewed, old.published)
         is not distinct from
         (new.title, new.description, new.lead, new.body_html, new.last_reviewed, new.published) then
    return null;
  end if;
  insert into site_page_revisions
    (page_slug, saved_by, title, description, lead, body_html, last_reviewed, published)
  values
    (new.slug, auth.uid(), new.title, new.description, new.lead, new.body_html,
     new.last_reviewed, new.published)
  returning id into revision;
  perform write_audit(
    'site_pages.' || lower(tg_op),
    new.slug,
    jsonb_build_object('revision', revision, 'title', new.title, 'published', new.published));
  return null;
end;
$$;
revoke execute on function public.keep_site_page_revision() from public, anon, authenticated;

create trigger site_pages_revision
  after insert or update on public.site_pages
  for each row execute function public.keep_site_page_revision();

-- Restores a revision onto its page, as the caller (RLS applies to both tables).
create or replace function public.restore_site_page(p_revision bigint)
returns text
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  restored text;
begin
  update site_pages p
     set title = r.title,
         description = r.description,
         lead = r.lead,
         body_html = r.body_html,
         last_reviewed = r.last_reviewed
    from site_page_revisions r
   where r.id = p_revision
     and p.slug = r.page_slug
  returning p.slug into restored;
  if restored is null then
    raise exception 'This version can''t be restored (no permission, or it no longer exists).'
      using errcode = '42501';
  end if;
  return restored;
end;
$$;
revoke execute on function public.restore_site_page(bigint) from public, anon;
grant execute on function public.restore_site_page(bigint) to authenticated;

alter table public.site_pages enable row level security;
alter table public.site_page_revisions enable row level security;

create policy site_pages_public on public.site_pages for select to anon
  using (published);
create policy site_pages_read on public.site_pages for select to authenticated
  using (published or (select public.has_perm('site', 'v')));
create policy site_pages_add on public.site_pages for insert to authenticated
  with check ((select public.has_perm('site', 'c')));
create policy site_pages_change on public.site_pages for update to authenticated
  using ((select public.has_perm('site', 'e')))
  with check ((select public.has_perm('site', 'e')));

create policy site_page_revisions_read on public.site_page_revisions for select to authenticated
  using ((select public.has_perm('site', 'v')));

revoke all on public.site_pages from anon, authenticated;
revoke all on public.site_page_revisions from anon, authenticated;
-- Public columns only: who saved last (updated_by) is internal.
grant select (slug, title, description, lead, body_html, last_reviewed, published,
              created_at, updated_at)
  on public.site_pages to anon, authenticated;
grant insert (slug, title, description, lead, body_html, last_reviewed, published)
  on public.site_pages to authenticated;
grant update (title, description, lead, body_html, last_reviewed, published)
  on public.site_pages to authenticated;
grant select on public.site_page_revisions to authenticated;

-- -----------------------------------------------------------------------------
-- Seed: the texts the app rendered until now (kept identical to
-- src/features/site-pages/defaults.ts, which the app falls back to; a unit
-- test compares the two). Stored in sanitized form.
-- -----------------------------------------------------------------------------

insert into public.site_pages (slug, title, description, lead, body_html, last_reviewed) values
(
  'about',
  'About the Atlas',
  'Atlas of Today’s World is an independent encyclopedia of the present, built around an interactive 3D globe.',
  'Atlas of Today’s World is an independent encyclopedia of the present. Instead of an A–Z list, it starts from a satellite globe: you spin it, click a country, and the Atlas opens that country’s profile together with the portrait of the world region it belongs to. News opens inside the same map, so the geographic context never disappears.',
  $html$<h2 id="mission">Our mission</h2>
<p>Atlas of Today’s World helps anyone understand today’s world in its geographic context — free to read, without advertising and without an account. We are a non-profit, non-governmental organization registered in the Czech Republic since 2016, supported by our readers through Atlas Patrons.</p>
<h2 id="data">Where the data comes from</h2>
<p>Country borders and names come from Natural Earth. The data layers are imported in bulk from Our World in Data and refreshed with a single command, so a yearly update takes minutes rather than manual editing:</p>
<p>{{data-sources}}</p>
<h2>Editorial content</h2>
<p>Region portraits, country profiles and news are written by the Atlas team in the Atlas’s own editorial system, where every change goes through review before it is published.</p>
<h2 id="editorial-standards">Editorial standards and corrections</h2>
<p>Every article names its author and shows when it was published and last updated. Facts link to their sources, and every number comes with the year and the institution that measured it. Each change is reviewed by an editor before it is published. If you find a mistake, write to {{email}}: we correct errors openly and update the article’s date.</p>
<h2 id="cite">How to cite the Atlas</h2>
<p>Atlas of Today’s World, “page title”, page URL (date of access). Data layers can also be cited with their original source, which every page names.</p>
<h2 id="machine-readable">For researchers, search engines and AI tools</h2>
<p>The Atlas is open to search engines and AI assistants. A Markdown overview for language models is at /llms.txt (full text at /llms-full.txt), every article has a Markdown version (add .md to its address), and new articles appear in our RSS and Atom feeds.</p>$html$,
  null
),
(
  'privacy',
  'Privacy policy',
  'What personal data Atlas of Today''s World processes, why, and your rights.',
  '',
  $html$<p>Atlas of Today’s World is an independent encyclopedia of the present. You can read everything without an account, and we collect as little about you as we can. Questions and requests about your data: {{contact}}.</p>
<h2>Reading the Atlas</h2>
<ul>
<li>We do not use advertising or tracking cookies, and we do not build profiles of readers.</li>
<li>Our hosting provider (Vercel) keeps short-lived technical logs, including IP addresses, to run and protect the site.</li>
<li>We count visits with Vercel Web Analytics, which uses no cookies and stores no personal data — only anonymous totals such as page views and countries.</li>
<li>To open the globe over your country, the home page asks our server for the country of your IP address (as our hosting provider sees it). Only the two-letter country code is used, in your browser, and it is not stored.</li>
<li>The globe loads map tiles and fonts from MapTiler or Esri and from OpenMapTiles. Your browser contacts those servers directly, so they see your IP address.</li>
<li>Searches are rate-limited to stop abuse. For that we store a one-way hash of your IP address for up to a day, never the address itself.</li>
</ul>
<h2>Accounts</h2>
<p>You can create an account with Google. We receive and store your e-mail address and the name on your Google profile, and we keep a session cookie that is strictly necessary to keep you signed in. Members of the Atlas team also have a role and, for some roles, a second factor (an authenticator app). Changes made in the editorial system are logged for 12 months without personal details.</p>
<p>You can delete your account at any time on the <a href="/ucet" rel="noopener noreferrer">account page</a>. That removes your profile and personal data from our database.</p>
<h2>Newsletter</h2>
<p>If you sign up, your e-mail address goes to Mailchimp, which sends the newsletter on our behalf. You confirm the subscription by clicking a link in a first e-mail (double opt-in), and every newsletter has an unsubscribe link.</p>
<h2>Volunteer editors</h2>
<p>If you apply to write for the Atlas as a volunteer, we keep your name, e-mail address and what you tell us in our database, so the editorial team can get in touch. Only the people who manage accounts can see it, and we delete it on request or when it is no longer needed.</p>
<h2>Who processes the data</h2>
<ul>
<li>Supabase — database and sign-in, hosted in Frankfurt (EU).</li>
<li>Vercel — hosting of the website.</li>
<li>Google — sign-in, only if you choose to sign in.</li>
<li>Mailchimp — newsletter, only if you subscribe.</li>
</ul>
<h2>Your rights</h2>
<p>Under the GDPR you can ask what data we hold about you, have it corrected or deleted, object to processing, and complain to your data protection authority. The legal basis is your consent (newsletter, account) and our legitimate interest in running a secure website (technical logs, abuse protection).</p>$html$,
  date '2026-09-30'
),
(
  'terms',
  'Terms of use',
  'The rules for using Atlas of Today''s World.',
  '',
  $html$<h2>Using the Atlas</h2>
<p>You may read, link to and quote the Atlas freely. Please credit “Atlas of Today’s World” with a link to the page you quote.</p>
<h2>Data and sources</h2>
<p>The data layers come from third parties such as Our World in Data, each under its own licence, which is named next to every figure. Country borders follow Natural Earth and the practice of the United Nations; they are not a statement on any territorial dispute.</p>
<h2>Accuracy</h2>
<p>We check our texts and cite our sources, but the Atlas is a work in progress. It is general information, not professional advice. If you find a mistake, tell us: {{contact}}.</p>
<h2>Accounts</h2>
<p>Keep your sign-in to yourself. We may suspend accounts that are used to abuse the site. How we handle your data is described in the <a href="/privacy" rel="noopener noreferrer">privacy policy</a>.</p>$html$,
  date '2026-09-30'
),
(
  'accessibility',
  'Accessibility statement',
  'How accessible Atlas of Today''s World is, and how to reach us about barriers.',
  '',
  $html$<p>We want everyone to be able to use the Atlas. We aim for the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA, and every change is checked automatically with axe.</p>
<h2>What works</h2>
<ul>
<li>A “Skip to content” link, keyboard navigation and visible focus.</li>
<li>Content panels that take focus when they open and close with Esc.</li>
<li>Carousels you can move with the arrow keys and read with a screen reader.</li>
<li>Touch targets of at least 44 × 44 pixels and respect for reduced motion.</li>
</ul>
<h2>Known limitations</h2>
<p>The 3D globe itself is a visual map. Everything on it is also reachable without it: use <a href="/search" rel="noopener noreferrer">search</a> or the ranked tables of each <a href="/view/hdi" rel="noopener noreferrer">data layer</a>, or the <a href="/countries" rel="noopener noreferrer">list of all countries and regions</a>.</p>
<h2>Tell us about a barrier</h2>
<p>If something does not work for you, write to us: {{contact}}. We reply within 30 days.</p>$html$,
  date '2026-09-30'
);
