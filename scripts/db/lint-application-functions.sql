-- Application component of check-function-lint.cjs; it cannot waive CLI errors alone.
-- Run with psql -X -v ON_ERROR_STOP=1 against an isolated rehearsal database.
-- The transaction always rolls back, including installation of the checker.
-- Unlike the pinned CLI's public-schema scan, distinguish extension members by
-- catalog dependency and check application triggers against each attached table.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, extensions, pg_catalog;
CREATE EXTENSION IF NOT EXISTS plpgsql_check WITH SCHEMA extensions;

CREATE TEMP TABLE adoption_lint_targets ON COMMIT DROP AS
SELECT p.oid AS function_oid,
       p.oid::regprocedure::text AS function_identity,
       t.tgrelid AS relation_oid,
       t.tgname AS trigger_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
LEFT JOIN pg_trigger t ON t.tgfoid = p.oid AND NOT t.tgisinternal
WHERE n.nspname = 'public'
  AND l.lanname = 'plpgsql'
  AND (p.prorettype <> 'trigger'::regtype OR t.tgrelid IS NOT NULL)
  AND NOT EXISTS (
    SELECT FROM pg_depend d
    WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
  );

CREATE TEMP TABLE adoption_lint_issues ON COMMIT DROP AS
SELECT t.function_identity,
       t.relation_oid::regclass::text AS relation_name,
       t.trigger_name,
       c.level, c.sqlstate, c.lineno, c.message, c.detail
FROM adoption_lint_targets t
CROSS JOIN LATERAL plpgsql_check_function_tb(
  t.function_oid::regprocedure,
  relid := COALESCE(t.relation_oid, 0)::regclass,
  fatal_errors := false,
  use_incomment_options := false
  ) c;

SELECT jsonb_build_object(
  'scope', 'public application PL/pgSQL functions and attached triggers',
  'functions', (SELECT count(DISTINCT function_oid) FROM adoption_lint_targets),
  'triggerBindings', (SELECT count(*) FROM adoption_lint_targets WHERE relation_oid IS NOT NULL),
  'unattachedTriggerFunctions', (
    SELECT COALESCE(jsonb_agg(p.oid::regprocedure::text ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
      AND NOT EXISTS (SELECT FROM pg_trigger t WHERE t.tgfoid = p.oid AND NOT t.tgisinternal)
      AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')
  ),
  'errors', (SELECT count(*) FROM adoption_lint_issues WHERE level = 'error'),
  'warnings', (SELECT count(*) FROM adoption_lint_issues WHERE level <> 'error')
) AS summary;
SELECT to_jsonb(i) AS issue FROM adoption_lint_issues i
WHERE level = 'error' ORDER BY function_identity, relation_name, lineno;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM adoption_lint_targets) THEN
    RAISE EXCEPTION 'No application functions found; this is not a verified replay';
  END IF;
  IF EXISTS (SELECT FROM adoption_lint_issues WHERE level = 'error') THEN
    RAISE EXCEPTION 'Application function lint failed; inspect the private diagnostic output';
  END IF;
END $$;
ROLLBACK;
