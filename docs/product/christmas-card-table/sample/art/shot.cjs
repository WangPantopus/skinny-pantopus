#!/usr/bin/env node
// usage: node shot.cjs <url> <outPrefix> <w> <h> <dpr> "step[:json],step..."   Screenshots each sample state in a phone-sized headless Chrome.
const path = require('path');
const PW = process.env.PLAYWRIGHT_TEST || path.resolve(__dirname, '../../../../../../frontend/apps/web/node_modules/@playwright/test');
const { chromium } = require(PW);
(async () => {
  const [url, out, w, h, dpr, steps] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, hasTouch: true, isMobile: +w < 560, colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  for (const raw of steps.split(',')) {
    const [step, json] = raw.split(':');
    const opts = json ? Object.fromEntries(json.split(';').map((kv) => { const [k, v] = kv.split('='); return [k, Number(v)]; })) : {};
    await page.evaluate(([s, o]) => window.__sample.go(s, o), [step, opts]);
    await page.waitForTimeout(150);
    const name = `${out}-${step}${json ? '-' + json.replace(/[^a-z0-9.]/gi, '') : ''}.jpg`;
    await page.screenshot({ path: name, type: 'jpeg', quality: 86 });
    console.log(name);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
