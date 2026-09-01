# Welcome Back — device-bound persistent sessions with "Continue as X" for Pantopus iOS/Android

THESIS: Make the app remember you the way Instagram/YouTube do — iOS reinstall lands you straight back in with zero gestures, Android reinstall shows a "Continue as Ying" card that opens with one fingerprint — and pay for that magic with three server-visible primitives instead of client-side theatre: (1) every mobile session is registered in a Pantopus-owned session/device registry keyed by the Supabase `session_id`, so it can be listed, named, and revoked from anywhere within seconds; (2) every mobile refresh token is sender-constrained to a Secure Enclave / Android Keystore P-256 key (DPoP-style proof on `/refresh`, key attested once with App Attest / Play Integrity), so an exfiltrated refresh token is worthless off-device; (3) reinstall recovery uses whatever the platform lets survive — iOS Keychain (tokens + device key survive uninstall) and Android Block Store (an opaque, single-use, biometric-gated, revocable *restore grant*, not the tokens) — with OS credential managers (Password AutoFill, passkeys, native Sign in with Apple, Google Credential Manager, Android Restore Credentials) as the universal fallback so "Continue as X" never dead-ends in a typed password. Step-up for money/destructive actions is cryptographic (biometry-bound key or passkey), not a boolean, and password change / "sign out everywhere" really kill every session, socket, push token, and restore grant. Each phase ships on its own; Phase 1 alone (registry + revocation + real logout) already fixes the worst gap in the current system.

# Welcome Back — persistent login, reinstall recovery, trusted devices

## 0. Goals / non-goals

**Goals**
1. **Zero-friction reinstall.** iOS: delete → reinstall → open → you are in (0 gestures) unless the account was locked. Android: reinstall → "Continue as Ying" → fingerprint → in (1 gesture). New device (D2D/cloud restore): "Welcome back" via Restore Credentials / passkey.
2. **Cold start never asks for a password** while the device is trusted; refresh is invisible, proactive (before expiry), and single-flight.
3. **Every mobile session is device-bound, enumerable, nameable and revocable** from any other signed-in surface within ~15 s (HTTP) / instantly (socket kick).
4. **Token theft is contained**: refresh tokens are useless off the device; reuse/proof failure kills the session and tells the user.
5. **"Sign out everywhere" and password change actually sign out everywhere** — sessions, sockets, push tokens, restore grants.
6. **OS credential managers do the work**: Password AutoFill (domain-associated), passkeys, native Sign in with Apple, Google Credential Manager, Android Restore Credentials.
7. Sensitive actions (payouts, password change, delete account, revoke devices, add passkey) require a **cryptographic step-up** verified server-side.

**Non-goals (v1):** TOTP/SMS MFA; phone-number identity (T6 Q3 stands); web device binding (watch DBSC); jailbreak/root detection as a control (attestation degrades trust, never blocks); RN client; account recovery without email.

**Explicit policy decision:** this design *supersedes* the RN-era "wipe Keychain on reinstall" install-sentinel (docs/07 §, deep-dive §7). We keep an install sentinel only to *detect* reinstall (for telemetry and the lock re-gate), never to wipe.

---

## 1. The three UX levels and when each is used

| Level | What survives | iOS | Android | Gate |
|---|---|---|---|---|
| **L1 Still signed in** | Session tokens + device key | Keychain (`afterFirstUnlockThisDeviceOnly`) survives uninstall → **default reinstall path** | Only same install (Keystore + EncryptedPrefs die on uninstall) | None, unless account has app lock / "require unlock on reinstall" / device unseen >30 d → Face ID/biometric on a "Continue as X" card |
| **L2 App remembers account** | Non-secret **account hint** + (Android) a **restore grant** | Keychain `accountHint` item (kept after logout-with-remember, after remote revoke it is cleared) | **Block Store** entry `{uid,name,avatar,maskedEmail,lastMethod,lock,grant}` (survives uninstall when Google Backup is on) | Android: BiometricPrompt → `POST /api/auth/restore`. iOS: hint only → passkey / SIWA / AutoFill password prefilled |
| **L3 OS remembers account** | Credentials in the platform credential manager | Password AutoFill + passkeys via `webcredentials:pantopus.com`; native SIWA `getCredentialState`; iOS 18 automatic passkey upgrade | Credential Manager sheet: passkey / Sign in with Google / saved password; Restore Credentials on new device | OS biometric inside the sheet |

Decision order at cold start (both platforms): **L1 → L2 → L3 → manual login**. Each level degrades to the next without a dead end, and each level's UI is a *card*, not a form.

### First-launch-after-reinstall UI states

**iOS**
- **A. Silent restore (default)** — Splash → RootTabView. Background: device-bound refresh if `expiresAt` is near/past. One-time toast "Welcome back, Ying" (dismissible, no action).
- **B. Locked restore** — `ContinueAsView`: avatar, "Continue as Ying", `y•••@gmail.com`, primary button "Continue with Face ID" (LAContext fires on appear), secondary "Not you? Use another account". Shown when app lock was enabled (pref now lives in Keychain + on the server device row), the account pref `requireUnlockOnReinstall` is on, or `lastSeenAt` > 30 d.
- **C. Hint only** (session revoked/expired but `accountHint` present) — same card; buttons depend on `lastMethod`: passkey (AutoFill-assisted request already armed) / "Continue with Apple" (native SIWA) / "Continue with Google" / password field prefilled with email + AutoFill. "Not you?" clears the hint.
- **D. Fresh** — PlaceLaunch → LoginView with `.username` field, `performAutoFillAssistedRequests()` armed (QuickType offers passkey/password), native SIWA button.

**Android**
- **A. Same install** — Splash → RootTabScreen (as today, plus proactive refresh).
- **B. Block Store restore** — `ContinueAsScreen` card; BiometricPrompt (BIOMETRIC_STRONG | DEVICE_CREDENTIAL) auto-shown; success → `POST /api/auth/restore` → RootTabScreen. Toast "Welcome back, Ying".
- **C. Hint present, grant rejected / step-up required / no biometric** — same card; Credential Manager `getCredential` sheet auto-launched (passkey → Google → saved password), email prefilled; "Not you?" clears Block Store.
- **D. Fresh** — LoginScreen opens the Credential Manager sheet once (passkey + Google ID + password options); fields carry autofill `ContentType`.
- **E. New device via D2D/cloud restore** (Phase 3) — Restore Credentials `GetRestoreCredentialOption` on first launch → silent sign-in → toast.

---

## 2. Components

```
 ┌───────────────────────── iOS (SwiftUI) ──────────────────────────┐  ┌──────────────────── Android (Compose) ─────────────────────┐
 │ AuthManager  ─ SessionRestoreCoordinator (L1→L2→L3 decision)      │  │ AuthRepository ─ SessionRestoreCoordinator                  │
 │  ├ KeychainStore  tokens · deviceId · sessionId · expiresAt        │  │  ├ TokenStorage (EncryptedPrefs; dies on uninstall — by design)│
 │  │                accountHint · appLockEnabled · SE key data       │  │  ├ AccountHintStore (Block Store, cloud-backed)             │
 │  ├ DeviceIdentity  SE P-256 device key + biometry-bound step-up key│  │  ├ DeviceIdentity (Keystore EC, StrongBox→TEE, step-up key  │
 │  ├ DeviceAttestor  App Attest (attest once per install, keyId)     │  │  │   userAuthRequired + invalidatedByBiometricEnrollment)   │
 │  ├ DPoPProofSigner  proof JWT for /refresh + step-up               │  │  ├ DeviceAttestor (Play Integrity standard + key attestation)│
 │  ├ InstallSentinel (UserDefaults) — detect reinstall, never wipe   │  │  ├ DPoPProofSigner                                          │
 │  ├ StepUpManager  (Face ID → SE sig → POST /step-up)              │  │  ├ StepUpManager (BiometricPrompt+CryptoObject → /step-up)   │
 │  └ Credential providers: SIWA native · PasskeyCoordinator · AutoFill│ │  └ Credential providers: CredentialManager (passkey/Google/  │
 │ Features/Auth/ContinueAsView · Settings/DevicesView · SecurityView │  │     password) · RestoreCredentials · ContinueAsScreen · Devices│
 └──────────────┬────────────────────────────────────────────────────┘  └───────────────┬────────────────────────────────────────────┘
                │ Authorization: Bearer <access>  X-Device-Id  DPoP: <proof> (refresh/step-up)              │
                ▼                                                                                            ▼
 ┌────────────────────────────────────────── Express backend ─────────────────────────────────────────────────────────────┐
 │ routes/users.js  (login · oauth/callback · oauth/token · oauth/native · refresh · logout · password · reset · account)     │
 │ routes/auth/  devices.js · sessions.js · restore.js · stepUp.js · passkeys.js · securityEvents.js   (mounted /api/auth)   │
 │ middleware/  verifyToken(+session revocation check) · requireDeviceProof · requireStepUp(maxAge)                           │
 │ services/auth/  sessionRegistry · deviceRegistry · dpop · attestation/{appAttest,playIntegrity,keyAttestation}             │
 │                 restoreGrants · sessionMinter (admin.generateLink→verifyOtp) · webauthn (SimpleWebAuthn) · securityNotifier │
 └──────────────┬──────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┘
                ▼                                              ▼
   Supabase Auth (GoTrue): sessions/refresh_tokens,     Postgres public schema (service_role RLS):
   rotation+reuse detection, signInWithIdToken,         auth_device · auth_session · auth_restore_grant · auth_proof_jti
   generateLink/verifyOtp, sessions.inactivity_timeout   auth_security_event · webauthn_credential · PushToken(+device_id)
                ▲                                              ▲
   Apple App Attest / DeviceCheck ────────┘        Google Play Integrity decode API / Key attestation CRL ─┘
```

