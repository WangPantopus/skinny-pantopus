# New-design snapshot lockfile (P9.1)

The **new-design pack lockfile** locks the May 2026 design hand-off
(`docs/designs/A{03,09,10,12,13,14,17,18,21}/`) as the durable visual
reference for every screen built out across Phases 1–8. It is the tripwire
that catches future drift — a dropped screen, a lost variant, a baseline that
gets deleted or corrupted.

## What it is (and isn't)

- **A presence tripwire**, mirrored on both platforms:
  - iOS — [`NewDesignScreensSnapshotTests.swift`](NewDesignScreensSnapshotTests.swift)
    (mirrors the convention in `T6ScreensSnapshotTests.swift`).
  - Android — `app/src/test/java/app/pantopus/android/ui/screens/shared/NewDesignScreensSnapshotTest.kt`
    (a plain JUnit test under the Paparazzi snapshot dir — no `Paparazzi`
    rule, so it verifies on the JVM without the Android SDK / layoutlib).
- Each test asserts its committed reference PNG is **present, non-trivial
  (> 4 KB), and a real PNG** (magic-byte check).
- It is **not** a pixel diff against the live SwiftUI / Compose render. The
  per-screen render suites (`WalletSnapshotTest`, render-smoke tests, etc.)
  already lock the *implementation*. This lockfile locks the *design pack*
  those screens target; design-vs-implementation diffs are caught in code
  review, not here.

## The locked matrix — 88 rows

One row per **screen × designed variant**. The reference PNGs are
platform-neutral (the designer ships one frame per screen × variant; iOS and
Android target the same contract), so the **same bytes** are committed under
both:

- iOS: `PantopusTests/Features/Shared/__snapshots__/new-designs/<slug>.png`
- Android: `app/src/test/snapshots/images/new-designs/<slug>.png`

| Archetype | Screens | Rows |
|---|---|---:|
| A03 — Pulse feed | Pulse, Beacons | 4 |
| A09 — Transactional detail | Task V2, Gig V1, Listing, Invoice | 8 |
| A10 — Detail: content | Support train, Wallet | 4 |
| A12 — Wizard | Claim evidence, Verify-landlord start/details, Postcard, Create business, Start support train | 12 |
| A13 — Single-screen forms | Review claim, Transfer, Edit business page, Manage train, Change password, Disambiguate, My Mail Day | 14 |
| A14 — Settings list | Home settings, Security, Settings index, Blocked users, Notifications, Payments, Privacy, Vacation hold | 16 |
| A17 — Mailbox detail variants | Generic, Booklet, Certified, Community, Coupon, Gig, Memory, Package, Party, Records | 20 |
| A18 — Status / waiting | Verify email sent, Claim submitted, Verification submitted | 6 |
| A21 — Public Beacon profile | Persona, Local | 4 |
| **Total** | **44 screens** | **88** |

Slugs are `<screen-id>-<variant>` (e.g. `a09-1-task-v2-populated`,
`a14-7-privacy-stealth`, `a17-5-coupon-added`). Each PNG has exactly one iOS
`func test_…()` and one Android `@Test fun …()`; the method name is the slug
with `-` → `_`.

## How to regenerate — when / by whom / with what approval

**When.** Only when a **new, approved design hand-off** lands (or an existing
in-scope screen's design is intentionally revised). This is a deliberate act,
not a routine `record` step — regenerating silently re-blesses whatever the
design pack currently renders, which is exactly the drift this file exists to
catch.

**By whom & approval.** The regenerating engineer must have **design + mobile
lead sign-off** on the updated `docs/designs/**` pack referenced in the PR
description. Treat a baseline change like a contract change: the PR diff (the
changed PNGs) is the review surface. Do **not** regenerate just to make a
failing row pass — first confirm the failure isn't a real regression (a screen
or variant that went missing).

**How.** The renderer ([`render-new-designs.mjs`](../../../../../../render-new-designs.mjs)
at the repo root, mirroring `render-t6.mjs`) turns the design HTML pack into
one PNG per screen × variant and writes them to **both** platform dirs.

The design HTMLs pull React / ReactDOM / Babel / lucide from the unpkg CDN.
CDN egress is blocked in CI sandboxes, so vendor the exact UMD bundles once
(the npm registry is reachable even where the CDN is not):

```sh
mkdir -p /tmp/nd-vendor && cd /tmp/nd-vendor && npm init -y \
  && npm install react@18.3.1 react-dom@18.3.1 @babel/standalone@7.29.0 lucide@latest
```

Then, from the repo root:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node render-new-designs.mjs
```

This (1) serves `docs/designs/` over a local static server so the relative
`.jsx`/`.css` loads resolve, (2) intercepts the unpkg requests and fulfils
them from the vendored copy (stripping the SRI `integrity` attrs), (3) clips
one PNG per variant (`.frame` mounts for most screens; `[data-dc-slot] .dc-card`
artboards for the A17 mailbox variants), and (4) writes them to:

- `frontend/apps/ios/PantopusTests/Features/Shared/__snapshots__/new-designs/`
- `frontend/apps/android/app/src/test/snapshots/images/new-designs/`

It also emits `new-designs-manifest.json` (the slug list) at the repo root.

Env overrides: `ND_VENDOR`, `ND_PLAYWRIGHT`, `ND_DESIGNS`, `ND_IOS_OUT`,
`ND_ANDROID_OUT`.

**Adding or removing a screen/variant.** Update the `SCREENS` manifest in
`render-new-designs.mjs`, re-render, then add/remove the matching
`func test_…()` (iOS) and `@Test fun …()` (Android) rows so the test count
stays 1:1 with the committed PNG set. The cross-check is simply: every PNG in
`new-designs/` has exactly one test row on each platform, and vice-versa.

## Verifying

- iOS: `make test` (the rig runs as part of the `PantopusTests` bundle).
- Android: `./gradlew :app:testDebugUnitTest` (runs on the JVM; **no** Android
  SDK needed for this rig since it asserts file presence, not a render).
