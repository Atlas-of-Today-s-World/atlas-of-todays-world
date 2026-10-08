-- RLS performance (review 2026-10-07, D-H1; Supabase advisor lint 0003):
-- permission helpers with constant arguments — has_perm('users','v'),
-- can_edit_entry(null), is_admin(), is_active(), is_staff(), auth.uid() — were
-- evaluated for EVERY row a policy checks (each has_perm runs mfa_ok() and a
-- three-table EXISTS). Wrapped in a scalar sub-select, Postgres evaluates them
-- once per query (an initplan). Same meaning, so the authorization tests are
-- unchanged; admin lists of hundreds or thousands of rows get much cheaper.
--
-- Done by rewriting every policy in the public schema as it stands now (also
-- those added by later-merged migrations), not by restating 150 policies.
-- Calls whose arguments depend on the row (can_edit_entry(owner_id),
-- can_read_entry(entry_id), …) are left as they are — they must run per row.
-- supabase/tests guards that no unwrapped call comes back.

create function pg_temp.once_per_query(expression text) returns text
language sql immutable as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        expression,
        -- has_perm('section'::text, 'v'::text), not already inside "SELECT …".
        $re$(?<!SELECT )\m(has_perm\('[^']*'::text, '[^']*'::text\))$re$,
        '(SELECT \1)',
        'g'
      ),
      $re$(?<!SELECT )\m((?:is_admin|is_active|is_staff|mfa_ok)\(\)|can_edit_entry\(NULL::uuid\))$re$,
      '(SELECT \1)',
      'g'
    ),
    $re$(?<!SELECT )\m(auth\.uid\(\))$re$,
    '(SELECT \1)',
    'g'
  )
$$;

do $$
declare
  p record;
  next_using text;
  next_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    next_using := pg_temp.once_per_query(p.qual);
    next_check := pg_temp.once_per_query(p.with_check);
    if next_using is distinct from p.qual or next_check is distinct from p.with_check then
      execute format(
        'alter policy %I on %I.%I %s %s',
        p.policyname,
        p.schemaname,
        p.tablename,
        case when p.qual is not null then 'using (' || next_using || ')' else '' end,
        case when p.with_check is not null then 'with check (' || next_check || ')' else '' end
      );
    end if;
  end loop;
end;
$$;
