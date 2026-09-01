# Anchor: device-anchored sessions and a trusted-device registry for Pantopus

THESIS: Turn every mobile session into a device-anchored session: a non-exportable P-256 key in the Secure Enclave / Android Keystore (StrongBox when present) is the device's identity, every refresh must carry a DPoP-style proof from that key, and a Pantopus-owned trusted-device registry (keyed by the Supabase `session_id` claim) makes sessions listable, nameable and revocable per device. Convenience comes from three explicit UX levels that are chosen by evidence, not by accident: (1) "still logged in" silent restore when the sandbox install-sentinel, the device key and an active device-session all agree; (2) "Continue as Ying" + a biometric that is cryptographically bound to a second SE/Keystore key (`biometryCurrentSet` / `setUserAuthenticationRequired`) whenever continuity is only partial (iOS reinstall, Android Block Store restore, dormant session, security downgrade); (3) "the OS remembers you" (Password AutoFill, native Sign in with Apple, Google Credential Manager, later passkeys) when nothing app-side survives. Reinstall-on-same-device is safe because the thing that survives is never a bare bearer secret that works elsewhere: on iOS the refresh token that outlives the uninstall is useless without the SE key that also outlived it and cannot leave the chip, and the app additionally re-attests (App Attest) and demands a biometric-bound step-up before it resumes; on Android nothing survives except an opt-in, E2EE Block Store restore grant that is single-use, hashed at rest, only redeemable with a Play-Integrity-verified fresh install plus a biometric-bound new key, and yields a "restored" session that cannot move money until the user proves a strong credential once. Blast radius of any single leaked secret (refresh token, access token, DB row, Block Store blob) is bounded to one device for at most one access-token lifetime, and every session can be killed from any other signed-in surface within seconds.

# Anchor — persistent login, reinstall recovery, trusted devices

## 0. Goals / non-goals

**Goals**
- G1 Reinstall on the same device gets the user back in with one gesture (biometric) or zero gestures when it is provably the same device *and* the same install lineage.
- G2 No refresh or access token is ever usable off the device it was issued to (sender-constrained tokens, RFC 9449 DPoP semantics).
- G3 Every session is enumerable and revocable per device from any signed-in surface (iOS, Android, web) and by support; password reset / compromise signals revoke everything.
- G4 Sensitive actions (payout/bank changes, password/email change, device revocation, account deletion) require a *server-verified* recent strong auth (step-up), not a client-side boolean.
- G5 Stolen-device and SIM-swap resistance: no SMS factor anywhere; biometric re-enrollment invalidates step-up keys; remote wipe of a device's session + push tokens.
- G6 Minimal blast radius: DB leak exposes only public keys and hashes; a leaked refresh token is inert without the SE/StrongBox key; access tokens are short.
- G7 Everything phased and independently shippable; old clients keep working until the enforcement phase.

**Non-goals**
- Web persistent login redesign (web keeps httpOnly cookies; it only gains a device row, revocation and step-up; DBSC noted as future).
- Phone-number identity / SMS OTP (T6 decision stands: email-only v1; deliberately no SMS anywhere in this design).
- Cross-device migration of sessions (new phone from backup) beyond what Level 3 gives; Android Restore Credentials is a stretch item.
- Replacing Supabase Auth. We wrap it: GoTrue stays the token issuer, Pantopus owns device trust.

## 1. The three UX levels and when each is used

| Level | What the user sees | Precondition (all must hold) | Server-side effect |
|---|---|---|---|
| **L1 Still logged in** | Splash -> home. No prompt (App-Lock Tier-1 biometric may still show if the user enabled it). | sandbox install-sentinel present AND matches keychain/prefs copy; device key `K_dev` usable; refresh token present; device-session `active`; last refresh < 30 days; no `require_step_up` flag | ordinary DPoP-bound `/refresh` |
| **L2 App remembers account** | "Continue as Ying (y…@gmail.com)" card with avatar + [Use Face ID / fingerprint] + [Not you? Sign in]. | account hint present AND (iOS: sentinel missing/mismatched but `K_dev` + refresh token survived; OR dormant > 30 d; OR server set `require_step_up`; OR `K_step` biometry invalidated) / (Android: Block Store restore grant present after reinstall; OR dormant; OR `require_step_up`) | `POST /api/auth/session/resume` (iOS) or `POST /api/auth/restore/redeem` (Android). Session tagged `restored` or `interactive` accordingly |
| **L3 OS remembers account** | Login screen with the OS credential sheet: iOS Password AutoFill / passkey QuickType, native Sign in with Apple; Android Credential Manager (saved password, Sign in with Google, passkey). One tap. | nothing app-side survived, or the user chose "Not you", or session revoked/TOKEN_REUSE, or device untrusted | normal `/login`, `/oauth/idtoken`, later `/api/auth/passkeys/*` -> new device enrollment |

Selection is a pure function computed at cold start (`SessionBootstrap` on both platforms) from local evidence; the server independently re-derives the allowed level from the device-session row, so a tampered client can never upgrade itself.

Reasoning behind the split: L1 needs proof of *install lineage* (sentinel), *device* (K_dev) and *user intent to stay signed in* (an active device-session the user never revoked). Reinstall removes the first, so we drop exactly one level and ask for the cheapest thing that proves user presence with cryptographic backing (K_step). Only when the device cannot prove anything do we lean on the OS credential store, which is phishing-resistant (passkeys/SIWA) or at least domain-associated (AutoFill).

## 2. Components

```
                +----------------------------------------------------------------------+
                |                              Backend (Express)                        |
                |                                                                       |
  iOS app       |  routes/users.js  (login/oauth/refresh/logout/password/account: hooks) |
  ┌──────────┐  |  routes/authDevices.js  (NEW: /api/auth/*)                             |
  │K_dev  SE │  |  middleware/verifyToken.js (+local JWT decode, session/device check)    |
  │K_step SE │  |  services/deviceTrust.js   (NEW: registry, DPoP verify, revocation)     |
  │AppAttest │──┼─>services/attestation/{appAttest,playIntegrity,androidKeyAttest}.js     |
  │Keychain  │  |  services/stepUp.js        (NEW: step-up grants)                        |
  │sentinel  │  |  services/securityEvents.js (NEW: audit + notify)                       |
  └──────────┘  |          |                         |                                    |
                |          v                         v                                    |
  Android app   |   Supabase Postgres          Supabase Auth (GoTrue)                     |
  ┌──────────┐  |   public.auth_device         auth.sessions / auth.refresh_tokens        |
  │K_dev KS  │──┼─> public.auth_device_session   (session_id claim is the join key)       |
  │K_step KS │  |   public.auth_restore_grant  admin.signOut / generateLink+verifyOtp     |
  │PlayInteg.│  |   public.auth_step_up_grant                                            |
  │BlockStore│  |   public.auth_security_event  Apple App Attest / DeviceCheck            |
  │EncPrefs  │  |   public.auth_dpop_replay      Google Play Integrity / decodeIntegrityToken|
  └──────────┘  |   PushToken(+device_id)                                                |
                +----------------------------------------------------------------------+
  Web (cookies) ──> same middleware; gets a `web` device row (UA-derived name), no DPoP in v1
```

**Client-side primitives (both platforms)**
- `K_dev` – P-256 signing key, non-exportable, *not* user-auth-gated (must sign in background). iOS: `SecureEnclave.P256.Signing.PrivateKey` (CryptoKit, iOS 17 target) with `SecAccessControl(.privateKeyUsage)`, accessibility `afterFirstUnlockThisDeviceOnly`; the SE key's keychain reference survives uninstall in practice. Android: `KeyGenParameterSpec` EC P-256, `PURPOSE_SIGN`, `setIsStrongBoxBacked(true)` with fallback, `setAttestationChallenge(challenge)`, no user auth; does *not* survive uninstall (Keystore wiped by PackageManager).
- `K_step` – P-256 signing key that *requires the current biometric set*. iOS: `SecAccessControl(.privateKeyUsage | .biometryCurrentSet)`, `whenPasscodeSetThisDeviceOnly` (destroyed if passcode removed, invalidated on Face ID re-enrollment). Android: `setUserAuthenticationRequired(true)`, `setUserAuthenticationParameters(0, AUTH_BIOMETRIC_STRONG)`, `setInvalidatedByBiometricEnrollment(true)`, used through `BiometricPrompt` + `CryptoObject(Signature)`.
- Attestation – iOS `DCAppAttestService` (key generated per install; re-attest after every reinstall), Android Play Integrity standard request (warm-up at cold start, `requestHash` = SHA-256 of the enrollment payload) plus Keystore key attestation chain for `K_dev`.
- Install sentinel – 32 random bytes written to the app sandbox (iOS: Application Support file with `.completeUntilFirstUserAuthentication`, mirrored into the Keychain item `installSentinel`; Android: file in `filesDir`, mirrored into encrypted prefs). Sandbox missing but keychain/prefs copy present == reinstall.
- Account hint – non-secret `{userId, displayName, maskedEmail, avatarUrl, lastSignInAt}`. iOS: Keychain item `accountHint` (survives reinstall). Android: Block Store slot `hint` (survives only with Backup on) + encrypted prefs.
- Token store – unchanged homes (iOS Keychain `afterFirstUnlockThisDeviceOnly` non-sync; Android EncryptedSharedPreferences, backup-excluded) but with new keys: `deviceId`, `sessionId`, `expiresAt`, `dpopNonce`, `installSentinel`, `accountHint` (iOS) / `restore_grant` (Android, Block Store only).

## 3. Data model (Supabase Postgres, `public` schema, RLS `service_role` only, like PushToken)

