// Baseline for the browser guest-pass journey: real homeIam/homeGuest routers
// and the real share service over actual HTTP. Run with `--serve <port>` to
// hold the same server open for the browser journey.
// Synthetic: authentication, and (without a container) the share RPC contract.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// `--container <name>` runs the share RPCs as actual SQL in this stream's own
// disposable replay project. Without it the fixture uses its transcription of
// the frozen contract, which is route/service/UI evidence only.
const containerIndex = process.argv.indexOf('--container');
const container = containerIndex > 0 ? process.argv[containerIndex + 1] : null;
// `--api <url>` (with SUPABASE_SERVICE_ROLE_KEY in the environment, never on the
// command line) adds the same project's PostgREST/Storage through the production
// admin client: the real home.js emergency routes, the real document upload
// route and shared-document downloads then run end to end. The key is read
// from the environment only and is never printed.
const apiIndex = process.argv.indexOf('--api');
const apiUrl = apiIndex > 0 ? process.argv[apiIndex + 1] : null;
if (apiUrl) assert(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY,
  '--api needs SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY in the environment');
const fixture = require('./home-guest-pass-http-fixture.cjs')({ container,
  api: apiUrl ? { url: apiUrl, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, anonKey: process.env.SUPABASE_ANON_KEY } : null });

const serveIndex = process.argv.indexOf('--serve');
const port = serveIndex > 0 ? Number(process.argv[serveIndex + 1]) : 0;
// `--cleanup` removes a served run's rows and objects afterwards and prints
// the counts, so the browser journey can be torn down to exactly zero.
const cleanupOnly = process.argv.includes('--cleanup');

let server = null;
const NATIVE_FORM_TYPES = ['allergy', 'medical_condition', 'medication', 'contact', 'pet_medical', 'power_of_attorney'];

