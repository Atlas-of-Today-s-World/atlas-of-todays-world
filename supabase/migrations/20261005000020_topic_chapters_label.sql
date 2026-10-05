-- =============================================================================
-- Topic templates: the first half of a topic is called "Chapters" (ADR-023/024)
-- =============================================================================
--
-- The full-width topic page (ADR-023) names the article cards "Chapters"; the
-- template's default heading follows, and a topic that only repeats the
-- default keeps no own label.
-- =============================================================================

alter table public.topic_templates alter column articles_label set default 'Chapters';
update public.topic_templates set articles_label = 'Chapters' where articles_label = 'Articles';
update public.entries set articles_label = null where articles_label in ('Articles', 'Chapters');

create or replace function public.copy_template_tiles(p_entry uuid, p_template uuid, p_remove_missing boolean)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update learn_more_tiles t
     set label = s.label, description = s.description, icon = s.icon, image_url = s.image_url,
         image_credit = s.image_credit, background = s.background, position = s.position
    from topic_template_tiles s
   where s.template_id = p_template and t.entry_id = p_entry and t.slug = s.slug;

  insert into learn_more_tiles (entry_id, slug, label, description, icon, image_url, image_credit, background, position)
  select p_entry, s.slug, s.label, s.description, s.icon, s.image_url, s.image_credit, s.background, s.position
    from topic_template_tiles s
   where s.template_id = p_template
     and not exists (select 1 from learn_more_tiles t where t.entry_id = p_entry and t.slug = s.slug);

  if p_remove_missing then
    delete from learn_more_tiles t
     where t.entry_id = p_entry
       and not exists (select 1 from topic_template_tiles s where s.template_id = p_template and s.slug = t.slug);
  end if;

  update entries e
     set template_id = p_template,
         articles_label = nullif(tp.articles_label, 'Chapters'),
         learn_more_label = nullif(tp.learn_more_label, 'Learn more')
    from topic_templates tp
   where e.id = p_entry and tp.id = p_template;
end;
$$;

create or replace function public.save_topic_as_template(p_entry uuid, p_name text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.can_read_entry(p_entry) then
    raise exception 'Unknown entry.' using errcode = '22023';
  end if;
  insert into topic_templates (name, articles_label, learn_more_label)
  select btrim(p_name), coalesce(e.articles_label, 'Chapters'), coalesce(e.learn_more_label, 'Learn more')
    from entries e where e.id = p_entry
  returning id into v_id;
  insert into topic_template_tiles (template_id, slug, label, description, icon, image_url, image_credit, background, position)
  select v_id, t.slug, t.label, t.description, t.icon, t.image_url, t.image_credit, t.background, t.position
    from learn_more_tiles t where t.entry_id = p_entry;
  return v_id;
end;
$$;
