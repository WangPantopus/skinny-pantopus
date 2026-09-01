# Final iOS verification — persistent login

Status: DONE (2026-08-20)

Role: final verification of the iOS layer only (`frontend/apps/ios`). No feature work unless
something fails *because of* this feature.

## On-disk state at start of this run
- `git status --short -- frontend/apps/ios` → **empty**. `git diff --stat -- frontend/apps/ios` → empty.
  `git ls-files --others --exclude-standard frontend/apps/ios` → empty.
  The whole iOS layer is already committed (`e6640b9d feat(ios): reinstall recovery, device-bound refresh, devices & security`).
- Uncommitted work elsewhere in the repo (other agents, not mine): backend/.env.example,
  backend/config/authPolicy.js, backend/routes/users.js, backend/services/authDeviceService.js,
  backend/services/authSessionService.js, backend/tests/authDeviceService.test.js,
  backend/tests/authUsersHooks.test.js, docs/persistent-login/WORKLOG.md,
  docs/persistent-login/reports/security-review.md.
- Prior stage reports read: `ios-1-core.md` (DONE), `ios-2-ui.md`, `ios-3-verify.md` (DONE —
  3550 unit tests / 0 failures, swiftformat clean, swiftlint --strict clean except 6 pre-existing
  `force_unwrapping` in untouched `#Preview` blocks; `make test` UI target red for pre-existing reasons;
  `verify-tokens.sh` red repo-wide for pre-existing reasons).

## Plan
1. `make bootstrap` — confirm xcodegen regeneration is stable (entitlements/Info.plist idempotent).
2. `make build`.
3. `make test` (full, incl. PantopusUITests) + the CI-shaped unit-only run
   (`-skip-testing:PantopusUITests`) for the gating number.
4. `make lint` (= verify-icons + verify-tokens + swiftlint), `swiftlint lint --strict`,
   `swiftformat --lint .`.
5. Triage every failure: feature-caused → fix and re-run; pre-existing → prove no overlap with the
   feature's files and report.

## Commands run
- (appended live below)

## Progress log (final verification run, 2026-08-20)

### Toolchain
| Tool | Local | CI pin (`.github/workflows/ios-ci.yml`) |
|---|---|---|
| Xcode | 26.6 (17F113) | 16.4 (`xcode-select -switch /Applications/Xcode_16.4.app`) |
| SwiftLint | 0.63.2 | **0.63.3** |
| SwiftFormat | 0.61.1 | 0.61.1 (match) |
| XcodeGen | 2.45.4 | brew (unpinned) |

### 1. `make bootstrap` → OK
`Config/Secrets.xcconfig` written empty (no `.env` locally — expected), `xcodegen generate` succeeded.
`Pantopus/Resources/Pantopus.entitlements` and `Info.plist` MD5s unchanged before/after
(`ff2975b0…`, `8507e5b9…`) and `git status -- frontend/apps/ios` stayed empty → regeneration is
idempotent, `project.yml` does not fight the committed plists.

### 2. `swiftformat --lint .` → **PASS** — `0/1582 files require formatting, 14 files skipped`.

### 3. `swiftlint lint --strict` → 6 errors, ALL pre-existing, ZERO overlap with the feature
All 6 are `force_unwrapping` on `URL(string: "…")!` inside `#Preview` blocks:
`BookletPageSwiper.swift:276,277,278`, `CertifiedTermsSheet.swift:169`, `MediaViewerView.swift:154,159`.
- Feature-touched iOS files = `git diff --name-only master...HEAD -- frontend/apps/ios` → 53 files;
  set intersection with the 3 offending files = **empty**. Last commits to those files are
  `32c11860` (2026-06-13) and `d9cdf4d6` (2026-06-12), both long before this branch.
