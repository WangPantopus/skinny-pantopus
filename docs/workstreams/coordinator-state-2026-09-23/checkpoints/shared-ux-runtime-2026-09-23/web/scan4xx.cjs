const fs = require('fs');
const { chromium } = require('/private/tmp/pantopus-shared-ux-edit/frontend/apps/web/node_modules/@playwright/test');
const { BASE } = require('./lib.cjs');
const STATE = '/private/tmp/pantopus-shared-ux-runtime/web/.alice-state.json';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: STATE });
  const page = await context.newPage();
  let requests = [];
  page.on('response', (r) => { const u = r.url(); if (u.includes('/api/') && r.status() >= 400) requests.push(`${r.request().method()} ${new URL(u).pathname} ${r.status()}`); });
  for (const p of (process.argv[2] ? process.argv.slice(2) : ['/app/hub'])) {
    requests = [];
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    const counts = {};
    for (const r of requests) counts[r] = (counts[r] || 0) + 1;
    console.log(p, JSON.stringify(counts));
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
