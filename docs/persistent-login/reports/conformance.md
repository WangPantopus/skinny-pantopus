# Stage D — cross-layer CONTRACT conformance review

Status: DONE (2026-08-19)

Role: read `CONTRACT.md`, then the real implementations in backend / iOS /
Android / web; verify byte-exact agreement of every request, response, header,
error code, storage key and behaviour rule; fix whichever layer deviates.

Result: **6 discrepancies found, 6 fixed.** No wire-format break existed — the
DPoP proof, the step-up token, the error envelope, the device descriptor, the
`/api/auth` shapes and the client storage keys already agree byte-for-byte on
all four layers. The defects were (a) a socket revocation signal Android never
handled, (b) client copy tables that had drifted from the backend's real
security-event vocabulary, (c) one iOS endpoint sending a header the contract
does not define, (d) two doc/copy drifts.

---

## Conformance table

Legend: ✅ conforms · ⚠️ deviated, now fixed · n/a not applicable to that layer.

| Item (CONTRACT.md) | backend | iOS | Android | web | fixed? |
|---|---|---|---|---|---|
| **Headers** |
| `Authorization: Bearer` unchanged | ✅ | ✅ | ✅ | ✅ (cookies) | — |
| `X-Client-Platform` | ✅ (`startsWith ios/android`) | ✅ `ios-<ver>` | ✅ `android` | n/a | — |
| `X-Device-Id` on every request once an identity exists | ✅ reads body-or-header | ✅ `APIClient` + `MultipartUploader` | ✅ `DeviceIdentityInterceptor` (both OkHttp clients) | n/a | — |
| `DPoP` header name / `typ:"dpop+jwt"` / `alg:"ES256"` | ✅ pinned, rejects anything else | ✅ | ✅ | n/a (never sends) | — |
| embedded JWK `{kty,crv,x,y}` b64url **no padding** | ✅ `isPlainP256Jwk`, rejects `d` | ✅ `JWK(p256PublicKey:)`, `Base64URL` strips `=` | ✅ `EcKeyCodec.jwkFor` (`getUrlEncoder().withoutPadding()`) | n/a | — |
| payload `{jti,htm,htu,iat,rth?}` | ✅ `requiredClaims` | ✅ | ✅ | n/a | — |
| `htu` = `<scheme>://<host>[:port]<path>`, **no query/fragment** | ✅ `expectedHtu` + normalising compare (default port elided by WHATWG `URL.host`) | ✅ `DPoPProofBuilder.htu(for:)` | ✅ `DPoPProofBuilder.htu(baseUrl,path)` elides default port, strips `?`/`#` | n/a | — |
| signature raw `r‖s` (64 B) b64url | ✅ `dsaEncoding:'ieee-p1363'` / jose ES256 | ✅ `rawRepresentation` | ✅ `EcKeyCodec.derToRaw` | n/a | — |
| RFC 7638 thumbprint (canonical `{crv,kty,x,y}`) | ✅ jose | ✅ hand-built, identical byte layout | ✅ identical | n/a | — |
| `rth = b64url(sha256(refreshToken))`, REQUIRED on `/refresh` + `/logout` when a refresh token is sent | ✅ timing-safe compare | ✅ | ✅ | n/a | — |
| `iat` ±300 s · `jti` single-use 10 min | ✅ 300 / 600, jti burned LAST | ✅ fresh jti per attempt | ✅ fresh jti per attempt | n/a | — |
| `X-Step-Up` header spelling | ✅ case-insensitive read | ✅ `APIClient.stepUpHeader` | ✅ `StepUpInterceptor.HEADER_STEP_UP` | ✅ `STEP_UP_HEADER` | — |
| **Device descriptor** |
| field names / `platform` / `keyBacking` enum | ✅ `normalizeDeviceDescriptor` + Joi | ✅ | ✅ | n/a | — |
| `installId` = hex32 (`^[A-Za-z0-9_-]{8,64}$`) | ✅ | ✅ 16 random bytes hex | ✅ 16 `SecureRandom` bytes hex | n/a | — |
| `deviceId` UUID | ✅ | ✅ lowercased UUIDv4 | ✅ `UUID.randomUUID()` | n/a | — |
| `attestation` reserved / null | ✅ stored, `attestation_level='none'` | ✅ explicit null | ✅ omitted (Moshi drops nulls) — both accepted | n/a | — |
| **Error envelope** |
| `{error, code}` · the 10 × 401 codes · 403 `STEP_UP_REQUIRED {purpose,methods}` | ✅ | ✅ `SessionEndReason` + `AuthErrorBody` | ✅ `AuthErrorCodes` + `AuthErrorBodyParser` | ✅ `getApiErrorCode` / `isStepUpRequired` | — |
| security-sign-out set (6 codes, exact) | ✅ | ✅ `isSecurity` | ✅ `SECURITY_SIGN_OUT` | ✅ `SECURITY_SIGN_OUT_CODES` | — |
| security banner copy (pinned string) | n/a | ✅ | ✅ | n/a | — |
| non-security ("expired") banner copy | n/a | ✅ | ⚠️ differed | n/a | **fixed (Android → iOS wording)** |
| **Existing routes — additive** |
| login/oauth/`oauth/native`: optional `device` + DPoP; response `sessionId`,`session{id,context}`,`device` | ✅ `sessionFields` (cookie ⇒ `sessionId` only) | ✅ | ✅ | ✅ `AuthResponse` | — |
| `/refresh` body `{refreshToken,deviceId?,sessionId?}` + DPoP(rth); server order; response incl. `ok:true` | ✅ resolve→revoked→inactivity→proof-vs-bound-key→adopt | ✅ | ✅ | ✅ (cookies) | — |
| legacy adoption rule `bound_at_issue=false AND issued_at < DPOP_CUTOVER` | ✅ code correct; ⚠️ **comment claimed the opposite** | n/a | n/a | n/a | **fixed (comment)** |
| `/logout` `{scope,deviceId?,refreshToken?}`; `local` side effects only with proof; `others`/`global` need verifyToken + step-up | ✅ `logoutLocal` proof (a) Bearer→its session (b) refresh-hash→bound key verifies DPoP(rth) | ✅ Bearer + refreshToken + DPoP(rth) + deviceId | ✅ identical | ✅ `logout({scope,stepUpToken})` | — |
| `/reauthenticate` adds `{stepUpToken,expiresAt,purpose:"generic"}` | ✅ + promotes `restored`→`interactive` | ✅ | ✅ | ✅ | — |
| `DELETE /account` needs `X-Step-Up`; strongest-method rule | ✅ `requireStepUp` + `requireStrongestStepUpForDeletion` | ✅ `hasPassword`⇒[password] | ✅ `hasPassword`⇒[password] | n/a | — |
| **New router `/api/auth`** |
| all 12 routes: method, path, auth, body, response, status | ✅ | ✅ (no `/resume` — Android-only by contract) | ✅ | ✅ (DPoP routes deliberately not exposed) | — |
| `/step-up` is **Bearer-only** | ✅ no DPoP middleware | ⚠️ sent an inert `DPoP` header | ✅ none | ✅ none | **fixed (iOS)** |
| `/devices/register` never binds; 409 `DEVICE_NOT_BOUND` on unbound | ✅ | ✅ | ✅ | n/a | — |
| `/challenge` purposes `step_up\|resume\|attestation`; `device_key` signs the **raw (b64url-decoded) challenge bytes** | ✅ `Buffer.from(challenge,'base64url')` | ✅ `Base64URL.decode` | ✅ `EcKeyCodec.base64UrlDecode` | ✅ typed | — |
| step-up purposes / methods / token format / 5 min / one-shot set | ✅ | ✅ `StepUpPurpose` | ✅ `StepUpCoordinator.PURPOSE_*` | ✅ | — |
| `device_key` only for interactive-enrolled key **and** interactive session | ✅ `verifyStepUpDeviceKey` + `requireStepUp` restored-guard | ✅ `canStepUpWithDeviceKey` | ✅ `canStepUpWithDeviceKey` | n/a (native-only) | — |
| **Security-event vocabulary** (`events[].type`) |
| 21 types actually emitted | ✅ source of truth | ⚠️ 1 dead key, 6 missing | ⚠️ 4 missing | ⚠️ 2 dead keys, 3 missing | **fixed (all three)** |
| **Feature flags / env** |
| names + defaults (`AUTH_DEVICE_BINDING=optional`, `AUTH_RESUME_GRANTS=on`, `DPOP_CUTOVER`, `PUBLIC_API_BASE_URL`, `STEP_UP_SECRET`, inactivity 90/30, grant 90 d) | ✅ `authPolicy.js` + `.env.example` | n/a | n/a | n/a | — |
| **Client storage keys** |
| iOS Keychain: `deviceId`,`deviceKey`,`stepUpKey`,`installId`,`expiresAt`,`sessionId`,`sessionContext`,`accountHints`(max 3),`appLockEnabled.<uid>` | n/a | ✅ (+ additive `deviceKeyBacking`, `stepUpKeyPolicy`, `stepUpKeyEnrolledUserId`, `registeredAppVersion`) | n/a | n/a | — |
| iOS install marker `Library/Application Support/.pantopus-install`, backup-excluded | n/a | ✅ | n/a | n/a | — |
| Android `TokenStorage` `expires_at`/`session_id`/`session_context`; `device_identity` prefs backup-excluded; Block Store `pantopus.account_hint` `{v:1,accounts≤3,resumeGrant?,grantUserId?,issuedAt}`, `setShouldBackupToCloud(false)` | n/a | n/a | ✅ | n/a | — |
| **Client behaviour** |
| proactive refresh at `expiresAt − now < 120 s`, never on `/refresh` itself, single-flight | n/a | ✅ `isAccessTokenExpiringSoon` (`sendRaw` bypasses) | ✅ `PROACTIVE_REFRESH_WINDOW_SECONDS = 120` + `refreshMutex` | ✅ shared mutex | — |
| cold start L1→L2→L3; **reinstall ALWAYS L2**; no OS lock ⇒ L3 | n/a | ✅ `InstallMarker.verdict` ⇒ `.resumable`; `presenceGate.isAvailable` false ⇒ `.signedOut` | ✅ no tokens after reinstall ⇒ `restoreFromHints`; `presenceVerifier.canVerify()` false ⇒ `SignedOut` | n/a | — |
| L2 gate: `LAContext.deviceOwnerAuthentication` / `BiometricPrompt(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)` | n/a | ✅ | ✅ | n/a | — |
| explicit local sign-out: `/logout` with proof, wipe tokens/expiresAt/sessionId, **keep hints**; "Not you? Remove" wipes hints (+ Block Store delete) | n/a | ✅ | ✅ | n/a | — |
| register device after login / resume / app update / push-token change | n/a | ✅ `scheduleDeviceRegistration(onlyIfAppUpdated:)`, `pushTokenDidChange` | ✅ fingerprint-gated `registerDevice()`, `PushTokenSyncer`, `onNewToken` | n/a | — |
| 403 `STEP_UP_REQUIRED` interceptor, retry **once** with `X-Step-Up` | n/a | ✅ `APIClient` one step-up round/request | ✅ `StepUpInterceptor` (+ single-permit slot) | ✅ page-level | — |
| revocation signal is **never** the authority — confirm with a `/refresh` probe | ✅ emits `auth:session_revoked` + silent push | ✅ `SocketClient` → `confirmSessionAfterRevocationSignal()` | ⚠️ **push only — socket event ignored** | n/a | **fixed (Android)** |

