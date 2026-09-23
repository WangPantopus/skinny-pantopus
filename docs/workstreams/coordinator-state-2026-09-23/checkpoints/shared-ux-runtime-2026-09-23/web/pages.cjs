// node pages.cjs <label> <path...>  -> saves text+shot per page (signed in as alice)
const fs = require('fs');
const { chromium } = require('/private/tmp/pantopus-shared-ux-edit/frontend/apps/web/node_modules/@playwright/test');
const { BASE, OUT, shot, text } = require('./lib.cjs');
const STATE = '/private/tmp/pantopus-shared-ux-runtime/web/.alice-state.json';
const [label, ...paths] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: STATE });
  const page = await context.newPage();
  for (const [i, p] of paths.entries()) {
    const reqs = [];
    const onResp = (r) => { const u = r.url(); if (u.includes('/api/') && r.status() >= 400) reqs.push(`${r.request().method()} ${new URL(u).pathname} ${r.status()}`); };
    page.on('response', onResp);
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);
    page.off('response', onResp);
    const name = `${label}-page${i}`;
    await shot(page, name);
    const t = await text(page, name);
    fs.appendFileSync(`${OUT}/${label}-pages.log`, `== ${p}\n4xx/5xx: ${JSON.stringify(reqs)}\n${t.split('\n').filter(Boolean).slice(-8).join('\n')}\n\n`);
    console.log('==', p, JSON.stringify(reqs)); console.log(t.split('\n').filter(Boolean).slice(-6).join(' | '));
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
