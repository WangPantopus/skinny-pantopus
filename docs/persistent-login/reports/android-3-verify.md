# Android stage 3 — green build/tests + self-review

Status: DONE (2026-08-19) — CI quality job green end to end

Layer: /frontend/apps/android only. Stage 1 = android-1-core.md (DONE), stage 2 = android-2-ui.md
(cut off during verification: `:app:compileDebugKotlin` passed, unit tests / ktlint / detekt never run).

## Goal
1. Make the Android CI pipeline green for this feature: `ktlintCheck detekt :app:lintDebug test paparazziVerify :app:assembleDebug`
   (+ the "no raw hex in ui/screens" grep gate from .github/workflows/android-ci.yml).
2. Finish any half-written stage-2 deliverable.
3. Self-review against CONTRACT.md + the security invariants; fix discrepancies.

## Progress log
- Read CONTRACT.md, android-1-core.md, android-2-ui.md, .github/workflows/android-ci.yml.
- On-disk state confirmed: every stage-1 + stage-2 file listed in android-1-core.md / android-2-ui.md exists.
  `:app:compileDebugUnitTestKotlin` → UP-TO-DATE (main + test sources already compile).
- CI gate "No raw hex in feature code" (grep over ui/screens) → PASS (no matches).
- Stage 2 *had* in fact run a scoped unit test at 05:47 (6 classes); its results were still on disk:
  LoginViewModelTest 10/10, PushTokenSyncerTest 5/5, ContinueAsViewModelTest 10/10, PrivacyViewModelTest 23/23,
  SettingsViewModelsTest 5/5, DevicesViewModelTest 17 tests / 1 failing (retried 3x).
- FIXED test/.../ui/screens/settings/security/DevicesViewModelTest.kt — `now - 65 * 86_400_000` overflowed Int
  (5.6e9 wrapped to 1.32e9 ⇒ "2 w ago" instead of "2 mo ago"); the three day-multiples are now `3L/15L/65L * 86_400_000`.
- RUN full `./gradlew :app:testDebugUnitTest` (pre-fix tree): 364 classes / 3478 tests, 61 skipped.
  Feature failure: DevicesViewModelTest.relative_time_and_labels (the Int overflow, fixed).
  3 pre-existing flakes (`UncaughtExceptionsBeforeTest`, kotlinx-coroutines main-dispatcher race) in
  WalletViewModelTest / WalletPayoutViewModelTest / MailboxMapNetworkTest — all passed on retry (the
  build has `test-retry` with `failOnPassedAfterRetry=false`); not related to this feature.
- RUN `./gradlew ktlintCheck detekt --continue` → FAILED (3 tasks). Fixed all of it:
  - ktlint main: AccountDeletionRepository.kt (function-signature), AuthAutofill.kt (blank-line-before-declaration).
  - ktlint test: LoginViewModelTest.kt:159, DevicesViewModelTest.kt:82/101/332 (max line length + argument wrapping).
  - detekt: `@file:Suppress("MatchingDeclarationName")` on StepUpHost.kt / AuthAutofill.kt / ContinueAsScreen.kt
    (repo convention for `<Screen>.kt` + `<Screen>Tags` object); StepUpCoordinator.askPassword split into
    `Attempt` + `submitPassword` (NestedBlockDepth); DevicesViewModel.groups() split into
    thisDeviceGroup/otherDevicesGroup/webSessionsGroup/actionsGroup/activityGroup (LongMethod);
    browserLabel + eventLabel are now table-driven (BROWSER_MARKERS / OS_MARKERS / EVENT_LABELS)
    instead of long `when` chains (CyclomaticComplexMethod); runGuarded's generic catch now logs via Timber
    (SwallowedException).
- CHANGED ui/screens/RootViewModel.kt — `onAppStart()` now signs out (with the backend reason, so the banner
  shows) when the ON_START proactive refresh returns `AuthRejected`. Previously the outcome was discarded while
  the doc-comment claimed the repository handled it — it does not; only `restore()` did.
