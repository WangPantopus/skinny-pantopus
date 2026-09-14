#!/usr/bin/env node
// Production Home lookup/Joi -> actual SDK/PostgREST, owned isolated SQL only.
// Auth is controlled; query faults are injected after real reads complete.
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const container = process.argv[2], project = process.argv[3], cli = process.argv[4];
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
const id = n => `ddc23700-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), addressId = id(10), home = id(100), retired = id(101);
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const sql = input => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { input, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const address = { address: '9127 Lookup Contract Fixture Way', city: 'Test', state: 'WA', zip_code: '98607' };
const { computeAddressHash } = require(path.join(root, 'backend/utils/normalizeAddress'));
const hash = computeAddressHash(address.address, '', address.city, address.state, address.zip_code, 'US');
let fault = null, reads = 0, initialized = false, server;
function readQuery(query, table) {
  return new Proxy(query, { get(target, key) {
    if (key === 'then') return (resolve, reject) => target.then(result => {
      if (fault?.table === table) {
        if (fault.kind === 'throw') throw new Error('Synthetic interrupted lookup');
        if (fault.kind === 'malformed') return { data: table === 'HomeAddress' ? {} : [{}], error: null };
        if (fault.kind === 'missing') return {};
        return { data: null, error: { code: 'SYNTHETIC_READ_FAILURE', message: 'Private synthetic diagnostic' } };
      }
      return result;
    }).then(resolve, reject);
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? (...args) => readQuery(value.apply(target, args), table) : value;
  } });
}
function setup() {
  assert.equal(sql(`SELECT (SELECT count(*) FROM auth.users WHERE id=${q(actor)})
    +(SELECT count(*) FROM public."Home" WHERE id IN (${q(home)},${q(retired)}))
    +(SELECT count(*) FROM public."HomeAddress" WHERE id=${q(addressId)} OR address_hash=${q(hash)});`), '0');
  sql(`BEGIN;
    INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(${q(actor)},'home-lookup@example.invalid',now());
    INSERT INTO public."User"(id,email,username,name,role) VALUES(${q(actor)},'home-lookup@example.invalid','home_lookup_fixture','Lookup fixture','user');
    INSERT INTO public."HomeAddress"(id,address_line1_norm,city_norm,state,postal_code,country,address_hash,place_type)
      VALUES(${q(addressId)},${q(address.address)},'Test','WA','98607','US',${q(hash)},'single_family');
    INSERT INTO public."Home"(id,address_id,address_hash,address,city,state,zipcode,home_status)
      VALUES(${q(home)},${q(addressId)},${q(hash)},${q(address.address)},'Test','WA','98607','active'),
        (${q(retired)},${q(addressId)},${q(hash)},${q(address.address)},'Test','WA','98607','archived');
    COMMIT;`);
  initialized = true;
}
async function request(body = { ...address, address_id: addressId }, route = '/check-address') {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
async function found(status = 'HOME_FOUND_CLAIMED', body) {
  const result = await request(body);
  assert.equal(result.status, 200); assert.equal(result.body.status, status);
  assert.equal(result.body.home_id, home); assert.equal(result.cache, 'private, no-store');
  assert.deepEqual(Object.keys(result.body).sort(), ['formatted_address', 'home_id', 'is_multi_unit', 'status']);
}
async function main() {
  const load = Module._load;
  try {
    let config;
    try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 })); }
    catch (_) { throw new Error('Owned local SDK config unavailable'); }
    assert.equal(config.API_URL, 'http://127.0.0.1:64521');
    const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
    const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const db = { from(table) {
      assert(['HomeAddress', 'Home', 'HomeOccupancy'].includes(table));
      // The HTTP router cannot mutate data through this adapter.
      return { select(columns) { reads++; return readQuery(client.from(table).select(columns), table); } };
    }, rpc() { throw new Error('RPC unavailable in lookup acceptance'); } };
    Module._load = function(moduleName, parent, isMain) {
      if (parent?.filename.endsWith('/routes/home.js')) {
        if (moduleName === '../config/supabaseAdmin') return db;
        if (moduleName === '../middleware/verifyToken') return (req, _res, next) => { req.user = { id: actor }; next(); };
        if (moduleName === '../middleware/rateLimiter') return new Proxy({}, { get: () => (_req, _res, next) => next() });
        if (moduleName === '../utils/logger') return { info() {}, warn() {}, error() {} };
        if (moduleName === '../services/addressValidation') return { AddressVerdictStatus: {} };
        if (moduleName === '../utils/homeDocumentAccess') return { HOME_DOCUMENT_TYPES: ['other'], HOME_DOCUMENT_VISIBILITIES: ['members'] };
        if (!['express', 'joi', 'crypto', '../utils/parsePostGISPoint', '../middleware/validate', '../utils/normalizeAddress', '../utils/requestSessionScope'].includes(moduleName)) return {};
      }
      return load.call(this, moduleName, parent, isMain);
    };
    const express = require(path.join(root, 'backend/node_modules/express'));
    const app = express(); app.use(express.json()); app.use('/api/homes', require(path.join(root, 'backend/routes/home')));
    Module._load = load;
    setup(); server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    await found('HOME_FOUND_UNCLAIMED');
    sql(`INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,verification_status,is_active)
      VALUES(${q(home)},${q(actor)},'member','member','verified',true);`);
    await found(); await found('HOME_FOUND_CLAIMED', address);
    sql(`UPDATE public."Home" SET address_id=NULL,address_hash=NULL WHERE id=${q(home)};`);
    await found();
    sql(`UPDATE public."Home" SET address_id=${q(addressId)},address_hash=${q(hash)} WHERE id=${q(home)};`);
    console.log('PASS: actual canonical, hash and legacy-field Home lookup; claimed/unclaimed status, no household identity fields, archived duplicate excluded');
    for (const table of ['HomeAddress', 'Home', 'HomeOccupancy']) {
      for (const kind of ['error', 'throw', 'missing', 'malformed']) {
        fault = { table, kind };
        const result = await request();
        assert.equal(result.status, 503); assert.equal(result.body.code, 'HOME_ADDRESS_LOOKUP_UNAVAILABLE');
        assert.equal(result.body.retryable, true); assert.equal(result.cache, 'private, no-store');
        assert.equal(result.body.status, undefined); assert.equal(result.body.home_id, undefined);
        assert(!JSON.stringify(result.body).includes('Private synthetic diagnostic'));
        fault = null; await found();
      }
    }
    console.log('PASS: actual SDK reads followed by failed/interrupted/missing/malformed results stay unavailable; all twelve cases recover');
    sql(`UPDATE public."Home" SET home_status='archived' WHERE id=${q(home)};`);
    const absent = await request(); assert.equal(absent.status, 200); assert.equal(absent.body.status, 'HOME_NOT_FOUND');
    assert.equal(absent.body.home_id, undefined);
    sql(`UPDATE public."Home" SET home_status='active' WHERE id=${q(home)};`);
    await found();
    console.log('PASS: only archived matching Homes returns no active Home; reactivation recovers');
    console.log(`PASS: ${reads} actual SDK queries; mutation methods unavailable to HTTP lookup`);
  } finally {
    Module._load = load;
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) {
      sql(`BEGIN;
        DELETE FROM public."HomeOccupancy" WHERE home_id IN (${q(home)},${q(retired)});
        DELETE FROM public."Home" WHERE id IN (${q(home)},${q(retired)});
        DELETE FROM public."HomeAddress" WHERE id=${q(addressId)};
        DELETE FROM public."User" WHERE id=${q(actor)};
        DELETE FROM auth.users WHERE id=${q(actor)};
        COMMIT;`);
      assert.equal(sql(`SELECT (SELECT count(*) FROM auth.users WHERE id=${q(actor)})
        +(SELECT count(*) FROM public."Home" WHERE id IN (${q(home)},${q(retired)}))
        +(SELECT count(*) FROM public."HomeAddress" WHERE id=${q(addressId)});`), '0');
      console.log('PASS: exact lookup fixture SQL cleanup');
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
