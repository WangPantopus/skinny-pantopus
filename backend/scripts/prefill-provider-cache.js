#!/usr/bin/env node
'use strict';

// Operator-only, bounded prefill. Defaults to a dry run. No application records,
// billing settings, provider retries, or background schedules are created.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const { computeAddressHash } = require('../utils/normalizeAddress');

const digest = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(message); };
const integer = (n) => Number.isSafeInteger(n) && n >= 0;
const PROVIDERS = ['ATTOM'];
const ADDRESS_CAP = 200;
const REPO = path.resolve(__dirname, '../..');

function privateFile(file) {
  const resolved = fs.realpathSync(file);
  if (resolved === REPO || resolved.startsWith(`${REPO}${path.sep}`)) fail('Operator files must be outside the repository');
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || (stat.mode & 0o077)) fail('Operator files must be private regular files (mode 0600)');
  return fs.readFileSync(resolved, 'utf8');
}

function save(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  const directory = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
}

function loadManifest(text) {
  const addresses = new Map();
  for (const line of text.split('\n').filter((value) => value.trim())) {
    const a = JSON.parse(line);
    for (const field of ['line1', 'city', 'state', 'zip', 'source']) {
      if (typeof a[field] !== 'string' || !a[field].trim()) fail(`Manifest requires ${field}`);
    }
    if (a.line2 != null && typeof a.line2 !== 'string') fail('Invalid secondary address');
    // This run is scoped to the founder's requested southwest Washington area.
    if (!['CAMAS', 'WASHOUGAL', 'VANCOUVER'].includes(a.city.trim().toUpperCase())
      || a.state.trim().toUpperCase() !== 'WA' || !/^\d{5}(-\d{4})?$/.test(a.zip)) {
      fail('Manifest contains an address outside the requested postal areas');
    }
    const hash = computeAddressHash(a.line1, a.line2 || '', a.city, a.state, a.zip);
    if (!addresses.has(hash)) addresses.set(hash, a);
  }
  if (!addresses.size) fail('Empty manifest');
  return addresses;
}

function validatePlan(plan, execute) {
  if (!/^[a-z0-9.-]+$/.test(plan.databaseHost || '')) fail('Plan requires the exact database hostname');
  for (const provider of PROVIDERS) {
    const p = plan.providers?.[provider];
    if (!p) fail(`Missing ${provider} budget`);
    for (const field of ['remainingCredits', 'reserveCredits', 'maxCredits', 'rateLimitPerMinute', 'requestsPerMinute']) {
      if (!integer(p[field])) fail(`Invalid ${provider} ${field}`);
    }
    if (!['hits', 'reports'].includes(p.quotaUnit)) fail('Plan must identify whether the included allowance counts hits or reports');
    // Keep at least half the verified remaining allowance for the running app.
    if (p.reserveCredits < Math.ceil(p.remainingCredits / 2)
      || p.maxCredits > p.remainingCredits - p.reserveCredits) fail(`${provider} budget exceeds unreserved included credits`);
    if (p.requestsPerMinute < 1 || p.requestsPerMinute > 30
      || p.requestsPerMinute > p.rateLimitPerMinute / 2) fail(`${provider} rate exceeds the conservative prefill allowance`);
    if (!/^[a-f0-9]{64}$/.test(p.credentialFingerprint || '')) fail(`Missing ${provider} credential fingerprint`);
  }
  if (execute) {
    const now = Date.now();
    const checked = Date.parse(plan.quotaCheckedAt);
    const expiry = Date.parse(plan.quotaExpiresAt);
    if (!Number.isFinite(checked) || now < checked || now - checked > 15 * 60 * 1000
      || !Number.isFinite(expiry) || expiry <= now || expiry > checked + 15 * 60 * 1000) {
      fail('Included usage must be verified within 15 minutes and expire before its billing reset');
    }
  }
}