**Why our own registry when GoTrue has `auth.sessions`?** GoTrue has no admin API to list/revoke one user's sessions, its access tokens stay valid until `exp` after revocation, and it knows nothing about devices. We key our rows by the JWT `session_id` claim so the two stay joined, and we enforce revocation ourselves per request.

---

## 3. Data model (Supabase Postgres, `public`, RLS service_role only; new migration `1xx_auth_devices_sessions.sql`)

```sql
-- One row per (user, install). iOS device_id survives reinstall (Keychain); Android gets a new row per
-- install, linked to the old one through restored_from_device_id when a restore grant is redeemed.
create table auth_device (
  id                       uuid primary key,                       -- client-generated UUIDv4 (installId)
  user_id                  uuid not null references "User"(id) on delete cascade,
  platform                 text not null check (platform in ('ios','android')),
  model                    text, os_version text, app_version text,
  display_name             text,                                   -- "Ying's iPhone 15 Pro"
  public_key_jwk           jsonb,                                  -- device signing key (P-256)
  key_kind                 text check (key_kind in ('secure_enclave','strongbox','tee','software','none')),
  stepup_public_key_jwk    jsonb,                                  -- biometry-bound key (null until enrolled)
  attestation_kind         text check (attestation_kind in ('app_attest','play_integrity','key_attestation','none')),
  attestation_verified_at  timestamptz,
  attestation_meta         jsonb,                                  -- appAttest keyId/receipt digest, integrity verdict summary
  trust_level              text not null default 'unverified'      -- 'trusted' | 'unverified' | 'suspect'
                           check (trust_level in ('trusted','unverified','suspect')),
  app_lock_enabled         boolean not null default false,
  restored_from_device_id  uuid references auth_device(id),
  first_seen_at            timestamptz not null default now(),
  last_seen_at             timestamptz not null default now(),
  last_ip inet, last_geo text,
  revoked_at               timestamptz, revoke_reason text
);
create index on auth_device (user_id) where revoked_at is null;

-- One row per Supabase session (JWT session_id). Web rows have device_id null.
create table auth_session (
  id                       uuid primary key,                       -- = access_token.session_id
  user_id                  uuid not null references "User"(id) on delete cascade,
  device_id                uuid references auth_device(id) on delete cascade,
  platform                 text not null check (platform in ('ios','android','web')),
  bound                    boolean not null default false,         -- refresh requires DPoP proof
  refresh_token_hash       text,                                   -- sha256(base64url) of latest issued refresh token
  prev_refresh_token_hash  text,                                   -- tolerate Supabase "fail-to-save" reuse of the parent
  auth_method              text,                                   -- password|apple|google|passkey|restore_grant|magiclink
  created_at               timestamptz not null default now(),
  last_refreshed_at        timestamptz, last_seen_at timestamptz, last_ip inet, last_ua text,
  step_up_at               timestamptz, step_up_method text,
  revoked_at               timestamptz, revoke_reason text          -- user_logout|remote|signout_all|password_change|reuse|proof_failed|admin|inactivity
);
create index on auth_session (user_id) where revoked_at is null;
create index on auth_session (device_id);

-- Opaque single-use grants that let a device recover a session without a password (Android Block Store; iOS fallback).
create table auth_restore_grant (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references "User"(id) on delete cascade,
  device_id uuid references auth_device(id) on delete cascade,
  grant_hash text not null unique,                                 -- sha256 of 32-byte secret; secret never stored
  kind text not null check (kind in ('blockstore','keychain')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,                                 -- 90 d
  used_at timestamptz, revoked_at timestamptz
);

create unlogged table auth_proof_jti (jti text primary key, expires_at timestamptz not null);   -- DPoP replay cache (10 min TTL)

create table auth_security_event (
  id bigserial primary key,
  user_id uuid not null, session_id uuid, device_id uuid,
  type text not null,   -- login|device_enrolled|device_restored|refresh_reuse|proof_failed|session_revoked|signout_all|
                        -- password_changed|stepup|passkey_added|passkey_removed|new_device_notified
  ip inet, ua text, geo text, meta jsonb, created_at timestamptz not null default now()
);
create index on auth_security_event (user_id, created_at desc);

create table webauthn_credential (                               -- passkeys + Android restore keys (same RP code)
  id text primary key,                                           -- base64url credentialId
  user_id uuid not null references "User"(id) on delete cascade,
  public_key bytea not null, counter bigint not null default 0,
  transports text[], aaguid uuid, backed_up boolean, be boolean,
  kind text not null check (kind in ('passkey','restore_key')),
  device_id uuid references auth_device(id) on delete set null,
  name text, created_at timestamptz default now(), last_used_at timestamptz
);

alter table "User" add column sessions_revoked_at timestamptz;      -- any session with iat < this is dead
alter table "User" add column security_prefs jsonb not null default '{}'::jsonb;
   -- { requireUnlockOnReinstall: bool, allowRestoreGrants: bool(default true), newDeviceEmail: bool(default true) }
alter table "PushToken" add column device_id uuid references auth_device(id) on delete cascade;

-- Hard-revoke helper: GoTrue has no admin "revoke session by id"; delete the row (cascades refresh_tokens).
create or replace function auth_admin_revoke_session(p_session uuid) returns void
language sql security definer set search_path = auth as $$ delete from auth.sessions where id = p_session; $$;
```

`supabase/config.toml`: `[auth.sessions] inactivity_timeout = "4320h"` (180 d — Instagram-style "forever while you use it"; enforced at next refresh), no `timebox`; keep `enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10`. Web policy stays 7 d refresh cookie / 30 d flag.

Retention: `auth_security_event` 180 d, `auth_proof_jti` 10 min, revoked `auth_session`/`auth_device` rows 90 d then purged.

---

## 4. Backend endpoints (request/response shapes)

Common client-supplied `device` object (login-family requests, enroll, restore):
```json
"device": { "id":"<uuidv4>", "platform":"ios|android", "model":"iPhone16,1", "osVersion":"18.4", "appVersion":"1.12.0",
            "name":"Ying's iPhone", "publicKeyJwk":{ "kty":"EC","crv":"P-256","x":"…","y":"…" }, "keyKind":"secure_enclave",
            "attestation": { "kind":"app_attest", "keyId":"…", "attestationObject":"<b64>", "challengeId":"…" }
                        /* or {"kind":"play_integrity","token":"…","keyAttestationChain":["<b64 der>",…],"challengeId":"…"} */,
            "appLockEnabled": false }
```
Common session block in every token response (mobile transport):
```json
{ "accessToken":"…","refreshToken":"…","expiresIn":3600,"expiresAt":1755555555,
  "session":{ "id":"<session_id>","bound":true,"stepUpAt":null },
  "device":{ "id":"…","trustLevel":"trusted","isNew":true },
  "restoreGrant":"<43-char base64url, Android only, when allowRestoreGrants>",
  "user":{…} }
```

| # | Route | Auth | Body → Response | Notes |
|---|---|---|---|---|
| 1 | `POST /api/users/login`, `/oauth/callback`, `/oauth/token` (modified) | none | + `device` → + `session`/`device`/`restoreGrant` | Old clients omit `device` → session created with `bound=false`. `/oauth/token` now verifies the supplied refresh token pairs with the access token by decoding `session_id` after a server-side `refreshSession` and returns the *rotated* pair. |
| 2 | `POST /api/users/oauth/native` (new) | none | `{provider:'apple'|'google', idToken, nonce?, accessToken?, device}` → token response | `scopedClient.auth.signInWithIdToken`; same enrollment path; requires Supabase apple/google provider configured with the native client IDs. |
| 3 | `POST /api/users/refresh` (modified) | none + `DPoP` header when `bound` | `{refreshToken, deviceId?}` → token response | 401 codes: `TOKEN_REUSE`, `SESSION_REVOKED`, `DEVICE_REVOKED`, `PROOF_INVALID`, `PROOF_REQUIRED`, `SESSION_EXPIRED`. Full algorithm §5.4. |
| 4 | `POST /api/auth/device/challenge` | none | `{purpose:'enroll'|'restore'|'stepup'}` → `{challengeId, challenge:"<b64 32B>", expiresIn:300}` | Nonce for App Attest `clientDataHash`, Play Integrity `requestHash`, key-attestation challenge, step-up. Stored in `auth_proof_jti`-style short table / memory. |
| 5 | `POST /api/auth/device/enroll` | verifyToken | `{device}` → `{device, session:{id,bound:true}, restoreGrant?}` | Upgrades an *existing* (unbound) session to bound; also re-attests after iOS reinstall (App Attest keyId gone) or key rotation. Idempotent on `device.id`. |
| 6 | `POST /api/auth/restore` | none (rate-limited 5/15 min per user, 10/15 min per IP) | `{grant, device}` → token response (+ fresh `restoreGrant`) | Redeems a Block Store grant. 401 `GRANT_INVALID` (generic for expired/used/revoked); 403 `STEP_UP_REQUIRED` `{hint:{maskedEmail, methods:['passkey','google','apple','password']}}` when grant age > 60 d, `security_prefs.allowRestoreGrants=false`, or integrity verdict < `MEETS_DEVICE_INTEGRITY`. |
| 7 | `GET /api/auth/sessions` | verifyToken | → `{sessions:[{id, deviceId, name, platform, model, current, bound, trustLevel, authMethod, createdAt, lastSeenAt, lastGeo}]}` | Web sessions listed too (name from UA). |
| 8 | `DELETE /api/auth/sessions/:id` | verifyToken + requireStepUp(10 min) unless `:id` is current | → `{ok:true}` | Revokes session + device (if last session on device) + its restore grants + PushTokens; socket kick. |
| 9 | `POST /api/auth/sessions/revoke-all` | verifyToken + requireStepUp | `{keepCurrent:true}` → `{revoked:n}` | Sets `User.sessions_revoked_at`, deletes other `auth.sessions`, revokes all grants, `admin.signOut(current,'others')`. |
| 10 | `POST /api/users/logout` (modified) | optional Bearer | `{scope:'local'|'others'|'global', forget:false}` → `{ok:true}` | Marks `auth_session.revoked_at`, `auth_admin_revoke_session`, deletes this device's PushToken, revokes this device's grants when `forget=true` or `scope!='local'`. |
| 11 | `POST /api/auth/step-up` | verifyToken | `{method:'device_key', challengeId, proof}` \| `{method:'password', password}` \| `{method:'passkey', assertion}` → `{stepUpAt, validForSec:300}` | Sets `auth_session.step_up_at`. `requireStepUp(maxAgeSec)` middleware guards `DELETE /account`, `POST /password`, payouts/Stripe payout routes, `DELETE /sessions/:id`, `revoke-all`, passkey add/remove, `PATCH /security-prefs`. Replaces the stateless `/reauthenticate` (kept as alias → `method:'password'`). |
| 12 | `POST /api/auth/passkeys/register/options` · `/register/verify` | verifyToken + requireStepUp | WebAuthn (SimpleWebAuthn), `kind:'passkey'|'restore_key'` | RP ID `pantopus.com`, origins: `https://pantopus.com`, `https://www.pantopus.com`, `android:apk-key-hash:<sig>`, iOS via AASA. |
| 13 | `POST /api/auth/passkeys/login/options` · `/login/verify` | none | `{assertion, device}` → token response | Session minted via `sessionMinter` (see below); enrolls device. |
| 14 | `GET /api/auth/passkeys` · `DELETE /api/auth/passkeys/:id` | verifyToken (+step-up on delete) | | |
| 15 | `GET /api/auth/security-events?limit=50` | verifyToken | → `{events:[…]}` | "Login activity" screen. |
| 16 | `PATCH /api/auth/security-prefs` | verifyToken + requireStepUp | `{requireUnlockOnReinstall?, allowRestoreGrants?, newDeviceEmail?}` | Toggling `allowRestoreGrants=false` revokes all grants. |
| 17 | `POST /api/users/password`, `/reset-password` (modified) | | after update: `revoke-all(keepCurrent)` semantics + email "Password changed; other devices signed out" | |
| 18 | `DELETE /api/users/account` (modified) | verifyToken + requireStepUp(5 min) | before `admin.deleteUser`: revoke every session/device/grant/push token/passkey | |

