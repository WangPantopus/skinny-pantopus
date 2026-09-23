// Playwright (system Chrome, headless, throwaway profile) helpers for the Stream 2 R06 web journey.
const { chromium } = require('/private/tmp/pantopus-stream2-work/frontend/apps/web/node_modules/@playwright/test');
const h = require('./h.cjs');
const WEB = 'http://127.0.0.1:18144';
const OUT = __dirname + '/work/web';
async function browser() { return chromium.launch({ channel: 'chrome', headless: true }); }
async function signedInContext(b, who) {
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, acceptDownloads: true, userAgent: 'stream2-r06-web-chrome' });
  const c = h.creds(who);
  const r = await ctx.request.post(WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
  if (r.status() !== 200) throw new Error('web login failed ' + who + ' ' + r.status());
  return ctx;
}
function netLog(page, sink) {
  page.on('response', async (resp) => {
    const u = resp.url();
    if (!/\/api\/(homes\/[^/]+\/residency-letters|public\/residency-letters|homes\/primary|homes\/[^/]+\/intelligence)/.test(u)) return;
    let body = null; const ct = resp.headers()['content-type'] || '';
    try { body = /json/.test(ct) ? await resp.json() : `[${ct} ${(await resp.body()).length} bytes]`; } catch (_) { body = '[unreadable]'; }
    sink.push({ at: new Date().toISOString(), method: resp.request().method(), path: u.replace(WEB, ''), status: resp.status(), body });
  });
}
module.exports = { browser, signedInContext, netLog, WEB, OUT };