function validateBody(body, spec) {
  if (body?.property?.length > 10) fail('ATTOM returned more records than reserved');
  if (!spec.isUsable(body) && body?.status?.msg !== 'SuccessWithoutResult') {
    fail('ATTOM returned an unexpected response; stopped without retry');
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    manifest: { type: 'string' }, plan: { type: 'string' },
    'state-dir': { type: 'string' }, execute: { type: 'boolean', default: false },
  } });
  if (!values.manifest || !values.plan || !values['state-dir']) {
    fail('Usage: --manifest private.jsonl --plan private.json --state-dir private-directory [--execute]');
  }
  const manifest = privateFile(values.manifest);
  const addresses = loadManifest(manifest);
  const plan = JSON.parse(privateFile(values.plan));
  validatePlan(plan, values.execute);
  console.log(JSON.stringify({ execute: values.execute, addresses: addresses.size,
    selectedAddresses: Math.min(addresses.size, ADDRESS_CAP),
    maximumNewRequests: { ATTOM: Math.min(ADDRESS_CAP, Math.floor(plan.providers.ATTOM.maxCredits
      / (plan.providers.ATTOM.quotaUnit === 'hits' ? 1 : 10))) } }));
  if (!values.execute) return;

  // Require explicit credentials before modules that load dotenv are imported.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY
    || new URL(process.env.SUPABASE_URL).hostname !== plan.databaseHost) fail('Database target does not match the plan');
  const keys = { ATTOM: process.env.ATTOM_API_KEY };
  for (const provider of PROVIDERS) {
    if (!keys[provider] || digest(keys[provider]) !== plan.providers[provider].credentialFingerprint) {
      fail(`${provider} credentials do not match the verified account`);
    }
  }
  fs.mkdirSync(values['state-dir'], { recursive: true, mode: 0o700 });
  const dir = fs.realpathSync(values['state-dir']);
  if (dir === REPO || dir.startsWith(`${REPO}${path.sep}`) || (fs.statSync(dir).mode & 0o077)) fail('State directory must be private and outside the repository');
  const lock = path.join(dir, 'run.lock');
  const lockFd = fs.openSync(lock, 'wx', 0o600); // No concurrent run or automatic stale-lock removal.
  fs.writeFileSync(lockFd, String(process.pid));
  fs.closeSync(lockFd);
  try {
    const stateFile = path.join(dir, 'state.json');
    const identity = digest(JSON.stringify({ manifest: digest(manifest), database: plan.databaseHost,
      credentials: PROVIDERS.map((provider) => plan.providers[provider].credentialFingerprint) }));
    const state = fs.existsSync(stateFile) ? JSON.parse(privateFile(stateFile))
      : { identity, reserved: { ATTOM: 0 }, entries: {} };
    if (state.identity !== identity) fail('Manifest, database, or credentials changed; do not reuse this ledger');
    if (!integer(state.reserved.ATTOM)) fail('Invalid saved credit ledger');
    const { readResponse } = require('../services/external/cacheHelper');
    const { propertyDetailCacheRequest } = require('../services/ai/propertyIntelligenceService');
    const { readCappedJson, readCappedText } = require('../utils/cappedBody');
    const counts = Object.fromEntries(PROVIDERS.map((p) => [p, { hits: 0, saved: 0, empty: 0, skipped: 0 }]));
    const lastRequest = Object.fromEntries(PROVIDERS.map((provider) => [provider,
      Object.entries(state.entries).filter(([id]) => id.startsWith(`${provider}-`))
        .reduce((latest, [, entry]) => Math.max(latest, Date.parse(entry.at) || 0), 0),
    ]));
    const exhausted = new Set();

    for (const [hash, address] of [...addresses].slice(0, ADDRESS_CAP)) {
      for (const provider of PROVIDERS) {
        if (exhausted.has(provider)) continue;
        const id = `${provider}-${hash}`;
        if (['saved', 'empty', 'abandoned'].includes(state.entries[id]?.status)) {
          counts[provider].skipped++;
          continue;
        }
        const spec = propertyDetailCacheRequest(address);
        const bodyFile = path.join(dir, `${id}.json`);
        try {
          let receivedAt = null;
          const result = await readResponse({ ...spec, requirePersistence: true, fetch: async () => {
            // A received body can be persisted after an interrupted write without
            // purchasing it again. Ambiguous requests are never retried.
            if (fs.existsSync(bodyFile)) {
              const saved = JSON.parse(privateFile(bodyFile));
              receivedAt = saved.receivedAt;
              // Don't give an old provider response a new freshness timestamp.
              const age = Date.now() - Date.parse(receivedAt);
              if (!Number.isFinite(age) || age < 0 || age > 15 * 60 * 1000) fail('Recovery response is old; reconcile it before resuming');
              validateBody(saved.body, spec);
              return saved.body;
            }
            if (state.entries[id]) fail('A prior request has no recoverable response; reconcile its usage before resuming');
            const budget = plan.providers[provider];
            const credits = budget.quotaUnit === 'hits' ? 1 : 10;
            if (state.reserved[provider] + credits > budget.maxCredits) throw Object.assign(new Error('Budget reached'), { budget: true });
            const waitMs = Math.max(0, lastRequest[provider] + 60000 / budget.requestsPerMinute - Date.now());
            if (waitMs) await delay(waitMs);
            validatePlan(plan, true);
            // Reserve the maximum billable result count BEFORE sending a request.
            state.reserved[provider] += credits;
            state.entries[id] = { status: 'reserved', at: new Date().toISOString() };
            save(stateFile, state);
            lastRequest[provider] = Date.now();
            const url = new URL(spec.requestUrl);
            url.searchParams.set('pagesize', '10'); // Explicit documented default.
            const headers = { apikey: keys.ATTOM };
            const signal = AbortSignal.timeout(15000);
            const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' }, signal, redirect: 'error' });
            // Stop on every quota/rate/auth/server error; no automatic retries.
            if (!res.ok && res.status !== 400) {
              state.entries[id].httpStatus = res.status;
              save(stateFile, state);
              const body = await readCappedText(res, 4 * 1024 * 1024, signal);
              save(`${bodyFile}.error.json`, { status: res.status, body });
              state.entries[id].status = 'error';
              state.entries[id].httpStatus = res.status;
              save(stateFile, state);
              fail(`${provider} HTTP ${res.status}; stopped without retry`);
            }
            const body = await readCappedJson(res, 4 * 1024 * 1024, signal);
            if (!res.ok && body?.status?.msg !== 'SuccessWithoutResult') fail('ATTOM request rejected; stopped without retry');
            receivedAt = new Date().toISOString();
            save(bodyFile, { receivedAt, body });
            validateBody(body, spec);
            state.entries[id].status = 'received';
            save(stateFile, state);
            return body;
          } });
          if (result.response && !result.persisted) fail('Response was not persisted');
          const status = result.response ? 'saved' : 'empty';
          state.entries[id] = { status, at: result.fetchedAt || receivedAt || new Date().toISOString() };
          save(stateFile, state);
          counts[provider][result.hit ? 'hits' : status]++;
        } catch (error) {
          if (!error.budget) {
            // Persist a non-sensitive failure classification for reconciliation;
            // never automatically repeat a possibly billable request.
            if (state.entries[id]) {
              const kind = ['AbortError', 'TimeoutError', 'SyntaxError', 'TypeError'].includes(error.name)
                ? error.name : 'Error';
              const causeCode = String(error.cause?.code || '');
              state.entries[id].lastError = { kind, at: new Date().toISOString(),
                causeCode: /^[A-Z][A-Z0-9_]{1,60}$/.test(causeCode) ? causeCode : null };
              save(stateFile, state);
            }
            throw error;
          }
          exhausted.add(provider);
        }
      }
      if (exhausted.size === PROVIDERS.length) break;
    }
    console.log(JSON.stringify({ counts, creditsReserved: state.reserved, stoppedAtBudget: [...exhausted] }));
  } finally { fs.unlinkSync(lock); }
}

main().catch((error) => {
  // Errors from providers/SDKs may include addresses or credentials. Print only
  // our own explicitly constructed messages; never response bodies or stacks.
  const safe = /^(Usage:|Operator |Manifest |Invalid |Empty |Plan |Missing |Included |Database |State |A prior |Recovery |Response |ATTOM )/;
  console.error(safe.test(error.message) ? error.message : 'Prefill stopped; inspect the private ledger before resuming.');
  process.exitCode = 1;
});
