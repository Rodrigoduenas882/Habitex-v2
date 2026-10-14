-- Generic, reusable foreign-key integrity checker for a restored Habitex
-- database. Walks every FK constraint in pg_constraint (not a hardcoded
-- table list, so it stays correct as the schema grows) and reports any
-- child row whose FK column(s) don't match a parent row.
--
-- History: first written ad-hoc during INC-BKP-002's restore validation,
-- where an early version (pairing composite-key columns via a correlated
-- subquery over `unnest()` with no explicit ordering) produced 3 false
-- positives - unnest() does not guarantee positional correspondence
-- between conkey/confkey for composite foreign keys without `WITH
-- ORDINALITY ... ORDER BY ordinality`. That bug is fixed below (every
-- unnest() call here uses WITH ORDINALITY). Saved as a real, versioned
-- script for INC-BKP-005 instead of staying a one-off typed into psql,
-- since a restore runbook should not depend on remembering a shell
-- history entry.
--
-- Usage: docker exec -i <container> psql -U postgres -v ON_ERROR_STOP=1 \
--          < scripts/backup/verify-referential-integrity.sql

do $$
declare
  r record;
  orphan_count bigint;
  total_checked int := 0;
  total_bad int := 0;
begin
  for r in
    select
      con.conname,
      con.conrelid::regclass::text as child_table,
      con.confrelid::regclass::text as parent_table,
      (select string_agg(quote_ident(a.attname), ',' order by k.ord)
         from unnest(con.conkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as child_cols,
      (select string_agg(quote_ident(a.attname), ',' order by k.ord)
         from unnest(con.confkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as parent_cols
    from pg_constraint con
    where con.contype = 'f'
  loop
    total_checked := total_checked + 1;
    execute format(
      'select count(*) from %s c where (%s) is not null and not exists (select 1 from %s p where (%s) = (%s))',
      r.child_table, r.child_cols, r.parent_table,
      (select string_agg('p.'||x, ',') from unnest(string_to_array(r.parent_cols, ',')) x),
      (select string_agg('c.'||x, ',') from unnest(string_to_array(r.child_cols, ',')) x)
    ) into orphan_count;
    if orphan_count > 0 then
      total_bad := total_bad + 1;
      raise notice 'ORPHANS FOUND: % (% -> %) childcols=% parentcols=% : % orphan rows', r.conname, r.child_table, r.parent_table, r.child_cols, r.parent_cols, orphan_count;
    end if;
  end loop;
  raise notice 'FK constraints checked: %, constraints with orphans: %', total_checked, total_bad;
end
$$;
