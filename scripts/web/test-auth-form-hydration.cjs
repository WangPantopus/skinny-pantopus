#!/usr/bin/env node
// Real browser/SSR checks. All form data is synthetic; auth responses are controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { chromium, expect } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, evidence] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const pages = ['/login', '/register', '/forgot-password', '/reset-password'];
const results = [];
let browser;

async function main() {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const pathname of pages) {
    // A failed JavaScript load must leave the actual server-rendered form inert.
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await page.goto(base + pathname, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const form = page.locator('form');
    await expect(form).toHaveAttribute('method', 'post');
    const inputs = form.locator('input, button, select, textarea');
    assert(await inputs.count() > 0);
    for (const input of await inputs.all()) await expect(input).toBeDisabled();
    await expect(page.getByText('Enable JavaScript to use this form.', { exact: true })).toBeVisible();
    assert.equal(new URL(page.url()).search, '');
    await page.screenshot({ path: path.join(evidence, pathname.slice(1) + '-no-javascript.png'), fullPage: true });
    results.push({ page: pathname, no_javascript: { all_form_controls_disabled: true, method: 'post', no_query_data: true } });
    await context.close();
  }
  for (const [index, pathname] of pages.entries()) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const posts = [];
    let releaseScripts;
    const scriptsReady = new Promise(resolve => { releaseScripts = resolve; });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) return route.abort();
      if (url.pathname.startsWith('/api/')) {
        if (request.method() === 'POST' && url.pathname.startsWith('/api/users/')) {
          const payload = JSON.parse(request.postData() || '{}');
          posts.push({ method: request.method(), path: url.pathname, fields: Object.keys(payload).sort(),
            email_matches: pathname === '/reset-password' || payload.email === 'auth-hydration@example.invalid',
            password_matches: pathname === '/forgot-password' || (payload.password || payload.newPassword) === 'synthetic-hydration-password',
            return_or_reset_matches: pathname === '/reset-password' ? payload.token === 'synthetic-reset-proof'
              : pathname === '/login' || payload.redirectTo === '/app/homes' });
        }
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Controlled auth form response' }) });
      }
      if (request.resourceType() === 'script') await scriptsReady;
      return route.continue();
    });
    const suffix = pathname === '/reset-password' ? '?token_hash=synthetic-reset-proof' : '?redirectTo=%2Fapp%2Fhomes';
    await page.goto(base + pathname + suffix, { waitUntil: 'commit', timeout: 120000 });
    const form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 60000 });
    for (const input of await form.locator('input, button').all()) await expect(input).toBeDisabled();
    assert.equal(posts.length, 0);
    releaseScripts();
    const first = form.locator('input').first();
    await expect(first).toBeEnabled({ timeout: 60000 });
    const email = form.locator('input[type="email"]');
    if (await email.count()) await email.fill('auth-hydration@example.invalid');
    for (const input of await form.locator('input[type="password"]').all()) await input.fill('synthetic-hydration-password');
    for (const checkbox of await form.locator('input[type="checkbox"]').all()) await checkbox.check();
    await form.locator('button[type="submit"]').click();
    await expect.poll(() => posts.length).toBe(1);
    await expect(form.getByRole('alert')).toContainText('Controlled auth form response');
    assert(posts[0].email_matches && posts[0].password_matches && posts[0].return_or_reset_matches);
    assert.equal(posts[0].path, '/api/users' + pathname);
    assert.equal(new URL(page.url()).search, suffix);
    assert.equal(new URL(page.url()).pathname, pathname);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidence, pathname.slice(1) + '-hydrated.png'), fullPage: true });
    results[index].delayed_javascript = { disabled_before_handlers: true, enabled_after_hydration: true,
      controlled_api_post: posts[0], no_native_navigation: true, no_horizontal_overflow: true };
    await context.close();
  }
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ pass: true, results }, null, 2), { mode: 0o600 });
  console.log('PASS: four auth forms remain inert without JavaScript and submit through the API after delayed hydration.');
}
main().catch(error => {
  fs.writeFileSync(path.join(evidence, 'failure.txt'), String(error.stack), { mode: 0o600 });
  console.error('Auth form browser verification failed; private diagnostics retained.'); process.exitCode = 1;
}).finally(() => browser?.close());