- NEW test/.../ui/screens/RootViewModelTest.kt — 3 tests over that hook (signed-out no-op, AuthRejected → signOut
  with the same reason, Rotated/Transient/null → session kept).
- RUN `./gradlew ktlintCheck detekt :app:compileDebugUnitTestKotlin --continue` → **BUILD SUCCESSFUL** (exit 0)
  after the fixes above.
- RUN (in flight) the full CI quality job:
  `./gradlew ktlintCheck detekt :app:lintDebug test paparazziVerify :app:assembleDebug`.
- RUN full CI job (1st attempt) → `:app:lintDebug` FAILED: 4 `NewApi` errors, 204 (pre-existing) warnings.
  FIXED data/auth/DeviceKeyStore.kt + data/auth/StepUpKeyStore.kt — dropped the explicit
  `catch (e: StrongBoxUnavailableException)` (that class is API 28, minSdk is 26, so lint rejects the
  catch type and the bytecode would be unresolvable on 26/27). `StrongBoxUnavailableException` extends
  `java.security.ProviderException`, which the very next catch already handles, so StrongBox fallback
  behaviour is unchanged. Imports removed.
- CHANGED core/security/StepUpCoordinator.kt — `requestStepUpToken` (the 403-interceptor entry point, called
  under `runBlocking` on an OkHttp dispatcher thread) now takes a single-permit `AtomicBoolean` slot in
  addition to the `inFlight` re-entrancy guard. Without it a burst of concurrent 403s could park every
  per-host OkHttp slot (5 by default) and starve the `/api/auth/step-up` call, which rides the same client.
  Losers get their 403 back untouched — the in-app call sites all pre-fetch their token anyway.

## Self-review against CONTRACT.md (Android side) — result: conformant

