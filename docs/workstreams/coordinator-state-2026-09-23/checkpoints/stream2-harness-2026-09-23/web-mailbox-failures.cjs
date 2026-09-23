// T36 web Mailbox failure handling (S2-12, S2-13, S2-18, S2-19, S2-08 web) on the real pages, signed in as the owner.
// Failures are simulated in the browser with Playwright route interception: the request gets a 500 JSON answer
// ({"error":"Server error"}, the backend's own 500 body), so the page runs its real error path.
// Usage: node web-mailbox-failures.cjs <label> <A-subject-tag> <B-subject-tag> <C-subject-tag>
//   The tags are the fixture subjects' suffixes, e.g. before-A before-B before-C.
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('node:fs');
const OUT = w.OUT;
const FAIL = { status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) };
(async () => {
  const [label, tagA, tagB, tagC] = process.argv.slice(2);
  const subj = (t) => `Stream2 T36 letter ${t}`;
  const b = await w.browser();
  const c = h.creds('owner');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, userAgent: 'stream2-r06-web-chrome' });
  const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (lr.status() !== 200) throw new Error('web login failed ' + lr.status());
  const log = [];
  const say = (s) => { console.log(s); log.push(s); };
  const watch = (page) => page.on('response', (r) => {
    const u = new URL(r.url()); const m = r.request().method();
    if (!/^\/api\/mailbox/.test(u.pathname)) return;
    if (m === 'GET' && !/^\/api\/mailbox$|\/v2\/drawers|\/vault\/folders/.test(u.pathname)) return;
    say(`    net ${m} ${u.pathname}${u.search} -> ${r.status()}`);
  });
  const lines = async (page, re) => (await page.innerText('body')).split('\n').map((l) => l.trim()).filter((l) => re.test(l));
  const toasts = async (page) => {
    const t = await page.locator('[role="status"], [role="alert"]').allInnerTexts().catch(() => []);
    return t.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  };
  const shot = async (page, name) => page.screenshot({ path: `${OUT}/t36-${label}-${name}.png` });

  // ── A. v1 Mailbox (the Mail tab: /app/mailbox?scope=personal) ─────────────────────────
  say(`# ${label} A1: /app/mailbox?scope=personal loads normally`);
  let p = await ctx.newPage(); watch(p);
  await p.goto(`${w.WEB}/app/mailbox?scope=personal`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  say(`  rows: ${JSON.stringify(await lines(p, /Stream2 T36 letter|Stream2 RD letter/))}`);
  await shot(p, 'A1-list');
  await p.close();

  say(`# ${label} A2: the list request fails on first load`);
  p = await ctx.newPage(); watch(p);
  await p.route(/\/api\/mailbox\?/, (route) => route.request().method() === 'GET' ? route.fulfill(FAIL) : route.continue());
  await p.goto(`${w.WEB}/app/mailbox?scope=personal`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  say(`  page says: ${JSON.stringify(await lines(p, /empty|No mail yet|load|Try again|Retry|wrong|Server error/i))}`);
  await shot(p, 'A2-load-failed');
  say(`# ${label} A2b: the list request works again; the page's own retry`);
  await p.unroute(/\/api\/mailbox\?/);
  const retry = p.getByRole('button', { name: /Try again|Retry/i }).first();
  if (await retry.count()) { await retry.click(); await p.waitForTimeout(2500); say(`  after Try again, rows: ${JSON.stringify(await lines(p, /Stream2 T36 letter|Stream2 RD letter/))}`); await shot(p, 'A2b-retried'); } else say('  no retry control on the page');
  await p.close();

  say(`# ${label} A3: switching scope to All fails`);
  p = await ctx.newPage(); watch(p);
  await p.goto(`${w.WEB}/app/mailbox?scope=personal`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.route(/\/api\/mailbox\?.*scope=all/, (route) => route.fulfill(FAIL));
  await p.getByRole('button', { name: 'All', exact: true }).first().click();
  await p.waitForTimeout(2500);
  say(`  header: ${JSON.stringify(await lines(p, /Mailbox$|Unified|Personal Mailbox|Home Mailbox/))}`);
  say(`  page says: ${JSON.stringify(await lines(p, /empty|No mail yet|load|Try again|Retry|wrong|Server error/i))}`);
  say(`  rows under the All header: ${JSON.stringify(await lines(p, /Stream2 T36 letter|Stream2 RD letter/))}`);
  await shot(p, 'A3-switch-failed');
  await p.close();

  say(`# ${label} A4: starring letter ${tagA} fails`);
  p = await ctx.newPage(); watch(p);
  await p.goto(`${w.WEB}/app/mailbox?scope=personal`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.route(/\/api\/mailbox\/[^/]+\/star/, (route) => route.fulfill(FAIL));
  const rowA = p.locator('div').filter({ hasText: subj(tagA) }).filter({ has: p.locator('button[title="Star"], button[title="Unstar"]') }).last();
  const starA = rowA.locator('button[title="Star"], button[title="Unstar"]').first();
  say(`  star button before: ${await starA.getAttribute('title')}`);
  await starA.click();
  await p.waitForTimeout(2000);
  say(`  star button after the failed save: ${await starA.getAttribute('title')}; toasts ${JSON.stringify(await toasts(p))}`);
  await shot(p, 'A4-star-failed');
  await p.unroute(/\/api\/mailbox\/[^/]+\/star/);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  const starA2 = p.locator('div').filter({ hasText: subj(tagA) }).filter({ has: p.locator('button[title="Star"], button[title="Unstar"]') }).last().locator('button[title="Star"], button[title="Unstar"]').first();
  say(`  after reload (server state): ${await starA2.getAttribute('title')}`);

  say(`# ${label} A5: archiving letter ${tagA} from its detail fails`);
  await p.getByText(subj(tagA), { exact: true }).first().click();
  await p.waitForTimeout(2500);
  await p.route(/\/api\/mailbox\/[^/]+\/archive/, (route) => route.fulfill(FAIL));
  await p.locator('button[title="Archive"]').first().click();
  await p.waitForTimeout(2000);
  say(`  detail still open: ${await p.locator('button[title="Archive"]').count() > 0}; letter still listed: ${(await lines(p, new RegExp(subj(tagA)))).length > 0}; toasts ${JSON.stringify(await toasts(p))}`);
  await shot(p, 'A5-archive-failed');

  say(`# ${label} A6: deleting letter ${tagA} fails`);
  await p.route(/\/api\/mailbox\/[0-9a-f-]{36}$/, (route) => route.request().method() === 'DELETE' ? route.fulfill(FAIL) : route.continue());
  await p.locator('button[title="Delete"]').first().click();
  await p.waitForTimeout(800);
  await p.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await p.waitForTimeout(2000);
  say(`  detail still open: ${await p.locator('button[title="Delete"]').count() > 0}; letter still listed: ${(await lines(p, new RegExp(subj(tagA)))).length > 0}; toasts ${JSON.stringify(await toasts(p))}`);
  await shot(p, 'A6-delete-failed');
  await p.close();

  // ── B. v2 drawer pages (/app/mailbox/personal and a letter) ──────────────────────────
  say(`# ${label} B1: /app/mailbox/personal`);
  p = await ctx.newPage(); watch(p);
  const actionPosts = []; const translatePosts = [];
  p.on('response', (r) => {
    const u = new URL(r.url());
    if (/\/api\/mailbox\/v2\/item\/[^/]+\/action$/.test(u.pathname)) actionPosts.push(r.status());
    if (/\/api\/mailbox\/v2\/p3\/translate$/.test(u.pathname)) translatePosts.push(r.status());
  });
  await p.goto(`${w.WEB}/app/mailbox/personal`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  const navCount = async () => (await p.locator('[aria-label*="unread"]').allInnerTexts().catch(() => [])).concat(await p.locator('a[aria-label*="Personal"], button[aria-label*="Personal"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))).catch(() => []));
  say(`  banner: ${JSON.stringify(await lines(p, /new items?$/))}; nav labels: ${JSON.stringify(await navCount())}`);
  await shot(p, 'B1-drawer');

  say(`# ${label} B2: open letter ${tagB}`);
  await p.getByText(subj(tagB), { exact: true }).first().click();
  await p.waitForTimeout(4000);
  say(`  POST .../action answers: ${JSON.stringify(actionPosts)}; POST /p3/translate answers: ${JSON.stringify(translatePosts)}`);
  say(`  banner after opening: ${JSON.stringify(await lines(p, /new items?$/))}; nav labels: ${JSON.stringify(await navCount())}`);
  const order = await lines(p, /Stream2 T36 letter|Stream2 RD letter|^Earlier$/);
  say(`  list order (Earlier divider marks read items): ${JSON.stringify(order)}`);
  await shot(p, 'B2-opened');

  say(`# ${label} B3: the translation banner on letter ${tagB}`);
  say(`  banner text: ${JSON.stringify(await lines(p, /^Detected|Translate$|Translating/))}`);
  const tbtn = p.getByRole('button', { name: 'Translate', exact: true });
  if (await tbtn.count()) {
    await tbtn.first().click(); await p.waitForTimeout(2500);
    say(`  after Translate: ${JSON.stringify(await lines(p, /Translated|\[Translated/))}`);
    await shot(p, 'B3-translate');
  } else say('  no Translate button');

  say(`# ${label} B4: the header ⋮ (More actions)`);
  const more = p.locator('button[title="More actions"]');
  say(`  More actions buttons: ${await more.count()}`);
  if (await more.count()) {
    const before = await p.locator('[role="menu"], [role="menuitem"]').count();
    await more.first().click(); await p.waitForTimeout(1000);
    say(`  menus before/after click: ${before}/${await p.locator('[role="menu"], [role="menuitem"]').count()}`);
    await shot(p, 'B4-more');
  }

  say(`# ${label} B5: File to Vault fails`);
  await p.route(/\/api\/mailbox\/v2\/p2\/vault\/file$/, (route) => route.fulfill(FAIL));
  await p.getByRole('button', { name: /File to Vault/ }).first().click();
  await p.waitForTimeout(1000);
  const folderItems = await lines(p, /^Taxes$|^Receipts$|^Warranties$|No vault folders|Couldn't load/);
  say(`  menu shows: ${JSON.stringify(folderItems)}`);
  await p.getByRole('button', { name: /Taxes/ }).first().click();
  await p.waitForTimeout(2000);
  say(`  after the failed filing: menu still open ${(await lines(p, /^Taxes$/)).length > 0}; toasts ${JSON.stringify(await toasts(p))}`);
  await shot(p, 'B5-file-failed');
  await p.close();

  say(`# ${label} B6: the vault folders fail to load; letter ${tagC}`);
  p = await ctx.newPage(); watch(p);
  const cId = (await h.api('GET', '/api/mailbox/v2/drawer/personal?limit=50', await h.login('owner'))).json.mail.find((m) => m.subject === subj(tagC)).id;
  await p.route(/\/api\/mailbox\/v2\/p2\/vault\/folders/, (route) => route.fulfill(FAIL));
  let tcount = 0;
  await p.route(/\/api\/mailbox\/v2\/p3\/translate$/, (route) => (++tcount > 1 ? route.fulfill(FAIL) : route.continue()));
  await p.goto(`${w.WEB}/app/mailbox/personal/${cId}`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.getByRole('button', { name: /File to Vault/ }).first().click();
  await p.waitForTimeout(1500);
  say(`  menu shows: ${JSON.stringify(await lines(p, /No vault folders|Couldn't load|Try again|Open Vault|Vault/))}`);
  await shot(p, 'B6-folders-failed');
  await p.keyboard.press('Escape'); await p.mouse.click(5, 500); await p.waitForTimeout(500);
  say(`# ${label} B7: Translate fails (the second translate call answers 500)`);
  const tb = p.getByRole('button', { name: 'Translate', exact: true });
  if (await tb.count()) {
    await tb.first().click(); await p.waitForTimeout(2500);
    say(`  after the failed Translate: ${JSON.stringify(await lines(p, /Translat/))}; toasts ${JSON.stringify(await toasts(p))}`);
    await shot(p, 'B7-translate-failed');
  } else say('  no Translate button on the page');
  await p.close();
  fs.writeFileSync(`${__dirname}/work/t36-${label}.txt`, log.join('\n') + '\n');
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
