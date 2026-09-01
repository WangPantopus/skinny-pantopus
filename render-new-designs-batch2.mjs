// New-design pack (batch 2) — design-reference PNG rendering script (B7.1).
//
// Renders the batch-2 design hand-off (the screens that post-date the
// original 44-screen audit: docs/designs/A{17,10,18,19}/*.html) into one PNG
// per screen × variant and writes them to the batch-2 snapshot-lockfile
// locations for BOTH mobile platforms:
//
//   frontend/apps/ios/PantopusTests/Features/__snapshots__/new-designs-batch2/<slug>.png
//   frontend/apps/android/app/src/test/snapshots/images/new-designs-batch2/<slug>.png
//
// These are the durable visual contract that `T8ScreensSnapshotTests` (iOS)
// and `NewDesignBatch2ScreensSnapshotTest` (Android) lock in place. See
// frontend/apps/ios/PantopusTests/Features/Shared/NEW_DESIGNS_BATCH2.md for
// the regeneration policy (when / by whom / with what approval).
//
// Mirrors `render-new-designs.mjs` (batch 1), which itself mirrors
// `render-t6.mjs`. Two structural shapes exist in the design pack:
//   - "frame"    files mount each variant into `#f1` / `#f2` (`.frame` grid):
//     A10.6/7/11, A18.4 Waiting room, A18.5 View As, A19.1/2 legal.
//   - "artboard" files (the four new A17 mailbox screens) mount one `<App/>`
//     into `#root` that lays each state out as a `[data-dc-slot] .dc-card`.
//
// The design HTMLs pull React / ReactDOM / Babel / lucide from the unpkg CDN.
// CDN egress is blocked in CI sandboxes, so this script:
//   1. serves docs/designs over a local static server (so the relative
//      `.jsx` / `.css` loads resolve), and
//   2. intercepts the unpkg requests and fulfils them from a locally
//      vendored copy of the exact UMD bundles, stripping the SRI integrity
//      attributes so the swapped bytes are accepted.
//
// Vendor the UMD bundles once (npm registry is reachable even where the CDN
// is not):
//
//   mkdir -p /tmp/nd-vendor && cd /tmp/nd-vendor && npm init -y \
//     && npm install react@18.3.1 react-dom@18.3.1 \
//                    @babel/standalone@7.29.0 lucide@latest
//
// Then, from the repo root:
//
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node render-new-designs-batch2.mjs
//
// Env overrides: ND_VENDOR (vendored node_modules dir), ND_PLAYWRIGHT
// (playwright entry), ND_DESIGNS, ND2_IOS_OUT, ND2_ANDROID_OUT.

import http from "node:http";
import { promises as fs } from "node:fs";
import fssync from "node:fs";
import path from "node:path";
import net from "node:net";

const REPO = path.dirname(new URL(import.meta.url).pathname);
const DESIGNS = process.env.ND_DESIGNS || path.join(REPO, "docs/designs");
const VENDOR =
  process.env.ND_VENDOR || "/tmp/nd-vendor/node_modules";
const PLAYWRIGHT =
  process.env.ND_PLAYWRIGHT ||
  "/opt/node22/lib/node_modules/playwright/index.mjs";
const IOS_OUT =
  process.env.ND2_IOS_OUT ||
  path.join(
    REPO,
    "frontend/apps/ios/PantopusTests/Features/__snapshots__/new-designs-batch2",
  );
const ANDROID_OUT =
  process.env.ND2_ANDROID_OUT ||
  path.join(
    REPO,
    "frontend/apps/android/app/src/test/snapshots/images/new-designs-batch2",
  );

// Wide enough that the design's 2-up `.frames` grid stays side-by-side
// (it only collapses below 900px) and the A17 artboard row fits; tall enough
// that element-clip screenshots never trigger a reflow.
const VIEWPORT = { width: 1180, height: 1800 };
const SETTLE_MS = 2200;

// --- The lockfile manifest: every in-scope batch-2 screen × every designed
// variant, in the design HTML's frame/artboard declaration order. `slug` is
// the screen id; the PNG file is `<slug>-<variant>.png`.
const SCREENS = [
  // A17 — four new standalone mailbox screens (artboard: [data-dc-slot] .dc-card)
  { html: "A17/A17.11 Stamps.html", slug: "a17-11-stamps", kind: "artboard", variants: ["populated", "empty"] },
  { html: "A17/A17.12 Mail task.html", slug: "a17-12-mail-task", kind: "artboard", variants: ["open", "done"] },
  { html: "A17/A17.13 Translation.html", slug: "a17-13-translation", kind: "artboard", variants: ["machine", "confirmed"] },
  { html: "A17/A17.14 Unboxing.html", slug: "a17-14-unboxing", kind: "artboard", variants: ["classified", "filed"] },

  // A10 — business surfaces + earn (frame)
  { html: "A10/A10.6 Business profile.html", slug: "a10-6-business-profile", kind: "frame", variants: ["populated", "new"] },
  { html: "A10/A10.7 Business (owner view).html", slug: "a10-7-business-owner", kind: "frame", variants: ["edit", "preview"] },
  { html: "A10/A10.11 Earn.html", slug: "a10-11-earn", kind: "frame", variants: ["populated", "empty"] },

  // A18 — waiting room (reshape) + view as (frame)
  { html: "A18/Waiting for Approval.html", slug: "a18-4-waiting-room", kind: "frame", variants: ["active", "more-info"] },
  { html: "A18/View As.html", slug: "a18-5-view-as", kind: "frame", variants: ["connection", "public"] },

  // A19 — legal long-form archetype (frame)
  { html: "A19/A19.1 Privacy Policy.html", slug: "a19-1-privacy", kind: "frame", variants: ["top", "reading"] },
  { html: "A19/A19.2 Terms of Service.html", slug: "a19-2-terms", kind: "frame", variants: ["top", "reading"] },
];

