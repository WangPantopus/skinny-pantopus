#!/usr/bin/env node
/**
 * Times the whole address check (the validation pipeline, database writes included) and prints
 * p50 and p95. Run it before and after a change to the postal path, on the same machine.
 *
 * It uses synthetic addresses, so it refuses to run unless a local stand-in answers Google:
 * Google's terms forbid sending it made-up addresses.
 *
 * usage (from backend/, with a preload that answers Google and sets POSTAL_EVAL_STANDIN=1):
 *   node scripts/eval/postal-latency.js [--runs 200] [--street "Example Trust Lane"] [--from 5330] [--houses 10]
 */

if (process.env.POSTAL_EVAL_STANDIN !== '1') {
  console.error('Refusing to run: POSTAL_EVAL_STANDIN=1 is not set, so nothing says a stand-in answers Google.');
  process.exit(1);
}

const pipelineService = require('../../services/addressValidation/pipelineService');
const addressConfig = require('../../config/addressVerification');
const logger = require('../../utils/logger');

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function percentile(sorted, p) {
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] || 0;
}

async function main() {
  logger.silent = true;
  const runs = Number(option('runs', 200));
  const street = option('street', 'Example Trust Lane');
  const from = Number(option('from', 5330));
  const houses = Number(option('houses', 10));
  const times = [];
  const statuses = {};

  for (let i = 0; i < runs; i += 1) {
    const input = { line1: `${from + (i % houses)} ${street}`, city: 'Vancouver', state: 'WA', zip: '98660' };
    const startedAt = process.hrtime.bigint();
    const result = await pipelineService.runValidationPipeline(input, { auditContext: { trigger: 'eval' } });
    times.push(Number(process.hrtime.bigint() - startedAt) / 1e6);
    statuses[result.verdict.status] = (statuses[result.verdict.status] || 0) + 1;
  }

  times.sort((a, b) => a - b);
  console.log(JSON.stringify({
    postal_provider: addressConfig.postal?.provider || 'smarty',
    runs,
    p50_ms: Math.round(percentile(times, 50)),
    p95_ms: Math.round(percentile(times, 95)),
    max_ms: Math.round(times.at(-1)),
    statuses,
  }));
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
