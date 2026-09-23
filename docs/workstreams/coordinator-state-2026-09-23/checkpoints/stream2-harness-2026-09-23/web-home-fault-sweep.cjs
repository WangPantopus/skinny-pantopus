// Error-path sweep: open each web Home page while the browser aborts every /api/homes/<home>/... request
// (a network failure for that Home's data only; the app shell still loads). Prints what each page shows so
// "error + retry" can be told apart from a misleading empty state.
// Usage: node web-home-fault-sweep.cjs <who> <homeId> <mode: abort|500> [pages comma list] [shot-prefix]
const w = require('./web-lib.cjs');
const PAGES = ['dashboard', 'bills', 'calendar', 'docs', 'emergency', 'maintenance', 'members', 'owners', 'packages',
  'pets', 'polls', 'privacy', 'property-details', 'residency', 'settings', 'share', 'tasks', 'access', 'invitations'];
const EMPTY = /\bno [a-z ]+(yet|set up|found|registered|due|expected|stored|scheduled|upcoming|active)\b|nothing (here|scheduled|on the calendar)|\bempty\b|get started|add your first/i;
const ERROR = /could not|couldn[’']?t|failed|unavailable|try again|retry|went wrong|error/i;
(async () => {
  const [who, homeId, mode = 'abort', list, shot] = process.argv.slice(2);
  const pages = list ? list.split(',') : PAGES;
  const b = await w.browser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const c = require('./h.cjs').creds(who);
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const matcher = new RegExp(`/api/homes/${homeId}(/|\\?|$)`);
  console.log(`# web ${who}: Home pages with /api/homes/${homeId.slice(0, 8)}… requests failing (${mode}) ${new Date().toISOString()}`);
  for (const p of pages) {
    const page = await ctx.newPage();
    let failed = 0;
    await page.route((url) => matcher.test(url.toString()), async (route) => {
      failed += 1;
      if (mode === '500') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Injected failure' }) });
      return route.abort('failed');
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
    try {
      await page.goto(`${w.WEB}/app/homes/${homeId}/${p}`, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (e) { errors.push('goto: ' + e.message.slice(0, 80)); }
    await page.waitForTimeout(2500);
    const text = (await page.innerText('main').catch(() => page.innerText('body'))).split('\n').map((l) => l.trim()).filter(Boolean);
    const err = text.filter((l) => ERROR.test(l)).slice(0, 3);
    const empty = text.filter((l) => EMPTY.test(l)).slice(0, 3);
    const verdict = err.length ? 'ERROR-SHOWN' : empty.length ? 'EMPTY-SHOWN' : 'OTHER';
    console.log(`${p.padEnd(17)} ${verdict.padEnd(11)} failedReqs=${failed} url=${page.url().replace(w.WEB, '')}`);
    if (err.length) console.log(`    error: ${JSON.stringify(err)}`);
    if (empty.length) console.log(`    empty: ${JSON.stringify(empty)}`);
    if (!err.length && !empty.length) console.log(`    text: ${JSON.stringify(text.slice(0, 6))}`);
    if (errors.length) console.log(`    pageerror: ${JSON.stringify(errors.slice(0, 2))}`);
    if (shot) await page.screenshot({ path: `${w.OUT}/${shot}-${p}.png` });
    await page.close();
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
