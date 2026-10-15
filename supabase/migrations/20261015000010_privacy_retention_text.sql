-- Privacy policy: how long data is kept, how people without an account reach
-- their volunteer application, and Cloudflare (Turnstile) among the processors.
--
-- Content edit requested by the owner. Each insertion is applied only when its
-- anchor is still in the page and the new text isn't there yet, so a page the
-- editors have since rewritten is left alone and re-running changes nothing.
-- The revision trigger keeps the previous text in site_page_revisions.

update public.site_pages
set body_html = replace(
      body_html,
      'we delete it on request or when it is no longer needed.</p>',
      'we delete it on request or when it is no longer needed.</p>'
        || E'\n<p>If you applied without an account, you can ask us at any time for a copy of your application or for its deletion by writing to {{contact}}. We reply within 30 days.</p>'
    )
where slug = 'privacy'
  and body_html like '%we delete it on request or when it is no longer needed.</p>%'
  and body_html not like '%If you applied without an account%';

update public.site_pages
set body_html = replace(
      body_html,
      '<li>Mailchimp — newsletter, only if you subscribe.</li>',
      '<li>Mailchimp — newsletter, only if you subscribe.</li>'
        || E'\n<li>Cloudflare — bot protection (Turnstile) on sign-in and on the newsletter and volunteer forms.</li>'
    )
where slug = 'privacy'
  and body_html like '%<li>Mailchimp — newsletter, only if you subscribe.</li>%'
  and body_html not like '%Cloudflare%';

update public.site_pages
set body_html = replace(
      body_html,
      '<h2>Your rights</h2>',
      '<h2>How long we keep data</h2>'
        || E'\n<ul>'
        || E'\n<li>Your account and what you saved in it: until you delete the account. Deleting it removes your profile, membership, invitations, volunteer applications and the files you uploaded that no article uses.</li>'
        || E'\n<li>Security log: records of changes made in the administration are kept for 12 months and contain no e-mail addresses or message texts.</li>'
        || E'\n<li>Abuse protection: short-lived counters of hashed IP addresses and e-mails that expire within hours.</li>'
        || E'\n<li>Hosting logs: our providers (Vercel, Supabase, Cloudflare) keep technical access logs for a limited time under their own policies, typically days to a few weeks.</li>'
        || E'\n<li>Newsletter: until you unsubscribe; Mailchimp keeps the subscription history.</li>'
        || E'\n</ul>'
        || E'\n<h2>Your rights</h2>'
    )
where slug = 'privacy'
  and body_html like '%<h2>Your rights</h2>%'
  and body_html not like '%How long we keep data%';

update public.site_pages
set last_reviewed = date '2026-10-15'
where slug = 'privacy'
  and body_html like '%How long we keep data%'
  and (last_reviewed is null or last_reviewed < date '2026-10-15');
