// node matched.cjs <label> <postId> : sign in as alice, open the post, record the Matched Businesses rows and where the first one leads.
const fs = require('fs');
const { BASE, OUT, open, login, shot } = require('./lib.cjs');
const [label, postId] = process.argv.slice(2);
(async () => {
  const { browser, page, requests } = await open();
  await login(page, 'alice');
  await page.goto(`${BASE}/app/feed/post/${postId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const out = [];
  const heading = page.getByText('Matched Businesses', { exact: false }).first();
  const has = await heading.count();
  out.push(`post page: ${page.url()}\nMatched Businesses heading present: ${has > 0}`);
  const links = page.locator('a[href*="sux_biz_0923"]');
  const n = await links.count();
  const hrefs = [];
  for (let i = 0; i < n; i++) hrefs.push(await links.nth(i).getAttribute('href'));
  out.push(`row links: ${JSON.stringify(hrefs)}`);
  if (has) await heading.scrollIntoViewIfNeeded();
  await shot(page, `${label}-post`);
  if (n > 0) {
    await links.first().click();
    await page.waitForTimeout(7000);
    const body = (await page.locator('body').innerText()).split('\n').filter(Boolean).slice(0, 10).join(' | ');
    await shot(page, `${label}-landed`);
    out.push(`landed: ${page.url()}\npage: ${body}`);
  }
  const bad = requests.filter((r) => r.status >= 400).map((r) => `${r.method} ${r.path} ${r.status}`);
  out.push(`api 4xx/5xx: ${JSON.stringify(bad)}`);
  fs.writeFileSync(`${OUT}/${label}-matched.txt`, out.join('\n') + '\n');
  console.log(out.join('\n'));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
