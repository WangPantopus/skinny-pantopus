# New-design snapshot lockfile — batch 2 (B7.1)

The **batch-2 new-design pack lockfile** locks the second design hand-off
(`docs/designs/A{17,10,18,19}/` — the frames that post-date the original
44-screen audit) as the durable visual reference for the eleven screens built
out across Phases B2–B6. It is the tripwire that catches future drift — a
dropped screen, a lost variant, a baseline that gets deleted or corrupted.

It is the direct sibling of the batch-1 lockfile (`NEW_DESIGNS.md` /
`NewDesignScreensSnapshotTests.swift`); read that first for the shared
rationale.

## What it is (and isn't)

- **A presence tripwire**, mirrored on both platforms:
  - iOS — [`T8ScreensSnapshotTests.swift`](T8ScreensSnapshotTests.swift)
    (mirrors `NewDesignScreensSnapshotTests.swift` / `T6ScreensSnapshotTests.swift`).
  - Android — `app/src/test/java/app/pantopus/android/ui/screens/shared/NewDesignBatch2ScreensSnapshotTest.kt`
    (a plain JUnit test under the Paparazzi snapshot dir — no `Paparazzi`
    rule, so it verifies on the JVM without the Android SDK / layoutlib).
- Each test asserts its committed reference PNG is **present, non-trivial
  (> 4 KB), and a real PNG** (magic-byte check).
- It is **not** a pixel diff against the live SwiftUI / Compose render. The
  per-screen render suites (`StampsSnapshotTests`, `MailTaskSnapshotTests`,
  `TranslationSnapshotTests`, `UnboxingSnapshotTests`,
  `BusinessProfileSnapshotTests`, `EarnSnapshotTests`,
  `WaitingRoomSnapshotTests`, `ViewAsSnapshotTests`,
  `LegalDocumentSnapshotTests`, and their Android Paparazzi peers) already
  lock the *implementation*. This lockfile locks the *design pack* those
  screens target; design-vs-implementation diffs are caught in code review,
  not here.

## The locked matrix — 22 rows

One row per **screen × designed variant**. The reference PNGs are
platform-neutral (the designer ships one frame per screen × variant; iOS and
Android target the same contract), so the **same bytes** are committed under
both:

- iOS: `PantopusTests/Features/__snapshots__/new-designs-batch2/<slug>.png`
- Android: `app/src/test/snapshots/images/new-designs-batch2/<slug>.png`

| Design | Screen | Variants | PR |
|---|---|---|---|
| A17.11 | Stamps | populated · empty | #187 (B2.1) |
| A17.12 | Mail task | open · done | #186 (B2.2) |
| A17.13 | Translation | machine · confirmed | #188 (B2.3) |
| A17.14 | Unboxing | classified · filed | #189 (B2.4) |
| A10.6 | Business profile | populated · new | #185 (B3.1) |
| A10.7 | Business owner view | edit · preview | #191 (B3.2) |
| A10.11 | Earn | populated · empty | #190 (B4.1) |
| A18.4 | Waiting room | active · more-info | #194 (B5.1) |
| A18.5 | View As | connection · public | #192 (B5.2) |
| A19.1 | Privacy Policy | top · reading | #193 (B6.1) |
| A19.2 | Terms of Service | top · reading | #193 (B6.1) |
| | **11 screens** | | **22 rows** |

Slugs are `<screen-id>-<variant>` (e.g. `a17-11-stamps-populated`,
`a18-5-view-as-public`, `a19-1-privacy-reading`). Each PNG has exactly one iOS
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

**How.** The renderer ([`render-new-designs-batch2.mjs`](../../../../../../render-new-designs-batch2.mjs)
at the repo root, mirroring `render-new-designs.mjs`) turns the design HTML
pack into one PNG per screen × variant and writes them to **both** platform
dirs.

The design HTMLs pull React / ReactDOM / Babel / lucide from the unpkg CDN.
CDN egress is blocked in CI sandboxes, so vendor the exact UMD bundles once
(the npm registry is reachable even where the CDN is not):

```sh
mkdir -p /tmp/nd-vendor && cd /tmp/nd-vendor && npm init -y \
  && npm install react@18.3.1 react-dom@18.3.1 @babel/standalone@7.29.0 lucide@latest
```

Then, from the repo root:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node render-new-designs-batch2.mjs
```

This (1) serves `docs/designs/` over a local static server so the relative
`.jsx`/`.css` loads resolve, (2) intercepts the unpkg requests and fulfils
them from the vendored copy (stripping the SRI `integrity` attrs), (3) clips
one PNG per variant (`.frame` mounts for A10/A18/A19; `[data-dc-slot] .dc-card`
artboards for the four new A17 mailbox screens), and (4) writes them to:

- `frontend/apps/ios/PantopusTests/Features/__snapshots__/new-designs-batch2/`
- `frontend/apps/android/app/src/test/snapshots/images/new-designs-batch2/`

It also emits `new-designs-batch2-manifest.json` (the slug list) at the repo
root.

Env overrides: `ND_VENDOR`, `ND_PLAYWRIGHT`, `ND_DESIGNS`, `ND2_IOS_OUT`,
`ND2_ANDROID_OUT`.

**Adding or removing a screen/variant.** Update the `SCREENS` manifest in
`render-new-designs-batch2.mjs`, re-render, then add/remove the matching
`func test_…()` (iOS) and `@Test fun …()` (Android) rows so the test count
stays 1:1 with the committed PNG set. The cross-check is simply: every PNG in
`new-designs-batch2/` has exactly one test row on each platform, and
vice-versa.

## Verifying

- iOS: `make test` (the rig runs as part of the `PantopusTests` bundle).
- Android: `./gradlew :app:testDebugUnitTest` (runs on the JVM; **no** Android
  SDK needed for this rig since it asserts file presence, not a render).