- These are a **local-toolchain artifact**: `ios-ci.yml:36-38` documents it verbatim — "0.63.2 flags
  `URL(string:)!` force-unwraps while 0.63.3 does not" — which is why CI pins 0.63.3 from the GitHub
  release binary. Local brew has 0.63.2. CI's `swiftlint lint --strict` step is therefore green.
  (I did not download the pinned 0.63.3 binary — downloading files needs the user's go-ahead.)

### 4. `make build` → **BUILD SUCCEEDED** (exit 0)
Full log: 4667 lines, no `error:`. Simulator destination = first available iPhone
(`iPhone 16 Pro`, id 2A55DFB7-…) as the Makefile picks it.

### 5. Backend route line-number refs in iOS doc comments — DRIFTED AGAIN (non-functional)
`authDevices.js:*` refs are all still **exact** (that file has not been touched since the re-sync):
211 `/challenge`, 226 `/devices/register`, 258 `GET /devices`, 271 `DELETE /devices/:id`,
295 `/sessions/revoke-others`, 313 `/sessions/revoke-all`, 373 `/step-up`, 455 `/step-up-key`,
475 `GET /security-prefs`, 485 `PATCH /security-prefs`, 507 `/security-events`.
`users.js:*` refs have drifted because the backend agents kept editing `backend/routes/users.js`
in the working tree AFTER the stage-3 re-sync (that file is uncommitted-modified right now):
| Route | ref in iOS comments | current line in `backend/routes/users.js` |
|---|---|---|
| `POST /login` | 1639 | **1665** |
| `POST /reauthenticate` | 1772 | **1834** |
| `POST /password` | 1962 | **1981** |
| `POST /refresh` | 2102 | **2177** |
| `POST /oauth/token` | 4186 | **4184** |
| `POST /oauth/callback` | 4274 | **4313** |
| `POST /oauth/native` | 4394 | **4401** |
| `DELETE /account` | 4394 | **4521** |
| `POST /logout` | 4708 | (moved, see below) |
Deliberately NOT re-synced in this pass: the backend working tree is still dirty/being edited, so
any number written now goes stale again on the next backend edit; stale `users.js:NNNN` refs are the
repo's pre-existing norm (e.g. untouched `AccountDeleteSheet.swift:6` → `users.js:3945`, stale by
~576 lines, and the whole `Features/Profile/*` set). Nothing compiles or runs off these comments.

### 6. `make lint` components
- `verify-icons.sh` → **PASS** ("no raw SF Symbol usage in feature code").
- CI's raw-hex grep over `Pantopus/Features` → **PASS** (no matches).
- `verify-tokens.sh` → **FAIL (exit 1)**, pre-existing and repo-wide: **505 violations across 91 files**
  (raw `Color(red:green:blue:)` literals and `.font(.system(size:))` calls). Intersection of those 91
  files with the 53 feature files (`comm -12`) = **empty**. `make lint` therefore cannot go green today
  for reasons unrelated to this feature, and CI does not run it — `ios-ci.yml`'s lint job is
  `swiftlint lint --strict` + `swiftformat --lint .` + the raw-hex grep, all of which pass
  (modulo the local 0.63.2 SwiftLint artifact above).
- `swiftlint lint` (non-strict, as `make lint` invokes it) → same 6 `force_unwrapping` items, which are
  *errors* under this rule config, so `make lint`'s swiftlint step is red locally too and green on CI's 0.63.3.

### 7. `xcodebuild … build-for-testing` → **TEST BUILD SUCCEEDED** (exit 0)
Test target compiles clean against the current tree.

### 8. Unit suite (CI's gating shape, `-skip-testing:PantopusUITests test-without-building`) → running

