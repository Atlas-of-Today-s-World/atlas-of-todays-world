-- Two gaps the audit against the old site found (2026-10-22):
--
-- 1. An author's selected works: the old site lists them under the bio (13
--    of the 17 Global Issues topics). authors.works_html holds them as
--    sanitized rich text (a list, links); readable like the bio, written by
--    whoever may write the bio.
-- 2. Key points: one topic has 6 on the old site; entries and subtopics now
--    take up to 6 (still 300 characters each).
--
-- Backward compatible: a new column with a default, wider checks, and the
-- functions return one field more.

alter table public.authors
  add column works_html text not null default ''
    constraint authors_works_html_length check (char_length(works_html) <= 20000);

-- Column grants as for bio (20260930000001, 20261008000030, 20261013000330).
grant select (works_html) on public.authors to anon, authenticated;
grant insert (works_html), update (works_html) on public.authors to authenticated;

alter table public.entries drop constraint entries_summary_points_short;
alter table public.entries
  add constraint entries_summary_points_short check (public.short_items(summary_points, 6, 300));
alter table public.entry_chapters drop constraint entry_chapters_summary_short;
alter table public.entry_chapters
  add constraint entry_chapters_summary_short check (public.short_items(summary_points, 6, 300));

-- The preview link shows the works too (body as in 20261022000100).
create or replace function public.entry_preview_parts(p_token text)
returns table (
  kind text, summary_points text[], author jsonb, chapters jsonb, resources jsonb,
  tiles jsonb, notes jsonb, articles_label text, learn_more_label text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select e.kind, e.summary_points,
         (select jsonb_build_object('name', a.name, 'photo_url', a.photo_url, 'bio', a.bio,
                                    'positionality', a.positionality, 'works_html', a.works_html)
            from authors a where a.id = e.author_id),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'position', c.position, 'title', c.title, 'overview', c.overview,
                     'summary_points', c.summary_points,
                     'body_html', c.body_html, 'illustration_url', c.illustration_url,
                     'illustration_credit', c.illustration_credit, 'audio_url', c.audio_url,
                     'tile_background', c.tile_background)
                     order by c.position)
                     from entry_chapters c where c.entry_id = e.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'position', r.position, 'kind', r.kind, 'tile_id', r.tile_id, 'title', r.title,
                     'source', r.source, 'description', r.description, 'url', r.url,
                     'image_url', r.image_url)
                     order by r.position)
                     from resources r where r.entry_id = e.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', t.id, 'slug', t.slug, 'label', t.label, 'description', t.description,
                     'icon', t.icon, 'image_url', t.image_url, 'image_credit', t.image_credit,
                     'background', t.background, 'position', t.position)
                     order by t.position)
                     from learn_more_tiles t where t.entry_id = e.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object('tile_id', n.tile_id, 'body_html', n.body_html))
                     from entry_tile_notes n where n.entry_id = e.id), '[]'),
         e.articles_label, e.learn_more_label
  from preview_links l
  join entries e on e.id = l.entry_id
  where p_token ~ '^[0-9a-f]{64}$'
    and l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and l.expires_at > now();
$$;

revoke execute on function public.entry_preview_parts(text) from public;
grant execute on function public.entry_preview_parts(text) to anon, authenticated;

-- The personal data export includes them (body as in 20261013000360).
create or replace function public.my_personal_data()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  my_email text := public.my_confirmed_email();
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'authorProfile', (
      select jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name,
        'photoUrl', a.photo_url, 'bio', a.bio, 'positionality', a.positionality,
        'worksHtml', a.works_html, 'createdAt', a.created_at)
      from authors a where a.profile_id = me
      order by a.created_at limit 1),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'roleId', i.role_id,
        'approvalGlobal', i.approval_global, 'approverCountries', i.approver_countries,
        'approverAuthors', i.approver_authors, 'note', i.note, 'createdAt', i.created_at,
        'expiresAt', i.expires_at, 'acceptedAt', i.accepted_at, 'revokedAt', i.revoked_at)
        order by i.created_at, i.id)
      from invitations i
      where (my_email is not null and i.email = my_email) or i.accepted_by = me), '[]'::jsonb),
    'volunteerApplications', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'email', v.email,
        'topics', v.topics, 'message', v.message, 'status', v.status,
        'createdAt', v.created_at, 'updatedAt', v.updated_at)
        order by v.created_at)
      from volunteer_applications v
      where my_email is not null and lower(v.email) = my_email), '[]'::jsonb),
    'entryRevisions', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'entryId', r.entry_id,
        'savedAt', r.saved_at, 'published', r.published)
        order by r.saved_at, r.id)
      from entry_revisions r where r.saved_by = me), '[]'::jsonb),
    'sitePageRevisions', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'slug', r.page_slug, 'savedAt', r.saved_at)
        order by r.saved_at, r.id)
      from site_page_revisions r where r.saved_by = me), '[]'::jsonb),
    -- What the caller did, not what the rows held: column names only.
    'auditActions', coalesce((
      select jsonb_agg(jsonb_build_object(
          'action', l.action,
          'table', split_part(l.action, '.', 1),
          'targetId', case when strpos(coalesce(l.target, ''), '@') > 0 then null else l.target end,
          'at', l.at,
          'columns', (
            select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb)
            from (
              select jsonb_object_keys(case when jsonb_typeof(l.detail -> 'old') = 'object'
                                            then l.detail -> 'old' else '{}'::jsonb end)
              union
              select jsonb_object_keys(case when jsonb_typeof(l.detail -> 'new') = 'object'
                                            then l.detail -> 'new' else '{}'::jsonb end)
              union
              select jsonb_array_elements_text(case when jsonb_typeof(l.detail -> 'changed') = 'array'
                                                    then l.detail -> 'changed' else '[]'::jsonb end)
            ) as c(name)))
        order by l.at, l.id)
      from audit_log l where l.actor = me), '[]'::jsonb));
end;
$$;

revoke execute on function public.my_personal_data() from public, anon;
grant execute on function public.my_personal_data() to authenticated;
