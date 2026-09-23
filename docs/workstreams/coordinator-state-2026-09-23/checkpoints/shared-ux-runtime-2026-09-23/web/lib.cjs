// Shared UX web e2e helper: isolated headless Chrome (temp profile) against my Next on sharedux.localhost:18139.
const path = require('path');
const { chromium } = require('/private/tmp/pantopus-shared-ux-edit/frontend/apps/web/node_modules/@playwright/test');
const fs = require('fs');
const BASE = 'http://sharedux.localhost:18139';
const OUT = '/private/tmp/pantopus-shared-ux-runtime/web/out';
fs.mkdirSync(OUT, { recursive: true });
const STATE = '/private/tmp/pantopus-shared-ux-runtime/web/.alice-session.json';
async function open({ mobile = false, fresh = false } = {}) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } };
  // Reuse the saved alice session (cookies) so each run doesn't hit the login rate limit.
  const useState = !fresh && fs.existsSync(STATE);
  const context = await browser.newContext(useState ? { ...base, storageState: STATE } : base);
  const page = await context.newPage();
  const requests = [];
  page.on('response', (r) => { const u = r.url(); if (u.includes('/api/')) requests.push({ at: new Date().toISOString(), method: r.request().method(), path: new URL(u).pathname, status: r.status() }); });
  return { browser, context, page, requests };
}
async function login(page, handle = 'alice') {
  if (handle === 'alice' && fs.existsSync(STATE)) {
    await page.goto(BASE + '/app/hub', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    if (!new URL(page.url()).pathname.startsWith('/login')) return; // session still valid
  }
  const pw = fs.readFileSync('/private/tmp/pantopus-shared-ux-runtime/.fixture-password', 'utf8').trim();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('you@example.com').fill(`sux.${handle}.0923@example.com`);
  await page.getByPlaceholder('Your password').fill(pw);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 });
  if (handle === 'alice') await page.context().storageState({ path: STATE });
}
async function shot(page, name) { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p, fullPage: false }); return p; }
async function text(page, name, selector = 'main') {
  let t = '';
  try { t = await page.locator(selector).first().innerText({ timeout: 5000 }); } catch { t = await page.locator('body').innerText(); }
  fs.writeFileSync(path.join(OUT, name + '.txt'), t);
  return t;
}
function saveRequests(requests, name) { fs.writeFileSync(path.join(OUT, name + '.requests.jsonl'), requests.map((r) => JSON.stringify(r)).join('\n') + '\n'); }
module.exports = { BASE, OUT, open, login, shot, text, saveRequests };
