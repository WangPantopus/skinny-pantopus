// Database time per request and per background job, so a slow request's log line tells database work, network
// waits and a stalled process apart. Every Supabase call (PostgREST, Auth, Storage) goes through
// config/supabaseClient.js, which reports it here; middleware/apm.js opens one ledger per request and adds it to
// the "Slow request detected" line, and the job runners add theirs to "Completed".
//
// Only a call's name (method plus table, database function or Auth/Storage area) and its timings are kept: never a
// query string, filter value, body or header, since those carry ids, addresses and tokens.
const { AsyncLocalStorage } = require('node:async_hooks');
const diagnostics = require('node:diagnostics_channel');
const { monitorEventLoopDelay } = require('node:perf_hooks');

const ledgers = new AsyncLocalStorage();

function newLedger() {
  return {
    calls: 0, sumMs: 0, wallMs: 0, inFlight: 0, busySince: 0, maxMs: 0, slowest: null,
    retries: 0, failed: 0, gatewayCalls: 0, gatewaySumMs: 0, gatewayMaxMs: 0,
    connects: 0, connectStarts: [], connectMaxMs: 0, connectFailed: 0,
  };
}

// "GET HomeOccupancy", "rpc home_record_context", "auth user", "storage object". Identifier characters only.
const NAME_PART = /[^A-Za-z0-9_]/g;
function callName(url, method) {
  const parts = url.pathname.split('/').filter(Boolean);
  const [service, , first, second] = parts;
  const clean = (value) => String(value || '').replace(NAME_PART, '').slice(0, 64) || '?';
  if (service === 'rest') return first === 'rpc' ? `rpc ${clean(second)}` : `${method} ${clean(first)}`;
  if (service === 'auth' || service === 'storage') return `${service} ${clean(first)}`;
  return `${method} ${clean(service)}`;
}

