#!/usr/bin/env node
// Owned Home creation acceptance. Real production API, SDK and temporary SQL
// command functions; provider/sign-in/notification boundaries are controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const [container, project, cli, output, portText = '18083', purpose = 'creation'] = process.argv.slice(2);
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(output || '') && !output.startsWith(root + '/'));
assert(['creation', 'residency'].includes(purpose));
const residency = purpose === 'residency';
const port = Number(portText); assert(port >= 18083 && port <= 18089);
const id = n => `ddc24100-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), owner = id(2), q = x => `'${String(x).replaceAll("'", "''")}'`;
const sql = input => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { input, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const tables = ['HomePreference', 'HomeAuditLog', 'HomeOccupancy', 'Home', 'AddressReviewCase', 'AddressVerificationEvent', 'HomeAddress', 'User'];
const count = () => Number(sql('SELECT ' + tables.map(t => `(SELECT count(*) FROM public."${t}" WHERE id::text LIKE 'ddc24100-%')`).join('+') + `+(SELECT count(*) FROM auth.users WHERE id IN (${q(actor)},${q(owner)}));`));
assert.equal(count(), 0, 'Reserved entry fixture namespace must be empty');
const commandNames = ['home_create_command_projection','begin_home_create_command','get_home_create_command','cancel_home_create_command','finish_home_create_attempt','commit_home_create_command'];
assert.equal(sql(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${commandNames.map(q).join(',')});`), '0');
assert.equal(sql(`SELECT to_regclass('public."HomeCreateCommand"') IS NULL;`), 't');
const ledger = sql('SELECT max(version) FROM supabase_migrations.schema_migrations;');
if (residency) {
  const extra = ['home_residency_submission_projection','get_home_residency_submission','cancel_home_residency_submission','submit_home_residency'];
  assert.equal(sql(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${extra.map(q)});`), '0');
  assert.equal(sql(`SELECT to_regclass('public."HomeResidencySubmissionCommand"') IS NULL;`), 't');
  commandNames.push(...extra);
}
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260911040000_home_create_recovery.sql'), 'utf8');
let config;
try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
catch (_) { throw new Error('Owned local SDK configuration unavailable'); }
assert.equal(config.API_URL, 'http://127.0.0.1:64521');
sql('BEGIN;'+migration+(residency ? fs.readFileSync(path.join(root,'supabase/migrations/20260911043000_home_residency_submission.sql'),'utf8') : '')+"NOTIFY pgrst, 'reload schema'; COMMIT;");
const rawFetch = global.fetch;
global.fetch = (input, options) => {
  const u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert(['127.0.0.1', 'localhost'].includes(u.hostname), 'Acceptance blocks external fetch');
  return rawFetch(input, options);
};
const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let mode = 'current', events = [], serial = 1000, held = null, holdSuffix = null, server, initialized = false;
const log = event => events.push(event);
let heldProvider = null, heldSubmission = null, holdSubmission = false;
let residencyReadFault = null, residencyReadFaultPersistent = false;
const db = { async rpc(name, args) {
  assert(['begin_home_create_command','get_home_create_command','cancel_home_create_command','finish_home_create_attempt','commit_home_create_command','home_record_context','home_delete_eligibility','submit_home_residency','get_home_residency_submission','cancel_home_residency_submission'].includes(name));
  assert.equal(args.p_actor_id || args.p_user_id, actor);
  if (mode === 'finish_unavailable' && name === 'finish_home_create_attempt') return { data: null, error: { code: 'SYNTHETIC' } };
  const result = await client.rpc(name, args);
  log({ event: 'sdk_rpc', name, state: result.data?.state, code: result.data?.code, error: result.error?.code || null });
  if (name === 'commit_home_create_command' && mode === 'lost_commit_reply' && result.data?.state === 'completed') {
    mode = 'current'; log({ event: 'dropped_commit_reply' }); throw new Error('Synthetic lost reply');
  }
  if (name === 'submit_home_residency' && mode === 'residency_lost_reply' && result.data?.state === 'completed') {
    mode = 'current'; log({ event: 'dropped_residency_reply' }); throw new Error('Synthetic lost reply');
  }
  return result;
}, from(table) {
  assert(['HomeResidencyClaim', 'Home', 'HomeOccupancy', 'HomeOwner', 'HomeOwnershipClaim', 'HomeVerificationEvidence', 'HomeRolePermission', 'HomePermissionOverride', 'AddressVerificationAttempt', ...tables].includes(table));
  const base = client.from(table);
  return new Proxy(base, { get(target, key) {
    if (key === 'insert') return data => {
      assert(['Home','HomePreference','HomeAuditLog','HomeAddress','AddressVerificationEvent','AddressReviewCase'].includes(table));
      const rows = (Array.isArray(data) ? data : [data]).map(row => ({ ...row, id: id(++serial) }));
      log({ event: 'sdk_insert', table, ids: rows.map(r => r.id) });
      return target.insert(Array.isArray(data) ? rows : rows[0]);
    };
    if (key === 'select') return (...args) => {
      log({ event: 'sdk_read', table });
      const query = target.select(...args);
      function wrap(value) { return new Proxy(value, { get(t, k) {
        if (k === 'then') return (resolve, reject) => t.then(result => {
          if (mode === 'lookup_error' && table === 'Home') return { data: null, error: { code: 'SYNTHETIC', message: 'Private fault' } };
          if (residencyReadFault && table === 'HomeResidencyClaim') {
            const kind = residencyReadFault; if (!residencyReadFaultPersistent) residencyReadFault = null;
            if (kind === 'error') return { data: null, error: { code: 'SYNTHETIC', message: 'Private progress fault' } };
            if (result.data) return { ...result, data: Array.isArray(result.data) ? result.data.map(row => ({ ...row, user_id: owner })) : { ...result.data, user_id: owner } };
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
const line1 = '9141 Home Creation Fixture Way';
const normalized = { address: line1, city: 'Test', state: 'WA', zipcode: '98607', latitude: 45.6, longitude: -122.4, source: 'controlled-provider' };
const google = { isAvailable: () => mode !== 'provider_outage', async validate(input) {
  assert.equal(input.line1.toLowerCase(), line1.toLowerCase());
  log({ event: 'google_boundary', unit: input.line2 || null });
  if (mode === 'hold_provider') await new Promise(resolve => { heldProvider = resolve; });
  return { normalized: { line1, line2: input.line2 || undefined, city: 'Test', state: 'WA', zip: '98607', lat: 45.6, lng: -122.4 },
    geocode: { lat: 45.6, lng: -122.4 }, granularity: 'PREMISE', components: {}, missing_component_types: [],
    verdict: { hasUnconfirmedComponents: false, hasInferredComponents: false, hasReplacedComponents: false } };
} };
const smarty = { isAvailable: () => mode !== 'provider_outage', async verify() {
  log({ event: 'smarty_boundary' });
  return { from_cache: false, inconclusive: false, dpv_match_code: mode === 'missing_unit' ? 'S' : 'Y', rdi_type: 'residential',
    missing_secondary: mode === 'missing_unit', commercial_mailbox: false, vacant_flag: false, footnotes: ['AA', 'BB'], raw: {} };
} };
const geo = { async autocomplete() {
  if (mode === 'search_error') throw new Error('Synthetic geo unavailable');
  return { suggestions: mode === 'search_empty' ? [] : [{ suggestion_id: 'entry-fixture', primary_text: line1, secondary_text: 'Test, WA 98607',
    label: line1 + ', Test, WA 98607', kind: 'address', center: { lat: 45.6, lng: -122.4 } }] };
}, async resolve(value) { assert.equal(value, 'entry-fixture'); return normalized; }, async reverseGeocode(latitude, longitude) {
  assert(Number.isFinite(latitude) && Number.isFinite(longitude));
  log({ event: 'reverse_boundary', latitude, longitude });
  return normalized;
} };
const noop = (_req, _res, next) => next();
const load = Module._load;
Module._load = function(name, parent, isMain) {
  if (parent?.filename.startsWith(root + '/backend/')) {
    if (name.endsWith('/config/supabaseAdmin')) return db;
    if (name.endsWith('/utils/logger')) return { info() {}, warn() {}, error(message, fields) { log({ event: 'backend_error', message, error: fields?.error, mode }); } };
    if (name.endsWith('/middleware/verifyToken') || name.endsWith('/middleware/optionalAuth')) return (req, _res, next) => { req.user = { id: actor }; next(); };
    if (name.endsWith('/middleware/rateLimiter')) return new Proxy({}, { get: () => noop });
    if (name.endsWith('/googleProvider')) return google;
    if (name.endsWith('/smartyProvider')) return smarty;
    if (['/placeClassificationProvider', '/secondaryAddressProvider', '/parcelIntelProvider'].some(x => name.endsWith(x))) return { isAvailable: () => false, shouldRunShadowLookup: () => false, shouldRunLookup: () => false };
    if (name.endsWith('/mailVerificationService')) return {};
    if (name.endsWith('/services/geo')) return geo;
    if (name.endsWith('/services/notificationService')) return { notifyOwnershipVerificationNeeded: async () => log({ event: 'controlled_self_notification' }) };
    if (name.endsWith('/utils/geoCache')) return { geoCache: { get() {}, set() {} } };
    if (parent.filename.endsWith('/routes/home.js')) {

      if (name === '../utils/homeDocumentAccess') return { HOME_DOCUMENT_TYPES: ['other'], HOME_DOCUMENT_VISIBILITIES: ['members'] };
      if (!['express', 'joi', 'crypto', '../utils/parsePostGISPoint', '../middleware/validate', '../utils/normalizeAddress', '../utils/requestSessionScope', '../utils/homePermissions', '../utils/addressRolloutFlags', '../services/addressValidation', '../services/homeCreateService', '../services/homeResidencySubmissionService', '../services/homeResidencyProgressService', '../services/homeListService', '../config/addressVerification', '../services/addressValidation/addressVerificationObservability'].includes(name)) return {};
    }
  }
  return load.call(this, name, parent, isMain);
};
const express = require(path.join(root, 'backend/node_modules/express'));
const validation = require(path.join(root, 'backend/routes/addressValidation'));
const homeLookup = require(path.join(root, 'backend/routes/home'));
const geoRoutes = require(path.join(root, 'backend/routes/geo'));
// Keep controlled boundaries in force for lazy runtime imports too.
const app = express(); app.use(express.json());
const token = 'pantopus-synthetic-entry-loopback-only', email = 'entry-ui@example.invalid';
const stamp = '2026-09-11T12:00:00Z';
const user = { id: actor, email, username: 'home_entry_fixture', name: 'Home Entry Fixture', firstName: 'Home', lastName: 'Fixture',
  accountType: 'personal', account_type: 'personal', role: 'user', verified: true, createdAt: stamp, updatedAt: stamp };
const databaseState = () => JSON.parse(sql(`SELECT json_build_object(
  ${residency ? `'submissions',(SELECT coalesce(json_agg(json_build_object('request_id',request_id,'state',state,'home_id',home_id,'code',error_code)), '[]'::json) FROM public."HomeResidencySubmissionCommand" WHERE actor_user_id=${q(actor)}),` : ''}
  'commands', (SELECT coalesce(json_agg(json_build_object('request_id',request_id,'state',state,'home_id',home_id)), '[]'::json) FROM public."HomeCreateCommand" WHERE actor_user_id=${q(actor)}),
  'homes', (SELECT coalesce(json_agg(json_build_object('id',h.id,'unit',h.address2,'owner_id',h.owner_id,
    'claims',(SELECT coalesce(json_agg(json_build_object('id',id,'status',status,'claimed_role',claimed_role,'cold_start_mode',cold_start_mode)), '[]'::json) FROM public."HomeResidencyClaim" WHERE home_id=h.id AND user_id=${q(actor)}),
    'audit',(SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=h.id AND action='residency_submission_saved'),
    'occupancies',(SELECT count(*) FROM public."HomeOccupancy" WHERE home_id=h.id AND user_id=${q(actor)}),
    'verified_occupancies',(SELECT count(*) FROM public."HomeOccupancy" WHERE home_id=h.id AND verification_status='verified'),
    'pending_owners',(SELECT count(*) FROM public."HomeOwner" WHERE home_id=h.id AND owner_status='pending'),
    'preferences',(SELECT count(*) FROM public."HomePreference" WHERE home_id=h.id),
    'secrets',(SELECT count(*) FROM public."HomeAccessSecret" WHERE home_id=h.id))), '[]'::json)
    FROM public."Home" h WHERE created_by_user_id=${q(actor)} OR h.id::text LIKE 'ddc24100-%'));`));
const state = () => ({ mode, events, held: !!held, held_provider: !!heldProvider, held_submission: !!heldSubmission, row_count: count(), database: databaseState() });
app.use((req, res, next) => {
  const p = req.path; res.set('Cache-Control', 'private, no-store');
  if (p === '/fixture/state') return res.json(state());
  if (residency && p === '/fixture/hold-submission') { holdSubmission=true;return res.json(state()); }
  if (residency && p === '/fixture/release-submission') { const release=heldSubmission;heldSubmission=null;release?.();return res.json(state()); }
  if (residency && p === '/fixture/change-unit') {
    assert([601,602,603,604,605].includes(req.body.home));assert(typeof req.body.unit==='string' && req.body.unit.length<30);
    sql(`UPDATE public."Home" SET address2=${q(req.body.unit)} WHERE id=${q(id(req.body.home))};`);return res.json(state());
  }
  if (residency && p === '/fixture/residency-read-fault') {
    assert(['error', 'malformed', 'clear'].includes(req.body.kind));
    residencyReadFault=req.body.kind === 'clear' ? null : req.body.kind;
    residencyReadFaultPersistent=req.body.persistent === true;return res.json(state());
  }
  if (residency && p === '/fixture/residency-history') {
    assert.equal(req.body.count,51);
    sql(`INSERT INTO public."HomeResidencyClaim"(id,user_id,claimed_address) VALUES `
      +Array.from({length:51},(_,i)=>`(${q(id(9000+i))},${q(actor)},${q('Personal historical request '+i)})`).join(',')+';');
    return res.json(state());
  }
  if (residency && p === '/fixture/residency-state') {
    assert([601,602,603,604,605].includes(req.body.home));
    assert(['pending', 'rejected', 'verified', 'removed', 'frozen', 'restored'].includes(req.body.state));
    const target=q(id(req.body.home)), value=req.body.state;
    if (['pending', 'rejected', 'verified'].includes(value)) sql(`UPDATE public."HomeResidencyClaim" SET status=${q(value)},updated_at=now() WHERE home_id=${target} AND user_id=${q(actor)};`);
    if (value==='verified') sql(`UPDATE public."HomeOccupancy" SET verification_status='verified',verified_at=now() WHERE home_id=${target} AND user_id=${q(actor)};INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${target},${q(actor)},'home.view',true) ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=true;`);
    if (value==='removed') sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${target} AND user_id=${q(actor)};`);
    if (value==='frozen') sql(`UPDATE public."Home" SET security_state='frozen' WHERE id=${target};`);
    if (value==='restored') sql(`UPDATE public."Home" SET security_state='normal' WHERE id=${target};UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${target} AND user_id=${q(actor)};`);
    return res.json(state());
  }

  if (p === '/fixture/reject-next-access') { sql(`UPDATE public."User" SET date_of_birth='2020-01-01' WHERE id=${q(actor)};`); return res.json(state()); }
  if (p === '/fixture/restore-age') { sql(`UPDATE public."User" SET date_of_birth=NULL WHERE id=${q(actor)};`); return res.json(state()); }
  if (p === '/fixture/reset' || p === '/fixture/mode') {
    const nextMode = req.body?.mode || 'current';
    assert(['current', 'provider_outage', 'missing_unit', 'search_error', 'search_empty', 'lookup_error', 'malformed_validation', 'hold_provider', 'lost_commit_reply', 'finish_unavailable', 'residency_lost_reply'].includes(nextMode));
    mode = nextMode; log({ event: 'mode', mode }); return res.json(state());
  }
  if (p === '/fixture/hold') { assert(['/validate', '/check-address', '/autocomplete', '/resolve', '/property-suggestions', '/api/homes', '/my-residency'].includes(req.body.suffix)); holdSuffix = req.body.suffix; return res.json(state()); }
  if (p === '/fixture/release-provider') { const release = heldProvider; heldProvider = null; release?.(); return res.json(state()); }
  if (p === '/fixture/release') { const reply = held; held = null; reply?.(); return res.json(state()); }
  if (p === '/api/users/login') {
    assert.equal(req.body.email, email); assert.equal(req.body.password, 'synthetic-loopback-only');
    return res.json({ user, accessToken: token, refreshToken: token + '-refresh', expiresIn: 86400, sessionId: 'local-entry-native', session: { id: 'local-entry-native', context: 'interactive' } });
  }
  if (req.headers.authorization !== 'Bearer ' + token) return res.status(401).json({ error: 'Synthetic sign-in required' });
  log({ event: 'request', path: p, method: req.method, mode, request_id: req.body?.request_id, intent_hash: p === '/api/homes' && req.method === 'POST' ? require('node:crypto').createHash('sha256').update(JSON.stringify(req.body)).digest('hex') : undefined });
  if (residency && holdSubmission && req.method === 'POST' && p.endsWith('/residency-submissions')) {
    holdSubmission=false;heldSubmission=()=>next();return;
  }
  const json = res.json.bind(res);
  res.json = value => {
    if (mode === 'malformed_validation' && p.endsWith('/validate')) value = { ...value, address_id: 'bad-id' };
    log({ event: 'response', path: p, status: res.statusCode, mode, verdict: value.verdict?.status, address_id: value.address_id });
    if (holdSuffix && p.endsWith(holdSuffix)) { holdSuffix = null; held = () => { if (!res.destroyed) json(value); }; return res; }
    return json(value);
  };
  if (residency && p.includes('/residency-submissions')) return next();
  if (p.endsWith('/my-residency')) return next();
  if (p.startsWith('/api/v1/address/') || p.startsWith('/api/geo/') || p === '/api/homes/check-address' || p.startsWith('/api/homes/create-commands/') || p === '/api/homes' || p === '/api/homes/my-homes' || p === '/api/homes/primary') return next();
  if (['/api/users/profile', '/api/users/me'].includes(p)) return res.json({ user, ...user });
  if (p === '/api/hub') return res.json({ user, context: { activeHomeId: null, activePersona: { type: 'personal' } },
    availability: { hasHome: false, hasBusiness: false, hasPayoutMethod: false }, homes: [], businesses: [],
    setup: { steps: [], allDone: true, profileCompleteness: { score: 100, checks: { firstName: true, lastName: true, photo: false, bio: false, skills: false }, missingFields: [] } }, statusItems: [],
    cards: { personal: { unreadChats: 0, earnings: 0, gigsNearby: 0, rating: 0, reviewCount: 0 } }, jumpBackIn: [], activity: [] });
  if (p === '/api/homes/property-suggestions') return res.status(503).json({ error: 'Property information unavailable' });
  if (p.endsWith('/unread-count')) return res.json({ count: 0, unread_count: 0, unreadCount: 0 });
  if (p === '/api/notifications') return res.json({ notifications: [], unreadCount: 0, pagination: { page: 1, totalPages: 0, total: 0 } });
  if (p.includes('/logout')) return res.json({ success: true });
  return res.status(404).json({ error: 'Outside address-entry acceptance scope' });
});
app.use('/api/v1/address', validation); app.use('/api/geo', geoRoutes); app.use('/api/homes', homeLookup);
app.use((error, _req, res, _next) => { log({ event: 'fixture_error', message: error.message }); res.status(500).json({ error: 'Fixture unavailable' }); });
sql(`BEGIN; INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(${q(actor)},${q(email)},now());
  INSERT INTO public."User"(id,email,username,name,role) VALUES(${q(actor)},${q(email)},'home_entry_fixture','Home Entry Fixture','user'); COMMIT;`);
if (residency) {
  sql(`BEGIN;INSERT INTO auth.users(id,email,email_confirmed_at,last_sign_in_at) VALUES(${q(owner)},'residency-owner-ui@example.invalid',now(),now());
    INSERT INTO public."User"(id,email,username,name,role) VALUES(${q(owner)},'residency-owner-ui@example.invalid','home_residency_owner_fixture','Home Owner Fixture','user');`
    +[601,602,603,604,605].map(n=>`INSERT INTO public."Home"(id,created_by_user_id,address,address2,city,state,zipcode,name) VALUES
      (${q(id(n))},${q(owner)},${q(line1)},${q(String(n))},'Test','WA','98607','Existing fixture Home');`
      +(n===605 ? '' : `INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES(${q(id(n))},${q(owner)},'verified',true);`)).join('')
    +`INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_address,claimed_role,status,reviewed_by,reviewed_at)
      VALUES(${q(id(604))},${q(actor)},${q(line1+' Unit 604')},'renter','rejected',${q(owner)},now());
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,access_end_at)
      VALUES(${q(id(604))},${q(actor)},'tenant','restricted_member','teen','pending_approval',now()+interval '2 days');COMMIT;`);
}
initialized = true;
server = app.listen(port, '127.0.0.1', () => console.log('Owned atomic Home-create fixture on loopback; production HTTP/SDK/SQL'));
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true; held = null; heldSubmission = null;
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  let evidence;
  try { evidence = state(); } catch (error) { evidence = { mode, events, evidence_error: error.message }; }
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2), { mode: 0o600 });
  if (initialized) sql(`BEGIN; DELETE FROM public."Home" WHERE created_by_user_id=${q(actor)} OR id::text LIKE 'ddc24100-%'; DELETE FROM public."HomeCreateCommand" WHERE actor_user_id=${q(actor)};DELETE FROM public."HomeResidencyClaim" WHERE user_id=${q(actor)};` + tables.map(t => `DELETE FROM public."${t}" WHERE id::text LIKE 'ddc24100-%';`).join('\n') + `DELETE FROM auth.users WHERE id IN (${q(actor)},${q(owner)});COMMIT;`);
  if (residency) sql(`DELETE FROM public."HomeResidencySubmissionCommand" WHERE actor_user_id=${q(actor)};`);
  assert.equal(count(), 0);
  assert.equal(sql(`SELECT count(*) FROM public."HomeCreateCommand";`), '0');
  if (residency) assert.equal(sql(`SELECT count(*) FROM public."HomeResidencySubmissionCommand";`), '0');
  const signatures = sql(`SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${commandNames.map(q).join(',')}) ORDER BY p.proname;`).split('\n');
  assert.equal(signatures.length, commandNames.length);
  sql('BEGIN;'+signatures.map(sig => 'DROP FUNCTION public.'+sig+';').join('\n')+'DROP TABLE public."HomeCreateCommand";'+(residency ? 'DROP TABLE public."HomeResidencySubmissionCommand";' : '')+"NOTIFY pgrst, 'reload schema'; COMMIT;");
  assert.equal(sql('SELECT max(version) FROM supabase_migrations.schema_migrations;'),ledger);
  console.log('PASS: exact synthetic SQL and temporary command functions cleaned; migration ledger unchanged');
}
process.on('SIGTERM', () => stop().catch(error => { console.error(error.message); process.exitCode = 1; }));
process.on('SIGINT', () => stop().catch(error => { console.error(error.message); process.exitCode = 1; }));