---

## The six discrepancies, in detail

### 1. Android ignored the `auth:session_revoked` socket event (behavioural, highest impact)
`backend/socket/chatSocketio.js:44` emits
`auth:session_revoked {sessionId, reason, code:'SESSION_REVOKED'}` and then
force-disconnects. iOS subscribes (`SocketClient.swift:135`) and runs the
confirm-then-sign-out path. Android's `SocketManager` registered only
`connect`/`disconnect`/`connect_error`, so a user whose session was revoked
from another device kept a live-looking UI until the next request 401'd (the
FCM silent push covers only devices with a working push token).

Fix: `SocketManager` gained `EVENT_SESSION_REVOKED` and a hot
`sessionRevoked: SharedFlow<Unit>` (replay 1 so a signal that lands before the
collector attaches is still delivered; the replay cache is reset in
`disconnect()` so it cannot fire against the next session). `RootViewModel`
collects it and calls `AuthRepository.confirmSessionRevoked()` — a `/refresh`
probe that signs out only on a 401, exactly like iOS.

### 2–4. Security-event vocabulary drift (all three clients)
The authoritative set is the 21 `type` values passed to
`authSessionService.recordSecurityEvent` (`authDeviceService.js`,
`authNotifyService.js`, `routes/authDevices.js`, `routes/users.js`):

