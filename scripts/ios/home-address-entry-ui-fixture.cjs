#!/usr/bin/env node
// Owned native address-entry acceptance: production geo/validation/lookup routes,
// decision engine, canonical persistence and SDK/PostgREST. External providers and
// sign-in/shell are controlled. Home creation is deliberately outside this scope.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const [container, project, cli, output, portText = '18083'] = process.argv.slice(2);
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(output || '') && !output.startsWith(root + '/'));
const port = Number(portText); assert(port >= 18083 && port <= 18089);
const id = n => `ddc23800-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), q = x => `'${String(x).replaceAll("'", "''")}'`;
const sql = input => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { input, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const tables = ['AddressReviewCase', 'AddressVerificationEvent', 'HomeAddress', 'User'];
const count = () => Number(sql('SELECT ' + tables.map(t => `(SELECT count(*) FROM public."${t}" WHERE id::text LIKE 'ddc23800-%')`).join('+') + `+(SELECT count(*) FROM auth.users WHERE id=${q(actor)});`));
assert.equal(count(), 0, 'Reserved entry fixture namespace must be empty');
let config;
try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
catch (_) { throw new Error('Owned local SDK configuration unavailable'); }
assert.equal(config.API_URL, 'http://127.0.0.1:64521');
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
const db = { from(table) {
  assert(['Home', 'HomeOccupancy', ...tables].includes(table));
  const base = client.from(table);
  return new Proxy(base, { get(target, key) {
    if (key === 'insert') return data => {
      assert(['HomeAddress', 'AddressVerificationEvent', 'AddressReviewCase'].includes(table), 'No Home/admission writes in entry acceptance');
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
          return result;
        }).then(resolve, reject);
        const next = Reflect.get(t, k); return typeof next === 'function' ? (...xs) => wrap(next.apply(t, xs)) : next;
      } }); }
      return wrap(query);
    };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
} };
const line1 = '9131 Address Entry Fixture Way';
const normalized = { address: line1, city: 'Test', state: 'WA', zipcode: '98607', latitude: 45.6, longitude: -122.4, source: 'controlled-provider' };
const google = { isAvailable: () => mode !== 'provider_outage', async validate(input) {
  assert.equal(input.line1.toLowerCase(), line1.toLowerCase());
  log({ event: 'google_boundary', unit: input.line2 || null });
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
}, async resolve(value) { assert.equal(value, 'entry-fixture'); return normalized; }, async reverseGeocode() { return normalized; } };
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
    if (name.endsWith('/utils/geoCache')) return { geoCache: { get() {}, set() {} } };
    if (parent.filename.endsWith('/routes/home.js')) {
      if (name === '../services/addressValidation') return { AddressVerdictStatus: {} };
      if (name === '../utils/homeDocumentAccess') return { HOME_DOCUMENT_TYPES: ['other'], HOME_DOCUMENT_VISIBILITIES: ['members'] };
      if (!['express', 'joi', 'crypto', '../utils/parsePostGISPoint', '../middleware/validate', '../utils/normalizeAddress', '../utils/requestSessionScope'].includes(name)) return {};
    }
  }
  return load.call(this, name, parent, isMain);
};
const express = require(path.join(root, 'backend/node_modules/express'));
const validation = require(path.join(root, 'backend/routes/addressValidation'));
const homeLookup = require(path.join(root, 'backend/routes/home'));
const geoRoutes = require(path.join(root, 'backend/routes/geo'));
Module._load = load;
const app = express(); app.use(express.json());
const token = 'pantopus-synthetic-entry-loopback-only', email = 'entry-ui@example.invalid';
const stamp = '2026-09-11T12:00:00Z';
const user = { id: actor, email, username: 'home_entry_fixture', name: 'Home Entry Fixture', firstName: 'Home', lastName: 'Fixture',
  accountType: 'personal', account_type: 'personal', role: 'user', verified: true, createdAt: stamp, updatedAt: stamp };
const state = () => ({ mode, events, held: !!held, row_count: count() });
app.use((req, res, next) => {
  const p = req.path; res.set('Cache-Control', 'private, no-store');
  if (p === '/fixture/state') return res.json(state());
  if (p === '/fixture/reset' || p === '/fixture/mode') {
    const nextMode = req.body?.mode || 'current';
    assert(['current', 'provider_outage', 'missing_unit', 'search_error', 'search_empty', 'lookup_error', 'malformed_validation'].includes(nextMode));
    mode = nextMode; log({ event: 'mode', mode }); return res.json(state());
  }
  if (p === '/fixture/hold') { assert(['/validate', '/check-address', '/autocomplete'].includes(req.body.suffix)); holdSuffix = req.body.suffix; return res.json(state()); }
  if (p === '/fixture/release') { const reply = held; held = null; reply?.(); return res.json(state()); }
  if (p === '/api/users/login') {
    assert.equal(req.body.email, email); assert.equal(req.body.password, 'synthetic-loopback-only');
    return res.json({ user, accessToken: token, refreshToken: token + '-refresh', expiresIn: 86400, sessionId: 'local-entry-native', session: { id: 'local-entry-native', context: 'interactive' } });
  }
  if (req.headers.authorization !== 'Bearer ' + token) return res.status(401).json({ error: 'Synthetic sign-in required' });
  log({ event: 'request', path: p, method: req.method, mode });
  const json = res.json.bind(res);
  res.json = value => {
    if (mode === 'malformed_validation' && p.endsWith('/validate')) value = { ...value, address_id: 'bad-id' };
    log({ event: 'response', path: p, status: res.statusCode, mode, verdict: value.verdict?.status, address_id: value.address_id });
    if (holdSuffix && p.endsWith(holdSuffix)) { holdSuffix = null; held = () => { if (!res.destroyed) json(value); }; return res; }
    return json(value);
  };
  if (p.startsWith('/api/v1/address/') || p.startsWith('/api/geo/') || p === '/api/homes/check-address') return next();
  if (['/api/users/profile', '/api/users/me'].includes(p)) return res.json({ user, ...user });
  if (p === '/api/homes/my-homes' || p === '/api/homes' && req.method === 'GET') return res.json({ homes: [] });
  if (p === '/api/homes/primary') return res.json({ home: null });
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
initialized = true;
server = app.listen(port, '127.0.0.1', () => console.log('Owned address-entry fixture listening; production validation, geo routes, lookup and SDK/SQL'));
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true; held = null;
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  fs.writeFileSync(output, JSON.stringify(state(), null, 2), { mode: 0o600 });
  if (initialized) sql('BEGIN;' + tables.map(t => `DELETE FROM public."${t}" WHERE id::text LIKE 'ddc23800-%';`).join('\n') + `DELETE FROM auth.users WHERE id=${q(actor)};COMMIT;`);
  assert.equal(count(), 0); console.log('PASS: exact address-entry namespace SQL cleanup');
}
process.on('SIGTERM', () => stop().catch(error => { console.error(error.message); process.exitCode = 1; }));
process.on('SIGINT', () => stop().catch(error => { console.error(error.message); process.exitCode = 1; }));
