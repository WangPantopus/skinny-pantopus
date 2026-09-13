#!/usr/bin/env node
// Baseline ONLY: reproduce the old /claim route before replacing it.
// Requires an exclusive, explicitly coordinated DB lease. Does not apply DDL,
// migrations or role grants. Production HTTP/SDK writes use owned synthetic rows;
// auth, notifications and postage are controlled. Never contacts a paid provider.
// Usage: node SCRIPT CONTAINER PROJECT SUPABASE_CLI PRIVATE_OUTPUT --exclusive-lease [--include-predecessors]
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const [container, project, cli, output, lease, predecessors] = process.argv.slice(2);
assert.equal(lease, '--exclusive-lease', 'Coordinate exclusive database ownership before running');
assert(predecessors === undefined || predecessors === '--include-predecessors');
const includePredecessors = predecessors === '--include-predecessors';
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert.equal(cli, '/opt/homebrew/bin/supabase');
assert(path.isAbsolute(output || '') && !output.startsWith(root + '/'));
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const identifier = value => '"' + value.replaceAll('"', '""') + '"';
const sql = query => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { input: query, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const read = query => JSON.parse(sql('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL statement_timeout=\'90s\';' + query + 'ROLLBACK;'));
const id = n => `ddc25500-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), actor = id(2), homes = Array.from({ length: 9 }, (_, index) => id(index + 101));
const cases = ['authority-failure', 'owner-only', 'rejected-resubmit', 'omitted-role', 'private-setup',
  'verified-history', 'unique-pending-history', 'bootstrap-projection', 'removed-occupancy'];
const home = name => homes[cases.indexOf(name)];
const sourcePaths = ['scripts/db/test-home-residency-legacy-baseline.cjs', 'backend/routes/home.js',
  'backend/utils/homePermissions.js', 'backend/services/homePostcardService.js',
  'backend/services/homeResidencySubmissionService.js', 'supabase/migrations/20260911043000_home_residency_submission.sql',
  'supabase/migrations/20260908234526_application_baseline.sql'];
const sources = () => Object.fromEntries(sourcePaths.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')]));
function preservation() {
  const tables = read(`SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN('public','auth','storage','supabase_migrations') AND c.relkind='r';`);
  const rows = tables.map(([schema, table]) => `SELECT ${q(schema)}::text schema_name,${q(table)}::text table_name,count(*) row_count,
    md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text),'')) digest FROM ${identifier(schema)}.${identifier(table)} r`).join(' UNION ALL ');
  return read(`SELECT jsonb_build_object('rows',(SELECT jsonb_agg(to_jsonb(t) ORDER BY schema_name,table_name) FROM (${rows})t),
    'functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'definition_hash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
      'owner',p.proowner,'acl',p.proacl,'config',p.proconfig) ORDER BY p.oid) FROM pg_proc p
      WHERE pronamespace='public'::regnamespace AND prokind IN('f','p')),
    'relations',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,'kind',c.relkind,'owner',c.relowner,'acl',c.relacl,
      'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.oid)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations')),
    'extensions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY oid) FROM pg_extension e));`);
}
const namespaceCount = () => read(`SELECT (SELECT count(*) FROM public."Home" WHERE id::text LIKE 'ddc25500-%')
  +(SELECT count(*) FROM auth.users WHERE id::text LIKE 'ddc25500-%')
  +(SELECT count(*) FROM public."User" WHERE id::text LIKE 'ddc25500-%');`);
assert.equal(namespaceCount(), 0, 'Reserved namespace is not empty; preserve it and inspect');
const inspected = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))[0];
assert.equal(inspected.Name, '/' + container); assert.equal(inspected.State.Running, true);
assert.match(inspected.Config.Image, /supabase\/postgres:/);
save('container.json', { id: inspected.Id, created: inspected.Created, name: inspected.Name, image: inspected.Config.Image });
const before = preservation(), sourceBefore = sources();
save('preservation-before.json', before); save('sources-before.json', sourceBefore);
const constraints = read(`SELECT jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)))
  FROM pg_constraint WHERE conrelid='public."HomeResidencyClaim"'::regclass;`);