### 9. Independent spot-checks done while the suite ran (no edits needed)
- **Security invariants (iOS side)** —
  `DeviceKey` (DPoP) is created with **no `SecAccessControl` at all** → never biometry-gated, so
  background refresh / push fetch / socket reconnect keep working (`DeviceKey.create`, SE key via
  `SecureEnclave.P256.Signing.PrivateKey()`, software P-256 fallback when no enclave).
  `StepUpKey` **is** gated: `.privateKeyUsage | .biometryCurrentSet` (falling back to
  `.privateKeyUsage | .userPresence` only when biometrics are not enrolled), protection class
  `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
- **Key minting sites** — `DeviceIdentity.regenerate` / `DeviceKey.create` are reachable from exactly
  one place, `AuthManager.ensureDeviceIdentity()`, whose only callers are `makeDeviceDescriptor()`
  (used by `/login` + the OAuth routes, i.e. credential issuance) and the refresh/resume paths
  (`AuthManager+Session.swift:263,303`) — the latter is required by CONTRACT's legacy-adoption rule
  (an upgrading legacy client must present a proof at `/refresh`). Nothing on a bearer-only path
  creates or rotates a *server* binding; `/api/auth/devices/register` is metadata-only.
- **Conformance stage-D fix is in HEAD** — `AuthEndpoints.stepUp` carries `verifiesCredential: true`
  and **no** `requiresDPoP`; only `registerDevice`, `enrolStepUpKey` and the credential-issuing routes
  (`login`/`oauth*`, conditional on `device != nil`) are DPoP-flagged.
- **Accessibility-identifier parity iOS ↔ Android** re-checked against the current Android tree:
  every shared identifier matches byte-for-byte (`auth.continueAs.*` 12/12, `login*` 14/14,
  `settings.devices.*` incl. the interpolated `device.<id>` / `session.<id>` / `event.<id>` forms).
  Remaining divergences are the ones stage 3 documented as by-design (iOS-only
  `differentAccountHost`, `loginRememberedAccountName/Email`, `devices.prefs.unavailable`,
  `devices.{loading,empty,emptyList,list,error,topBar}`; Android-only `devices.thisDevice.unbound`,
  `devices.otherDevices.empty`, `devices.confirm`, `loginScreen`, `loginErrorMessage`).
- **Persistent-login test inventory (static count of `func test…`): 183 methods across 15 classes** —
  AuthManagerTests 21 · AuthManagerRefreshTests 20 · AuthManagerResumeTests 19 · AuthStepUpTests 12 ·
  DPoPProofBuilderTests 9 · DeviceKeyTests 8 · InstallMarkerTests 10 · AccountHintTests 7 ·
  AppLockPreferenceTests 5 · SocketClientAuthErrorTests 6 · ContinueAsViewModelTests 12 ·
  DevicesViewModelTests 19 · PrivacyViewModelTests 26 · SettingsViewModelTests 2 · LoginViewModelTests 7.

### 8 (result). Unit suite, CI's gating shape → **GREEN**
```
xcodebuild -project Pantopus.xcodeproj -scheme Pantopus \
  -destination "platform=iOS Simulator,id=<iPhone 16 Pro>,OS=18.5" -configuration Debug \
  -enableCodeCoverage YES -skip-testing:PantopusUITests test-without-building
