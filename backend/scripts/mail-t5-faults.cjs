// Printer fault injection for scripts/mail-t5.js. Preload it into a LOCAL backend:
//   NODE_OPTIONS=--require=<path>/mail-t5-faults.cjs MAIL_T5_FAULTS=<rules.json> MAIL_T5_PRINTER_HOSTS=api.lob.com,127.0.0.1:18990
// Rules are re-read on every printer call:
//   { "rules": [ { "method": "POST", "path": "/v1/postcards", "mode": "timeout-before", "times": 3 } ] }
// Modes: timeout-before (nothing reaches the printer), timeout-after (the printer gets it, its answer is lost),
// down (nothing reaches the printer, connection refused), status:503 (an answer without calling the printer).
// MAIL_T5_CALLS, when set, gets one line per printer call: method, path, repeat key, status, piece id. Never bodies or addresses.
const fs = require('fs');

const FAULTS = process.env.MAIL_T5_FAULTS;
const CALLS = process.env.MAIL_T5_CALLS;
const HOSTS = (process.env.MAIL_T5_PRINTER_HOSTS || 'api.lob.com').split(',');
const realFetch = global.fetch;

function nextFault(method, pathname) {
  if (!FAULTS) return null;
  let spec;
  try { spec = JSON.parse(fs.readFileSync(FAULTS, 'utf8')); } catch (_) { return null; }
  const rule = (spec.rules || []).find((r) => (!r.method || r.method === method)
    && (!r.path || pathname.startsWith(r.path)) && (r.times == null || r.times > 0));
  if (!rule) return null;
  if (rule.times != null) {
    rule.times -= 1;
    fs.writeFileSync(`${FAULTS}.tmp`, JSON.stringify(spec));
    fs.renameSync(`${FAULTS}.tmp`, FAULTS);
  }
  return rule.mode;
}

function timeoutError() {
  return Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
}

global.fetch = async function faultyFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input));
  if (!HOSTS.includes(url.host) && !HOSTS.includes(url.hostname)) return realFetch(input, init);
  const method = (init.method || 'GET').toUpperCase();
  const key = new Headers(init.headers || {}).get('idempotency-key') || '-';
  const note = (result) => {
    if (CALLS) fs.appendFile(CALLS, `${new Date().toISOString()} ${method} ${url.host}${url.pathname} key=${key} -> ${result}\n`, () => {});
  };
  const mode = nextFault(method, url.pathname);
  if (mode === 'down') { note('down'); throw new TypeError('fetch failed'); }
  if (mode === 'timeout-before') { note('timeout-before'); throw timeoutError(); }
  if (mode && mode.startsWith('status:')) {
    const status = Number(mode.slice(7));
    note(`injected ${status}`);
    return new Response('{"error":{"message":"injected"}}', { status, headers: { 'Content-Type': 'application/json' } });
  }
  const res = await realFetch(input, init);
  let id = '';
  try { id = (await res.clone().json()).id || ''; } catch (_) { /* not json */ }
  if (mode === 'timeout-after') {
    note(`${res.status} then answer lost ${id}`);
    await res.body?.cancel();
    throw timeoutError();
  }
  note(`${res.status} ${id}`);
  return res;
};