**`sessionMinter`** (used by restore, passkey login, and future magic links): `supabaseAdmin.auth.admin.generateLink({type:'magiclink', email})` → `scopedClient.auth.verifyOtp({token_hash: props.hashed_token, type:'magiclink'})` → Supabase session with a real `session_id`. No password, no email sent. `auth_method` recorded on the `auth_session` row.

**`verifyToken` (modified)**: verify JWT locally (Supabase JWKS / `SUPABASE_JWT_SECRET`) → `{sub, session_id, iat, exp}` → look up `auth_session` (15 s in-process cache, mirror of the 60 s role cache) → 401 `SESSION_REVOKED` if `revoked_at` set or `iat < User.sessions_revoked_at`; keep the existing `getUser` call behind a flag until Phase 2 soak, then drop it (saves one Supabase round trip per request). Attaches `req.session = {id, deviceId, bound, stepUpAt}`. `optionalAuth` and `chatSocketio` reuse the same helper; on revoke the backend emits `auth:session_revoked {sessionId}` to the user's socket room and disconnects matching sockets.

**Rate limiters** (per-user where a user is known, per-IP otherwise): `/restore` 5/15 min/user, `/step-up` 10/15 min/user, `/device/enroll` 10/h/user, `/passkeys/login/*` 20/15 min/IP; existing limiters unchanged.

---

## 5. Flows

### 5.1 First login on a device (email/password shown; native SIWA / Google / passkey identical after the credential step)

```
 iOS/Android                                   Backend                                    Supabase / Apple / Google
 ────────────                                  ───────                                    ─────────────────────────
 1. DeviceIdentity.ensure(): installId (UUID),
    device key (SE / Keystore, StrongBox→TEE)
 2. POST /api/auth/device/challenge {enroll} ─▶ store nonce ────────────────────────────▶ (none)
 3. App Attest: generateKey → attestKey(SHA256(nonce))
    Android: Play Integrity token(requestHash=SHA256(nonce‖pubkey)) + key-attestation chain
 4. POST /api/users/login {email,password,device} ─▶ signInWithPassword ─────────────────▶ GoTrue: session S, refresh R0
                                               verify attestation (Apple root / Play decode+CRL)
                                               upsert auth_device (trust_level)
                                               insert auth_session {id=S, device, bound=true,
                                                 refresh_token_hash=H(R0), auth_method}
                                               isNew device? → security_event login/device_enrolled,
                                                 email+push "New sign-in on iPhone 15 Pro · San Francisco" (skip if
                                                 restored_from_device_id or same model+trust within 30 d)
                                               mint restoreGrant (Android) ◀──────────────
 5. ◀── {tokens, session, device, restoreGrant?, user}
 6. persist: tokens, sessionId, expiresAt, deviceId, accountHint (name/avatar/maskedEmail/lastMethod)
    Android: Block Store ← {v:1, uid, name, avatar, maskedEmail, lastMethod, lock, grant} (cloud backup on)
    iOS: InstallSentinel.mark(); Keychain accountHint
 7. Post-login: (a) one-time "Enable Face ID lock?" (existing) (b) on 2nd sign-in / after first payout: "Add a passkey?"
    (iOS 18: try automatic passkey upgrade `.conditional` silently after a password AutoFill login)
```

### 5.2 Cold start (same install) and reinstall — decision tree

```
                       app launch
                           │
              ┌────────────▼─────────────┐
              │ tokens in secure store?  │
              └───────┬─────────┬────────┘
                    yes         no
                     │           └────────────────────────────┐
        ┌────────────▼──────────────┐                         │
        │ InstallSentinel present?  │ (iOS: missing ⇒ reinstall│
        └────┬────────────────┬─────┘  Android: n/a — tokens  │
           yes               no          never survive)       │
            │                 │                               │
            │        ┌────────▼─────────┐            ┌────────▼───────────┐
            │        │ appLockEnabled   │            │ account hint?      │
            │        │ (Keychain) OR    │            │ iOS: Keychain hint │
            │        │ requireUnlockOn  │            │ Android: Block     │
            │        │ Reinstall OR     │            │ Store payload      │
            │        │ lastSeen>30d ?   │            └───┬───────────┬────┘
            │        └───┬─────────┬────┘              yes           no
            │          yes         no                    │            │
            │           │           │        ┌───────────▼─────┐   ┌──▼─────────────────┐
            │  ┌────────▼───────┐   │        │ grant present & │   │ L3: Login with     │
            │  │ B: ContinueAs  │   │        │ platform=android│   │ AutoFill/passkey/  │
            │  │ + Face ID /    │   │        └──┬──────────┬───┘   │ CredMgr sheet/SIWA │
            │  │ biometric      │   │          yes         no      └────────────────────┘
            │  └────────┬───────┘   │           │           │
            │           │           │  ┌────────▼───────┐ ┌─▼──────────────────────┐
            └───────────┴───────────┘  │ B: ContinueAs  │ │ C: ContinueAs + passkey│
                        │              │ + biometric →  │ │ /SIWA/Google/password  │
              ┌─────────▼──────────┐   │ POST /restore  │ │ (email prefilled)      │
              │ L1: proactive      │   └────────┬───────┘ └────────────────────────┘
              │ refresh if         │            │ 403 STEP_UP_REQUIRED / 401 → C
              │ expiresAt-now<5min │            │ 200 → persist, new grant, in
              │ (DPoP), GET profile│            ▼
              │ → RootTab          │
              └────────────────────┘
```
Rules: `restoreSession()` now (a) attempts a refresh when only a refresh token exists (today it bails to `.signedOut`), (b) keeps the offline-first behavior (transient → cached user), (c) treats 401 codes `SESSION_REVOKED|DEVICE_REVOKED|TOKEN_REUSE` as *security sign-out*: wipe tokens, clear hint if `forget=true` in the body, and show the "You were signed out of this device for security" banner state on the login card. Foreground (`scenePhase .active` / `onStart`): proactive refresh if `< 5 min` left; iOS also runs `ASAuthorizationAppleIDProvider.getCredentialState` when `lastMethod=apple` and signs out on `.revoked`.

### 5.3 Reinstall on the same device — side by side

```
 iOS                                                   Android
 ───                                                   ───────
 Keychain: tokens, deviceId, SE device key,            EncryptedPrefs + Keystore: gone (by design; also excluded
   accountHint, appLockEnabled  → all survive            from backup/D2D). Block Store: {hint, grant} survives
 UserDefaults sentinel: gone → "reinstall detected"       when Google Backup is on.
 App Attest keyId: gone (Apple deletes on reinstall)   New installId + new Keystore key + Play Integrity token
   → re-attest lazily on next /device/enroll (idempotent
     on device.id; server keeps trust_level, updates key)
 A/B path per §5.2 → refresh with DPoP → in            B path: ContinueAs card → BiometricPrompt →
 Server: same auth_device row, same auth_session;        POST /api/auth/restore {grant, device}
   security_event 'reinstall_restore', no email        Server: grant valid & unused & user.sessions_revoked_at < grant.created_at
                                                          & integrity ≥ DEVICE → sessionMinter → new auth_session(bound)
                                                          new auth_device{restored_from_device_id=old} → old device row
                                                          marked superseded (revoked_at, reason 'superseded'), its
                                                          sessions revoked, grant used_at=now, new grant issued
                                                        No new-device email (lineage proven by grant); event 'device_restored'
```
If the user has **Google Backup off** or **no screen lock** (Block Store E2EE unavailable): the write fails/degrades → we don't store the grant, only the non-secret hint via `setShouldBackupToCloud(false)` if allowed; reinstall then lands on C/D (Credential Manager). That is the honest limit of Android.

