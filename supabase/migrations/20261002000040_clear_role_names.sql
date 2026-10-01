-- Srozumitelné názvy výchozích rolí v administraci (anglické UI): z názvu je
-- hned jasné, čeho se role týká (např. „Content approver" → „Article approver").
-- ID rolí se nemění (závisí na nich kód i RLS). Mění se jen řádky, jejichž
-- název / popis je pořád výchozí z 20260929000001_access.sql — co admin mezitím
-- přejmenoval nebo přepsal, zůstává.

update public.roles as r
set name = v.new_name
from (values
  ('admin', 'Admin', 'Administrator'),
  ('permission-admin', 'Permission admin', 'Access manager'),
  ('content-editor', 'Content editor', 'Chief article editor'),
  ('content-approver', 'Content approver', 'Article approver'),
  ('publisher', 'Publisher', 'Article writer'),
  ('data-editor', 'Data editor', 'Map & data editor'),
  ('observer', 'Observer', 'Read-only observer'),
  ('reader', 'Reader', 'Registered reader')
) as v (id, old_name, new_name)
where r.id = v.id
  and r.name = v.old_name;

update public.roles as r
set note = v.new_note
from (values
  ('permission-admin',
   'Accounts and permissions only. Deliberately cannot touch content.',
   'Manages accounts, invitations and roles & permissions. Deliberately cannot touch articles or map content.'),
  ('content-editor',
   'Edits and approves every entry in the Atlas, whoever wrote it.',
   'Edits and approves every article in the Atlas (news and encyclopedia entries), whoever wrote it.'),
  ('content-approver',
   'Approves only the entries it has been assigned — by country or by author.',
   'Approves only the articles assigned to it — by country or by author.'),
  ('publisher',
   'Writes and edits its own entries and sends them for approval.',
   'Writes and edits its own articles and sends them for article approval.'),
  ('data-editor',
   'Indicators, palettes and the look of the map. No say over the text.',
   'Map data layers, country groups, regions & countries and the look of the map. No say over articles.'),
  ('observer',
   'Sees the editorial queue without being able to change anything.',
   'Sees articles in every state without being able to change anything.')
) as v (id, old_note, new_note)
where r.id = v.id
  and r.note = v.old_note;
