-- Read-only PUBLIC application catalog inventory for baseline reconciliation.
-- This is not a complete managed-schema, reference-data or external-file audit.
-- Defaults, policies and definitions may contain private information: redirect
-- psql -X -Atq -v ON_ERROR_STOP=1 output to a private file, never a CI artifact.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog;

WITH relations AS (
  SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
    AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = 'pg_class'::regclass
      AND d.objid = c.oid AND d.deptype = 'e')
), routines AS (
  SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
    AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass
      AND d.objid = p.oid AND d.deptype = 'e')
), privileges AS (
  SELECT 'relation' AS kind, r.oid, a.* FROM relations r
  CROSS JOIN LATERAL aclexplode(COALESCE(r.relacl, acldefault(
    CASE WHEN r.relkind = 'S' THEN 'S'::"char" ELSE 'r'::"char" END, r.relowner))) a
  UNION ALL
  SELECT 'routine', p.oid, a.* FROM routines p
  CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
), grants AS (
  SELECT kind, oid, jsonb_agg(jsonb_build_object(
    'grantor', pg_get_userbyid(grantor),
    'grantee', CASE WHEN grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee)::text END,
    'privilege', privilege_type, 'grantable', is_grantable
  ) ORDER BY pg_get_userbyid(grantor), grantee = 0, pg_get_userbyid(grantee), privilege_type) AS acl
  FROM privileges GROUP BY kind, oid
)
SELECT jsonb_build_object(
  'formatVersion', 1,
  'scope', 'public application objects; extension-owned objects excluded',
  'tables', (SELECT COALESCE(jsonb_object_agg(r.relname, jsonb_build_object(
    'owner', pg_get_userbyid(r.relowner), 'kind', r.relkind,
    'rls', r.relrowsecurity, 'forceRls', r.relforcerowsecurity,
    'options', r.reloptions, 'replicaIdentity', r.relreplident,
    'acl', (SELECT acl FROM grants g WHERE g.kind = 'relation' AND g.oid = r.oid),
    'effectiveAccess', (SELECT jsonb_object_agg(role_name, jsonb_build_object(
      'select', has_table_privilege(role_name, r.oid, 'SELECT'),
      'insert', has_table_privilege(role_name, r.oid, 'INSERT'),
      'update', has_table_privilege(role_name, r.oid, 'UPDATE'),
      'delete', has_table_privilege(role_name, r.oid, 'DELETE')
    )) FROM (VALUES ('anon'), ('authenticated'), ('service_role')) roles(role_name)),
    'columnOrder', (SELECT jsonb_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a
      WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped),
    'columns', (SELECT jsonb_object_agg(a.attname, jsonb_build_object(
      'type', format_type(a.atttypid, a.atttypmod), 'notNull', a.attnotnull,
      'default', pg_get_expr(d.adbin, d.adrelid), 'identity', a.attidentity,
      'generated', a.attgenerated, 'collation', a.attcollation::regcollation::text,
      'acl', (SELECT jsonb_agg(jsonb_build_object(
        'grantor', pg_get_userbyid(x.grantor),
        'grantee', CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee)::text END,
        'privilege', x.privilege_type, 'grantable', x.is_grantable
      ) ORDER BY pg_get_userbyid(x.grantor), x.grantee = 0, pg_get_userbyid(x.grantee), x.privilege_type)
        FROM aclexplode(a.attacl) x)
    )) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped),
    'constraints', (SELECT COALESCE(jsonb_object_agg(c.conname, jsonb_build_object(
      'definition', pg_get_constraintdef(c.oid), 'validated', c.convalidated,
      'deferrable', c.condeferrable, 'initiallyDeferred', c.condeferred
    )), '{}'::jsonb) FROM pg_constraint c WHERE c.conrelid = r.oid)
  )), '{}'::jsonb) FROM relations r WHERE r.relkind IN ('r', 'p')),
  'indexes', (SELECT COALESCE(jsonb_object_agg(i.relname, jsonb_build_object(
    'table', r.relname, 'definition', pg_get_indexdef(i.oid),
    'valid', x.indisvalid, 'ready', x.indisready, 'replicaIdentity', x.indisreplident
  )), '{}'::jsonb) FROM pg_index x JOIN relations r ON r.oid = x.indrelid
    JOIN pg_class i ON i.oid = x.indexrelid),
  'routines', (SELECT COALESCE(jsonb_object_agg(
    format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)), jsonb_build_object(
      'definitionHash', encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex'),
      'owner', pg_get_userbyid(p.proowner), 'securityDefiner', p.prosecdef,
      'effectiveExecute', (SELECT jsonb_object_agg(role_name, has_function_privilege(role_name, p.oid, 'EXECUTE'))
        FROM (VALUES ('anon'), ('authenticated'), ('service_role')) roles(role_name)),
      'acl', (SELECT acl FROM grants g WHERE g.kind = 'routine' AND g.oid = p.oid)
    )), '{}'::jsonb) FROM routines p),
  'triggers', (SELECT COALESCE(jsonb_object_agg(format('%I.%I', r.relname, t.tgname),
    jsonb_build_object('definition', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled)
  ), '{}'::jsonb) FROM pg_trigger t JOIN relations r ON r.oid = t.tgrelid WHERE NOT t.tgisinternal),
  'policies', (SELECT COALESCE(jsonb_object_agg(format('%I.%I', tablename, policyname),
    jsonb_build_object('roles', (SELECT jsonb_agg(role_name ORDER BY role_name) FROM unnest(roles) role_name),
      'command', cmd, 'permissive', permissive, 'qual', qual, 'check', with_check)
  ), '{}'::jsonb) FROM pg_policies WHERE schemaname = 'public'),
  'types', (SELECT COALESCE(jsonb_object_agg(t.typname, jsonb_build_object(
    'kind', t.typtype, 'owner', pg_get_userbyid(t.typowner),
    'labels', (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid),
    'baseType', format_type(t.typbasetype, t.typtypmod), 'notNull', t.typnotnull,
    'default', t.typdefault, 'acl', t.typacl::text,
    'constraints', (SELECT COALESCE(jsonb_object_agg(c.conname, pg_get_constraintdef(c.oid)), '{}'::jsonb)
      FROM pg_constraint c WHERE c.contypid = t.oid)
  )), '{}'::jsonb) FROM pg_type t WHERE t.typnamespace = 'public'::regnamespace
    AND t.typtype IN ('e', 'd') AND NOT EXISTS (SELECT FROM pg_depend d
      WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e')),
  'views', (SELECT COALESCE(jsonb_object_agg(r.relname, jsonb_build_object(
    'kind', r.relkind, 'definition', pg_get_viewdef(r.oid), 'owner', pg_get_userbyid(r.relowner),
    'options', r.reloptions, 'acl', (SELECT acl FROM grants g WHERE g.kind = 'relation' AND g.oid = r.oid)
  )), '{}'::jsonb) FROM relations r WHERE r.relkind IN ('v', 'm')),
  'sequences', (SELECT COALESCE(jsonb_object_agg(r.relname, jsonb_build_object(
    'owner', pg_get_userbyid(r.relowner), 'type', format_type(s.seqtypid, NULL),
    'start', s.seqstart, 'increment', s.seqincrement, 'min', s.seqmin, 'max', s.seqmax,
    'cache', s.seqcache, 'cycle', s.seqcycle,
    'acl', (SELECT acl FROM grants g WHERE g.kind = 'relation' AND g.oid = r.oid)
  )), '{}'::jsonb) FROM relations r JOIN pg_sequence s ON s.seqrelid = r.oid),
  'defaultPrivileges', (SELECT COALESCE(jsonb_object_agg(
    format('%I.%s.%s', pg_get_userbyid(d.defaclrole),
      CASE WHEN d.defaclnamespace = 0 THEN '*' ELSE d.defaclnamespace::regnamespace::text END, d.defaclobjtype),
    (SELECT jsonb_agg(jsonb_build_object(
      'grantor', pg_get_userbyid(x.grantor),
      'grantee', CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee)::text END,
      'privilege', x.privilege_type, 'grantable', x.is_grantable
    ) ORDER BY pg_get_userbyid(x.grantor), x.grantee = 0, pg_get_userbyid(x.grantee), x.privilege_type)
     FROM aclexplode(d.defaclacl) x)
  ), '{}'::jsonb) FROM pg_default_acl d WHERE d.defaclnamespace IN (0, 'public'::regnamespace)),
  'schemas', (SELECT jsonb_object_agg(n.nspname, jsonb_build_object(
    'owner', pg_get_userbyid(n.nspowner),
    'acl', (SELECT jsonb_agg(jsonb_build_object(
      'grantor', pg_get_userbyid(x.grantor),
      'grantee', CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee)::text END,
      'privilege', x.privilege_type, 'grantable', x.is_grantable
    ) ORDER BY pg_get_userbyid(x.grantor), x.grantee = 0, pg_get_userbyid(x.grantee), x.privilege_type)
      FROM aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) x),
    'effectiveAccess', (SELECT jsonb_object_agg(role_name, jsonb_build_object(
      'usage', has_schema_privilege(role_name, n.oid, 'USAGE'),
      'create', has_schema_privilege(role_name, n.oid, 'CREATE')
    )) FROM (VALUES ('anon'), ('authenticated'), ('service_role')) roles(role_name))
  )) FROM pg_namespace n WHERE n.nspname = 'public'),
  'extensions', (SELECT jsonb_object_agg(e.extname, jsonb_build_object(
    'version', e.extversion, 'schema', e.extnamespace::regnamespace::text
  )) FROM pg_extension e)
);
ROLLBACK;