### 5.4 Token refresh + rotation with device binding (DPoP-style proof, RFC 9449 shape)

```
 Client                                                          Backend
 ──────                                                          ───────
 need refresh (401, or expiresAt-now<5min, single-flight)
 proof = JWS(ES256, header{typ:"dpop+jwt", jwk:<device pub>},
             claims{htm:"POST", htu:"https://api…/api/users/refresh",
                    iat, jti:uuid, rth: b64u(sha256(refreshToken)), did: deviceId})
 POST /api/users/refresh  DPoP: <proof>  {refreshToken, deviceId}
                                                        1. h = sha256(refreshToken); find auth_session where
                                                           refresh_token_hash = h OR prev_refresh_token_hash = h
                                                           (miss ⇒ legacy/unbound: skip to 4 if binding not enforced
                                                            for this app version, else 401 PROOF_REQUIRED)
                                                        2. session.revoked_at / user.sessions_revoked_at / device.revoked_at
                                                           ⇒ 401 SESSION_REVOKED | DEVICE_REVOKED (no Supabase call)
                                                        3. if bound: verify proof against auth_device.public_key_jwk:
                                                           sig ok, htm/htu match, |now-iat| ≤ 300s, jti unseen (auth_proof_jti),
                                                           rth == h, did == session.device_id  ⇒ else 401 PROOF_INVALID
                                                           (2nd PROOF_INVALID within 10 min ⇒ revoke session, reason proof_failed,
                                                            device.trust_level='suspect', event + push "Suspicious activity")
                                                        4. scopedClient.auth.refreshSession({refresh_token})
                                                           GoTrue error /already used|not found/ ⇒ TOKEN_REUSE:
                                                             revoke auth_session (reason 'reuse'), auth_admin_revoke_session,
                                                             device 'suspect', event refresh_reuse, email+push
                                                             "We signed you out of <device> for security" ⇒ 401 TOKEN_REUSE
                                                           other error ⇒ 401 SESSION_EXPIRED
                                                        5. decode new access token: session_id must equal session.id
                                                           (mismatch ⇒ admin.signOut(newAccess,'local'), 401 SESSION_REVOKED)
                                                        6. update auth_session: prev_hash=refresh_token_hash,
                                                           refresh_token_hash=sha256(newRefresh), last_refreshed_at, last_ip/ua;
                                                           auth_device.last_seen_at
 ◀── 200 {accessToken, refreshToken, expiresIn, expiresAt, session:{id,bound,stepUpAt}}
 persist BOTH tokens before releasing single-flight (crash between = Supabase parent-reuse tolerance + our prev_hash)
 reconnect socket with new token
```
Access tokens stay 1 h. Every authenticated request carries `X-Device-Id` (informational; enforcement is at refresh + per-request revocation check). Web keeps cookie refresh, unbound, 7 d.

### 5.5 Logout — this device / all devices

```
 "Sign out" (this device)                                "Sign out of all devices" (Settings ▸ Security)
 ────────────────────────                                ──────────────────────────────────────────────
 POST /logout {scope:'local', forget:false}              step-up (Face ID → SE step-up sig → /step-up)
   auth_session.revoked_at=now (user_logout)             POST /api/auth/sessions/revoke-all {keepCurrent:true}
   auth_admin_revoke_session(id)                            User.sessions_revoked_at=now
   delete PushToken where device_id                         delete auth.sessions where user_id and id<>current
   (forget=true also revokes device grants + clears hint)   revoke all auth_restore_grant, delete other PushTokens
 client: wipe tokens/sessionId/expiresAt, keep deviceId     admin.signOut(current,'others'); event signout_all
   & device key & accountHint (unless "forget"),            socket rooms: emit auth:session_revoked → clients wipe
   Android: keep Block Store hint but drop `grant` field   email "You signed out of all other devices"
   iOS: unregister APNs token; purge URLCache
   → login card shows "Continue as Ying" (L2/L3, credential required)
```
Product rule: plain sign-out *remembers the account* (Instagram behaviour); "Not you?"/"Forget this account" is explicit.

### 5.6 Stolen device / remote revoke

```
 Owner on web or another phone: Settings ▸ Security ▸ Devices
   ├ "iPhone 15 Pro · last seen 3 min ago · San Francisco"  [Sign out]  → step-up → DELETE /api/auth/sessions/:id
   │     server: auth_session.revoked_at (remote); device.revoked_at; auth_admin_revoke_session; grants revoked;
   │             PushToken deleted; socket kick; event; email "Signed out iPhone 15 Pro"
   └ "Sign out of all devices" + "Change password" (password change itself does revoke-others)
 Thief's phone: next HTTP → verifyToken 401 SESSION_REVOKED (≤15 s cache) → client wipes tokens + hint (forget=true),
   shows sign-in with "signed out for security"; socket already disconnected; next refresh 401 DEVICE_REVOKED;
   Block Store grant dead (revoked) → Continue-as-X falls to credential; app lock (Keychain-persisted) still gates UI
   until then; money/step-up needs biometry-bound key the thief cannot satisfy.
```
Also: user-facing "Not you?" link in the new-device email deep-links to `https://pantopus.com/security/devices?highlight=<deviceId>` (universal link → DevicesView).

### 5.7 Password change / reset

`POST /password` and `/reset-password`: after `admin.updateUserById` → same as `revoke-all(keepCurrent=true for /password; keepCurrent=false for reset-from-email)`, revoke all restore grants (current device gets a fresh one in the response), event `password_changed`, email. Reset flow additionally sets `sessions_revoked_at` so *every* device including the thief's must re-authenticate.

### 5.8 Account deletion

`DELETE /account` requires `requireStepUp(300)` (device-key biometric or password or passkey). Before `admin.deleteUser`: revoke all sessions (`auth_admin_revoke_session` for each), delete grants, passkeys, devices, push tokens (`pushService.removeAllTokens` — finally used), emit socket kick. Client: `signOut(forget:true)`, `clearCredentialState` (Android), delete Keychain hint, DeviceCheck bit untouched.

### 5.9 Step-up (cryptographic Tier-2)

```
 SensitiveScreenGuard / requireStepUp 403 {code:'STEP_UP_REQUIRED', methods:[...]}
   iOS: LAContext + SE step-up key (SecAccessControl .biometryCurrentSet|.privateKeyUsage) signs {challengeId,sid,iat}
   Android: BiometricPrompt(CryptoObject(Signature)) with Keystore key (userAuthRequired, biometric strong,
            invalidatedByBiometricEnrollment) signs the same
   POST /api/auth/step-up {method:'device_key', challengeId, proof} → auth_session.step_up_at=now → retry original call
   Fallback methods: passkey assertion (phishing-resistant), password (existing /reauthenticate semantics)
   Key invalidated (new biometric enrolment) → 'STEPUP_KEY_INVALID' → re-enrol step-up key after password/passkey step-up
```
5-min client grace stays; the server is the authority (`step_up_at` age ≤ route policy).

---

## 6. Trust levels and what they buy

| trust_level | How obtained | Effects |
|---|---|---|
| `trusted` | Valid App Attest / Play Integrity `MEETS_DEVICE_INTEGRITY`+`PLAY_RECOGNIZED` / valid key-attestation chain (TEE/StrongBox) | Restore grants issued; 180 d inactivity; silent reinstall restore; step-up via device key |
| `unverified` | No attestation (old client, simulator, GMS-less device, attestation outage) | Session works; no restore grants; 30 d inactivity (enforced by our registry at refresh); step-up = password/passkey only |
| `suspect` | proof failures, TOKEN_REUSE, integrity `UNRECOGNIZED_VERSION`, appAccessRisk | Session revoked; device needs a fresh interactive login + new-device email; grants revoked |

