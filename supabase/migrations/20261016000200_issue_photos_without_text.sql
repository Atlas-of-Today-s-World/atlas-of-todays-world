-- The Russia–Ukraine War header photo was the old site's banner "A Decade of
-- War in Ukraine" with its title baked into the image, so on the issue's page
-- the picture's text crossed the page title (partner's note, 2026-10-16).
-- It gets the war photo from the same set (a soldier in a destroyed Ukrainian
-- town), and Forced Displacement, which had that photo, gets the old site's
-- photo of Syrian and Iraqi refugees landing on Lesbos.
-- Only while each issue still has the photo set by 20261015000070, so a header
-- photo the editors chose in Admin → Global issues is never replaced; re-running
-- changes nothing.
update public.special_regions as s
set hero_url = p.new_url
from (values
  ('russia-ukraine-war',
   'https://atlas-of-todays-world.vercel.app/images/webflow/6c384ef2d08d67ff5de4.webp',
   'https://atlas-of-todays-world.vercel.app/images/webflow/9091605ea7d5d514001f.webp'),
  ('forced-displacement',
   'https://atlas-of-todays-world.vercel.app/images/webflow/9091605ea7d5d514001f.webp',
   'https://atlas-of-todays-world.vercel.app/images/webflow/14b509bb0680f41b04e0.webp')
) as p (slug, old_url, new_url)
where s.slug = p.slug
  and s.kind = 'issue'
  and s.hero_url = p.old_url;
