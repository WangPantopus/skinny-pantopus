#!/usr/bin/env node
// Reproduce legacy joining failures through production HTTP and real SDK/SQL.
// Only fixture auth/notification/postage boundaries and a post-query read fault are controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const [container, project, cli, evidence] = process.argv.slice(2);
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const id = n => `ddc24200-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), actor = id(2), home = id(100);
const q = v => `'${String(v).replaceAll("'", "''")}'`;
const sql = input => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 }).trim();
const count = () => Number(sql(`SELECT (SELECT count(*) FROM public."Home" WHERE id=${q(home)})+(SELECT count(*) FROM auth.users WHERE id IN (${q(owner)},${q(actor)}));`));
assert.equal(count(), 0, 'Reserved submission fixture must be empty');
let config;
try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
catch (_) { throw new Error('Owned local SDK configuration unavailable'); }
assert.equal(config.API_URL, 'http://127.0.0.1:64521');
const rawFetch = global.fetch;
global.fetch = (input, options) => {
  const u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert(['127.0.0.1', 'localhost'].includes(u.hostname), 'Baseline blocks external fetch');
  return rawFetch(input, options);
};
const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const events = [], results = [];
let fault = false, initialized = false, server;
const db = { auth: client.auth, from(table) {
  assert(['Home', 'HomeOccupancy', 'HomeOwner', 'HomeResidencyClaim', 'User', 'HomeRolePermission', 'HomePermissionOverride'].includes(table));
  const base = client.from(table);
  return new Proxy(base, { get(target, key) {
    if (key === 'select') return (columns, ...options) => {
      const query = target.select(columns, ...options);
      function wrap(value) { return new Proxy(value, { get(t, k) {
        if (k === 'then') return (resolve, reject) => t.then(result => {
          events.push({ event: 'sdk_read', table, columns, error: result.error?.code || null });
          if (fault && table === 'HomeOccupancy' && columns === 'user_id') {
            fault = false; return { data: null, error: { code: 'SYNTHETIC', message: 'Private synthetic authority failure' } };
          }
          return result;
        }).then(resolve, reject);
        const next = Reflect.get(t, k); return typeof next === 'function' ? (...xs) => wrap(next.apply(t, xs)) : next;
      } }); }
      return wrap(query);
    };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
} };
const load = Module._load;
Module._load = function(name, parent, isMain) {
  if (parent?.filename.startsWith(root + '/backend/')) {
    if (name.endsWith('/config/supabaseAdmin')) return db;
    if (name.endsWith('/utils/logger')) return { info() {}, warn() {}, error(message) { events.push({ event: 'diagnostic', message }); } };
    if (name.endsWith('/middleware/verifyToken')) return (req, _res, next) => { req.user = { id: actor }; next(); };
    if (name.endsWith('/middleware/rateLimiter')) return new Proxy({}, { get: () => (_req, _res, next) => next() });
    if (name.endsWith('/services/notificationService')) return { createBulkNotifications: async () => events.push({ event: 'controlled_notification' }) };
    if (name.endsWith('/services/homePostcardService')) return { request: async (homeId, userId) => {
      assert.equal(homeId, home); assert.equal(userId, actor); events.push({ event: 'blocked_postage_boundary' });
      return { status: 503, body: { code: 'SYNTHETIC_POSTCARD_UNAVAILABLE', error: 'Controlled postage unavailable' } };
    } };
    if (parent.filename.endsWith('/routes/home.js')) {
      if (name === '../services/addressValidation') return { AddressVerdictStatus: {} };
      if (name === '../utils/homeDocumentAccess') return { HOME_DOCUMENT_TYPES: ['other'], HOME_DOCUMENT_VISIBILITIES: ['members'] };
      if (!['express', 'joi', 'crypto', '../utils/parsePostGISPoint', '../middleware/validate', '../utils/homePermissions', '../utils/requestSessionScope'].includes(name)) return {};
    }
  }
  return load.call(this, name, parent, isMain);
};
const express = require(path.join(root, 'backend/node_modules/express'));
const app = express(); app.use(express.json()); app.use('/api/homes', require(path.join(root, 'backend/routes/home')));
const snapshot = () => JSON.parse(sql(`SELECT json_build_object(
  'claims',(SELECT coalesce(json_agg(json_build_object('status',status,'claimed_role',claimed_role,'cold_start_mode',cold_start_mode)),'[]') FROM public."HomeResidencyClaim" WHERE home_id=${q(home)}),
  'actor_occupancies',(SELECT coalesce(json_agg(json_build_object('is_active',is_active,'verification_status',verification_status,'role_base',role_base)),'[]') FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(actor)}),
  'verified_owners',(SELECT count(*) FROM public."HomeOwner" WHERE home_id=${q(home)} AND owner_status='verified'));`));
async function submit(label) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${home}/claim`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimed_role: 'renter' }) });
  const body = await response.json(); const result = { label, status: response.status, body, sql: snapshot() }; results.push(result); return result;
}
async function main() {
  try {
    sql(`BEGIN; INSERT INTO auth.users(id,email,email_confirmed_at,last_sign_in_at) VALUES
      (${q(owner)},'submission-owner@example.invalid',now(),now()),(${q(actor)},'submission-actor@example.invalid',now(),now());
      INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'submission_'||right(id::text,2),'Submission fixture','user' FROM auth.users WHERE id IN (${q(owner)},${q(actor)});
      INSERT INTO public."Home"(id,created_by_user_id,address,city,state,zipcode) VALUES(${q(home)},${q(owner)},'Private submission fixture','Test','WA','98607');
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier) VALUES(${q(home)},${q(owner)},'verified',true,'strong');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,verified_at) VALUES(${q(home)},${q(owner)},'owner','owner','adult','verified',now()); COMMIT;`);
    initialized = true;
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    fault = true;
    let r = await submit('authority-failure-after-insert');
    assert.equal(r.status, 500); assert.equal(r.sql.claims.length, 1); assert.equal(r.sql.actor_occupancies.length, 0);
    r = await submit('retry-stranded-pending-claim'); assert.equal(r.status, 400); assert.match(r.body.error, /pending claim/);
    console.log('REPRODUCED: failed authority read leaves a pending claim; retry cannot finish admission');
    sql(`BEGIN; DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)}; DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)}; COMMIT;`);
    r = await submit('verified-owner-without-occupancy'); assert.equal(r.status, 503); assert.equal(r.sql.verified_owners, 1);
    assert.equal(events.filter(e => e.event === 'blocked_postage_boundary').length, 1);
    r = await submit('retry-postage-refusal'); assert.equal(r.status, 400);
    console.log('REPRODUCED: verified owner without occupancy is skipped; blocked postage leaves an unrecoverable pending claim');
    sql(`UPDATE public."HomeResidencyClaim" SET status='rejected',reviewed_at=now(),reviewed_by=${q(owner)} WHERE home_id=${q(home)};`);
    r = await submit('rejected-resubmission-skips-routing'); assert.equal(r.status, 200); assert.equal(r.sql.claims[0].status, 'pending');
    assert.equal(r.sql.actor_occupancies.length, 0); assert.equal(events.filter(e => e.event === 'blocked_postage_boundary').length, 1);
    console.log('REPRODUCED: rejected resubmission skips routing and leaves no pending admission');
    sql(`BEGIN; DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES(${q(home)},${q(actor)},'tenant','lease_resident','adult','provisional_bootstrap'); COMMIT;`);
    r = await submit('private-setup-is-already-member'); assert.equal(r.status, 400); assert.match(r.body.error, /already a member/);
    assert.equal(r.sql.actor_occupancies[0].verification_status, 'provisional_bootstrap');
    console.log('REPRODUCED: provisional private setup is reported as already admitted');
  } finally {
    if (initialized) {
      fs.writeFileSync(path.join(evidence, 'before-cleanup.json'), JSON.stringify({ results, events, final: snapshot() }, null, 2), { mode: 0o600 });
      sql(`BEGIN; DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)}; DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};
        DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)}; DELETE FROM public."HomeOwner" WHERE home_id=${q(home)};
        DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)}; DELETE FROM public."Home" WHERE id=${q(home)};
        DELETE FROM public."User" WHERE id IN (${q(owner)},${q(actor)}); DELETE FROM auth.users WHERE id IN (${q(owner)},${q(actor)}); COMMIT;`);
      assert.equal(count(), 0); console.log('PASS: exact synthetic submission SQL cleaned; no postage or notification was sent');
    }
    await new Promise(resolve => server ? server.close(resolve) : resolve()); Module._load = load; global.fetch = rawFetch;
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