const CDN_VENDOR = [
  [/unpkg\.com\/lucide@latest$/, "lucide/dist/umd/lucide.js"],
  [/react@18\.3\.1\/umd\/react\.development\.js/, "react/umd/react.development.js"],
  [/react-dom@18\.3\.1\/umd\/react-dom\.development\.js/, "react-dom/umd/react-dom.development.js"],
  [/@babel\/standalone@7\.29\.0\/babel\.min\.js/, "@babel/standalone/babel.min.js"],
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".jsx": "application/javascript; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

async function preflight() {
  if (!fssync.existsSync(DESIGNS)) throw new Error(`designs dir missing: ${DESIGNS}`);
  for (const [, rel] of CDN_VENDOR) {
    const p = path.join(VENDOR, rel);
    if (!fssync.existsSync(p)) {
      throw new Error(
        `vendored bundle missing: ${p}\n` +
          `Vendor them first (see the header of this file):\n` +
          `  mkdir -p /tmp/nd-vendor && cd /tmp/nd-vendor && npm init -y && \\\n` +
          `    npm install react@18.3.1 react-dom@18.3.1 @babel/standalone@7.29.0 lucide@latest`,
      );
    }
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

// Minimal static server rooted at docs/designs. Strips SRI integrity /
// crossorigin attributes from served HTML so the vendored CDN swap is
// accepted regardless of byte-for-byte hash parity.
function startServer(port) {
  const server = http.createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const abs = path.join(DESIGNS, rel);
      if (!abs.startsWith(DESIGNS)) {
        res.writeHead(403).end();
        return;
      }
      let body = await fs.readFile(abs);
      const ext = path.extname(abs).toLowerCase();
      if (ext === ".html") {
        body = Buffer.from(
          body
            .toString("utf8")
            .replace(/\s+integrity="[^"]*"/g, "")
            .replace(/\s+crossorigin(="[^"]*")?/g, ""),
        );
      }
      res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

async function main() {
  await preflight();
  const { chromium } = await import(PLAYWRIGHT);

  const port = await freePort();
  const server = await startServer(port);

  await fs.mkdir(IOS_OUT, { recursive: true });
  await fs.mkdir(ANDROID_OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Serve the blocked CDN scripts from the local vendor copy.
  await page.route("**/unpkg.com/**", async (route) => {
    const url = route.request().url();
    const hit = CDN_VENDOR.find(([re]) => re.test(url));
    if (!hit) return route.abort();
    return route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: await fs.readFile(path.join(VENDOR, hit[1])),
    });
  });

  let ok = 0;
  let fail = 0;
  const written = [];

  for (const s of SCREENS) {
    const url = `http://127.0.0.1:${port}/${s.html.split("/").map(encodeURIComponent).join("/")}`;
    try {
      await page.goto(url, { waitUntil: "load", timeout: 20_000 });
      await page.waitForTimeout(SETTLE_MS);

      // Resolve one element handle per variant, in declaration order.
      let handles;
      if (s.kind === "artboard") {
        const slots = await page.$$("[data-dc-slot]");
        handles = [];
        for (const slot of slots) handles.push((await slot.$(".dc-card")) || slot);
      } else {
        // Each variant lives in a `.frame` whose first element child is the
        // React mount node (the phone). Mount ids vary across the pack
        // (`#f1`/`#f2`), so clip the mount by structure rather than id.
        const frames = await page.$$(".frame");
        handles = [];
        for (const fr of frames) {
          const mount = (await fr.evaluateHandle((el) => el.firstElementChild)).asElement();
          handles.push(mount || fr);
        }
      }

      if (handles.length !== s.variants.length) {
        throw new Error(
          `expected ${s.variants.length} frames, found ${handles.length} (kind=${s.kind})`,
        );
      }

      for (let i = 0; i < s.variants.length; i++) {
        const file = `${s.slug}-${s.variants[i]}.png`;
        const iosPath = path.join(IOS_OUT, file);
        await handles[i].screenshot({ path: iosPath, type: "png" });
        await fs.copyFile(iosPath, path.join(ANDROID_OUT, file));
        const st = await fs.stat(iosPath);
        if (st.size < 4 * 1024) throw new Error(`${file} too small (${st.size}B)`);
        written.push(file);
        ok++;
        console.log(`  ok  ${file.padEnd(42)} ${(st.size / 1024).toFixed(0)} KB`);
      }
    } catch (err) {
      fail++;
      console.error(`  FAIL ${s.html}: ${err.message}`);
    }
  }

  await browser.close();
  server.close();

  console.log(`\nDone. ${ok} PNGs written / ${fail} failed.`);
  console.log(`  iOS:     ${IOS_OUT}`);
  console.log(`  Android: ${ANDROID_OUT}`);
  // Emit the slug list so the test files can be regenerated/checked.
  await fs.writeFile(
    path.join(REPO, "new-designs-batch2-manifest.json"),
    JSON.stringify({ count: written.length, slugs: written.map((f) => f.replace(/\.png$/, "")) }, null, 2),
  );
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