```sql
create table auth_device (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  platform              text not null check (platform in ('ios','android','web')),
  display_name          text,             -- "Ying's iPhone 15 Pro", "Pixel 8", "Chrome on macOS"
  model                 text, os_version text, app_version text,
  install_id            uuid,             -- rotates on reinstall; lets us count reinstalls
  dev_key_jwk           jsonb,            -- K_dev public key (P-256), null for web
  dev_key_thumbprint    text unique,      -- RFC 7638 jkt; the DPoP binding key id
  step_key_jwk          jsonb,            -- K_step public key, null until enrolled
  step_key_thumbprint   text,
  step_key_enrolled_via text check (step_key_enrolled_via in ('interactive','restore')),
  attestation_kind      text check (attestation_kind in ('app_attest','play_integrity','key_attestation','none')),
  attestation_status    text not null default 'unverified' check (attestation_status in ('verified','unverified','failed')),
  attestation_meta      jsonb,            -- app_attest: {keyId, receipt(b64), counter, riskMetric}; play: {deviceIntegrity, appIntegrity, evaluatedAt}
  trust_state           text not null default 'pending' check (trust_state in ('trusted','pending','untrusted','revoked','compromised')),
  require_step_up       boolean not null default false,   -- server-forced downgrade to L2 on next open
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  last_ip inet, last_ua text, last_geo jsonb,
  revoked_at timestamptz, revoked_reason text, revoked_by uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index on auth_device (user_id) where trust_state not in ('revoked','compromised');

create table auth_device_session (
  id                    uuid primary key default gen_random_uuid(),
  device_id             uuid not null references auth_device(id) on delete cascade,
  user_id               uuid not null,
  supabase_session_id   uuid not null unique,  -- JWT `session_id` claim; stable across rotation
  status                text not null default 'active' check (status in ('active','revoked','compromised','expired')),
  context               text not null check (context in ('interactive','restored','oauth')),
  last_strong_auth_at   timestamptz,           -- password/passkey/K_step(interactive) time; drives step-up freshness
  last_refresh_at       timestamptz, refresh_count int not null default 0,
  dpop_nonce            text,                  -- current server nonce for this session
  prev_dpop_nonce       text,                  -- tolerate one fail-to-save
  created_at timestamptz default now(), revoked_at timestamptz, revoked_reason text
);
create index on auth_device_session (device_id, status);

create table auth_restore_grant (            -- Android Block Store restore ticket
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references auth_device(id) on delete cascade,
  grant_hash text not null unique,             -- sha256(secret); secret only ever lives in Block Store
  created_at timestamptz default now(), expires_at timestamptz not null,   -- 90 days
  consumed_at timestamptz, consumed_by_device_id uuid, consumed_ip inet
);

create table auth_step_up_grant (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, device_session_id uuid not null references auth_device_session(id) on delete cascade,
  method text not null check (method in ('password','passkey','device_key','reauth_oauth')),
  purpose text,                                -- optional narrowing: 'payout','delete_account',...
  expires_at timestamptz not null,             -- now()+5 min
  consumed_at timestamptz, created_at timestamptz default now()
);

create table auth_challenge (                  -- for App Attest / Play Integrity / K_dev / K_step
  id uuid primary key default gen_random_uuid(),
  nonce bytea not null, purpose text not null,  -- 'enroll','resume','step_up','restore'
  user_id uuid, device_id uuid, ip inet,
  expires_at timestamptz not null, consumed_at timestamptz
);

create table auth_dpop_replay ( jti text primary key, expires_at timestamptz not null );  -- 5-min TTL, cron-pruned (or Redis SETNX)

create table auth_security_event (
  id bigserial primary key,
  user_id uuid not null, device_id uuid, device_session_id uuid,
  type text not null,   -- login, new_device, refresh_reuse, dpop_mismatch, device_revoked, revoke_all, password_changed, password_reset,
                        -- step_up, restore_redeemed, resume, attestation_failed, logout, account_deleted, biometry_invalidated
  ip inet, ua text, meta jsonb, created_at timestamptz default now()
);
create index on auth_security_event (user_id, created_at desc);

create table auth_user_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sessions_revoked_before timestamptz,         -- revocation version: any JWT with iat < this is dead
  notify_new_device boolean not null default true,
  passkey_count int not null default 0,
  updated_at timestamptz default now()
);

alter table "PushToken" add column device_id uuid references auth_device(id) on delete set null;

-- Supabase has no admin "revoke session by id": a SECURITY DEFINER function does it with the service role.
create or replace function auth_revoke_supabase_session(p_session_id uuid) returns void
language sql security definer set search_path = auth as $$
  delete from auth.sessions where id = p_session_id;   -- cascades to auth.refresh_tokens
$$;
revoke all on function auth_revoke_supabase_session from public;
```

Design notes on the model
- The join key with GoTrue is `session_id` (in every access JWT). Supabase keeps it constant across refresh rotation, so one `auth_device_session` row spans the whole refresh-token family.
- No secrets in Pantopus tables: public keys, hashes, nonces. The refresh tokens stay in `auth.refresh_tokens` and are worthless without `K_dev`.
- `sessions_revoked_before` is the cheap "revocation version" the 2026-03 audit asked for; `auth_device_session.status` is the precise one.

## 4. Backend endpoints

All new routes live in `backend/routes/authDevices.js`, mounted at `/api/auth` (next to the `/api/users` mount in `app.js:305`). Errors use `{error, code}` like today. New rate limiters are per-IP *and* per-device-thumbprint.

Common headers from mobile (added in `APIClient.buildRequest` / `AuthInterceptor`):
```
X-Device-Id: <auth_device.id>              (once enrolled)
X-Install-Id: <install_id>
DPoP: <JWS: {typ:"dpop+jwt", alg:"ES256", jwk:K_dev.pub} . {jti, htm, htu, iat, nonce?, ath?}>   (on /refresh, /api/auth/*, and step-up-required endpoints)
```

### 4.1 Challenge
`POST /api/auth/challenge` (unauth, 30/15 min/IP)
```
req  { purpose: "enroll"|"resume"|"step_up"|"restore", deviceId?: uuid }
res  { challengeId, challenge: base64(32 bytes), expiresAt }      // 2-minute TTL, single use
```

### 4.2 Login / OAuth (existing routes, extended; users.js:1603 and :3925/:3857)
`POST /api/users/login`, `POST /api/users/oauth/callback`, `POST /api/users/oauth/token`, and NEW `POST /api/users/oauth/idtoken` (native SIWA / Google Credential Manager → `auth.signInWithIdToken`) all accept an optional `device` block and a `DPoP` header:
```
req.device = {
  challengeId, platform:"ios"|"android", model, osVersion, appVersion, installId,
  devKey:  { jwk },                                     // K_dev public
  stepKey: { jwk, signature: base64(sig over challenge) }?,   // K_step public (proves biometric now)
  attestation:
     { kind:"app_attest", keyId, attestationObject:base64 }        // iOS, once per install
   | { kind:"play_integrity", token, keyAttestationChain:[pem...] } // Android
   | { kind:"none" }                                                // web / legacy clients
}
DPoP header: proof with htu=<this url>, htm=POST, nonce=challenge   (signed by K_dev)
```
Server (in `services/deviceTrust.enrollOnLogin`): verify DPoP proof against `devKey.jwk`; verify attestation (`services/attestation/*`); upsert `auth_device` keyed by `dev_key_thumbprint` (iOS reinstall: same thumbprint → same device row, new `install_id`, new App Attest key); insert `auth_device_session` with `supabase_session_id` decoded from the new access JWT (signature verified locally with `SUPABASE_JWT_SECRET`/JWKS), `context = 'interactive'|'oauth'`, `last_strong_auth_at = now()`; emit `login`/`new_device` events (email + push to other devices when it is a new device). Also (Android) mint a `restore_grant` secret and return it.
```
res (mobile) = { accessToken, refreshToken, expiresIn, expiresAt, user,
                 device: { id, trustState, attestationStatus, stepKeyEnrolled },
                 session: { id, dpopNonce, restoreGrant?: base64 }  }   // restoreGrant Android only
```
Legacy clients (no `device`) still get tokens; a `web`/`legacy` device row is created with `trust_state='untrusted'` so the session is still listable/revocable. In Phase 2 enforcement, mobile logins without a valid `device` block on app versions >= X are refused with `409 DEVICE_ENROLLMENT_REQUIRED`.

### 4.3 Refresh (existing users.js:1912, rewritten body)
```
POST /api/users/refresh   headers: DPoP, X-Device-Id
req  { refreshToken, accessToken?: <expired JWT ok>, deviceId }
res  { ok, accessToken, refreshToken, expiresIn, expiresAt, dpopNonce }
     401 {code:"TOKEN_REUSE"} | 401 {code:"DEVICE_MISMATCH"} | 401 {code:"SESSION_REVOKED"} | 428 {code:"DPOP_NONCE", dpopNonce} | 401 {code:"SESSION_EXPIRED"}
```
Order of operations (`services/deviceTrust.refresh`):
1. Decode `accessToken` if given (verify signature, ignore `exp`) → `session_id`; else fall back to post-check.
2. Load `auth_device_session` by `session_id` (+ device by `X-Device-Id`). Must be `active`, device `trusted|pending`, `sessions_revoked_before < iat`.
3. Verify DPoP: ES256 with stored `dev_key_jwk`, `htm/htu` match, `iat` within ±60 s, `jti` unseen (`auth_dpop_replay` insert-or-fail), `nonce` == `dpop_nonce` or `prev_dpop_nonce` (else 428 with a fresh nonce — client retries once).
4. `scopedClient.auth.refreshSession({refresh_token})`.
5. Post-check: new JWT `session_id` == step-2 row (defense in depth; on mismatch revoke the *just minted* session via `admin.signOut(newAccess,'local')`, mark device `compromised`, event `dpop_mismatch`, 401).
6. Rotate `dpop_nonce`, bump `refresh_count/last_refresh_at/last_seen`, return.
7. GoTrue reuse error → same branch as today, plus: `status='compromised'`, `auth_revoke_supabase_session`, event `refresh_reuse`, notification to user (email + push to other devices), and set `require_step_up=true` on that device so the legit owner is asked to prove presence rather than silently re-logging.
Web (cookie transport) skips DPoP in v1 but goes through steps 1-2 and 5-7.

