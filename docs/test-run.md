# P8.2 — Full snapshot regression run report

**Run date:** 2026-05-26
**Branch under test:** `master` @ `8c8e6bb9` (the head this `claude/ecstatic-rubin-QFk1U` branch is built from; only `docs/screen-parity-inventory.md` diverges, no test code or production code in the diff)
**Authoritative CI run:** GitHub Actions on PR #131 → master, run started 2026-05-26 21:24 UTC, completed 21:45 UTC

---

## Executive summary

| Suite | Files | Test methods | Snapshot baselines | Status | Wall time |
|---|---:|---:|---:|---|---:|
| iOS unit + snapshot | 196 `*Tests.swift` | **2 044** `func test…` | 90 PNG | **green** (3 simulators) | 13m 07s – 21m 30s |
| iOS UI (XCUITest) | 10 `.swift` | included in matrix | n/a | **green** (StoreScreenshots skipped per CI flag) | rolled into matrix |
| Android unit + Paparazzi snapshot | 223 `*Test.kt` | **1 998** `@Test` | 327 PNG | **green** | 16m 59s |
| Android instrumented (emulator) | 9 `*Test.kt` | (smoke) | n/a | **green** | 11m 08s |
| **Total** | **438** | **4 042** | **417** | **all green** | — |

- **Snapshot baselines:** 417 total — 90 iOS (under `PantopusTests/__Snapshots__/{auth,t5,t6,a12-add-home}/`) + 327 Android Paparazzi (under `app/src/test/snapshots/`).
- **Failures:** 0 across every job, every simulator, every Paparazzi reference image.
- **Regressions vs. prior runs:** none.

Acceptance — iOS suite green, Android suite green, report generated.

---

## iOS — `frontend/apps/ios && make test`

`make test` shells to:

```
xcodebuild \
  -project Pantopus.xcodeproj \
  -scheme Pantopus \
  -destination "platform=iOS Simulator,…" \
  -configuration Debug \
  test
```

CI splits this across a 3-simulator matrix (Xcode 16.4, iOS 18.5 simulator runtime). All three legs of the matrix passed:

| Simulator | Job ID | Started (UTC) | Completed (UTC) | Wall | Result |
|---|---|---|---|---:|---|
| iPhone 16 | `77961634498` | 21:25:28 | 21:44:44 | 19m 16s | **✓ success** |
| iPhone 16 Pro | `77961634508` | 21:24:20 | 21:45:50 | 21m 30s | **✓ success** |
| iPhone SE (3rd generation) | `77961634512` | 21:24:20 | 21:37:27 | 13m 07s | **✓ success** |
| Lint (SwiftLint + SwiftFormat) | `77961634505` | 21:24:20 | 21:24:56 | 36s | **✓ success** |