```
login logout resume refresh_reuse device_mismatch device_revoked
session_revoked inactivity_expired step_up step_up_key_enrolled
security_prefs_changed revoke_others lockdown password_changed
password_reset account_deleted
new_device_email_sent device_removed_email_sent password_changed_email_sent
security_signout_email_sent lockdown_email_sent
```

- iOS had a dead `new_device` key (the backend writes `new_device_email_sent`)
  and no copy for `revoke_others` or any of the five `*_email_sent` types.
- Android had no copy for four `*_email_sent` types, and its doc-comment
  cited a non-existent `authEventService.js`.
- Web had two dead keys (`oauth_login`, `revoke_all` — the latter also in the
  alert set) and no copy for `session_revoked`, `device_removed_email_sent`,
  `security_signout_email_sent`.

All three fall back to title-cased raw text, so nothing crashed — the user just
saw `Device Removed Email Sent`. Each layer keeps its own voice (web is
deliberately more verbose); only the key sets are now identical, and each layer
has a test that walks the full vocabulary (iOS additionally asserts there are no
dead keys). Web's alert set now matches the native set exactly.

### 5. iOS sent a `DPoP` header on `/api/auth/step-up`
The contract lists that route as Bearer-only, the backend runs no DPoP
middleware there (so the proof was inert and its `jti` never burned), and
Android sends none. `AuthEndpoints.stepUp` no longer sets `requiresDPoP`; the
`device_key` proof is the ES256 challenge signature inside the body, which is
unchanged.

