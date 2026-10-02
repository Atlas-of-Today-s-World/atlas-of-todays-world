-- =============================================================================
-- Public author profiles (G8 SEO & GEO)
-- =============================================================================
--
-- Bylines of encyclopedia entries and news link to a public profile page
-- /authors/<slug> (name, bio, positionality, articles) with Person structured
-- data — the "who wrote this and why should I trust them" signal search and
-- answer engines look for (E-E-A-T).
--
-- 1. `authors.slug`: stable URL segment, generated from the name on insert
--    (diacritics folded, unique with a numeric suffix). Renaming an author
--    keeps the slug, so old links keep working; clearing it regenerates it.
-- 2. Anonymous readers may read the slug (column privilege, as the other
--    public author columns — DB-08).
-- Expand-only: the running app ignores the new column.
-- =============================================================================

-- Text → URL slug ("Jiří Novák" → "jiri-novak"). Without `unaccent` (not
-- installed): the common Latin diacritics are folded by `translate`.
create or replace function public.slugify_text(p_text text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select trim(both '-' from regexp_replace(lower(translate(coalesce(p_text, ''),
    'áàâäãåąčćçďđéèêëěęíìîïľĺłňńñóòôöõőøřŕšśşťţúùûüůűýÿžźżÁÀÂÄÃÅĄČĆÇĎĐÉÈÊËĚĘÍÌÎÏĽĹŁŇŃÑÓÒÔÖÕŐØŘŔŠŚŞŤŢÚÙÛÜŮŰÝŸŽŹŻ',
    'aaaaaaacccddeeeeeeiiiilllnnnooooooorrsssttuuuuuuyyzzzaaaaaaacccddeeeeeeiiiilllnnnooooooorrsssttuuuuuuyyzzz')),
    '[^a-z0-9]+', '-', 'g'))
$$;

revoke execute on function public.slugify_text(text) from public, anon;
grant execute on function public.slugify_text(text) to authenticated;

alter table public.authors
  add column slug text check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120);

-- Fills an empty slug from the name, unique among authors (-2, -3, …).
create or replace function public.authors_set_slug()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;
  base := coalesce(nullif(trim(both '-' from left(slugify_text(new.name), 100)), ''), 'author');
  candidate := base;
  while exists (select 1 from authors a where a.slug = candidate and a.id <> new.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end
$$;

revoke execute on function public.authors_set_slug() from public, anon, authenticated;

create trigger authors_slug before insert or update of slug on public.authors
  for each row execute function public.authors_set_slug();

-- Existing authors, oldest first (so the first "Jan Novák" keeps the bare slug).
do $$
declare
  author record;
begin
  for author in select id from public.authors order by created_at, id loop
    update public.authors set slug = null where id = author.id;
  end loop;
end
$$;

alter table public.authors alter column slug set not null;
create unique index authors_slug_key on public.authors (slug);

grant select (slug) on public.authors to anon;
