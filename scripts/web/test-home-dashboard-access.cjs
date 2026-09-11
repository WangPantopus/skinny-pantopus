#!/usr/bin/env node
// Actual Chrome UI, production dashboard/IAM HTTP/helpers/services and PostgreSQL.
// Identity, ancillary/fallback endpoints and lifecycle events are local fixture adapters.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const { chromium, expect } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, container, evidence] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const f = require('../db/home-residency-review-http-fixture.cjs')(container, { summary: true, dashboard: true });
const { actor, home, sql, q } = f;
let server, browser, context, page, initialized = false, currentActor = actor, hold = null;
let privateReads = 0;
let listFailure = false, dashboardFailure = false, auxiliaryVersion = 'Current', accessFailure = false;
const holds = [], errors = [], diagnostics = [], mutations = [], checks = [];
const household = `${base}/app/homes/${home}/dashboard?tab=members`;
const title = () => page.getByRole('heading', { name: 'Private dashboard fixture', exact: true });
const reload = () => page.getByRole('button', { name: 'Reload current home access', exact: true });
const invite = () => page.getByRole('button', { name: '+ Invite', exact: true });
const row = () => page.getByText('current_household_member', { exact: true });
const changeAccess = active => sql(`UPDATE public."HomeOccupancy" SET is_active=${active} WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
const focus = () => page.evaluate(() => window.dispatchEvent(new Event('focus')));
const visibility = hidden => page.evaluate(value => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: value ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);
function holdNext(suffix) {
  assert.equal(hold, null);
  let arrival, release;
  const reached = new Promise(resolve => { arrival = resolve; }), released = new Promise(resolve => { release = resolve; });
  hold = { suffix, arrival, released, release }; holds.push(hold);
  return { wait: async () => { let timer; try { await Promise.race([reached, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Held response not reached: ' + suffix)), 30000); })]); } finally { clearTimeout(timer); } }, release };
}
async function absent() { await expect(title()).toHaveCount(0); await expect(invite()).toHaveCount(0); await expect(row()).toHaveCount(0); await expect(page.getByText('Owner', { exact: true })).toHaveCount(0); }
async function restored() { await title().waitFor(); await invite().waitFor(); await row().waitFor(); }
async function screenshot(name) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true }); }
function pass(message) { checks.push(message); console.log('PASS:', message); }
async function main() {
  try {
    f.setup(); initialized = true;
    sql(`UPDATE public."Home" SET name='Private dashboard fixture' WHERE id=${q(home)};
      UPDATE public."HomeOccupancy" SET verification_status='verified' WHERE home_id=${q(home)} AND user_id=${q(f.users[4])};
      UPDATE public."User" SET username='current_household_member',name='Private legal fixture name' WHERE id=${q(f.users[4])};`);
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const apiBase = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    context = await browser.newContext({ viewport: { width: 1100, height: 950 } });
    await context.addCookies([{ name: 'pantopus_session', value: '1', url: base }, { name: 'pantopus_access', value: 'synthetic-local-session', url: base, httpOnly: true }]);
    await context.route('**/*', async route => {
      const request = route.request(), parsed = new URL(request.url()), endpoint = parsed.pathname;
      if (parsed.origin !== base) return route.abort();
      if (!endpoint.startsWith('/api/')) return endpoint.startsWith('/socket.io/') ? route.fulfill({ status: 503, body: '' }) : route.continue();
      let body = {}, status = 200;
      try {
        if (request.method() !== 'GET') { mutations.push(endpoint); throw new Error('Unexpected mutation in read-only dashboard acceptance'); }
        if (endpoint === '/api/users/profile') body = { user: { id: currentActor, username: 'dashboard_fixture', name: 'Browser fixture', account_type: 'personal', email_verified: true } };
        else if (/\/api\/homes\/[^/]+\/(me|iam\/me)$/.test(endpoint)) {
          const response = await fetch(apiBase + endpoint, { headers: { 'x-fixture-actor': currentActor }, signal: AbortSignal.timeout(20000) });
          body = await response.json(); status = response.status; assert.match(response.headers.get('cache-control') || '', /private, no-store/);
          if (accessFailure) { status = 503; body = { error: 'Current access service unavailable' }; }
        } else if (endpoint.endsWith('/dashboard')) {
          privateReads++;
          if (dashboardFailure) f.failNextQuery('HomePet');
          const response = await fetch(apiBase + endpoint, { headers: { 'x-fixture-actor': currentActor }, signal: AbortSignal.timeout(20000) });
          body = await response.json(); status = response.status;
          assert.match(response.headers.get('cache-control') || '', /private, no-store/);
        } else if (endpoint === `/api/homes/${home}/claims`) {
          if (listFailure) { status = 503; body = { error: 'Claim list temporarily unavailable' }; } else body = { claims: [] };
        } else if (endpoint === `/api/homes/${home}`) body = { home: { id: home, name: 'Private dashboard fixture', owner_id: actor } };
        else if (endpoint.endsWith('/occupants')) body = { occupants: [{ id: f.id(900), user_id: f.users[1], role: 'member', role_base: 'member', is_active: true, user: { name: 'current_household_member' } }], pendingInvites: [] };
        else if (endpoint.endsWith('/timeline')) body = { items: [{ id: f.id(980), action: 'task_completed', description: auxiliaryVersion + ' timeline item', created_at: '2026-09-10T12:00:00Z' }], hasMore: false };
        else if (/\/(health-score|seasonal-checklist|bill-trends|property-value)$/.test(endpoint)) { status = 404; body = { error: 'Ancillary fixture unavailable' }; }
        else if (endpoint.includes('conversations')) body = { conversations: [], hasMore: false };
        else if (endpoint.includes('unread') || endpoint.includes('badge')) body = { count: 0, unreadCount: 0, total: 0, byContext: {} };
        else if (endpoint.includes('business')) body = { businesses: [], seats: [] };
        else if (endpoint.includes('homes')) body = { homes: [], entries: [], audit: [], invites: [], links: [], tasks: [], issues: [], bills: [], packages: [], documents: [], pets: [], polls: [], secrets: [], emergencies: [], gigs: [] };
        // Freeze an already-computed response, including its original identity and authority.
        if (hold && endpoint.endsWith(hold.suffix)) { const pending = hold; hold = null; pending.arrival(); await pending.released; }
      } catch (error) { status = 503; body = { error: error.message }; }
      await route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(body) }).catch(() => {});
    });
    page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', e => errors.push(e.message)); page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text()); });
    await page.goto(household, { waitUntil: 'domcontentloaded', timeout: 120000 }); await restored();
    await expect(page.getByText('Private legal fixture name', { exact: true })).toHaveCount(0);
    pass('Actual dashboard SQL renders the permitted member handle without forwarding the raw legal name');
    await invite().click(); await page.getByRole('heading', { name: 'Invite Member', exact: true }).waitFor();
    changeAccess(false); await focus(); await reload().waitFor(); await absent();
    await expect(page.getByRole('heading', { name: 'Invite Member', exact: true })).toHaveCount(0);
    await screenshot('01-revoked-without-private-data'); changeAccess(true); await reload().click(); await restored();
    await expect(page.getByRole('heading', { name: 'Invite Member', exact: true })).toHaveCount(0);
    pass('Loaded owner UI and open invitation retire on revocation; explicit reload restores current data with the old panel closed');

    const aggregate = holdNext('/dashboard'); await focus(); await aggregate.wait();
    changeAccess(false); await focus(); await reload().waitFor(); aggregate.release(); await absent();
    changeAccess(true); await reload().click(); await restored();
    pass('An old successful aggregate cannot restore a later denied dashboard');

    const permission = holdNext('/me'); await focus(); await permission.wait();
    currentActor = f.users[5]; await page.evaluate(() => { localStorage.setItem('pantopus_auth_session_change', 'dashboard-account-change'); window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus_auth_session_change' })); });
    await reload().waitFor(); permission.release(); await absent();
    currentActor = actor; await reload().click(); await restored();
    pass('An old successful authority response cannot restore private data after an account marker change');

    const review = holdNext('/dashboard'); await focus(); await review.wait();
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'members.manage',false);`);
    review.release(); await reload().waitFor(); await absent(); await screenshot('02-access-changed-during-load');
    await reload().click(); await title().waitFor(); await expect(invite()).toHaveCount(0);
    await screenshot('03-current-denied-invitation-permission');
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`); await focus(); await restored();
    pass('A permission change while loading requires a fresh read and does not regain Invite through the owner pointer');

    await visibility(true); await page.getByText('Loading home dashboard…', { exact: true }).waitFor(); await absent();
    await visibility(false); await restored();
    pass('Background retirement clears the entire private dashboard and returning reauthorizes it');

    accessFailure = true; await focus(); await reload().waitFor(); await absent(); await screenshot('04-access-outage-reload');
    accessFailure = false; await reload().click(); await restored();
    listFailure = true; await focus(); await title().waitFor();
    await page.getByRole('alert').filter({ hasText: 'Current residency claims could not be loaded' }).waitFor();
    await expect(page.getByText('No pending residency claims', { exact: true })).toHaveCount(0); await invite().waitFor();
    await screenshot('05-claims-outage-with-current-home-authority'); listFailure = false;
    await page.getByRole('button', { name: 'Reload residency claims', exact: true }).click(); await page.getByText('No pending residency claims', { exact: true }).waitFor();
    pass('Authority outage clears private UI; an isolated claim-list outage remains an honest reloadable panel error');

    dashboardFailure = true; await focus(); await restored();
    const entity = holdNext('/tasks'); await focus(); await entity.wait(); changeAccess(false); await focus(); await reload().waitFor(); entity.release(); await absent();
    dashboardFailure = false; changeAccess(true); await reload().click(); await restored();
    pass('Individual endpoint fallback works and a stale entity response cannot revive denied data');

    const readsBeforePending = privateReads;
    currentActor = f.users[1]; await page.evaluate(() => { localStorage.setItem('pantopus_auth_session_change', 'pending-member'); window.dispatchEvent(new Event('focus')); });
    await expect(title()).toHaveCount(0); await expect(invite()).toHaveCount(0);
    await page.getByRole('heading', { name: /review|verif|document/i }).first().waitFor(); await screenshot('06-current-pending-verification'); assert.equal(privateReads, readsBeforePending);
    await expect(page.getByRole('button', { name: /Upload proof|Verify with mailed code/ })).toHaveCount(0);
    sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(currentActor)};`);
    await focus(); await reload().waitFor(); await absent();
    await expect(page.getByRole('heading', { name: 'Your residency request is under review', exact: true })).toHaveCount(0);
    sql(`UPDATE public."HomeOccupancy" SET is_active=true,start_at=now()+interval '1 day' WHERE home_id=${q(home)} AND user_id=${q(currentActor)};`);
    await reload().click(); await reload().waitFor(); await absent();
    sql(`UPDATE public."HomeOccupancy" SET start_at=now()-interval '1 day' WHERE home_id=${q(home)} AND user_id=${q(currentActor)};`);
    await reload().click(); await page.getByRole('heading', { name: 'Your residency request is under review', exact: true }).waitFor();
    sql(`UPDATE public."HomeOccupancy" SET verification_status='verified' WHERE home_id=${q(home)} AND user_id=${q(currentActor)};`);
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click(); await title().waitFor();
    await expect(invite()).toHaveCount(0); await expect(page.getByText('Owner', { exact: true })).toHaveCount(0);
    currentActor = actor; await focus(); await restored();
    pass('Revoked and future-start pending occupancies cannot enter verification; a legitimate pending membership retains its verification flow without owner controls');

    auxiliaryVersion = 'Retired'; const summary = holdNext('/timeline');
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click(); await summary.wait();
    auxiliaryVersion = 'Current'; await focus(); await title().waitFor();
    await page.getByText('Current timeline item', { exact: true }).waitFor(); summary.release();
    await expect(page.getByText('Retired timeline item', { exact: true })).toHaveCount(0);
    await screenshot('07-current-overview-after-delayed-summary');
    await page.getByRole('button', { name: 'Members & Security', exact: true }).click(); await restored();
    pass('Overview navigation and a deferred summary refresh cannot restore a retired timeline');

    await page.setViewportSize({ width: 390, height: 844 }); changeAccess(false); await focus(); await reload().waitFor(); await absent();
    await screenshot('08-narrow-denied'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    changeAccess(true); await reload().focus(); await page.keyboard.press('Enter'); await restored(); await screenshot('09-narrow-restored');
    pass('Narrow denied/restored states and keyboard reload remain usable');
    assert.deepEqual(mutations, []); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ result: 'pass', checks, mutations: 0, pageErrors: errors, limits: 'Actual Chrome, production dashboard/IAM HTTP/helpers/services and PostgreSQL; synthetic auth, ancillary/fallback entities and deterministic lifecycle events. Standalone entity fallback and overview totals remain a separate contract repair.' }, null, 2));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(evidence, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
    throw error;
  } finally {
    for (const pending of holds) pending.release();
    if (context) await context.close(); if (browser) await browser.close();
    fs.writeFileSync(path.join(evidence, 'console-diagnostics.json'), JSON.stringify(diagnostics));
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact dashboard fixtures cleaned'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
