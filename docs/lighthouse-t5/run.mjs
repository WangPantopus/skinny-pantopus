#!/usr/bin/env node
// Lighthouse runner for the 12 T5 web pages. Expects a running
// production build of `@pantopus/web` on http://localhost:3000 and
// `lighthouse` + `chrome-launcher` installed in the current node_modules
// path (typical scratch install: `cd /tmp/lh-scratch && npm i
// lighthouse chrome-launcher`).
//
// Usage:
//   node docs/lighthouse-t5/run.mjs              # records JSON + HTML
//   node docs/lighthouse-t5/run.mjs --check      # records + fails on
//                                                # hard-floor regression

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROUTES = [
  ['notifications', '/app/notifications'],
  ['bills', '/app/homes/demo/bills'],
  ['pets', '/app/homes/demo/pets'],
  ['connections', '/app/connections'],
  ['offers', '/app/offers'],
  ['my-bids', '/app/my-bids'],
  ['my-tasks', '/app/my-gigs'],
  ['my-pulse', '/app/my-pulse'],
  ['listing-offers', '/app/listing-offers'],
  ['discover-hub', '/app/discover-hub'],
  ['discover-businesses', '/app/discover'],
  ['review-claims', '/app/admin/review-claims'],
];

const HARD_FLOOR = {
  performance: 0.85,
  accessibility: 0.95,
  'best-practices': 0.95,
  seo: 0.85,
};

const BASE = process.env.LH_BASE_URL || 'http://localhost:3000';
const CHECK = process.argv.includes('--check');

async function run() {
  const lighthouse = (await import('lighthouse')).default;
  const { launch } = await import('chrome-launcher');

  const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  const port = chrome.port;
  let failures = 0;

  for (const [id, route] of ROUTES) {
    const url = `${BASE}${route}`;
    process.stdout.write(`lighthouse · ${id.padEnd(22)} ${url} ... `);
    try {
      const result = await lighthouse(url, {
        port,
        output: ['json', 'html'],
        logLevel: 'error',
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 400, height: 900, deviceScaleFactor: 2 },
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
      });
      const cats = result.lhr.categories;
      const scores = {
        performance: cats.performance?.score ?? 0,
        accessibility: cats.accessibility?.score ?? 0,
        'best-practices': cats['best-practices']?.score ?? 0,
        seo: cats.seo?.score ?? 0,
      };
      await writeFile(join(__dirname, `${id}.json`), result.report[0]);
      await writeFile(join(__dirname, `${id}.html`), result.report[1]);
      const line = Object.entries(scores)
        .map(([k, v]) => `${k[0]}=${(v * 100).toFixed(0)}`)
        .join(' ');
      const passed = Object.entries(scores).every(
        ([k, v]) => v >= HARD_FLOOR[k],
      );
      console.log(passed ? `OK   ${line}` : `FAIL ${line}`);
      if (CHECK && !passed) failures++;
    } catch (e) {
      console.log(`ERROR ${e.message}`);
      if (CHECK) failures++;
    }
  }

  await chrome.kill();
  if (failures > 0) {
    console.error(`\n${failures}/${ROUTES.length} pages failed the hard floor.`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