Attestation is a *trust signal*, never a hard block (App Attest can't see jailbreaks; Play Integrity fails on Huawei/emulators/de-Googled ROMs).

---

## 7. Association files & entitlements (prerequisite for L3 — must be fixed first)

- `frontend/apps/web/public/.well-known/apple-app-site-association`: `applinks.details[].appIDs += "<TEAMID>.app.pantopus.ios"`, `webcredentials.apps += "<TEAMID>.app.pantopus.ios"` (keep the Expo id until it is retired).
- `frontend/apps/web/public/.well-known/assetlinks.json`: add target `app.pantopus.android` with **both** relations `delegate_permission/common.handle_all_urls` and `delegate_permission/common.get_login_creds`, fingerprints = Play App Signing cert + upload cert + debug cert (debug entry only on staging host).
- iOS `project.yml` (source of truth on `xcodegen generate`) `entitlements.properties`: `com.apple.developer.associated-domains += webcredentials:pantopus.com, webcredentials:www.pantopus.com, applinks:pantopus.com, applinks:www.pantopus.com` (re-add the .com applinks that regen currently drops), `com.apple.developer.applesignin = [Default]`, `com.apple.developer.devicecheck.appattest-environment = production` (development in Debug config).
- Android manifest: `<meta-data android:name="asset_statements" android:resource="@string/asset_statements"/>` pointing at `https://pantopus.com/.well-known/assetlinks.json`.
- Supabase Apple provider: add `app.pantopus.ios` to authorized client IDs; Google provider: add iOS/Android/web client IDs (`signInWithIdToken` audience).
- Update `docs/compliance/privacy-data-inventory.md` §2.6/§5 (new identifiers: device id, device model, IP/geo on session rows, Block Store payload) and regenerate App Store / Play data-safety labels.

---

## 8. Telemetry / SLOs

Events (client): `session_restore_ok{path:l1|l1_gated|l2_restore|l3_passkey|l3_google|l3_apple|manual, reinstall:bool}`, `continue_as_shown/accepted/declined`, `session_invalidated{code}`, `stepup_ok/fail{method}`, `passkey_enrolled`. Server: `auth.device_enrolled`, `auth.refresh_bound_ok/proof_invalid/reuse`, `auth.restore_redeemed/rejected`, `auth.session_revoked{reason}`. SLOs: reinstall→signed-in without password ≥ 95 % iOS / ≥ 85 % Android (Backup-on cohort); proof_invalid rate < 0.05 % of refreshes; p95 added latency on `/refresh` < 40 ms; revocation propagation p99 < 20 s.

## Backend changes
- Migration `backend/database/migrations/1xx_auth_devices_sessions.sql` (also mirrored under supabase/migrations): tables auth_device, auth_session, auth_restore_grant, auth_proof_jti (unlogged), auth_security_event, webauthn_credential; `User.sessions_revoked_at`, `User.security_prefs jsonb`; `PushToken.device_id`; SECURITY DEFINER `auth_admin_revoke_session(uuid)` that deletes from auth.sessions; RLS service_role only; retention jobs (security events 180 d, revoked rows 90 d, jti 10 min).
- `supabase/config.toml`: `[auth.sessions] inactivity_timeout = "4320h"` (mirror in the hosted project dashboard, Pro plan); keep rotation on / reuse interval 10 s; configure Apple provider with `app.pantopus.ios` and Google provider with native client IDs so `signInWithIdToken` works; enable google in local config for dev.
- New `backend/services/auth/sessionRegistry.js`: createFromSupabaseSession(session, {deviceId, platform, bound, authMethod, ip, ua}) (decodes JWT `session_id`), touchOnRefresh(oldHash→newHash), lookupByRefreshHash(h) (matches current or prev hash), revoke(sessionId, reason), revokeAllForUser(userId, {exceptSessionId}), isRevoked(sessionId, iat) with 15 s LRU cache + invalidate on revoke; emits `auth:session_revoked` to the user's socket room and disconnects matching sockets.
- New `backend/services/auth/deviceRegistry.js`: upsert(device payload, userId, trustLevel), markSeen, revoke, supersede(oldId→newId), listForUser; `backend/services/auth/dpop.js`: verifyProof(proofJws, {jwk, htm, htu, rth, did}) with iat window 300 s + jti insert-or-fail into auth_proof_jti; `backend/services/auth/attestation/appAttest.js` (verify attestation object: x5c chain to Apple App Attest root, nonce extension OID 1.2.840.113635.100.8.2, keyId==SHA256(pubkey), rpIdHash==SHA256(TEAMID.app.pantopus.ios), counter 0, aaguid appattest/appattestdevelop; store receipt digest), `playIntegrity.js` (decodeIntegrityToken via Google API, check requestHash, package app.pantopus.android, appIntegrity PLAY_RECOGNIZED, deviceIntegrity ≥ MEETS_DEVICE_INTEGRITY, timestamp freshness ≤ 10 min), `keyAttestation.js` (verify chain to Google root, challenge match, TEE/StrongBox security level, CRL check).
- New `backend/services/auth/restoreGrants.js`: issue(userId, deviceId, kind) → returns 32-byte base64url secret, stores sha256; redeem(secret) with constant-time hash lookup, single-use, expiry 90 d, revokedAt, and `User.sessions_revoked_at < created_at` check; revokeForDevice/revokeAllForUser. `backend/services/auth/sessionMinter.js`: mintSessionForUser(userId/email) = admin.generateLink({type:'magiclink'}) → verifyOtp({token_hash, type:'magiclink'}) on a per-request anon client → returns Supabase session. `backend/services/auth/securityNotifier.js`: new-device / signed-out-for-security / password-changed emails (existing SMTP) + push (existing pushService), dedupe rules (skip when restored_from_device_id set or same model+trust seen ≤30 d).
- `backend/routes/users.js` POST /login (~1603), /oauth/callback (~3925), /oauth/token (~3857): parse optional `device` body; when present verify attestation (Phase 2) and enroll device; always create auth_session row (bound = device present && key ok); include `session`, `device`, `restoreGrant` (Android + trusted + allowRestoreGrants) in the mobile JSON response; /oauth/token must call refreshSession with the supplied refresh token and return the rotated pair so a mismatched pair cannot be registered. New POST /oauth/native {provider, idToken, nonce, device} using scopedClient.auth.signInWithIdToken.
- `backend/routes/users.js` POST /refresh (1912-1958): implement §5.4 — hash lookup → revocation checks → DPoP proof verification when bound (or when `REQUIRE_DEVICE_BINDING_MIN_APP_VERSION` matches X-Client-Platform) → refreshSession → session_id equality check → hash rotation + last_seen; structured 401 codes TOKEN_REUSE / SESSION_REVOKED / DEVICE_REVOKED / PROOF_INVALID / PROOF_REQUIRED / SESSION_EXPIRED; TOKEN_REUSE and repeated PROOF_INVALID revoke the session, mark device suspect, write auth_security_event, notify user.
- `backend/routes/users.js` POST /logout (4263): accept `{scope:'local'|'others'|'global', forget}`; resolve session from Bearer/body access token JWT `session_id`; revoke in registry + auth_admin_revoke_session; delete PushToken rows for the device; revoke device grants when forget or scope != local; keep unauthenticated best-effort behaviour for old clients.
- `backend/routes/users.js` POST /password (1869) and POST /reset-password (3285, 3324): after the password update call sessionRegistry.revokeAllForUser (keep current for /password, none for reset), revoke restore grants (re-issue for current device in response), admin.signOut(scope 'others'/'global'), security event + email. DELETE /account (3970): add requireStepUp(300); before admin.deleteUser revoke all sessions/devices/grants/passkeys and pushService.removeAllTokens(userId).
- New router `backend/routes/auth/index.js` mounted at `/api/auth` (app.js ~306) with devices.js (POST /device/challenge, POST /device/enroll), sessions.js (GET /sessions, DELETE /sessions/:id, POST /sessions/revoke-all), restore.js (POST /restore), stepUp.js (POST /step-up; /api/users/reauthenticate becomes an alias for method 'password' that also stamps step_up_at), passkeys.js (register/login options+verify via @simplewebauthn/server, GET/DELETE), securityEvents.js (GET /security-events), prefs (PATCH /security-prefs); per-route express-rate-limit limiters added next to users.js:532-578.
- `backend/middleware/verifyToken.js`: verify JWT locally (jose + Supabase JWKS or SUPABASE_JWT_SECRET) to get sub/session_id/iat; consult sessionRegistry.isRevoked (15 s cache) → 401 {code:'SESSION_REVOKED'}; attach req.session {id, deviceId, bound, stepUpAt}; keep supabase.auth.getUser behind AUTH_VERIFY_MODE=remote|local flag during soak, drop after. New `backend/middleware/requireStepUp.js` (maxAgeSec) → 403 {code:'STEP_UP_REQUIRED', methods}. Apply the same revocation check in optionalAuth.js (15 s cache invalidation on revoke) and socket/chatSocketio.js handshake (154-172) plus a `session_revoked` disconnect hook.
- `backend/routes/notifications.js` POST /register + `services/pushService.js` saveToken: accept and store `deviceId`; DELETE /push-token unchanged; add pushService.removeTokensForDevice(deviceId) used by logout/revoke; wire removeAllTokens into revoke-all and account deletion.
- Feature flags / env: `AUTH_DEVICE_BINDING_MODE=observe|enforce`, `REQUIRE_DEVICE_BINDING_MIN_APP_VERSION`, `AUTH_VERIFY_MODE`, `RESTORE_GRANT_TTL_DAYS=90`, `RESTORE_GRANT_STEPUP_AFTER_DAYS=60`, `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON`, `APP_ATTEST_TEAM_ID/BUNDLE_ID/ENV`, `WEBAUTHN_RP_ID=pantopus.com`, `WEBAUTHN_ORIGINS`.
- Delete dead legacy helpers `backend/config/auth.js` and `backend/middleware/auth.js` (unused signOut/global) to avoid confusion with the new revocation code; update docs/01-authentication-authorization.md §1, docs/mobile/auth-backend-contracts.md §7 (TOKEN_REUSE wording, new codes, device fields), docs/interview/auth-session-security-deep-dive.md §7 (reinstall policy superseded), docs/compliance/privacy-data-inventory.md.
- Association files served by web: regenerate `frontend/apps/web/public/.well-known/apple-app-site-association` (add <TEAMID>.app.pantopus.ios to applinks + webcredentials) and `assetlinks.json` (add app.pantopus.android with handle_all_urls + get_login_creds and Play App Signing / upload SHA-256s); verify live with Apple's CDN and `adb shell pm verify-app-links` before Phase 3.

## iOS changes
- `Pantopus/Core/Auth/KeychainStore.swift`: extend SecureStoreKey with deviceId, sessionId, expiresAt, deviceKeyData (CryptoKit SE key dataRepresentation), stepUpKeyData, appAttestKeyId, accountHint (JSON: userId, displayName, avatarUrl, maskedEmail, lastMethod, appLockEnabled, updatedAt), appLockEnabled; keep `.afterFirstUnlockThisDeviceOnly` + non-synchronizable for tokens (survives reinstall on-device, never migrates); no sandbox entangling (we want survival) — add a `SecureStore.exists` helper.
- New `Pantopus/Core/Auth/InstallSentinel.swift`: UserDefaults marker written after first successful restore/login; `isReinstall = tokensPresent && !sentinel`; used only for the lock re-gate + telemetry (`session_restore_ok{reinstall:true}`), never to wipe (supersedes RN sentinel semantics).
- New `Pantopus/Core/Auth/DeviceIdentity.swift`: installId UUID (Keychain), device signing key `SecureEnclave.P256.Signing.PrivateKey` (created once, dataRepresentation in Keychain; software P-256 fallback on simulator with keyKind 'software'), step-up key with `SecAccessControlCreateWithFlags(.privateKeyUsage, .biometryCurrentSet)` and `LAContext` supplied via `authenticationContext`; exposes `publicKeyJWK`, `sign(_:)`, `signStepUp(_:context:)`, handles `errSecItemNotFound`/invalidated key by re-enrolling.
- New `Pantopus/Core/Auth/DeviceAttestor.swift`: `DCAppAttestService.shared` — generateKey → attestKey(keyId, clientDataHash: SHA256(challenge)) on first enrollment and after reinstall (keyId gone); stores keyId in Keychain; falls back to `attestation.kind='none'` when `isSupported == false`; optional `generateAssertion` for /step-up when the SE key path is unavailable.
- New `Pantopus/Core/Auth/DPoPProof.swift`: builds the ES256 JWS (typ dpop+jwt, jwk header; htm, htu, iat, jti, rth, did claims) with CryptoKit; unit-tested against fixed vectors.
- New `Pantopus/Core/Auth/AccountHintStore.swift` (read/write/clear the Keychain accountHint) and `SessionRestoreCoordinator.swift` (the §5.2 decision tree: returns .silent, .gated(hint), .hintOnly(hint, methods), .fresh).
- `Pantopus/Core/Auth/AuthManager.swift`: add `State.restorable(AccountHint, mode: .biometric | .credential)`; `restoreSession()` runs the coordinator, attempts refresh when only a refresh token exists, proactive refresh when `expiresAt - now < 300`, distinguishes 401 codes (SESSION_REVOKED / DEVICE_REVOKED / TOKEN_REUSE → `securitySignOut(forget:)` + `lastSecuritySignOutReason` for the banner); `persistLoginResponse` stores sessionId/expiresAt/deviceId/hint and calls `enrollDeviceIfNeeded()`; `performRefresh` attaches deviceId + DPoP header and persists both tokens before releasing the single-flight task; `signOut(scope:forget:)` calls POST /logout, unregisters APNs token, purges the `pantopus-http` URLCache, keeps deviceId/device key/hint unless forget; new `continueAs()` (LAContext → restore/refresh), `foregrounded()` (proactive refresh + SIWA credential-state check), `stepUp(method:)`.
- New `Pantopus/Core/Auth/StepUpManager.swift` (Face ID → SE step-up signature → POST /api/auth/step-up; fallback passkey/password; consumed by SensitiveScreenGuard and by a new `APIClient` 403 STEP_UP_REQUIRED interceptor that retries once after step-up), `AppleSignInCoordinator.swift` (native `ASAuthorizationAppleIDProvider` request with SHA-256 nonce → POST /api/users/oauth/native; `getCredentialState(forUserID:)` on foreground), `PasskeyCoordinator.swift` (ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: "pantopus.com"): registration after step-up, assertion for login, `performAutoFillAssistedRequests()` on LoginView appear, iOS 18 `.conditional` automatic upgrade after a password AutoFill login).
- `Pantopus/Core/Networking/Endpoints/AuthEndpoints.swift` + `Models/Auth/AuthDTOs.swift`: DevicePayload/AttestationPayload DTOs; login/oauth builders accept `device`; `refresh(refreshToken:deviceId:proof:)` with a per-request header (extend `Endpoint` with `headers: [String:String]`); new builders logout(scope:forget:), deviceChallenge, deviceEnroll, restore, sessions/list/revoke/revokeAll, stepUp, passkeys, oauthNative, securityEvents, securityPrefs; response DTOs SessionInfo, DeviceInfo, RestoreGrant, AuthErrorBody.code parsed into `APIError.unauthorized(code:)` / `.stepUpRequired(methods:)`.
- `Pantopus/Core/Networking/APIClient.swift`: add `X-Device-Id` header (298-307), pre-flight proactive refresh when expiresAt is within 5 min (before building the request), 403 STEP_UP_REQUIRED interceptor, surface 401 error codes; mirror in `MultipartUploader.swift`.
- `Pantopus/Core/Realtime/SocketClient.swift`: on socket auth error call `AuthManager.shared.refreshIfPossible()` then reconnect; subscribe to `auth:session_revoked` and call `AuthManager.shared.securitySignOut(forget: true)` when it matches the current sessionId.
- `Pantopus/App/PantopusApp.swift`: RootView switch adds `.restorable` → `ContinueAsView`; scenePhase `.active` → `authManager.foregrounded()`; `AppDelegate.swift`: send deviceId with POST /api/notifications/register, add `unregisterPushToken()` used by signOut, handle security push category deep link to Devices.
- `Pantopus/Core/Security/AppSecurity.swift`: AppLockManager `enabled` moves to Keychain (`appLockEnabled`) with UserDefaults migration; on reinstall (`InstallSentinel.isReinstall`) treat as locked when enabled; sync the flag to the server device row (`PATCH` via /device/enroll payload) and into accountHint; expose `verifyForContinueAs()` reusing `verifySensitiveAction`. `SensitiveScreenGuard.swift`: after local biometric success call StepUpManager so the server records step_up_at (money surfaces regain the guard per parity gap).
- New `Pantopus/Features/Auth/ContinueAsView.swift` (avatar + name + masked email card; modes biometric / credential; buttons: Continue with Face ID | passkey | Continue with Apple | Continue with Google | password field prefilled; 'Not you?' clears hint; security-sign-out banner) with `ContinueAsViewModel`; `Features/Auth/LoginView.swift`: email field `.textContentType(.username)`, native `SignInWithAppleButton` replacing the browser Apple button, passkey autofill-assisted request on appear, 'Sign in with passkey' button.
- New `Pantopus/Features/Settings/Security/DevicesView.swift` + `DevicesViewModel.swift` (ListOfRows archetype: device name, platform icon, 'This device', last seen/geo, swipe/‘Sign out’ → step-up → DELETE /api/auth/sessions/:id; footer 'Sign out of all devices'), `SecurityView.swift` (passkeys list/add/remove, 'Require Face ID after reinstall' toggle, 'Allow quick restore' toggle, Login activity), routes added to the You/Settings tab enum.
- `project.yml` entitlements.properties (source of truth) + `Pantopus/Resources/Pantopus.entitlements`: associated-domains += webcredentials:pantopus.com, webcredentials:www.pantopus.com, applinks:pantopus.com, applinks:www.pantopus.com; `com.apple.developer.applesignin` = [Default]; `com.apple.developer.devicecheck.appattest-environment` (development for Debug, production for Release); optional keychain-access-groups if widgets ever need the hint. `Info.plist`: NSFaceIDUsageDescription copy updated to cover sign-in ('unlock and continue as you').
- Tests: `PantopusTests/AuthManagerRestoreTests.swift` (decision tree: silent / gated / hintOnly / fresh; refresh-token-only restore; SESSION_REVOKED wipes + forget; TOKEN_REUSE banner state), `DPoPProofTests.swift` (claims, jti uniqueness, rth), `AuthManagerRefreshTests.swift` extended for deviceId + proof header + persist-before-release, `StepUpManagerTests.swift`, `ContinueAsViewModelTests.swift`; fixtures via InMemorySecureStore + SequencedURLProtocol.

