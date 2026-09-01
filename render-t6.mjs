// T6 screens — design-reference PNG rendering script.
// Run with `node /tmp/render-t6.mjs`. Requires playwright (already installed).
//
// Reads every `.html` file in /tmp/designs/A08*/ and renders each at the
// canonical mobile viewport (390×844 — iPhone 14/15) and a wide-shot
// viewport for the screens that the design intends as full-page.
//
// Output:
//   /tmp/t6-snapshots/<slug>.png       (mobile baseline, ~390×844)
//
// The slugs are kebab-case derived from the HTML filename (e.g.
// "A17.1 Mail item (generic).html" → "a17-1-mail-item-generic").
//
// We deliberately don't try to compile down all 60 design HTMLs — each
// HTML in the design pack is already a stylized React-export single-page
// document with inline CSS. Playwright treats it as a regular page.

import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { promises as fs } from "node:fs";
import path from "node:path";

const SRC = "/tmp/designs/A08 — per-screen batch 1";
const OUT = "/tmp/t6-snapshots";
const VIEWPORT = { width: 430, height: 932 }; // iPhone 15 Pro Max — fits all the variants in the pack
const TIMEOUT_MS = 6_000;

function slugify(name) {
  return name
    .replace(/\.html$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const files = (await fs.readdir(SRC)).filter((f) => f.endsWith(".html"));
  console.log(`Found ${files.length} design HTMLs.`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  let ok = 0;
  let fail = 0;
  for (const f of files) {
    const slug = slugify(f);
    const out = path.join(OUT, `${slug}.png`);
    try {
      await page.goto("file://" + path.join(SRC, f), {
        waitUntil: "load",
        timeout: TIMEOUT_MS,
      });
      // Give animations a moment to settle.
      await page.waitForTimeout(250);
      await page.screenshot({ path: out, fullPage: true, type: "png" });
      const st = await fs.stat(out);
      ok++;
      console.log(`  ok ${slug.padEnd(40)} ${(st.size / 1024).toFixed(0)} KB`);
    } catch (err) {
      fail++;
      console.error(`  FAIL ${slug}: ${err.message}`);
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
