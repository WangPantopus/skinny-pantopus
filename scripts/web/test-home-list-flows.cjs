#!/usr/bin/env node
// Chrome -> production Home list/detail/task routes -> actual SDK/PostgREST/SQL.
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
let server, browser, page, initialized = false, currentActor = actor, listFailure = false, malformed = false, hold = null;
const errors = [], events = [];
const update = value => sql(`UPDATE public."HomeOccupancy" SET ${value} WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
const focus = () => page.evaluate(() => window.dispatchEvent(new Event('focus')));
const title = () => page.getByRole('link', { name: /Private list fixture.*Owner/ });
const screenshot = name => page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
async function verifyDifferentUnits() {
  const second = f.id(101);
  assert.equal(sql(`SELECT count(*) FROM public."Home" WHERE id=${q(second)};`), '0');
  sql(`BEGIN; INSERT INTO public."Home"(id,created_by_user_id,name,address,address2,city,state,zipcode)
    SELECT ${q(second)},${q(actor)},name,address,'303',city,state,zipcode FROM public."Home" WHERE id=${q(home)};
    INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
    VALUES(${q(second)},${q(actor)},'verified',true,'strong'); COMMIT;`);
  try {
    await focus();
    for (const [homeId, unit] of [[home, '301'], [second, '303']]) {
      const card = page.locator(`a[href="/app/homes/${homeId}/dashboard"]`).filter({ hasText: `Unit ${unit}` });
      await expect(card).toBeVisible();
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(async () => (await page.getByRole('heading', { name: 'My Homes', exact: true }).boundingBox())?.x).toBeLessThan(16.5);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await screenshot('01a-distinct-units-narrow');
    await page.setViewportSize({ width: 1100, height: 850 });
  } finally {
    sql(`BEGIN; DELETE FROM public."HomeOwner" WHERE home_id=${q(second)};
      DELETE FROM public."Home" WHERE id=${q(second)} AND created_by_user_id=${q(actor)}; COMMIT;`);
  }
  await focus(); await title().waitFor();
  console.log('PASS: same-named Homes at one street display their distinct SQL units and correct destinations without narrow overflow');
}
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
    sql(`UPDATE public."Home" SET name='Private list fixture',address2='301' WHERE id=${q(home)};
      UPDATE public."HomeOccupancy" SET verified_at=now(),start_at=NULL,access_end_at=NULL WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
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
          if (endpoint === '/api/homes/my-homes') {
            if (listFailure) { status = 503; body = { error: 'Could not load your Homes. Please retry.', code: 'HOME_LIST_UNAVAILABLE' }; }
            if (malformed) body = { homes: null };
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
    await page.goto(base + '/app/homes', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await title().waitFor(); await expect(page.getByRole('button', { name: 'Delete home', exact: true })).toBeVisible();
    await expect(page.getByText('Unit 301', { exact: true })).toBeVisible();
    await screenshot('01-current-owner');
    await verifyDifferentUnits();
    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'home.edit',false);`);
    await focus(); await title().waitFor(); await expect(page.getByRole('button', { name: 'Delete home', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};`);
    console.log('PASS: actual permitted Home and role render; guarded deletion deny removes Delete without hiding permitted dashboard');

    listFailure = true; await focus(); await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    await expect(title()).toHaveCount(0); await expect(page.getByText('No homes yet', { exact: true })).toHaveCount(0);
    await screenshot('02-unavailable-retry'); listFailure = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click(); await title().waitFor();
    malformed = true; await focus(); await page.getByRole('button', { name: 'Retry', exact: true }).waitFor(); await expect(title()).toHaveCount(0);
    malformed = false; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await title().waitFor();
    update('is_active=false'); await focus(); await page.getByText('No homes yet', { exact: true }).waitFor(); await expect(title()).toHaveCount(0);
    update('is_active=true'); await focus(); await title().waitFor();
    console.log('PASS: unavailable/malformed replies show finished Retry rather than empty or stale cards; actual revocation and restoration refresh list');

    let capture, release;
    const captured = new Promise(resolve => { capture = resolve; }), released = new Promise(resolve => { release = resolve; });
    hold = { capture, released }; await focus(); await captured;
    currentActor = f.users[5];
    await page.evaluate(() => { localStorage.setItem('pantopus_auth_session_change', 'list-new-account'); window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus_auth_session_change' })); });
    await page.getByText('No homes yet', { exact: true }).waitFor(); release(); await expect(title()).toHaveCount(0);
    currentActor = actor; await focus(); await title().waitFor();
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(title()).toHaveCount(0);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await title().waitFor();
    console.log('PASS: a produced old-account list cannot revive cards after switching accounts; background clears and foreground reloads');

    update("role='member',role_base='member',verification_status='pending_doc',verified_at=NULL");
    sql(`UPDATE public."HomeOwner" SET owner_status='pending' WHERE home_id=${q(home)} AND subject_id=${q(actor)};`);
    await focus(); await page.getByRole('link', { name: 'Continue verification', exact: true }).waitFor();
    await expect(page.getByText('Private list fixture', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Unit 301', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Continue verification', exact: true })).toHaveAttribute('href', `/app/homes/${home}/claim-owner/evidence`);
    await screenshot('03-applicant-personal-progress');
    sql(`DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};
      DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)} AND user_id<>${q(actor)};`);
    await focus(); await page.getByRole('link', { name: 'My tasks', exact: true }).waitFor();
    await expect(page.getByText('Private setup', { exact: true })).toBeVisible();
    await expect(page.getByText('Unit 301', { exact: true })).toBeVisible();
    await expect(page.getByText('Owner', { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(async () => (await page.getByRole('heading', { name: 'My Homes', exact: true }).boundingBox())?.x).toBeLessThan(16.5);
    await screenshot('04-private-setup-narrow');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.getByRole('link', { name: 'My tasks', exact: true }).click();
    await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
    await expect(page.getByRole('button', { name: /New Task|Add Task/i })).toBeVisible();
    await screenshot('05-real-private-task-first-use');
    assert(events.some(event => event.endpoint === `/api/homes/${home}/tasks` && event.status === 200));
    console.log('PASS: applicant has only personal verification; real private-setup list opens permitted Tasks with creation controls; narrow list has no overflow');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ errors, events }, null, 2));
  } finally {
    hold?.capture();
    if (browser) await browser.close();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (initialized) { f.cleanup(); console.log('PASS: exact browser list SQL cleanup'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
