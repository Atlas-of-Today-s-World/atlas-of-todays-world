# Backend reference

Templates and longer detail for `atlas-backend`. Rules are in [SKILL.md](SKILL.md); this file
only shows how they look in practice.

## Migration template

Pick the next free version (`ls supabase/migrations | tail -3`) and name the file
`YYYYMMDDNNNNNN_snake_name.sql`. Real examples to copy from:
`20261015000100_visuals.sql` (new table with owners, grants, policies, definer helpers),
`20261015000060_timelines.sql` (expand an existing table, re-runnable),
`20261013000360_gdpr_retention.sql` (definer RPC scoped to `auth.uid()`).

```sql
-- =============================================================================
-- <What this adds> (<who asked>, <date>)
-- =============================================================================
-- Why: ...
-- Phase: expand (the running app ignores the new column / function).
-- Default privileges are revoked (20261013000210): every grant is explicit.
-- Tests: supabase/tests/<name>.test.mjs.
-- =============================================================================

create table public.things (
  id          uuid primary key default gen_random_uuid(),
  region_slug text not null references public.regions (slug) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),  -- = Zod text(200)
  source_url  text check (source_url ~ '^https://' and char_length(source_url) <= 1000),
  updated_at  timestamptz not null default now()
);
create index things_region_slug_idx on public.things (region_slug);   -- every FK
create trigger things_stamp before update on public.things
  for each row execute function public.stamp_row();

alter table public.things enable row level security;
create policy things_read on public.things for select to anon, authenticated using (true);
create policy things_add on public.things for insert to authenticated
  with check ((select public.has_perm('regions', 'c')));
create policy things_edit on public.things for update to authenticated
  using ((select public.has_perm('regions', 'e')))
  with check ((select public.has_perm('regions', 'e')));
create policy things_remove on public.things for delete to authenticated
  using ((select public.has_perm('regions', 'd')));

revoke all on public.things from anon, authenticated;
grant select (id, region_slug, title, source_url, updated_at) on public.things to anon;
grant select, delete on public.things to authenticated;
grant insert (region_slug, title, source_url) on public.things to authenticated;
grant update (title, source_url) on public.things to authenticated;
```

Adapt the policy predicates to the real permission helpers of the section (look at the closest
existing table). Check that `has_perm` and similar helpers are called with constant arguments
inside `(select ...)`, and that row-dependent helpers stay bare.

### Definer RPC skeleton

```sql
create or replace function public.do_thing(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_perm('regions', 'e') then
    raise exception 'You don''t have permission to change this.' using errcode = '42501';
  end if;
  -- validate arguments here (length, enum, ownership)
  ...
end;
$$;
revoke execute on function public.do_thing(uuid) from public, anon;
grant execute on function public.do_thing(uuid) to authenticated;
```

Then add `do_thing: ["authenticated"]` to `APP_RPCS` in
`supabase/tests/search-helpers-hardening.test.mjs`.

## Expand → migrate → contract

| Step | PR | What |
|---|---|---|
| Expand | 1 | Add the new column / table / function. Old code keeps working. |
| Migrate | 1 or 2 | App writes the new shape (and the old one if still read), backfill in a migration. |
| Contract | later | Drop the old column / function once no deployed code reads it. |

`deploy.yml` applies migrations, then deploys the app. Between the two steps production runs
the **old** app against the **new** schema. Anything the old app needs must still exist.

## DB test template

Start from the nearest file in `supabase/tests/` (for example `visuals.test.mjs`): it loads every
migration into PGlite, adds fixed uuids per role, and defines `as(user, fn)` and `refused()`.

```js
test("data editor can't remove a thing without 'd'", async () => {
  await refused(
    as(id.dataEditor, () => q("delete from things where id = $1 returning id", [thingId])),
  );
});

test("anon reads only the granted columns", async () => {
  await refused(as(null, () => q("select updated_at, secret_note from things")), /permission/);
});
```

- Remember: an RLS-filtered `update`/`delete` returns zero rows, not an error. Assert on the
  returned rows (`returning id`) for those cases.
- Add the file to the `test:db` script in `package.json`.
- Run `npm run test:db` locally; the nightly
  [Full tests](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/full-tests.yml)
  run it again.

## Permission sections

A new admin section needs, in one PR: the DB `CHECK` on `role_permissions.section`, the
`my_permissions()` function, `src/config/sections.ts` and `src/features/roles/labels.ts`, plus a
case in `supabase/tests/site-section.test.mjs` style. See `atlas-security` for the model.

## Useful Supabase pages

| What | Production | atlas-dev |
|---|---|---|
| Project home | [open](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof) | [open](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh) |
| Applied migrations | [open](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/database/migrations) | [open](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh/database/migrations) |
| Security advisor | [open](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/advisors/security) | [open](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh/advisors/security) |
| Performance advisor | [open](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/advisors/performance) | [open](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh/advisors/performance) |
| SQL editor (read-only checks in prod) | [open](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/sql/new) | [open](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh/sql/new) |
| Logs | [open](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/logs/explorer) | [open](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh/logs/explorer) |

Never change schema through the production SQL editor; every change is a migration.
