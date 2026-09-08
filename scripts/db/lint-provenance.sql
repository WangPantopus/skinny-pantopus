-- Private, read-only provenance for narrowly reviewed extension diagnostics.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog;
SELECT jsonb_build_object('formatVersion', 1, 'routines', (
  SELECT jsonb_object_agg(p.oid::regprocedure::text, jsonb_build_object(
    'function', format('%s.%s', n.nspname, p.proname),
    'extension', e.extname, 'extensionVersion', e.extversion,
    'definitionHash', encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex')
  ))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN pg_depend d ON d.classid = 'pg_proc'::regclass AND d.objid = p.oid
    AND d.refclassid = 'pg_extension'::regclass AND d.deptype = 'e'
  LEFT JOIN pg_extension e ON e.oid = d.refobjid
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
));
ROLLBACK;
