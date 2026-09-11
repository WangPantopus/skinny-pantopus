#!/usr/bin/env node
// Actual Chrome UI, production IAM HTTP/helper and PostgreSQL authority. Identity, dashboard entities,
// ancillary endpoints and lifecycle events are deterministic local fixture adapters.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const { chromium, expect } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, container, evidence] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const f = require('../db/home-residency-review-http-fixture.cjs')(container, { summary: true });
const { actor, home, sql, q } = f;
let server, browser, context, page, initialized = false, currentActor = actor, hold = null;
let privateReads = 0;
const item = f.id(801), secondItem = f.id(802);
let listFailure = false, dashboardFailure = false, auxiliaryVersion = 'Current', accessFailure = false;
const failures = new Set(), malformed = new Set();
const holds = [], errors = [], diagnostics = [], mutations = [], checks = [];
const household = `${base}/app/homes/${home}/dashboard?tab=dashboard`;
const share = () => page.getByRole('checkbox', { name: 'Share bill data anonymously', exact: true });
const retry = name => page.getByRole('button', { name: 'Retry ' + name, exact: true });
const title = () => page.getByRole('heading', { name: 'Private dashboard fixture', exact: true });
const reload = () => page.getByRole('button', { name: 'Reload current home access', exact: true });
const invite = () => page.getByRole('button', { name: '+ Invite', exact: true });
const row = () => page.getByText('Current household member', { exact: true });
const access = requested => {
  const a = JSON.parse(sql(`SELECT public.home_effective_access(${q(requested)},${q(currentActor)});`));
  const occ = JSON.parse(sql(`SELECT coalesce((SELECT jsonb_build_object('id',id,'role',role,'role_base',role_base,'age_band',age_band,'verification_status',verification_status,'start_at',start_at,'end_at',end_at) FROM public."HomeOccupancy" WHERE home_id=${q(requested)} AND user_id=${q(currentActor)} AND is_active LIMIT 1),'null'::jsonb);`));
  return { hasAccess: a.has_access, isOwner: a.is_owner, is_owner: a.is_owner,
    role_base: a.role_base, effective_role_base: a.effective_role_base, permissions: a.permissions, occupancy: occ,
    verification_required: !!occ && ['pending_doc','pending_approval'].includes(occ.verification_status),
    verification_status: occ?.verification_status || 'unverified', age_band: occ?.age_band || null,
    can_manage_home: a.permissions.includes('home.edit'), can_manage_access: a.permissions.includes('members.manage'),
    can_manage_finance: a.permissions.includes('finance.manage'), can_manage_tasks: a.permissions.includes('tasks.manage'),
    can_view_sensitive: a.permissions.includes('access.view'), is_in_challenge_window: false, is_in_claim_window: false };
};
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
async function screenshot(name) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true }); }
function pass(message) { checks.push(message); console.log('PASS:', message); }
async function main() {
  try {
    f.setup(); initialized = true;
    const season = require(path.join(root, 'backend/services/ai/seasonalEngine')).getSeasonalContext({}).primary_season;
    sql(`INSERT INTO public."HomeSeasonalChecklistItem"(id,home_id,season_key,year,item_key,title) VALUES (${q(item)},${q(home)},${q(season)},extract(year FROM now()),'first','Check smoke alarms'), (${q(secondItem)},${q(home)},${q(season)},extract(year FROM now()),'second','Clean dryer vent');`);
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
        if (request.method() !== 'GET') mutations.push({ endpoint, method: request.method() });
        if (endpoint === '/api/users/profile') body = { user: { id: currentActor, username: 'dashboard_fixture', name: 'Browser fixture', account_type: 'personal', email_verified: true } };
        else if (/\/(health-score|seasonal-checklist|bill-trends|property-value|timeline|settings)(\/[^/]+)?$/.test(endpoint)) {
          const response = await fetch(apiBase + endpoint + parsed.search, { method: request.method(), headers: { 'content-type': 'application/json', 'x-fixture-actor': currentActor }, ...(request.postData() ? { body: request.postData() } : {}), signal: AbortSignal.timeout(20000) });
          body = await response.json(); status = response.status;
          if (failures.has(endpoint.split('/').at(-1))) { status = 503; body = { error: 'Synthetic unavailable response after production read' }; }
          if (malformed.has(endpoint.split('/').at(-1))) body = {};
        }
        else if (/\/api\/homes\/[^/]+\/(me|iam\/me)$/.test(endpoint)) {
          const response = await fetch(apiBase + endpoint, { headers: { 'x-fixture-actor': currentActor }, signal: AbortSignal.timeout(20000) });
          body = await response.json(); status = response.status; assert.match(response.headers.get('cache-control') || '', /private, no-store/);
          if (accessFailure) { status = 503; body = { error: 'Current access service unavailable' }; }
        } else if (endpoint.endsWith('/dashboard')) {
          privateReads++;
          if (dashboardFailure) { status = 503; body = { error: 'Aggregate temporarily unavailable' }; }
          else body = { home: { id: home, name: 'Private dashboard fixture', address_line1: 'Private fixture address', owner_id: actor }, myAccess: access(home),
            members: [{ id: f.id(900), user_id: f.users[1], role: 'member', role_base: 'member', is_active: true, user: { name: 'Current household member' } }], tasks: [], issues: [], bills: [], packages: [], documents: [], events: [] };
        } else if (endpoint === `/api/homes/${home}/claims`) {
          if (listFailure) { status = 503; body = { error: 'Claim list temporarily unavailable' }; } else body = { claims: [] };
        } else if (endpoint === `/api/homes/${home}`) body = { home: { id: home, name: 'Private dashboard fixture', owner_id: actor } };
        else if (endpoint.endsWith('/occupants')) body = { occupants: [{ id: f.id(900), user_id: f.users[1], role: 'member', role_base: 'member', is_active: true, user: { name: 'Current household member' } }], pendingInvites: [] };
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
    for (const key of ['health-score','seasonal-checklist','bill-trends','property-value','timeline']) failures.add(key);
    await page.goto(household, { waitUntil: 'domcontentloaded', timeout: 120000 }); await title().waitFor();
    for (const name of ['home health','seasonal checklist','bill trends','property information','home activity']) await retry(name).waitFor();
    await expect(page.getByText('Track your household bills', { exact: true })).toHaveCount(0);
    await expect(page.getByText('No seasonal tasks right now', { exact: true })).toHaveCount(0);
    await screenshot('01-unavailable-summaries');
    failures.clear();
    for (const name of ['home health','seasonal checklist','bill trends','property information','home activity']) await retry(name).click();
    await page.getByRole('button', { name: 'Mark complete: Check smoke alarms', exact: true }).waitFor();
    await page.getByText('Track your household bills', { exact: true }).waitFor();
    await share().waitFor(); await expect(share()).not.toBeChecked();
    await page.getByText('Property value information is not available for this home yet.', { exact: true }).waitFor();
    await screenshot('02-current-and-confirmed-empty');
    pass('All five errors have separate retry; actual current checklist, confirmed empty bills/property and current sharing return');

    const saving = holdNext('/settings'); await share().locator('..').click(); await saving.wait();
    await expect(share()).toBeDisabled(); await page.getByText('Saving sharing preference…', { exact: true }).waitFor();
    assert.equal(sql(`SELECT settings->>'bill_benchmark_opt_in' FROM public."HomePreference" WHERE home_id=${q(home)};`),'true');
    saving.release(); await expect(share()).toBeEnabled(); await expect(share()).toBeChecked();
    const onColor = await share().locator('..').locator('div').evaluate(el => getComputedStyle(el).backgroundColor);
    await screenshot('03-persisted-sharing-with-no-bills');
    f.loseNextReply(); await share().focus(); await page.keyboard.press('Space'); await retry('bill trends').waitFor();
    await expect(share()).toHaveCount(0); await screenshot('04-sharing-unknown-reload');
    await retry('bill trends').click(); await expect(share()).not.toBeChecked();
    assert.notEqual(await share().locator('..').locator('div').evaluate(el => getComputedStyle(el).backgroundColor), onColor);
    assert.equal(sql(`SELECT settings->>'bill_benchmark_opt_in' FROM public."HomePreference" WHERE home_id=${q(home)};`),'false');
    pass('Pointer and keyboard sharing work even without bill history; save is held/disabled and a lost committed opt-out requires read recovery');

    f.loseNextReply(); await page.getByRole('button', { name: 'Mark complete: Check smoke alarms', exact: true }).click();
    await retry('seasonal checklist').waitFor(); await expect(page.getByRole('button', { name: 'Mark complete: Check smoke alarms', exact: true })).toHaveCount(0);
    assert.equal(sql(`SELECT status FROM public."HomeSeasonalChecklistItem" WHERE id=${q(item)};`),'completed');
    await screenshot('05-checklist-unknown-reload'); await retry('seasonal checklist').click();
    await page.getByText('Check smoke alarms', { exact: true }).waitFor();
    const completing = holdNext('/' + secondItem); await page.getByRole('button', { name: 'Skip: Clean dryer vent', exact: true }).click(); await completing.wait();
    await expect(page.getByRole('button', { name: 'Mark complete: Clean dryer vent', exact: true })).toBeDisabled();
    completing.release(); await expect(page.getByRole('button', { name: 'Mark complete: Clean dryer vent', exact: true })).toHaveCount(0);
    assert.equal(sql(`SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(home)} AND action='home_checklist_updated';`),'2');
    pass('A lost committed completion recovers current state; skipped item and busy duplicate prevention reach real SQL once per change');

    malformed.add('bill-trends'); await focus(); await retry('bill trends').waitFor(); await expect(share()).toHaveCount(0);
    malformed.clear(); await retry('bill trends').click(); await share().waitFor();
    const stale = holdNext('/bill-trends'); await focus(); await stale.wait();
    await visibility(true); await expect(title()).toHaveCount(0); stale.release();
    await visibility(false); await share().waitFor(); await expect(share()).not.toBeChecked();
    pass('Malformed success remains unavailable and a held summary cannot survive background retirement');

    const denied = ['home.edit','finance.view','finance.manage','members.manage','tasks.edit','tasks.manage','maintenance.edit','maintenance.manage','packages.edit','packages.manage'];
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES ${denied.map(permission => `(${q(home)},${q(actor)},${q(permission)},false)`).join(',')};`);
    const beforeReads = f.queryCalls.filter(t => t === 'HomeBill' || t === 'HomeAuditLog').length;
    await focus(); await title().waitFor();
    await expect(page.locator('[aria-label="Home health"]')).toHaveCount(0);
    await expect(page.locator('[aria-label="Bill trends"]')).toHaveCount(0);
    await expect(page.locator('[aria-label="Home activity"]')).toHaveCount(0);
    await expect(invite()).toHaveCount(0); await expect(share()).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add a bill', exact: true })).toHaveCount(0);
    assert.equal(f.queryCalls.filter(t => t === 'HomeBill' || t === 'HomeAuditLog').length, beforeReads);
    await screenshot('06-limited-member-overview');
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`); await focus(); await share().waitFor();
    pass('Current effective restrictions hide health/bills/audit, sharing and create/invite controls before restricted summary reads');

    await page.setViewportSize({ width: 390, height: 844 }); failures.add('bill-trends'); await focus(); await retry('bill trends').waitFor();
    await screenshot('07-narrow-error'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    failures.clear(); await retry('bill trends').focus(); await page.keyboard.press('Enter'); await share().waitFor();
    await screenshot('08-narrow-current'); assert.deepEqual(errors, []);
    pass('Narrow error/current screens and keyboard retry remain usable without page errors');
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ result: 'pass', checks, mutations, pageErrors: errors, limits: 'Actual Chrome/production HTTP/helper/services/SQL; synthetic auth/dashboard entities/property provider and deliberate response/lifecycle faults; no paid providers' }, null, 2));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(evidence, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
    throw error;
  } finally {
    for (const pending of holds) pending.release();
    if (context) await context.close(); if (browser) await browser.close();
    fs.writeFileSync(path.join(evidence, 'console-diagnostics.json'), JSON.stringify(diagnostics));
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { sql(`DELETE FROM public."HomeSeasonalChecklistItem" WHERE home_id=${q(home)};`); f.cleanup(); console.log('PASS: exact browser summary fixtures cleaned'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
