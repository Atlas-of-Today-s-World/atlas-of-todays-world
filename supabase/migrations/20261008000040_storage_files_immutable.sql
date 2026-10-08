-- Uploaded files are immutable, and only editors with rights to every article
-- may remove them (security review 2026-10-07).
--
-- Before: the uploader could UPDATE (overwrite) or DELETE their own files in
-- entry-images / entry-audio straight through the Storage API — e.g. swap the
-- photo or audio of an article after it was approved, bypassing approval, or
-- (once demoted) remove files still used by published articles. The app never
-- needs either: it uploads every file under a new random name (upsert: false,
-- src/lib/upload.ts) and never deletes.

drop policy entry_images_change on storage.objects;
drop policy entry_images_remove on storage.objects;
drop policy entry_audio_change on storage.objects;
drop policy entry_audio_remove on storage.objects;

-- No UPDATE policy at all: a file, once uploaded, stays as it is.

create policy entry_images_remove on storage.objects for delete to authenticated
  using (bucket_id = 'entry-images' and (select public.can_edit_entry(null)));
create policy entry_audio_remove on storage.objects for delete to authenticated
  using (bucket_id = 'entry-audio' and (select public.can_edit_entry(null)));