### 4.4 Level 2: resume (iOS reinstall / dormant / forced step-up)
```
POST /api/auth/session/resume    headers: DPoP (K_dev), X-Device-Id
req  { challengeId, stepUpSignature: base64(K_step sig over challenge||deviceId||sessionId),
       accessToken?: <possibly expired>, refreshToken?: <if still held>,
       attestation?: { kind:"app_attest", keyId, attestationObject }   // required when installId changed
       installId, appVersion, osVersion }
res  200 { mode:"refreshed", accessToken, refreshToken, expiresIn, expiresAt, dpopNonce, session:{id} }
   | 200 { mode:"reissued",  ...same shape... }        // refresh token was dead/absent → device-credential grant
   | 401 { code:"REAUTH_REQUIRED", reason:"session_revoked"|"step_key_missing"|"device_untrusted"|"attestation_failed" }
```
Server: verify K_dev DPoP + K_step signature (biometric proof) + (re)attestation; require device `trusted` and `step_key_enrolled_via='interactive'` (or allow with `context='restored'` if enrolled via restore). If the refresh token still works → do a normal DPoP refresh in-line (`mode:"refreshed"`). If not (revoked by reuse or dormant expiry) → **device-credential grant**: `admin.generateLink({type:'magiclink', email})` → `scopedClient.auth.verifyOtp({token_hash, type:'magiclink'})` mints a fresh Supabase session; bind it to the same `auth_device` (new `auth_device_session`, `context='interactive'` because K_step-interactive proved presence). This is the exact same trick `/register` already uses for hashed_token links, so no new Supabase surface. Only granted if the device has no `compromised` history in the last 24 h and the user has not enabled "always require password on new sessions".

### 4.5 Android reinstall: restore grant redemption
```
POST /api/auth/restore/redeem   headers: DPoP (new K_dev)
req  { challengeId, restoreGrant: base64, device: {…same as login.device, with fresh play_integrity + keyAttestationChain, stepKey (new, biometric-signed challenge)} }
res  200 { accessToken, refreshToken, expiresIn, expiresAt, user, device:{id,…}, session:{id, dpopNonce, restoreGrant:<new>} }
   | 401 { code:"RESTORE_INVALID" }  // consumed/expired/unknown → client falls to L3
```
Server: `sha256(grant)` lookup, unexpired, unconsumed, `user_id` device not `revoked`; Play Integrity verdict must include `MEETS_DEVICE_INTEGRITY` and `PLAY_RECOGNIZED`; verify Keystore attestation chain (root, CRL) and that `K_step` has `userAuthType` biometric in the attestation extension; consume grant; create/re-key the device row (old `dev_key_thumbprint` retired, `install_id` new, `step_key_enrolled_via='restore'`), mint session via device-credential grant with `context='restored'`, issue a fresh grant. Restored sessions can browse/chat but any step-up-protected action requires `password|passkey` once (which flips the device to `interactive`).

### 4.6 Step-up (server-verified strong auth)
```
POST /api/auth/step-up   (verifyToken)   headers: DPoP
req  { challengeId, method:"device_key", signature: base64(K_step sig over challenge||sessionId), purpose? }
   | { method:"password", password }                     // replaces the body of /reauthenticate
   | { method:"passkey", assertion:{...} }               // Phase 4
res  { stepUpToken: <JWS ES256 by server key: {sub, sid, jti, purpose?, exp: now+5m}>, expiresAt }
```
Sensitive routes take `X-Step-Up: <stepUpToken>` and call `services/stepUp.require(req, purpose)` (verifies signature, `sid` == current session, unexpired, unconsumed if `purpose` is one-shot like `delete_account`). `device_key` is accepted only if `step_key_enrolled_via='interactive'`. `POST /api/users/reauthenticate` becomes an alias that returns a step-up token instead of `{verified:true}`. Applied to: `POST /api/users/password`, `DELETE /api/users/account`, `POST /api/auth/devices/*` revocations, payout method create/change, email change, `POST /api/auth/passkeys/register`.

### 4.7 Devices, sessions, logout
```
GET    /api/auth/devices                    -> { devices:[{id, displayName, platform, model, appVersion, trustState, attestationStatus, isCurrent, lastSeenAt, lastIp, lastGeo, sessions:[{id,status,createdAt,lastRefreshAt,context}]}] }
PATCH  /api/auth/devices/:id                { displayName }
DELETE /api/auth/devices/:id                (X-Step-Up required unless :id == current)  -> { ok }
POST   /api/auth/devices/revoke-others      (X-Step-Up)   -> { revoked: n }
POST   /api/auth/logout                     { scope:"local"|"others"|"global" }  (verifyToken optional: local works with expired access token + refresh token as proof)
GET    /api/auth/security-events?limit=50   -> { events:[…] }
POST   /api/auth/security/lockdown          (X-Step-Up password|passkey) -> revokes all, sets require_step_up on all devices, invalidates restore grants, sends email
```
`revokeDevice(deviceId, reason)` = for each active `auth_device_session`: `auth_revoke_supabase_session(session_id)`, `status='revoked'`; device `trust_state='revoked'`; delete `PushToken where device_id`; send a *silent push* `{type:"session_revoked"}` to that device's push tokens *before* deleting them (best-effort remote wipe: the app clears keychain/prefs on receipt); event `device_revoked`; email "Signed out of Pixel 8". `POST /api/users/logout` (users.js:4263) delegates to the same service with `scope:'local'`, and now also deletes the device's PushToken rows and the Android restore grant.

### 4.8 Password change / reset, account deletion (existing routes)
- `POST /api/users/password` (users.js:1869): require `X-Step-Up`; after update → revoke all *other* device sessions (`revokeOthers`), set `require_step_up=true` on other devices, email + push notice.
- `POST /api/users/reset-password` (users.js:3285/3324): after update → `revokeAll` (including the recovery session), invalidate all restore grants, `sessions_revoked_before=now()`, all devices `require_step_up=true`, email "all devices signed out". A reset means the email was possibly compromised, so nothing keeps working silently.
- `DELETE /api/users/account` (users.js:3970): require `X-Step-Up` (`purpose:'delete_account'`, one-shot); before `admin.deleteUser`: `revokeAll`, delete devices, push tokens, restore grants (FK cascade covers the rest).

### 4.9 verifyToken / optionalAuth / socket
`verifyToken.js:69`: keep `supabase.auth.getUser` (authoritative) but *first* decode the JWT locally (signature-verified) to get `session_id`, `iat`, `aal`; then `deviceTrust.assertSessionUsable(userId, sessionId, iat)` — a 10 s in-process cache (same shape as the role cache at :10-31) over `auth_device_session.status` + `auth_user_security.sessions_revoked_before`, invalidated by a Postgres `LISTEN auth_revocation` channel (NOTIFY from a trigger on `auth_device_session`) so revocation propagates in ≤1 s across instances. Attach `req.session = {id, deviceId, context, lastStrongAuthAt}`. Same check in `optionalAuth.js` (cache TTL 10 s) and `chatSocketio.js:154-172` (also disconnect sockets on `auth_revocation` for that session).

## 5. Flows

### 5.1 First login (iOS shown; Android identical except attestation type)
```
 App                          Backend                        GoTrue / Apple
  |-- POST /api/auth/challenge {enroll} ------------------->|
  |<-- {challengeId, challenge} ---------------------------|
  | gen K_dev (SE), K_step (SE, biometryCurrentSet)         |
  | DCAppAttestService.generateKey -> keyId                 |
  | attestKey(keyId, sha256(challenge)) ------------------->|--> Apple servers (once per install)
  | sign DPoP(htu=/login, nonce=challenge) with K_dev       |
  | Face ID -> K_step.sign(challenge)                       |
  |-- POST /api/users/login {email,pw, device{...}} DPoP -->|
  |                                                        |-- signInWithPassword ----------> GoTrue
  |                                                        |<- session {access(session_id), refresh}
  |                                                        | verify DPoP, App Attest (x5c→Apple root, nonce, keyId, rpIdHash, counter 0)
  |                                                        | upsert auth_device (thumbprint), insert auth_device_session(session_id)
  |                                                        | events: login, new_device -> email + push other devices
  |<-- {tokens, user, device{id,trusted}, session{id,dpopNonce}} 
  | Keychain: access, refresh, userId, cachedUser, deviceId, sessionId, expiresAt, dpopNonce, accountHint
  | Sandbox: installSentinel (+ keychain mirror)            |
  | APNs register -> POST /api/notifications/register {token, deviceId}
```
Android additionally: Play Integrity standard token (`requestHash = sha256(canonical device JSON)`), Keystore attestation chains for K_dev and K_step, `restoreGrant` written to Block Store (`setShouldBackupToCloud(true)`, key `pantopus.restore.v1`, ≤4 KB) alongside `hint`.

### 5.2 Cold start (SessionBootstrap decision tree; identical logic on both platforms)
```
 read: sentinelSandbox, sentinelStore, tokens, deviceId, hint, lastRefreshAt, K_dev usable?, K_step usable?
   |
   +- no tokens & no hint & no restoreGrant ------------------------------------> L3 (login screen w/ OS credentials)
   +- no tokens & (hint | restoreGrant)  --------------------------------------> L2 (Android: redeem; iOS: resume w/o refresh → REAUTH_REQUIRED → L3)
   +- tokens present:
        +- sentinel mismatch/missing (reinstall)  ---------------------------> L2 resume (+ re-attest)
        +- lastRefreshAt > 30d  or  device.require_step_up (from last 401 body) -> L2 resume
        +- K_dev unusable (SE key gone: restore-from-backup) -----------------> wipe tokens, L2 if hint else L3
        +- else ---------------------------------------------------------------> L1: if expiresAt < now+20% -> DPoP /refresh, then GET /profile
   L1 failure mapping: 401 SESSION_REVOKED|TOKEN_REUSE -> clear tokens, keep hint, show L2/L3 with banner
                       "Signed out for your security"; DEVICE_MISMATCH -> wipe + L3; transient -> offline mode w/ cachedUser (unchanged)
```
Proactive refresh: on `.active`/`onStart` and before any request when `expiresAt - now < 20% * expiresIn` (single-flight, existing coalescing kept). Socket auth failure now triggers `refreshIfPossible()` and reconnect.

