// New-design pack — design-reference PNG rendering script (Phase 9 / P9.1).
//
// Renders the May 2026 design hand-off (docs/designs/A{03,09,10,12,13,14,17,
// 18,21}/*.html) into one PNG per screen × variant and writes them to the
// snapshot-lockfile locations for BOTH mobile platforms:
//
//   frontend/apps/ios/PantopusTests/Features/Shared/__snapshots__/new-designs/<slug>.png
//   frontend/apps/android/app/src/test/snapshots/images/new-designs/<slug>.png
//
// These are the durable visual contract that `NewDesignScreensSnapshotTests`
// (iOS) and `NewDesignScreensSnapshotTest` (Android) lock in place. See
// frontend/apps/ios/PantopusTests/Features/Shared/NEW_DESIGNS.md for the
// regeneration policy (when / by whom / with what approval).
//
// Mirrors the T6 pattern at `render-t6.mjs`. Two structural shapes exist in
// the design pack:
//   - "frame"    files mount each variant into `#f1` / `#f2` (`.frame` grid).
//   - "artboard" files (A17 mailbox variants) mount one `<App/>` into `#root`
//     that lays out each state as a `[data-dc-slot] .dc-card` artboard.
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
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node render-new-designs.mjs
//
// Env overrides: ND_VENDOR (vendored node_modules dir), ND_PLAYWRIGHT
// (playwright entry), ND_DESIGNS, ND_IOS_OUT, ND_ANDROID_OUT.

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
  process.env.ND_IOS_OUT ||
  path.join(
    REPO,
    "frontend/apps/ios/PantopusTests/Features/Shared/__snapshots__/new-designs",
  );
const ANDROID_OUT =
  process.env.ND_ANDROID_OUT ||
  path.join(
    REPO,
    "frontend/apps/android/app/src/test/snapshots/images/new-designs",
  );

// Wide enough that the design's 2-up `.frames` grid stays side-by-side
// (it only collapses below 900px) and the A17 artboard row fits; tall enough
// that element-clip screenshots never trigger a reflow.
const VIEWPORT = { width: 1180, height: 1800 };
const SETTLE_MS = 2200;