```
→ `Test Suite 'All tests' passed` — **Executed 3551 tests, with 168 tests skipped and 0 failures
(0 unexpected) in 34.4 s**; `** TEST EXECUTE SUCCEEDED **`, exit 0.
- The 168 skips are pre-existing Paparazzi-style snapshot *baseline-presence* tests that
  `XCTSkip` with "Baseline pending follow-up commit" (e.g. `AddBillWizardSnapshotTests`); nothing
  in this feature is skipped.
- All 15 persistent-login suites report `passed`: AuthManagerTests, AuthManagerRefreshTests,
  AuthManagerResumeTests, AuthStepUpTests, DPoPProofBuilderTests, DeviceKeyTests, InstallMarkerTests,
  AccountHintTests, AppLockPreferenceTests, SocketClientAuthErrorTests, ContinueAsViewModelTests,
  DevicesViewModelTests, PrivacyViewModelTests, SettingsViewModelTests, LoginViewModelTests.
- Test count vs stage 3: 3550 → **3551** (+1) — no regression, one test added since that report.

### 10. `make test` (full scheme, includes `PantopusUITests`) → running

### 11. Compiler warnings — **no new ones from this feature**
The `make build` log has 219 warning emissions / 60 distinct warning sites. Exactly two fall in a
file this feature touched, and `git blame` puts both on lines that predate the branch:
- `Core/Security/AppSecurity.swift:494` `use of protocol 'NSObjectProtocol' as a type…`
  → `76db2882d` (2026-08-05), `CapturePrivacyManager.observer`.
- `Features/Settings/SettingsView.swift:107` `backward matching of the unlabeled trailing closure…`
  → `c4943a428` (2026-05-29), the `AudienceProfileView` call.
None of the 51 new/changed Swift files emits a warning.

### 12. Toolchain-risk scan (local Xcode 26.6 / Swift 6.3.3 vs CI Xcode 16.4 / Swift 6.1)
`project.yml` pins `SWIFT_VERSION: "5.10"` + `SWIFT_STRICT_CONCURRENCY: complete`, deployment target
iOS 17.0. Grepped all 51 feature Swift files for constructs that would compile here but not on CI's
older frontend/SDK — `@available(iOS 19/2x…)`, `if #available`, `nonisolated(nonsending)`,
`InlineArray`, `~Copyable`, `@retroactive`, swift-testing (`import Testing` / `@Test` / `#expect`):
**zero hits**. The feature is plain Swift 5.10-mode code (`if`/`switch` expressions are 5.9+),
CryptoKit `SecureEnclave`, `LocalAuthentication`, `@Observable`, XCTest. No `TODO`/`FIXME`/`HACK`
left anywhere in the feature files.

### 13. `frontend/apps/ios/CLAUDE.md` convention audit of the new surfaces
- **MVVM / `@Observable`** — `DevicesViewModel` and `ContinueAsViewModel` are
  `@Observable @MainActor public final class` with `public private(set) var state` over a `Sendable`
  enum; views are `public struct …View` with `@State private var viewModel`, loading kicked from
  `.task`. ✅
- **Four-state rule** — `DevicesView.content` switches `.loading → skeleton` (hand-rolled `Shimmer`
  rows mirroring the loaded geometry, **not** a screen-level `ProgressView`), `.error → ErrorState`
  with a retry closure wired to `viewModel.load()`, `.empty → EmptyState`, `.loaded → list`, and the
  body carries `.offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)`. The only two
  `ProgressView`s are row-level inline spinners (`isLoading` on a nav row, `isRevoking` on a device
  row), which the rule permits. ✅
- **Tokens** — `Theme.Color.*`, `Spacing.s*`, `Radii.*`, `pantopusTextStyle(...)`, `Icon(.case,…)`;
  `verify-icons` and the CI hex grep both pass, and none of the 91 `verify-tokens` offenders is a
  feature file. ✅
- **Endpoints** — every helper in `AuthEndpoints.swift` carries the required
  `backend/routes/<file>:<line>` doc-comment (line numbers for `users.js` have drifted, see §5). ✅
- **DTOs** — one file per feature (`Models/Auth/AuthDeviceDTOs.swift`), `public struct … Decodable,
  Sendable, Hashable`, explicit `CodingKeys` where names differ. ✅
- **Tests** — `PantopusTests/Features/<Feature>/…Tests.swift`, `@MainActor final class … XCTestCase`,
  `SequencedURLProtocol`-driven `APIClient`. ✅

### 10 (result). `make test` (full scheme, unit + `PantopusUITests`) → **TEST FAILED, exit 2**
Two targets in one run:
| Target | Result |
|---|---|
| `PantopusTests` (unit + snapshot) | **passed — Executed 3551 tests, 168 skipped, 0 failures** |
| `PantopusUITests` | **failed — Executed 54 tests, 48 skipped, 6 failures** |

**All 6 UI failures are pre-existing and provably unrelated to this feature:**
1-3. `NavigationSmokeTest.testHub_bellTapPushesNotifications` / `…_pillarMailTapPushesMailboxRoot` /
   `…_pillarPulseTapPushesFeed` — `Failed to tap "tab.hub" Button: No matches found`. The app's tab
   ids are `home, pulse, tasks, marketplace, messages` (`Features/Root/RootTabView.swift:15`) and the
   identifier is built as `tab.\(tab.id)`, so `tab.hub` matches nothing. Tab-set drift that predates
   the branch.
