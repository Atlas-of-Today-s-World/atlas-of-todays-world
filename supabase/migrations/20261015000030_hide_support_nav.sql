-- Header: "Support the Atlas" leaves the main menu — it led to the same page as
-- the "Atlas Patrons" button next to it and the floating "Support the Atlas"
-- button on every page (owner's request). Only hidden, so it can be switched
-- back on in Admin → Navigation; a menu the editors have since changed (other
-- label or address) is left alone.
update public.nav_items
set visible = false
where menu = 'main'
  and label = 'Support the Atlas'
  and href = '/membership'
  and not is_primary
  and visible;
