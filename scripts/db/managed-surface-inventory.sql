-- Read-only inventory for comparing application hooks with a fresh platform.
-- This does not classify every managed object as application-owned. Compare to
-- a fresh stack before selecting anything for a baseline. Keep output private:
-- policy expressions, hook definitions and bucket names can be sensitive.
-- If cronJobTable is present, scheduled commands need a separate private audit.
-- External storage object bytes and hosted Auth configuration are not covered.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog;

SELECT jsonb_build_object(
  'formatVersion', 1,
  'scope', 'auth/storage hooks, policies, routine signatures, buckets and platform inventory',
  'schemas', (SELECT jsonb_agg(nspname ORDER BY nspname) FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'),
  'triggers', (SELECT COALESCE(jsonb_object_agg(
    format('%I.%I.%I', n.nspname, c.relname, t.tgname), jsonb_build_object(
      'definition', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled,
      'function', t.tgfoid::regprocedure::text,
      'functionOwner', pg_get_userbyid(p.proowner),
      'functionHash', encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex')
    )), '{}'::jsonb)
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal AND n.nspname IN ('auth', 'storage')),
  'policies', (SELECT COALESCE(jsonb_object_agg(
    format('%I.%I.%I', schemaname, tablename, policyname), jsonb_build_object(
      'roles', (SELECT jsonb_agg(r ORDER BY r) FROM unnest(roles) r),
      'command', cmd, 'permissive', permissive, 'qual', qual, 'check', with_check
    )), '{}'::jsonb) FROM pg_policies WHERE schemaname IN ('auth', 'storage')),
  'routines', (SELECT COALESCE(jsonb_object_agg(
    format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
    jsonb_build_object('owner', pg_get_userbyid(p.proowner), 'securityDefiner', p.prosecdef,
      'definitionHash', encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex'),
      'acl', (SELECT jsonb_agg(jsonb_build_object(
        'grantor', pg_get_userbyid(a.grantor),
        'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee)::text END,
        'privilege', a.privilege_type, 'grantable', a.is_grantable
      ) ORDER BY pg_get_userbyid(a.grantor), a.grantee = 0,
        pg_get_userbyid(a.grantee), a.privilege_type)
        FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a)
    )), '{}'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('auth', 'storage') AND p.prokind IN ('f', 'p')),
  'extensions', (SELECT jsonb_object_agg(extname, jsonb_build_object(
    'schema', extnamespace::regnamespace::text, 'version', extversion,
    'owner', pg_get_userbyid(extowner)
  )) FROM pg_extension),
  'buckets', (SELECT COALESCE(jsonb_object_agg(id, jsonb_build_object(
    'name', name, 'public', public, 'fileSizeLimit', file_size_limit,
    'allowedMimeTypes', allowed_mime_types
  )), '{}'::jsonb) FROM storage.buckets),
  'cronJobTable', to_regclass('cron.job')::text,
  'publications', (SELECT COALESCE(jsonb_object_agg(pubname, jsonb_build_object(
    'allTables', puballtables, 'insert', pubinsert, 'update', pubupdate,
    'delete', pubdelete, 'truncate', pubtruncate, 'viaPartitionRoot', pubviaroot,
    'tables', (SELECT COALESCE(jsonb_agg(format('%I.%I', t.schemaname, t.tablename)
      ORDER BY t.schemaname, t.tablename), '[]'::jsonb)
      FROM pg_publication_tables t WHERE t.pubname = p.pubname)
  )), '{}'::jsonb) FROM pg_publication p)
);
ROLLBACK;
