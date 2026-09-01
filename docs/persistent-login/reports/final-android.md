# Final Android verification — CI quality job

Status: DONE (2026-08-20) — CI quality job green end to end, one parity fix applied

Scope: run, in `/Users/yingpengwang/native/pantopus/frontend/apps/android`, exactly what
`.github/workflows/android-ci.yml` job `quality` runs:

1. grep gate "No raw hex in feature code" over `app/src/main/java/app/pantopus/android/ui/screens`
2. `./gradlew ktlintCheck detekt :app:lintDebug test paparazziVerify :app:assembleDebug --no-daemon`

Fix anything that fails **because of this feature**; re-run; report exact results.

## On-disk state before any edit
- `git status --short -- frontend/apps/android` → **clean** (no modified, no untracked).
  The Android layer is fully committed as `a4bf493c feat(android): Block Store reinstall recovery,
  device binding, devices screen` (65 files, +8504/-272 vs master).
- Uncommitted work exists only in `backend/` and `docs/` (other agents, concurrent) — irrelevant to
  the Android build.
- Prior report `reports/android-3-verify.md` claims a green run of the same job on 2026-08-19
  (BUILD SUCCESSFUL in 30m47s, 3476 tests). This stage re-verifies from a cold-ish tree.

## Progress log
- (pending)
- CI gate 1 "No raw hex in feature code": `grep -rnE '#[0-9a-fA-F]{6,8}' app/src/main/java/app/pantopus/android/ui/screens`
  → **PASS** (no matches).
- Confirmed the conformance-stage Android fixes are on disk and committed:
  `SocketManager.EVENT_SESSION_REVOKED` + `sessionRevoked: SharedFlow`, `RootViewModel` collecting it into
  `AuthRepository.confirmSessionRevoked()`, and the 5 `*_email_sent` security-event labels in `DevicesViewModel`.
- STARTED run 1 of the CI quality job (background):
  `JAVA_HOME=zulu-17 ANDROID_HOME=~/Library/Android/sdk ./gradlew ktlintCheck detekt :app:lintDebug test paparazziVerify :app:assembleDebug --no-daemon --continue`
  (`--continue` added so a single run surfaces every failure; a fully green `--continue` run implies the
  CI command without it is green too — same task set, same order.)
  Log: `<scratchpad>/ci-run-1.log`.

## Independent spot-review done while the job ran (read-only)
- `AuthInterceptor` — bearer + pre-flight refresh at <120 s, exempts `/api/users/refresh`, never signs out
  itself (401 path owns that decision). OK.
- `StepUpInterceptor` — 403 only, skips requests that already carry `X-Step-Up`, skips bearer-less and
  one-shot bodies, `peekBody(8 KiB)`, retries exactly once. OK.
- `AuthRepository.issuanceProof()` is the only `getOrCreate` + descriptor pair on the four credential-issuing
  paths (`/login`, `/oauth/callback`, `/oauth/token`, `/oauth/native`); `registerDevice()` uses
  `deviceKeyStore.existing()` and therefore can never create a binding. `performRefresh` calls `getOrCreate`
  only to *sign* — a regenerated key just fails server verification (`DEVICE_MISMATCH`) and lands on the
  security-sign-out path, it does not mint a binding. Invariant holds.
- `restore()` L1 → `restoreFromHints()` L2/L3: `Resumable` only when a grant exists AND
  `presenceVerifier.canVerify()`; otherwise `SignedOut` with hints prefilled. 403/5xx/offline never wipe.
- `enrolStepUpKey()` requires `sessionContext == interactive` + BIOMETRIC_STRONG; `canStepUpWithDeviceKey()`
  additionally pins the enrolment to the current userId.
- `backup_rules.xml` / `data_extraction_rules.xml` exclude `device_identity.xml` from **both** cloud-backup
  and device-transfer. OK.
- Test-tag parity vs iOS re-checked file by file: `auth.continueAs.*` and `settings.devices.*` now match iOS
  one for one, and `loginSessionEndBanner` / `loginRememberedAccount*` match. **One gap left**: the step-up
  sheet — iOS uses `auth.stepUp.{passwordSheet,cancel,confirm}`, Android `stepUp.{passwordSheet,cancel,verify}`
  (`core/security/StepUpHost.kt:41-48`). `android-3-verify.md` deferred it as a two-layer edit; iOS has since
  settled on the `auth.`-prefixed form, so it is now a one-layer Android edit. `StepUpTags` is referenced only
  inside `StepUpHost.kt` (no test or instrumented reference), so the rename is zero-risk.
- Checked the concurrently-uncommitted backend hardening for Android wire impact (read-only):
  `authPolicy.js` (PUBLIC_API_BASE_URL warning), `users.js` (`/reset-password` limiter + recovery-token
  check, `/oauth/token` now passes `credential:false` and answers 401 `DEVICE_MISMATCH` on `rebindRefused`).
  **No Android change needed** — Android already sends `device` + DPoP on `/oauth/token` (a fresh GoTrue pair
  ⇒ a brand-new session, which that route may still bind), and `DEVICE_MISMATCH` is already in
  `AuthErrorCodes.SECURITY_SIGN_OUT`.

## Run 1 results (in order the tasks landed)
- `ktlintCheck` (root + `:app` main/test/androidTest/kts source sets) → **UP-TO-DATE / PASS**
- `detekt` (`:detekt` NO-SOURCE, `:app:detekt`) → **UP-TO-DATE / PASS**
- `:app:lintDebug` (lintAnalyzeDebug + …AndroidTest + …UnitTest + lintReportDebug) → **PASS**, 0 errors
- `test` → `:app:testDebugUnitTest` **365 classes / 3477 tests / 0 failures / 0 errors / 61 skipped**
- `test` → `:app:testReleaseUnitTest` **365 classes / 3477 tests / 0 failures / 0 errors / 61 skipped**
  (no retried flakes this time — the `test-retry` plugin recorded none)
