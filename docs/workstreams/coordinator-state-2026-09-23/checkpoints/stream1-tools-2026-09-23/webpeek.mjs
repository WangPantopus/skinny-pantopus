// webpeek.mjs <url> <actorId> <outPng> : open a web page on the Stream 1 Next dev as a fixture actor and save a full-page screenshot + text.
import { chromium } from '/private/tmp/pantopus-stream1-acctdel/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
import { writeFileSync } from 'node:fs';
const [url, actorId, outPng] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  await context.addCookies([
    { name: 'pantopus_access', value: actorId, domain: 'localhost', path: '/' },
    { name: 'pantopus_session', value: '1', domain: 'localhost', path: '/' },
  ]);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outPng, fullPage: true });
  writeFileSync(outPng.replace(/\.png$/, '.txt'), await page.innerText('body'));
  console.log('saved', page.url());
} finally { await browser.close(); }
