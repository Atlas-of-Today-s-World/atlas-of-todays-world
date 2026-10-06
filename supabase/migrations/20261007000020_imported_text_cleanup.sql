-- Cleanup of text imported from the old site (Webflow), seen in search results
-- and AI answers through the pages' structured data:
--
-- 1. Author bios: paragraphs were glued together without a space
--    ("…since 2002.Martin is a lawyer…") and carry zero-width characters
--    Webflow used as empty-paragraph fillers.
-- 2. One topic photo's address was cut at its parenthesis by the scraper
--    ("…Main%20picture%20(4"): the file is "…Main%20picture%20(4).jpg".
--
-- Idempotent: a second run changes nothing.

update public.authors
set
  bio = regexp_replace(
    regexp_replace(bio, '[​-‍⁠﻿]', '', 'g'),
    '([a-z0-9][.!?])([A-Z][a-z])',
    '\1 \2',
    'g'
  ),
  positionality = regexp_replace(
    regexp_replace(positionality, '[​-‍⁠﻿]', '', 'g'),
    '([a-z0-9][.!?])([A-Z][a-z])',
    '\1 \2',
    'g'
  )
where bio ~ '[​-‍⁠﻿]|[a-z0-9][.!?][A-Z][a-z]'
   or positionality ~ '[​-‍⁠﻿]|[a-z0-9][.!?][A-Z][a-z]';

update public.entries
set cover_url = cover_url || ').jpg'
where cover_url ~ '652ed14fd40a9674790052b1_Main%20picture%20\(4$';

update public.entries
set og_image_url = og_image_url || ').jpg'
where og_image_url ~ '652ed14fd40a9674790052b1_Main%20picture%20\(4$';

update public.entry_chapters
set illustration_url = illustration_url || ').jpg'
where illustration_url ~ '652ed14fd40a9674790052b1_Main%20picture%20\(4$';
