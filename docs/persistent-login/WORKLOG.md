# Persistent Login / Account Recovery — Worklog

Durable record of everything done on this task so any session can resume.
Started 2026-08-18. Update this file after every meaningful step.

## Task (from user, 2026-08-18)

Design production-grade persistent login for Pantopus (native iOS + Android +
Express/Supabase backend): after delete + reinstall on the same device the
user gets back in with minimal friction (auto-restore or "Continue as X" +
biometric), with Uber/Instagram/YouTube-class security (device-bound keys,
token rotation, trusted-device registry, revocation, stolen-device handling).
User's own sketch: secure OS storage (Keychain / Block Store) + cloud
credentials (passkeys / Password AutoFill / Credential Manager) + server-side
sessions/trusted devices. Deliverable: a design doc, not code.

## Status

- [x] Scouted repo auth surface (see "Facts established" below)
- [x] Launched multi-agent workflow `wf_6e56c9e8-511` (Understand → Design →
      Judge → Verify). Script + transcripts:
      `~/.claude/projects/-Users-yingpengwang-native-pantopus/d0599ebb-c591-4208-84b2-06b8966fc392/workflows/scripts/persistent-login-design-wf_6e56c9e8-511.js`
      Transcript dir (journal.jsonl has every agent's return value):
      `~/.claude/projects/-Users-yingpengwang-native-pantopus/d0599ebb-c591-4208-84b2-06b8966fc392/subagents/workflows/wf_6e56c9e8-511/`
- [x] Workflow finished (2026-08-18): 5 readers + 3 designs + 2 judges OK,
      1/8 verifiers OK, 7 verifiers FAILED ("session limit · resets 10am
      America/Vancouver"). Raw output:
      `/private/tmp/claude-501/-Users-yingpengwang-native-pantopus/d0599ebb-c591-4208-84b2-06b8966fc392/tasks/wcd9gfkgi.output`
      (also journal.jsonl in the transcript dir).
- [x] Distilled results into `WORKFLOW-RESULTS.md`; raw agent outputs copied
      to `workflow-raw/` (readers, platform facts, 3 designs, judgements).
- [x] Verified the two most load-bearing claims by hand (session_not_found on
      deleted session row — Supabase docs; generateLink→verifyOtp session mint —
      already in users.js). Recorded in WORKFLOW-RESULTS.md §4.
- [x] Design doc written: `persistent-login-design-2026-08-18.md` (16 sections
      + appendix; synthesis = Design 2 core + judges' grafts/fixes).
- [x] Published as Artifact (private until shared):
      https://claude.ai/code/artifact/51e4670c-2a2f-46f5-81d4-f28045b99c6f
      Rendered HTML also saved as `persistent-login-design-2026-08-18.artifact.html`;
      regenerate with `node build-artifact.mjs <md> <out.html>` (needs `marked@12`),
      then re-publish the same file path (or pass the URL above as `url`) to
      keep the link. Verified light + dark rendering, no horizontal overflow.
- [ ] Awaiting product-owner decisions listed in design §15 (reinstall = L2,
      security_prefs defaults, Block Store cloud off, multi-account, step-up
      for deletion, inactivity windows, iCloud hint).
- [ ] (Not requested) implementation — do NOT start without the user asking.
      If asked, start with Phase 0 (design §14): AASA/assetlinks regen,
      project.yml entitlements, backend /logout from both clients, proactive
      refresh, structured 401 codes.

## Files in this folder

- `WORKLOG.md` — this file (progress + resume point)
- `persistent-login-design-2026-08-18.md` — THE design doc (source of truth)
- `persistent-login-design-2026-08-18.artifact.html` — rendered artifact body
- `build-artifact.mjs` — markdown → artifact HTML (marked v12 renderer sigs)
- `WORKFLOW-RESULTS.md` — distilled evidence, alternatives, judge verdicts,
  verification status
- `workflow-raw/` — raw agent outputs (readers, platform facts, 3 designs,
  judgements, verdicts)

If the workflow result is lost: re-run with
`Workflow({scriptPath: <script above>, resumeFromRunId: "wf_6e56c9e8-511"})`
— completed agents return cached results.

## Facts established so far (verified by reading code)

Backend (`backend/`):
- Auth = Supabase Auth behind Express. Mobile uses `Authorization: Bearer`,
  web uses httpOnly cookies (`pantopus_access`, `pantopus_refresh`, CSRF).
  See `docs/01-authentication-authorization.md`.
- Routes live in `backend/routes/users.js`: `/login` (~1494),
  `/reauthenticate` (~1649), `/auth-methods` (~1741), `/password` (~1773),
  `/refresh` (~1912), `/oauth/:provider` (~3740), `/oauth/token` (~3817),
  `/oauth/callback` (~3887), `DELETE /account` (~3970), `/logout` (~4263).
- `/refresh` calls `supabase.auth.refreshSession({refresh_token})`; on
  "already used|not found" it logs `auth.refresh_token_reuse`, clears
  cookies, returns 401 `code: TOKEN_REUSE`. Returns
  `{accessToken, refreshToken, expiresIn, expiresAt}` for bearer clients.
- `/logout` revokes only the presented access JWT via
  `supabaseAdmin.auth.admin.signOut(token, 'local')`
  (`revokeSessionByAccessToken`, ~498). No per-device registry exists.
- `backend/config/auth.js`: `signIn/signUp/signOut(token, scope='global')`
  wrappers over Supabase; `createAuthClient()` with persistSession=false.
- `supabase/config.toml`: `jwt_expiry = 3600`,
  `enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10`,
  `inactivity_timeout` commented out (not set).

iOS (`frontend/apps/ios/Pantopus/Core/Auth/`):
- `KeychainStore.swift`: KeychainAccess wrapper, service `app.pantopus.ios`,
  `.afterFirstUnlockThisDeviceOnly`, `.synchronizable(false)`. Keys:
  accessToken, refreshToken, userId, cachedUser (JSON snapshot for offline
  shell).
- `AuthManager.swift` (@Observable @MainActor singleton): `restoreSession()`
  reads access token from Keychain → GET /users/profile; 401 → APIClient
  silent refresh; if refresh rejected → signOut; transient errors keep the
  cached identity (offline-first). Single-flight refresh (`refreshTask`)
  because backend treats replay as TOKEN_REUSE. `lastInteractiveSignInAt`
  drives the app-lock offer. OAuth via ASWebAuthenticationSession
  (`AuthManager+OAuth.swift`, providers google/apple).
- Consequence: Keychain items usually survive uninstall on iOS, so today
  iOS may silently keep a session across reinstall *by accident* — with no
  design around it (no biometric gate, no trusted-device record).

Android (`frontend/apps/android/app/src/main/java/app/pantopus/android/data/auth/`):
- `TokenStorage.kt`: EncryptedSharedPreferences (`secure_auth_tokens`,
  MasterKey AES256_GCM from Android Keystore), keys access/refresh/user_id/
  user_json, legacy DataStore migration. File is EXCLUDED from Auto Backup
  and D2D transfer via `res/xml/backup_rules.xml` + `data_extraction_rules.xml`.
- `TokenAuthenticator.kt` (OkHttp Authenticator) + `AuthInterceptor.kt` +
  `AuthRepository.kt` (653 lines) + `OAuthSessionStore.kt`.
- Consequence: Android forgets the user completely on reinstall today.

Cross-platform:
- Recent commit 435c8fac "Claim pantopus.com for deep links on both
  platforms" → applinks / App Links exist; need to check whether
  `webcredentials:` (iOS) and `delegate_permission/common.get_login_creds`
  (Android assetlinks) are declared — required for Password AutoFill /
  passkeys / Credential Manager. Workflow docs-reader is checking.

## Decisions / direction (provisional, pending workflow results)

- Layered design: (1) server-side trusted-device registry + rotating refresh
  tokens (Supabase already rotates), (2) device-bound key (Secure Enclave /
  Android Keystore) as proof-of-possession for the restore path, (3) OS
  credential layer: passkeys + Password AutoFill (iOS) / Credential Manager +
  Restore Credentials/Block Store (Android) + Sign in with Apple/Google,
  (4) never rely contractually on Keychain-survives-uninstall; treat it as
  an accelerator with a biometric gate, not the mechanism.
- Answer to user's "is secure OS storage + cloud credentials + server-side
  sessions correct?": yes, that is the right trio; the missing fourth pillar
  is device attestation/binding (App Attest / Play Integrity + device keys)
  and a trusted-device registry with per-device revocation.

## Log

- 2026-08-18: scouted repo; read KeychainStore, TokenStorage, /refresh,
  /logout, AuthManager.restoreSession, supabase/config.toml. Launched
  workflow wf_6e56c9e8-511. Loaded artifact-design skill (for publishing).
  Created this worklog at user's request.
- 2026-08-18 (later): workflow finished (verifiers hit session limit); split
  results into workflow-raw/; hand-verified session_not_found + generateLink→
  verifyOtp; wrote WORKFLOW-RESULTS.md; wrote the design doc; built the HTML
  artifact (build-artifact.mjs), fixed TOC numbering + duplicate meta line,
  checked light/dark in the browser; published + republished (same URL).
  Nothing committed to git (user did not ask); all files are untracked under
  docs/persistent-login/.

## IMPLEMENTATION (started 2026-08-18, user asked to implement thoroughly)

### Decisions taken (user: "decide based on security, UX, future")
1. Reinstall = one gesture (L2), never silent — even on iOS.
2. `security_prefs` defaults: `{allowRestoreGrants:true, newDeviceEmail:true}`.
   `requireUnlockOnReinstall` dropped (L2 is always required, so it is moot).
3. Block Store cloud backup OFF (`setShouldBackupToCloud(false)`), same-device
   + D2D only.
4. Multi-account: registry is per (user, device) and the client "remembered
   accounts" store is a LIST (most recent first, max 3) so an account switcher
   is a UI increment later; ContinueAs shows the most recent account +
   "Use a different account". Switcher UI itself deferred.
5. Step-up for account deletion (and device revocation / revoke-all): the
   strongest method the account has — password if the account has one;
   otherwise biometric device step-up key enrolled in an INTERACTIVE session
   (never for `restored` sessions). Passkey/OAuth step-up methods reserved
   in the contract for later.
6. Inactivity: 90 d trusted / 30 d unverified, enforced at our /refresh.
7. iCloud-synced display hint: NOT now (privacy inventory cost, little gain
   because L3 AutoFill/SIWA already prefill). Revisit with passkeys.
8. Association files: Team ID for the native app is not in the repo
   (`project.yml` DEVELOPMENT_TEAM blank). AASA gets `6UYZBA546R.app.pantopus.ios`
   (same team as the Expo app — MUST be confirmed) + webcredentials; assetlinks
   gets a generator script + doc because the Play App Signing SHA-256 for
   `app.pantopus.android` is unknown; the legacy Expo entries are kept.

### Scope for this implementation pass
- Phase 0, Phase 1, Phase 2 of design §14 in full (backend + iOS + Android +
  web security page + association files + docs).
- Phase 3 partial: biometry-bound step-up keys (iOS SE `.biometryCurrentSet`,
  Android Keystore `setUserAuthenticationRequired`) + `/api/auth/step-up
  {device_key}`; DPoP enforcement stays `optional` (flag) — flip needs fleet data.
- NOT in this pass (need external accounts/portal work): App Attest / Play
  Integrity / key-attestation verifiers (contract + columns are in place,
  attestation_level stays 'none'), native SIWA / Credential Manager Google
  (`/oauth/native` endpoint IS implemented server-side), passkeys, Restore
  Credentials, Redis-backed limiters.

### Build/test commands (verified tooling present)
- backend: `cd backend && pnpm test` (jest 30) — CI runs `pnpm test` +
  `test:privacy` + identity-firewall tests (.github/workflows/ci.yml)
- iOS: `cd frontend/apps/ios && make test` (xcodegen + xcodebuild, Xcode 26.6
  local, CI uses Xcode 16.4), `make lint` (SwiftLint --strict, swiftformat --lint,
  verify-icons, verify-tokens hex-grep)
- Android: `cd frontend/apps/android && ./gradlew testDebugUnitTest` (JDK 17
  zulu at /Library/Java/JavaVirtualMachines/zulu-17.jdk); CI: android-ci.yml
- Migration numbering: next is `160_…sql` (159 is head).

### Progress checklist (update as you go)
- [ ] W1 backend: migration 160 + dpop.js + stepUp.js + services + /api/auth router
- [ ] W2 backend: users.js hooks (/login /oauth/* /refresh /logout /password
      /reset-password /reauthenticate DELETE /account), verifyToken, socket kick,
      notifications deviceId, tests
- [ ] W3 iOS core: DeviceKey, StepUpKey, DPoP, InstallMarker, KeychainStore keys,
      AuthManager states/resume/scopes, APIClient headers/pre-flight, endpoints/DTOs
- [ ] W4 iOS UI: ContinueAsView, DevicesView, LoginView prefill/.username,
      PantopusApp routing, AppLock pref → Keychain, entitlements + project.yml, tests
- [ ] W5 Android core: DeviceKeyStore, StepUpKeyStore, DPoP, DeviceIdentity,
      AccountHintStore (Block Store), TokenStorage, AuthRepository, TokenAuthenticator,
      AuthInterceptor, NetworkModule, AuthApi/DTOs, gradle deps, backup rules
- [ ] W6 Android UI: ContinueAsScreen, DevicesScreen, LoginScreen prefill/autofill,
      NavHost, AppLockManager crypto prompt/pref, tests
- [ ] W7 web: association files (+generator), /app/settings/security page,
      Next middleware refresh-before-clear fix, packages/api client for new endpoints
- [ ] W8 docs/compliance: docs/01, auth-backend-contracts, docs/07 supersede,
      privacy inventory, labels
- [ ] V1 verification: backend jest green; iOS build+tests+lint green;
      Android unit tests green; review pass; worklog updated

### Implementation bookkeeping rules
- Wire contract pinned in `CONTRACT.md` (wins over the design doc).
- Each implementer agent writes/updates `reports/<layer>-<stage>.md` WHILE it
  works (created first with status IN PROGRESS; files changed; done/not done;
  test commands run + results). If a session is cut off, those reports are
  the fine-grained resume points; this WORKLOG is the coarse one.
- Implementation workflow run ids are recorded in the Log below.
- 2026-08-18: IMPLEMENTATION workflow launched: run `wf_a2dbf3b4-421`
  (task wfetxum4w). Script:
  `~/.claude/projects/-Users-yingpengwang-native-pantopus/d0599ebb-c591-4208-84b2-06b8966fc392/workflows/scripts/persistent-login-implement-wf_a2dbf3b4-421.js`
  Transcripts: `.../subagents/workflows/wf_a2dbf3b4-421/` (journal.jsonl).
  Structure: parallel pipelines backend(core→hooks), iOS(core→ui→verify),
  Android(core→ui→verify), web+docs → conformance fixer → security review
  fixer → final verify (backend/iOS/Android). Each agent writes
  `reports/<name>.md` while working. If cut off: read reports/, then resume with
  `Workflow({scriptPath, resumeFromRunId:"wf_a2dbf3b4-421"})` (finished agents
  are cached) or continue by hand from the first report with Status != DONE.
- 2026-08-18: run wf_a2dbf3b4-421 DIED (all 14 agents: "session limit · resets
  3pm America/Vancouver") after ~1.1M tokens. PARTIAL WORK ON DISK (uncommitted):
  backend: migrations/160_auth_devices.sql, middleware/dpop.js, stepUp.js,
    routes/authDevices.js (mounted in app.js), services/authDeviceService.js,
    authSessionService.js, authNotifyService.js, config/authPolicy.js,
    pushService.js changes, jose added — NO tests yet, nothing run.
  iOS: Core/Auth/{AccountHint,AuthManager+Devices,AuthManager+Session,
    DPoPProofBuilder,DeviceDescriptor,DeviceKey,InstallMarker,StepUpKey}.swift,
    Models/Auth/AuthDeviceDTOs.swift, changes to AuthManager/KeychainStore/
    InMemorySecureStore/APIClient/AuthEndpoints/AuthDTOs/MultipartUploader —
    NOT compiled yet, no tests.
  Android: data/auth/{AccountHintStore,DPoPProofBuilder,DeviceDescriptorProvider,
    DeviceIdentity,DeviceKeyStore,EcKeyCodec,KeystoreBacking,PresenceVerifier,
    StepUpKeyStore}.kt, DeviceAuthDtos.kt, changes to AuthRepository/TokenStorage/
    AuthApi/AuthDtos/build.gradle.kts/libs.versions.toml — NOT compiled, no tests.
  web: steps 1-3 DONE + tested (see reports/web-docs.md); docs step 4 pending.
  reports/*.md for backend/ios/android are STALE ("none yet") — trust git
  status/diff over them.
- Relaunching the same script with a RESUME preamble (inspect on-disk work,
  continue, update report after every file).
- 2026-08-18: RELAUNCHED as run `wf_d624ae69-9e6` (task w1swrwcc2), same
  script file (now with RESUME preamble). Transcripts:
  `.../subagents/workflows/wf_d624ae69-9e6/`. If this dies too: read
  reports/*.md (agents now update them after every file), git status, and
  relaunch the same scriptPath again — the preamble makes every rerun
  incremental. Completed agents can be replayed with resumeFromRunId
  "wf_d624ae69-9e6".
- 2026-08-18: run wf_d624ae69-9e6 died too (13/14 agents, session limit
  "resets 9:50pm"); web+docs layer finished (reports/web-docs.md Status DONE:
  association files+generator, /app/settings/security page, api client,
  middleware refresh-before-clear + /session/refresh, docs/01, contracts,
  privacy inventory, labels; web jest 199/199, tsc clean).
  Backend: dpop/stepUp tests 55 PASS; authDeviceService.test.js exists;
  stage-2 hooks NOT started. iOS: core code complete, one build attempted,
  tests not written. Android: compileDebugKotlin BUILD SUCCESSFUL, tests
  written, not yet run; interceptors + NetworkModule + backup rules done.
- NEW STRATEGY: smaller checkpointed workflows, one stage per run.
  Stage A launched: run `wf_d56be0f3-873` (task wvef724yx), script
  `.../workflows/scripts/persistent-login-stage-a.js` = backend(core-finish →
  hooks) ‖ ios core-finish ‖ android core-finish. Next stages (to be composed
  the same way from the original script prompts): Stage B = ios:ui ‖
  android:ui; Stage C = ios:verify ‖ android:verify; Stage D = conformance;
  Stage E = security-review; Stage F = final verify ×3.
- Stage scripts pre-composed and syntax-checked (all in
  `~/.claude/projects/-Users-yingpengwang-native-pantopus/d0599ebb-c591-4208-84b2-06b8966fc392/workflows/scripts/`):
  persistent-login-stage-a.js (running), -stage-b.js (ios:ui ‖ android:ui),
  -stage-c.js (ios:verify ‖ android:verify), -stage-d.js (conformance),
  -stage-e.js (security review), -stage-f.js (final verify ×3).
  Launch each with `Workflow({scriptPath: <file>})` after the previous one
  reports; if one dies, relaunch the same scriptPath (agents resume from
  reports/ + git status).
- 2026-08-18: STAGE A DONE (run wf_d56be0f3-873, all 4 agents OK):
  backend stage 1+2 DONE — reports/backend-1-core.md + backend-2-hooks.md;
    `pnpm test` 219 suites / 3425 tests green, test:privacy OK; users.js hooks
    (/login /oauth/* /oauth/native /refresh /logout /password /reset-password
    /reauthenticate DELETE /account), verifyToken session checks, socket kick,
    notifications deviceId, prune job jobs/authRegistryPrune.js.
  iOS core DONE — reports/ios-1-core.md; full unit suite 3512/0, swiftlint
    --strict + swiftformat clean; project.yml applinks parity fixed.
  Android core DONE — reports/android-1-core.md; 105/105 unit tests,
    ktlint + detekt green; FCM rotation → registerDevice, session_revoked push.
  Checklist: W1 ✅ W2 ✅ W3 ✅ W5 ✅ W7 ✅ W8 ✅ (web-docs) — remaining W4 (iOS UI),
  W6 (Android UI), then conformance / security review / final verify.
- Launching Stage B (persistent-login-stage-b.js): ios:ui ‖ android:ui.
- Stage B launched: run wf_e7863be2-e9e (task w28arzf5y).
- CONTRACT.md: clarified DPOP_CUTOVER default semantics (far future ⇒ all legacy sessions adoptable until ops sets the ship date).
- 2026-08-18: Stage B run wf_e7863be2-e9e DIED (both agents, session limit
  "resets 2:50am"). Partial: Android AppLockManager → encrypted prefs +
  verifyPresence + promptWithCrypto, core/security/StepUpCoordinator.kt (new),
  AuthRepository stepUpWithDeviceKey 403→Unavailable; iOS stage 2: nothing
  on disk yet (report only). Relaunching stage B (same scriptPath).
- Stage B RELAUNCHED: run wf_4dafbba1-923 (task w5xnzjcc2).
- 2026-08-19: Stage B run wf_4dafbba1-923 died on the **Fable 5** model limit
  (session had been switched to Fable 5; subagents inherit the session model).
  Session is back on Opus 5. BUT both agents had already written essentially
  all of stage 2 before dying:
  iOS (reports/ios-2-ui.md): ContinueAsView(+VM), StepUpPasswordPrompt,
    LoginView remembered-account/security banner/.username, DevicesView(+VM),
    SettingsView route, PrivacyViewModel step-up delete, entitlements +
    project.yml webcredentials, Info.plist, tests (11+18+3+5). Ran
    `make bootstrap` only — build/test/lint NOT run.
  Android (reports/android-2-ui.md): ContinueAsScreen(+VM), StepUpHost,
    RootViewModel/NavHost wiring, LoginScreen prefill+autofill+banner,
    DevicesRepository/DevicesScreen(+VM), Settings route, AccountDeletion
    X-Step-Up, PushTokenSyncer deviceId. `:app:compileDebugKotlin` EXIT 0.
    Unit tests written (10+16+changes) but NOT run; ktlint/detekt NOT run.
  => Skipping a 3rd Stage-B relaunch; going straight to Stage C (verify),
  whose job is exactly build+test+lint+fix+self-review, with an explicit note
  that stage 2 was cut off during verification.
- 2026-08-19: Stage C launched: run wf_08e4e46b-e4a (task wsemesq03) — ios:verify ‖ android:verify, on Opus 5.
- 2026-08-19: my own (non-agent) spot review of the two highest-risk backend
  files while Stage C ran — both PASS:
  * middleware/dpop.js — typ/alg pinned (ES256 only, EmbeddedJWK), JWK must be
    a public P-256 key (rejects `d`, oct, non-EC => no alg/key confusion);
    htm+htu normalised compare with query/fragment stripped; iat +/-300 s;
    jti replay via DB UNIQUE insert-then-23505 (race-safe, not
    check-then-write) and burned LAST so an invalid proof cannot burn a good
    jti; rth compared with timingSafeEqual. Note: when PUBLIC_API_BASE_URL is
    unset htu falls back to the (spoofable) Host header — set it in prod; the
    residual risk is nil because the proof must still be signed by the bound
    key.
  * services/authDeviceService.checkRefresh — resolves the session FIRST
    (refresh-hash -> prev-hash -> sessionId), loads the device from the SESSION
    ROW (never from the client-supplied deviceId), then verifies the proof
    against THAT key => the "stolen token + attacker's own device row" attack
    fails. Bound session with no proof => DEVICE_MISMATCH. Missing device row
    => 503 AUTH_UNAVAILABLE (fail closed, no security wipe on a DB blip).
    Adoption gated on thumbprint + bound_at_issue=false + issued_at <
    DPOP_CUTOVER, exactly per CONTRACT.
- 2026-08-19: STAGE C DONE (run wf_08e4e46b-e4a, both agents OK).
  iOS (reports/ios-3-verify.md): make build OK; test build OK; CI-shape test
    run = 3550 tests / 168 skipped / 0 failures; swiftformat 0/1582;
    swiftlint --strict = only 6 PRE-EXISTING force_unwrapping in #Preview of
    untouched files; verify-icons + hex grep PASS. Fixed: LoginViewModel
    security banner reappearing after dismiss (real bug), dead
    Endpoint.adding(headers:), stale backend route doc-comments, 32 swiftlint
    violations, and iOS↔Android a11y-identifier parity (iOS renamed to match
    Android: settings.devices.*, auth.continueAs.root/.title,
    loginSessionEndBanner, loginRememberedAccountForget) + added the missing
    remove-confirmation dialog on ContinueAs.
    Known NOT-ours: verify-tokens.sh fails on 91 pre-existing files (zero
    overlap; CI does not run it); PantopusUITests has 35 pre-existing failures
    (CI skips that target deliberately).
  Android (reports/android-3-verify.md): the EXACT android-ci.yml quality job
    `./gradlew ktlintCheck detekt :app:lintDebug test paparazziVerify
    :app:assembleDebug --continue` => BUILD SUCCESSFUL, exit 0.
    Unit tests 365 classes / 3476 tests / 0 failures; paparazziVerify no drift.
    Fixed: Int overflow in DevicesViewModelTest day math; lint NewApi x4
    (StrongBoxUnavailableException referenced from minSdk-26 bytecode);
    ktlint/detekt items; PLUS two self-review defects — RootViewModel.onAppStart
    discarded the ON_START refresh outcome (now signs out with the backend
    reason so the banner shows; new RootViewModelTest) and StepUpCoordinator
    could starve OkHttp's 5 per-host slots under a burst of concurrent 403s
    (single-permit slot added).
  Checklist: W1..W8 ALL ✅. Remaining: Stage D conformance, Stage E security
  review, Stage F final CI-equivalent verify.
- 2026-08-19: Stage D launched: run wf_5ba434d4-5c3 (task wgmp3eaqa) — cross-layer conformance.
- 2026-08-19: STAGE D DONE (run wf_5ba434d4-5c3). 6 discrepancies found, 6
  fixed; NO wire-format break existed (DPoP shape, step-up token, error
  envelope + all 10 401 codes, device descriptor, every /api/auth
  request/response, storage keys, L1->L2->L3 and sign-out proof already
  agreed byte-for-byte across all 4 layers).
  Fixes: (1) REAL GAP — Android SocketManager never bound `auth:session_revoked`
  (iOS did), so a remotely-revoked Android user kept a live-looking UI until
  the next 401; added listener + sessionRevoked SharedFlow -> RootViewModel ->
  confirmSessionRevoked() (a /refresh probe; the socket is never the authority).
  (2) security-event vocabulary drift in ALL THREE clients vs the backend's 21
  recordSecurityEvent types (dead keys + missing *_email_sent / revoke_others /
  session_revoked); unified key sets, per-layer copy kept, each now has a
  vocabulary test. (3) iOS sent an inert DPoP header on /api/auth/step-up
  (Bearer-only route) — removed. (4) DPOP_CUTOVER comment in authPolicy.js was
  backwards (comment only). (5) Android non-security session-end banner copy
  aligned to iOS verbatim.
  Verify: backend auth suites 206/0; web 200/0 + tsc clean; Android targeted
  124/0 + ktlint/detekt SUCCESSFUL; iOS make build OK + 91/0 auth tests +
  swiftlint/swiftformat clean.
  Deliberate asymmetries NOT to "fix": /api/auth/resume + resumeGrant are
  Android-only; web never sends DPoP and is exempt from DPOP_REQUIRED in every
  mode.
  OPS BEFORE FLIPPING AUTH_DEVICE_BINDING=required: set PUBLIC_API_BASE_URL
  and DPOP_CUTOVER.
- 2026-08-19: Stage E launched: run wf_64da43ba-bd8 (task ww1yh2avd) — adversarial security review + fixes. Also clarified event.deviceId semantics in CONTRACT.md (row id, joins devices[].id).
- 2026-08-19: COMMITTED + PUSHED to origin/persistent-login (5 commits:
  bf3abf3e docs, 5bdcee1a backend, e6640b9d ios, a4bf493c android,
  b6bec6c8 web+docs). Full backend suite re-run before committing:
  220 suites / 3451 tests / 0 failures.
  Stage E (security review) had DIED on a session limit but had already
  landed S1-S5 fixes + regression tests (auth suites 214/0); its report
  header still says IN PROGRESS — the remaining work is only its own
  write-up plus items S6+ it never reached. Stage F (final CI-equivalent
  verify) has NOT been run; CI on the pushed branch now covers it.
- 2026-08-19: Stage E+F COMBINED launched: run wf_a2bea3f0-e2b (task w2d18qi6g),
  script `.../workflows/scripts/persistent-login-stage-ef.js`.
  Sequential: security-review (with explicit resume context — verify S1-S5 are
  really in the tree, continue the threat model beyond them, finish the
  write-up) THEN final verify x3 in parallel (backend pnpm test + test:privacy,
  iOS make bootstrap/build/test/lint, Android full android-ci.yml quality job).
  Agents were told NOT to git commit; the parent session commits.

## FINAL STATE (2026-08-20)

Stage E+F run wf_a2bea3f0-e2b: ALL 4 AGENTS COMPLETED. Everything pushed to
origin/persistent-login (9 commits total, 212 files, +37685/-685 vs master).

Stage E (security review) — Status DONE. S1-S5 (first pass, already committed)
re-verified present and correct in the tree; S4's fix had no test for the
branch it introduced — added. SIX NEW findings, all fixed + regression tests:
  S6  HIGH     /oauth/token could rebind a victim's live session to a thief's
               key and rotate their AuthDevice row (bearer-only path).
  S8  HIGH     PRE-EXISTING: /reset-password JWT branch accepted ANY valid
               access token as a reset credential => stolen bearer = full
               takeover (+ lockout, once the new reset hook landed).
  S7  MED      client-declared X-Token-Transport was the required-mode
               exemption => header+cookie opted a stolen unbound token out.
  S10 LOW-MED  req.ip written raw into inet columns; an unvalidated hop
               ("unknown"/planted) failed the write and lost the session row.
  S9  LOW      control chars in device name/model => log-record forgery.
  S11 LOW      unset PUBLIC_API_BASE_URL makes DPoP htu trust the Host header
               (warning + doc, not fail-closed).
Each fix proven to matter by neutralising it and re-running (S6 4/7 fail,
S7 6/8, S8 3/5).

Stage F (final verification) — all three layers GREEN:
  backend  220 suites / 3479 tests / 0 failures; test:privacy all gates PASS;
           identity-firewall 10 suites / 60 tests. (I re-ran the full suite 6x
           myself: 5 clean, 1 single-test failure I could NOT reproduce or
           name — treat as a suspected flake, watch CI.)
  iOS      make build OK; CI gate 3551 tests / 0 failures; swiftformat clean.
           Pre-existing only: 6 UI-test failures (CI skips that target),
           verify-tokens 505 violations across 91 files (empty intersection
           with the 53 feature files), 6 swiftlint force_unwrapping in
           #Preview of untouched files (local 0.63.2 vs CI-pinned 0.63.3).
  Android  full CI quality job BUILD SUCCESSFUL: ktlint, detekt (0 issues),
           lintDebug 0 errors, 3477 unit tests debug+release / 0 failures,
           paparazziVerify no drift, assembleDebug OK.

CARRIED FORWARD (not done, deliberate):
  - in-process rate limiters + jti store must move to a shared store before
    AUTH_DEVICE_BINDING=required on a multi-instance fleet.
  - pushService.saveToken upserts on `token` alone => registering another
    account's push token re-points that row; needs a (user_id, token) unique
    constraint + migration.
  - keyBacking is self-asserted until attestation ships (v1 limitation).
  - OPS before flipping required mode: set PUBLIC_API_BASE_URL and DPOP_CUTOVER.
  - Out of scope this pass: App Attest / Play Integrity / key attestation,
    native SIWA + Credential Manager Google (endpoint exists server-side),
    passkeys, Android assetlinks fingerprint (needs Play App Signing SHA-256;
    tools/gen-association-files.mjs is ready).
  - NOT validated: migration 160 against a real database; no end-to-end run
    against live Supabase; no on-device reinstall test.

## CI / PR (2026-08-20)

PR #351 "Persistent login" is OPEN on branch persistent-login.

REAL BUG CAUGHT BY CI THAT LOCAL VERIFICATION MISSED:
  Android CI run 32284730161 failed at the "Instrumented tests (emulator)" job:
  `LoginScreenTest > submit_button_enables_once_form_is_valid` threw
  `kotlin.KotlinNothingValueException` and crashed the whole instrumentation
  process ("Instrumentation run failed due to Process crashed").
  ROOT CAUSE: `StateFlow.collect` is declared to return `Nothing` (it never
  completes). A mockk `relaxed = true` stub returns normally instead, so the
  compiler-inserted check throws — inside `viewModelScope` on
  Dispatchers.Main, which kills the process rather than failing one test.
  LoginViewModel gained `rememberedAccounts` + `sessionEndReason` collections
  (LoginViewModel.kt:119,124); the UNIT test was updated to stub them
  (LoginViewModelTest.kt:50-51) but the INSTRUMENTED test was not — and
  androidTest only runs on an emulator, which the local passes never used
  (`testDebugUnitTest` only). Fixed in 7e4a767d via a shared `repoMock()`
  helper that stubs every collected flow.
  LESSON: `./gradlew test` does NOT cover `app/src/androidTest`. Any ViewModel
  that gains a new collected flow must have BOTH its unit and instrumented
  mocks updated.

DELIBERATELY NOT FIXED — `pushService.saveToken` upsert-on-token:
  the security review suggested a `(user_id, token)` unique constraint. On
  reflection that is NOT obviously correct: today one push token maps to
  exactly one user, so a device that switches accounts correctly re-points.
  Adding (user_id, token) would let two users share a token and send user A's
  notifications to a device now owned by user B — worse than the current
  behaviour. Needs a product decision about shared/handed-over devices, not a
  rushed migration. Left as a documented follow-up.

### The backend "flake" — IDENTIFIED (2026-08-20)

Earlier I reported 1 unexplained single-test failure in 6 full-suite runs and
flagged it rather than accept a green retry. Chased it down:

  FAIL tests/unit/gigBrowseSections.test.js
    ● GET /api/gigs/browse › returns total_active and radius_used in response
      socket hang up

Reproduced 1 time in 8 full-suite runs; 0 failures in 12 ISOLATED runs of that
file. So it only fails under full-suite parallel load — a supertest/agent
teardown race ("socket hang up"), i.e. worker contention, not a logic bug.

PRE-EXISTING AND UNRELATED TO THIS BRANCH:
  - the test file was last modified in commit 79086121 (2026-05-13), which is
    an ancestor of master;
  - `git diff --name-only master..HEAD` contains neither
    backend/tests/unit/gigBrowseSections.test.js nor routes/gigs*.js;
  - it is a gigs-browse endpoint test — nothing to do with auth.
NOT an auth flake. Left alone deliberately: fixing someone else's supertest
teardown is out of scope for this branch. Worth a separate ticket
(the whole suite runs with `--forceExit`, which is the underlying smell).
