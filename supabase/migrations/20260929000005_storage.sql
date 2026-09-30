-- =============================================================================
-- Úložiště obrázků (Supabase Storage)
-- =============================================================================
--
-- Jeden veřejný bucket pro obrázky v článcích a titulní fotky. Strop 3 MB a jen
-- obrazové formáty přímo v bucketu — Storage je vynutí dřív, než soubor
-- dorazí. SVG schválně ne: může nést skript.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-images', 'entry-images', true, 3145728,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nahrát smí, kdo smí psát články; mazat a přepsat jen vlastník souboru nebo
-- redakce s právem upravovat cizí články.
create policy entry_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-images' and public.has_perm('news', 'c'));

create policy entry_images_change on storage.objects for update to authenticated
  using (bucket_id = 'entry-images' and (owner = auth.uid() or public.can_edit_entry(null)))
  with check (bucket_id = 'entry-images');

create policy entry_images_remove on storage.objects for delete to authenticated
  using (bucket_id = 'entry-images' and (owner = auth.uid() or public.can_edit_entry(null)));