// --- The lockfile manifest: every in-scope screen × every designed variant.
// `slug` is the screen id; the PNG file is `<slug>-<variant>.png`. The order
// of `variants` matches the design HTML's frame/artboard declaration order.
const SCREENS = [
  // A03 — Pulse feed (tab archetype)
  { html: "A03/Feed.html", slug: "a03-1-pulse", kind: "frame", variants: ["populated", "empty"] },
  { html: "A03/Beacons.html", slug: "a03-2-beacons", kind: "frame", variants: ["populated", "empty"] },

  // A09 — Transactional detail (sticky-dock archetype)
  { html: "A09/A09.1 Task V2.html", slug: "a09-1-task-v2", kind: "frame", variants: ["populated", "no-bids"] },
  { html: "A09/A09.2 Gig V1.html", slug: "a09-2-gig-v1", kind: "frame", variants: ["populated", "awarded"] },
  { html: "A09/A09.3 Listing.html", slug: "a09-3-listing", kind: "frame", variants: ["populated", "sold"] },
  { html: "A09/A09.4 Invoice.html", slug: "a09-4-invoice", kind: "frame", variants: ["due", "paid"] },

  // A10 — Detail: content
  { html: "A10/A10.9 Support train.html", slug: "a10-9-support-train", kind: "frame", variants: ["populated", "covered"] },
  { html: "A10/A10.10 Wallet.html", slug: "a10-10-wallet", kind: "frame", variants: ["populated", "hold"] },

  // A12 — Wizard archetype (multi-step)
  { html: "A12/A12.4 Claim Ownership Evidence.html", slug: "a12-4-claim-evidence", kind: "frame", variants: ["ready", "in-progress"] },
  { html: "A12/A12.5 Verify Landlord Start.html", slug: "a12-5-verify-landlord-start", kind: "frame", variants: ["start", "fast-track"] },
  { html: "A12/A12.6 Verify Landlord Details.html", slug: "a12-6-verify-landlord-details", kind: "frame", variants: ["populated", "errors"] },
  { html: "A12/A12.7 Postcard Verification.html", slug: "a12-7-postcard-verification", kind: "frame", variants: ["delivered", "in-transit"] },
  { html: "A12/A12.10 Create Business.html", slug: "a12-10-create-business", kind: "frame", variants: ["populated", "search"] },
  { html: "A12/A12.11 Start a Support Train.html", slug: "a12-11-start-support-train", kind: "frame", variants: ["start", "invite"] },

  // A13 — Single-screen forms
  { html: "A13/Review Claim.html", slug: "a13-3-review-claim", kind: "frame", variants: ["pending", "challenging"] },
  { html: "A13/Transfer Ownership.html", slug: "a13-4-transfer-ownership", kind: "frame", variants: ["ready", "confirm"] },
  { html: "A13/Edit Business Page.html", slug: "a13-10-edit-business-page", kind: "frame", variants: ["published", "setup"] },
  { html: "A13/Manage Train.html", slug: "a13-13-manage-train", kind: "frame", variants: ["active", "closing"] },
  { html: "A13/Change Password.html", slug: "a13-14-change-password", kind: "frame", variants: ["ready", "error"] },
  { html: "A13/Disambiguate.html", slug: "a13-15-disambiguate", kind: "frame", variants: ["strong", "unclear"] },
  { html: "A13/My Mail Day.html", slug: "a13-16-my-mail-day", kind: "frame", variants: ["populated", "empty"] },

  // A14 — Settings list
  { html: "A14/A14.1 Home settings.html", slug: "a14-1-home-settings", kind: "frame", variants: ["established", "newly-claimed"] },
  { html: "A14/A14.2 Security.html", slug: "a14-2-security", kind: "frame", variants: ["balanced", "lockdown"] },
  { html: "A14/A14.3 Settings.html", slug: "a14-3-settings", kind: "frame", variants: ["settled", "onboarding"] },
  { html: "A14/A14.4 Blocked users.html", slug: "a14-4-blocked-users", kind: "frame", variants: ["populated", "empty"] },
  { html: "A14/A14.5 Notifications.html", slug: "a14-5-notifications", kind: "frame", variants: ["real-mix", "paused"] },
  { html: "A14/A14.6 Payments.html", slug: "a14-6-payments", kind: "frame", variants: ["populated", "empty"] },
  { html: "A14/A14.7 Privacy.html", slug: "a14-7-privacy", kind: "frame", variants: ["defaults", "stealth"] },
  { html: "A14/A14.8 Vacation hold.html", slug: "a14-8-vacation-hold", kind: "frame", variants: ["scheduling", "active"] },

  // A17 — Mailbox detail variants (10 mail types) — `[data-dc-slot] .dc-card`
  { html: "A17/A17.1 Mail item (generic).html", slug: "a17-1-mail-generic", kind: "artboard", variants: ["open", "acknowledged"] },
  { html: "A17/A17.2 Booklet.html", slug: "a17-2-booklet", kind: "artboard", variants: ["page-view", "grid-view"] },
  { html: "A17/A17.3 Certified mail.html", slug: "a17-3-certified", kind: "artboard", variants: ["open", "acknowledged"] },
  { html: "A17/A17.4 Community mail.html", slug: "a17-4-community", kind: "artboard", variants: ["open", "going"] },
  { html: "A17/A17.5 Coupon.html", slug: "a17-5-coupon", kind: "artboard", variants: ["open", "added"] },
  { html: "A17/A17.6 Gig mail.html", slug: "a17-6-gig-mail", kind: "artboard", variants: ["received", "accepted"] },
  { html: "A17/A17.7 Memory.html", slug: "a17-7-memory", kind: "artboard", variants: ["fresh", "saved"] },
  { html: "A17/A17.8 Package.html", slug: "a17-8-package", kind: "artboard", variants: ["delivered", "transit"] },
  { html: "A17/A17.9 Party mail.html", slug: "a17-9-party", kind: "artboard", variants: ["open", "going"] },
  { html: "A17/A17.10 Records.html", slug: "a17-10-records", kind: "artboard", variants: ["open", "filed"] },

  // A18 — Status / waiting / preview
  { html: "A18/Verify Email Sent.html", slug: "a18-1-verify-email-sent", kind: "frame", variants: ["waiting", "resent"] },
  { html: "A18/Claim Submitted.html", slug: "a18-2-claim-submitted", kind: "frame", variants: ["submitted", "approved"] },
  { html: "A18/Verification Submitted.html", slug: "a18-3-verification-submitted", kind: "frame", variants: ["waiting", "confirmed"] },

  // A21 — Public Beacon profile
  { html: "A21/A21.1 Persona Profile.html", slug: "a21-1-persona", kind: "frame", variants: ["populated", "empty"] },
  { html: "A21/A21.2 Local Profile.html", slug: "a21-2-local", kind: "frame", variants: ["populated", "empty"] },
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
        // (`#f1`/`#f2` vs named `#f-ready`/`#f-error`), so clip the mount by
        // structure rather than id.
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
        console.log(`  ok  ${file.padEnd(44)} ${(st.size / 1024).toFixed(0)} KB`);
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
    path.join(REPO, "new-designs-manifest.json"),
    JSON.stringify({ count: written.length, slugs: written.map((f) => f.replace(/\.png$/, "")) }, null, 2),
  );
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