// Some gateways say how long the service behind them took (the local stack's Kong does); the rest of a call's
// time is the network and the gateway. Hosted projects may send none of these, and then nothing is logged.
function gatewayMs(headers) {
  if (!headers || typeof headers.get !== 'function') return null;
  for (const name of ['x-kong-upstream-latency', 'x-envoy-upstream-service-time']) {
    const value = Number(headers.get(name));
    if (headers.get(name) != null && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function retryCount(headers) {
  if (!headers) return 0;
  const value = typeof headers.get === 'function' ? headers.get('x-retry-count')
    : headers['X-Retry-Count'] ?? headers['x-retry-count'];
  return Number(value) > 0 ? 1 : 0;
}

/** Called by the Supabase fetch wrapper before each request. Returns a handle for `endCall`, or null. */
function startCall(url, method, requestHeaders) {
  const ledger = ledgers.getStore();
  if (!ledger) return null;
  const now = performance.now();
  if (ledger.inFlight === 0) ledger.busySince = now;
  ledger.inFlight += 1;
  ledger.retries += retryCount(requestHeaders);
  return { ledger, started: now, url, method: String(method || 'GET').toUpperCase() };
}

/** Called when the response headers arrive (`response`) or the request failed (`response` null). */
function endCall(call, response) {
  if (!call) return;
  const { ledger } = call;
  const now = performance.now();
  const ms = now - call.started;
  ledger.calls += 1;
  ledger.sumMs += ms;
  ledger.inFlight -= 1;
  if (ledger.inFlight === 0) ledger.wallMs += now - ledger.busySince;
  if (!response || response.status >= 500) ledger.failed += 1;
  if (ms > ledger.maxMs) {
    ledger.maxMs = ms;
    ledger.slowest = callName(call.url, call.method);
  }
  const gateway = response ? gatewayMs(response.headers) : null;
  if (gateway != null) {
    ledger.gatewayCalls += 1;
    ledger.gatewaySumMs += gateway;
    ledger.gatewayMaxMs = Math.max(ledger.gatewayMaxMs, gateway);
  }
}

// ── New connections ──────────────────────────────────────────────────────
// A call that can't reuse an open connection first resolves the host and opens TCP and TLS. Those calls are
// counted with the time the connection took, so a log line tells a slow database from a slow way to it.
let connectionsHost = null;

function trackConnections(url) {
  if (connectionsHost) return;
  try { connectionsHost = new URL(url).hostname; } catch { return; }
  const ours = (message) => message?.connectParams?.hostname === connectionsHost && ledgers.getStore();
  diagnostics.subscribe('undici:client:beforeConnect', (message) => {
    const ledger = ours(message);
    if (!ledger) return;
    ledger.connects += 1;
    ledger.connectStarts.push(performance.now());
  });
  diagnostics.subscribe('undici:client:connected', (message) => {
    const ledger = ours(message);
    const started = ledger && ledger.connectStarts.shift();
    if (started != null) ledger.connectMaxMs = Math.max(ledger.connectMaxMs, performance.now() - started);
  });
  diagnostics.subscribe('undici:client:connectError', (message) => {
    const ledger = ours(message);
    if (!ledger) return;
    ledger.connectStarts.shift();
    ledger.connectFailed += 1;
  });
}

// ── Event-loop lag ───────────────────────────────────────────────────────
// A process that can't run its callbacks makes every database call look slow. The worst lag of each second is
// kept for a minute, so a request's line can say whether the process itself was held up while it ran.
const RESOLUTION_MS = 20;
const lagBySecond = new Map(); // epoch second → worst lag in ms
let histogram = null;
let sampler = null;

function sampleLag() {
  const second = Math.floor(Date.now() / 1000);
  const worst = Math.max(0, histogram.max / 1e6 - RESOLUTION_MS);
  histogram.reset();
  lagBySecond.set(second, Math.max(lagBySecond.get(second) || 0, worst));
  for (const key of lagBySecond.keys()) if (key < second - 60) lagBySecond.delete(key);
}

function startLagMonitor() {
  if (histogram || process.env.NODE_ENV === 'test') return;
  histogram = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
  histogram.enable();
  sampler = setInterval(sampleLag, 1000);
  sampler.unref();
}

/** The worst event-loop lag (ms) seen since `sinceEpochMs`, including the current second. Null when off. */
function worstLagSince(sinceEpochMs) {
  if (!histogram) return null;
  let worst = Math.max(0, histogram.max / 1e6 - RESOLUTION_MS);
  const from = Math.floor(sinceEpochMs / 1000);
  for (const [second, lag] of lagBySecond) if (second >= from) worst = Math.max(worst, lag);
  return worst;
}

// ── Ledgers ──────────────────────────────────────────────────────────────

/** A fresh ledger, for `run`. */
function open() {
  return newLedger();
}

/** Runs `fn` inside `ledger`: every Supabase call it makes, awaited or not, is counted there. */
function run(ledger, fn) {
  return ledgers.run(ledger, fn);
}

/** Continue `next` inside `ledger` again, after a body parser's stream callbacks dropped the context. */
function resume(ledger, next) {
  if (!ledger || ledgers.getStore() === ledger) return next();
  return ledgers.run(ledger, next);
}

/** Log fields for a finished ledger: db_ms is the time at least one call was in flight. */
function fields(ledger, { sinceEpochMs } = {}) {
  if (!ledger) return {};
  const out = {
    db_calls: ledger.calls,
    db_ms: Math.round(ledger.wallMs + (ledger.inFlight > 0 ? performance.now() - ledger.busySince : 0)),
    db_sum_ms: Math.round(ledger.sumMs),
  };
  if (ledger.inFlight > 0) out.db_in_flight = ledger.inFlight;
  if (ledger.calls) {
    out.db_max_ms = Math.round(ledger.maxMs);
    out.db_slowest = ledger.slowest;
  }
  if (ledger.retries) out.db_retries = ledger.retries;
  if (ledger.failed) out.db_failed = ledger.failed;
  if (ledger.gatewayCalls) {
    out.db_gateway_sum_ms = Math.round(ledger.gatewaySumMs);
    out.db_gateway_max_ms = Math.round(ledger.gatewayMaxMs);
  }
  if (ledger.connects) {
    out.db_new_connections = ledger.connects;
    out.db_connect_max_ms = Math.round(ledger.connectMaxMs);
  }
  if (ledger.connectFailed) out.db_connect_failed = ledger.connectFailed;
  if (sinceEpochMs != null) {
    const lag = worstLagSince(sinceEpochMs);
    if (lag != null) out.loop_lag_max_ms = Math.round(lag);
  }
  return out;
}

module.exports = {
  open, run, resume, startCall, endCall, fields, trackConnections, startLagMonitor, worstLagSince, callName,
};