- `paparazziVerify` → `:app:verifyPaparazziDebug` **PASS**, no snapshot drift
- `:app:assembleDebug` → **PASS**, `app/build/outputs/apk/debug/app-debug.apk`

```
BUILD SUCCESSFUL in 12m 44s
116 actionable tasks: 34 executed, 25 from cache, 57 up-to-date
EXIT=0
```
Report artefacts: `app/build/reports/detekt/detekt.txt` **0 issues**;
`app/build/reports/lint-results-debug.xml` **0 errors** (204 Warning + 12 Information, all pre-existing).

## Fix applied by this stage
- `app/src/main/java/app/pantopus/android/core/security/StepUpHost.kt` — closed the last open parity item from
  `android-3-verify.md`. `StepUpTags` values `stepUp.*` → `auth.stepUp.*` and `VERIFY` → `CONFIRM`
  (`auth.stepUp.confirm`), matching iOS `Features/Auth/StepUpPasswordPrompt.swift`
  (`auth.stepUp.{passwordSheet,passwordField,cancel,confirm}`) and the `auth.continueAs.*` prefix family;
  the primary button's label is now "Confirm" (iOS wording) instead of "Verify".
  Safe: `StepUpTags` is referenced only inside this file, no unit/instrumented test and no Paparazzi
  snapshot touches the sheet. `android-3-verify.md` deferred this as a two-layer edit; iOS had already
  settled on the `auth.`-prefixed form, so Android was the only side that had to move.
  All other tag families were re-checked and already match iOS one for one
  (`auth.continueAs.*`, `settings.devices.*`, `loginSessionEndBanner`, `loginRememberedAccount*`).
- STARTED run 2 of the full CI quality job over the fixed tree. Log: `<scratchpad>/ci-run-2.log`.

## Run 2 results (fixed tree) — GREEN, this is the authoritative result

Command (in `frontend/apps/android`, `JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home`,
`ANDROID_HOME=~/Library/Android/sdk`):

```
./gradlew ktlintCheck detekt :app:lintDebug test paparazziVerify :app:assembleDebug --no-daemon --continue
→ BUILD SUCCESSFUL in 11m 2s   (116 actionable tasks: 31 executed, 85 up-to-date)   EXIT=0
```

| CI step (`.github/workflows/android-ci.yml` job `quality`) | Result |
|---|---|
| "No raw hex in feature code" grep gate over `ui/screens` | **PASS** — no matches |
| `ktlintCheck` (root + `:app` main / test / androidTest / kts) | **PASS** |
| `detekt` | **PASS** — `app/build/reports/detekt/detekt.txt` is 0 lines (0 issues) |
| `:app:lintDebug` | **PASS** — 0 errors; 204 Warning + 12 Information, all pre-existing |
| `test` → `:app:testDebugUnitTest` | **365 classes / 3477 tests / 0 failures / 0 errors / 61 skipped** |
| `test` → `:app:testReleaseUnitTest` | **365 classes / 3477 tests / 0 failures / 0 errors / 61 skipped** |
| `paparazziVerify` (`verifyPaparazziDebug`) | **PASS** — no snapshot drift |
| `:app:assembleDebug` | **PASS** — `app/build/outputs/apk/debug/app-debug.apk` (83 MB) |

Neither variant recorded a retry this time (run 1 had none either), so the kotlinx-coroutines
`UncaughtExceptionsBeforeTest` main-dispatcher flake that earlier stages saw in
`WalletViewModelTest` / `WalletPayoutViewModelTest` / `MailboxMapNetworkTest` /
`VerifyEmailLandingViewModelTest` did not reproduce.

Not run here (CI runs it in a separate job, PR/dispatch only, and it needs an emulator):
`instrumented` → `./gradlew connectedDebugAndroidTest`. `app/src/androidTest` has no source for the
debug variant (`runKtlintCheckOverAndroidTestDebugSourceSet` is NO-SOURCE), and this feature added no
instrumented test, so that job's inputs are unchanged by the persistent-login work.

## Files changed by this stage
- `frontend/apps/android/app/src/main/java/app/pantopus/android/core/security/StepUpHost.kt` —
  step-up sheet test tags `stepUp.*` → `auth.stepUp.*`, `VERIFY` → `CONFIRM`, button copy "Verify" → "Confirm"
  (iOS parity). Only file modified; `git status --short -- frontend/apps/android` shows exactly this one entry.

## Remaining issues
- **None blocking.** No failure in the CI quality job was attributable to this feature (run 1 was already
  green before the parity fix; run 2 is green after it).
- Pre-existing, not this feature: 204 lint warnings + 12 informational across the module (unchanged count
  before and after this feature's commit), and the known kotlinx-coroutines test-dispatcher flake that
  `app/build.gradle.kts` documents and `test-retry` (`failOnPassedAfterRetry = false`) absorbs.
- Not verified here (out of scope / needs hardware): the `instrumented` CI job (emulator),
  `DeviceKeyStore` / `StepUpKeyStore` / `AccountHintStore` against a real Keystore + Block Store —
  all three are only exercised through fakes in JVM unit tests. The design already listed the
  GMS-guarded instrumented tests as optional; they remain unwritten.
- Cross-layer, informational: iOS has no `auth.stepUp.title` / `auth.stepUp.error` identifier
  (SwiftUI addresses those two elements by text). Android now exposes them under the matching prefix,
  so adding them on iOS later is a one-line change on that side.

Status: DONE — Android layer is green against the exact CI `quality` job, and the last flagged Android
parity gap is closed.
