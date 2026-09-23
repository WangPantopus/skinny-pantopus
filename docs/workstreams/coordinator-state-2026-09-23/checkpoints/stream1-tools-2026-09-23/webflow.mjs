// webflow.mjs <steps.json> : drive the Stream 1 Next dev (18133) as a fixture actor with Playwright headless Chrome.
// steps.json = { "actor": "<uuid>", "url": "http://localhost:18133/...", "out": "<dir>", "prefix": "web-x",
//               "steps": [ {"shot": "name"} | {"click": "text or css:selector"} | {"fill": "css:selector", "value": "..."}
//                          | {"wait": ms} | {"waitFor": "text"} | {"goto": "url"} | {"text": "name"} ] }
// Every step's result (URL, dialogs, API responses under /api/) is logged to <out>/<prefix>-flow.txt.
import { chromium } from '/private/tmp/pantopus-stream1-acctdel/node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const log = `${cfg.out}/${cfg.prefix}-flow.txt`;
writeFileSync(log, `# ${new Date().toISOString()} webflow ${cfg.prefix} actor=…${cfg.actor.slice(-4)} start=${cfg.url}\n`);
const L = (s) => appendFileSync(log, s + '\n');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  await context.addCookies([
    { name: 'pantopus_access', value: cfg.actor, domain: 'localhost', path: '/' },
    { name: 'pantopus_session', value: '1', domain: 'localhost', path: '/' },
  ]);
  const page = await context.newPage();
  page.on('dialog', async (d) => { L(`dialog ${d.type()}: ${d.message()}`); await d.dismiss(); });
  page.on('response', (r) => { const u = r.url(); if (u.includes('/api/') && r.request().method() !== 'OPTIONS') L(`${new Date().toISOString()} ${r.request().method()} ${r.status()} ${u.replace(/^https?:\/\/[^/]+/, '')}`); });
  await page.goto(cfg.url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1200);
  for (const s of cfg.steps) {
    if (s.shot) { await page.screenshot({ path: `${cfg.out}/${cfg.prefix}-${s.shot}.png`, fullPage: !!s.full }); L(`shot ${s.shot} url=${page.url()}`); }
    else if (s.text) { writeFileSync(`${cfg.out}/${cfg.prefix}-${s.text}.txt`, await page.innerText('body')); L(`text ${s.text} url=${page.url()}`); }
    else if (s.click) {
      const loc = s.click.startsWith('css:') ? page.locator(s.click.slice(4)).first() : page.getByText(s.click, { exact: !!s.exact }).first();
      await loc.click({ timeout: 15000 }); L(`click "${s.click}"`); await page.waitForTimeout(s.after ?? 1500);
      L(`url after click: ${page.url()}`);
    }
    else if (s.fill) { await page.locator(s.fill.slice(4)).first().fill(s.value); L(`fill ${s.fill} = ${s.value}`); }
    else if (s.wheel) { await page.mouse.move(s.wheel[0], s.wheel[1]); await page.mouse.wheel(0, s.wheel[2]); await page.waitForTimeout(800); L(`wheel ${s.wheel.join(',')}`); }
    else if (s.wait) await page.waitForTimeout(s.wait);
    else if (s.waitFor) { await page.getByText(s.waitFor).first().waitFor({ timeout: 20000 }); L(`saw "${s.waitFor}"`); }
    else if (s.goto) { await page.goto(s.goto, { waitUntil: 'networkidle', timeout: 90000 }); await page.waitForTimeout(1200); L(`goto ${s.goto}`); }
  }
  L(`final url ${page.url()}`);
} catch (e) { L(`ERROR ${e.message.split('\n')[0]}`); process.exitCode = 1; }
finally { await browser.close(); }
