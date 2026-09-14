#!/usr/bin/env node
// Rehearse the actual additive migration against existing role decisions.
// Every change rolls back in the owned local replay database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const container = process.argv[2];
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
const migration = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20260911030000_home_member_view_defaults.sql'), 'utf8');
const sql = `BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DELETE FROM public."HomeRolePermission" WHERE permission='home.view'
 AND role_base IN ('admin','manager','member','restricted_member','guest');
INSERT INTO public."HomeRolePermission"(role_base,permission,allowed)
 VALUES ('member','home.view',false),('manager','home.view',false),('admin','home.view',true);
CREATE TEMP TABLE preserved_view_roles AS SELECT to_jsonb(r) row FROM public."HomeRolePermission"r;
${migration}
DO $$ BEGIN
 IF EXISTS(SELECT FROM preserved_view_roles b WHERE NOT EXISTS(
   SELECT FROM public."HomeRolePermission"r WHERE to_jsonb(r)=b.row))
   THEN RAISE EXCEPTION 'Migration rewrote an existing role decision'; END IF;
 IF (SELECT count(*) FROM public."HomeRolePermission" WHERE permission='home.view'
   AND role_base IN ('member','manager') AND NOT allowed)<>2
   THEN RAISE EXCEPTION 'Migration erased an explicit role deny'; END IF;
 IF (SELECT count(*) FROM public."HomeRolePermission" WHERE permission='home.view'
   AND role_base IN ('restricted_member','guest') AND allowed)<>2
   THEN RAISE EXCEPTION 'Migration omitted a missing view default'; END IF;
END $$;
CREATE TEMP TABLE first_view_upgrade AS SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) rows
 FROM public."HomeRolePermission"r;
${migration}
DO $$ BEGIN
 IF (SELECT rows FROM first_view_upgrade) IS DISTINCT FROM
   (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission"r)
   THEN RAISE EXCEPTION 'Repeated migration changed existing role decisions'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: actual member-view migration preserves populated role denies/grants and is idempotent; all probes rolled back';`;
let result;
try {
  result = execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
} catch (_) { throw new Error('Owned member-view upgrade rehearsal failed; transaction was rolled back'); }
process.stdout.write(result);
