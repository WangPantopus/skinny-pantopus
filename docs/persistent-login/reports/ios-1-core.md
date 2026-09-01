# iOS stage 1 — Core (no UI)

Status: DONE (run 4, 2026-08-18) — app + test targets compile; full iOS unit suite 3512 tests / 0 failures (UI-test target skipped as in CI); swiftlint --strict + swiftformat --lint clean on every changed/new file.

Layer: `frontend/apps/ios` only (Pantopus/Core/**, PantopusTests/**; compile-only touch of App/PantopusApp.swift for `.resumable`; project.yml applinks parity fix so `xcodegen` stops regressing the committed entitlements).

## Plan (from task)
1. New Core/Auth files: DeviceKey, StepUpKey, DPoPProofBuilder, InstallMarker, DeviceDescriptor, AccountHint.
2. KeychainStore: new SecureStoreKey cases + Data get/set on SecureStore (+ InMemoryStore/InMemorySecureStore).
3. AuthManager: `.resumable(AccountHint)`, restoreSession L1->L2->L3, resume(), persistLoginResponse (expiresAt/sessionId/context/hints + registerDevice), performRefresh (deviceId/sessionId + DPoP rth, error code -> SessionEndReason), refreshIfExpiringSoon(), signOut(scope:), removeRememberedAccount(), stepUp(purpose:), enrolStepUpKey().
4. APIClient + MultipartUploader: X-Device-Id, DPoP for `requiresDPoP` endpoints, pre-flight refresh (<120 s), X-Step-Up + 403 STEP_UP_REQUIRED interceptor (retry once), URLCache purge on sign-out.
5. AuthEndpoints + AuthDTOs: all new endpoints/DTOs per CONTRACT with route doc-comments.
6. SocketClient: auth error -> refreshIfPossible() then reconnect; stop on DEVICE_REVOKED/SESSION_REVOKED.
7. AppSecurity: AppLockManager pref -> Keychain (one-time migration), verifyPresence(reason:).
8. Tests: DPoPProofBuilderTests, DeviceKeyTests, InstallMarkerTests, AuthManagerResumeTests, extend AuthManagerRefreshTests + AuthManagerTests.

## On-disk state at start of run 3 (uncommitted; one build attempted in run 2, no tests run yet)
New (untracked), all read + reviewed this run:
- Core/Auth/DeviceKey.swift — DeviceKeyBacking, JWK(+thumbprint), DPoPSigner, Base64URL, DeviceKey (SE|software, load/create/delete), DeviceIdentity (deviceId+key). Complete.
- Core/Auth/StepUpKey.swift — SE key w/ SecAccessControl biometryCurrentSet | userPresence fallback, sign(challenge) w/ LAContext off-main. Complete.
- Core/Auth/DPoPProofBuilder.swift — ES256 dpop+jwt incl. rth, raw r||s, decodeParts for tests. Complete.
- Core/Auth/InstallMarker.swift — file + Keychain mirror, verdict, installIdForDescriptor/commit/ensure. Complete.
- Core/Auth/DeviceDescriptor.swift — CONTRACT device object (attestation: null). Complete.
- Core/Auth/AccountHint.swift — Codable hint + AccountHintStore (max 3, most-recent-first). Complete.
- Core/Auth/AuthManager+Session.swift — PresenceGate, restoreSession L1/L2/L3, resume(), performRefresh (sendRaw, DPoP rth, code->SessionEndReason), refreshIfExpiringSoon, confirmSessionAfterRevocationSignal, session metadata, endSession/clearLocalSession. Complete.
- Core/Auth/AuthManager+Devices.swift — device identity, registerDevice, step-up key enrol, stepUp(purpose:), signOut(scope:), scheduleLocalLogout, removeRememberedAccount. Complete.
- Core/Networking/Models/Auth/AuthDeviceDTOs.swift — /api/auth DTOs. Complete.
Modified (all read + reviewed this run):
- Core/Auth/AuthManager.swift — State.resumable, sessionEndReason/sessionId/sessionContext/expiresAt, injectable store/apiClient/installMarker/presenceGate/allowSecureEnclave/now, persistLoginResponse w/ hints+marker+registerDevice; signOut() -> signOut(scope: .local).
- Core/Auth/AuthManager+OAuth.swift — device descriptor on /oauth/callback + /oauth/token; hint method apple/google.
- Core/Auth/KeychainStore.swift — SecureStore Data API + new SecureStoreKey cases.
- Core/Auth/InMemorySecureStore.swift — Data support (preview store).
- Core/Networking/APIClient.swift — authProvider, X-Device-Id, DPoP (requiresDPoP), pre-flight refresh, X-Step-Up + STEP_UP_REQUIRED interceptor, sendRaw, purgeCache, url(forPath:), registerPushToken deviceId.
- Core/Networking/MultipartUploader.swift — authProvider, X-Device-Id, pre-flight refresh.
- Core/Networking/Endpoints/AuthEndpoints.swift — all new endpoints.
- Core/Networking/Models/Auth/AuthDTOs.swift — device on requests, sessionId/session/device on responses, Logout*, Reauthenticate*, AuthErrorBody(purpose/methods, decode), SessionEndReason, LenientTimestamp.
- Core/Realtime/SocketClient.swift — auth-error classify -> tokenRefresher + reconnect; terminal codes -> stopForRevocation + revocationConfirmer.
- Core/Security/AppSecurity.swift — `enabled` pref -> Keychain w/ one-time migration; injectable secureStore init; isEnabled(forUserID:), clearPreference(forUserID:), verifyPresence(reason:).
- App/PantopusApp.swift — `.resumable` -> PlaceLaunchHost placeholder (stage 2 swaps in ContinueAsView); `.active` -> refreshIfExpiringSoon().
- PantopusTests/Support/Fixtures.swift — InMemorySecureStore: Data API, NSLock, writeError, allKeys.
- Resources/Pantopus.entitlements — REGRESSION caused by `make bootstrap` (xcodegen regenerates from project.yml, which lacked the pantopus.com applinks). Fixed this run via project.yml (see below).

## On-disk state at start of run 4 (all files re-read this run)
- Everything listed above PLUS (written by run 3, untested):
  - project.yml — applinks pantopus.com/www.pantopus.com added (regen source of truth). DONE.
  - InstallMarker.installIdForDescriptor — mints a NEW id when the file is missing. DONE.
  - PantopusTests/Support/AuthTestSupport.swift — FakePresenceGate, DecodedDPoP (verifies ES256 sig against embedded JWK), URLRequest body/DPoP readers, SequencedURLProtocol.captured(path:).
  - PantopusTests/Support/Fixtures.swift — profileJSON(), refreshJSON() fixtures.
  - PantopusTests/Core/Auth/DPoPProofBuilderTests.swift (RFC 7515 vector, htu, rth, proof shape, fresh jti).
  - PantopusTests/Core/Auth/DeviceKeyTests.swift (software path, identity regen).
  - PantopusTests/Core/Auth/InstallMarkerTests.swift (verdicts, commit, backup exclusion).
  - PantopusTests/Core/Auth/AccountHintTests.swift (mask, JSON shape, cap 3, ordering).
  - PantopusTests/Core/Auth/AuthManagerResumeTests.swift (reinstall→resumable, L1 silent, refresh-first, dormant, resume ok w/ DPoP rth, 401 codes, no OS lock, cancel, transient, local sign-out w/ proof, remove hint, supersede).
- NOT yet done: AuthManagerRefreshTests/AuthManagerTests extensions; compile; run tests; lint.

## Files created / changed in THIS run (appended as they happen)
- (see below, appended live)

## Remaining (run 4)
- (all done — see FINAL STATE below; entitlements comment restored so the file matches HEAD, but note `make bootstrap`/xcodegen drops that XML comment on every regen)

## Commands run
- (run 2) `make build` #1: only error was the missing verifyPresence (since added). Not re-verified yet in run 3.
- (run 4) AuthManager+Devices.swift: stepUp skips device_key for `.generic` + falls back to password when the server refuses the method (403); enrolStepUpKeyIfNeeded honours `allowSecureEnclave`; removeRememberedAccount tail simplified.
- (run 4) AuthManager.swift: authProvider wiring = only for non-shared APIClient (shared falls back to AuthManager.shared).
- (run 4) PantopusTests/Support/Fixtures.swift: loginJSON gains `sessionId`/`expiresAt` params (additive fields).
- (run 4) PantopusTests/AuthManagerTests.swift: makeManager injects temp InstallMarker/FakePresenceGate/software keys; new tests: logout network call w/ proof, logout failure tolerated, no-token sign-out silent, handleUnauthorized reason, login persists metadata+hint+marker+device registration, backward-compat login.
- (run 4) PantopusTests/AuthManagerRefreshTests.swift: makeManager injects marker/gate/software keys/frozen clock; new tests: refresh carries deviceId/sessionId/DPoP(rth)/X-Device-Id, legacy install mints identity, 401 code→sessionEndReason (DEVICE_REVOKED, no code), proactive refresh before authed request (<120 s), no refresh when fresh, never on unauthenticated, rejection ends session before send, transient still sends, refreshIfExpiringSoon foreground hook, no-op when signed out.
- (run 4) NEW PantopusTests/Core/Auth/AuthStepUpTests.swift: 403 STEP_UP_REQUIRED interceptor (password prompt → /api/auth/step-up → replay once with X-Step-Up; no prompt/cancel → .forbidden; only once per request; plain 403 untouched), stepUp error mapping, server method list honoured, reauthenticate DTO, signOut(scope: .others/.global).
- (run 4) `make build` → BUILD SUCCEEDED (app target). `xcodebuild build-for-testing` → TEST BUILD SUCCEEDED after fixing one async-autoclosure assert. swiftlint --strict + swiftformat --lint clean on all changed/new files (added file-level `swiftlint:disable file_length type_body_length` per repo convention on APIClient/AuthDTOs/3 test files; DPoPProofBuilder.decodeParts returns `Parts` struct instead of a 3-tuple).
- (run 4) Backend route line refs refreshed in AuthEndpoints/AuthDTOs/AuthManager (users.js 3074/3140/3222/3272; authDevices.js 213/228/260/273/297/315/375/448/468/478/500).
- (run 4) AuthManager+Session.swift: PresenceGate gains `isAvailable`; becomeResumable falls straight to `.signedOut` (L3, tokens+hint kept) when there is no OS lock (design §2.2); resume() reports `.rejected(reason)` when the post-refresh profile fetch ends the session. Tests updated/added in AuthManagerResumeTests (reinstall w/o OS lock → L3 at restore; OS lock removed between launch and tap; profile rejection after good refresh). AuthTestSupport.FakePresenceGate.isAvailable.
- (run 4) DPoPProofBuilderTests: fixed UInt8 overflow crash in testBase64URLRoundTripsAllRemainders (truncatingIfNeeded).
- (run 4) First targeted run (`test-without-building`, 9 auth classes): all suites passed except the crash above (fixed). Full `make test` running.
- (run 4) NEW PantopusTests/Core/Auth/AppLockPreferenceTests.swift: Keychain-backed app-lock pref, one-time UserDefaults migration, per-user key name, clearPreference.
- (run 4) FULL `make test` unit run: 3328 passed, 2 failed (both in my new AuthStepUpTests) → root cause: a 401 from /api/auth/step-up (wrong password) went through APIClient's silent-refresh+replay+sign-out path — would sign the user out for a typo. FIX: `Endpoint.verifiesCredential` flag (APIClient surfaces that 401 as `.unauthorized`, no refresh/replay/sign-out); set on `AuthEndpoints.stepUp` + `reauthenticate`. New test testWrongPasswordNeverTriggersRefreshOrSignOut. (UI-test failures in NavigationSmokeTest are the UI target — checking whether pre-existing.)
- (run 4) NEW PantopusTests/Core/Auth/SocketClientAuthErrorTests.swift: errorMessage shapes, refreshable error → one refresh + reconnect (coalesced), non-auth errors ignored, SESSION_REVOKED/DEVICE_REVOKED stop + confirmer, fresh token lifts the stop.
- (run 4) SocketClient.authToken made `private(set)` (test-readable). Targeted rerun after fixes: AuthManagerTests 21, AuthManagerRefreshTests 20, AuthManagerResumeTests 19, AuthStepUpTests 12, DPoPProofBuilderTests 9, DeviceKeyTests 8, InstallMarkerTests 10, AccountHintTests 7, AppLockPreferenceTests 5, SocketClientAuthErrorTests 6, LoginViewModelTests 4 — ALL PASS. NOTE: new test files need `make bootstrap` (xcodegen) to be picked up.
- (run 4) UI-test failures seen in the full `make test` (PantopusUITests.testLaunchLandsOnLogin etc.) are pre-existing: they expect the login field on launch but the front door is PlaceLaunchHost; CI skips PantopusUITests (`-skip-testing:PantopusUITests`, ios-ci.yml:186-209).

## FINAL STATE (end of run 4)

### Verification
- `make build` → BUILD SUCCEEDED.
- `xcodebuild … -skip-testing:PantopusUITests test` (same shape as ios-ci.yml) → **Executed 3512 tests, 0 failures** (168 skipped = pre-existing skips).
- Persistent-login test classes (all green): AuthManagerTests 21, AuthManagerRefreshTests 20, AuthManagerResumeTests 19, AuthStepUpTests 12, DPoPProofBuilderTests 9, DeviceKeyTests 8, InstallMarkerTests 10, AccountHintTests 7, AppLockPreferenceTests 5, SocketClientAuthErrorTests 6 (+ LoginViewModelTests 4 still green).
- `swiftlint lint --strict` on all changed/new files: clean. Whole-project run shows only 6 pre-existing force_unwrapping errors in untouched `Features/**` files. `swiftformat --lint .` → 0/1575 files need formatting. verify-icons / verify-tokens pass.
- Full `make test` (incl. UI target) shows 4 PantopusUITests failures that are pre-existing (they expect the login field at launch; the front door is `PlaceLaunchHost`); CI skips that target.

### What stage 2 (iOS UI) needs to know
- `RootView` `.resumable` currently renders `PlaceLaunchHost` as a placeholder → replace with `ContinueAsView` bound to `AuthManager.resume()` (returns `ResumeOutcome`), `removeRememberedAccount()`, `rememberedAccounts`, `sessionEndReason?.message` ("You were signed out for security…" vs generic expiry).
- Set `AuthManager.stepUpPasswordPrompt` from the root UI (async closure `(StepUpPurpose) -> String?`); until it is set, password step-up is unavailable and a 403 `STEP_UP_REQUIRED` surfaces as `APIError.forbidden`. The APIClient interceptor then retries once with `X-Step-Up`. `AuthManager.stepUp(purpose:)` / `canStepUpWithDeviceKey` / `reauthenticate(password:)` are ready for explicit flows (Devices screen, delete account).
- Endpoints for DevicesView: `AuthEndpoints.devices` (→ `AuthDevicesResponse`), `revokeDevice(id:stepUpToken:)`, `revokeOtherSessions(stepUpToken:)` (→ `RevokeOthersResponse`), `revokeAllSessions(stepUpToken:)` (then `signOut()`), `securityPrefs` / `updateSecurityPrefs(_:stepUpToken:)`, `securityEvents(limit:)`; `signOut(scope: .others|.global, stepUpToken:)` on AuthManager.
- LoginView prefill: `AuthManager.rememberedAccounts.first` (`maskedEmail`, `displayName`, `avatarUrl`, `lastMethod`).
- New test files under `PantopusTests/Core/Auth/` require `make bootstrap` (xcodegen) once so Xcode picks them up.
- Backend route line numbers in doc-comments were refreshed against the concurrently-edited backend (users.js /reauthenticate is now :1780; others as of this run) — final verify stage should re-sync once the backend settles.
- Design deviation, deliberate: on a device with no OS lock, a reinstall / dormant launch goes straight to `.signedOut` (L3, tokens + hint kept) instead of `.resumable` — CONTRACT "No OS lock ⇒ L3".
- Security fix found by tests: `Endpoint.verifiesCredential` (set on `/api/auth/step-up`, `/api/users/reauthenticate`) stops a wrong password's 401 from being treated as an expired session (no silent refresh/replay, no sign-out).
