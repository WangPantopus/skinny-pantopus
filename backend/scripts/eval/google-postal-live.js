#!/usr/bin/env node
/**
 * Sends a private list of real addresses to Google Address Validation and saves the answers
 * outside the repository, so the postal evaluation can replay them offline.
 *
 * Billed per request, and Google's terms forbid made-up US and Puerto Rico addresses: this reads
 * only a list you pass in, stops at a call budget kept across runs, and prints counts only, never
 * an address or a key. Saved answers are deleted after 30 days (Google's cache limit).
 *
 * usage: node scripts/eval/google-postal-live.js --cases <file.jsonl> --answers <file.jsonl> \
 *          --budget <total calls allowed across runs> [--ledger <file>] [--limit <n>] [--dry-run]
 * Needs GOOGLE_ADDRESS_VALIDATION_API_KEY in the environment.
 * A case line: { "id", "category", "truth", "evidence", "line1", "line2", "city", "state", "zip" }
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const API_BASE = 'https://addressvalidation.googleapis.com/v1:validateAddress';
const SAVED_DAYS = 30;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function requestBody(item) {
  const addressLines = [item.line1];
  if (item.line2) addressLines.push(item.line2);
  return {
    address: {
      regionCode: 'US',
      locality: item.city,
      administrativeArea: item.state,
      postalCode: item.zip,
      addressLines,
    },
    enableUspsCass: true,
  };
}

function dropExpired(file) {
  const cutoff = Date.now() - SAVED_DAYS * 24 * 60 * 60 * 1000;
  const rows = readJsonl(file);
  const kept = rows.filter((row) => Date.parse(row.asked_at) >= cutoff);
  if (kept.length !== rows.length) {
    fs.writeFileSync(file, kept.map((row) => JSON.stringify(row)).join('\n') + (kept.length ? '\n' : ''), { mode: 0o600 });
  }
  return kept;
}

async function main() {
  const casesFile = option('cases');
  const answersFile = option('answers');
  const budget = Number(option('budget'));
  const ledgerFile = option('ledger', path.join(os.homedir(), '.config/pantopus/provider-truth/google-calls.json'));
  const limit = Number(option('limit', Infinity));
  const dryRun = process.argv.includes('--dry-run');
  const apiKey = (process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY || '').trim();

  if (!casesFile || !answersFile || !Number.isFinite(budget)) {
    throw new Error('usage: --cases <file> --answers <file> --budget <n> [--limit <n>] [--dry-run]');
  }
  if (!apiKey && !dryRun) throw new Error('GOOGLE_ADDRESS_VALIDATION_API_KEY is not set');

  const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : { calls: 0 };
  const answered = new Set(dropExpired(answersFile).map((row) => row.id));
  const cases = readJsonl(casesFile);
  const todo = cases.filter((item) => !answered.has(item.id)).slice(0, limit);
  const allowed = Math.max(0, budget - ledger.calls);
  const send = todo.slice(0, allowed);

  console.log(`cases ${cases.length}, already answered ${answered.size}, to ask ${todo.length}, budget left ${allowed}`);
  if (dryRun) return;

  const counts = { ok: 0, failed: 0 };
  const latencies = [];
  for (const item of send) {
    const startedAt = Date.now();
    let status = 0;
    let answer = null;
    try {
      const res = await fetch(`${API_BASE}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody(item)),
        signal: AbortSignal.timeout(10000),
      });
      status = res.status;
      answer = res.ok ? await res.json() : null;
    } catch (_) {
      status = -1;
    }
    latencies.push(Date.now() - startedAt);
    ledger.calls += 1;
    fs.writeFileSync(ledgerFile, JSON.stringify(ledger), { mode: 0o600 });
    if (answer) {
      counts.ok += 1;
      fs.appendFileSync(answersFile, `${JSON.stringify({ id: item.id, asked_at: new Date().toISOString(), latency_ms: latencies.at(-1), answer })}\n`, { mode: 0o600 });
    } else {
      counts.failed += 1;
      console.log(`no answer for one case: http ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  latencies.sort((a, b) => a - b);
  const percentile = (p) => latencies[Math.max(0, Math.ceil((p / 100) * latencies.length) - 1)] || 0;
  console.log(`answered ${counts.ok}, failed ${counts.failed}, calls used so far ${ledger.calls}`);
  console.log(`google latency ms: p50 ${percentile(50)}, p95 ${percentile(95)}, max ${latencies.at(-1) || 0}`);
  if (todo.length > send.length) console.log(`stopped at the budget: ${todo.length - send.length} cases not asked`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
