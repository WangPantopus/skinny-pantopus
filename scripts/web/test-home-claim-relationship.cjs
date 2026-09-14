#!/usr/bin/env node
// Actual Chrome + production relationship HTTP/read/write services + local SQL.
// Identity, comparison-list shape and unrelated shell replies are synthetic.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const { chromium, expect } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, container, evidence] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const f = require('../db/home-claim-relationship-http-fixture.cjs')(container);
const { actor, other, home, claims, sql, q } = f;
let server, browser, context, page, initialized = false, currentActor = actor, heldRead = null, releaseRead = null;
const posts = [], errors = [], consoleDiagnostics = [];
const listPath = `/app/homes/${home}/owners/review-claim`;
const recovery = `${base}${listPath}/relationship`;
const url = (claim, action = 'decline_relationship') => `${recovery}?claimId=${claim}&action=${action}`;
const rows = () => Number(sql(`SELECT count(*) FROM public."HomeClaimRelationshipReceipt" WHERE home_id=${q(home)};`));
async function stored(target = page) {
  return target.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('pantopus-private-task-recovery'); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    const read = (store, key) => new Promise((resolve, reject) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    const keys = await new Promise(resolve => { const r = db.transaction('drafts').objectStore('drafts').getAllKeys(); r.onsuccess = () => resolve(r.result); });
    const result = [];
    for (const slot of keys.filter(key => JSON.parse(key)[0] === 'claim-relationship')) {
      const sealed = await read('drafts', slot), key = await read('keys', 'claim-relationship-v1');
      const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: new TextEncoder().encode(`pantopus-claim-relationship-v1:${slot}`) }, key, sealed.ciphertext);
      const draft = JSON.parse(new TextDecoder().decode(data));
      result.push({ slot, draft, extractable: key.extractable, encrypted: !new TextDecoder().decode(sealed.ciphertext).includes(draft.command.request_id) });
    }
    db.close(); return result;
  });
}
async function visibility(hidden) {
  // Deterministic lifecycle event; not an OS suspension claim.
  await page.evaluate(value => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: value ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);
}
function holdNextRead() {
  let arrived; const reached = new Promise(resolve => { arrived = resolve; });
  const released = new Promise(resolve => { releaseRead = resolve; }); heldRead = { arrived, released };
  return async () => { let timer; try { await Promise.race([reached, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Relationship preflight was not reached')), 30000); })]); } finally { clearTimeout(timer); } };
}
async function main() {
  try {
    f.setup(); initialized = true;
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const apiBase = `http://127.0.0.1:${server.address().port}`;
    const actual = async (endpoint, method, original, headers = {}) => {
      const response = await fetch(apiBase + endpoint, { method, headers: { 'content-type': 'application/json', 'x-fixture-actor': currentActor, ...headers },
        ...(original ? { body: JSON.stringify(original) } : {}), signal: AbortSignal.timeout(15000) });
      return { status: response.status, body: await response.json() };
    };
    const relationshipEndpoint = claim => `/api/homes/${home}/ownership-claims/${claim}`;
    // A changed HTTP-only account/session cannot submit through the old screen.
    const review = await actual(relationshipEndpoint(claims[0]) + '/relationship-decision', 'GET');
    assert.equal(review.status, 200);
    const changed = await actual(relationshipEndpoint(claims[0]) + '/resolve-relationship', 'POST', { action: 'decline_relationship' }, { 'x-pantopus-session-scope': 'a'.repeat(64) });
    assert.equal(changed.status, 409); assert.equal(changed.body.code, 'SESSION_SCOPE_CHANGED'); assert.equal(rows(), 0);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    context = await browser.newContext({ viewport: { width: 1100, height: 950 } });
    await context.addCookies([{ name: 'pantopus_session', value: '1', url: base }, { name: 'pantopus_access', value: 'synthetic-local-session', url: base, httpOnly: true }]);
    await context.route('**/*', async route => {
      const request = route.request(), parsed = new URL(request.url()), endpoint = parsed.pathname, method = request.method();
      if (parsed.origin !== base) return route.abort();
      if (!endpoint.startsWith('/api/')) return endpoint.startsWith('/socket.io/') ? route.fulfill({ status: 503, body: '' }) : route.continue();
      let body = {}, status = 200;
      try {
        if (endpoint === '/api/users/profile') body = { user: { id: currentActor, username: 'synthetic', name: 'Browser fixture', account_type: 'personal', email_verified: true } };
        else if (endpoint.endsWith('/relationship-decision') || endpoint.endsWith('/resolve-relationship')) {
          if (method === 'GET' && heldRead) { const hold = heldRead; heldRead = null; hold.arrived(); await hold.released; }
          const original = method === 'POST' ? request.postDataJSON() : null;
          if (original) posts.push(original);
          const response = await actual(endpoint, method, original, { ...(request.headers()['x-pantopus-session-scope'] ? { 'x-pantopus-session-scope': request.headers()['x-pantopus-session-scope'] } : {}) });
          body = response.body; status = response.status;
          if (original) console.log('HTTP relationship', posts.length, status, body.code || 'receipt');
        } else if (endpoint === `/api/homes/${home}/ownership-claims` || endpoint.endsWith('/ownership-claims/compare')) {
          const all = claims.map(claim => f.rpc('get_home_claim_review', { p_home_id: home, p_claim_id: claim, p_actor_id: currentActor, p_platform_admin: false }));
          if (all.some(r => !r.ok)) { status = 403; body = { error: 'Current access denied' }; }
          else body = { claims: all.map(r => ({ ...r.claim, claimant: { masked: true } })), incumbent: { has_verified_owner: true } };
        } else if (endpoint.endsWith('/claims')) body = { claims: [] };
        else if (endpoint.includes('conversations')) body = { conversations: [], hasMore: false };
        else if (endpoint.includes('unread') || endpoint.includes('badge')) body = { count: 0, unreadCount: 0, total: 0, byContext: {} };
        else if (endpoint.includes('business')) body = { businesses: [], seats: [] };
        else if (endpoint.includes('homes')) body = { homes: [] };
      } catch (error) { status = 503; body = { error: error.message }; }
      await route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(body) }).catch(() => {});
    });
    page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleDiagnostics.push(message.text()); });
    const screenshot = async name => { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true }); };
    const prepare = async (target = page, note = 'Reviewed original note') => {
      await target.getByLabel('Private review note (optional)', { exact: true }).fill(note);
      await target.getByRole('checkbox').check();
    };
    const save = target => target.getByRole('button', { name: 'Save relationship decision', exact: true });
    const confirmed = target => target.getByRole('heading', { name: 'Original decision confirmed', exact: true });
    const retry = target => target.getByRole('button', { name: 'Retry original decision', exact: true });
    const ack = target => target.getByRole('button', { name: 'I reviewed this confirmation', exact: true });
    await page.goto(base + listPath, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'Continue review', exact: true }).first().click();
    await page.getByRole('region', { name: 'Current claim' }).waitFor();
    assert(page.url().includes(claims[0])); assert.equal(posts.length, 0); assert(await save(page).isDisabled());
    await page.getByText('deed — Not verified for review', { exact: true }).waitFor();
    await prepare(); await page.getByLabel('Household response', { exact: true }).selectOption('flag_unknown_person');
    assert(await save(page).isDisabled()); await page.getByLabel('Household response', { exact: true }).selectOption('decline_relationship');
    await page.getByRole('checkbox').check(); await screenshot('01-reviewed-decline');
    // First-use key initialization failure also blocks the request and stays retryable.
    await page.evaluate(() => { window.initialKeyPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'keys' && key === 'claim-relationship-v1') throw new DOMException('Synthetic key quota failure', 'QuotaExceededError');
      return window.initialKeyPut.call(this, value, key); }; });
    await save(page).click(); await page.getByRole('alert').filter({ hasText: 'could not be initialized' }).waitFor();
    assert.equal(posts.length, 0); assert.equal(rows(), 0); assert.equal((await stored()).length, 0);
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.initialKeyPut; delete window.initialKeyPut; });
    f.loseNextReply(); await save(page).click(); await retry(page).waitFor(); assert.equal(rows(), 1);
    const original = structuredClone(posts[0]); let saved = (await stored())[0]; assert(saved.encrypted && !saved.extractable); assert.deepEqual(saved.draft.command, original);
    sql(`UPDATE public."HomeOwnershipClaim" SET state='rejected',claim_phase_v2='rejected',terminal_reason='rejected_review' WHERE id=${q(claims[0])};`);
    await screenshot('02-unknown-original-retained');
    await page.goto(base + listPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Continue review', exact: true })).toHaveCount(2);
    await page.getByRole('link', { name: 'Relationship decisions and recovery', exact: true }).click();
    await retry(page).click(); await confirmed(page).waitFor(); assert.deepEqual(posts[1], original); assert.equal(rows(), 1);
    await page.getByRole('region', { name: 'Current claim' }).getByText('owner claim · rejected', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' }); await confirmed(page).waitFor(); assert.equal(posts.length, 2);
    await screenshot('03-confirmed-original-current-rejection');
    await ack(page).click(); await expect(confirmed(page)).toHaveCount(0); assert.equal((await stored()).length, 0); assert.equal(await save(page).count(), 0);
    console.log('PASS: normal claim entry, explicit review, encrypted lost-response recovery after leaving pending list, current later rejection and cold confirmation/ack');
    await page.goto(url(claims[1], 'flag_unknown_person'), { waitUntil: 'domcontentloaded' }); await prepare();
    sql(`UPDATE public."HomeOwnershipClaim" SET updated_at=clock_timestamp() WHERE id=${q(claims[1])};`);
    await save(page).click(); await page.getByRole('button', { name: 'Review current claim again', exact: true }).click();
    assert.equal(rows(), 1); assert.equal((await stored()).length, 0); assert(!(await page.getByRole('checkbox').isChecked()));
    assert.equal(await page.getByLabel('Private review note (optional)', { exact: true }).inputValue(), '');
    console.log('PASS: stale displayed claim prevents a decision; deliberate acknowledgement reloads review');
    await prepare(page, 'First competing original');
    const sibling = await context.newPage(); await sibling.goto(url(claims[1], 'flag_unknown_person'), { waitUntil: 'domcontentloaded' }); await prepare(sibling, 'Second competing original');
    f.loseNextReply(); await save(page).click(); await retry(page).waitFor(); const count = posts.length;
    await save(sibling).click(); await sibling.getByRole('alert').waitFor(); assert.equal(posts.length, count);
    await sibling.reload({ waitUntil: 'domcontentloaded' }); await retry(sibling).click(); await confirmed(sibling).waitFor();
    assert.equal(rows(), 2); assert.deepEqual(posts.at(-1), posts.at(-2)); await sibling.close();
    await page.reload({ waitUntil: 'domcontentloaded' }); await confirmed(page).waitFor();
    await page.getByText('The original flag entered admin review.', { exact: true }).waitFor();
    assert.equal(sql(`SELECT challenge_state FROM public."HomeOwnershipClaim" WHERE id=${q(claims[1])};`), 'none');
    console.log('PASS: competing tabs retain one original; pending deed enters admin review without creating a property dispute');
    const prior = posts.length;
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.getByRole('button', { name: 'Reload current access', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Current claim' }).count(), 0); assert.equal(await page.getByText('Original note: First competing original', { exact: true }).count(), 0);
    sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.getByRole('button', { name: 'Reload current access', exact: true }).click(); await confirmed(page).waitFor();
    currentActor = other; await page.evaluate(() => { localStorage.setItem('pantopus_auth_session_change', 'changed'); window.dispatchEvent(new Event('focus')); });
    await page.getByRole('button', { name: 'Reload current access', exact: true }).waitFor(); assert.equal(posts.length, prior);
    assert.equal(await page.getByText('Original note: First competing original', { exact: true }).count(), 0);
    currentActor = actor; await page.getByRole('button', { name: 'Reload current access', exact: true }).click(); await confirmed(page).waitFor();
    const corruptSlot = (await stored())[0].slot;
    const envelope = await page.evaluate(async slot => {
      const db = await new Promise(resolve => { const r = indexedDB.open('pantopus-private-task-recovery'); r.onsuccess = () => resolve(r.result); });
      const t = db.transaction('drafts', 'readwrite'), s = t.objectStore('drafts'); let original;
      const r = s.get(slot); r.onsuccess = () => { const v = r.result; original = { ...v, iv: Array.from(new Uint8Array(v.iv)), ciphertext: Array.from(new Uint8Array(v.ciphertext)) };
        const damaged = new Uint8Array(v.ciphertext.slice(0)); damaged[0] ^= 1; s.put({ ...v, ciphertext: damaged.buffer }, slot); };
      await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = reject; }); db.close(); return original;
    }, corruptSlot);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('alert').filter({ hasText: 'could not be read' }).waitFor();
    assert.equal(await save(page).count(), 0); assert.equal(await retry(page).count(), 0); assert.equal(posts.length, prior);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('alert').filter({ hasText: 'could not be read' }).waitFor();
    await page.evaluate(async ({ slot, envelope }) => {
      const db = await new Promise(resolve => { const r = indexedDB.open('pantopus-private-task-recovery'); r.onsuccess = () => resolve(r.result); });
      const t = db.transaction('drafts', 'readwrite'); t.objectStore('drafts').put({ ...envelope, iv: new Uint8Array(envelope.iv).buffer, ciphertext: new Uint8Array(envelope.ciphertext).buffer }, slot);
      await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = reject; }); db.close();
    }, { slot: corruptSlot, envelope });
    await page.goto(url(claims[2], 'flag_unknown_person'), { waitUntil: 'domcontentloaded' }); await confirmed(page).waitFor();
    await page.getByText('Finish this saved decision before reviewing another claim.', { exact: true }).waitFor();
    assert.equal((await stored())[0].draft.claim_id, claims[1]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.locator('header').first().evaluate(e => e.getBoundingClientRect().left)).toBe(0);
    await expect.poll(() => page.getByRole('main', { name: 'Claimant relationship review' }).evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThan(360);
    await screenshot('04-narrow-recovered-confirmation');
    await ack(page).click();
    console.log('PASS: revoked/account-changed screens hide claim and receipt; ciphertext corruption fails closed; restored original blocks replacing it with another claim');
    await page.goto(url(claims[2], 'flag_unknown_person'), { waitUntil: 'domcontentloaded' }); await prepare(page, 'Reviewed verified claimant');
    await page.getByText('title match — Verified for review', { exact: true }).waitFor();
    await screenshot('05-narrow-verified-review');
    await page.evaluate(() => { window.originalFixturePut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'drafts' && typeof key === 'string' && JSON.parse(key)[0] === 'claim-relationship') throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      return window.originalFixturePut.call(this, value, key); }; });
    await save(page).click(); await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.equal(posts.length, prior); assert.equal((await stored()).length, 0);
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.originalFixturePut; delete window.originalFixturePut; });
    const reached = holdNextRead(); await save(page).click(); await reached(); await visibility(true);
    await expect(page.getByRole('region', { name: 'Current claim' })).toHaveCount(0);
    releaseRead(); releaseRead = null; await visibility(false); await retry(page).waitFor(); assert.equal(posts.length, prior);
    const heldOriginal = (await stored())[0].draft;
    const reachedAgain = holdNextRead(); await retry(page).click(); await reachedAgain();
    currentActor = other; await page.evaluate(() => { localStorage.setItem('pantopus_auth_session_change', 'changed-during-preflight'); window.dispatchEvent(new Event('focus')); });
    releaseRead(); releaseRead = null; await page.getByRole('button', { name: 'Reload current access', exact: true }).waitFor(); assert.equal(posts.length, prior);
    currentActor = actor; await page.getByRole('button', { name: 'Reload current access', exact: true }).click(); await retry(page).waitFor();
    assert.deepEqual((await stored())[0].draft, heldOriginal);
    // Keyboard submission of the saved original after current access is restored.
    await retry(page).focus(); await page.keyboard.press('Enter'); await confirmed(page).waitFor();
    await page.getByText('The original flag entered dispute review.', { exact: true }).waitFor();
    await page.getByRole('region', { name: 'Current claim' }).getByText('owner claim · challenged', { exact: true }).waitFor();
    assert.equal(rows(), 3); assert.equal(sql(`SELECT security_state FROM public."Home" WHERE id=${q(home)};`), 'normal');
    await screenshot('06-current-challenged-confirmation'); await page.reload({ waitUntil: 'domcontentloaded' }); await confirmed(page).waitFor();
    await ack(page).click(); await expect(confirmed(page)).toHaveCount(0); assert.equal(await save(page).count(), 0); assert.equal((await stored()).length, 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); assert.deepEqual(errors, []);
    // A denied list refresh must not retain old rows or falsely claim an empty queue.
    await page.goto(base + listPath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Continue review', exact: true })).toHaveCount(1);
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('alert').filter({ hasText: 'Current ownership claims could not be loaded' }).waitFor();
    assert.equal(await page.getByText('No pending ownership claims', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Continue review', exact: true }).count(), 0);
    await screenshot('07-denied-claim-list');
    sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.getByRole('button', { name: 'Reload claims', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Continue review', exact: true })).toHaveCount(1);
    await page.getByRole('link', { name: 'Relationship decisions and recovery', exact: true }).click();
    await page.getByText('No relationship decision needs recovery on this browser. Choose a claim to review.', { exact: true }).waitFor();
    console.log('PASS: claims list current denial clears old rows, reports failure and reloads after restored authority; acknowledged recovery inbox is empty');
    console.log('PASS: unwritable storage blocks POST; held preflight background/account changes preserve original without POST; keyboard recovery enters verified dispute review without freezing Home');
    fs.writeFileSync(path.join(evidence, 'console-diagnostics.json'), JSON.stringify(consoleDiagnostics));
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ result: 'pass', posts: posts.length, receipts: rows(), pageErrors: errors,
      limits: 'Synthetic auth/comparison shell, deterministic lifecycle events; actual Chrome, production relationship HTTP/services and PostgreSQL' }, null, 2));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(evidence, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
    throw error;
  } finally {
    if (releaseRead) releaseRead(); if (context) await context.close(); if (browser) await browser.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact browser relationship fixtures cleaned'); }
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