## Android changes
- `gradle/libs.versions.toml` + `app/build.gradle.kts`: add androidx.credentials:credentials 1.5.x + credentials-play-services-auth, com.google.android.libraries.identity.googleid, com.google.android.gms:play-services-auth-blockstore:16.4.0, com.google.android.play:integrity 1.4.x, org.bouncycastle/… only if needed for JWS (prefer java.security + hand-rolled compact JWS); keep security-crypto for legacy prefs but new keys use raw Keystore.
- New `data/auth/DeviceIdentity.kt`: installId (UUID persisted in EncryptedPrefs, new per install), device key alias `pantopus.device.v1` via KeyGenParameterSpec(PURPOSE_SIGN, EC P-256, setAttestationChallenge(challenge), setIsStrongBoxBacked(true) with StrongBoxUnavailableException fallback → keyKind strongbox|tee|software), step-up key alias `pantopus.stepup.v1` with setUserAuthenticationRequired(true), setUserAuthenticationParameters(0, AUTH_BIOMETRIC_STRONG), setInvalidatedByBiometricEnrollment(true); exposes publicKeyJwk, attestationChain, sign(bytes), stepUpSignature() for CryptoObject; recovers from KeyPermanentlyInvalidatedException by re-enrolment.
- New `data/auth/DeviceAttestor.kt`: `StandardIntegrityManager` prepared at app start (PantopusApplication) with cloud project number; `requestIntegrityToken(requestHash = sha256(challenge || publicKeyDer))` on enroll/restore; classic request fallback if standard unavailable; returns attestation payload {kind:'play_integrity', token, keyAttestationChain, challengeId} or {kind:'none'} on GMS-less devices.
- New `data/auth/DPoPProof.kt` (compact ES256 JWS: typ dpop+jwt, jwk header, htm/htu/iat/jti/rth/did) and `data/auth/AccountHintStore.kt` (Block Store: `Blockstore.getClient(ctx)`; key `pantopus.account_hint.v1`; payload Moshi JSON {v, uid, name, avatar, maskedEmail, lastMethod, lock, grant} ≤ 4 KB; `StoreBytesData.Builder().setShouldBackupToCloud(true)`; read at cold start; `deleteBytes` on forget/account deletion; write again without `grant` after plain sign-out).
- `data/auth/TokenStorage.kt`: persist expiresAt, sessionId, deviceId (device row id), stepUpAt; keep clear() semantics (tokens die on uninstall — desired) but do NOT clear deviceId/keys on plain sign-out; `accessTokenExpiresSoon()` helper for proactive refresh.
- `data/auth/AuthRepository.kt`: `restore()` → if no tokens: read Block Store hint → `State.Restorable(hint, mode)`; `continueAs()` (BiometricPrompt via AppLockManager crypto-less prompt → POST /api/auth/restore {grant, device} → persistLoginResponse; 403 STEP_UP_REQUIRED / 401 → mode = Credential); `persistLoginResponse` stores sessionId/expiresAt/deviceId, writes Block Store hint+grant, calls `enrollDeviceIfNeeded()`; `refreshTokens()` attaches deviceId + DPoP header (dedicated authRefresh client), parses error `code` (TOKEN_REUSE / SESSION_REVOKED / DEVICE_REVOKED / PROOF_INVALID) → `RefreshOutcome.AuthRejected(code)`; `signOut(scope, forget)` calls POST /api/users/logout, unregisters FCM token, `CredentialManager.clearCredentialState`, Block Store hint kept minus grant (or deleted when forget); new `securitySignOut(reason)` sets `lastSecuritySignOutReason` for the banner; `foregrounded()` proactive refresh; `stepUp(method)`; native Google sign-in `signInWithGoogleIdToken(idToken, nonce)` → POST /api/users/oauth/native.
- `data/auth/AuthInterceptor.kt`: add `X-Device-Id`; new `ProactiveRefreshInterceptor` (or logic in AuthInterceptor) that triggers the single-flight refresh when expiresAt < now+120 s before sending; `TokenAuthenticator.kt`: read the 401 JSON `code`, route TOKEN_REUSE/SESSION_REVOKED/DEVICE_REVOKED to `securitySignOut(code)` instead of silent signOut; `di/NetworkModule.kt`: provide DeviceIdentity/DeviceAttestor/StandardIntegrityManager/CredentialManager/BlockstoreClient singletons, add X-Device-Id interceptor to both clients, provide new `AuthSessionsApi`.
- `data/api/services/AuthApi.kt` + `data/api/models/auth/AuthDtos.kt`: DeviceDto/AttestationDto; login/oauth requests carry `device`; `refresh(@Header("DPoP") proof, @Body RefreshRequest(refreshToken, deviceId))`; new endpoints logout, oauth/native, auth/device/challenge, auth/device/enroll, auth/restore, auth/sessions (list/revoke/revoke-all), auth/step-up, auth/passkeys/*, auth/security-events, auth/security-prefs; response DTOs SessionInfoDto, DeviceInfoDto, restoreGrant, error body `code`.
- `ui/screens/RootViewModel.kt` + `ui/navigation/PantopusNavHost.kt`: new `AuthRepository.State.Restorable` branch → `ContinueAsScreen`; `MainActivity.onStart` → `authRepository.foregrounded()`; `MainActivity.onCreate` hosts the Credential Manager launcher (needs Activity context) and routes `https://pantopus.com/security/devices` deep link to DevicesScreen.
- New `ui/screens/auth/ContinueAsScreen.kt` + `ContinueAsViewModel.kt` (card: avatar, 'Continue as Ying', masked email; auto BiometricPrompt in Biometric mode; Credential Manager sheet (GetPublicKeyCredentialOption + GetGoogleIdOption(serverClientId, nonce, filterByAuthorizedAccounts=true) + GetPasswordOption) in Credential mode; 'Not you? Use another account' → forget; security banner). `ui/screens/auth/LoginScreen.kt`: `Modifier.semantics { contentType = ContentType.EmailAddress / Password }` autofill hints on the BasicTextFields, one-shot Credential Manager sheet on first open, 'Sign in with Google' button → GetSignInWithGoogleOption → oauth/native, 'Sign in with passkey' → GetPublicKeyCredentialOption; keep Custom Tabs OAuth as fallback.
- New `ui/screens/settings/security/DevicesScreen.kt` + `DevicesViewModel.kt` (ListOfRows: device rows with 'This device', last seen/geo, Sign out → step-up → DELETE sessions/:id; 'Sign out of all devices'), `SecurityScreen.kt` (passkeys add/remove via CreatePublicKeyCredentialRequest, 'Require unlock after reinstall', 'Allow quick restore', Login activity); ChildRoutes constants + composables in RootTabScreen; testTags mirrored with iOS accessibilityIdentifiers.
- `core/security/AppLockManager.kt`: `prompt(cryptoObject: BiometricPrompt.CryptoObject?)` variant used by StepUpManager (Signature over the server challenge); `verifySensitiveAction` now also performs the server step-up; app-lock `enabled` mirrored into Block Store hint (`lock`) and to the server device row so a reinstall re-gates. New `core/security/StepUpManager.kt`.
- `push/PushTokenSyncer.kt` / `PantopusMessagingService.kt`: include deviceId in registerPushToken; `unregister()` on sign-out; handle security push (deep link to Devices). `AndroidManifest.xml`: `asset_statements` meta-data; keep allowBackup=false and token exclusions (Block Store is GMS-side, not app files); Phase 3 evaluates enabling a `BackupAgent` with allowBackup=true + full exclusions purely to receive `onRestoreFinished` for Restore Credentials.
- Phase 3 `data/auth/RestoreCredentialsManager.kt`: after sign-in call `createCredential(CreateRestoreCredentialRequest(registrationJson from /passkeys/register/options kind='restore_key', isCloudBackupEnabled=true))` (retry false on E2eeUnavailableException); on first launch with no tokens and no Block Store hint call `getCredential(GetRestoreCredentialOption(authJson))` → POST /passkeys/login/verify; `clearCredentialState(TYPE_CLEAR_RESTORE_CREDENTIAL)` on sign-out.
- Tests: `AuthRepositoryTest` restore matrix extended (Restorable from Block Store, continueAs success/step-up/invalid, security sign-out codes, refresh-token-only restore), `TokenAuthenticatorTest` (code routing), `DPoPProofTest`, `AccountHintStoreTest` (fake BlockstoreClient), `DevicesViewModelTest`, Paparazzi baselines for ContinueAsScreen/DevicesScreen, instrumented `DeviceIdentityTest` (Keystore key survives process restart; step-up key requires auth).

## Threat model
- Refresh token exfiltrated (backup, malware, MITM, log leak) → sender-constrained: /refresh requires a DPoP proof from the SE/Keystore key registered for that session (rth = hash of the presented token, jti replay cache, 5-min iat window); off-device replay fails PROOF_INVALID; two failures revoke the session, mark the device suspect, notify the user; Supabase rotation + our refresh_token_hash/prev_hash close the 'thief wins the race' gap.
- Access token (1 h) replayed after revocation → verifyToken/optionalAuth/socket check the auth_session registry (15 s cache) and User.sessions_revoked_at on every request; socket kick on revoke; so revocation propagates in ≤15 s instead of up to 1 h.
- Stolen unlocked phone (thief inside the app) → owner revokes the device from web/other phone (Devices list) or 'Sign out everywhere'/password change; app lock preference persists in Keychain/server so reinstall cannot bypass it; money/destructive actions need cryptographic step-up (biometry-bound SE/Keystore key or passkey) the thief cannot satisfy; the thief cannot add a passkey, change email/password, or delete the account without step-up.
- Reinstall-to-bypass-app-lock → InstallSentinel detects reinstall; appLockEnabled lives in Keychain + auth_device.app_lock_enabled + Block Store `lock` flag; gated 'Continue as X' path always requires biometric.
- Block Store restore grant abused (Google account takeover, cloud restore onto attacker device) → grant is opaque, hashed at rest, single-use, 90-day TTL, requires Play Integrity ≥ MEETS_DEVICE_INTEGRITY + PLAY_RECOGNIZED at redemption, biometric-gated on the client, revoked by sign-out-everywhere/password change/remote revoke, step-up required after 60 days, per-user opt-out ('Allow quick restore'), and any restore that cannot prove lineage triggers the new-device email/push.
- Emulator/bot farms enrolling 'trusted' devices → App Attest (SE key, per-install attestation, receipt fraud metric) and Play Integrity / key attestation at enrollment; unattested devices are 'unverified' (no restore grants, 30-day inactivity, no device-key step-up) — degrade, never block real users on GMS-less devices.
- DPoP proof pre-computation/replay → jti uniqueness table, iat window, htm/htu binding, rth binding to the exact refresh token, did binding to session.device_id; DPoP-Nonce header reserved for Phase 4 if abuse appears.
- Database read compromise → registry stores only public keys, SHA-256 hashes of refresh tokens/grants, no bearer secrets; Supabase refresh tokens remain in GoTrue; grants unusable without the 32-byte secret; passkeys public keys only.
- Session fixation via /oauth/token with a foreign refresh token → server refreshes the supplied token itself, verifies session_id equality with the verified access token, returns the rotated pair; mismatched pairs are rejected and revoked.
- Phishing of passwords → passkeys (origin-bound), native Sign in with Apple/Google via signInWithIdToken (nonce-bound), domain-associated Password AutoFill (webcredentials/get_login_creds); password remains available but is never the first offer once L2/L3 exist.
- Biometric enrollment tampering (attacker adds their face/finger) → step-up keys use biometryCurrentSet / setInvalidatedByBiometricEnrollment so they are invalidated; re-enrolment requires password or passkey step-up; app lock re-verifies.
- Apple silently changes Keychain-survives-uninstall behaviour → design does not depend on it: iOS falls to L2 (Keychain hint may also vanish → L3 AutoFill/passkey/SIWA); telemetry `session_restore_ok{path}` will show the shift immediately.
- Old clients / downgrade attack to unbound refresh → sessions issued without device are recorded bound=false; enforcement mode requires proof for app versions ≥ REQUIRE_DEVICE_BINDING_MIN_APP_VERSION and unbound sessions are sunset 60 days after the flip; new logins from old versions still work during the window.
- Enumeration/brute force on /restore, /step-up, /passkeys/login → per-user + per-IP limiters, constant-time hash compare, single generic GRANT_INVALID error, security events for repeated failures.
- Account deletion by an attacker holding a session → DELETE /account requires step-up ≤5 min (biometric key/passkey/password) and revokes everything before deleteUser; email notice sent.
- Insider/PII exposure in the new registry → IP/geo/UA retained 90–180 days only, service_role RLS, privacy inventory + store labels updated, device names user-editable and not derived from PII beyond model.

## Rollout
- Phase 0 — Foundations (1–2 weeks, no schema change): fix association files for the native identifiers (AASA appIDs + webcredentials for <TEAMID>.app.pantopus.ios; assetlinks for app.pantopus.android with handle_all_urls + get_login_creds and Play/upload SHA-256s); re-add pantopus.com applinks + webcredentials + applesignin + appattest entitlements in project.yml; Android asset_statements + Compose autofill ContentType hints; iOS `.username` + AutoFill; both clients: proactive refresh on foreground/expiry, call POST /logout on sign-out, unregister push on sign-out, structured 401 code parsing; iOS InstallSentinel (detect only) + accountHint + AppLock pref → Keychain (formal decision: reinstall auto-restores); docs updated (supersede RN sentinel policy). Ships as a normal release; strictly better than today.
- Phase 1 — Session/device registry + real revocation (2–3 weeks): migration (auth_device, auth_session, auth_security_event, User.sessions_revoked_at, PushToken.device_id); login/oauth/refresh record sessions (bound=false, device optional); verifyToken/optionalAuth/socket revocation check (AUTH_VERIFY_MODE soak: local+remote); logout scopes; GET/DELETE sessions + revoke-all; password change/reset revoke others; DELETE account revokes all; new-device email/push; Settings ▸ Security ▸ Devices on iOS and Android; SESSION_REVOKED handling + 'signed out for security' banner. Value: stolen-device remote sign-out and 'sign out everywhere' exist for the first time; zero UX friction added.
- Phase 2 — Device binding + attestation + Continue-as-X (3–4 weeks): SE/Keystore device keys, DPoP proof on /refresh (AUTH_DEVICE_BINDING_MODE=observe first: log mismatches for 2 weeks, then enforce for app versions ≥ min), App Attest / Play Integrity / key attestation at enrollment with trust levels; /device/challenge + /device/enroll (upgrade existing sessions in place, no re-login); Android Block Store hint + restore grants + ContinueAsScreen (biometric); iOS ContinueAsView gated path for locked accounts; step-up via device key (/step-up + requireStepUp on DELETE account, POST /password, payouts, revoke sessions, prefs) — restores the missing SensitiveScreenGuard on money surfaces natively; TOKEN_REUSE / PROOF_INVALID → suspect device + notifications. Ship iOS and Android independently behind remote flags.
- Phase 3 — OS credentials (3–4 weeks): native Sign in with Apple (+ getCredentialState) and Google Credential Manager Sign-in via POST /oauth/native (signInWithIdToken); passkeys RP (SimpleWebAuthn) with register-after-step-up, login, autofill-assisted requests on iOS, iOS 18 conditional automatic upgrade, Credential Manager sheet on Android; 'Add a passkey' nudge after 2nd sign-in / first payout; Android Restore Credentials (restore_key) for new-device D2D/cloud restore; Login activity screen; account switching (accountHint becomes a list; 'Switch account' in ContinueAs and You tab).
- Phase 4 — Hardening & cleanup (ongoing): drop remote getUser from verifyToken once local verification soak is clean; sunset unbound sessions 60 days after enforcement; DPoP-Nonce if replay abuse is observed; Redis (or Postgres LISTEN/NOTIFY) for revocation cache + jti across instances; DeviceCheck two bits / Play Device Recall for repeat-abuser marking; migrate to Supabase native passkeys if/when GA with kt sign-in support; evaluate DBSC for web; retire Expo appIDs from association files; privacy labels re-audit.

## Tradeoffs
- iOS silent restore after reinstall (0 gestures) vs. always gating with Face ID: we chose silent by default (Instagram/YouTube behaviour) because the tokens are device-bound, attested, and revocable, and gate only when the user opted into app lock / 'require unlock after reinstall' or the device is stale (>30 d). Cost: an attacker with an unlocked phone still gets in — mitigated by app lock persistence, remote revoke and cryptographic step-up for anything that moves money.
- Android Block Store restore grant vs. 'always re-authenticate after reinstall': the grant is a bearer secret held by Google's E2EE store; we accepted it because it is single-use, revocable, biometric-gated, integrity-checked, 90-day bounded, opt-out-able, and the alternative (Credential Manager only) makes reinstall need a passkey/Google account/password — still offered as the fallback. Users with Backup off or no screen lock get L3 only.
- Own session/device registry keyed by Supabase session_id vs. relying on GoTrue: adds one indexed lookup per request and dual bookkeeping, but GoTrue cannot list/revoke a user's sessions, cannot bind to devices, and honours access tokens until exp; deleting auth.sessions rows via a SECURITY DEFINER function is a documented community pattern but not a public API — pinned by integration tests.
- DPoP-style proof only on /refresh (and step-up), not on every request: keeps per-request cost and complexity low and avoids SE signing latency on hot paths; access tokens remain bearer for 1 h, covered by the revocation check. Full per-request DPoP is possible later without a schema change.
- Attestation as trust signal, not gate: App Attest cannot detect jailbreak, Play Integrity fails on GMS-less/de-Googled devices and during outages; blocking would strand real users. 'unverified' devices lose only the reinstall magic and device-key step-up.
- Own WebAuthn RP (SimpleWebAuthn) + magiclink-based session minting vs. Supabase experimental passkeys: Supabase passkeys are beta, supabase-kt has no sign-in, and we also need the same RP code for Android Restore Credentials; cost is owning credential storage and a later possible migration.
- sessionMinter uses admin.generateLink(magiclink) + verifyOtp to mint sessions without passwords: it is a widely used pattern but is an indirect API; if Supabase ships an admin 'create session' API we swap it behind the service.
- Keeping the account hint after plain sign-out (Instagram-style 'Continue as X') vs. wiping: better re-login, but shows the account name on a shared device; explicit 'Not you?/Forget this account' and 'sign out everywhere' clear it, and hints carry no secrets.
- Local JWT verification in verifyToken vs. current getUser round trip: faster and enables session_id checks, but requires JWKS/secret rotation handling and a soak period; we keep getUser behind a flag until Phase 4.
- 180-day inactivity timeout (mobile) vs. shorter: mobile 'forever while used' matches user expectations; unverified devices get 30 d via our registry; web stays 7 d — inconsistent by intent because web has no device binding.
- New identifiers (device id, model, IP/geo on sessions, Block Store payload) improve security UX but require privacy-inventory, App Store/Play label updates and retention rules; we bounded retention and made names user-editable.

## Open questions
- Apple Team ID and final iOS bundle/Play App Signing SHA-256 values for the regenerated AASA/assetlinks (project.yml DEVELOPMENT_TEAM is blank; assetlinks currently lists the Expo package) — who owns the live verification on pantopus.com apex + www?
- Supabase plan/version on the hosted project: are `[auth.sessions] inactivity_timeout` and refresh-token algorithm v2 available/enabled? (Affects whether 'fail-to-save' reuse tolerance comes from GoTrue or only from our prev_hash.) Is direct deletion from auth.sessions acceptable to the team, or do we prefer admin.signOut with a stored access token per session (which would require storing access tokens)?
- Android Restore Credentials with `allowBackup=false`: does the restore key still transfer on D2D/cloud restore, and is enabling a BackupAgent (with full exclusions) acceptable just to receive onRestoreFinished? Needs a device test on Pixel + Samsung before Phase 3 commits.
- Play Integrity setup: Google Cloud project linkage in Play Console, daily quota (10k default) vs. expected enrollment volume, and whether to request Device Recall beta; App Attest: production vs development environment mapping to TestFlight builds.
- Product decision on new-device notifications: email only, push only, or both; and whether to show a one-time 'Welcome back' toast on iOS silent reinstall restore or stay fully silent.
- Should 'Continue as X' after plain sign-out (hint kept) be the default, or should sign-out forget the account unless the user ticks 'Remember me'? (Design assumes Instagram default: remember.)
- Passkey RP strategy: own RP now and migrate to Supabase native passkeys later vs. wait for Supabase GA + supabase-kt sign-in — timeline for Phase 3 depends on this.
- Google Sign-in on iOS: keep browser OAuth via Supabase or add GoogleSignIn-iOS SDK for native one-tap parity with Android Credential Manager (design lists it as optional).
- Multi-account switching scope: how many remembered accounts per device (2? 5?), and does business/personal account_type need separate hints?
- Web parity: do we add web sessions to the Devices list only (yes in design) or also implement web-side proactive refresh/middleware fix now (deep-dive Finding 1) as part of Phase 1?
- Rate-limiter store: stay in-process (multiple backend instances weaken per-user limits and jti replay) or introduce Redis/Postgres-backed stores in Phase 2 rather than Phase 4?
