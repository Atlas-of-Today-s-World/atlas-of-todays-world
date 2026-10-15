-- Photos of the global issues, taken over from the original site
-- (atlasoftodaysworld.org/global-issues and the "A Decade of War in Ukraine"
-- page), each matched to the closest of its themes, served with the site like
-- the topics photos (public/images/webflow via scripts/webflow/mirror-images.mjs). Only issues still
-- without a photo get one, so a photo the editors set in Admin → Global issues
-- (Header photo) is never replaced; re-running changes nothing.
update public.special_regions as s
set hero_url = p.url
from (values
  ('climate-frontlines',
   'https://atlas-of-todays-world.vercel.app/images/webflow/32efdb4e03098b902971.webp'),
  ('energy-transition',
   'https://atlas-of-todays-world.vercel.app/images/webflow/a7c8121d9d8ce509501d.webp'),
  ('food-insecurity',
   'https://atlas-of-todays-world.vercel.app/images/webflow/f2415d04f30b94f81c6d.webp'),
  ('forced-displacement',
   'https://atlas-of-todays-world.vercel.app/images/webflow/9091605ea7d5d514001f.webp'),
  ('migration-routes',
   'https://atlas-of-todays-world.vercel.app/images/webflow/44d8b5a25e1e15b705da.webp'),
  ('russia-ukraine-war',
   'https://atlas-of-todays-world.vercel.app/images/webflow/6c384ef2d08d67ff5de4.webp')
) as p (slug, url)
where s.slug = p.slug
  and s.kind = 'issue'
  and (s.hero_url is null or btrim(s.hero_url) = '');
