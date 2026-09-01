# Persistent login — workflow results (distilled)

Run `wf_6e56c9e8-511`, 2026-08-18. Raw agent outputs live in `workflow-raw/`
(`backend.md`, `ios.md`, `android.md`, `docsAndConfig.md`, `platform.md`,
`design-0.md` = "Anchor" security-first, `design-1.md` = "Welcome Back"
convenience-first, `design-2.md` = "Pantopus Anchor" pragmatic,
`judgements.md`, `verdicts.json`). 11/18 agents completed; 7 verifiers failed on
a session limit — verification of the load-bearing claims was then done by hand
(see §4).

## 1. What the code readers established (beyond WORKLOG "Facts")

Backend
- No per-device record of any kind. Only `PushToken {user_id, token, platform,
  provider}` (migrations 086 + 152) — no device id / last-seen / session link.
- `/logout` is unauthenticated, revokes only the presented access JWT
  (`admin.signOut(token,'local')`). No "sign out everywhere", no session list.
- Password change / reset do NOT invalidate other sessions.
- `/reauthenticate` returns only `{verified:true}` — no server-side step-up
  assertion; `DELETE /account` requires only verifyToken.
- `verifyToken` = `supabase.auth.getUser(token)` network call per request
  (no local JWT verify), 60 s in-process role cache. Sockets authenticate with
  `supabaseAdmin.auth.getUser(handshake.auth.token)`.
- Refresh reuse detected only by regexing GoTrue error text
  (`/already used|not found/i`). Supabase `[auth.sessions]` timebox /
  inactivity_timeout are commented out → mobile refresh tokens never expire.
- Rate limiting is in-memory per-IP express-rate-limit (not multi-instance safe).
- Backend already uses `admin.generateLink()` → `properties.hashed_token` →
  `verifyOtp({token_hash})` (users.js ~990-1067, 3098-3200) — the same primitive
  can mint a session server-side for a custom credential.

iOS
- Reinstall today = **accidental silent Level-1 restore** (Keychain
  `afterFirstUnlockThisDeviceOnly` survives uninstall; `restoreSession()` has no
  first-launch marker; the app-lock preference in UserDefaults is wiped, so a
  previously locked account comes back unlocked).
- `signOut()` is local-only (no `/logout` call, no APNs unregister, no URLCache
  purge). Refresh is 401-reactive only; `expiresIn/expiresAt` decoded, never used.
- No SE key, no App Attest/DeviceCheck, no device id header, no native SIWA
  (browser OAuth via ASWebAuthenticationSession), no `webcredentials:`
  entitlement, no `keychain-access-groups`.
- BUG: `xcodegen generate` (`make bootstrap`) rewrites `Pantopus.entitlements`
  from `project.yml` (lines 140-152) which lists only `pantopus.app` applinks —
  it silently drops the `pantopus.com` entries added in commit 435c8fac
  (verified in a scratch copy).

Android
- Nothing survives uninstall (Keystore master key wiped + prefs excluded from
  backup/D2D + `allowBackup=false`). No Block Store, no Credential Manager, no
  Play Integrity, no device id, no per-device key. `security-crypto` pinned at
  1.1.0-alpha06 (deprecated).
- `signOut()` local-only. Refresh via OkHttp `TokenAuthenticator` (static lock
  single-flight, MAX_ATTEMPTS=2), dedicated `@Named("authRefresh")` client.
- Login form has no autofill ContentType hints.

Docs / web / association files
- **AASA and assetlinks.json target the old Expo identifiers**
  (`6UYZBA546R.com.pantopus.app`, `com.pantopus.app`), not the native apps
  (`app.pantopus.ios`, `app.pantopus.android`); assetlinks lacks
  `delegate_permission/common.get_login_creds`. → Universal Links, App Links
  verification, iOS Password AutoFill/passkeys and Android Credential Manager
  cannot work for the native apps until regenerated. Files live in
  `frontend/apps/web/public/.well-known/` (Content-Type forced in next.config.js).
