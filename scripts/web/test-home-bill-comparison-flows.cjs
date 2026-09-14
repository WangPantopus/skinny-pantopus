#!/usr/bin/env node
// Actual Chrome financial UI -> production API/services -> current SQL snapshot.
// Identity, dashboard shell, unrelated providers and fault timing are local fixture adapters.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const { chromium, expect } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, container, evidence] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const f = require('../db/home-bill-comparison-http-fixture.cjs')(container);
const { actor, home, sql, q } = f;
let server, browser, context, page, initialized = false, currentActor = actor, hold = null;
let privateReads = 0, billFault = null;
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
async function screenshot(name) { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true }); }
function pass(message) { checks.push(message); console.log('PASS:', message); }
async function main() {
  try {
    const { current, previous } = f.setup(); initialized = true;
    const season = require(path.join(root, 'backend/services/ai/seasonalEngine')).getSeasonalContext({}).primary_season;
    sql(`INSERT INTO public."HomeSeasonalChecklistItem"(id,home_id,season_key,year,item_key,title) VALUES (${q(item)},${q(home)},${q(season)},extract(year FROM now()),'first','Check smoke alarms'), (${q(secondItem)},${q(home)},${q(season)},extract(year FROM now()),'second','Clean dryer vent');`);
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const apiBase = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    context = await browser.newContext({ viewport: { width: 1100, height: 950 }, timezoneId: 'America/Los_Angeles' });
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
          if (endpoint.endsWith('/bill-trends') && billFault) {
            if (billFault === 'currency') body.currency = 'EUR';
            if (billFault === 'nested') body.bills_by_type = { electric: { months: [current], amounts: [] } };
            if (billFault === 'empty-series') body.bills_by_type = { electric: { months: [], amounts: [] } };
            if (billFault === 'floor') body.benchmarks = { electric: { months: [current], avg_amounts: [12], household_count: 3 } };
          }
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
    const currency = () => page.getByRole('combobox', { name: 'Bill comparison currency', exact: true });
    const chart = () => page.getByLabel('Monthly bill chart', { exact: true });
    const bill = () => page.getByLabel('Bill trends', { exact: true });
    const currentBar = () => page.getByRole('img', { name: `${current}: your total $142.50 · Comparison $104.70`, exact: true });
    await page.goto(household, { waitUntil: 'domcontentloaded', timeout: 120000 }); await title().waitFor();
    await currentBar().waitFor();
    await page.getByRole('img', { name: `${previous}: your total $210.25 · No comparison for this month`, exact: true }).waitFor();
    await expect(bill()).toContainText('Across 1 matching month: your electric bill: $142.50/mo avg. Neighborhood: $104.70/mo avg.');
    await expect(bill()).toContainText('36% above neighborhood average');
    const monthLabel = date => new Date(date+'-15T12:00:00Z').toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    await expect(chart()).toContainText(monthLabel(current)); await expect(chart()).toContainText(monthLabel(previous));
    assert.equal(await currentBar().locator('div > div').count(), 2);
    await screenshot('01-fractional-matching-months');
    pass('Actual chart preserves decimal major units, combines household/month bills, matches month keys and labels correctly in Los Angeles');

    const change = holdNext('/bill-trends'); await currency().selectOption('CAD'); await change.wait();
    await expect(currentBar()).toHaveCount(0); await expect(currency()).toHaveCount(0);
    change.release(); await expect(currency()).toHaveValue('CAD');
    await page.getByRole('img', { name: `${current}: your total CA$999.99 · No comparison for this month`, exact: true }).waitFor();
    await expect(bill()).not.toContainText('neighborhood average');
    await expect(bill()).toContainText('Your recorded average: CA$999.99/month across 1 month.');
    await bill().getByText('View monthly amounts', { exact: true }).click();
    await expect(bill().getByRole('table')).toContainText('CA$999.99');
    await screenshot('02-cad-separate');
    await currency().selectOption('USD'); await currentBar().waitFor();
    pass('Held currency change retires the old chart; CAD has its own exact amount and no USD comparison');

    const saving = holdNext('/settings'); await share().locator('..').click(); await saving.wait();
    await expect(share()).toBeDisabled(); await expect(currency()).toBeDisabled();
    saving.release(); await expect(share()).not.toBeChecked();
    await expect(bill()).toContainText('1 more neighbor needed for comparison'); await expect(currentBar()).toHaveCount(0);
    await page.getByRole('img', { name: `${current}: your total $142.50 · No comparison for this month`, exact: true }).waitFor();
    await screenshot('03-opt-out-removes-comparison');
    await share().focus(); await page.keyboard.press('Space'); await expect(share()).toBeChecked(); await currentBar().waitFor();
    pass('Real pointer opt-out removes the tenth contributor and all peer amounts; keyboard opt-in restores the current cohort');

    failures.add('bill-trends'); await focus(); await retry('bill trends').waitFor(); await expect(chart()).toHaveCount(0);
    await screenshot('04-source-error'); failures.clear(); await retry('bill trends').focus(); await page.keyboard.press('Enter'); await currentBar().waitFor();
    malformed.add('bill-trends'); await focus(); await retry('bill trends').waitFor(); await expect(chart()).toHaveCount(0);
    malformed.clear(); await retry('bill trends').click(); await currentBar().waitFor();
    for (const mode of ['currency','nested','empty-series','floor']) {
      billFault = mode; await focus(); await retry('bill trends').waitFor(); await expect(chart()).toHaveCount(0);
      billFault = null; await retry('bill trends').click(); await currentBar().waitFor();
    }
    const stale = holdNext('/bill-trends'); await currency().selectOption('CAD'); await stale.wait();
    await visibility(true); await expect(title()).toHaveCount(0); stale.release();
    await visibility(false); await currentBar().waitFor(); await expect(currency()).toHaveValue('USD');
    pass('Read failures, wrong currency, malformed/empty nested series and sub-threshold amounts have explicit recovery; a held currency read cannot survive background retirement');

    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'finance.view',false);`);
    await focus(); await title().waitFor(); await expect(bill()).toHaveCount(0); await expect(share()).toHaveCount(0);
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`); await focus(); await currentBar().waitFor();
    pass('Current finance denial retires all private bill values and controls; restored authority can read again');

    sql(`UPDATE public."HomeBill" SET status='due' WHERE home_id=${q(home)};`);
    await focus(); await page.getByText('No paid USD bill history yet', { exact: true }).waitFor(); await expect(share()).toBeChecked();
    await screenshot('05-confirmed-empty');
    sql(`UPDATE public."HomeBill" SET status='paid' WHERE id IN (${f.bills.slice(0,13).map(q)});`);
    // 24 actual monthly rows exercise overflow without substituting synthetic chart data.
    sql(`INSERT INTO public."HomeBill"(home_id,created_by,bill_type,amount,currency,status,period_start)
      SELECT ${q(home)},${q(actor)},'electric',12.34,'USD','paid',(date_trunc('month',CURRENT_DATE)-make_interval(months=>n))::date
      FROM generate_series(0,23)n WHERE n NOT IN(1,2);`);
    await page.setViewportSize({ width: 390, height: 844 }); await focus(); await chart().waitFor();
    await expect(chart().getByRole('img')).toHaveCount(24);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await chart().evaluate(el => el.scrollWidth > el.clientWidth));
    await chart().focus(); await page.keyboard.press('End');
    await chart().evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await bill().getByText('View monthly amounts', { exact: true }).click();
    await expect(bill().getByRole('table').getByRole('row')).toHaveCount(25);
    await expect(bill().getByRole('table')).toContainText('$142.50');
    await screenshot('06-narrow-24-month-scroll');
    await bill().scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(evidence, '07-narrow-visible-amounts.png') });
    assert.deepEqual(errors, []);
    pass('Confirmed empty state retains sharing; 24 real SQL months fit a narrow viewport with a scrollable keyboard-focusable chart');
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ result: 'pass', checks, mutations, pageErrors: errors,
      limits: 'Actual Chrome/production HTTP/helper/services/SQL; synthetic identity/dashboard entities/property provider and deliberate response/lifecycle faults; no paid providers or native acceptance' }, null, 2));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(evidence, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
    throw error;
  } finally {
    for (const pending of holds) pending.release();
    if (context) await context.close(); if (browser) await browser.close();
    fs.writeFileSync(path.join(evidence, 'console-diagnostics.json'), JSON.stringify(diagnostics));
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { sql(`DELETE FROM public."HomeSeasonalChecklistItem" WHERE home_id=${q(home)};`); f.cleanup(); console.log('PASS: exact browser bill fixtures cleaned'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
