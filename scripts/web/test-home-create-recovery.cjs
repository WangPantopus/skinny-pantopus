#!/usr/bin/env node
// Owned browser -> production Home creation/list routes -> SDK/PostgREST/SQL.
// Uses the loopback creation fixture; external/provider/message boundaries stay controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { chromium, expect } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, fixture, evidence, resume] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(fixture || '', /^http:\/\/127\.0\.0\.1:1808[3-9]$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const street = '9141 Home Creation Fixture Way';
const secret = ' Private browser fixture password ';
const events = [], errors = [];
let context, page;
async function control(action, body) {
  const response = await fetch(`${fixture}/fixture/${action}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, 200); return response.json();
}
async function saved(name) {
  fs.writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(await control('state'), null, 2), { mode: 0o600 });
  await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No narrow horizontal overflow');
}
const home = (state, unit) => {
  const matches = state.database.homes.filter(h => h.unit === unit); assert.equal(matches.length, 1); return matches[0];
};
async function open() { await page.goto(base + '/app/homes/new', { waitUntil: 'domcontentloaded', timeout: 120000 }); }
async function form(unit, incomplete = false) {
  await expect(page.getByRole('heading', { name: 'Where is your home?' })).toBeVisible();
  await page.getByRole('combobox').fill(street);
  await page.getByRole('option', { name: new RegExp(street) }).click();
  await page.getByLabel('Unit or apartment', { exact: true }).fill(unit);
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tell us about your home' })).toBeVisible();
  await page.getByLabel('Home nickname', { exact: true }).fill('Browser private Home');
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await page.getByLabel('Network name (SSID)', { exact: true }).fill('Browser fixture network');
  if (incomplete) {
    await page.getByRole('button', { name: 'Review →', exact: true }).click();
    await expect(page.getByText('Enter both a network name and password, or leave both blank.')).toBeVisible();
    await saved(unit + '-incomplete-wifi-recovery');
  }
  await page.getByLabel('Wi-Fi password', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Review →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review your home' })).toBeVisible();
}
async function until(flag) { await expect.poll(async () => (await control('state'))[flag], { timeout: 30000 }).toBe(true); }
async function encrypted() {
  const proof = await page.evaluate(async ({ street, secret }) => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('pantopus-private-task-recovery');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Recovery store unavailable')); });
    const values = await new Promise((resolve, reject) => { const request = db.transaction('drafts').objectStore('drafts').getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Recovery values unavailable')); });
    const keys = await new Promise((resolve, reject) => { const request = db.transaction('keys').objectStore('keys').getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Recovery key unavailable')); });
    db.close();
    return { count: values.length, sealed: values.every(v => v.ciphertext instanceof ArrayBuffer && v.iv.byteLength === 12
      && !new TextDecoder().decode(v.ciphertext).includes(secret) && !JSON.stringify(v).includes(street)),
      nonexportable: keys.every(k => k instanceof CryptoKey && !k.extractable) };
  }, { street, secret });
  assert.equal(proof.count, 1); assert(proof.sealed && proof.nonexportable);
}
async function noPending() {
  const count = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('pantopus-private-task-recovery');
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new Error('Recovery unavailable')); });
    const keys = await new Promise((resolve, reject) => { const r = db.transaction('drafts').objectStore('drafts').getAllKeys();
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new Error('Recovery keys unavailable')); });
    db.close(); return keys.filter(k => typeof k === 'string' && k.includes('home-create-v1')).length;
  });
  assert.equal(count, 0, 'UI acknowledgement consumes the original protected command');
}
async function currentHomes(unit, owner = true) {
  await expect(page.getByRole('heading', { name: 'Your Home was saved', exact: true })).toBeVisible();
  const h = home(await control('state'), unit);
  assert.equal(h.secrets, 1); assert.equal(h.occupancies, 1); assert.equal(h.preferences, 1);
  assert.equal(h.pending_owners, owner ? 1 : 0); assert.equal(h.verified_occupancies, 0); assert.equal(h.owner_id, null);
  await page.getByRole('button', { name: 'Open My Homes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Homes', exact: true })).toBeVisible();
  await expect(page.getByText('Unit ' + unit, { exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/app/homes/${h.id}/tasks"]`).filter({ hasText: 'My tasks' })).toBeVisible();
  await noPending();
  return h;
}
async function main() {
  try {
    context = await chromium.launchPersistentContext(path.join(evidence, 'browser-profile'), { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: 'pantopus_session', value: '1', url: base },
      { name: 'pantopus_access', value: 'synthetic-loopback-session', url: base, httpOnly: true }]);
    await context.route('**/*', async route => {
      const request = route.request(), parsed = new URL(request.url()), endpoint = parsed.pathname;
      if (parsed.origin !== base) return route.abort();
      if (!endpoint.startsWith('/api/')) return endpoint.startsWith('/socket.io/') ? route.fulfill({ status: 503, body: '' }) : route.continue();
      try {
        let body, status = 200;
        if (endpoint.startsWith('/api/geo/') || endpoint.startsWith('/api/v1/address/') || endpoint === '/api/homes'
          || endpoint === '/api/homes/my-homes' || endpoint === '/api/homes/primary' || endpoint.startsWith('/api/homes/create-commands/')
          || endpoint === '/api/homes/check-address' || endpoint === '/api/homes/property-suggestions' || endpoint === '/api/users/profile') {
          const response = await fetch(fixture + endpoint + parsed.search, { method: request.method(),
            headers: { Authorization: 'Bearer pantopus-synthetic-entry-loopback-only', 'Content-Type': 'application/json' },
            body: request.postData() || undefined, signal: AbortSignal.timeout(120000) });
          status = response.status; body = await response.json(); events.push({ endpoint, method: request.method(), status });
        } else if (endpoint.includes('claims')) body = { claims: [] };
        else if (endpoint.includes('conversations')) body = { conversations: [], hasMore: false };
        else if (endpoint.includes('unread') || endpoint.includes('badge')) body = { count: 0, unreadCount: 0, total: 0, byContext: {} };
        else if (endpoint.includes('business')) body = { businesses: [], seats: [] };
        else if (endpoint.includes('homes')) body = { homes: [], entries: [], invitations: [] };
        else body = {};
        await route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(body) }).catch(() => {});
      } catch (error) {
        if (error.name !== 'TimeoutError' && !String(error.message).includes('closed')) errors.push(error.message);
        await route.abort().catch(() => {});
      }
    });
    page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
    if (resume === 'storage-unavailable') {
      const before = (await control('state')).events.length;
      await page.addInitScript(() => {
        const original = indexedDB.open.bind(indexedDB);
        indexedDB.open = () => { throw new DOMException('Synthetic storage unavailable', 'SecurityError'); };
        window.fixtureRestoreStorage = () => { indexedDB.open = original; };
      });
      await open();
      await expect(page.getByText('Protected Home recovery could not be opened.', { exact: false })).toBeVisible();
      await expect(page.getByRole('combobox')).toHaveCount(0);
      await saved('storage-unavailable-blocks-submission');
      await page.evaluate(() => window.fixtureRestoreStorage());
      await page.getByRole('button', { name: 'Reopen recovery', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Where is your home?' })).toBeVisible();
      await saved('storage-restored-without-new-command');
      assert.equal((await control('state')).events.slice(before).filter(e => e.event === 'request' && e.path === '/api/homes' && e.method === 'POST').length, 0);
      assert.deepEqual(errors, []);
      console.log('PASS: unavailable protected storage blocks new Home submission and restored storage reopens the ordinary form'); return;
    }
    if (resume === 'terminal-save-failure') {
      await open(); await form('505');
      const before = (await control('state')).events.length;
      await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        let writes = 0;
        IDBObjectStore.prototype.put = function(value, key) {
          if (this.name === 'drafts' && typeof key === 'string' && key.includes('home-create-v1') && ++writes === 2) {
            throw new DOMException('Synthetic protected proof write failure', 'QuotaExceededError');
          }
          return original.call(this, value, key);
        };
      });
      await page.getByRole('button', { name: '✅ Create Home', exact: true }).click();
      await expect(page.getByText('The original Home request could not be saved.', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open My Homes', exact: true })).toHaveCount(0);
      await saved('505-observed-completion-needs-protected-write');
      await page.getByRole('button', { name: 'Retry original request', exact: true }).click();
      await currentHomes('505'); await saved('505-protected-proof-repaired-without-repost');
      assert.equal((await control('state')).events.slice(before).filter(e => e.event === 'request' && e.path === '/api/homes' && e.method === 'POST').length, 1);
      assert.deepEqual(errors, []);
      console.log('PASS: actual IndexedDB terminal-write refusal keeps the original command and repairs its proof without a second POST'); return;
    }
    if (resume === 'renter-only') {
      const before = (await control('state')).events.length;
      await open(); await form('504');
      await page.getByRole('button', { name: '← Back', exact: true }).click();
      await page.getByRole('button', { name: '🔑 Renter / Tenant', exact: true }).click();
      await page.getByRole('button', { name: 'Review →', exact: true }).click();
      await page.getByRole('button', { name: '✅ Create Home', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Your Home was saved', exact: true })).toBeVisible();
      await expect(page.getByText('Renter · Check verification in My Homes', { exact: true })).toBeVisible();
      await saved('504-renter-recovery-without-owner-claim');
      await currentHomes('504', false); await saved('504-current-private-renter-tasks');
      assert.equal((await control('state')).events.slice(before).filter(e => e.event === 'request' && e.path === '/api/homes' && e.method === 'POST').length, 1);
      assert.deepEqual(errors, []);
      console.log('PASS: explicit renter creation retains its role, needs residency verification and opens current private Tasks without an ownership claim');
      return;
    }
    if (!resume) {
    await open(); await form('502', true);
    await control('mode', { mode: 'hold_provider' });
    await page.getByRole('button', { name: '✅ Create Home', exact: true }).click(); await until('held_provider'); await encrypted();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Cancel original request', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Home request cancelled', exact: true })).toBeVisible();
    await control('mode', { mode: 'current' }); await control('release-provider', {});
    assert(!(await control('state')).database.homes.some(h => h.unit === '502'));
    await saved('502-confirmed-cancellation-fences-worker');
    await page.getByRole('button', { name: 'Edit original details', exact: true }).click();
    await expect(page.getByLabel('Unit or apartment', { exact: true })).toHaveValue('502');
    await open(); await form('501');
    const before = (await control('state')).events.length;
    await control('hold', { suffix: '/api/homes' });
    await page.getByRole('button', { name: '✅ Create Home', exact: true }).click(); await until('held'); await encrypted();
    const firstHome = home(await control('state'), '501');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your Home was saved', exact: true })).toBeVisible();
    await control('release', {}); await saved('501-reload-recovers-original-completion');
    assert.equal((await currentHomes('501')).id, firstHome.id); await saved('501-current-private-tasks');
    assert.equal((await control('state')).events.slice(before).filter(e => e.event === 'request' && e.path === '/api/homes' && e.method === 'POST').length, 1);
    } else {
      assert.equal(resume, 'after-lost-reply');
      const savedState = await control('state');
      assert.equal(savedState.database.commands.length, 2); assert.equal(savedState.database.homes.length, 1);
      assert(savedState.database.commands.some(c => c.state === 'completed'));
      assert(savedState.database.commands.some(c => c.state === 'cancelled'));
    }
    await open(); await form('503'); await control('reject-next-access', {});
    await page.getByRole('button', { name: '✅ Create Home', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review your Home request', exact: true })).toBeVisible();
    assert(!(await control('state')).database.homes.some(h => h.unit === '503')); await saved('503-atomic-setup-refusal');
    await control('restore-age', {});
    await page.getByRole('button', { name: 'Edit original details', exact: true }).click();
    await expect(page.getByLabel('Unit or apartment', { exact: true })).toHaveValue('503');
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tell us about your home' })).toBeVisible();
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    await expect(page.getByLabel('Network name (SSID)', { exact: true })).toHaveValue('Browser fixture network');
    await expect(page.getByLabel('Wi-Fi password', { exact: true })).toHaveValue(secret);
    await page.getByRole('button', { name: 'Review →', exact: true }).click();
    await page.getByRole('button', { name: '✅ Create Home', exact: true }).click();
    await currentHomes('503'); await saved('503-corrected-setup-and-distinct-units');
    await expect(page.getByText('Unit 501', { exact: true })).toBeVisible();
    const final = await control('state');
    assert.equal(final.database.commands.length, 4); assert.equal(final.database.homes.length, 2);
    assert.equal(final.database.commands.filter(c => c.state === 'cancelled').length, 1);
    assert.equal(final.database.commands.filter(c => c.state === 'rejected').length, 1);
    assert.equal(final.events.filter(e => e.event === 'fixture_error').length, 0);
    assert.deepEqual(errors, []);
    console.log('PASS: real browser encrypted original creation, reload/cancel fencing, lost reply, atomic refusal/correction and current private unit cards');
  } finally {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, 'final.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(evidence, 'browser-events.json'), JSON.stringify({ events, errors }, null, 2), { mode: 0o600 });
    await context?.close();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
