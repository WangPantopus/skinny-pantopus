#!/usr/bin/env node
// Renders every share picture from share.html: the same paper and light as the card on the table.
const path = require('path');
const PW = process.env.PLAYWRIGHT_TEST || path.resolve(__dirname, '../../../../../../frontend/apps/web/node_modules/@playwright/test');
const { chromium } = require(PW);
(async () => {
  const only = process.argv[2];
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const sizes = { story: [540, 960], post: [540, 675], link: [600, 315] };
  for (const n of [8, 1, 24]) {
    for (const f of ['story', 'post', 'link']) {
      for (const v of f === 'link' ? ['card'] : ['card', 'note', 'sealed']) {
        const tag = `${String(n).padStart(2, '0')}-${f}-${v}`;
        if (only && !tag.includes(only)) continue;
        const ctx = await browser.newContext({ viewport: { width: sizes[f][0], height: sizes[f][1] }, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        await page.goto(`http://127.0.0.1:18990/share.html#n=${n}&v=${v}&f=${f}`, { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
          await document.fonts.ready;
          const urls = [...document.querySelectorAll('*')].map((el) => getComputedStyle(el).backgroundImage).filter((b) => b.startsWith('url(')).map((b) => b.slice(5, -2));
          await Promise.all([...urls.map((u) => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); }), ...[...document.images].map((i) => i.decode().catch(() => {}))]);
        });
        await page.waitForTimeout(350);
        await page.screenshot({ path: `${__dirname}/../a/share-${tag}.jpg`, type: 'jpeg', quality: 88 });
        await ctx.close();
        console.log(tag);
      }
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