4-6. `PantopusUITests.testLaunchLandsOnLogin` / `…SignInButtonDisabledWithEmptyFields` /
   `…SignInButtonEnablesOnceFormIsValid` — they launch with `UI_TESTS_SIGNED_OUT=1` and expect
   `loginEmailField` on screen. **`UI_TESTS_SIGNED_OUT` is not read anywhere in the app** (only
   `UI_TESTS_STUB_API` / `UI_TESTS_PROFILE_*` / `UI_TESTS_HOMES_*` exist), and the `.signedOut` front
   door is `PlaceLaunchHost()`, not `LoginView`.

**Proof these are not this feature's doing:**
- `git diff --name-only master...HEAD -- frontend/apps/ios/PantopusUITests` → **empty**: the branch
  touches no UI-test file.
- In `git diff master...HEAD -- Pantopus/App/PantopusApp.swift`, `case .signedOut: PlaceLaunchHost()`
  appears as an unchanged **context** line; the branch only *adds* `case let .resumable(hint):
  ContinueAsView(…)` beneath it, plus `refreshIfExpiringSoon()` on `.active` and
  `installStepUpPrompt()`. On a fresh simulator install there are no stored tokens, so launch resolves
  to `.signedOut` exactly as before.
- CI never runs this target (`-skip-testing:PantopusUITests`, with the rationale documented at
  `ios-ci.yml:189-201`) — it is only compiled.

### 14. `make lint` (the literal target) → **FAILS at `verify-tokens`, exit 2**
`verify-icons` passes, then `verify-tokens` exits 1 (`make: *** [verify-tokens] Error 1`) and the
target never reaches its `swiftlint` step. Pre-existing, repo-wide, zero feature overlap (§6).

### 15. Route-ref drift — exact correction table (for whoever lands the backend)
Reconstructed mechanically by diffing the refs against **both** `git show HEAD:backend/routes/users.js`
and the current working tree. The refs were already ~12-35 lines stale **at commit time** (the backend
moved between the stage-3 re-sync and backend commit `5bdcee1a`), and are now 50-130 lines stale.
`authDevices.js` refs are exact and need no change.

| What the iOS comment names | ref in comment | line in `HEAD` | line in working tree |
|---|---|---|---|
| `registerSchema` | 803 | 815 | **865** |
| `loginSchema` (cited on `LoginResponse`) | 829 | 841 | **891** |
| `updatePasswordSchema` | 847 | 859 | **909** |
| `verifyEmailSchema` (cited `866-871`) | 866 | 878 | **928** |
| `POST /register` | 1288 | 1301 | **1351** |
| `POST /login` | 1603 | 1615 | **1665** |
| `POST /reauthenticate` | 1772 | 1784 | **1834** |
| `GET /auth-methods` | 1887 | 1899 | **1949** |
| `POST /password` | 1919 | 1931 | **1981** |
| `POST /refresh` | 2102 | 2127 | **2177** |
| `POST /resend-verification` | 3322 | 3357 | **3407** |
| `POST /verify-email` | 3388 | 3423 | **3473** |
| `POST /forgot-password` | 3470 | 3505 | **3555** |
| `POST /reset-password` | 3520 | 3555 | **3605** |
| `GET /oauth/:provider` | 4006 | 4041 | **4107** |
| `POST /oauth/token` | 4083 | 4118 | **4184** |
| `POST /oauth/callback` | 4186 | 4221 | **4313** |
| `POST /oauth/native` | 4274 | 4309 | **4401** |
| `DELETE /account` | 4394 | 4429 | **4521** |
| `POST /logout` | 4708 | 4744 | **4836** |
(Plus a handful of intra-handler refs — 1526, 1548, 1639, 1739, 1962, 3454, 4408/4422/4436 — with the
same drift.) Files carrying them: `Core/Networking/Endpoints/{AuthEndpoints,SettingsEndpoints}.swift`,
`Core/Networking/Models/{Auth/AuthDTOs,Settings/SettingsDTOs}.swift`,
`Core/Auth/{AuthManager,AuthManager+Devices,AuthManager+Session,AuthManager+OAuth}.swift`,
`Features/Auth/LoginView.swift`, `Features/Settings/{SettingsViewModels,Privacy/PrivacyViewModel}.swift`,
`PantopusTests/AuthManagerTests.swift`. Re-check with
`grep -rn "users\.js:\|authDevices\.js:" frontend/apps/ios/Pantopus`.