| CONTRACT item | Where | Verdict |
|---|---|---|
| `X-Client-Platform` + `X-Device-Id` on every request, both clients | `data/auth/DeviceIdentityInterceptor.kt`, `di/NetworkModule.kt` (main + `@Named("authRefresh")`) | OK |
| `DPoP` header: `dpop+jwt` / ES256 / embedded `{kty,crv,x,y}` b64url-unpadded | `DPoPProofBuilder.build`, `EcKeyCodec.jwkFor` | OK |
| payload `{jti,htm,htu,iat}` + `rth` on `/refresh` and `/logout` | `DPoPProofBuilder`, `AuthRepository.performRefresh` / `revokeOnServer` | OK |
| `htu` = `<scheme>://<host>[:port]<path>`, no query/fragment, default port elided | `DPoPProofBuilder.htu` (+ 4 test cases) | OK |
| `iat` unix **seconds**, fresh `jti` per proof | `DPoPProofBuilder` (Moshi writes the Long as a JSON integer) | OK |
| signature = raw `r||s` (64 B) base64url | `EcKeyCodec.derToRaw` + `base64Url` | OK |
| `device` descriptor fields incl. `installId` hex32, `hasOsLock`, `keyBacking`, `attestation:null` | `DeviceDescriptorProvider`, `DeviceIdentity`, `KeystoreBacking` | OK |
| `X-Step-Up` header name + purposes | `StepUpInterceptor.HEADER_STEP_UP`, `StepUpCoordinator.PURPOSE_*` | OK |
| 401 code set treated as *security sign-out* | `AuthErrorCodes.SECURITY_SIGN_OUT` = exactly the 6 CONTRACT codes | OK |
| 403 `STEP_UP_REQUIRED` → step-up → retry **once** | `StepUpInterceptor` (skips requests that already carry `X-Step-Up`, skips one-shot bodies, `peekBody`) | OK |
| `/refresh` body `{refreshToken, deviceId?, sessionId?}` | `RefreshRequest` + `performRefresh` | OK |
| `/logout` local: `{scope:"local", deviceId, refreshToken}` + Bearer + DPoP(`rth`) | `AuthRepository.revokeOnServer` | OK |
| `/auth/resume` `{grant, device}` + **required** DPoP, unauthenticated client | `AuthApi.resume` (non-null `dpop`), called on `refreshApi` | OK |
| `/auth/devices/register` Bearer + DPoP, never creates a binding | `registerDevice()` uses `deviceKeyStore.existing()` (never `getOrCreate`) | OK |
| Block Store key `pantopus.account_hint`, JSON `{v:1,accounts[≤3],resumeGrant?,grantUserId?,issuedAt}`, `setShouldBackupToCloud(false)` | `AccountHintStore.kt` (+ a test asserting the JSON shape) | OK |
| `TokenStorage` adds `expires_at` / `session_id` / `session_context` | `TokenStorage.kt` | OK |
| `device_identity` prefs excluded from backup + D2D | `res/xml/backup_rules.xml`, `res/xml/data_extraction_rules.xml` (also `app_lock_prefs_secure.xml`) | OK |
| Proactive refresh at `expiresAt - now < 120 s`, never on `/refresh`, single-flight | `refreshIfExpiringSoon` (120 s), `AuthInterceptor` (path guard), `refreshMutex` | OK |
| Cold start L1 → L2 → L3; reinstall always a gesture, never silent, never a wipe | `restore()` → `restoreFromHints()` → `State.Resumable` → `resume()` behind `PresenceVerifier` | OK |
| L2 gate `BiometricPrompt(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)`; no OS lock ⇒ L3 | `BiometricPresenceVerifier` | OK |
| Explicit sign-out keeps hints, clears the grant; "Not you? Remove" wipes the hint (deleteBytes when none remain) | `signOut()`, `removeRememberedAccount()` | OK |
| Grant-minted sessions are `restored` | `persistLoginResponse(..., interactive = false)` | OK |
| `device_key` step-up only for interactively-enrolled keys **and** interactive sessions | `canStepUpWithDeviceKey()` (+ server enforces) | OK |
| DPoP key never biometry-gated; step-up key biometry-gated per use, invalidated on enrolment change | `DeviceKeyStore.spec` (`setUserAuthenticationRequired(false)`), `StepUpKeyStore.spec` | OK |
| Bindings only at credential issuance | `issuanceProof()` is the only `getOrCreate` + descriptor call on login/oauth/native; `resume` is the other issuance point | OK |

### Cross-layer follow-up for the conformance stage (NOT changed here — one side must not move alone)
Test-tag / accessibility-identifier parity between Android and iOS (per `frontend/apps/android/CLAUDE.md`
"Parity") does not line up on four names. iOS values are from `reports/ios-2-ui.md`:

| Surface | iOS identifier | Android testTag |
|---|---|---|
| Continue-as headline | `auth.continueAs.name` | `auth.continueAs.title` |
| Step-up sheet | `auth.stepUp.{passwordSheet,passwordField,cancel,confirm}` | `stepUp.{passwordSheet,passwordField,cancel,verify}` (no `auth.` prefix, `verify` vs `confirm`) |
| Login security banner | `loginSecurityBanner` | `loginSessionEndBanner` |
| Login remembered account | `loginRememberedAccount{,Name,Email,Remove}` | `loginRememberedAccount`, `loginRememberedAccountForget` |

`auth.continueAs.{avatar,email,continue,differentAccount,remove,securityBanner,error}` and the
`OAuthButtonGroup` "Last used" affordance already match. Neither side is wrong on its own; picking the
winner is a two-layer edit, so it belongs to the conformance pass.

## Final verification — GREEN

`cd frontend/apps/android` with `JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home`,
`ANDROID_HOME=~/Library/Android/sdk`.

```
./gradlew ktlintCheck detekt :app:lintDebug test paparazziVerify :app:assembleDebug --continue
→ BUILD SUCCESSFUL in 30m 47s   (116 tasks; exit 0)
```

That is exactly the CI `quality` job from `.github/workflows/android-ci.yml`. Per-task results:

