#!/usr/bin/env node
// Runs named snapshots of the sample in headless Chrome: node flow.cjs w h dpr prefix name=js ...
const path = require('path');
const PW = process.env.PLAYWRIGHT_TEST || path.resolve(__dirname, '../../../../../../frontend/apps/web/node_modules/@playwright/test');
const { chromium } = require(PW);
(async () => {
  const [w, h, dpr, prefix, ...steps] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, hasTouch: true, isMobile: +w < 560 });
  const page = await ctx.newPage();
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) console.log('HTTP', r.status(), r.url()); });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:18990/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  for (const s of steps) {
    const i = s.indexOf('=');
    const name = s.slice(0, i), js = s.slice(i + 1);
    const r = await page.evaluate(js);
    if (r !== undefined && r !== null) console.log(name, JSON.stringify(r));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `../shots/${prefix}-${name}.jpg`, type: 'jpeg', quality: 86 });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