**Deliberately not applied in this pass** — the backend working tree is still uncommitted and being
edited, so numbers written now would go stale on the next backend edit (exactly what happened to the
stage-3 re-sync); nothing compiles, runs or is tested off these comments; and stale `users.js:NNNN`
refs are already the repo's pre-existing norm in files this feature never touched. Apply after the
backend commits, then re-run `make build`.

---

## FINAL STATE

Status: DONE — the iOS layer is verified green. **No code changes were needed or made**;
`git status --short -- frontend/apps/ios` is still empty.

| Command (run in `frontend/apps/ios`) | Result |
|---|---|
| `make bootstrap` | ✅ OK — xcodegen regeneration idempotent (`Info.plist` + `Pantopus.entitlements` MD5-identical, git stayed clean) |
| `make build` | ✅ **BUILD SUCCEEDED** (exit 0) |
| `xcodebuild … build-for-testing` | ✅ **TEST BUILD SUCCEEDED** (exit 0) |
| `xcodebuild … -skip-testing:PantopusUITests test-without-building` (CI's gate) | ✅ **3551 tests, 168 skipped, 0 failures**, `TEST EXECUTE SUCCEEDED` |
| `make test` (adds `PantopusUITests`) | ❌ **TEST FAILED, exit 2** — unit target 3551/0 failures; UI target **54 tests, 48 skipped, 6 failures**, all pre-existing (3 × `tab.hub` no longer exists, 3 × login-at-launch tests using the dead `UI_TESTS_SIGNED_OUT` env var against the `PlaceLaunchHost` front door). Branch touches no UI-test file; CI skips this target. |
| `make lint` | ❌ **exit 2** at `verify-tokens` (505 violations / 91 files, pre-existing, zero feature overlap); `verify-icons` ✅ |
| `swiftlint lint --strict` | ⚠️ 6 `force_unwrapping` errors, all pre-existing `#Preview` `URL(string:)!` in untouched files; a **local SwiftLint 0.63.2 artifact** — CI pins 0.63.3, which does not flag them (`ios-ci.yml:36-38`) |
| `swiftformat --lint .` | ✅ **0/1582 files require formatting** |
| CI raw-hex grep over `Pantopus/Features` | ✅ PASS |

**Feature health:** 15 persistent-login test suites, 183 `func test…` methods, all passing.
Zero new compiler warnings. Zero `TODO`/`FIXME`. Conventions in `frontend/apps/ios/CLAUDE.md`
(MVVM/`@Observable`, four-state rule, tokens, endpoint doc-comments, DTO/test layout) all satisfied.
Accessibility identifiers still byte-identical to the Android tags.

**Remaining issues (none block CI, none caused by this feature):**
1. `users.js:NNNN` doc-comment drift — §15 has the ready-to-apply table.
2. `make lint` cannot be a gate until `verify-tokens.sh`'s 505 repo-wide violations are cleaned up.
3. Local SwiftLint is 0.63.2; install the CI-pinned 0.63.3 to make `swiftlint --strict` green locally.
4. `PantopusUITests` is red for pre-existing reasons (`tab.hub`, dead `UI_TESTS_SIGNED_OUT`);
   fixing it is separate, unrelated work.
5. The layer has only ever been compiled with local Xcode 26.6 / Swift 6.3.3; CI builds with
   Xcode 16.4 / Swift 6.1. Language mode is pinned (`SWIFT_VERSION 5.10`) and the scan in §12 found
   no newer-toolchain-only construct, so the risk is low but only CI can close it.