- RN-era decision (docs/07 §381-418, deep-dive §7): an AsyncStorage install
  sentinel WIPED the Keychain session on reinstall. Native has no sentinel. The
  new design must explicitly supersede this.
- Two-tier biometric model is documented (Tier-1 app unlock w/ passcode
  fallback; Tier-2 sensitive-action strong biometric, 5-min grace, password
  reauth fallback). Native lost SensitiveScreenGuard on Wallet/Payments (parity
  gap).
- Privacy inventory (docs/compliance/privacy-data-inventory.md §6) has a
  change-control rule: any new identifier (device id) → update inventory + App
  Store / Play labels.
- Web: Next middleware clears cookies on stale session before attempting
  refresh (known gap); web refresh cookie 7 d vs mobile indefinite.

## 2. Platform facts (all high confidence unless noted; sources in platform.md)

- iOS Keychain items survive uninstall (same Team ID); Apple DTS: implementation
  detail, not a contract (iOS 10.3 betas once wiped them; rolled back). Last DTS
  confirmation iOS 17.5. Apple's own recipe for deterministic behaviour: pair
  with a sandbox-stored marker.
- Secure Enclave key references survive reinstall on the same device; never
  migrate to a new device; can sign challenges (ES256); can be gated with
  `.biometryCurrentSet` (invalidated on biometric re-enrolment).
- App Attest keys do NOT survive reinstall; attest once per key; assertions
  unlimited; DeviceCheck 2 bits persist across reinstall/erase (per-team).
- iOS passkeys/Password AutoFill need `webcredentials:<domain>` entitlement +
  AASA. iOS 18 automatic passkey upgrade (`.conditional`). No API to upgrade
  SIWA → passkey.
- Android Block Store: ≤16 entries × 4 KB; persists across same-device
  uninstall/reinstall ONLY when Google Backup is enabled; E2EE needs screen
  lock; `setShouldBackupToCloud` opt-in; latest artifact 16.4.0.
- Android Credential Manager **Restore Credentials** does NOT survive a plain
  same-device uninstall (uninstall deletes the restore key); it is for
  new-device / D2D restore only.
- Android Keystore keys are wiped on uninstall (PackageManager
  `clearKeystoreData`). StrongBox + key attestation available; Play Integrity
  standard requests, 10k/day default quota; Device Recall (beta) 3 bits persist
  across reinstall.
- Supabase: rotation on, 10 s reuse interval, refresh tokens never expire on
  their own; access JWT carries `session_id`; **no admin API to list/revoke a
  specific user's sessions** (only `admin.signOut(jwt, scope)`, or touching
  `auth.sessions` directly); `session_not_found` when the session row is gone;
  Pro-plan `timebox` / `inactivity_timeout` / `single_per_user`.
- Supabase passkeys: PRIMARY factor since 2026-05-28 (beta, opt-in);
  supabase-swift 2.48+; supabase-kt has scaffolding but no sign-in yet.
- `signInWithIdToken` for apple/google (native SIWA / Credential Manager).
- DPoP = RFC 9449 (Standards Track): the standards way to bind refresh tokens
  to a device key. OWASP MASVS: cryptographic (not boolean) biometric gating.
- (medium) GoTrue master has a v2 counter-based refresh algorithm with
  `sb-auth-refresh-token-reuse*` headers — check which the hosted project runs.

## 3. Designs and judgement

