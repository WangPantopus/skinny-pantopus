// T6.0a Bills design-drift catch-up — one-off render script.
// Outputs three per-platform PNGs at docs/screenshots/bills-v2-*.png
// matching the new design (utility-tinted leading, 6 status chips,
// summary banner with 30-day total + overdue count, optional split
// avatars, 56pt canonicalCreate FAB in home-green).
//
// Run: `node tools/t5-screenshots/bills-v2.mjs`
//
// Reuses the T5 harness's lib.mjs + rows.mjs primitives. Sister to
// `render.mjs` — kept separate so it doesn't churn T5 baselines.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

import { P, frame, htmlDoc, topBar, tabStrip, fab } from './lib.mjs';
import { typeIconLeading, amountWithChipTrailing, rowCard, banner } from './rows.mjs';

const REPO = '/home/user/pantopus';
const PARITY_DIR = `${REPO}/docs/screenshots`;

const VIEWPORTS = {
  ios: { width: 390, height: 844, deviceScaleFactor: 1 },
  android: { width: 411, height: 891, deviceScaleFactor: 1 },
  web: { width: 400, height: 900, deviceScaleFactor: 1 },
};

// Utility palette mirrors `UtilityCategoryPalette` on iOS / Android / web.
// Hex values from `bills-frames.jsx:53-62` — kept inline here as the
// harness's documented exception to the no-hex-literal rule.
const UTIL = {
  electric:  { icon: 'zap',          bg: '#fef9c3', fg: '#a16207' },
  gas:       { icon: 'flame',        bg: '#ffedd5', fg: '#c2410c' },
  water:     { icon: 'droplet',      bg: '#dbeafe', fg: '#1d4ed8' },
  internet:  { icon: 'wifi',         bg: '#ede9fe', fg: '#6d28d9' },
  hoa:       { icon: 'building-2',   bg: '#dcfce7', fg: '#15803d' },
  insurance: { icon: 'shield-check', bg: '#ccfbf1', fg: '#0f766e' },
  trash:     { icon: 'trash-2',      bg: '#e2e8f0', fg: '#334155' },
  phone:     { icon: 'smartphone',   bg: '#fee2e2', fg: '#b91c1c' },
};

function billsV2Body() {
  const body = [
    banner({
      iconName: 'wallet',
      title: '$1,248.19 due in the next 30 days',
      body: '<span style="color:#b91c1c;font-weight:600">1 overdue</span> · pay or schedule today',
      tone: 'home',
      cta: { label: 'Pay all', iconName: null },
    }),
    rowCard({
      leading: typeIconLeading({ name: UTIL.hoa.icon, bg: UTIL.hoa.bg, fg: UTIL.hoa.fg }),
      title: 'Elm St HOA',
      subtitle: 'Overdue · was due Oct 5',
      trailing: amountWithChipTrailing({
        amount: '$325.00',
        chipDef: { text: 'Overdue', bg: P.errorBg, fg: P.error },
      }),
      splitWith: { members: ['J'], totalWays: 2 },
    }),
    rowCard({
      leading: typeIconLeading({ name: UTIL.electric.icon, bg: UTIL.electric.bg, fg: UTIL.electric.fg }),
      title: 'ConEd Electric',
      subtitle: 'Due Oct 15',
      trailing: amountWithChipTrailing({
        amount: '$142.80',
        chipDef: { text: 'Due soon', bg: P.warningBg, fg: P.warning },
      }),
      splitWith: { members: ['J', 'A', 'S'], totalWays: 4 },
    }),
    rowCard({
      leading: typeIconLeading({ name: UTIL.internet.icon, bg: UTIL.internet.bg, fg: UTIL.internet.fg }),
      title: 'Verizon Fios',
      subtitle: 'Auto-pays Oct 18',
      inlineChip: { text: 'Auto-pay', bg: P.personalBg, fg: P.personal, iconName: 'repeat' },
      trailing: amountWithChipTrailing({
        amount: '$89.99',
        chipDef: { text: 'Scheduled', bg: P.personalBg, fg: P.personal },
      }),
    }),
    rowCard({
      leading: typeIconLeading({ name: UTIL.gas.icon, bg: UTIL.gas.bg, fg: UTIL.gas.fg }),
      title: 'National Grid Gas',
      subtitle: 'Due Oct 22',
      trailing: amountWithChipTrailing({
        amount: '$67.40',
        chipDef: { text: 'Due', bg: P.warningBg, fg: P.warning },
      }),
      splitWith: { members: ['J', 'A', 'S'], totalWays: 4 },
    }),
    rowCard({
      leading: typeIconLeading({ name: UTIL.water.icon, bg: UTIL.water.bg, fg: UTIL.water.fg }),
      title: 'NYC Water Board',
      subtitle: 'Due Nov 1',
      trailing: amountWithChipTrailing({
        amount: '$48.00',
        chipDef: { text: 'Due', bg: P.warningBg, fg: P.warning },
      }),
      splitWith: { members: ['J', 'A', 'S'], totalWays: 4 },
    }),
    rowCard({
      leading: typeIconLeading({ name: UTIL.insurance.icon, bg: UTIL.insurance.bg, fg: UTIL.insurance.fg }),
      title: 'State Farm renters',
      subtitle: 'Auto-pays Oct 28',
      inlineChip: { text: 'Auto-pay', bg: P.personalBg, fg: P.personal, iconName: 'repeat' },
      trailing: amountWithChipTrailing({
        amount: '$24.50',
        chipDef: { text: 'Scheduled', bg: P.personalBg, fg: P.personal },
      }),
    }),
  ].join('');

  const scrollInner =
    `<div style="flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative">
      <div style="flex:1;overflow:hidden;padding:14px 16px 96px">${body}</div>
    </div>`;

  return [
    topBar({
      title: 'Bills',
      right: `<button style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;cursor:pointer;color:${P.fg1};padding:0">${''}</button>`,
    }),
    tabStrip({ tabs: ['Upcoming (6)', 'Paid (12)', 'All (17)'], active: 0 }),
    scrollInner,
    fab({ kind: 'canonicalCreate', iconName: 'plus', tint: 'home' }),
  ].join('');
}

async function snap(browser, html, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // Use fullPage so the FAB at the bottom of a tall list is captured.
  const png = await page.screenshot({ fullPage: true, type: 'png' });
  await ctx.close();
  return png;
}

async function ensureDir(p) { await mkdir(p, { recursive: true }); }
async function writePng(file, buf) {
  await ensureDir(dirname(file));
  await writeFile(file, buf);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const renderedBody = billsV2Body();
  for (const platform of ['ios', 'android', 'web']) {
    const platformBody = frame({ platform, body: renderedBody });
    const fontFamily = platform === 'android' ? 'roboto' : 'system-ui';
    const html = htmlDoc({ title: `Bills V2 · ${platform}`, body: platformBody, font: fontFamily });
    const png = await snap(browser, html, VIEWPORTS[platform]);
    const outFile = join(PARITY_DIR, `bills-v2-${platform}.png`);
    await writePng(outFile, png);
    console.log(`  ${platform.padEnd(8)} bills-v2-${platform}.png  (${png.length} bytes)`);
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
