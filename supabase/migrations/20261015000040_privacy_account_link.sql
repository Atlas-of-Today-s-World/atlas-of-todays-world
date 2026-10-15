-- The account page moved from /ucet to /account (English URLs). The old path
-- still redirects, but the privacy policy should link to the new one. Only the
-- exact old link is replaced, so editorial changes elsewhere stay untouched;
-- the revision trigger keeps the previous text.

update public.site_pages
set body_html = replace(body_html, 'href="/ucet"', 'href="/account"')
where body_html like '%href="/ucet"%';