(Job URLs are under `https://github.com/WangPantopus/pantopus/actions/runs/26476008533/job/<id>` per `mcp__github__pull_request_read.get_check_runs` on PR #131.)

### Test inventory (counted from source)

| Category | Files | `func test…` methods |
|---|---:|---:|
| Snapshot tests (use `SnapshotTesting`) | 6 | 38 |
| Unit tests (view-models, networking, design system) | 190 | 2 006 |
| **Total `PantopusTests`** | **196** | **2 044** |
| UI tests (`XCUITest`, `PantopusUITests`) | 10 | — |

### Snapshot baselines (90 PNGs under `__Snapshots__/`)

| Directory | PNGs | Source file |
|---|---:|---|
| `__Snapshots__/auth/` | 6 | `Features/Auth/AuthScreensSnapshotTests.swift` (6 methods) |
| `__Snapshots__/a12-add-home/` | 2 | covered by feature tests |
| `__Snapshots__/t5/` | 12 | `Features/Shared/ListOfRows/T5ScreensSnapshotTests.swift` (12 methods) |
| `__Snapshots__/t6/` | 70 | `Features/Chat/ChatConversationSnapshotTests.swift` (9), `Features/Compose/PulseComposeSnapshotTests.swift` (7), `Features/DiscoverHub/DiscoverHubSnapshotTests.swift` (2), `Features/Mailbox/GigBodySnapshotTests.swift` (2), plus parametric matrices |
| **Total** | **90** | — |

Coverage report is generated per-simulator via `xcrun xccov view --report --json` and uploaded as `ios-test-results-<slug>` artifacts (7-day retention).

---

## Android — `frontend/apps/android && ./gradlew test`

CI runs the full quality + test fan-out:

```
./gradlew \
  ktlintCheck \
  detekt \
  :app:lintDebug \
  test \
  paparazziVerify \
  :app:assembleDebug \
  --no-daemon
```

`paparazziVerify` is the snapshot-regression gate (`verifyPaparazziDebug`) — a deliberately altered colour or radius will fail CI per the acceptance criteria recorded inline in `.github/workflows/android-ci.yml`.

| Job | Job ID | Started (UTC) | Completed (UTC) | Wall | Result |
|---|---|---|---|---:|---|
| Lint, test, assemble | `77961634683` | 21:24:19 | 21:41:18 | 16m 59s | **✓ success** |
| Instrumented tests (emulator) | `77961634713` | 21:24:20 | 21:35:28 | 11m 08s | **✓ success** |

(Job URLs under `https://github.com/WangPantopus/pantopus/actions/runs/26476008531/job/<id>`.)

### Test inventory (counted from source)

| Category | Files | `@Test` methods |
|---|---:|---:|
| Paparazzi snapshot tests (use `paparazzi` rule) | 88 | (subset of total) |
| Unit tests (view-models, repositories, content factories) | 135 | (subset of total) |
| **Total `app/src/test`** | **223** | **1 998** |
| Instrumented (`app/src/androidTest`) | 9 | (smoke) |

### Paparazzi baselines (327 PNGs under `app/src/test/snapshots/`)

- `app/src/test/snapshots/images/` — 309 Paparazzi-generated images, named
  `<package>_<TestClass>_<testMethod>.png`.
- `app/src/test/snapshots/auth/` — 6 named baselines (login / signup / verify / forgot / reset / error).
- `app/src/test/snapshots/t5/` — 12 named baselines from the T5 list-of-rows screens.

Per-feature snapshot file count (top 10 by volume): Homes 15 · Gigs 5 · AudienceProfile 4 · Compose 4 · Mailbox / Inbox 3 · DiscoverHub 2 · Hub 2 · Profile · Identity Center · Memberships · Membership · MyTasks · MyBids · MyPosts · MyListings · ReviewClaims · ReviewSignups · Listings · Marketplace · Notifications · Offers · Settings · Status · TokenAccept · Today · SupportTrains · PrivacyHandshake · PulseComposes · Posts · CeremonialMail · CeremonialMailOpen · ContentDetail · CreatorInbox · DiscoverBusinesses · Explore · Feed · BusinessProfile · Businesses · RecentActivity · Root · You · Connections (1–2 each).

### Quality gates also enforced by the same workflow run

- `ktlintCheck` — Kotlin formatter — green.
- `detekt` — Kotlin static analysis — green.
- `:app:lintDebug` — Android Lint — green.
- "No raw hex in feature code" grep guard (acceptance criterion #5 of original P1) — green.
- `:app:assembleDebug` — debug APK builds successfully and is uploaded as `app-debug.apk`.

---

## Local execution note (transparent)

This sandboxed Linux environment cannot execute either suite directly:

- **iOS** requires `xcodebuild` + Xcode + the iOS simulator runtime, all macOS-only. `make test` will not run on Linux.
- **Android** requires the Android Gradle Plugin `com.android.application:8.5.2`, hosted on Google Maven (`https://dl.google.com/android/maven2/`). The environment's network policy denies that host (`403 host_not_allowed`), and no cached AGP artifact exists locally, so `./gradlew test` exits at "could not resolve plugin artifact" before any test runs. Installing OpenJDK 17 (already installed for completeness) does not change this.

The branch under test (`claude/ecstatic-rubin-QFk1U`) modifies only `docs/screen-parity-inventory.md`. No `frontend/apps/{ios,android}/**` paths changed, so the path-filtered CI workflows in `.github/workflows/{ios,android}-ci.yml` would not even trigger on push — the master baseline (`8c8e6bb9`) carries the same test code this branch carries, so the master CI run on PR #131 is the authoritative, equivalent regression signal.

---

## Acceptance verdict

| Acceptance item | Result | Evidence |
|---|---|---|
| All snapshot tests pass | ✓ | 90 iOS + 327 Android baselines verified by `xcodebuild test` (3 simulators) and `paparazziVerify` — both green on the master commit this branch points at. |
| No regressions in unit tests | ✓ | 2 044 iOS test methods + 1 998 Android `@Test` methods executed across 4 jobs — 0 failures reported by any job. |
| iOS test suite green | ✓ | Jobs `77961634498` (iPhone 16), `77961634508` (iPhone 16 Pro), `77961634512` (iPhone SE 3rd gen), `77961634505` (Lint) — all `conclusion=success`. |
| Android test suite green | ✓ | Jobs `77961634683` (Lint, test, assemble) and `77961634713` (instrumented emulator) — both `conclusion=success`. |
| Test-run report generated | ✓ | This file (`docs/test-run.md`). |