| Design | Sec | Conv | Feas | Judge 1 (security) | Judge 2 (product) |
|---|---|---|---|---|---|
| 0 Anchor (security-first): K_dev + K_step SE keys, DPoP w/ nonce, App Attest/Play Integrity/key attestation, `restored` session context, LISTEN/NOTIFY revocation, 15-min JWTs, 8 tables | 8-9 | 6-7 | 4-5 | 20 | 19 |
| 1 Welcome Back (convenience-first): silent iOS reinstall, Block Store one-tap Android, trust levels, security_prefs, per-session rows w/ refresh_token_hash, own WebAuthn RP, Restore Credentials | 6-8 | 9 | 5-6 | 20 | **23 (winner)** |
| 2 Pantopus Anchor (pragmatic): one AuthDevice registry + ES256 DPoP on /refresh, `sessions_valid_after`, hashed single-use resume grants (Block Store, no cloud), "reinstall is never L1 and never a wipe", keeps getUser for immediate revocation, 5 tables, flag-gated | 7 | 7 | 8 | **22 (winner)** | 22 |

Consensus: take **Design 2 (Pantopus Anchor) as the core** and graft:
- from Design 0: bind-at-issue-only rule (no bearer-only endpoint may create or
  rotate a binding); refresh pre-check by *session* (resolve session → bound key,
  then verify DPoP against THAT key); biometry-bound step-up key (K_step) with a
  passcode/DEVICE_CREDENTIAL fallback; `restored` session context for
  grant-minted sessions (no money / credential changes until a real credential
  is presented once); security events + email/push + "lockdown"; per-device
  rate limits in a shared store; App Attest re-attest on iOS reinstall.
- from Design 1: `AuthSession` rows keyed by JWT `session_id` (web sessions
  visible from Phase 1) with `refresh_token_hash`/`prev_hash`; trust levels
  (trusted/unverified/suspect) as policy inputs, never hard blocks;
  `security_prefs` (`requireUnlockOnReinstall`, `allowRestoreGrants`,
  `newDeviceEmail`); enumerated first-launch UI states; socket kick on revoke;
  Phase-0 polish (structured 401 codes, autofill hints, `.username`,
  asset_statements, telemetry SLOs).

Concerns both judges raised on the winner (all folded into the final design):
- session re-binding hole via `/devices/register` (fix: bind only at issuance);
- refresh pre-check keyed by client-supplied deviceId (fix: by session);
- client-claimed `keyBacking`/biometric before attestation (fix: `restored`
  context + attestation moved earlier);
- unauthenticated `/logout` acting on device rows (fix: require proof for side
  effects; only cookie clearing stays unauthenticated);
- no per-session rows / no `restored` downgrade / in-memory limiters;
- Block Store grant must not be cloud-backed by default; new-device email
  dedupe only on proven lineage;
- timelines optimistic; make Phase 0 + Phase 1 the committed deliverable.

## 4. Verification of load-bearing claims (done by hand after verifiers failed)

| Claim | Status | Evidence |
|---|---|---|
| Supabase returns `session_not_found` once the `auth.sessions` row is deleted | **Confirmed** | supabase.com/docs/guides/auth/debugging/error-codes: "…or the session entry in the database was deleted in some other way" |
| `generateLink` → `hashed_token` → `verifyOtp({token_hash})` mints a session server-side without email | **Confirmed in our own code** | backend/routes/users.js:990-1067, 3098-3200 ("verifyOtp may establish a session…") |
| Keychain / SE key survive reinstall; App Attest keys don't; Keystore keys don't; Block Store needs Backup on; Restore Credentials ≠ same-device reinstall | Confirmed by researcher w/ primary sources | platform.md |
| `postgres`-owned SECURITY DEFINER may `DELETE FROM auth.sessions` on hosted Supabase | **Unverified** | Design therefore does NOT depend on it: primary revocation = our own registry check in verifyToken + our /refresh gate; auth.sessions deletion is optional belt-and-braces to be tested on the project |
| Anon key absent from mobile bundles (else DPoP at our proxy is bypassable via /auth/v1/token) | Reader: mobile talks only to Express | Make it a CI-enforced invariant; audit web bundle |
| Which GoTrue refresh algorithm (v1 vs v2) the hosted project runs | Unverified | Design tolerates both (session-id + refresh_token_hash/prev_hash lookup; log `sb-auth-refresh-token-reuse*` headers) |