### 6. `DPOP_CUTOVER` comment contradicted its own rule
`backend/config/authPolicy.js` said the default `9999-01-01` meant "nothing
adopted". The rule is `bound_at_issue=false AND issued_at < DPOP_CUTOVER`, so a
far-future default makes **every** unbound legacy session adoptable — the
accepted status-quo risk of `optional` mode, exactly as CONTRACT.md §`/refresh`
states. Comment corrected (`.env.example` was already right; no behaviour
change).

---

## Files changed

| File | Change |
|---|---|
| `backend/config/authPolicy.js` | `DPOP_CUTOVER` doc-comment corrected to match CONTRACT + the code |
| `frontend/apps/web/src/lib/securityActivity.ts` | event-label map + alert set aligned to the backend vocabulary |
| `frontend/apps/web/tests/securityActivity.test.ts` | assertions updated; new full-vocabulary test |
| `frontend/apps/android/.../data/realtime/SocketManager.kt` | `auth:session_revoked` listener + `sessionRevoked` SharedFlow |
| `frontend/apps/android/.../ui/screens/RootViewModel.kt` | collects it → `AuthRepository.confirmSessionRevoked()` |
| `frontend/apps/android/.../ui/screens/settings/security/DevicesViewModel.kt` | 4 missing event labels; doc-comment fixed |
| `frontend/apps/android/.../data/auth/AuthRepository.kt` | non-security `SessionEndReason.message` matches iOS |
| `frontend/apps/android/.../test/.../RootViewModelTest.kt` | new ctor arg + revocation-probe test |
| `frontend/apps/android/.../test/.../security/DevicesViewModelTest.kt` | full-vocabulary assertion |
| `frontend/apps/ios/.../Features/Settings/Security/DevicesViewModel.swift` | dead key removed, 6 missing labels added |
| `frontend/apps/ios/.../Core/Networking/Endpoints/AuthEndpoints.swift` | `stepUp` is Bearer-only |
| `frontend/apps/ios/PantopusTests/Core/Auth/AuthStepUpTests.swift` | DPoP assertion inverted per CONTRACT |
| `frontend/apps/ios/PantopusTests/Features/Settings/DevicesViewModelTests.swift` | full-vocabulary + no-dead-keys test |