| Task | Result |
|---|---|
| "No raw hex in feature code" grep gate (`app/src/main/java/.../ui/screens`) | PASS — no matches |
| `ktlintCheck` (root + app main/test/kts source sets) | PASS |
| `detekt` | PASS — 0 weighted issues |
| `:app:lintDebug` | PASS — 0 errors (204 pre-existing warnings, none from this feature) |
| `test` → `:app:testDebugUnitTest` | **365 classes / 3476 tests, 0 failures, 0 errors, 61 skipped** |
| `test` → `:app:testReleaseUnitTest` | 365 classes / 3477 tests, 61 skipped; 1 retried flake, see below |
| `paparazziVerify` (`verifyPaparazziDebug`) | PASS — no snapshot drift |
| `:app:assembleDebug` | PASS — `app/build/outputs/apk/debug/app-debug.apk` |

The single release-variant failure is `VerifyEmailLandingViewModelTest > resend silently no-ops when email
missing`, `kotlinx.coroutines.test.UncaughtExceptionsBeforeTest` — the known kotlinx-coroutines
main-dispatcher init race that `app/build.gradle.kts` documents and that the `test-retry` plugin covers
(`failOnPassedAfterRetry = false`); it passed on retry, is in a file this feature does not touch, and did not
fail the build. Earlier debug runs showed the same flake shape in `WalletViewModelTest`,
`WalletPayoutViewModelTest` and `MailboxMapNetworkTest`.

### Feature test coverage (all green)
`data.auth`: DPoPProofBuilderTest 8, DeviceIdentityTest 6, AccountHintStoreTest 6, AuthInterceptorsTest 7,
AuthRepositoryResumeTest 11, AuthRepositorySecurityTest 10, AuthRepositoryTest 38, TokenAuthenticatorTest 9,
TokenStorageTest 10. UI: ContinueAsViewModelTest 10, DevicesViewModelTest 17, LoginViewModelTest 10,
RootViewModelTest 3 (new), PrivacyViewModelTest 23, SettingsViewModelsTest 5, PushTokenSyncerTest 5.

## Files changed by THIS stage
- `app/src/main/java/app/pantopus/android/data/auth/DeviceKeyStore.kt` — drop the API-28 catch type (lint `NewApi`).
- `app/src/main/java/app/pantopus/android/data/auth/StepUpKeyStore.kt` — same.
- `app/src/main/java/app/pantopus/android/data/account/AccountDeletionRepository.kt` — ktlint function-signature.
- `app/src/main/java/app/pantopus/android/ui/screens/auth/AuthAutofill.kt` — KDoc placement + `MatchingDeclarationName`.
- `app/src/main/java/app/pantopus/android/ui/screens/auth/ContinueAsScreen.kt` — `MatchingDeclarationName`.
- `app/src/main/java/app/pantopus/android/core/security/StepUpHost.kt` — `MatchingDeclarationName`.
- `app/src/main/java/app/pantopus/android/core/security/StepUpCoordinator.kt` — `Attempt`/`submitPassword` split
  (NestedBlockDepth) + single-permit `interceptorSlot` for the 403-interceptor path.
- `app/src/main/java/app/pantopus/android/ui/screens/settings/security/DevicesViewModel.kt` — `groups()` split into
  five per-group builders; `browserLabel`/`eventLabel` table-driven; Timber log in the generic catch.
- `app/src/main/java/app/pantopus/android/ui/screens/RootViewModel.kt` — `onAppStart()` signs out on `AuthRejected`.
- `app/src/test/java/app/pantopus/android/ui/screens/RootViewModelTest.kt` — NEW (3 tests).
- `app/src/test/java/app/pantopus/android/ui/screens/settings/security/DevicesViewModelTest.kt` — Int-overflow fix + wrapping.
- `app/src/test/java/app/pantopus/android/LoginViewModelTest.kt` — line wrapping.

Status: DONE — Android layer builds, lints and tests green against the CI quality job; CONTRACT self-review
above is conformant. The only open item is the cross-layer test-tag parity table, deliberately left to the
conformance stage.
