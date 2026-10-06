-- =============================================================================
-- News in the main menu: off for now, back on by hand or with the first news
-- =============================================================================
--
-- The owner hides News from the menu until real news are written (the seeded
-- ones are samples). Two switches in Roles & permissions:
--   news_menu       – News is in the menu;
--   news_menu_auto  – publishing a news article turns news_menu on by itself.
-- The trigger covers every way an article gets published (approval, the
-- scheduled job, the import).
-- =============================================================================

insert into public.feature_flags (key, enabled, note) values
  ('news_menu', false, 'News in the main menu of the site.'),
  ('news_menu_auto', true, 'Publishing a news article turns News in the menu on by itself.')
on conflict (key) do nothing;

create or replace function public.news_menu_on_publish()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.kind = 'news' and new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and exists (select 1 from feature_flags where key = 'news_menu_auto' and enabled) then
    update feature_flags set enabled = true where key = 'news_menu' and not enabled;
  end if;
  return null;
end;
$$;

revoke execute on function public.news_menu_on_publish() from public, anon, authenticated;

create trigger entries_news_menu after insert or update of status on public.entries
  for each row execute function public.news_menu_on_publish();
