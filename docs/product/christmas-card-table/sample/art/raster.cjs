#!/usr/bin/env node
// Renders an HTML string or file with headless Chrome to a transparent PNG.
// usage: node raster.cjs <in.html> <out.png> <width> <height> [scale]
const fs = require('fs');
const os = require('os');
const path = require('path');
const PW = process.env.PLAYWRIGHT_TEST || path.resolve(__dirname, '../../../../../../frontend/apps/web/node_modules/@playwright/test');
const { chromium } = require(PW);
(async () => {
  const [inFile, out, w, h, scale] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(scale || 1) });
  const [file, hash] = inFile.split('#');
  await page.goto('file://' + path.resolve(file) + (hash ? '#' + hash : ''), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: out, omitBackground: true });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
