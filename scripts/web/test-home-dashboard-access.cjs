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
const holds = [], errors = [], diagnostics = [], mutations = [], checks = [], recordReads = [];
let resourceFailure = null, malformedResource = null;
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
      UPDATE public."User" SET username='current_household_member',name='Private legal fixture name' WHERE id=${q(f.users[4])};
      INSERT INTO public."HomeTask"(id,home_id,created_by,task_type,title,due_at) VALUES(${q(f.id(901))},${q(home)},${q(actor)},'chore','Check the smoke alarm',now()-interval '1 hour');
      INSERT INTO public."HomeCalendarEvent"(id,home_id,created_by,event_type,title,start_at) VALUES(${q(f.id(902))},${q(home)},${q(actor)},'other','Quarterly Home check',now()+interval '10 minutes');
      INSERT INTO public."HomeBill"(id,home_id,created_by,bill_type,provider_name,amount,currency,status,due_date) VALUES
        (${q(f.id(903))},${q(home)},${q(actor)},'electric','House electricity USD',142.50,'USD','overdue',CURRENT_DATE-1),
        (${q(f.id(904))},${q(home)},${q(actor)},'water','Water CAD',999.99,'CAD','due',CURRENT_DATE+1);
      INSERT INTO public."HomeIssue"(id,home_id,reported_by,title,status) VALUES(${q(f.id(905))},${q(home)},${q(actor)},'Loose kitchen handle','scheduled');
      INSERT INTO public."HomeIssue"(id,home_id,reported_by,title,status) VALUES
        (${q(f.id(910))},${q(home)},${q(actor)},'Dripping faucet','open'),
        (${q(f.id(911))},${q(home)},${q(actor)},'Repairing gate','in_progress');
      INSERT INTO public."HomePackage"(id,home_id,created_by,status,vendor_name,expected_at) VALUES
        (${q(f.id(906))},${q(home)},${q(actor)},'expected','Package fixture',now()+interval '2 days'),
        (${q(f.id(907))},${q(home)},${q(actor)},'out_for_delivery','Arriving fixture',now());
      INSERT INTO public."HomeDocument"(id,home_id,created_by,title,doc_type) VALUES(${q(f.id(908))},${q(home)},${q(actor)},'Appliance manual','manual');
      INSERT INTO public."HomePet"(id,home_id,created_by,name,species) VALUES(${q(f.id(909))},${q(home)},${q(actor)},'Maple','cat');`);
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
        } else if (new RegExp(`/api/homes/${home}/(tasks|issues|bills|packages|documents|events|pets)$`).test(endpoint)) {
          const kind = endpoint.split('/').at(-1); recordReads.push(kind);
          if (resourceFailure === kind) {
            if (kind === 'tasks' || kind === 'events') f.failNextRpc('get_home_records');
            else f.failNextQuery(({ issues: 'HomeIssue', bills: 'HomeBill', packages: 'HomePackage', documents: 'HomeDocument', pets: 'HomePet' })[kind]);
          }
          const response = await fetch(apiBase + endpoint, { headers: { 'x-fixture-actor': currentActor }, signal: AbortSignal.timeout(20000) });
          body = await response.json(); status = response.status;
          if (malformedResource === kind && status === 200) body = { [kind]: null };
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
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.getByText('Check the smoke alarm', { exact: true }).first().waitFor();
    await page.getByText('Quarterly Home check', { exact: true }).first().waitFor();
    await page.getByText('USD 142.50', { exact: true }).first().waitFor();
    await expect(page.getByText('All clear!', { exact: true })).toHaveCount(0);
    const dueCard = page.getByRole('button', { name: /Bills due$/ }); await expect(dueCard).toContainText('2');
    await expect(page.getByRole('button', { name: 'Deliveries', exact: true })).toContainText('2 pending');
    await expect(page.getByLabel('Property Details', { exact: true })).not.toContainText('ATTOM');
    await screenshot('00-real-populated-overview');
    await page.getByRole('button', { name: /Open issues$/ }).click();
    await page.getByRole('heading', { name: 'Maintenance', exact: true }).waitFor();
    await page.getByText('Loose kitchen handle', { exact: true }).first().waitFor();
    await page.getByText('Dripping faucet', { exact: true }).first().waitFor();
    await page.getByText('Repairing gate', { exact: true }).first().waitFor();
    await screenshot('00-real-active-maintenance');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: /Pending packages$/ }).click();
    await page.getByRole('heading', { name: 'Deliveries', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    const calendarCard = page.getByRole('button', { name: 'Calendar', exact: true });
    await calendarCard.focus(); await page.keyboard.press('Space');
    await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    const billsCard = page.getByRole('button', { name: 'Bills & Budget', exact: true });
    await billsCard.focus(); await page.keyboard.press('Enter');
    await page.getByText('CAD 999.99', { exact: true }).first().waitFor();
    await page.getByText('USD 142.50', { exact: true }).first().waitFor();
    await expect(page.getByText(/1,142.49|1142.49/)).toHaveCount(0);
    const billDate = sql(`SELECT to_char(due_date,'Mon FMDD') FROM public."HomeBill" WHERE id=${q(f.id(903))};`);
    await expect(page.getByText(`Due ${billDate}`, { exact: true }).first()).toBeVisible();
    await screenshot('00-real-separate-bill-currencies');
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'finance.manage',false);`);
    await focus(); await title().waitFor(); await page.getByText('Bills & Budget', { exact: true }).click();
    await page.getByText('CAD 999.99', { exact: true }).first().waitFor();
    await expect(page.getByRole('button', { name: 'Mark Paid', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '+ Add Bill', exact: true })).toHaveCount(0);
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(actor)} AND permission='finance.manage';`);
    const deniedCollections = ['tasks.view', 'maintenance.view', 'finance.view', 'packages.view', 'docs.view', 'calendar.view', 'members.view'];
    sql(deniedCollections.map(permission => `INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},${q(permission)},false);`).join('\n'));
    const beforeDenied = recordReads.length;
    await focus(); await title().waitFor();
    assert(!recordReads.slice(beforeDenied).some(kind => ['tasks', 'issues', 'bills', 'packages', 'documents', 'events'].includes(kind)));
    for (const label of ['Tasks', 'Maintenance', 'Bills & Budget', 'Deliveries', 'Documents', 'Calendar']) {
      await expect(page.locator('[role="button"][aria-label]').filter({ has: page.getByRole('heading', { name: label, exact: true }) })).toHaveCount(0);
    }
    await expect(row()).toHaveCount(0);
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    await focus(); await title().waitFor();
    await page.getByRole('button', { name: 'Members & Security', exact: true }).click(); await restored();
    pass('Real populated overview has working issue/package shortcuts and keyboard cards; USD/CAD keep exact fractions and calendar dates; finance viewers have no bill-write controls');
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

    const readsBeforeFailure = recordReads.length;
    dashboardFailure = true; await focus(); await reload().waitFor(); await absent();
    assert.equal(recordReads.length, readsBeforeFailure);
    await expect(page.getByText('All clear!', { exact: true })).toHaveCount(0);
    await screenshot('05-aggregate-unavailable-without-fallback');
    dashboardFailure = false; await reload().click(); await restored();
    resourceFailure = 'packages'; await focus(); await reload().waitFor(); await absent();
    resourceFailure = null; await reload().click(); await restored();
    malformedResource = 'documents'; await focus(); await reload().waitFor(); await absent();
    malformedResource = null; await reload().click(); await restored();
    const entity = holdNext('/tasks'); await focus(); await entity.wait(); changeAccess(false); await focus(); await reload().waitFor(); entity.release(); await absent();
    changeAccess(true); await reload().click(); await restored();
    pass('Aggregate failure makes no fallback collection reads; required SQL failure and malformed collection stay unavailable; held entity cannot revive denied data');
    resourceFailure = 'pets'; await focus(); await restored();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Current pets could not be loaded' }).waitFor();
    await expect(page.getByText('Maple', { exact: true })).toHaveCount(0);
    await screenshot('05-pets-unavailable-with-current-summary'); resourceFailure = null;
    await page.getByRole('button', { name: 'Retry pets', exact: true }).click();
    await page.getByText('Maple', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Members & Security', exact: true }).click(); await restored();
    pass('An optional real pet read failure is an explicit card error, and Retry restores the current pet');

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
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click(); await reload().waitFor(); await absent();
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(currentActor)},'home.view',true);`);
    await reload().click(); await title().waitFor();
    await expect(invite()).toHaveCount(0); await expect(page.getByText('Owner', { exact: true })).toHaveCount(0);
    currentActor = actor; await focus(); await restored();
    pass('Revoked and future-start pending occupancies cannot enter verification; pending verification remains separate; verified membership without home.view stays denied, and an explicit grant restores its Home without owner controls');

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
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ result: 'pass', checks, mutations: 0, pageErrors: errors, limits: 'Actual Chrome, production dashboard/IAM HTTP/helpers/services and PostgreSQL; synthetic auth/ancillary endpoints and deterministic lifecycle events; core dashboard and tasks/issues/bills/packages/documents/events/pets use production HTTP/services/SQL. No provider, full entity-write or native acceptance.' }, null, 2));
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