save('claim-constraints.json', constraints);
assert(constraints.some(c => c.name==='one_pending_claim_per_user_home' && c.definition==='UNIQUE (user_id, home_id)'),
  'Claim uniqueness changed; inspect history semantics before running this baseline');
let config;
try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
catch (_) { throw new Error('Owned local SDK configuration unavailable'); }
assert.equal(config.API_URL, 'http://127.0.0.1:64521');
const rawFetch = global.fetch;
global.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'Baseline blocks external requests');
  return rawFetch(input, options);
};
const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const events = [], results = [];
let failAuthority = false, initialized = false, server;
const db = { auth: client.auth, from(table) {
  assert(['Home', 'HomeOccupancy', 'HomeOwner', 'HomeResidencyClaim', 'HomeAuditLog', 'User',
    'HomeRolePermission', 'HomePermissionOverride'].includes(table));
  return new Proxy(client.from(table), { get(target, key) {
    if (key === 'select') return (columns, ...options) => {
      function wrap(query) { return new Proxy(query, { get(current, property) {
        if (property === 'then') return (resolve, reject) => current.then(result => {
          events.push({ event: 'actual_sdk_read', table, columns, code: result.error?.code || null });
          if (failAuthority && table === 'HomeOccupancy' && columns === 'user_id') {
            failAuthority = false; events.push({ event: 'controlled_after_authority_read_failure' });
            return { data: null, error: { code: 'SYNTHETIC', message: 'Controlled authority read failure' } };
          }
          return result;
        }).then(resolve, reject);
        const next = Reflect.get(current, property); return typeof next === 'function' ? (...args) => wrap(next.apply(current, args)) : next;
      } }); }
      return wrap(target.select(columns, ...options));
    };
    const next = Reflect.get(target, key); return typeof next === 'function' ? next.bind(target) : next;
  } });
} };
const load = Module._load;
Module._load = function(name, parent, isMain) {
  if (parent?.filename.startsWith(root + '/backend/')) {
    if (name.endsWith('/config/supabaseAdmin')) return db;
    if (name.endsWith('/utils/logger')) return { info() {}, warn() {}, error() { events.push({ event: 'production_error' }); } };
    if (name.endsWith('/middleware/verifyToken')) return (req, _res, next) => { req.user = { id: actor }; next(); };
    if (name.endsWith('/middleware/rateLimiter')) return new Proxy({}, { get: () => (_req, _res, next) => next() });
    if (name.endsWith('/services/notificationService')) return { createBulkNotifications: async () => events.push({ event: 'controlled_notification' }) };
    if (name.endsWith('/services/homePostcardService')) return { request: async (homeId, userId) => {
      assert(homes.includes(homeId)); assert.equal(userId, actor); events.push({ event: 'blocked_postage_boundary', home_id: homeId });
      return { status: 503, body: { code: 'SYNTHETIC_POSTCARD_UNAVAILABLE', error: 'Controlled postage unavailable' } };
    } };
    if (parent.filename.endsWith('/routes/home.js')) {
      if (name === '../services/addressValidation') return { AddressVerdictStatus: {} };
      if (name === '../utils/homeDocumentAccess') return { HOME_DOCUMENT_TYPES: ['other'], HOME_DOCUMENT_VISIBILITIES: ['members'] };
      if (!['express', 'joi', 'crypto', '../utils/parsePostGISPoint', '../middleware/validate',
        '../utils/homePermissions', '../utils/requestSessionScope'].includes(name)) return {};
    }
  }
  return load.call(this, name, parent, isMain);
};
function snapshot(homeId) {
  assert(homes.includes(homeId));
  return read(`SELECT jsonb_build_object(
    'claims',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public."HomeResidencyClaim"r WHERE home_id=${q(homeId)}),
    'occupancies',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public."HomeOccupancy"r WHERE home_id=${q(homeId)} AND user_id=${q(actor)}),
    'owners',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public."HomeOwner"r WHERE home_id=${q(homeId)}),
    'audit',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public."HomeAuditLog"r WHERE home_id=${q(homeId)}),
    'postcard_count',(SELECT count(*) FROM public."HomePostcardCode" WHERE home_id=${q(homeId)}));`);
}
async function submit(name, body = { claimed_role: 'renter' }, suffix = '') {
  const target = home(name); assert(target);
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${target}/claim`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const value = { case: name + suffix, status: r.status, body: await r.json(), sql: snapshot(target) };
  results.push(value); return value;
}
async function main() {
  let failure = null;
  try {
    const express = require(path.join(root, 'backend/node_modules/express'));
    const app = express(); app.use(express.json());
    app.use('/api/homes', (req, res, next) => {
      if (req.method !== 'POST' || !homes.some(h => req.path === `/${h}/claim`)) return res.sendStatus(404);
      next();
    }, require(path.join(root, 'backend/routes/home')));
    const statements = [`INSERT INTO auth.users(id,email,email_confirmed_at,last_sign_in_at) VALUES
      (${q(owner)},'legacy-r02-owner@example.invalid',now(),now()),(${q(actor)},'legacy-r02-actor@example.invalid',now(),now());
      INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'legacy_r02_'||right(id::text,2),'Legacy R02 fixture','user'
        FROM auth.users WHERE id IN(${q(owner)},${q(actor)});`];
    for (const name of cases) {
      const target = home(name), bootstrap = name === 'bootstrap-projection';
      statements.push(`INSERT INTO public."Home"(id,created_by_user_id,address,city,state,zipcode)
        VALUES(${q(target)},${q(bootstrap ? actor : owner)},'Owned legacy R02 fixture','Test','WA','98607');`);
      if (!bootstrap) statements.push(`INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
        VALUES(${q(target)},${q(owner)},'verified',true,'strong');`);
      if (!bootstrap && name !== 'owner-only') statements.push(`INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,verified_at)
        VALUES(${q(target)},${q(owner)},'owner','owner','adult','verified',now());`);
    }
    for (const [name, number, status, role] of [['rejected-resubmit',201,'rejected','renter'], ['omitted-role',202,'rejected','tenant'],
      ['verified-history',203,'verified','member'], ['unique-pending-history',205,'pending','renter']]) {
      statements.push(`INSERT INTO public."HomeResidencyClaim"(id,home_id,user_id,claimed_role,status)
        VALUES(${q(id(number))},${q(home(name))},${q(actor)},${q(role)},${q(status)});`);
    }
    statements.push(`INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status)
      VALUES(${q(home('private-setup'))},${q(actor)},'tenant','lease_resident','adult','provisional_bootstrap');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,is_active,end_at)
      VALUES(${q(home('removed-occupancy'))},${q(actor)},'guest','guest','adult','unverified',false,now()-interval '1 day');`);
    sql('BEGIN;' + statements.join('\n') + 'COMMIT;'); initialized = true;
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    let r;
    // The original four defects already have actual predecessor proof. Default
    // to role/projection/renewal defects and preserved existing-claim controls;
    // opt in only when source or
    // an unresolved concern justifies refreshing those earlier reproductions.
    if (includePredecessors) {
      failAuthority = true;
      r = await submit('authority-failure'); assert.equal(r.status,500); assert.equal(r.sql.claims.length,1); assert.equal(r.sql.occupancies.length,0);
      r = await submit('authority-failure',undefined,'-retry'); assert.equal(r.status,400); assert.match(r.body.error,/pending claim/);
      r = await submit('owner-only'); assert.equal(r.status,503); assert.equal(r.sql.claims.length,1); assert.equal(r.sql.occupancies.length,0); assert.equal(r.sql.owners.length,1);
      r = await submit('owner-only',undefined,'-retry'); assert.equal(r.status,400);
      r = await submit('rejected-resubmit'); assert.equal(r.status,200); assert.equal(r.sql.claims[0].id,id(201)); assert.equal(r.sql.claims[0].status,'pending'); assert.equal(r.sql.occupancies.length,0);
      const privateBefore = snapshot(home('private-setup'));
      r = await submit('private-setup'); assert.equal(r.status,400); assert.match(r.body.error,/already a member/); assert.deepEqual(r.sql,privateBefore);
    }
    r = await submit('omitted-role',{}); assert.equal(r.status,200); assert.equal(r.sql.claims[0].claimed_role,'member'); assert.equal(r.sql.occupancies.length,0);
    // Despite the partial pending index, the baseline also has a full unique
    // (user_id,home_id) constraint. Do not drop it to manufacture multi-row
    // history; prove the legitimate existing verified/pending rows are retained.
    const verifiedBefore = snapshot(home('verified-history'));
    r = await submit('verified-history'); assert.equal(r.status,400); assert.match(r.body.error,/already been verified/); assert.deepEqual(r.sql,verifiedBefore);
    const pendingBefore = snapshot(home('unique-pending-history'));
    r = await submit('unique-pending-history'); assert.equal(r.status,400); assert.match(r.body.error,/pending claim/); assert.deepEqual(r.sql,pendingBefore);
    r = await submit('bootstrap-projection'); assert.equal(r.status,201); assert.equal(r.sql.claims[0].cold_start_mode,'self_bootstrap'); assert.equal(r.body.claim.cold_start_mode,null);
    assert.equal(r.sql.occupancies[0].verification_status,'provisional_bootstrap');
    const removedBefore = snapshot(home('removed-occupancy')).occupancies[0];
    r = await submit('removed-occupancy'); assert.equal(r.status,201); assert.equal(r.sql.occupancies[0].id,removedBefore.id);
    assert.equal(r.sql.occupancies[0].is_active,true); assert.equal(r.sql.occupancies[0].role_base,'restricted_member');
    assert.equal(r.sql.occupancies[0].end_at,removedBefore.end_at);
    assert.equal(events.filter(e=>e.event==='blocked_postage_boundary').length,includePredecessors?1:0);
    assert(results.every(result=>result.sql.postcard_count===0));
    assert.deepEqual(sources(),sourceBefore,'Source changed during baseline; do not claim a single binding');
  } catch (error) { failure = error; }
  finally {
    if (server) await new Promise(resolve => server.close(resolve));
    save('observations.json', { results, events, ...(failure ? { failure: failure.message } : {}) });
    if (initialized) {
      sql(`BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id IN(${homes.map(q)});
        DELETE FROM public."HomeResidencyClaim" WHERE home_id IN(${homes.map(q)});
        DELETE FROM public."HomeOwner" WHERE home_id IN(${homes.map(q)});
        DELETE FROM public."HomeOccupancy" WHERE home_id IN(${homes.map(q)});
        DELETE FROM public."Home" WHERE id IN(${homes.map(q)});
        DELETE FROM public."User" WHERE id IN(${q(owner)},${q(actor)});
        DELETE FROM auth.users WHERE id IN(${q(owner)},${q(actor)});COMMIT;`);
    }
    Module._load = load; global.fetch = rawFetch;
    const after = preservation(); save('preservation-after.json',after);
    const exact = JSON.stringify(after) === JSON.stringify(before), clean = namespaceCount() === 0;
    save('cleanup.json',{exact_owned_rows_cleaned:clean,complete_populated_rows_schema_preserved:exact,
      migration_ledger_preserved:JSON.stringify(after.rows.filter(r=>r.schema_name==='supabase_migrations'))===JSON.stringify(before.rows.filter(r=>r.schema_name==='supabase_migrations')),
      functions_preserved:JSON.stringify(after.functions)===JSON.stringify(before.functions),preserved_tables:before.rows.length,
      schema_migrations_applied:false,provider_calls:0,server_stopped:true});
    assert(exact && clean,'Baseline cleanup differs; preserve evidence and investigate');
  }
  if (failure) throw failure;
  save('result.json',{pass:true,baseline_cases:includePredecessors?9:5,http_requests:results.length,sources:sourceBefore,
    limits:'Current legacy defect reproduction only. No repair, protected protocol, live auth/provider/device or hosted deployment acceptance.'});
  console.log('PASS: selected legacy baseline cases reproduced; exact owned rows cleaned and retained database preserved');
}
main().catch(() => { console.error('Legacy baseline failed; inspect private observations and cleanup evidence.'); process.exitCode=1; });
