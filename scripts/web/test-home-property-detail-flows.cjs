#!/usr/bin/env node
// Chrome -> production property/detail/occupants routes -> actual SDK/PostgREST/SQL.
// Login and unrelated sidebar APIs are controlled; no provider or hosted calls.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const { chromium, expect } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, container, evidence, project, supabase] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const f = require('../db/home-residency-review-http-fixture.cjs')(container, { summary: true, dashboard: true });
const { actor, home, sql, q } = f;
let server, browser, page, initialized = false, currentActor = actor, propertyFailure = false, malformed = false, hold = null;
const errors = [], events = [];
const update = value => sql(`UPDATE public."HomeOccupancy" SET ${value} WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
const focus = () => page.evaluate(() => window.dispatchEvent(new Event('focus')));
const title = () => page.getByRole('heading', { name: 'Private property fixture', exact: true });
const screenshot = name => page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
async function main() {
  try {
    let config;
    try { config = JSON.parse(execFileSync(supabase, ['status', '--workdir', project, '-o', 'json'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
    })); } catch (_) { throw new Error('Owned local Supabase configuration unavailable'); }
    assert.equal(config.API_URL, 'http://127.0.0.1:64521');
    const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
    f.useDatabaseClient(createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
    f.setup(); initialized = true;
    sql(`UPDATE public."Home" SET name='Private property fixture' WHERE id=${q(home)};
      UPDATE public."HomeOccupancy" SET verified_at=now(),start_at=NULL,access_end_at=NULL WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
    const property = { attomPayload: { provider: 'ATTOM', endpoint: '/property/detail', fetched_at: new Date().toISOString(), status: null,
      property: { address: { oneLine: 'Private property fixture', line2: 'Test, WA 98607' }, building: { rooms: { beds: 3 } } }, full_response: null }, source: 'cache' };
    f.setPropertyDetailResult(property);
    server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const apiBase = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1100, height: 850 } });
    await context.addCookies([{ name: 'pantopus_session', value: '1', url: base }, { name: 'pantopus_access', value: 'synthetic-local-session', url: base, httpOnly: true }]);
    await context.route('**/*', async route => {
      const request = route.request(), parsed = new URL(request.url()), endpoint = parsed.pathname;
      if (parsed.origin !== base) return route.abort();
      if (!endpoint.startsWith('/api/')) return endpoint.startsWith('/socket.io/') ? route.fulfill({ status: 503, body: '' }) : route.continue();
      let body = {}, status = 200;
      try {
        if (request.method() !== 'GET') throw new Error('Unexpected mutation in list acceptance');
        if (endpoint === '/api/users/profile') body = { user: { id: currentActor, username: 'list_fixture', name: 'List fixture', account_type: 'personal', email_verified: true } };
        else if (endpoint === '/api/homes/my-homes' || endpoint === '/api/homes/primary' || endpoint === `/api/homes/${home}` || endpoint.startsWith(`/api/homes/${home}/`)) {
          const openingActor = currentActor;
          const response = await fetch(apiBase + endpoint + parsed.search, { headers: { 'x-fixture-actor': openingActor }, signal: AbortSignal.timeout(30000) });
          body = await response.json(); status = response.status;
          events.push({ endpoint, status, actor: openingActor });
          if (endpoint === `/api/homes/${home}/property-details`) {
            if (propertyFailure) { status = 503; body = { error: 'Could not load this Home information. Please retry.', code: 'HOME_DETAIL_UNAVAILABLE' }; }
            if (malformed) body = { home: { id: home }, source: 'cache', attom_property_detail: [] };
            if (hold) { const pending = hold; hold = null; pending.capture(); await pending.released; }
          }
        } else if (endpoint.includes('claims')) body = { claims: [] };
        else if (endpoint.includes('conversations')) body = { conversations: [], hasMore: false };
        else if (endpoint.includes('unread') || endpoint.includes('badge')) body = { count: 0, unreadCount: 0, total: 0, byContext: {} };
        else if (endpoint.includes('business')) body = { businesses: [], seats: [] };
        else if (endpoint.includes('homes')) body = { homes: [], entries: [], invitations: [] };
      } catch (error) { errors.push(error.message); status = 503; body = { error: 'Local acceptance request failed' }; }
      await route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(body) }).catch(() => {});
    });
    page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + `/app/homes/${home}/property-details`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await title().waitFor(); await expect(page.getByText('Beds', { exact: true }).first()).toBeVisible();
    await screenshot('01-current-property');
    propertyFailure = true; await focus(); await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    await expect(title()).toHaveCount(0); await expect(page.getByText('No Property Data Available', { exact: true })).toHaveCount(0);
    await screenshot('02-failure-retry'); propertyFailure = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click(); await title().waitFor();
    malformed = true; await focus(); await page.getByRole('button', { name: 'Retry', exact: true }).waitFor(); await expect(title()).toHaveCount(0);
    malformed = false; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await title().waitFor();
    update('is_active=false'); await focus(); await page.getByRole('alert').waitFor(); await expect(title()).toHaveCount(0);
    update('is_active=true'); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await title().waitFor();
    console.log('PASS: actual property route displays records, failures/malformed data show Retry, and actual revocation retires data then recovers');

    let capture, release;
    const captured = new Promise(resolve => { capture = resolve; }), released = new Promise(resolve => { release = resolve; });
    hold = { capture, released }; await focus(); await captured;
    currentActor = f.users[5];
    await page.evaluate(() => { localStorage.setItem('pantopus_auth_session_change', 'property-new-account'); window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus_auth_session_change' })); });
    await page.getByRole('alert').waitFor(); release(); await expect(title()).toHaveCount(0);
    currentActor = actor; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await title().waitFor();
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(title()).toHaveCount(0);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await title().waitFor();
    console.log('PASS: produced old-account property response cannot revive data; background clears and foreground reloads');

    f.setPropertyDetailResult({ attomPayload: null, source: 'unavailable', unavailableReason: 'ATTOM_UNAVAILABLE' });
    await focus(); await page.getByRole('heading', { name: 'No Property Data Available', exact: true }).waitFor();
    await expect(page.getByText('Public records could not be loaded right now. Try again in a moment.', { exact: true })).toBeVisible();
    await screenshot('03-provider-unavailable'); f.setPropertyDetailResult(property);
    await page.getByRole('button', { name: 'Retry property records', exact: true }).click(); await title().waitFor();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(async () => (await page.getByRole('heading', { name: 'Property Details', exact: true }).boundingBox())?.x).toBeLessThan(180);
    await screenshot('04-property-narrow');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    console.log('PASS: unavailable property records remain separate from address verification, retry recovers, and settled narrow layout does not overflow');
    sql(`UPDATE public."Home" SET entry_instructions='ENTRY_KEEP',parking_instructions='PARKING_KEEP' WHERE id=${q(home)};
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'access.view_codes',false);`);
    await page.goto(base + `/app/homes/${home}/edit`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Home Settings', exact: true }).waitFor();
    await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeVisible();
    await expect(page.getByText('Entry instructions', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Parking instructions', { exact: true })).toHaveCount(0);
    await expect(page.getByText('ENTRY_KEEP', { exact: true })).toHaveCount(0);
    console.log('PASS: real detail consumer keeps unreadable instruction controls absent while ordinary Home editing remains reachable');

    // An admitted member can contact the permitted verified primary owner even
    // when that owner has no occupancy. No message is sent in this acceptance.
    sql(`DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id=${q(actor)};
      UPDATE public."HomeOccupancy" SET is_active=true,verification_status='verified',verified_at=now(),
        start_at=NULL,end_at=NULL,access_start_at=NULL,access_end_at=NULL WHERE home_id=${q(home)} AND user_id=${q(f.users[1])};
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed)
        SELECT ${q(home)},${q(f.users[1])},p::public.home_permission,true FROM unnest(ARRAY['home.view','members.view','ownership.view']) p;`);
    currentActor = f.users[1];
    await page.goto(base + `/app/homes/${home}/messages`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.pathname === `/app/chat/conversation/${actor}`);
    console.log('PASS: Home contact navigation uses the permitted verified primary-owner reference without an occupancy; no message sent');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ errors, events }, null, 2));
  } finally {
    hold?.capture();
    if (browser) await browser.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact browser property SQL cleanup'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