### 5.3 Reinstall on the same device
**iOS** — Keychain survived (tokens, K_dev, K_step, accountHint, sentinel-mirror); sandbox sentinel gone; App Attest key gone.
```
 bootstrap -> reinstall detected -> ContinueAsView("Continue as Ying") 
   tap -> Face ID prompt (LAContext via K_step usage) -> K_step.sign(challenge)
        -> new App Attest key + attestKey(challenge)     (Apple: keys don't survive reinstall)
        -> POST /api/auth/session/resume (DPoP K_dev, stepUpSignature, attestation, refreshToken)
 server: same dev_key_thumbprint => same auth_device; installId changed => record reinstall; verify attest;
         refresh token still valid => mode:"refreshed"; else device-credential grant => mode:"reissued"
 app: persist tokens, write new sandbox sentinel, re-enable App-Lock prompt (UserDefaults gone => ask again), home.
```
Why this is safe: (a) the surviving refresh token cannot be used without `K_dev`, which is SE-resident and non-exportable, so a keychain dump moved to another device is inert; (b) the user must pass a biometric that is enforced *by the SE* (`biometryCurrentSet`), so a thief who added their own face/finger has invalidated `K_step` and cannot resume; (c) the app must re-attest with App Attest, so a repackaged/jailbroken-simulated client fails; (d) the server sees `install_id` change and `sentinel` mismatch and logs a `resume` event and emails "Signed back in on iPhone after reinstall" — the owner learns of anything they didn't do; (e) if Apple ever ships the iOS 10.3-style keychain wipe, the flow degrades to L3 with no security regression. We deliberately supersede the RN-era "install sentinel wipes the keychain" rule: the sentinel now *downgrades* rather than *destroys*.
**Android** — nothing local survived. If the user has Google Backup on: Block Store returns `hint` + `restoreGrant`.
```
 bootstrap -> Block Store retrieveBytes -> hint+grant found -> ContinueAsScreen
   tap -> gen K_dev (StrongBox), K_step (biometric-bound) with attestation challenge -> BiometricPrompt(CryptoObject) signs challenge
        -> Play Integrity standard token -> POST /api/auth/restore/redeem
 server: verifies grant hash, integrity (MEETS_DEVICE_INTEGRITY, PLAY_RECOGNIZED), key attestation, consumes grant,
         re-keys device row, mints session context='restored', returns tokens + new grant
 app: session usable; money/payout screens require password/passkey once (SensitiveScreenGuard -> step-up) → device becomes 'interactive'
```
Why this is safe: the grant is 32 random bytes only stored in Block Store (E2EE with the user's screen lock, delivered only to the same package+signing cert on the same Google account), hashed server-side, single-use, 90-day expiry, invalidated on logout/reset/lockdown, and redemption is gated by Play Integrity + hardware key attestation + a biometric-bound new key. Even a full compromise of the grant yields a `restored` session that cannot move money or change credentials without a strong credential.

### 5.4 Token refresh + rotation (steady state)
```
 App (single-flight)                         Backend                          GoTrue
  | build DPoP {jti, htm:POST, htu:/api/users/refresh, iat, nonce:dpopNonce} sign K_dev
  |-- POST /refresh {refreshToken, accessToken(exp ok), deviceId} DPoP -->|
  |                                        verify sig(access, ignore exp) -> session_id
  |                                        load session row (active), device (trusted), revoked_before
  |                                        verify DPoP: key=dev_key_jwk, jti new, iat±60s, nonce ok
  |                                        --------------------------- refreshSession ------------>|
  |                                        <------------------ new access(session_id), refresh ----|
  |                                        assert session_id unchanged; rotate nonce; counters
  |<-- {access, refresh, expiresIn, expiresAt, dpopNonce} --------------|
  | persist tokens+nonce BEFORE any use (write-then-ack ordering); reconnect socket
```
Reuse handling: GoTrue's rotation stays the primary detector (v2 stateless algorithm tolerates the fail-to-save case; we tolerate one stale nonce for the same reason). A reuse hit ends the session family, marks the device session `compromised`, notifies the user, and forces L2 on the real device (which can recover through `resume` because it still holds `K_step`; the attacker cannot).

### 5.5 Logout
- *This device*: app → `POST /api/auth/logout {scope:"local"}` (DPoP + refresh token as proof even if access expired) → server revokes that session, deletes its push tokens + restore grant, `trust_state` stays `trusted` (device remembered but no session) → app wipes tokens, K_dev/K_step **kept** (device identity persists), keeps `accountHint` only if the user chose "Remember me on this device" (default on) — otherwise hint cleared. Also `clearCredentialState` (Android) and purge URLCache.
- *All devices*: Settings → Devices → "Sign out everywhere" (step-up) → `POST /api/auth/logout {scope:"global"}` → revoke all sessions, `sessions_revoked_before=now()`, silent push wipe to every device, email.

### 5.6 Stolen device / remote revoke
```
 owner on laptop/web or second phone: Settings > Security > Devices > "iPhone 15 Pro (last seen 2m ago, Berlin)" > Sign out
   -> step-up (password / passkey / K_step on the trusted second phone)
   -> DELETE /api/auth/devices/:id
 server: revoke sessions (auth.sessions delete), device revoked, push tokens deleted after silent 'session_revoked' push,
         NOTIFY auth_revocation -> every backend instance drops the session from cache within 1s; sockets closed
 stolen phone: next request 401 SESSION_REVOKED (≤ 10s cache) -> app wipes tokens; App-Lock Tier-1 already blocked casual access;
               attacker who knows passcode & re-enrolled Face ID: K_step invalidated -> cannot resume, cannot pass step-up,
               cannot change password (needs step-up); iOS Stolen Device Protection adds OS-level delay
 owner also can "Lock down account": revoke all + require_step_up everywhere + invalidate restore grants + rotate email link
```
SIM swap: there is no phone factor and no SMS recovery anywhere; account recovery is email-based and *always* revokes all sessions and notifies all devices, so a SIM-swapper gains nothing from the phone number.

### 5.7 Password change / reset
Change (in-app): step-up → update → revoke *others* → keep current → notify. Reset (forgot-password link): update → revoke *all* + restore grants + `require_step_up` on all devices → user re-enters via L2 (biometric + K_step, if device wasn't the attacker's) or L3.

### 5.8 Account deletion
Requires one-shot step-up (`purpose:'delete_account'`) obtained via password/passkey or interactive `K_step` (Tier-2 guard on the client maps to this); server revokes everything, wipes devices/push/grants, then `admin.deleteUser`; the client clears keychain/prefs including hint and `clearCredentialState`.

## 6. Why the token lifetimes change
- `jwt_expiry` 3600 → **900 s** once proactive refresh ships (Phase 3), because access tokens are the only remaining bearer secret (DPoP `ath` binding is required only on step-up-protected endpoints to keep verifyToken cheap).
- Supabase `[auth.sessions] inactivity_timeout = 90d` (Pro feature; our own `auth_device_session` dormancy rule of 30 d → L2 kicks in first). No timebox: Uber/Instagram-class apps never force periodic re-login; revocation and step-up carry the risk instead.
- Web refresh cookie stays 7 d; web sessions gain a device row and appear in the Devices list.

## 7. Files touched (summary; per-platform lists are in the structured fields)
Backend: `routes/authDevices.js` (new), `services/deviceTrust.js`, `services/stepUp.js`, `services/securityEvents.js`, `services/attestation/{appAttest,playIntegrity,androidKeyAttestation}.js`, `utils/jwtLocal.js`, `middleware/verifyToken.js`, `middleware/optionalAuth.js`, `socket/chatSocketio.js`, `routes/users.js` (login/oauth/refresh/logout/password/reset/reauth/account hooks), `routes/notifications.js` + `services/pushService.js` (device_id), migrations `backend/database/migrations/2xx_auth_devices.sql`, `supabase/config.toml`, `docs/*`.
iOS: `Core/Auth/{DeviceIdentity.swift, DPoPProofSigner.swift, AppAttestClient.swift, InstallSentinel.swift, SessionBootstrap.swift, AuthManager*.swift, KeychainStore.swift}`, `Core/Networking/{APIClient.swift, Endpoints/AuthEndpoints.swift, Endpoints/DeviceEndpoints.swift, Models/Auth/*}`, `Core/Realtime/SocketClient.swift`, `Core/Security/{AppSecurity.swift, StepUpCoordinator.swift, SensitiveScreenGuard.swift}`, `Features/Auth/{ContinueAsView.swift, LoginView.swift}`, `Features/Settings/DevicesView.swift`, `App/{PantopusApp.swift, AppDelegate.swift}`, `Resources/Pantopus.entitlements` + `project.yml`.
Android: `data/auth/{DeviceIdentity.kt, DpopProofSigner.kt, PlayIntegrityClient.kt, InstallSentinel.kt, RestoreGrantStore.kt, SessionBootstrap.kt, AuthRepository.kt, TokenStorage.kt, TokenAuthenticator.kt, AuthInterceptor.kt, DeviceHeadersInterceptor.kt}`, `data/api/services/{AuthApi.kt, DeviceApi.kt}`, `data/api/models/auth/*`, `core/security/{AppLockManager.kt, StepUpCoordinator.kt}`, `ui/screens/auth/{ContinueAsScreen.kt, LoginScreen.kt}`, `ui/screens/settings/DevicesScreen.kt`, `ui/navigation/PantopusNavHost.kt`, `ui/screens/RootViewModel.kt`, `push/*`, `AndroidManifest.xml`, `build.gradle.kts`, `libs.versions.toml`.


## Backend changes
- Migration `backend/database/migrations/2xx_auth_devices.sql`: create auth_device, auth_device_session, auth_restore_grant, auth_step_up_grant, auth_challenge, auth_dpop_replay, auth_security_event, auth_user_security; add PushToken.device_id (FK auth_device ON DELETE SET NULL); SECURITY DEFINER `auth_revoke_supabase_session(uuid)` deleting from auth.sessions; trigger on auth_device_session status change that `pg_notify('auth_revocation', session_id)`; RLS service_role only on all new tables; cron/pg_cron prune for auth_dpop_replay/auth_challenge.
- New `backend/utils/jwtLocal.js`: verify Supabase access JWT signature locally (HS256 SUPABASE_JWT_SECRET today; ES256 via JWKS when the project migrates), with `ignoreExpiration` option; extracts session_id/iat/aal/amr. Removes the unused JWT_SECRET ambiguity in .env.example.
- New `backend/services/deviceTrust.js`: enrollOnLogin(), verifyDpop() (RFC 9449: typ dpop+jwt, ES256, jkt thumbprint match, htm/htu, iat±60s, jti replay via auth_dpop_replay/Redis, nonce/prev_nonce), refresh() orchestration (pre-check by session_id, GoTrue refresh, post-check, nonce rotation, reuse branch), assertSessionUsable() with 10s cache + LISTEN auth_revocation invalidation, revokeDevice()/revokeOthers()/revokeAll() (auth.sessions delete + push token cleanup + silent wipe push + events), deviceCredentialGrant() (admin.generateLink magiclink + verifyOtp token_hash to mint a session bound to a device).
- New `backend/services/attestation/appAttest.js` (verify attestationObject: x5c chain to Apple App Attest root, nonce ext OID 1.2.840.113635.100.8.2 == sha256(authData||sha256(challenge)), keyId == sha256(pubkey), rpIdHash == sha256(TEAMID.app.pantopus.ios), counter 0, aaguid appattest/appattestdevelop; verify assertions with monotonic counter; store receipt and optionally redeem for fraud metric), `playIntegrity.js` (decodeIntegrityToken via Google API, check requestHash, packageName app.pantopus.android, appIntegrity PLAY_RECOGNIZED, deviceIntegrity contains MEETS_DEVICE_INTEGRITY, timestamp freshness ≤10 min), `androidKeyAttestation.js` (parse chain, verify to Google hardware attestation roots incl. the 2026-02 root, CRL check, extract securityLevel/userAuthType/attestationChallenge). Attestation failures downgrade trust_state to `untrusted` and log; enforcement toggled by env per phase.
- New `backend/services/stepUp.js`: mint 5-minute ES256 step-up JWTs {sub,sid,jti,purpose,exp} signed by a server key (STEP_UP_SIGNING_KEY), verify(), consume one-shot purposes; `requireStepUp(purpose)` middleware reading X-Step-Up; methods: device_key (K_step signature over challenge||sessionId, only if step_key_enrolled_via='interactive'), password (existing signInWithPassword+revoke temp session logic moved from /reauthenticate), passkey (Phase 4). Records last_strong_auth_at on auth_device_session.
- New `backend/services/securityEvents.js`: insert auth_security_event + fan-out notifications (email via existing SMTP for new_device/refresh_reuse/password_changed/device_revoked/restore_redeemed; push via pushService to the user's other devices; silent `session_revoked` push to the revoked device before deleting its tokens).
- New `backend/routes/authDevices.js` mounted at `/api/auth` in app.js (~line 306): POST /challenge, POST /session/resume, POST /restore/redeem, POST /step-up, GET /devices, PATCH /devices/:id, DELETE /devices/:id, POST /devices/revoke-others, POST /logout {scope}, GET /security-events, POST /security/lockdown; limiters per-IP and per-device thumbprint (extend rate limiter block users.js:532-578 / middleware/rateLimiter.js) and move rate limiting to a shared store (rate-limit-redis or Postgres) so multi-instance deployments and per-account lockouts work.
- routes/users.js POST /login (before applyAuthTransport at ~1603), POST /oauth/callback (~3925), POST /oauth/token (~3857): accept `device` block + DPoP header, call deviceTrust.enrollOnLogin, add `device` and `session{id,dpopNonce,restoreGrant}` to the JSON response; /oauth/token additionally validates that refreshToken pairs with the verified access token (attempt refreshSession or compare session_id) instead of echoing it blindly.
- routes/users.js NEW POST /oauth/idtoken: `{provider:'apple'|'google', idToken, nonce, accessToken?, device}` → scopedClient.auth.signInWithIdToken → ensureOAuthUserProfile → enrollOnLogin; enables native Sign in with Apple and Android Credential Manager Sign in with Google (Level 3).
- routes/users.js POST /refresh (1912-1958): rewrite per §4.3 — local decode of optional accessToken, session/device pre-check, DPoP verification (mobile enforced per phase flag; web skipped), GoTrue refresh, post-check on session_id, nonce rotation, return dpopNonce; TOKEN_REUSE branch marks device session compromised, revokes via auth_revoke_supabase_session, emits event + notifications, sets require_step_up.
- routes/users.js POST /logout (4263): delegate to deviceTrust.revokeDevice scope local (accept refresh token or DPoP as proof when the access token is expired), delete the device's PushToken rows and Android restore grants; add scope others/global path through /api/auth/logout.
- routes/users.js POST /password (1869): require X-Step-Up; after admin.updateUserById → revokeOthers + require_step_up on other devices + notification. POST /reset-password (3285, 3324): after update → revokeAll, invalidate restore grants, sessions_revoked_before=now(), require_step_up on all devices, email. POST /reauthenticate (1649): return a step-up token (method password) instead of {verified:true} (keep `verified:true` in the body for old clients).
- routes/users.js DELETE /account (3970): requireStepUp('delete_account'); before admin.deleteUser (4140) call revokeAll, delete auth_device rows, PushToken rows, restore grants; emit account_deleted.
- middleware/verifyToken.js (45-116): decode JWT locally first (session_id, iat, aal), then getUser as today; call deviceTrust.assertSessionUsable(userId, sessionId, iat) (10s cache, LISTEN invalidation) → 401 {code:'SESSION_REVOKED'}; attach req.session={id, deviceId, context, lastStrongAuthAt}; keep CSRF for cookie auth. Same in middleware/optionalAuth.js (cache TTL 15s→10s) and socket/chatSocketio.js (154-172) plus disconnect on auth_revocation for that session.
- routes/notifications.js POST /register + /push-token and services/pushService.js saveToken: accept and store deviceId (from X-Device-Id header or body) in PushToken.device_id; on saveToken reassign only if the same device or after revoking the previous owner's session; removeTokensForDevice(deviceId) used by revokeDevice; use removeAllTokens on global logout.
- supabase/config.toml: jwt_expiry 3600→900 (Phase 3, after proactive refresh ships), [auth.sessions] inactivity_timeout = '2160h' (90d) on Pro, keep enable_refresh_token_rotation=true and reuse interval 10s; note refresh_token_algorithm v2 tolerance; enable google external provider locally; add apple/google audiences for signInWithIdToken (client IDs for app.pantopus.ios and app.pantopus.android); auth.experimental.passkey=true when Phase 4 starts.
- Web association files (prerequisite for Level 3): regenerate frontend/apps/web/public/.well-known/apple-app-site-association for `<TEAMID>.app.pantopus.ios` with both `applinks` and `webcredentials` (keep the old Expo appID during transition), and assetlinks.json for package `app.pantopus.android` with relations handle_all_urls AND delegate_permission/common.get_login_creds and both Play App Signing + upload SHA-256 fingerprints; keep next.config.js JSON headers, serve on apex + www with no redirects; add a CI check that fetches both files from prod and validates them.
- Docs: update docs/01-authentication-authorization.md (token lifecycle, device binding, revocation), docs/mobile/auth-backend-contracts.md (new /refresh contract with DPoP + dpopNonce, device block, /api/auth/*), supersede docs/07-frontend-mobile-app.md §install sentinel and docs/interview/auth-session-security-deep-dive.md §7 with the new reinstall policy, add device identifiers/Keychain items/Block Store to docs/compliance/privacy-data-inventory.md and regenerate the App Store / Play data-safety labels; remove the dead legacy signOut helpers in config/auth.js and middleware/auth.js.
- Observability: metrics for dpop_verify_fail, device_mismatch, refresh_reuse, resume_success/fail, restore_redeem, attestation_failed by platform/app_version; alerts on spikes; Sentry breadcrumbs carry deviceId (not tokens).

## iOS changes
- Core/Auth/DeviceIdentity.swift (new): creates/loads `K_dev` (CryptoKit `SecureEnclave.P256.Signing.PrivateKey` with `SecAccessControl(.privateKeyUsage)`, accessibility afterFirstUnlockThisDeviceOnly, dataRepresentation stored in Keychain key `devKey`) and `K_step` (`.privateKeyUsage | .biometryCurrentSet`, whenPasscodeSetThisDeviceOnly, key `stepKey`, LAContext with localizedReason for the Continue-as / step-up prompts); exposes jwk(), thumbprint(), sign(_:), and detects invalidated K_step (errSecItemNotFound / LAError.biometryLockout) → emits `biometry_key_invalidated` and re-enrolls after next strong auth. Falls back to a non-SE P-256 key only on Simulator (flagged `attestation: none`).
- Core/Auth/DPoPProofSigner.swift (new): builds RFC 9449 proofs `{typ:dpop+jwt, alg:ES256, jwk}` / `{jti, htm, htu, iat, nonce, ath?}` signed by K_dev; injected into `APIClient.buildRequest(for:)` (APIClient.swift:271-315) for endpoints flagged `requiresDPoP` and always for /api/users/refresh and /api/auth/*; handles 428 DPOP_NONCE by storing the returned nonce (Keychain `dpopNonce`) and retrying once.
- Core/Auth/AppAttestClient.swift (new): wraps DCAppAttestService (isSupported check → `attestation: none` on unsupported/Simulator); generateKey + attestKey(sha256(challenge)) at first login and after every detected reinstall; persists keyId in Keychain `appAttestKeyId`; generateAssertion for /session/resume and step-up requests; handles DCError.invalidKey by regenerating; gradual-ramp friendly (attest only once per install).
- Core/Auth/InstallSentinel.swift (new): 32-byte random sentinel written to Application Support (`.completeUntilFirstUserAuthentication`) and mirrored into Keychain `installSentinel`; `state()` → .fresh / .same / .reinstalled(mismatch or sandbox missing); replaces the RN-era wipe policy with a downgrade-to-L2 policy.
- Core/Auth/SessionBootstrap.swift (new): pure decision function computing L1/L2/L3 from InstallSentinel, KeychainStore contents (tokens, deviceId, sessionId, expiresAt, accountHint, lastRefreshAt), DeviceIdentity availability, and last known server flags; unit-tested exhaustively with InMemorySecureStore.
- Core/Auth/AuthManager.swift: `restoreSession()` (152-195) now runs SessionBootstrap first: L1 → proactive DPoP refresh if expiresAt within 20% then GET /profile; L2 → set new state `.restorable(AccountHint)`; also attempt refresh when only a refresh token exists (fix the access-token-empty early exit). `persistLoginResponse` (257-276) stores deviceId, sessionId, expiresAt, dpopNonce, accountHint, writes the sentinel, stamps `lastInteractiveSignInAt` into Keychain. `performRefresh` (427-466) sends deviceId + (expired) accessToken + DPoP, persists rotated tokens+nonce before returning, maps 401 codes (TOKEN_REUSE / SESSION_REVOKED / DEVICE_MISMATCH) to a new `.securityRevoked(reason)` outcome that keeps the accountHint and shows a banner instead of a silent sign-out. `signOut(scope:)` (482-507) calls POST /api/auth/logout {scope} (best effort, with refresh token proof), unregisters APNs token, purges the pantopus-http URLCache, keeps K_dev/K_step, keeps accountHint unless the user chose 'Forget this account'. `handleUnauthorized()` distinguishes SESSION_REVOKED (wipe tokens, keep hint) from transient. New `resume(with:)` implementing POST /api/auth/session/resume (Face ID via K_step, App Attest re-attest when sentinel says reinstalled) and handling mode refreshed/reissued/REAUTH_REQUIRED. New `stepUp(purpose:)` returning a step-up token via K_step (falls back to password sheet).
- Core/Auth/AuthManager+OAuth.swift: add native Sign in with Apple path using `ASAuthorizationAppleIDProvider` (SignInWithAppleButton in LoginView) → POST /api/users/oauth/idtoken {provider:apple, idToken, nonce(sha256 in request, raw to server), device}; keep browser OAuth for Google (or Google Sign-In SDK later); check `getCredentialState(forUserID:)` at launch for SIWA users and force L3 on `.revoked`.
- Core/Auth/KeychainStore.swift: extend SecureStoreKey with deviceId, sessionId, expiresAt, dpopNonce, devKey, stepKey, appAttestKeyId, installSentinel, accountHint, lastInteractiveSignInAt, appLockEnabled (moved out of UserDefaults so the App-Lock preference survives reinstall and cannot be flipped by editing defaults); add a second Keychain instance with `.whenPasscodeSetThisDeviceOnly` for stepKey/accountHint; keep primary tokens on afterFirstUnlockThisDeviceOnly non-synchronizable.
- Core/Networking/APIClient.swift: send X-Device-Id / X-Install-Id headers (298-301), DPoP header for flagged endpoints, X-Step-Up header when a StepUpCoordinator token is attached; `executeWithRetry` (170-221) adds proactive pre-expiry refresh using stored expiresAt and maps the new 401 codes; MultipartUploader.swift mirrors the same.
- Core/Networking/Endpoints/AuthEndpoints.swift + new DeviceEndpoints.swift: login/oauth with `device` payload, refresh(refreshToken:accessToken:deviceId:), oauthIdToken, challenge, sessionResume, stepUp, devices list/patch/delete, revokeOthers, logout(scope), securityEvents, lockdown. Core/Networking/Models/Auth/AuthDTOs.swift: DeviceEnrollment, AttestationPayload, LoginResponse.device/session, RefreshResponse.dpopNonce, ResumeResponse, StepUpResponse, DeviceDTO, SecurityEventDTO; AuthErrorBody.code used for TOKEN_REUSE/SESSION_REVOKED/DEVICE_MISMATCH/REAUTH_REQUIRED/DPOP_NONCE.
- Core/Realtime/SocketClient.swift (39-83): on socket auth error call `AuthManager.shared.refreshIfPossible()` and reconnect with the rotated token; disconnect on `.securityRevoked`.
- Core/Security/AppSecurity.swift: AppLockManager reads/writes `enabled` from Keychain (survives reinstall) and re-arms lock on `.restorable`; new Core/Security/StepUpCoordinator.swift that turns Tier-2 sensitive-action guards (SensitiveScreenGuard, PrivacyViewModel delete-account gate, payout screens) into server step-up tokens via K_step (biometryCurrentSet) with password fallback; SensitiveScreenGuard restored on Wallet / Payments & Payouts (parity gap) and now requires a fresh step-up token when `session.context == restored`.
- Features/Auth/ContinueAsView.swift (new): avatar + name + masked email card, 'Continue with Face ID' (calls AuthManager.resume) and 'Not you? Sign in' (clears hint → LoginView); shows 'Signed out for your security' banner after TOKEN_REUSE/SESSION_REVOKED. App/PantopusApp.swift RootView switch (115-122) adds `.restorable` → ContinueAsView; `.task` ordering: SessionBootstrap → restore; `.onChange(scenePhase == .active)` triggers proactive refresh.
- Features/Auth/LoginView.swift: native SignInWithAppleButton, email field `.textContentType(.username)` (Password AutoFill / passkey QuickType once webcredentials is associated), `performAutoFillAssistedRequests` for passkeys in Phase 4; Features/Settings/DevicesView.swift (new): device list with current badge, last seen/IP/geo, rename, 'Sign out' per device, 'Sign out everywhere', security event log; wired into Settings/YouTab.
- App/AppDelegate.swift (75-88): send deviceId with the APNs registration; handle silent push `{type:'session_revoked'}` by calling AuthManager.wipeLocalSession() (keeps hint if the push says so); UIBackgroundModes stays remote-notification.
- Resources/Pantopus.entitlements AND project.yml (140-152, the regen source of truth): add `webcredentials:pantopus.com`, `webcredentials:www.pantopus.com` (+ .app), `com.apple.developer.applesignin` = Default, `com.apple.developer.devicecheck.appattest-environment` = production (development for debug), re-add `applinks:pantopus.com` entries to project.yml so `make bootstrap` stops reverting them; add DeviceCheck/App Attest capability in Xcode project spec.
- Tests: PantopusTests/SessionBootstrapTests.swift (decision matrix incl. reinstall, dormant, missing K_dev), AuthManagerRefreshTests.swift (DPoP header present, nonce retry on 428, TOKEN_REUSE → .securityRevoked keeps hint), AuthManagerResumeTests.swift (refreshed/reissued/REAUTH_REQUIRED), DPoPProofSignerTests (claims, ath), KeychainStore key set; DeviceIdentity uses an injectable signer protocol so tests run without a Secure Enclave.

## Android changes
- data/auth/DeviceIdentity.kt (new): Android Keystore EC P-256 `K_dev` (alias pantopus.dev.v1, PURPOSE_SIGN, SHA256withECDSA, setIsStrongBoxBacked(true) with StrongBoxUnavailableException fallback, setAttestationChallenge(challenge) at creation, no user auth) and `K_step` (alias pantopus.step.v1, setUserAuthenticationRequired(true), setUserAuthenticationParameters(0, AUTH_BIOMETRIC_STRONG), setInvalidatedByBiometricEnrollment(true), StrongBox when available); exposes jwk()/thumbprint()/sign() and attestationChain(); handles KeyPermanentlyInvalidatedException → emit biometry_key_invalidated and re-enroll after next strong auth. Replaces the deprecated security-crypto MasterKey path for new material (tokens can stay in EncryptedSharedPreferences until a follow-up moves them to Tink/Keystore-wrapped storage).
- data/auth/DpopProofSigner.kt (new): RFC 9449 proof builder (typ dpop+jwt, ES256, jwk) with jti/htm/htu/iat/nonce/ath; data/auth/DeviceHeadersInterceptor.kt (new): adds X-Device-Id, X-Install-Id, DPoP (for /api/users/refresh, /api/auth/*, and requests tagged @DPoP via a request Tag), X-Step-Up when StepUpCoordinator has a token; installed on BOTH the main OkHttp client (NetworkModule.kt:186-214) and the @Named("authRefresh") client (238-244); handles 428 DPOP_NONCE by persisting the nonce and retrying once.
- data/auth/PlayIntegrityClient.kt (new): StandardIntegrityManager warm-up at cold start (prepareIntegrityToken), request(requestHash = sha256(canonical enrollment JSON)) for login/enroll/redeem; graceful degradation when Play services missing (attestation kind none → device untrusted, session still works until enforcement phase). Dependency com.google.android.play:integrity.
- data/auth/InstallSentinel.kt (new): random 32B file in filesDir mirrored into encrypted prefs; state fresh/same/reinstalled. data/auth/RestoreGrantStore.kt (new): Block Store (play-services-auth-blockstore 16.4.0) read/write of `pantopus.hint.v1` (non-secret account hint JSON ≤4KB) and `pantopus.restore.v1` (32B grant) with setShouldBackupToCloud(true); deleteBytes on sign-out/forget/lockdown; never stores tokens.
- data/auth/SessionBootstrap.kt (new): the same L1/L2/L3 decision function as iOS (inputs: sentinel, TokenStorage contents incl. deviceId/sessionId/expiresAt/lastRefreshAt, DeviceIdentity availability, Block Store hint+grant); unit-tested with fakes.
- data/auth/AuthRepository.kt: `restore()` (175-217) runs SessionBootstrap: L1 → proactive refresh if near expiry then api.me(); L2 → new State.Restorable(hint) (Android: redeem path if grant present, else resume if tokens present); persistLoginResponse (312-328) stores deviceId/sessionId/expiresAt/dpopNonce, writes sentinel, writes Block Store hint+grant, `lastInteractiveSignInAt` persisted; refreshTokens (448-481) sends deviceId + expired accessToken + DPoP, persists rotated tokens+nonce before returning, maps TOKEN_REUSE/SESSION_REVOKED/DEVICE_MISMATCH to RefreshOutcome.SecurityRevoked(reason) that keeps the hint; new resume()/redeemRestoreGrant()/stepUp(purpose)/enrollDevice(); signOut(scope) (526-538) calls POST /api/auth/logout {scope} (best effort), clears TokenStorage but keeps K_dev/K_step, keeps hint unless 'forget', calls CredentialManager.clearCredentialState, deletes Block Store grant, unregisters FCM token server-side (DELETE /push-token).
- data/auth/TokenStorage.kt: add keys device_id, session_id, expires_at, dpop_nonce, install_sentinel, last_interactive_sign_in, account_hint (secure copy); clear() keeps account_hint and install_sentinel; expose expiresAt for proactive refresh; keep backup exclusions for secure_auth_tokens.xml (backup_rules.xml / data_extraction_rules.xml unchanged, allowBackup=false stays).
- data/auth/TokenAuthenticator.kt (36-86): keep single-flight; read the 401 body code (TOKEN_REUSE / SESSION_REVOKED / DEVICE_MISMATCH) and route to AuthRepository.onSecurityRevoked(reason) instead of a silent signOut(); AuthInterceptor.kt (27-41) unchanged apart from moving device headers into DeviceHeadersInterceptor.
- data/api/services/AuthApi.kt + new DeviceApi.kt: login/oauth with device block, refresh(refreshToken, accessToken, deviceId), oauthIdToken, challenge, sessionResume, restoreRedeem, stepUp, devices list/patch/delete, revokeOthers, logout(scope), securityEvents, lockdown; data/api/models/auth/AuthDtos.kt: DeviceEnrollmentDto, AttestationDto (play_integrity + keyAttestationChain), LoginResponse.device/session(restoreGrant), RefreshResponse.dpopNonce, ResumeResponse, RedeemResponse, StepUpResponse, DeviceDto, SecurityEventDto, AuthErrorBody.code.
- core/security/AppLockManager.kt: add CryptoObject-backed prompt variant (`promptForSignature(signature: Signature)`) so K_step signing is gated by BiometricPrompt(BIOMETRIC_STRONG); new core/security/StepUpCoordinator.kt converting Tier-2 sensitive-action guards into server step-up tokens (K_step first, password fallback); restore SensitiveScreenGuard on Wallet / Payments & Payouts and require step-up when session context == restored; move appLock enabled flag to encrypted prefs so it is consistent with iOS.
- ui/screens/auth/ContinueAsScreen.kt (new) + ui/navigation/PantopusNavHost.kt (57-78): State.Restorable → ContinueAsScreen (avatar/name/masked email, 'Continue with fingerprint/face' → resume/redeem, 'Not you? Sign in'), security banner after revoke; ui/screens/RootViewModel.kt (29-31): sequence PlayIntegrity warm-up + SessionBootstrap before restore().
- ui/screens/auth/LoginScreen.kt + LoginViewModel.kt: Credential Manager (androidx.credentials 1.5+/1.7): GetPasswordOption + GetGoogleIdOption (serverClientId, nonce) on screen open and on the Google button → POST /api/users/oauth/idtoken; add autofill ContentType semantics (Username/EmailAddress, Password) to the BasicTextFields; CreatePasswordRequest after successful password login so the OS remembers the account; passkeys (GetPublicKeyCredentialOption / CreatePublicKeyCredentialRequest) in Phase 4; keep browser OAuth for Apple.
- ui/screens/settings/DevicesScreen.kt (new): device list, rename, per-device sign out, sign out everywhere, security events; wired into Settings; uses StepUpCoordinator for the destructive actions.
- push/PushTokenSyncer.kt + PantopusMessagingService.kt: send deviceId with registerPushToken; handle data message {type:'session_revoked'} by wiping local session (keep hint per payload); unregister on sign-out.
- AndroidManifest.xml: add <meta-data android:name="asset_statements" android:resource="@string/asset_statements"> pointing at https://pantopus.com/.well-known/assetlinks.json (needed for Credential Manager passwords/passkeys); keep allowBackup=false and existing exclusions; (dev-only) plan a network_security_config to drop usesCleartextTraffic in release. build.gradle.kts / libs.versions.toml: add androidx.credentials:credentials + credentials-play-services-auth, com.google.android.libraries.identity.googleid, com.google.android.gms:play-services-auth-blockstore:16.4.0, com.google.android.play:integrity; keep biometric 1.1.0.
- Tests: SessionBootstrapTest (decision matrix incl. reinstall with grant / without / dormant), AuthRepositoryTest additions (refresh sends DPoP + deviceId, SecurityRevoked keeps hint, resume/redeem outcomes, signOut calls backend), TokenAuthenticatorTest (code-aware 401 mapping, 428 nonce retry), DpopProofSignerTest, RestoreGrantStore fake; instrumented TokenStoragePersistenceTest extended for new keys; Paparazzi snapshots for ContinueAsScreen/DevicesScreen.

## Threat model
- Refresh token exfiltrated (backup, malware, log leak, MITM on a pinned-less network) and replayed from another machine → refresh requires a DPoP proof from K_dev (SE/StrongBox, non-exportable) and the session_id→device binding; replay yields 401 DEVICE_MISMATCH, device marked compromised, user notified. GoTrue rotation + reuse detection remains the second layer.
- Access token exfiltrated → lifetime cut to 15 min (Phase 3); step-up-protected endpoints additionally require DPoP with `ath` bound to that token; every session revocable within ~1 s via LISTEN/NOTIFY cache invalidation.
- Supabase/Postgres dump leaked → Pantopus tables hold only public keys, hashed restore grants, nonces and events; refresh tokens in auth.refresh_tokens are inert without device keys; step-up signing key and JWT secret live in env/KMS, not the DB.
- Stolen unlocked device → App-Lock Tier-1 (biometric/passcode) blocks casual use; money/credential changes need Tier-2 step-up bound to K_step (BIOMETRIC_STRONG / biometryCurrentSet, no passcode fallback); owner remotely signs the device out from any other surface (Devices list) or web; silent wipe push clears local session; push tokens removed so no data keeps flowing.
- Thief who knows the passcode and re-enrolls Face ID/fingerprint → K_step is invalidated by biometry re-enrollment (biometryCurrentSet / setInvalidatedByBiometricEnrollment), so resume and step-up fail and password change is impossible without the password/passkey; iOS Stolen Device Protection adds an OS delay; owner's other devices are notified of the invalidation event and can lock down.
- SIM swap / carrier port-out → no SMS or phone factor exists anywhere (login, step-up, recovery); email-based reset always revokes all sessions and notifies every device; adding a phone number later must never make it a recovery factor.
- Attacker reinstalls the app on the victim's device (iOS) hoping to inherit the keychain session → sentinel mismatch forces L2: needs the victim's current biometric (SE-enforced) plus fresh App Attest; without it → L3 password/passkey. Nothing weaker than a normal login is ever accepted from an unknown install.
- Android Block Store blob obtained (rooted device / cloud backup compromise) → grant is single-use, 90-day, hashed at rest, tied to the user's devices, redeemable only with a Play-Integrity-verified genuine app on a MEETS_DEVICE_INTEGRITY device with a hardware-attested biometric-bound new key; result is a `restored` session that cannot move money or change credentials until a password/passkey is presented; every redemption emails the user.
- Repackaged / hooked client, emulator, jailbroken/rooted device → App Attest (genuine app + SE key) and Play Integrity (PLAY_RECOGNIZED + MEETS_DEVICE_INTEGRITY) at enrollment/resume/redeem; failures set trust_state untrusted (monitor) then refuse restore/step-up (enforce). Acknowledged limit: App Attest does not detect jailbreak; compensate with short access tokens and per-session revocation.
- DPoP proof replay / precomputation → jti uniqueness table, iat ±60 s window, server-issued per-session nonce (428 DPOP_NONCE dance), htm/htu binding; proofs are useless across endpoints or after seconds.
- Refresh-token reuse false positives (fail-to-save after crash, concurrent refresh) → client persists tokens before acknowledging, single-flight on both platforms, GoTrue v2 tolerance for the immediately previous token and 10 s reuse interval, one stale-nonce tolerance; genuine reuse still ends the family and notifies.
- Account recovery abuse (attacker controls the mailbox) → reset revokes all sessions/devices and restore grants and emails all previous addresses; new-device logins after a reset are flagged; future: passkey/second-device approval as recovery factor; open question on a 24 h delayed-effect for trusted-device changes.
- OAuth code/ID-token injection → Supabase PKCE code flow + app_nonce constant-time check (existing) for browser OAuth; native SIWA/Google use a fresh nonce echoed in the ID token and verified by GoTrue; /oauth/token no longer echoes an unvalidated refresh token.
- Phishing of the password → Level 3 moves toward phishing-resistant credentials (native SIWA, Google Credential Manager, passkeys) with domain-associated AutoFill only after AASA/assetlinks are fixed; step-up via K_step cannot be phished.
- Insider / support misuse of revocation & device data → all admin revocations go through the same service with audit rows; device rows contain no location beyond coarse geo from IP; PII minimised in security events.
- Brute force / credential stuffing on login, refresh, resume, redeem, step-up → per-IP and per-device-thumbprint limiters in a shared store, per-account soft lockout with step-up, challenge single-use TTL, GoTrue's own limits; App Attest fraud-risk metric and Play Integrity recentDeviceActivity for abusive devices.
- Compromised backend instance / key leak → step-up JWT and DPoP nonce keys rotate via env; sessions_revoked_before offers a global kill switch per user; DB-side SECURITY DEFINER function limits what the service role must be granted for revocation.
- Push channel abuse (fake session_revoked push) → silent wipe push is only honoured after the app confirms with GET /api/auth/devices (401 SESSION_REVOKED) — a spoofed push can at worst trigger a check.
- Privacy/regulatory: device identifiers, keys, Block Store use and security emails are added to the privacy inventory and store labels; keys are per-app, non-tracking; no cross-app device fingerprinting (DeviceCheck bits, if adopted, only for 'seen device' flags).

## Rollout
- Phase 0 — Hygiene and prerequisites (≈1 week, no client-facing behaviour change): regenerate AASA/assetlinks for the native identifiers with webcredentials + get_login_creds and add a prod fetch check to CI; add webcredentials/applesignin/appattest entitlements to project.yml (fix the applinks regen bug); local JWT decode in verifyToken (session_id on req); auth_security_event + auth_user_security tables; both apps call POST /api/users/logout on sign-out and unregister push tokens; /password revokes other sessions; /reset-password revokes all; DELETE /account requires reauth (existing password reauth); /oauth/token validates the refresh token pairs; delete dead legacy signOut helpers; docs updated. Ships independently and closes audit P1-7.
- Phase 1 — Trusted-device registry in monitor mode (≈2-3 weeks): migrations for auth_device / auth_device_session / auth_challenge / auth_dpop_replay; clients generate K_dev, send `device` on login/oauth and DPoP + deviceId on refresh; server records, verifies and LOGS mismatches without refusing; verifyToken/optionalAuth/socket enforce auth_device_session status (revocation now works); Devices list + per-device revoke + 'sign out everywhere' UI on iOS/Android/web; PushToken.device_id; new-device email/push notifications. Legacy clients keep working (untrusted device rows).
- Phase 2 — Enforcement + attestation + step-up (≈3 weeks): enforce DPoP on /refresh for enrolled devices (feature flag by app version, kill switch); App Attest / Play Integrity / Keystore attestation at enrollment with soft-fail telemetry for one release, then required for resume/step-up; K_step enrolment on both platforms; /api/auth/step-up (device_key + password) and X-Step-Up required on password change, account deletion, device revocation, payout method changes; SensitiveScreenGuard parity on Wallet/Payouts using StepUpCoordinator; shared-store rate limiting.
- Phase 3 — Reinstall recovery and session UX (≈3 weeks): install sentinel + SessionBootstrap + ContinueAs screens; iOS /session/resume (refreshed/reissued via device-credential grant); Android Block Store hint + restore grant + /restore/redeem with `restored` context; proactive refresh + socket refresh hook; TOKEN_REUSE / SESSION_REVOKED banners; silent wipe push; dormant-session (30 d) rule; then lower jwt_expiry to 900 s and set Supabase inactivity_timeout 90 d; App-Lock preference moved to Keychain/encrypted prefs.
- Phase 4 — OS-level credentials (≈3-4 weeks, partly gated on Supabase passkey GA): native Sign in with Apple and Android Credential Manager Sign in with Google via POST /oauth/idtoken; Password AutoFill (.username content type, CreatePasswordRequest); passkeys as sign-in and step-up method (backend proxies GoTrue /passkeys/* or waits for GA; iOS conditional passkey upgrades; Android passkeys); Android Restore Credentials for new-device transfer; account lockdown flow; optional DeviceCheck/Device Recall bits for 'seen device' abuse signals; web DBSC watch item.
- Cross-cutting per phase: feature flags per app version, dashboards for dpop_verify_fail/device_mismatch/resume/redeem/attestation_failed, staged App Attest ramp (≤1M attestations/day guidance), rollback = flip enforcement flag (monitor mode keeps everything working), privacy inventory and store labels updated before each store submission.

## Tradeoffs
- Level 2 (biometric 'Continue as') on iOS reinstall instead of silent Level 1: costs one Face ID tap after a reinstall (rare event) but converts an accidental keychain-survival behaviour into a designed, cryptographically enforced one and gives a chance to re-attest, re-arm App-Lock and notify the user. Instagram/YouTube-style zero-tap after reinstall was rejected because Pantopus moves money.
- Android same-device reinstall depends on Google Backup being on (Block Store); users with backup off fall to Level 3 (Credential Manager one-tap). Alternative — persisting a grant in external storage or via ANDROID_ID heuristics — was rejected as both weak and policy-hostile.
- Wrapping GoTrue rather than replacing it: we keep Supabase's rotation/reuse detection and identity providers, but pay for a shadow session table, a SECURITY DEFINER delete into auth.sessions (no admin API exists), and a magiclink+verifyOtp trick to mint device-credential sessions. A custom OAuth AS with native DPoP would be cleaner but is a multi-quarter migration.
- DPoP proof only on /refresh, /api/auth/* and step-up endpoints, not on every API call: keeps verifyToken cheap and battery-friendly; the residual risk (15-min access-token replay on ordinary endpoints) is accepted and shrunk by the shorter jwt_expiry and fast revocation.
- K_dev is not biometric-gated so background refresh and push-triggered fetches keep working; the biometric guarantee is carried by the separate K_step. Two keys add code but avoid the classic 'Face ID on every refresh' failure mode.
- Restored (Block Store) sessions are deliberately weaker (no money moves until password/passkey once). Slightly more friction for the small reinstall-without-biometric-continuity population; big reduction in what a leaked grant is worth.
- Attestation soft-fails during monitor phases: we accept a window where jailbroken/rooted devices still get sessions, in exchange for measured false-positive rates (older devices, Huawei/no-GMS, Simulators/CI) before enforcement.
- Reducing jwt_expiry to 900 s increases refresh traffic ~4x and touches web too; mitigated by proactive refresh and raising the refresh limiter; if web reliability regresses, keep 3600 for web via a separate cookie lifetime and accept the longer window there.
- Password reset revokes *all* devices including the one that requested it: more friction (biometric resume or re-login afterwards) but the only defensible behaviour when the mailbox may be compromised.
- Security emails/pushes on new device / reinstall / reuse add notification volume and support questions; kept default-on but user-adjustable (notify_new_device) except for compromise events which are always sent.
- Passkeys deferred to Phase 4 because Supabase's passkey support is beta and supabase-kt lacks sign-in; building our own WebAuthn RP now would duplicate what GoTrue is about to ship. Native SIWA/Google via signInWithIdToken gives most of the one-tap benefit sooner.
- In-process caches (10 s) plus Postgres LISTEN/NOTIFY instead of Redis: no new infra, sub-second revocation in practice; if the fleet grows or LISTEN proves flaky, swap deviceTrust cache to Redis pub/sub without changing contracts.

## Open questions
- Which Supabase plan/features are available in production: are [auth.sessions] inactivity_timeout/single_per_user usable, is the refresh_token_algorithm v2 enabled for the project, and are HS256 secrets or ES256 JWKS in use (affects utils/jwtLocal.js)?
- Is deleting rows from auth.sessions via a SECURITY DEFINER function acceptable operationally (Supabase support stance, future schema changes), or should revocation rely solely on our own auth_device_session check plus admin.signOut when a JWT is available?
- Apple Team ID for app.pantopus.ios (project.yml DEVELOPMENT_TEAM is blank) and whether the Expo appID 6UYZBA546R.com.pantopus.app must remain in the AASA during migration; who owns Play App Signing keys to obtain the SHA-256s for assetlinks.
- Product decision on dormancy: 30 days without refresh → Level 2 (proposed) vs never; and whether 'Remember this account on this device' (account hint kept after logout) is default-on for a marketplace with money.
- Should Android restore via Block Store be limited to devices reporting MEETS_STRONG_INTEGRITY, or is MEETS_DEVICE_INTEGRITY enough for the long tail of OEM devices? Need field data from Phase 2 telemetry.
- Web parity: do we build a Devices list on web (yes proposed) and do web sessions get DPoP later via DBSC/WebCrypto non-extractable keys, or remain cookie-only?
- Should trusted-device changes (revoke others, disable notifications, add passkey) triggered right after a password reset be delayed 24 h with an undo email (Google-style), given email is the only recovery factor?
- Passkeys: wait for Supabase passkey GA and supabase-kt sign-in support, or proxy /auth/v1/passkeys/* from the backend now; and do we register passkeys as primary sign-in, step-up factor, or both?
- How aggressively to enforce attestation: refuse login entirely for untrusted devices (Uber-like) or only refuse restore/step-up (proposed), and what to do for regions/devices without Google Play services.
- Support tooling: do we need an admin endpoint/UI for support to view a user's devices, revoke, or lock down an account, and what audit/approval process gates it?
- Privacy/legal review of collecting device model, IP-derived geo and keeping security events (retention period proposed 180 days), and updating App Store / Play data-safety declarations before Phase 1 ships.
- Whether to adopt DeviceCheck two bits / Play Integrity Device Recall for 'this device was previously banned/compromised' signals across reinstalls (beta/opt-in on Android).
