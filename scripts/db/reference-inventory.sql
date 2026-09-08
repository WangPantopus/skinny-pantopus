-- Read-only fingerprints of the reviewed static reference tables, not user data.
-- Feature flags are operational state and deliberately excluded from hashes.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL timezone = 'UTC';
SELECT jsonb_object_agg(table_name, jsonb_build_object('rows', row_count, 'sha256', digest))
FROM (
  SELECT 'HomeRolePermission' AS table_name, count(*) AS row_count,
    encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(r)::text, E'\n' ORDER BY to_jsonb(r)::text COLLATE "C"), ''), 'UTF8')), 'hex') AS digest
  FROM public."HomeRolePermission" r
  UNION ALL SELECT 'PostCategoryTTL', count(*),
    encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(r)::text, E'\n' ORDER BY to_jsonb(r)::text COLLATE "C"), ''), 'UTF8')), 'hex')
  FROM public."PostCategoryTTL" r
  UNION ALL SELECT 'AddressCalendarRule', count(*),
    encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(r)::text, E'\n' ORDER BY to_jsonb(r)::text COLLATE "C"), ''), 'UTF8')), 'hex')
  FROM public."AddressCalendarRule" r
  UNION ALL SELECT 'CountyRadonZone', count(*),
    encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(r)::text, E'\n' ORDER BY to_jsonb(r)::text COLLATE "C"), ''), 'UTF8')), 'hex')
  FROM public."CountyRadonZone" r
  UNION ALL SELECT 'HudFmr', count(*),
    encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(r)::text, E'\n' ORDER BY to_jsonb(r)::text COLLATE "C"), ''), 'UTF8')), 'hex')
  FROM public."HudFmr" r
) reference_tables;
ROLLBACK;
