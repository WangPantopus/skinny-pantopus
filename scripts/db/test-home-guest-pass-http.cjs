// Baseline for the browser guest-pass journey: real homeIam/homeGuest routers
// and the real share service over actual HTTP. Run with `--serve <port>` to
// hold the same server open for the browser journey.
// Synthetic: authentication, and (without a container) the share RPC contract.
const assert = require('node:assert/strict');

// `--container <name>` runs the share RPCs as actual SQL in this stream's own
// disposable replay project. Without it the fixture uses its transcription of
// the frozen contract, which is route/service/UI evidence only.
const containerIndex = process.argv.indexOf('--container');
const container = containerIndex > 0 ? process.argv[containerIndex + 1] : null;
const fixture = require('./home-guest-pass-http-fixture.cjs')({ container });

const serveIndex = process.argv.indexOf('--serve');
const port = serveIndex > 0 ? Number(process.argv[serveIndex + 1]) : 0;

let server = null;

async function main() {
  if (container) fixture.seed();
  server = await new Promise(resolve => {
    const created = fixture.app.listen(port, '127.0.0.1', () => resolve(created));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body) => {
    const response = await fetch(`${base}${url}`, {
      method, headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    return { status: response.status, body: await response.json() };
  };
  const passes = () => `/api/homes/${fixture.homeId}/guest-passes`;

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
    console.log(JSON.stringify({ ready: true, port: server.address().port, tokens: {
      seeded: seeded.body.token, locked: locked.body.token, limited: limited.body.token,
      later: later.body.token, legacy: legacy.body.token,
    } }));
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

  if (container) {
    const remaining = fixture.cleanup();
    assert.deepEqual(remaining, { passes: 0, views: 0, audits: 0, homes: 0, users: 0 });
    console.log('PASS: the owned fixture rows are removed and counted back to zero');
  }
}

// A failed assertion must not leave the listening server holding the event loop.
main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => { if (server && serveIndex < 0) server.close(); });