async function main() {
  if (cleanupOnly) {
    assert(container, '--cleanup needs the container-backed run');
    const objects = fixture.real ? await fixture.cleanupStorage() : 0;
    console.log(JSON.stringify({ cleaned: true, remaining: { ...fixture.cleanup(), objects } }));
    return;
  }
  if (container) fixture.seed();
  if (fixture.real) await fixture.prepareStorage();
  if (serveIndex > 0 && fixture.real) {
    // Browser journeys: every unrelated dashboard/shell read answers 404 JSON
    // instead of an HTML page. Synthetic scaffolding, labelled as such.
    fixture.app.use('/api', (_req, res) => res.status(404).json({ error: 'Not part of the guest-pass fixture', code: 'FIXTURE_UNSUPPORTED' }));
  }
  server = await new Promise(resolve => {
    const created = fixture.app.listen(port, '127.0.0.1', () => resolve(created));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, headers = {}) => {
    const response = await fetch(`${base}${url}`, {
      method, headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    return { status: response.status, body: await response.json() };
  };
  const raw = async url => {
    const response = await fetch(`${base}${url}`, { signal: AbortSignal.timeout(20000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, bytes, type: response.headers.get('content-type'),
      disposition: response.headers.get('content-disposition'), cache: response.headers.get('cache-control'),
      json: () => JSON.parse(bytes.toString('utf8')) };
  };
  const passes = () => `/api/homes/${fixture.homeId}/guest-passes`;
  const grants = () => `/api/homes/${fixture.homeId}/scoped-grants`;
  const emergencies = () => `/api/homes/${fixture.homeId}/emergencies`;
  const task = fixture.state.task;
  // The real upload route, the way the web/native document pickers reach it.
  const uploadDocument = async (bytes, title) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'text/plain' }), 'fixture.txt');
    form.append('upload_id', crypto.randomUUID());
    form.append('doc_type', 'other');
    form.append('title', title);
    form.append('visibility', 'members');
    const response = await fetch(`${base}/api/homes/${fixture.homeId}/documents/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
    return { status: response.status, body: await response.json() };
  };

  if (serveIndex > 0) {
    // Seeded browser journey state: one passcode pass and one single-view pass.
    const seeded = await call('POST', passes(), { label: 'Seeded guest pass', kind: 'guest',
      included_sections: ['wifi', 'parking', 'house_rules', 'entry_instructions'], duration_hours: 48 });
    assert.equal(seeded.status, 201);
    const locked = await call('POST', passes(), { label: 'Passcode pass', kind: 'wifi_only',
      included_sections: ['wifi'], duration_hours: 8, passcode: 'sesame' });
    const limited = await call('POST', passes(), { label: 'Single view pass', kind: 'wifi_only',
      included_sections: ['wifi'], duration_hours: 8, max_views: 1 });
    const later = await call('POST', passes(), { label: 'Scheduled pass', kind: 'guest',
      included_sections: ['parking'], start_at: new Date(Date.now() + 86400_000).toISOString(), duration_hours: 24 });
    const legacy = await call('POST', passes(), { label: 'Legacy pass', kind: 'guest',
      included_sections: ['parking'], duration_hours: 24 });
    fixture.demoteToLegacy(legacy.body.pass.id);
    const tokens = { seeded: seeded.body.token, locked: locked.body.token, limited: limited.body.token,
      later: later.body.token, legacy: legacy.body.token };
    const extra = {};
    if (fixture.real) {
      // Scoped links for the /shared/:token page in each state the API can return,
      // plus one real uploaded document reachable through both link kinds.
      const scoped = async payload => (await call('POST', grants(), { resource_type: 'HomeTask', resource_id: task.id, can_edit: false, ...payload })).body;
      const taskGrant = await scoped({ duration_hours: 24 });
      const taskLocked = await scoped({ duration_hours: 24, passcode: 'sesame' });
      const taskLimited = await scoped({ duration_hours: 24, max_views: 1 });
      const taskLater = await scoped({ start_at: new Date(Date.now() + 86400_000).toISOString(), duration_hours: 24 });
      const taskLegacy = await scoped({ duration_hours: 24 });
      fixture.demoteToLegacy(taskLegacy.grant.id, 'scoped');
      const uploaded = await uploadDocument(Buffer.from('Shared document fixture bytes\n'), 'Fixture document');
      assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
      const docGrant = (await call('POST', grants(), { resource_type: 'HomeDocument', resource_id: uploaded.body.document.id, duration_hours: 24, can_edit: false })).body;
      const docPass = await call('POST', passes(), { label: 'Document pass', kind: 'guest',
        included_sections: ['parking', `doc:${uploaded.body.document.id}`], duration_hours: 24 });
      Object.assign(tokens, { task: taskGrant.token, taskLocked: taskLocked.token, taskLimited: taskLimited.token,
        taskLater: taskLater.token, taskLegacy: taskLegacy.token, doc: docGrant.token, docPass: docPass.body.token });
      Object.assign(extra, { documentId: uploaded.body.document.id, emergencyIds: fixture.state.emergency.map(row => row.id) });
    }
    console.log(JSON.stringify({ ready: true, port: server.address().port, homeId: fixture.homeId, tokens, ...extra }));
    return;
  }

  const created = await call('POST', passes(), { label: 'Weekend guest', kind: 'guest',
    included_sections: ['wifi', 'parking', 'house_rules', 'entry_instructions'], duration_hours: 48 });
  assert.equal(created.status, 201);
  assert.equal(created.body.pass.view_count, 0);
  assert.match(created.body.token, /^[a-f0-9]{64}$/);
  assert.equal(created.body.pass.token_hash, undefined);
  assert.equal(created.body.pass.passcode_hash, undefined);
  assert.equal(created.body.pass.resource_bindings, undefined);
  const view = await call('GET', `/api/homes/guest/${created.body.token}`);
  assert.equal(view.status, 200);
  assert.deepEqual(view.body.sections.wifi, { network_name: 'Home WiFi', password: 'MyWifiPassword123' });
  assert.equal(view.body.sections.parking, 'Park in driveway');
  assert.equal(view.body.pass.home_name, 'My Place');
  console.log('PASS: issued pass returns a usable link and the exact bound sections');

  const listed = await call('GET', `${passes()}?include_revoked=true`);
  assert.equal(listed.body.passes[0].status, 'active');
  assert.equal(listed.body.passes[0].view_count, 1);
  assert.equal(typeof listed.body.passes[0].last_viewed_at, 'string');
  console.log('PASS: the issuer list reports the consumed view and active status');

  const locked = await call('POST', passes(), { label: 'Passcode pass', kind: 'wifi_only',
    included_sections: ['wifi'], duration_hours: 8, passcode: 'sesame' });
  const challenge = await call('GET', `/api/homes/guest/${locked.body.token}`);
  assert.equal(challenge.status, 403);
  assert.equal(challenge.body.code, 'SHARE_PASSCODE_REQUIRED');
  assert.equal(challenge.body.requiresPasscode, true);
  assert.equal(challenge.body.sections, undefined);
  const wrong = await call('GET', `/api/homes/guest/${locked.body.token}?passcode=nope`);
  assert.equal(wrong.body.code, 'SHARE_PASSCODE_REQUIRED');
  const unlocked = await call('GET', `/api/homes/guest/${locked.body.token}?passcode=sesame`);
  assert.equal(unlocked.status, 200);
  assert.equal((await call('GET', `${passes()}?include_revoked=true`)).body.passes
    .find(row => row.id === locked.body.pass.id).view_count, 1);
  console.log('PASS: a wrong passcode is refused without spending the view quota');

  const limited = await call('POST', passes(), { label: 'Single view', kind: 'wifi_only',
    included_sections: ['wifi'], duration_hours: 8, max_views: 1 });
  assert.equal((await call('GET', `/api/homes/guest/${limited.body.token}`)).status, 200);
  const exhausted = await call('GET', `/api/homes/guest/${limited.body.token}`);
  assert.equal(exhausted.status, 410);
  assert.equal(exhausted.body.code, 'SHARE_VIEW_LIMIT');
  assert.equal((await call('GET', `${passes()}?include_revoked=true`)).body.passes
    .find(row => row.id === limited.body.pass.id).status, 'expired');
  console.log('PASS: the view limit retires the link and the list stops calling it active');

  const scheduled = await call('POST', passes(), { label: 'Scheduled', kind: 'guest',
    included_sections: ['parking'], start_at: new Date(Date.now() + 86400_000).toISOString(), duration_hours: 24 });
  const early = await call('GET', `/api/homes/guest/${scheduled.body.token}`);
  assert.equal(early.status, 403);
  assert.equal(early.body.code, 'SHARE_NOT_STARTED');
  assert.equal((await call('GET', `${passes()}?include_revoked=true`)).body.passes
    .find(row => row.id === scheduled.body.pass.id).status, 'scheduled');
  console.log('PASS: a future window refuses the read and lists as scheduled');

  const legacy = await call('POST', passes(), { label: 'Legacy', kind: 'guest',
    included_sections: ['parking'], duration_hours: 24 });
  fixture.demoteToLegacy(legacy.body.pass.id);
  const stale = await call('GET', `/api/homes/guest/${legacy.body.token}`);
  assert.equal(stale.status, 410);
  assert.equal(stale.body.code, 'SHARE_REISSUE_REQUIRED');
  assert.equal((await call('GET', `${passes()}?include_revoked=true`)).body.passes
    .find(row => row.id === legacy.body.pass.id).status, 'reissue_required');
  console.log('PASS: an unvalidated legacy link reports reissue_required on both sides');

  const revoked = await call('DELETE', `${passes()}/${created.body.pass.id}`);
  assert.equal(revoked.status, 200);
  const afterRevoke = await call('GET', `/api/homes/guest/${created.body.token}`);
  assert.equal(afterRevoke.status, 410);
  assert.equal(afterRevoke.body.code, 'SHARE_REVOKED');
  const replay = await call('DELETE', `${passes()}/${created.body.pass.id}`);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.pass.revoked_at, revoked.body.pass.revoked_at);
  console.log('PASS: revocation stops the copied link immediately and retries stay idempotent');

  const denied = await call('POST', `/api/homes/${fixture.id(999)}/guest-passes`, { label: 'Other home' });
  assert.equal(denied.status, 404);
  assert.equal(denied.body.code, 'HOME_NOT_FOUND');
  fixture.denyPermissions(['members.manage']);
  const unauthorized = await call('POST', passes(), { label: 'No authority', kind: 'guest', included_sections: ['parking'] });
  assert.equal(unauthorized.status, 403);
  assert.equal(unauthorized.body.code, 'SHARE_DENIED');
  fixture.restorePermissions();
  fixture.denyPermissions(['access.view_wifi']);
  const wifiDenied = await call('POST', passes(), { label: 'No wifi authority', kind: 'wifi_only', included_sections: ['wifi'] });
  assert.equal(wifiDenied.status, 403);
  assert.equal(wifiDenied.body.code, 'SHARE_RESOURCE_DENIED');
  // A withdrawn wifi grant must also stop an already-issued wifi link.
  const wifiHeld = await call('GET', `/api/homes/guest/${locked.body.token}?passcode=sesame`);
  assert.equal(wifiHeld.status, 403);
  assert.equal(wifiHeld.body.code, 'SHARE_RESOURCE_DENIED');
  fixture.restorePermissions();
  assert.equal((await call('GET', `/api/homes/guest/${locked.body.token}?passcode=sesame`)).status, 200);
  console.log('PASS: a withdrawn grant refuses issuance and retires the links it already backed');

  if (!fixture.real) return;

  // ---- Scoped /shared/:token links: the same lifecycle the guest page has,
  // bound to one exact resource. SQL-backed only; nothing here is transcribed.
  const grant = await call('POST', grants(), { resource_type: 'HomeTask', resource_id: task.id, duration_hours: 24, can_edit: false });
  assert.equal(grant.status, 201, JSON.stringify(grant.body));
  assert.match(grant.body.token, /^[a-f0-9]{64}$/);
  assert.equal(grant.body.grant.token_hash, undefined);
  assert.equal(grant.body.grant.passcode_hash, undefined);
  assert.equal(grant.body.grant.resource_type, 'HomeTask');
  const shared = await call('GET', `/api/homes/shared/${grant.body.token}`);
  assert.equal(shared.status, 200, JSON.stringify(shared.body));
  assert.deepEqual(shared.body.grant, { resource_type: 'HomeTask', can_view: true, can_edit: false, expires_at: grant.body.grant.end_at });
  assert.equal(shared.body.resource.id, task.id);
  assert.equal(shared.body.resource.title, task.title);
  assert.equal(shared.body.resource.description, task.description);
  assert.equal(fixture.sql(`SELECT view_count FROM public."HomeScopedGrant" WHERE id=${fixture.q(grant.body.grant.id)};`), '1');
  assert.equal((await call('GET', `/api/homes/shared/${'0'.repeat(64)}`)).body.code, 'SHARE_NOT_FOUND');
  assert.equal((await call('GET', '/api/homes/shared/not-a-token')).body.code, 'SHARE_INVALID');
  console.log('PASS: a scoped link opens exactly its bound task, counts the view and rejects unknown tokens');

  const grantLocked = await call('POST', grants(), { resource_type: 'HomeTask', resource_id: task.id, duration_hours: 24, can_edit: false, passcode: 'p'.repeat(128) });
  assert.equal(grantLocked.status, 201, JSON.stringify(grantLocked.body));
  assert.equal((await call('POST', grants(), { resource_type: 'HomeTask', resource_id: task.id, duration_hours: 24, can_edit: false, passcode: 'p'.repeat(129) })).body.code, 'SHARE_INVALID');
  const scopedChallenge = await call('GET', `/api/homes/shared/${grantLocked.body.token}`);
  assert.equal(scopedChallenge.status, 403);
  assert.equal(scopedChallenge.body.code, 'SHARE_PASSCODE_REQUIRED');
  assert.equal(scopedChallenge.body.requiresPasscode, true);
  assert.equal((await call('GET', `/api/homes/shared/${grantLocked.body.token}?passcode=${'p'.repeat(20)}`)).body.code, 'SHARE_PASSCODE_REQUIRED');
  assert.equal((await call('GET', `/api/homes/shared/${grantLocked.body.token}?passcode=${'p'.repeat(128)}`)).status, 200);
  console.log('PASS: a scoped passcode up to the API\'s 128 characters challenges, refuses and unlocks');

  const grantLimited = await call('POST', grants(), { resource_type: 'HomeTask', resource_id: task.id, duration_hours: 24, can_edit: false, max_views: 1 });
  assert.equal((await call('GET', `/api/homes/shared/${grantLimited.body.token}`)).status, 200);
  const scopedExhausted = await call('GET', `/api/homes/shared/${grantLimited.body.token}`);
  assert.equal(scopedExhausted.status, 410);
  assert.equal(scopedExhausted.body.code, 'SHARE_VIEW_LIMIT');
  const grantLater = await call('POST', grants(), { resource_type: 'HomeTask', resource_id: task.id, can_edit: false,
    start_at: new Date(Date.now() + 86400_000).toISOString(), duration_hours: 24 });
  const scopedEarly = await call('GET', `/api/homes/shared/${grantLater.body.token}`);
  assert.equal(scopedEarly.status, 403);
  assert.equal(scopedEarly.body.code, 'SHARE_NOT_STARTED');
  const grantLegacy = await call('POST', grants(), { resource_type: 'HomeTask', resource_id: task.id, duration_hours: 24, can_edit: false });
  fixture.demoteToLegacy(grantLegacy.body.grant.id, 'scoped');
  const scopedStale = await call('GET', `/api/homes/shared/${grantLegacy.body.token}`);
  assert.equal(scopedStale.status, 410);
  assert.equal(scopedStale.body.code, 'SHARE_REISSUE_REQUIRED');
  console.log('PASS: scoped view limits, future windows and legacy links return their own codes');

  const grantRevoked = await call('DELETE', `${grants()}/${grant.body.grant.id}`);
  assert.equal(grantRevoked.status, 200, JSON.stringify(grantRevoked.body));
  assert.equal(grantRevoked.body.message, 'Share link revoked');
  const scopedAfterRevoke = await call('GET', `/api/homes/shared/${grant.body.token}`);
  assert.equal(scopedAfterRevoke.status, 410);
  assert.equal(scopedAfterRevoke.body.code, 'SHARE_REVOKED');
  const grantReplay = await call('DELETE', `${grants()}/${grant.body.grant.id}`);
  assert.equal(grantReplay.status, 200);
  assert.equal(grantReplay.body.grant.revoked_at, grantRevoked.body.grant.revoked_at);
  assert.equal((await call('POST', grants(), { resource_type: 'HomeTask', resource_id: task.id, duration_hours: 24, can_edit: true })).body.code, 'SHARE_INVALID');
  assert.equal((await call('POST', grants(), { resource_type: 'HomeEmergency', resource_id: fixture.state.emergency[0].id, duration_hours: 24, can_edit: false })).body.code, 'SHARE_RESOURCE_DENIED');
  fixture.denyPermissions(['tasks.view']);
  const taskHeld = await call('GET', `/api/homes/shared/${grantLocked.body.token}?passcode=${'p'.repeat(128)}`);
  assert.equal(taskHeld.status, 403);
  assert.equal(taskHeld.body.code, 'SHARE_RESOURCE_DENIED');
  assert.equal((await call('POST', grants(), { resource_type: 'HomeTask', resource_id: task.id, duration_hours: 24, can_edit: false })).body.code, 'SHARE_RESOURCE_DENIED');
  fixture.restorePermissions();
  assert.equal((await call('GET', `/api/homes/shared/${grantLocked.body.token}?passcode=${'p'.repeat(128)}`)).status, 200);
  console.log('PASS: scoped revocation is immediate and idempotent; edit grants, foreign resources and withdrawn authority are refused');

  // ---- Emergency info: the real home.js routes over real PostgREST. The GET
  // rows carry `type`/`label`/`location`/`details` (jsonb object) and the
  // `info_type`/`location_in_home` aliases, never `category`/`title`/`phone`.
  const listedEmergencies = await call('GET', emergencies());
  assert.equal(listedEmergencies.status, 200, JSON.stringify(listedEmergencies.body));
  assert.equal(listedEmergencies.body.emergencies.length, 2);
  for (const row of listedEmergencies.body.emergencies) {
    const seededRow = fixture.state.emergency.find(item => item.id === row.id);
    assert(seededRow, 'unexpected emergency row');
    assert.equal(row.type, seededRow.type); assert.equal(row.info_type, seededRow.type);
    assert.equal(row.label, seededRow.label); assert.equal(row.location, seededRow.location);
    assert.equal(row.location_in_home, seededRow.location);
    assert.equal(typeof row.details, 'object'); assert.notEqual(row.details, null);
    for (const absent of ['category', 'title', 'phone']) assert.equal(absent in row, false, `${absent} is not a HomeEmergency field`);
  }
  assert.equal((await call('GET', emergencies(), undefined, { 'x-fixture-actor': fixture.id(998) })).status, 403);
  console.log('PASS: emergency rows expose the real HomeEmergency fields and refuse a non-member');

  // Both native Add Emergency forms send their form category as `type`;
  // migration 20260916011000 admits those six (the constraint refused them and
  // the route answered 500 before). A value outside the constraint is still the
  // caller's error, reported with a stable code rather than an internal failure.
  for (const type of NATIVE_FORM_TYPES) {
    const saved = await call('POST', emergencies(), { type, label: `Native ${type}` });
    assert.equal(saved.status, 201, `${type}: ${JSON.stringify(saved.body)}`);
    assert.equal(saved.body.emergency.type, type);
  }
  const refused = await call('POST', emergencies(), { type: 'shutoff', label: 'Web category id' });
  assert.equal(refused.status, 400, JSON.stringify(refused.body));
  assert.equal(refused.body.code, 'INVALID_EMERGENCY_TYPE');
  assert.equal((await call('POST', emergencies(), { type: 'shutoff_gas' })).status, 400);
  assert.equal((await call('POST', emergencies(), { type: 'shutoff_gas', label: 'Gas valve' }, { 'x-fixture-actor': fixture.id(998) })).status, 403);
  const baseCount = 2 + NATIVE_FORM_TYPES.length;
  assert.equal((await call('GET', emergencies())).body.emergencies.length, baseCount);
  console.log('PASS: the six native form categories save; an unsupported type is a 400 with a stable code; a non-member cannot create one');

  const createdEmergency = await call('POST', emergencies(), { type: 'shutoff_gas', label: 'Gas valve', location: 'Behind the dryer', details: { notes: 'Turn clockwise', phone: '+1 555 0100' } });
  assert.equal(createdEmergency.status, 201, JSON.stringify(createdEmergency.body));
  const emergencyId = createdEmergency.body.emergency.id;
  assert.equal(createdEmergency.body.emergency.type, 'shutoff_gas');
  assert.equal(createdEmergency.body.emergency.info_type, 'shutoff_gas');
  assert.deepEqual(createdEmergency.body.emergency.details, { notes: 'Turn clockwise', phone: '+1 555 0100' });
  assert.equal((await call('GET', emergencies())).body.emergencies.length, baseCount + 1);
  const removed = await call('DELETE', `${emergencies()}/${emergencyId}`);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal((await call('GET', emergencies())).body.emergencies.some(row => row.id === emergencyId), false);
  assert.equal((await call('DELETE', `${emergencies()}/${emergencyId}`)).status, 404);
  assert.equal((await call('DELETE', `${emergencies()}/${fixture.state.emergency[0].id}`, undefined, { 'x-fixture-actor': fixture.id(998) })).status, 403);
  assert.equal((await call('DELETE', `/api/homes/${fixture.id(999)}/emergencies/${fixture.state.emergency[0].id}`)).status, 403);
  assert.equal((await call('GET', emergencies())).body.emergencies.length, baseCount);
  console.log('PASS: a canonical emergency entry is created with its details and removed exactly once');

  // ---- Shared documents: a real upload through the production route and
  // local Supabase Storage, then the receipt-bound download through both link
  // kinds. Storage here is the disposable project's own Storage service.
  const bytes = Buffer.from(`Shared document fixture bytes ${crypto.randomUUID()}\n`);
  const uploaded = await uploadDocument(bytes, 'Fixture document');
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
  const documentId = uploaded.body.document.id;
  assert.equal(await uploadDocument(bytes, 'Fixture document').then(r => r.status), 201);
  const docGrant = await call('POST', grants(), { resource_type: 'HomeDocument', resource_id: documentId, duration_hours: 24, can_edit: false });
  assert.equal(docGrant.status, 201, JSON.stringify(docGrant.body));
  const docView = await call('GET', `/api/homes/shared/${docGrant.body.token}`);
  assert.equal(docView.status, 200, JSON.stringify(docView.body));
  assert.equal(docView.body.resource.id, documentId);
  assert.equal(docView.body.resource.title, 'Fixture document');
  assert.equal(docView.body.resource._document, undefined);
  assert.equal(docView.body.resource.storage_path, undefined);
  assert.match(docView.body.resource.url, new RegExp(`^/api/homes/shared-documents/[a-f0-9]{64}/${documentId}$`));
  const download = await raw(docView.body.resource.url);
  assert.equal(download.status, 200, download.bytes.toString('utf8'));
  assert.equal(download.bytes.equals(bytes), true);
  assert.match(download.type, /^text\/plain/);
  assert.match(download.disposition, /^attachment/);
  assert.match(download.cache, /no-store/);
  const spent = await raw(docView.body.resource.url);
  assert.equal(spent.status, 403);
  assert.equal(spent.json().code, 'SHARE_DENIED');
  console.log('PASS: a scoped document link downloads the exact uploaded bytes once per read receipt');

  const docViewAgain = await call('GET', `/api/homes/shared/${docGrant.body.token}`);
  assert.equal((await raw(docViewAgain.body.resource.url)).status, 200);
  const docViewHeld = await call('GET', `/api/homes/shared/${docGrant.body.token}`);
  assert.equal((await call('DELETE', `${grants()}/${docGrant.body.grant.id}`)).status, 200);
  const heldAfterRevoke = await raw(docViewHeld.body.resource.url);
  assert.equal(heldAfterRevoke.status, 410);
  assert.equal(heldAfterRevoke.json().code, 'SHARE_REVOKED');
  console.log('PASS: a receipt issued before revocation cannot download after it');

  const docPass = await call('POST', passes(), { label: 'Document pass', kind: 'guest',
    included_sections: ['parking', `doc:${documentId}`], duration_hours: 24 });
  assert.equal(docPass.status, 201, JSON.stringify(docPass.body));
  const passView = await call('GET', `/api/homes/guest/${docPass.body.token}`);
  assert.equal(passView.status, 200, JSON.stringify(passView.body));
  assert.equal(passView.body.sections.docs.length, 1);
  assert.equal(passView.body.sections.docs[0].id, documentId);
  assert.equal(passView.body.sections.docs[0]._document, undefined);
  const passDownload = await raw(passView.body.sections.docs[0].url);
  assert.equal(passDownload.status, 200, passDownload.bytes.toString('utf8'));
  assert.equal(passDownload.bytes.equals(bytes), true);
  fixture.denyPermissions(['docs.view']);
  const docsHeld = await call('GET', `/api/homes/guest/${docPass.body.token}`);
  assert.equal(docsHeld.status, 403);
  assert.equal(docsHeld.body.code, 'SHARE_RESOURCE_DENIED');
  fixture.restorePermissions();
  assert.equal((await call('GET', `/api/homes/guest/${docPass.body.token}`)).status, 200);
  console.log('PASS: a guest pass delivers its bound document and a withdrawn docs grant retires the link');
}

// A failed assertion must not leave the listening server holding the event
// loop, and must never strand fixture rows or objects in the owned project.
main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    if (server && serveIndex < 0) server.close();
    if (container && serveIndex < 0 && !cleanupOnly) {
      try {
        const objects = fixture.real ? await fixture.cleanupStorage() : 0;
        const remaining = fixture.cleanup();
        assert.deepEqual({ ...remaining, objects }, { passes: 0, views: 0, audits: 0, grants: 0, receipts: 0, tasks: 0,
          emergencies: 0, documents: 0, files: 0, homes: 0, users: 0, objects: 0 });
        console.log('PASS: the owned fixture rows and objects are removed and counted back to zero');
      } catch (error) { console.error(error); process.exitCode = 1; }
    }
  });
