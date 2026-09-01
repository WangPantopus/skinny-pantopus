// Renders each T5 screen at 3 viewport sizes (iOS / Android / web
// mobile) and produces 36 per-platform snapshot PNGs plus 12
// parity composites.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

import { frame, htmlDoc, parityComposite } from './lib.mjs';
import { ALL_SCREENS } from './screens.mjs';

const REPO = '/home/user/pantopus';
const SNAP_DIRS = {
  ios: `${REPO}/frontend/apps/ios/PantopusTests/__Snapshots__/t5`,
  android: `${REPO}/frontend/apps/android/app/src/test/snapshots/t5`,
  web: `${REPO}/frontend/apps/web/tests/visual-regression/__snapshots__/t5`,
};
const PARITY_DIR = `${REPO}/docs/screenshots`;

// Mobile viewport sizes (logical pixels mapped to CSS).
const VIEWPORTS = {
  ios: { width: 390, height: 844, deviceScaleFactor: 1 },
  android: { width: 411, height: 891, deviceScaleFactor: 1 },
  web: { width: 400, height: 900, deviceScaleFactor: 1 },
};

async function ensureDir(p) { await mkdir(p, { recursive: true }); }
async function writePng(file, buf) {
  await ensureDir(dirname(file));
  await writeFile(file, buf);
}

async function snap(browser, html, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const png = await page.screenshot({ fullPage: false, type: 'png' });
  await ctx.close();
  return png;
}

async function snapFull(browser, html, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const png = await page.screenshot({ fullPage: true, type: 'png' });
  await ctx.close();
  return png;
}

function kebab(k) {
  return k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let total = 0;

  // Per-platform snapshots.
  for (const [rawKey, screen] of Object.entries(ALL_SCREENS)) {
    const key = kebab(rawKey);
    const renderedBody = screen.body();
    const platforms = ['ios', 'android', 'web'];
    const renderedHtml = {};
    for (const platform of platforms) {
      const platformBody = frame({ platform, body: renderedBody });
      const fontFamily = platform === 'android' ? 'roboto' : 'system-ui';
      const html = htmlDoc({ title: `${screen.title} · ${platform}`, body: platformBody, font: fontFamily });
      renderedHtml[platform] = platformBody;
      const png = await snap(browser, html, VIEWPORTS[platform]);
      const outFile = join(SNAP_DIRS[platform], `${key}-${platform}.png`);
      await writePng(outFile, png);
      console.log(`  ${platform.padEnd(8)} ${key}-${platform}.png  (${png.length} bytes)`);
      total++;
    }

    // Parity composite.
    const parityHtml = parityComposite({
      title: screen.title,
      screenName: key,
      ios: renderedHtml.ios,
      android: renderedHtml.android,
      web: renderedHtml.web,
      caption: screen.caption,
    });
    const compositePng = await snapFull(browser, parityHtml, { width: 1380, height: 920 });
    const compositeFile = join(PARITY_DIR, `parity-${key}.png`);
    await writePng(compositeFile, compositePng);
    console.log(`  parity   parity-${key}.png  (${compositePng.length} bytes)`);
    total++;
  }

  await browser.close();
  console.log(`\nWrote ${total} PNGs.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
