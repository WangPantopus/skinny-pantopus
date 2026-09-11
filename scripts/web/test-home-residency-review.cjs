#!/usr/bin/env node
// Actual Chrome + production residency HTTP/read/write services + local SQL.
// Identity, public profiles, list/dashboard shape and unrelated shell replies are synthetic.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const { chromium, expect } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, container, evidence] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const f = require('../db/home-residency-review-http-fixture.cjs')(container);
const { actor, home, claims, sql, q } = f;
let server, browser, context, page, initialized = false, currentActor = actor, heldRead = null, releaseRead = null;
const posts = [], errors = [], consoleDiagnostics = [];
const listPath = `/app/homes/${home}/owners/review-claim`;
const recovery = `${base}${listPath}/residency`;
const url = (claim, action = 'approve') => `${recovery}?claimId=${claim}&action=${action}`;
const rows = () => Number(sql(`SELECT count(*) FROM public."HomeResidencyReviewReceipt" WHERE home_id=${q(home)};`));
async function stored(target = page) {
  return target.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('pantopus-private-task-recovery'); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    const read = (store, key) => new Promise((resolve, reject) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    const keys = await new Promise(resolve => { const r = db.transaction('drafts').objectStore('drafts').getAllKeys(); r.onsuccess = () => resolve(r.result); });
    const result = [];
    for (const slot of keys.filter(key => JSON.parse(key)[0] === 'residency-review')) {
      const sealed = await read('drafts', slot), key = await read('keys', 'residency-review-v1');
      const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: new TextEncoder().encode(`pantopus-residency-review-v1:${slot}`) }, key, sealed.ciphertext);
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
  return async () => { let timer; try { await Promise.race([reached, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Residency preflight was not reached')), 30000); })]); } finally { clearTimeout(timer); } };
}
async function main() {
  try {
    f.setup(); initialized = true;
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const apiBase = `http://127.0.0.1:${server.address().port}`;
    const actual = async (endpoint, method, original, headers = {}) => {
      const response = await fetch(apiBase + endpoint, { method, headers: { 'content-type': 'application/json', 'x-fixture-actor': currentActor, ...headers },
        ...(original ? { body: JSON.stringify(original) } : {}), signal: AbortSignal.timeout(20000) });
      return { status: response.status, body: await response.json() };
    };
    const membersPath = `/app/homes/${home}/dashboard?tab=members`;
    const access = () => {
      const hasAccess = sql(`SELECT public.home_residency_review_authority(${q(home)},${q(currentActor)});`) === 't';
      return { hasAccess, isOwner: hasAccess, is_owner: hasAccess, role_base: 'owner', effective_role_base: 'owner',
        permissions: hasAccess ? ['home.view','home.edit','members.view','members.manage','security.manage','ownership.manage','access.manage'] : [],
        can_manage_home: hasAccess, can_manage_access: hasAccess, can_manage_finance: false, can_manage_tasks: false, can_view_sensitive: false,
        verification_status: 'verified', age_band: 'adult', is_in_challenge_window: false, is_in_claim_window: false };
    };
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
        else if (endpoint.startsWith('/api/users/id/')) { const user = endpoint.split('/').pop(); body = { id: user, name: 'Applicant ' + user.slice(-1), username: 'residency_http_' + user.slice(-2) }; }
        else if (new RegExp(`/api/homes/${home}/claim/[^/]+/(review|approve|reject)$`).test(endpoint)) {
          if (method === 'GET' && heldRead) { const hold = heldRead; heldRead = null; hold.arrived(); await hold.released; }
          const original = method === 'POST' ? request.postDataJSON() : null;
          if (original) posts.push(original);
          const response = await actual(endpoint, method, original, { ...(request.headers()['x-pantopus-session-scope'] ? { 'x-pantopus-session-scope': request.headers()['x-pantopus-session-scope'] } : {}) });
          body = response.body; status = response.status;
          if (original) console.log('HTTP residency', posts.length, status, body.code || 'receipt');
        } else if (endpoint === `/api/homes/${home}/claims`) {
          if (!access().hasAccess) { status = 403; body = { error: 'Current residency access denied' }; }
          else body = { claims: JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('claimant',jsonb_build_object('id',c.user_id,'name','Applicant '||right(c.user_id::text,1),'username','residency_http_'||right(c.user_id::text,2))) ORDER BY c.id),'[]')::text FROM public."HomeResidencyClaim" c WHERE home_id=${q(home)};`)) };
        } else if (endpoint.endsWith('/me') || endpoint.endsWith('/iam/me')) body = access();
        else if (endpoint.endsWith('/dashboard')) body = { home: { id: home, name: 'Residency review Home', address: 'Private residency fixture', owner_id: actor, verification_status: 'verified' }, members: [], myAccess: access() };
        else if (endpoint.includes('ownership-claims')) body = { claims: [], incumbent: {} };
        else if (endpoint.includes('conversations')) body = { conversations: [], hasMore: false };
        else if (endpoint.includes('unread') || endpoint.includes('badge')) body = { count: 0, unreadCount: 0, total: 0, byContext: {} };
        else if (endpoint.includes('business')) body = { businesses: [], seats: [] };
        else if (endpoint.includes('homes')) body = { homes: [], entries: [], audit: [], invites: [], links: [] };
      } catch (error) { status = 503; body = { error: error.message }; }
      await route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(body) }).catch(() => {});
    });
    page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleDiagnostics.push(message.text()); });
    const screenshot = async name => { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true }); };
    const prepare = async (target = page, reason = 'Original reviewed reason') => {
      if (await target.getByLabel('Reason for rejection (optional)', { exact: true }).count()) await target.getByLabel('Reason for rejection (optional)', { exact: true }).fill(reason);
      await target.getByRole('checkbox').check();
    };
    const save = target => target.getByRole('button', { name: 'Save residency decision', exact: true });
    const confirmed = target => target.getByRole('heading', { name: 'Original decision confirmed', exact: true });
    const retry = target => target.getByRole('button', { name: 'Retry original decision', exact: true });
    const ack = target => target.getByRole('button', { name: 'I reviewed this confirmation', exact: true });
    await page.goto(base + listPath + '?tab=residency', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'Deny', exact: true }).first().click();
    await page.getByLabel('Reason for rejection (optional)', { exact: true }).fill('Cancelled reason');
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Approve', exact: true }).first().click();
    await page.getByRole('region', { name: 'Current residency claim' }).waitFor();
    assert.equal(posts.length, 0); assert.equal(rows(), 0); assert.equal((await stored()).length, 0); assert(await save(page).isDisabled());
    await prepare(); await page.getByLabel('Role for an unverified membership', { exact: true }).selectOption('guest');
    assert(await save(page).isDisabled()); await page.getByLabel('Role for an unverified membership', { exact: true }).selectOption('member');
    await prepare(); await screenshot('01-prepared-approval');
    await page.evaluate(() => { window.initialKeyPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'keys' && key === 'residency-review-v1') throw new DOMException('Synthetic key quota failure', 'QuotaExceededError');
      return window.initialKeyPut.call(this, value, key); }; });
    await save(page).click(); await page.getByRole('alert').filter({ hasText: 'could not be initialized' }).waitFor();
    assert.equal(posts.length, 0); assert.equal(rows(), 0);
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.initialKeyPut; delete window.initialKeyPut; });
    f.loseNextReply(); await save(page).click(); await retry(page).waitFor(); assert.equal(rows(), 1);
    const original = structuredClone(posts[0]); const saved = (await stored())[0]; assert(saved.encrypted && !saved.extractable);
    assert.equal(saved.draft.command.request_id, original.request_id); assert.equal(saved.draft.command.role, original.proposed_role);
    sql(`UPDATE public."HomeOccupancy" SET is_active=false,verification_status='moved_out' WHERE home_id=${q(home)} AND user_id=${q(f.users[1])};`);
    await page.goto(base + listPath + '?tab=residency', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Residency decisions and recovery', exact: true }).click();
    await retry(page).click(); await confirmed(page).waitFor(); assert.deepEqual(posts[1], original); assert.equal(rows(), 1);
    await page.getByText('Membership record: Inactive', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' }); await confirmed(page).waitFor(); assert.equal(posts.length, 2);
    await screenshot('02-original-approval-current-move-out'); await ack(page).click();
    await page.getByText('No residency decision needs recovery on this browser. Choose a claim to review.', { exact: true }).waitFor();
    assert.equal((await stored()).length, 0);
    console.log('PASS: owners entry cancellation, reviewed role, key failure, encrypted lost approval reply, current move-out and cold confirmation');

    await page.goto(base + membersPath, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('link', { name: 'Review rejection', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(claims[1])); await prepare();
    sql(`UPDATE public."HomeResidencyClaim" SET updated_at=clock_timestamp() WHERE id=${q(claims[1])};`);
    await save(page).click(); await page.getByRole('button', { name: 'Review current claim again', exact: true }).click();
    await expect.poll(async () => (await stored()).length).toBe(0);
    await page.getByRole('form', { name: 'Review residency decision' }).waitFor();
    assert.equal(rows(), 1); assert.equal((await stored()).length, 0); assert(!(await page.getByRole('checkbox').isChecked()));
    await prepare(page, 'First competing original');
    const sibling = await context.newPage(); await sibling.goto(url(claims[1], 'reject'), { waitUntil: 'domcontentloaded' }); await prepare(sibling, 'Second competing original');
    f.loseNextReply(); await save(page).click(); await retry(page).waitFor(); const count = posts.length;
    await save(sibling).click(); await sibling.getByRole('alert').waitFor(); assert.equal(posts.length, count);
    sql(`UPDATE public."HomeResidencyClaim" SET status='pending',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=clock_timestamp() WHERE id=${q(claims[1])};`);
    await sibling.reload({ waitUntil: 'domcontentloaded' }); await retry(sibling).click(); await confirmed(sibling).waitFor();
    assert.equal(rows(), 2); assert.deepEqual(posts.at(-1), posts.at(-2));
    await sibling.getByText('Claim status: pending', { exact: true }).waitFor(); await sibling.close();
    await page.reload({ waitUntil: 'domcontentloaded' }); await confirmed(page).waitFor();
    await screenshot('03-original-rejection-current-resubmission');
    console.log('PASS: household entry, stale review, competing tabs and original rejection/current resubmission separation');

    const prior = posts.length;
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.getByRole('button', { name: 'Reload current access', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Current residency claim' }).count(), 0);
    assert.equal(await page.getByText('Original reason: First competing original', { exact: true }).count(), 0);
    sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.getByRole('button', { name: 'Reload current access', exact: true }).click(); await confirmed(page).waitFor();
    currentActor = f.users[5]; await page.evaluate(() => { localStorage.setItem('pantopus_auth_session_change', 'changed'); window.dispatchEvent(new Event('focus')); });
    await page.getByRole('button', { name: 'Reload current access', exact: true }).waitFor(); assert.equal(posts.length, prior);
    currentActor = actor; await page.getByRole('button', { name: 'Reload current access', exact: true }).click(); await confirmed(page).waitFor();
    const slot = (await stored())[0].slot;
    const envelope = await page.evaluate(async slot => {
      const db = await new Promise(resolve => { const r = indexedDB.open('pantopus-private-task-recovery'); r.onsuccess = () => resolve(r.result); });
      const t = db.transaction('drafts', 'readwrite'), s = t.objectStore('drafts'); let original;
      const r = s.get(slot); r.onsuccess = () => { const v = r.result; original = { ...v, iv: Array.from(new Uint8Array(v.iv)), ciphertext: Array.from(new Uint8Array(v.ciphertext)) };
        const damaged = new Uint8Array(v.ciphertext.slice(0)); damaged[0] ^= 1; s.put({ ...v, ciphertext: damaged.buffer }, slot); };
      await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = reject; }); db.close(); return original;
    }, slot);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('alert').filter({ hasText: 'could not be read' }).waitFor();
    assert.equal(await save(page).count(), 0); assert.equal(await retry(page).count(), 0); assert.equal(posts.length, prior);
    await page.evaluate(async ({ slot, envelope }) => {
      const db = await new Promise(resolve => { const r = indexedDB.open('pantopus-private-task-recovery'); r.onsuccess = () => resolve(r.result); });
      const t = db.transaction('drafts', 'readwrite'); t.objectStore('drafts').put({ ...envelope, iv: new Uint8Array(envelope.iv).buffer, ciphertext: new Uint8Array(envelope.ciphertext).buffer }, slot);
      await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = reject; }); db.close();
    }, { slot, envelope });
    await page.goto(url(claims[2]), { waitUntil: 'domcontentloaded' }); await confirmed(page).waitFor();
    await page.getByText('Finish this saved decision before reviewing another claim.', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.getByRole('main', { name: 'Residency review' }).evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThan(360);
    await screenshot('04-narrow-recovered-rejection');
    await ack(page).click();
    // Acknowledging an old claim must open the claim named by the current URL.
    await page.getByRole('region', { name: 'Current residency claim' }).getByText(/Claim reference: 00000204/).waitFor();
    console.log('PASS: current authority/account change hides private review, corrupt ciphertext retained, original restored and requested next claim opened');

    await prepare();
    await page.evaluate(() => { window.originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'drafts' && typeof key === 'string' && JSON.parse(key)[0] === 'residency-review') throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      return window.originalPut.call(this, value, key); }; });
    await save(page).click(); await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.equal(posts.length, prior); assert.equal((await stored()).length, 0);
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; delete window.originalPut; });
    const reached = holdNextRead(); await save(page).click(); await reached(); await visibility(true);
    await expect(page.getByRole('region', { name: 'Current residency claim' })).toHaveCount(0);
    releaseRead(); releaseRead = null; await visibility(false); await retry(page).waitFor(); assert.equal(posts.length, prior);
    const heldOriginal = (await stored())[0].draft;
    const reachedAgain = holdNextRead(); await retry(page).click(); await reachedAgain();
    currentActor = f.users[5]; await page.evaluate(() => { localStorage.setItem('pantopus_auth_session_change', 'changed-during-preflight'); window.dispatchEvent(new Event('focus')); });
    releaseRead(); releaseRead = null; await page.getByRole('button', { name: 'Reload current access', exact: true }).waitFor(); assert.equal(posts.length, prior);
    currentActor = actor; await page.getByRole('button', { name: 'Reload current access', exact: true }).click(); await retry(page).waitFor();
    assert.deepEqual((await stored())[0].draft, heldOriginal);
    await retry(page).focus(); await page.keyboard.press('Enter'); await confirmed(page).waitFor(); assert.equal(rows(), 3);
    await screenshot('05-keyboard-recovered-approval'); await ack(page).click();
    console.log('PASS: draft failure blocks POST; held preflight background/account changes retain original without POST; keyboard confirms original');

    // A definite role ceiling denial is reviewable, not an unrecoverable saved draft.
    sql(`UPDATE public."HomeOccupancy" SET age_band='child' WHERE home_id=${q(home)} AND user_id=${q(f.users[4])};`);
    await page.goto(url(claims[3]), { waitUntil: 'domcontentloaded' }); await prepare(); await save(page).click();
    await page.getByRole('button', { name: 'Review current claim again', exact: true }).click();
    await page.getByLabel('Role for an unverified membership', { exact: true }).selectOption('guest'); await prepare();
    await save(page).click(); await confirmed(page).waitFor(); assert.equal(rows(), 4);
    await screenshot('06-role-ceiling-reviewed-guest'); await ack(page).click();
    // Separate later claimant state is fixture-controlled; it creates no receipt.
    sql(`UPDATE public."HomeResidencyClaim" SET status='rejected' WHERE id=${q(claims[1])};`);
    await page.goto(base + membersPath, { waitUntil: 'domcontentloaded' });
    await page.getByText('No pending residency claims', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Residency decisions and recovery', exact: true }).click();
    await page.getByText('No residency decision needs recovery on this browser. Choose a claim to review.', { exact: true }).waitFor();
    await page.goto(base + membersPath, { waitUntil: 'domcontentloaded' });
    await page.getByText('No pending residency claims', { exact: true }).waitFor();
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('alert').filter({ hasText: 'Current residency claims could not be loaded' }).waitFor();
    assert.equal(await page.getByText('No pending residency claims', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Review approval', exact: true }).count(), 0);
    await screenshot('07-household-denied-list');
    sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.getByRole('button', { name: 'Reload residency claims', exact: true }).click();
    await page.getByText('No pending residency claims', { exact: true }).waitFor();
    await page.goto(base + listPath + '?tab=residency', { waitUntil: 'domcontentloaded' });
    await page.getByText('No pending residency claims', { exact: true }).waitFor();
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('alert').filter({ hasText: 'Current residency claims could not be loaded' }).waitFor();
    assert.equal(await page.getByText('No pending residency claims', { exact: true }).count(), 0);
    await screenshot('08-owners-denied-list');
    sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await page.getByRole('button', { name: 'Reload claims', exact: true }).click();
    await page.getByRole('link', { name: 'Residency decisions and recovery', exact: true }).click();
    await page.getByText('No residency decision needs recovery on this browser. Choose a claim to review.', { exact: true }).waitFor();
    assert.equal((await stored()).length, 0); assert.equal(rows(), 4);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); assert.deepEqual(errors, []);
    console.log('PASS: role-ceiling recovery, both empty-list permanent recovery links, both denied-list states and restored authority');
    fs.writeFileSync(path.join(evidence, 'console-diagnostics.json'), JSON.stringify(consoleDiagnostics));
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ result: 'pass', posts: posts.length, receipts: rows(), pageErrors: errors,
      limits: 'Synthetic auth/public profiles/list/dashboard shell and deterministic lifecycle; actual Chrome, production review HTTP/services and PostgreSQL' }, null, 2));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(evidence, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
    throw error;
  } finally {
    if (releaseRead) releaseRead(); if (context) await context.close(); if (browser) await browser.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact browser residency fixtures cleaned'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
