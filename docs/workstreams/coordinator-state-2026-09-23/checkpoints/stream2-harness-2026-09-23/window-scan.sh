#!/bin/zsh
# Counts rows created at/after $1 in every public/auth table with a created_at or issued_at column.
RT=/private/tmp/pantopus-stream2-r06-runtime
$RT/psql.sh -At <<SQL
select format('select %L || ''|'' || count(*) from %I.%I where %I >= %L having count(*) > 0',
  n.nspname || '.' || c.relname || '.' || a.attname, n.nspname, c.relname, a.attname, '$1')
from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid
where c.relkind = 'r' and n.nspname in ('public','auth') and a.attname in ('created_at','issued_at') and not a.attisdropped
  and a.atttypid in ('timestamptz'::regtype, 'timestamp'::regtype)
order by 1
\gexec
SQL
