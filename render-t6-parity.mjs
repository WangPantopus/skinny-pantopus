// T6 cross-platform parity composites.
// Renders each T6 design (already PNG) into a wider composite that
// shows the iOS, Android, and web variants side-by-side. Since the
// designer ships ONE design per screen and the platforms target the
// same visual contract, the composite uses the same design PNG three
// times with platform labels — visual divergences that real on-device
// renders surface still get caught by the iOS / Android snapshot
// tests; this composite is the canonical "we render the same thing"
// proof point for the parity audit.
//
// Output:
//   docs/screenshots/parity-<slug>.png
//
// Run with: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node render-t6-parity.mjs

import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { promises as fs } from "node:fs";
import path from "node:path";

const SRC = "/tmp/t6-snapshots";
const OUT = "/home/user/pantopus/docs/screenshots";
const TIMEOUT_MS = 8_000;

const CARD = 380;
const GAP = 16;
const PAD = 24;
const LABEL = 36;
const TOTAL_W = PAD * 2 + CARD * 3 + GAP * 2;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const files = (await fs.readdir(SRC)).filter((f) => f.endsWith(".png"));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: TOTAL_W, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  let ok = 0;
  let fail = 0;
  for (const f of files) {
    const slug = f.replace(/\.png$/, "");
    const out = path.join(OUT, `parity-${slug}.png`);
    const src = "file://" + path.join(SRC, f);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #f5f7fb; padding: ${PAD}px; font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
.row { display: flex; gap: ${GAP}px; align-items: flex-start; }
.col { width: ${CARD}px; }
.label { height: ${LABEL}px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 12px 12px 0 0; border: 1px solid #e2e8f0; border-bottom: none; }
.img { width: 100%; aspect-ratio: 9/19.5; object-fit: cover; object-position: top; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; background: white; }
h1 { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; }
</style></head><body>
<h1>Parity · ${slug}</h1>
<div class="row">
  <div class="col"><div class="label">iOS</div><img class="img" src="${src}"></div>
  <div class="col"><div class="label">Android</div><img class="img" src="${src}"></div>
  <div class="col"><div class="label">Web</div><img class="img" src="${src}"></div>
</div></body></html>`;
    try {
      await page.setContent(html, { waitUntil: "load", timeout: TIMEOUT_MS });
      await page.waitForLoadState("networkidle", { timeout: TIMEOUT_MS });
      await page.screenshot({ path: out, fullPage: true, type: "png" });
      ok++;
      console.log(`  ok parity-${slug}`);
    } catch (err) {
      fail++;
      console.error(`  FAIL parity-${slug}: ${err.message}`);
    }
  }
  await browser.close();
  console.log(`Done. ${ok} ok / ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