## Verification

| Layer | Command | Result |
|---|---|---|
| backend | `npx jest tests/authDpop tests/authStepUp tests/authDeviceService tests/authDevicesRoutes tests/authUsersHooks` | 5 suites, **206 tests, 0 failures** |
| web | `pnpm test` | 21 suites, **200 tests, 0 failures** |
| web | `pnpm exec tsc --noEmit` | clean |
| Android | `./gradlew :app:testDebugUnitTest --tests RootViewModelTest --tests DevicesViewModelTest --tests 'data.auth.*'` | BUILD SUCCESSFUL, **124 tests, 0 failures/errors** |
| Android | `./gradlew ktlintCheck detekt` | BUILD SUCCESSFUL |
| iOS | `make build` | **BUILD SUCCEEDED** |
| iOS | `xcodebuild … -only-testing:{AuthStepUp,DevicesViewModel,AuthManager,AuthManagerRefresh,AuthManagerResume}Tests test` | **TEST SUCCEEDED**, 91 tests, 0 failures |
| iOS | `swiftlint lint --strict` + `swiftformat --lint` (4 changed files) | clean |

## Notes for the next stage (security review / final verify)

- **Nothing in the fix set changes the wire.** Every edit is a client-side copy
  table, one inert request header, one comment, or a new socket subscription.
  The backend's request/response bytes are untouched, so a full backend
  `pnpm test` is not strictly required — but Stage F should still run it.
- **Deliberate, contract-sanctioned asymmetries** (verified, do NOT "fix"):
  `/api/auth/resume` and `resumeGrant` are Android-only (`grantEligible`
  requires `platform === 'android'`); iOS reaches L2 through the surviving
  Keychain instead. Web never sends `DPoP`/`X-Device-Id` and is exempt from
  `DPOP_REQUIRED` in every mode (`verifyAuthRouteDpop` +
  `checkRefresh({cookieTransport})`).
- **Additive response fields beyond the contract** (harmless, all clients
  tolerate unknown keys): `publicDevice` also returns `requireStepUp`;
  `DELETE /devices/:id` returns `revokedSessions`; `GET /devices` device rows
  carry a nested `sessions[]` and session rows carry `context`;
  `GET /security-events` rows carry `sessionId`.
- **`event.deviceId` is the AuthDevice ROW id**, i.e. it joins to
  `devices[].id`, not to `devices[].deviceId`. Only iOS joins events to devices
  and it accepts either. Worth one clarifying line in CONTRACT.md if the
  Android/web timelines ever start resolving device names.
- **Android `DPoPProofBuilder.htu(baseUrl, path)` replaces the whole path**, so
  it would be wrong if `PANTOPUS_API_BASE_URL` ever gained a path prefix.
  Today every environment is a bare origin and the backend derives its side
  from `req.originalUrl`, so the two agree. Left as-is deliberately: matching a
  base-URL path prefix would break the common proxy-strips-prefix deployment.
- **Ops reminder unchanged**: set `PUBLIC_API_BASE_URL` in production (otherwise
  `htu` falls back to the spoofable `Host` header — residual risk nil because
  the proof must still be signed by the bound key), and set `DPOP_CUTOVER` to
  the client ship date before flipping `AUTH_DEVICE_BINDING=required`.
