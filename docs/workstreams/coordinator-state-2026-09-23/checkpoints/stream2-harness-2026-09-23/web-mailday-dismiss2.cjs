// Route-drift item 5 (round 2): dismiss the mailbox Mail Day banner, then reload, open a new tab,
// and simulate the next day by rewriting the stored day. Prints the summary/dismiss requests seen.
// Usage: node web-mailday-dismiss2.cjs <who> <shot-prefix>
const w = require('./web-lib.cjs');
const KEY = 'pantopus_mailday_summary_dismissed';
(async () => {
  const [who, shot] = process.argv.slice(2);
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const log = [];
  const watch = (page, tag) => page.on('response', (resp) => {
    const u = resp.url().replace(w.WEB, '');
    if (/mailday\/summary/.test(u)) log.push(`[${tag}] ${resp.request().method()} ${u} ${resp.status()}`);
  });
  // The banner line is "<greeting> · N new item(s) ..."; the drawer list header ("N new items") is not the banner.
  const banner = async (page) => ((await page.innerText('body')).split('\n').find((l) => /^\s*Good (morning|afternoon|evening)\s*·\s*\d+ new item/.test(l)) || '(no banner)').trim();
  const stored = async (page) => page.evaluate((k) => { try { return localStorage.getItem(k); } catch (e) { return 'ERR ' + e.message; } }, KEY);
  const page = await ctx.newPage(); watch(page, 'tab1');
  await page.goto(`${w.WEB}/app/mailbox/counter`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  console.log(`# web ${who}: mailbox Mail Day banner`);
  console.log(`1. loaded: ${await banner(page)} | stored=${await stored(page)}`);
  await page.locator('button[aria-label*="ismiss" i]').first().click();
  await page.waitForTimeout(2500);
  console.log(`2. after dismiss: ${await banner(page)} | stored=${await stored(page)}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-a.png` });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(`3. after reload: ${await banner(page)}`);
  if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-b.png` });
  const page2 = await ctx.newPage(); watch(page2, 'tab2');
  await page2.goto(`${w.WEB}/app/mailbox/personal`, { waitUntil: 'networkidle', timeout: 120000 });
  await page2.waitForTimeout(3000);
  console.log(`4. new tab (/app/mailbox/personal): ${await banner(page2)}`);
  await page2.evaluate((k) => { try { localStorage.setItem(k, '2000-01-01'); } catch (_) {} }, KEY);
  await page2.reload({ waitUntil: 'networkidle' });
  await page2.waitForTimeout(3000);
  console.log(`5. stored day set to an earlier day, reload: ${await banner(page2)} | stored=${await stored(page2)}`);
  if (shot) await page2.screenshot({ path: `${w.OUT}/${shot}-c.png` });
  for (const l of log) console.log('  ' + l);
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
