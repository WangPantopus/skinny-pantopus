#!/usr/bin/env node
// Lighthouse runner for the T6 web pages. Expects a running production
// build of `@pantopus/web` on http://localhost:3000 and `lighthouse` +
// `chrome-launcher` installed in the current node_modules path
// (typical scratch install: `cd /tmp/lh-scratch && npm i lighthouse
// chrome-launcher`).
//
// Usage:
//   node docs/lighthouse-t6/run.mjs              # records JSON + HTML
//   node docs/lighthouse-t6/run.mjs --check      # records + fails on
//                                                # hard-floor regression
//
// Mirrors `docs/lighthouse-t5/run.mjs` — same shape, T6 routes.

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROUTES = [
  ['auth-login', '/auth'],
  ['auth-signup', '/auth/signup'],
  ['auth-forgot', '/auth/forgot-password'],
  ['auth-reset', '/auth/reset-password'],
  ['auth-verify', '/auth/verify-email-sent'],
  ['hub', '/app/hub'],
  ['me', '/app/profile'],
  ['settings', '/app/settings'],
  ['members', '/app/homes/demo/members'],
  ['packages', '/app/homes/demo/packages'],
  ['owners', '/app/homes/demo/owners'],
  ['access-codes', '/app/homes/demo/access'],
  ['home-calendar', '/app/homes/demo/calendar'],
  ['my-homes', '/app/homes'],
  ['my-listings', '/app/my-listings'],
  ['mailbox', '/app/mailbox'],
  ['mail-detail', '/app/mailbox/demo'],
  ['chat-conversation', '/app/chat/demo'],
  ['nearby-map', '/app/map'],
  ['support-trains', '/app/support-trains'],
  ['token-accept', '/invite/demo'],
];

const HARD_FLOOR = {
  performance: 0.85,
  accessibility: 0.95,
  'best-practices': 0.95,
  seo: 0.85,
};

async function run() {
  const lighthouse = (await import('lighthouse')).default;
  const chromeLauncher = await import('chrome-launcher');
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  const opts = {
    logLevel: 'error',
    output: ['json', 'html'],
    port: chrome.port,
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 1.75,
      disabled: false,
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
  };

  const check = process.argv.includes('--check');
  let failed = 0;
  for (const [slug, route] of ROUTES) {
    const url = 'http://localhost:3000' + route;
    process.stdout.write(`  ${slug.padEnd(22)} `);
    try {
      const result = await lighthouse(url, opts);
      const [jsonReport, htmlReport] = result.report;
      await writeFile(join(__dirname, `${slug}.json`), jsonReport);
      await writeFile(join(__dirname, `${slug}.html`), htmlReport);
      const scores = {};
      for (const [cat, hard] of Object.entries(HARD_FLOOR)) {
        const score = result.lhr.categories[cat]?.score ?? 0;
        scores[cat] = (score * 100).toFixed(0);
        if (check && score < hard) failed++;
      }
      console.log(`P=${scores.performance} A=${scores.accessibility} B=${scores['best-practices']} S=${scores.seo}`);
    } catch (err) {
      console.error(`FAIL: ${err.message}`);
      failed++;
    }
  }
  await chrome.kill();
  if (check && failed > 0) {
    console.error(`\n${failed} regression(s) against hard floor.`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(2);
});
