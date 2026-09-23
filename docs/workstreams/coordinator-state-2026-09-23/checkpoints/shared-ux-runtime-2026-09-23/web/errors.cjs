// Usage: node errors.cjs <label> <phase>
//   phase=login  : sign in, save storage state
//   phase=retry  : C-24 403 page, count requests
//   phase=today  : C-13 Today page (run while the backend is stopped)
//   phase=post   : C-23 composer rejection reason (run with backend up)
const fs = require('fs');
const { chromium } = require('/private/tmp/pantopus-shared-ux-edit/frontend/apps/web/node_modules/@playwright/test');
const { BASE, OUT, login, shot, text, saveRequests } = require('./lib.cjs');
const STATE = '/private/tmp/pantopus-shared-ux-runtime/web/.alice-state.json';
const [label, phase] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(phase !== 'login' && fs.existsSync(STATE) ? { storageState: STATE } : {}) });
  const page = await context.newPage();
  const requests = [];
  page.on('response', (r) => { const u = r.url(); if (u.includes('/api/')) requests.push({ at: new Date().toISOString(), method: r.request().method(), path: new URL(u).pathname, status: r.status() }); });
  page.on('requestfailed', (r) => { const u = r.url(); if (u.includes('/api/')) requests.push({ at: new Date().toISOString(), method: r.method(), path: new URL(u).pathname, failed: r.failure()?.errorText }); });
  if (phase === 'login') {
    await login(page);
    await context.storageState({ path: STATE });
    fs.chmodSync(STATE, 0o600);
    console.log('logged in at', page.url());
  } else if (phase === 'retry') {
    const homeId = '00000000-5a5a-4a5a-8a5a-000000000403';
    await page.goto(`${BASE}/app/homes/${homeId}/privacy`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);
    const hits = requests.filter((r) => r.path.includes(homeId) || r.path.includes("privacy") || r.path.includes("public-preview"));
    console.log("all api:", JSON.stringify(requests.map((h) => `${h.method} ${h.path} ${h.status||h.failed}`)));
    console.log('requests for the 403 home:', hits.length, JSON.stringify(hits.map((h) => `${h.method} ${h.path} ${h.status}`)));
    saveRequests(hits, `${label}-retry`);
    await shot(page, `${label}-retry`);
    console.log((await text(page, `${label}-retry`)).slice(0, 800));
  } else if (phase === 'retry403') {
    // Fault injection: the primary-Home read answers 403 (as for a member who was just removed).
    let attempts = 0;
    await page.route('**/api/homes/primary', (route) => { attempts += 1; return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Not authorized' }) }); });
    await page.goto(`${BASE}/app/place/identity`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);
    console.log('attempts for GET /api/homes/primary (403):', attempts);
    fs.writeFileSync(`${OUT}/${label}-retry403.attempts.txt`, `GET /api/homes/primary answered 403 by fault injection; attempts in 9 s: ${attempts}\n`);
    await shot(page, `${label}-retry403`);
    console.log((await text(page, `${label}-retry403`)).slice(0, 600));
  } else if (phase === 'chatsend') {
    // A room the viewer is not in: the server refuses the send with a reason (403 "Not a participant").
    const roomId = '00000000-5a5a-4a5a-8a5a-000000000404';
    await page.goto(`${BASE}/app/chat/${roomId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const box = page.locator('input[placeholder]:not([type="search"])').last();
    await box.click();
    await box.fill('hello from the shared UX check');
    await box.press('Enter');
    await page.waitForTimeout(4000);
    const sends = requests.filter((r) => r.path === '/api/chat/messages');
    console.log('send requests:', JSON.stringify(sends));
    saveRequests(sends, `${label}-chatsend`);
    await shot(page, `${label}-chatsend`);
    const t = await text(page, `${label}-chatsend`, 'body');
    const lines = t.split('\n').filter((l) => /send|participant|fail/i.test(l));
    console.log('error lines:', JSON.stringify(lines));
  } else if (phase === 'compose') {
    // The Pulse composer: the server refuses a Place post from an account with no verified home.
    await page.goto(`${BASE}/app/hub`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.getByRole('button', { name: 'Quick actions' }).click();
    await page.getByText('Post to Pulse', { exact: true }).click();
    await page.waitForTimeout(1500);
    const dialog = page.locator('div.fixed').filter({ hasText: 'Choose where this post should go' }).last();
    await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.waitForTimeout(1000);
    const box = dialog.locator('textarea').first();
    await box.click();
    await box.fill('Does anyone know a good plumber nearby? (shared UX check)');
    await page.waitForTimeout(500);
    await shot(page, `${label}-compose-filled`);
    const cta = dialog.locator('button:not([disabled])').filter({ hasNotText: /Cancel/ }).last();
    const ctaText = await cta.innerText().catch(() => '?');
    console.log('cta:', ctaText);
    await cta.click();
    await page.waitForTimeout(4000);
    const posts = requests.filter((r) => r.path === '/api/posts' && r.method === 'POST');
    console.log('post requests:', JSON.stringify(posts));
    saveRequests(posts, `${label}-compose`);
    await shot(page, `${label}-compose`);
    const t = await page.locator('body').innerText();
    const toasts = await page.locator('[data-sonner-toast], [role="status"], [role="alert"]').allInnerTexts().catch(() => []);
    console.log('toasts:', JSON.stringify(toasts));
    fs.writeFileSync(`${OUT}/${label}-compose.txt`, `toasts: ${JSON.stringify(toasts)}\n\n${t}`);
  } else if (phase === 'today') {
    await page.goto(`${BASE}/app/today`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(12000);
    saveRequests(requests, `${label}-today`);
    await shot(page, `${label}-today`);
    console.log((await text(page, `${label}-today`)).slice(0, 800));
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
