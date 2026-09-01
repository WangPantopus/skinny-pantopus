# Pantopus Persistent Login & Trusted Devices — Design

**Date:** 2026-08-18 · **Status:** Proposed (design only, no code) · **Scope:** native iOS, native Android, Express/Supabase backend, web where it must stay consistent
**Companion files:** [WORKLOG.md](WORKLOG.md) (progress), [WORKFLOW-RESULTS.md](WORKFLOW-RESULTS.md) (evidence, alternatives considered, verification status)

---

## 0. TL;DR — the direct answers

**"Secure OS storage + cloud credentials + server-side sessions — is that correct?"**
Yes, those are the right three pillars, and they map to three UX levels that look identical to the user but are very different technically. What is missing from that trio — and what actually separates Uber/Instagram-class auth from a naive "keep the refresh token in Keychain" — is a **fourth pillar: device binding + a trusted-device registry**. Concretely:

| Pillar | What it gives you | Pantopus implementation |
|---|---|---|
| 1. Secure OS storage | Session survives (iOS) / a resume hint survives (Android) on the same device | Keychain (`afterFirstUnlockThisDeviceOnly`, already in place) + Secure Enclave key; Android Block Store (single-use, hashed resume grant, no cloud copy) |
| 2. OS / cloud credentials | Zero-app-state recovery, phishing-resistant | `webcredentials:` + Password AutoFill, native Sign in with Apple, Android Credential Manager (Sign in with Google, saved passwords), passkeys (Supabase passkeys now primary-factor beta) |
| 3. Server-side sessions | Something the server can list, time out and revoke | Supabase sessions (already rotating) **plus** our own `AuthDevice` / `AuthSession` registry, `sessions_valid_after` watermark, sign-out-everywhere, per-device revoke |
| 4. Device binding + attestation | A stolen token is useless off the device that minted it | ES256 DPoP proof (RFC 9449) from a Secure Enclave / Android Keystore key required on `/refresh`; App Attest / Play Integrity / key attestation as graded trust signals |

**The design in one paragraph.** Keep Supabase Auth as the only session authority. Add one thin Pantopus-owned layer: a device registry keyed by a hardware key whose signed proof is required to refresh, a per-session table so sessions are listable/revocable, and a resume path for reinstall. **Reinstall is never a silent auto-login and never a forced wipe**: on iOS the refresh token and Secure Enclave key survive the uninstall (an install marker detects the reinstall) and the user sees *"Continue as Ying"* behind Face ID / passcode; on Android nothing survives, so a single-use, hashed, hardware-key-redeemable resume grant lives in Block Store and is redeemed behind BiometricPrompt into a *restored* session that cannot move money until a real credential is shown once; when even that is gone, the OS remembers the account (AutoFill / passkey / Sign in with Apple / Sign in with Google). Every phase reuses the existing `KeychainStore`, `TokenStorage`, `TokenAuthenticator`, `/refresh` and `/logout`, ships behind a flag, and keeps old clients working until an enforcement date.

**Three things to fix regardless of this design** (found while auditing):
1. Both native apps' `signOut()` are local-only — they never call `POST /api/users/logout`, so the Supabase session stays valid server-side.
2. The hosted `apple-app-site-association` and `assetlinks.json` still name the old Expo identifiers (`6UYZBA546R.com.pantopus.app`, `com.pantopus.app`), not `app.pantopus.ios` / `app.pantopus.android` — Universal Links, App Links, Password AutoFill, passkeys and Credential Manager cannot work for the shipping native apps until they are regenerated.
3. `make bootstrap` (`xcodegen generate`) regenerates `Pantopus.entitlements` from `project.yml`, which still lacks the `pantopus.com` applinks — it silently reverts commit 435c8fac.

---

## 1. Where Pantopus is today (verified by reading the code)

| Area | Today | Consequence |
|---|---|---|
| Backend auth | Express over Supabase Auth; mobile = Bearer JSON, web = httpOnly cookies. `/refresh` calls `refreshSession`, rotation on (`enable_refresh_token_rotation=true`, 10 s reuse interval, `jwt_expiry=3600`); reuse detected by regexing GoTrue's error → 401 `TOKEN_REUSE`. | Good base. Refresh tokens are still pure bearer secrets; mobile refresh tokens never expire (no inactivity timeout). |
| Server-side sessions | None of our own. `/logout` revokes only the presented JWT (`admin.signOut(token,'local')`), is unauthenticated. No session list, no sign-out-everywhere. Password change/reset don't invalidate other sessions. `/reauthenticate` returns `{verified:true}` only — no step-up assertion. Only device-ish table is `PushToken` (no device id, no session link). | Cannot revoke a stolen phone, cannot show "Where you're logged in". |
| iOS | Tokens + `cachedUser` in Keychain (`afterFirstUnlockThisDeviceOnly`, non-sync). `restoreSession()` has no first-launch marker. `signOut()` local-only. Refresh 401-reactive (expiresAt ignored). No SE key, App Attest, device id, native SIWA, `webcredentials:`. | **Reinstall already silently restores a full session by accident**, and the app-lock preference (UserDefaults) is wiped, so a locked account comes back unlocked. |
| Android | Tokens in `EncryptedSharedPreferences` (Keystore master key), excluded from backup/D2D, `allowBackup=false`. `signOut()` local-only. No Block Store, Credential Manager, Play Integrity, device id, autofill hints. | **Nothing survives reinstall**; the user retypes everything. |
| Web / association files | AASA + assetlinks target Expo identifiers; no `get_login_creds`; Next middleware clears cookies before attempting refresh. | OS-credential layer is dead for native today; web persistence weaker than its 7-day cookie implies. |
| Prior decision | RN-era app *wiped* the Keychain session on reinstall via an install sentinel (docs/07 §381-418). Native has no sentinel. | This design explicitly supersedes that: **keep the credential, gate it**. |

Full evidence with file:line references: [WORKFLOW-RESULTS.md §1](WORKFLOW-RESULTS.md).

---

## 2. Principles and policy decisions

1. **Reinstall is never Level 1 (silent) and never a wipe.** Uninstall is a weak signal that ownership or intent changed; we require presence (one gesture) but never a password. Supersedes the RN sentinel-wipe.
2. **No OS lock ⇒ no one-tap resume.** If `LAContext.canEvaluatePolicy(.deviceOwnerAuthentication)` is false / `BiometricManager.canAuthenticate(...) != SUCCESS`, the device gets Level 3 only.
3. **Bind at issuance only.** A device key is bound to a session only inside credential-issuing flows (login, OAuth, resume). No bearer-only endpoint may create or rotate a binding (closes the "stolen 1-hour token enrols an attacker device" hole).
4. **Refresh proof is checked against the key bound to *that session*,** resolved server-side from the session — never "find a device by a client-supplied id, then check the user afterwards".
5. **The DPoP device key is not biometry-gated** (background refresh, push-triggered fetch and socket reconnect must keep working). Presence for *"Continue as X"* is a client gate (Tier-1 UX); server-verifiable presence for sensitive actions comes from a **separate biometry-bound step-up key** with a passcode-gated fallback key for devices without strong biometrics.
6. **Anything minted from a non-interactive path is a `restored` session:** it can browse and chat but cannot move money, change credentials, revoke devices, add passkeys or delete the account until a password / passkey / native IdP credential is presented once (which flips it to `interactive`).
7. **Attestation is a graded trust signal, never a hard block on login** (App Attest cannot see jailbreaks; Play Integrity is quota-limited and absent on GMS-less devices).
8. **Never rely contractually on Keychain surviving uninstall.** It is an accelerator with an install-marker detector and a Level-3 fallback; if a future iOS wipes it, nothing breaks.
9. **Explicit sign-out revokes server-side and deletes tokens/grants, but keeps a non-secret display hint** so the login screen can pre-fill *"Continue as X →"* (Level 3). *"Not you? Remove"* wipes the hint.
10. **Immediate revocation without new infrastructure:** `verifyToken` already calls `getUser` per request; we add a registry check on the JWT `session_id` and a `sessions_valid_after` watermark. Deleting `auth.sessions` rows directly is optional belt-and-braces to be tested on the hosted project, not a dependency.

---

## 3. The three UX levels and the first-launch state machine

| Level | What survives on the device | Gesture | When |
|---|---|---|---|
| **L1 "Still logged in"** | tokens + device key + install marker all agree | none | normal cold start / foreground on the same install |
| **L2 "App remembers my account"** | iOS: refresh token + SE key + hint in Keychain, marker missing · Android: Block Store `{hint, resumeGrant}` | tap *Continue* + Face ID / Touch ID / passcode / BiometricPrompt(STRONG or DEVICE_CREDENTIAL) | reinstall on the same device; also L1 when App Lock is on, when dormant > 30 d, or when the server set `require_step_up` |
| **L3 "The phone remembers my account"** | only an optional non-secret display hint | one tap in a system sheet + OS biometric | Android reinstall without Backup on, new device, Keychain wiped, after explicit sign-out, "Use a different account" |

Decision order at cold start: **L1 → L2 → L3 → manual login**; each level degrades to the next without a dead end, and each level's UI is a *card*, not a form.

```
                          app launch
                              │
                 ┌────────────▼─────────────┐
                 │ tokens in secure store?  │
                 └──────┬───────────┬───────┘
                      yes           no ──────────────────────────────┐
                       │                                             │
          ┌────────────▼──────────────┐                 ┌────────────▼────────────┐
          │ install marker present &  │                 │ account hint?           │
          │ matches Keychain copy?    │                 │ iOS: Keychain hint      │
          │ (iOS; Android n/a — tokens│                 │ Android: Block Store    │
          │  never survive uninstall) │                 └────┬───────────────┬────┘
          └────┬────────────────┬─────┘                    yes               no
             yes                no (reinstall)               │                │
              │                 │                 ┌──────────▼────────┐  ┌────▼───────────────────┐
     ┌────────▼───────┐  ┌──────▼──────────────┐  │ Android & grant   │  │ L3: LoginView/Screen   │
     │ app-lock on, or│  │ B: ContinueAs card  │  │ present?          │  │ AutoFill / passkey /   │
     │ dormant >30 d, │  │ + Face ID/passcode  │  └───┬───────────┬───┘  │ SIWA / Google sheet    │
     │ require_step_up│  │ → DPoP /refresh     │    yes           no     └────────────────────────┘
     └──┬─────────┬───┘  └──────┬──────────────┘     │             │
       yes        no            │            ┌───────▼────────┐ ┌──▼──────────────────────────┐
        │         │             │            │ B: ContinueAs +│ │ C: ContinueAs hint-only:    │
   ContinueAs     │             │            │ BiometricPrompt│ │ passkey / SIWA / Google /   │
   + biometric    │             │            │ → POST /resume │ │ password (email prefilled)  │
        │         │             │            └───────┬────────┘ └─────────────────────────────┘
        └────┬────┘             │                    │  401/403 → C
             ▼                  ▼                    ▼
   L1: proactive DPoP refresh if expiresAt−now < 120 s → GET /profile → home ("Welcome back, Ying" toast on B)
```

**First-launch-after-reinstall UI states**

*iOS* — **A** (same install): Splash → home. **B** (reinstall, tokens+key survived): `ContinueAsView` — avatar, "Continue as Ying", `y•••@gmail.com`, primary *Continue* (LAContext `.deviceOwnerAuthentication`, so passcode works when Face ID isn't enrolled), secondary *Use a different account*, tertiary *Not you? Remove*. **C** (hint only — session revoked/expired/removed): same card, buttons chosen from `lastMethod`: passkey (AutoFill-assisted request armed) / *Continue with Apple* (native SIWA) / *Continue with Google* / password field prefilled + AutoFill. **D** (fresh): PlaceLaunch → LoginView with `.username` content type, `performAutoFillAssistedRequests()` armed, native SIWA button.

*Android* — **A** (same install): Splash → home. **B** (Block Store hint + grant): `ContinueAsScreen`, BiometricPrompt auto-shown → `POST /api/auth/resume` → home. **C** (hint present, grant rejected / step-up required / no screen lock): same card; Credential Manager sheet auto-launched (passkey → Google → saved password), email prefilled; *Not you?* clears Block Store. **D** (fresh): LoginScreen opens the Credential Manager sheet once; fields carry autofill `ContentType`. **E** (new device via D2D/cloud restore, later phase): Credential Manager Restore Credentials → silent sign-in → toast.

---

## 4. Architecture

```
                iOS app                                        Android app
  +---------------------------------------+      +-----------------------------------------+
  | AuthManager (state machine)           |      | AuthRepository (state machine)          |
  |  .unknown/.signedOut/.resumable/      |      |  Unknown/SignedOut/Resumable/SignedIn   |
  |  .signedIn (+ session.context)        |      | DeviceKeyStore (Keystore EC P-256,      |
  | DeviceKey (SE P-256, blob in Keychain,|      |   StrongBox if avail; dies w/ uninstall)|
  |   survives reinstall)                 |      | StepUpKey (biometric-bound, CryptoObject)|
  | StepUpKey (SE, .biometryCurrentSet)   |      | DeviceIdentity (deviceId, installId)    |
  | InstallMarker (sandbox file+Keychain) |      | AccountHintStore (Block Store: hint +   |
  | KeychainStore (+deviceId, deviceKey,  |      |   single-use resumeGrant, no cloud)     |
  |   installId, expiresAt, sessionId,    |      | TokenStorage (+expires_at, session_id)  |
  |   accountHint, appLockEnabled)        |      | DPoPProofBuilder (ES256 JWT)            |
  | DPoPProofBuilder (ES256 JWT)          |      | AuthInterceptor: X-Device-Id, pre-flight|
  | APIClient: X-Device-Id, DPoP on auth  |      |   refresh; TokenAuthenticator: DPoP     |
  |   endpoints, proactive refresh        |      | AppLockManager (BiometricPrompt)        |
  | AppLockManager (pref → Keychain)      |      +---------------------+-------------------+
  +-------------------+-------------------+                            |
                      |  Bearer + X-Device-Id  (+ DPoP on /login /oauth/* /refresh /resume /step-up)
                      v                                                v
  +------------------------------------------------------------------------------------------+
  | Express backend                                                                          |
  |  routes/users.js      /login /oauth/* /oauth/native /refresh /logout /password           |
  |                       /reset-password /reauthenticate DELETE /account (hooks; contracts kept)|
  |  routes/authDevices.js /api/auth/devices /sessions /resume /step-up /challenge /events    |
  |  middleware/verifyToken.js  getUser (unchanged) + JWT claims decode (session_id, iat)     |
  |                       + AuthSession revoked? + sessions_valid_after watermark             |
  |  middleware/dpop.js   ES256 proof, htu/htm, iat window, jti replay                        |
  |  middleware/stepUp.js X-Step-Up token (purpose-bound, one-shot for destructive actions)   |
  |  services/authDeviceService.js  bind-at-issue, refresh pre/post-check, trust levels       |
  |  services/authSessionService.js revoke (registry + admin.signOut scopes), mint session    |
  |                       via generateLink+verifyOtp, resume grants                           |
  |  services/authNotifyService.js  new-device / device-removed / reuse / lockdown emails+push|
  |  socket/chatSocketio.js  auth:session_revoked → disconnect sockets of that session_id     |
  +----------------------------+-------------------------------------+-----------------------+
                               |                                     |
                               v                                     v
  +-----------------------------------------+   +--------------------------------------------+
  | Supabase Auth (GoTrue) — unchanged      |   | Postgres public schema (service role)      |
  |  signInWithPassword, exchangeCode,      |   |  AuthDevice, AuthSession, AuthResumeGrant, |
  |  signInWithIdToken (native SIWA/Google),|   |  AuthChallenge, AuthDpopJti,               |
  |  refreshSession (rotation on),          |   |  AuthSecurityEvent, User.sessions_valid_   |
  |  admin.signOut(jwt,'local|others|       |   |  after, User.security_prefs,               |
  |  global'), admin.generateLink+verifyOtp,|   |  PushToken.device_id                       |
  |  getUser (session_not_found once the    |   |  (optional) fn revoke_auth_session over    |
  |  session row is gone), passkeys (beta)  |   |  auth.sessions — SECURITY DEFINER          |
  +-----------------------------------------+   +--------------------------------------------+
```

**Where Supabase forces a custom layer, and how we stay thin**

| Supabase limit | Our layer |
|---|---|
| No admin "list / revoke a user's sessions" endpoint | `AuthSession` rows keyed by the JWT `session_id`; revocation = row flag checked in `verifyToken` + refused at our `/refresh`; `admin.signOut(jwt,'others'|'global')` when we hold the caller's JWT; optional `revoke_auth_session()` RPC to delete `auth.sessions` (test on hosted project) |
| Refresh tokens are pure bearer secrets | DPoP proof verified at *our* `/refresh` proxy against the key bound to that session; GoTrue never sees the proof |
| No way to mint a session from a custom credential (resume grant, later passkeys on Android) | `admin.generateLink({type:'magiclink'})` → `verifyOtp({type:'magiclink', token_hash})` on a per-request anon client — the exact pattern `users.js` already uses for verification/recovery links |
| No inactivity timeout on the current plan | enforced at `/refresh` from `AuthSession.last_refresh_at` (90 d trusted / 30 d unverified) |
| Reuse detection = error-string regex | `refresh_token_hash` + `prev_refresh_token_hash` on `AuthSession` (tolerates fail-to-save), fall back to `sessionId`; log `sb-auth-refresh-token-reuse*` headers if the project runs the v2 algorithm |

---

## 5. Data model (`backend/database/migrations/160_auth_devices.sql`, mirrored under `supabase/migrations/`; RLS service_role only, same pattern as `086_push_tokens.sql`)

```sql
-- One row per (user, hardware key). iOS keeps the row across reinstall (SE key survives);
-- Android gets a new row per install (Keystore key dies with uninstall).
CREATE TABLE "AuthDevice" (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id          text NOT NULL,                       -- client UUIDv4, generated together with the key
  platform           text NOT NULL CHECK (platform IN ('ios','android','web')),
  public_key_jwk     jsonb,                               -- {kty:'EC',crv:'P-256',x,y}; NULL for web
  key_thumbprint     text,                                -- RFC 7638 SHA-256 of the JWK
  key_backing        text NOT NULL DEFAULT 'none'
                     CHECK (key_backing IN ('none','software','tee','strongbox','secure_enclave')),
  attestation_level  text NOT NULL DEFAULT 'none'
                     CHECK (attestation_level IN ('none','key_attest','app_attest','play_basic','play_device','play_strong')),
  attestation        jsonb,                               -- App Attest keyId+receipt digest / Keystore chain summary / Play verdict
  trust_level        text NOT NULL DEFAULT 'unverified'
                     CHECK (trust_level IN ('trusted','unverified','suspect')),
  step_key_jwk       jsonb, step_key_enrolled_via text,   -- biometry-bound step-up key; 'interactive' | 'restored'
  require_step_up    boolean NOT NULL DEFAULT false,      -- server-forced L2 on next launch
  install_id         text,                                -- per-install random; rotates on reinstall
  name text, model text, os_version text, app_version text,
  trusted_at         timestamptz,                         -- first interactive login on this key
  last_seen_at timestamptz, last_ip inet, last_user_agent text,
  last_resumed_at    timestamptz,
  resumed_from_device uuid REFERENCES "AuthDevice"(id),   -- Android: previous row (proves lineage)
  revoked_at timestamptz, revoked_reason text,            -- user|password_change|reuse|mismatch|inactivity|account_deleted|superseded
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);
CREATE UNIQUE INDEX authdevice_key_idx ON "AuthDevice"(device_id, key_thumbprint) WHERE key_thumbprint IS NOT NULL;
CREATE INDEX authdevice_user_active_idx ON "AuthDevice"(user_id) WHERE revoked_at IS NULL;

-- One row per Supabase session (JWT session_id). device_id NULL for web. Makes web sessions
-- visible in "Where you're logged in" from Phase 1 and gives per-session revoke reasons.
CREATE TABLE "AuthSession" (
  id                        uuid PRIMARY KEY,             -- = JWT session_id claim
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id                 uuid REFERENCES "AuthDevice"(id) ON DELETE SET NULL,
  context                   text NOT NULL DEFAULT 'interactive' CHECK (context IN ('interactive','restored','oauth')),
  auth_method               text,                        -- password|oauth_google|oauth_apple|siwa_native|google_native|passkey|resume_grant
  bound_at_issue            boolean NOT NULL DEFAULT false,
  refresh_token_hash        text, prev_refresh_token_hash text,   -- sha256; tolerate fail-to-save
  issued_at                 timestamptz NOT NULL DEFAULT now(),
  last_refresh_at           timestamptz, last_seen_at timestamptz, last_ip inet, user_agent text,
  revoked_at timestamptz, revoked_reason text
);
CREATE INDEX authsession_user_idx ON "AuthSession"(user_id) WHERE revoked_at IS NULL;
CREATE INDEX authsession_rth_idx  ON "AuthSession"(refresh_token_hash);

-- Android reinstall resume (Block Store). Single-use, hashed, 90-day, revocable.
CREATE TABLE "AuthResumeGrant" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES "AuthDevice"(id) ON DELETE SET NULL,   -- issuing device
  grant_hash text NOT NULL UNIQUE,                                  -- sha256(grant); grant = 32 random bytes b64url
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  used_at timestamptz, revoked_at timestamptz
);

CREATE TABLE "AuthChallenge" (id text PRIMARY KEY, purpose text NOT NULL, expires_at timestamptz NOT NULL); -- attestation / step-up nonces, 10-min TTL
CREATE TABLE "AuthDpopJti"   (jti text PRIMARY KEY, expires_at timestamptz NOT NULL);                       -- DPoP replay cache (10-min TTL, cron-pruned)

CREATE TABLE "AuthSecurityEvent" (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES "AuthDevice"(id) ON DELETE SET NULL,
  session_id uuid,
  type text NOT NULL,   -- login|oauth_login|resume|refresh_reuse|device_mismatch|device_revoked|revoke_others|revoke_all|lockdown|password_changed|password_reset|logout|inactivity_expired|account_deleted|step_up|new_device_email_sent
  ip inet, user_agent text, meta jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX authsecurityevent_user_idx ON "AuthSecurityEvent"(user_id, created_at DESC);

ALTER TABLE "User" ADD COLUMN sessions_valid_after timestamptz;   -- JWT iat < this ⇒ 401 SESSION_REVOKED
ALTER TABLE "User" ADD COLUMN security_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
   -- {requireUnlockOnReinstall:bool, allowRestoreGrants:bool, newDeviceEmail:bool}
ALTER TABLE "PushToken" ADD COLUMN device_id text;                 -- links APNs/FCM token to AuthDevice.device_id

-- OPTIONAL belt-and-braces (verify permissions on the hosted project first; the design does not depend on it):
-- CREATE FUNCTION public.revoke_auth_session(p_session_id uuid) RETURNS void
--   LANGUAGE sql SECURITY DEFINER SET search_path = auth, public AS $$ DELETE FROM auth.sessions WHERE id = p_session_id; $$;
```

Retention: `AuthSecurityEvent` 180 d; revoked `AuthSession`/`AuthDevice` rows 90 d after revocation; `AuthDpopJti`/`AuthChallenge` pruned by the existing jobs runner.

---

## 6. Wire contracts

### 6.1 DPoP proof (`DPoP: <jwt>` header) — on `POST /api/users/login`, `/oauth/callback`, `/oauth/token`, `/oauth/native`, `/refresh`, `/api/auth/resume`, `/api/auth/step-up`, `/api/auth/devices/register`

```
header : {"typ":"dpop+jwt","alg":"ES256","jwk":{"kty":"EC","crv":"P-256","x":"…","y":"…"}}
payload: {"jti":"<uuid>","htm":"POST","htu":"https://api.pantopus.com/api/users/refresh","iat":1755500000,
          "rth":"<b64url sha256(refreshToken)>"}          // on /refresh only: binds the proof to this refresh token
```
Server (`middleware/dpop.js`): verify signature with the embedded JWK (`jose` `jwtVerify` + `EmbeddedJWK`), `htm`/`htu` (compared against `PUBLIC_API_BASE_URL + req.originalUrl` sans query so proxies don't matter), `|now − iat| ≤ 300 s`, `jti` unseen (insert into `AuthDpopJti`, PK conflict ⇒ 401 `DPOP_REPLAY`), compute thumbprint → `req.dpop = {jwk, thumbprint}`. Missing header allowed while `AUTH_DEVICE_BINDING=optional`; 401 `DPOP_REQUIRED` once `required`.

### 6.2 Device descriptor (`device` object in login / oauth / resume / register bodies)
```json
{"deviceId":"uuidv4","platform":"ios","installId":"hex32","name":"Ying's iPhone","model":"iPhone16,2",
 "osVersion":"18.5","appVersion":"1.4.0 (312)","hasOsLock":true,
 "keyBacking":"secure_enclave|strongbox|tee|software",
 "attestation":{"type":"app_attest","keyId":"…","attestation":"b64cbor","challenge":"…"}
             | {"type":"android_key_attest","chain":["b64der",…]}
             | {"type":"play_integrity","token":"…"} }
```
Login/OAuth/resume responses gain `"device":{"id","deviceId","isNew","trustLevel"}, "sessionId":"uuid", "session":{"context":"interactive|restored"}`. All existing fields unchanged.

### 6.3 Endpoints

Existing routes (`backend/routes/users.js`) — behaviour added, contracts backward compatible:

| Route | Added |
|---|---|
| `POST /login` | optional `device` + `DPoP`. After the profile checks and before `applyAuthTransport` (~L1603): `authDeviceService.bindAtIssue(userId, session, device, req.dpop)` → upsert `AuthDevice`, insert `AuthSession{id=jwt.session_id, device_id, context:'interactive', bound_at_issue:true, refresh_token_hash}`; new key ⇒ new-device email/push. Response adds `device`, `sessionId`. |
| `POST /oauth/callback`, `/oauth/token` | same hook (~L3925 / ~L3857). `/oauth/token` now refreshes the supplied pair and returns the *new* pair only when the user id matches the verified access token (closes the unpaired-refresh-token gap). |
| `POST /oauth/native` (new) | `{provider:'apple'|'google', idToken, nonce?, accessToken?, device}` → `signInWithIdToken` (native SIWA / Credential Manager Google), `ensureOAuthUserProfile`, same bind hook. |
| `POST /refresh` | body `{refreshToken, deviceId?, sessionId?, accessToken?(expired ok)}` + `DPoP`. Order: **(1) resolve session** by `sha256(refreshToken)` → `refresh_token_hash` or `prev_refresh_token_hash`, else by `sessionId`/expired-JWT `session_id`; must be unrevoked; inactivity check (`last_refresh_at` within 90 d trusted / 30 d unverified) else revoke + 401 `SESSION_EXPIRED_INACTIVE`. **(2) if session is bound:** verify DPoP against *that* device's stored key (`rth` must match) else 401 `DEVICE_MISMATCH` + revoke session + event + email; if unbound and mode=optional: legacy path (adoption allowed only for sessions issued before the client shipped DPoP, i.e. `bound_at_issue=false && issued_at < DPOP_CUTOVER`), if mode=required: 401 `DPOP_REQUIRED`. **(3)** `refreshSession` (GoTrue rotates); on `refresh_token_already_used|not_found`: keep `TOKEN_REUSE` branch and ALSO revoke the session row, set the bound device `require_step_up=true`, event, email + push to other devices. **(4)** update hashes/last_refresh/last_seen/ip; return pair + `sessionId`. Crash between rotate and persist ⇒ `prev_refresh_token_hash` + GoTrue's parent-token grace re-issue the current token; no false alarm. |
| `POST /logout` | body `{scope:'local'|'others'|'global', deviceId?}`. `local` stays unauthenticated for **cookie clearing only**; side effects on rows (clear binding, delete `PushToken` for the device, revoke that device's grants) require proof: valid Bearer whose session is bound to that device, **or** `refreshToken` + DPoP. `others`/`global` require `verifyToken` (+CSRF for cookies) + step-up: `admin.signOut(bearer, scope)` + revoke `AuthSession` rows + revoke devices/grants + event; `global` also sets `sessions_valid_after=now()`. |
| `POST /password` | after `updateUserById` (~L1869): revoke all *other* sessions (`admin.signOut(bearer,'others')` + rows), revoke other devices (`password_change`), revoke all grants, event, email "password changed, other devices signed out". |
| `POST /reset-password` | after update: revoke *all* sessions + `sessions_valid_after=now()` + all devices/grants revoked, then revoke the recovery session as today. |
| `POST /reauthenticate` | returns `{verified:true, stepUpToken, expiresAt}` — `stepUpToken = HMAC-SHA256(STEP_UP_SECRET, userId|sessionId|purpose|jti|exp)`, 5 min, one-shot for destructive purposes. |
| `DELETE /account` | requires `X-Step-Up` (purpose `delete_account`); before `admin.deleteUser` (~L4140): revoke all sessions, delete `PushToken` by user, event `account_deleted`. |

New router `backend/routes/authDevices.js`, mounted `app.use('/api/auth', …)` next to `app.js:~306`:

| Method / path | Auth | Request → Response |
|---|---|---|
| `POST /api/auth/challenge` | none, 30/15 m/IP | `{purpose}` → `{challenge, expiresAt}` (attestation / step-up nonce, 10-min TTL) |
| `POST /api/auth/devices/register` | verifyToken + DPoP whose thumbprint **equals the session's bound key** | `{device, pushToken?, provider?}` → `{device, resumeGrant?(android)}` — metadata + push-token linkage + attestation update + (Android) mint/re-issue resume grant. **May not create a binding or change `current` session.** Idempotent; called after login/resume, on app update, on FCM/APNs rotation. |
| `GET /api/auth/devices` | verifyToken | → `{devices:[{id, deviceId, platform, name, model, osVersion, appVersion, isCurrent, trustLevel, trustedAt, lastSeenAt, lastLocation?{city,country}}], sessions:[web sessions], events:[last 20]}` |
| `DELETE /api/auth/devices/:id` | verifyToken + step-up | → `{ok}`; revoke device + its sessions, delete its `PushToken` rows, revoke grants, socket kick, event, email "device removed" |
| `POST /api/auth/sessions/revoke-others` | verifyToken + step-up | → `{revoked:n}` |
| `POST /api/auth/sessions/revoke-all` (a.k.a. **Lockdown**) | verifyToken + step-up | → `{ok}`; global + `sessions_valid_after=now()` + all grants revoked + require interactive login everywhere; client signs itself out |
| `POST /api/auth/resume` | none, 5/15 m/IP + per-grant + per-thumbprint, DPoP required | `{grant, device}` → login-shaped `{accessToken, refreshToken, expiresIn, expiresAt, user, device, sessionId, session:{context:'restored'}, resumeGrant:'<new>'}`. Steps: hash+lookup (unused, unexpired, unrevoked; user not banned; `security_prefs.allowRestoreGrants≠false`), require `keyBacking ∈ {tee,strongbox}` **and** a verified Android key-attestation chain (cheap, arrives with the key) — until attestation ships every redemption is `restored`; mint session via `generateLink(magiclink)+verifyOtp`; new `AuthDevice{resumed_from_device}` (old row `superseded`, its sessions revoked); grant `used_at`; issue new grant; event `resume`; new-device email only if `installId`/model differ from the issuing device (dedupe on proven lineage only) |
| `POST /api/auth/step-up` | verifyToken, 10/15 m | `{method:'password', password}` or `{method:'device_key', challenge, signature}` (biometry-bound step-up key enrolled in an *interactive* session) or `{method:'passkey', …}` → `{stepUpToken, expiresAt}` |
| `GET /api/auth/security-events` | verifyToken | `?limit` → `{events}` |

**Error codes clients must distinguish** (401 JSON `{error, code}`): `TOKEN_REUSE`, `DEVICE_MISMATCH`, `DEVICE_REVOKED`, `SESSION_REVOKED`, `SESSION_EXPIRED_INACTIVE`, `DPOP_REQUIRED`, `DPOP_INVALID`, `DPOP_REPLAY`, `RESUME_GRANT_INVALID`; 403 `STEP_UP_REQUIRED {purpose, methods:[…]}`. Clients wipe local session state on the first six, keep the display hint, and show *"You were signed out for security. Sign in again."* — never a generic expiry.

### 6.4 `verifyToken` changes
After `supabase.auth.getUser(token)` succeeds (kept — it is the immediate-revocation authority for GoTrue-side events and bans): base64url-decode the payload → `req.session = {id: session_id, iat, aal}`; look up `AuthSession` by id (15-s in-process cache; per-instance lag accepted for soft reads) → 401 `SESSION_REVOKED` if revoked; fold `User.sessions_valid_after` into the existing 60-s role cache → 401 if `iat` older; attach `req.session.context`. `middleware/stepUp.js` reads `context==='restored'` and refuses `X-Step-Up` from restored sessions unless the step-up method was password/passkey/native-IdP. Same decode helper is reused by `socket/chatSocketio.js`; on revoke the service emits `auth:session_revoked {sessionId}` and the socket server disconnects matching sockets.

---

## 7. Flows

### 7.1 First interactive login (email/password; OAuth identical after code exchange; native SIWA/Google via `/oauth/native`)
```
 client                                        backend /api/users/login                       Supabase
  | ensure deviceId + device key (create once)  |                                              |
  | POST {email,password,device} + DPoP(/login) ->| verify DPoP -> thumbprint                    |
  |                                             | signInWithPassword ------------------------->|
  |                                             |<------ session(access, refresh) -------------|
  |                                             | email confirmed? User row? (unchanged)       |
  |                                             | sid = jwt.session_id                         |
  |                                             | AuthDevice upsert (user, deviceId, jwk…)     |
  |                                             | AuthSession insert (sid, device, interactive,|
  |                                             |   bound_at_issue, refresh_token_hash)        |
  |                                             | new key? -> email/push "New sign-in on X"    |
  |<-- {tokens, expiresAt, user, device, sessionId}                                            |
  | persist tokens+expiresAt+sessionId+hint     |                                              |
  | iOS: write install marker (file + Keychain) |                                              |
  | POST /api/auth/devices/register {device,pushToken} (Bearer+DPoP same key) -> link PushToken |
  |<-- {device, resumeGrant (Android)}  -> Android writes Block Store {hint, grant}            |
```

### 7.2 Cold start, same install (L1)
```
 restore(): tokens present, marker matches (iOS) ->
   if expiresAt - now < 120 s: refreshIfPossible() with DPoP        <- proactive, no 401 tax
   GET /api/users/profile -> signedIn(user); AppLock arms if enabled (pref now in Keychain / encrypted prefs)
   .unauthorized (refresh already failed): read code
      TOKEN_REUSE / DEVICE_* / SESSION_* -> wipe tokens, keep hint, security banner
      plain expiry / SESSION_EXPIRED_INACTIVE -> wipe tokens, keep hint, login prefilled (C)
   transient -> stay signedIn on cachedUser (unchanged offline-first behaviour)
 scenePhase .active / ON_START: refresh if < 120 s left; socket auth error -> refreshIfPossible() then reconnect
 iOS with lastMethod=apple: ASAuthorizationAppleIDProvider.getCredentialState -> .revoked => sign out
```

### 7.3 Reinstall on the same device — iOS (L2)
```
 launch: Keychain has refreshToken + deviceKey + accountHint; install marker MISSING
   -> state .resumable(hint) -> ContinueAsView "Continue as Ying"
        [Continue] -> LAContext.evaluatePolicy(.deviceOwnerAuthentication)
                      (canEvaluatePolicy false -> LoginView prefilled, L3)
                   -> POST /refresh {refreshToken, deviceId, sessionId} + DPoP(rth)
                      server: session by hash -> bound device -> verify proof against ITS key
                              unrevoked, < 90 d idle -> refreshSession -> ok; last_resumed_at, install_id updated
                   -> GET /profile -> POST /devices/register {installId new, App Attest re-attest (Phase 3)}
                   -> write new install marker; re-arm AppLock from Keychain pref
        [Use a different account] -> LoginView (old tokens kept until the new login succeeds, then old session logged out scope local)
        [Not you? Remove]         -> POST /logout {scope:'local', refreshToken}+DPoP + wipe Keychain incl. hint
   Keychain wiped by a future iOS / restored to a new iPhone -> nothing found -> LoginView (L3: AutoFill/passkey/SIWA)
```

### 7.4 Reinstall on the same device — Android (L2 via Block Store)
```
 restore(): TokenStorage empty -> AccountHintStore.read()  (Block Store; no-op when GMS absent)
   hint with resumeGrant -> State.Resumable(hint) -> ContinueAsScreen
      [Continue] -> BiometricPrompt(BIOMETRIC_STRONG | DEVICE_CREDENTIAL)  (canAuthenticate != SUCCESS -> LoginScreen prefilled, L3)
                 -> POST /api/auth/challenge -> DeviceKeyStore.getOrCreate(challenge) (new key + attestation chain)
                 -> POST /api/auth/resume {grant, device} + DPoP
                    server: sha256(grant) single-use/unexpired/unrevoked; keyBacking tee|strongbox + chain verified;
                            generateLink(magiclink) -> verifyOtp -> session (context 'restored');
                            AuthDevice new row (resumed_from_device), old row superseded; grant used; new grant issued
                 <- login-shaped response + resumeGrant'
                 -> persist tokens; Block Store rewritten with grant'; toast "Welcome back, Ying"
                    (restored: first payout / password change / device revoke asks for password or passkey once)
   hint without grant (explicit sign-out) -> LoginScreen prefilled (L3: Credential Manager sheet)
   no hint (Backup services off / new device)  -> LoginScreen (L3)
```

### 7.5 Token refresh + rotation (steady state)
```
 401 on an authed call (or proactive) -> single-flight refresh:
   POST /refresh {refreshToken, deviceId, sessionId} + DPoP(htu=/refresh, jti, iat, rth)
   server: (1) session by hash/prev-hash/sessionId; unrevoked; not idle
           (2) bound? verify DPoP against that key   -> mismatch: 401 DEVICE_MISMATCH, revoke session, event, email
           (3) refreshSession -> GoTrue rotates (10 s reuse grace, parent-token grace)
               already used / not found -> TOKEN_REUSE: revoke session, device.require_step_up=true, event, email+push
           (4) update hashes/last_refresh/last_seen/ip; return new pair (+sessionId)
   client: persist pair+expiresAt; replay once; reconnect socket
```

### 7.6 Logout
```
 this device:   POST /logout {scope:'local', deviceId, refreshToken} + DPoP  (Bearer too if we have it)
                server: admin.signOut(access,'local'); AuthSession revoked (logout); PushToken(device_id) deleted; Android grants revoked
                client: wipe tokens/expiresAt/sessionId, keep accountHint (display only); Android clears the grant in Block Store
                        + CredentialManager.clearCredentialState; purge URLCache / OkHttp cache
 other devices: Settings > Security > Devices > "Sign out of all other devices" -> step-up -> POST /api/auth/sessions/revoke-others
 everywhere:    "Lockdown" -> POST /api/auth/sessions/revoke-all -> global signOut + watermark -> client signs itself out
```

### 7.7 Stolen device / remote revoke
```
 owner (web or other phone) -> Settings > Security > Devices -> "Ying's iPhone" > Remove
   -> step-up (password / biometric device key) -> DELETE /api/auth/devices/:id
   -> AuthSession(s) revoked, AuthDevice.revoked_at, PushToken rows deleted, grants revoked, socket kicked, email
   -> best-effort silent push {type:'session_revoked'} to the device BEFORE its push tokens are deleted;
      client honours it only after a 401 SESSION_REVOKED confirms (push is never the authority)
 stolen phone, next request: Bearer -> verifyToken -> AuthSession revoked -> 401 SESSION_REVOKED
   -> refresh with DPoP -> session revoked -> 401 -> app wipes tokens + hint, "Signed out for security";
      App Lock (Keychain pref) still gates any cached UI
   -> reinstall on stolen phone: iOS Keychain refresh token dead server-side; Android grant revoked
 owner can also: change password (revokes others) or Lockdown; account compromised -> reset password (global + watermark)
```

### 7.8 Password change / reset — see endpoint table (others revoked on change; everything + watermark on reset; user signs in fresh, new binding).

### 7.9 Account deletion
```
 client: Tier-2 biometric -> POST /step-up (device_key or password) -> stepUpToken(purpose delete_account, one-shot)
      -> DELETE /api/users/account (X-Step-Up)   [restored sessions must use password/passkey]
 server: existing escrow/gig guards -> revoke all sessions -> delete PushToken(user) -> event -> delete User row -> admin.deleteUser
 client: wipe Keychain/TokenStorage incl. hint + install marker; Android Block Store deleteBytes + clearCredentialState
```

### 7.10 Restored → interactive
A `restored` session flips to `interactive` the first time the user presents a password, passkey, or native SIWA/Google credential (`POST /api/auth/step-up` with one of those methods, or a fresh login on the same device). Until then `middleware/stepUp.js` refuses `X-Step-Up` obtained via `device_key`, and clients show the Tier-2 sheet with password/passkey options only.

---

## 8. iOS changes (`frontend/apps/ios/Pantopus/…`)

- **New `Core/Auth/DeviceKey.swift`** — `SecureEnclave.P256.Signing.PrivateKey()` created once; `dataRepresentation` in Keychain (`SecureStoreKey.deviceKey`, `.afterFirstUnlockThisDeviceOnly`, non-sync, no biometry). Software `P256` fallback on Simulator (`keyBacking:'software'`). Exposes `jwk`, `thumbprint`, `sign(Data)`. Missing/undecodable ⇒ regenerate + fall back to L3.
- **New `Core/Auth/StepUpKey.swift`** (Phase 3) — SE key with `SecAccessControl(.privateKeyUsage | .biometryCurrentSet)`; fallback key with `.userPresence` for passcode-only devices; used by `POST /api/auth/step-up {device_key}`.
- **New `Core/Auth/DPoPProofBuilder.swift`** — ES256 `dpop+jwt` (jti, htm, htu = `APIClient.baseURL + path`, iat, rth).
- **New `Core/Auth/InstallMarker.swift`** — random `installId` in `Library/Application Support/.pantopus-install` (`isExcludedFromBackup`) mirrored in Keychain; `isReinstall = Keychain has refreshToken && (file missing || mismatch)`.
- **New `Core/Auth/DeviceDescriptor.swift`**; **`Core/Security/AppAttestClient.swift`** (Phase 3: `DCAppAttestService` generateKey/attestKey with server challenge; keyId persisted; regenerated after reinstall).
- **`Core/Auth/KeychainStore.swift`** — add keys `deviceId, deviceKey, installId, expiresAt, sessionId, accountHint, appLockEnabled.<uid>`; Data-capable get/set; optional second `.synchronizable(true)` item for the display-only hint (Phase 3, privacy review).
- **`Core/Auth/AuthManager.swift`** — `State` gains `.resumable(AccountHint)`; `restoreSession()` (L152-195) checks `InstallMarker` first, attempts refresh when only a refresh token exists, honours `security_prefs.requireUnlockOnReinstall` / dormant > 30 d / `require_step_up`; new `resume()`; `persistLoginResponse` (L257-276) stores expiresAt/sessionId/hint/context and calls `/devices/register`; `performRefresh` (L427-466) sends deviceId/sessionId + DPoP and maps `AuthErrorBody.code` → `SessionEndReason`; `refreshIfExpiringSoon()`; `signOut(scope:)` calls the backend; `removeRememberedAccount()`.
- **`Core/Networking/APIClient.swift`** — `X-Device-Id` header; pre-flight refresh when `expiresAt − now < 120 s`; `DPoP` header for endpoints flagged `requiresDPoP`; `X-Step-Up` plumbing + a 403 `STEP_UP_REQUIRED` interceptor that runs step-up and retries once; purge URLCache on sign-out. `MultipartUploader` mirrors.
- **`AuthEndpoints.swift` / `AuthDTOs.swift`** — `device` on login, `deviceId/sessionId` on refresh, `sessionId/device/session.context` on responses; new endpoints (logout scopes, registerDevice, devices, revokeDevice, revokeOthers, revokeAll, stepUp, resume n/a on iOS, oauthNative, securityEvents); `SessionEndReason` enum.
- **`Core/Realtime/SocketClient.swift`** — on auth error call `refreshIfPossible()` then reconnect; stop reconnecting on `DEVICE_REVOKED/SESSION_REVOKED`.
- **`App/PantopusApp.swift`** — `RootView` adds `.resumable → ContinueAsView`; `.active` triggers `refreshIfExpiringSoon()`; App-Lock seal reads the Keychain-backed pref. **`AppDelegate.swift`** — send `deviceId` with `/notifications/register`; re-register on APNs token change.
- **New `Features/Auth/ContinueAsView.swift`** (+VM); **`LoginView.swift`** — prefill from hint, `.username` content type, `performAutoFillAssistedRequests()`, native `SignInWithAppleButton` → `/oauth/native` (Phase 3), passkey AutoFill (Phase 4).
- **New `Features/Settings/Security/DevicesView.swift`** (+VM) — devices list (current pinned, trust badge), swipe/Remove → Tier-2 guard → step-up → `DELETE`; "Sign out of all other devices"; Lockdown; events timeline; Security prefs toggles. `PrivacyViewModel` sends `X-Step-Up` on delete.
- **`Core/Security/AppSecurity.swift`** — `AppLockManager` pref → Keychain (one-time migration); expose `verifyPresence(reason:)` reused by ContinueAs; restore `SensitiveScreenGuard` on Wallet/Payments (parity gap).
- **Entitlements** — add `webcredentials:pantopus.com` (+www, +.app) and re-add `applinks:pantopus.com` to **both** `Pantopus.entitlements` and `project.yml` (L140-152, the regen source of truth); Phase 3: `com.apple.developer.applesignin`, `com.apple.developer.devicecheck.appattest-environment`. `NSFaceIDUsageDescription` mentions "continue signed in".
- **Tests** — `AuthManagerResumeTests` (reinstall → `.resumable`; resume ok / 401 codes / no-passcode fallback; hint kept on local sign-out, wiped on remove), `DPoPProofBuilderTests`, `DeviceKeyTests` (software fallback), extend `AuthManagerRefreshTests` (proactive refresh, DPoP presence) and `AuthManagerTests` (logout network call). `InMemorySecureStore` gains Data support.

## 9. Android changes (`frontend/apps/android/app/src/main/java/app/pantopus/android/…`)

- **Gradle** — `play-services-auth-blockstore:16.4.0` (Phase 2); `androidx.credentials` 1.5+, `credentials-play-services-auth`, `googleid` (Phase 3); `com.google.android.play:integrity` (Phase 3). Keep `security-crypto` for `TokenStorage`; do **not** extend `MasterKey` for the device key.
- **New `data/auth/DeviceKeyStore.kt`** — Keystore EC P-256 `pantopus_device_key` (`PURPOSE_SIGN`, SHA-256, `setAttestationChallenge`), `setIsStrongBoxBacked(true)` with fallback; exports JWK/thumbprint/attestation chain; regenerates (new deviceId) when gone.
- **New `data/auth/StepUpKeyStore.kt`** (Phase 3) — `pantopus_stepup_key` with `setUserAuthenticationRequired(true)` + `setInvalidatedByBiometricEnrollment(true)` (API 30 `setUserAuthenticationParameters`, legacy validity-duration path for minSdk 26), signed through `BiometricPrompt` `CryptoObject`.
- **New `data/auth/DPoPProofBuilder.kt`, `data/auth/DeviceIdentity.kt`** (deviceId/installId in `device_identity` prefs — **backup-excluded**; regenerated with the key).
- **New `data/auth/AccountHintStore.kt`** (Phase 2) — Block Store key `pantopus.account_hint` (≤ 4 KB JSON `{v, userId, displayName, avatarUrl, maskedEmail, lastMethod, resumeGrant, deviceIdHint, issuedAt}`), `setShouldBackupToCloud(false)` (same-device + D2D only; cloud is an explicit later opt-in); write after login/register/resume; `clearGrant()` on local sign-out; `delete()` on remove/account deletion; no-op without GMS.
- **`data/auth/TokenStorage.kt`** — persist `expires_at`, `session_id`, `session_context`.
- **`data/auth/AuthRepository.kt`** — `State.Resumable(AccountHint)`; `restore()` (L175-217) consults `AccountHintStore` when no token; `resume(activity)`; `refreshTokens()` (L448-481) sends deviceId/sessionId + DPoP, maps codes → `SessionEndReason`; `refreshIfExpiringSoon()`; `persistLoginResponse` (L312-328) stores expiresAt/sessionId/context and calls `/devices/register` (with FCM token), stores the returned grant; `signOut(scope)` calls `/logout` (+ clears grant, keeps hint, `clearCredentialState`); `removeRememberedAccount()`.
- **`data/auth/TokenAuthenticator.kt`** — parse the `/refresh` error body code in the `AuthRejected` branch (L71-75) → `signOut(reason)`; **`AuthInterceptor.kt`** — `X-Device-Id`, pre-flight refresh when `expiresAt` within 120 s (never for the refresh endpoint); a 403 `STEP_UP_REQUIRED` interceptor. **`di/NetworkModule.kt`** — identity interceptor on both the main and `@Named("authRefresh")` clients.
- **`AuthApi.kt` / `AuthDtos.kt`** — new fields and endpoints (logout scopes, oauthNative, challenge, resume, registerDevice, devices, revokeDevice, revokeOthers, revokeAll, stepUp, reauthenticate w/ stepUpToken, securityEvents).
- **`ui/navigation/PantopusNavHost.kt`** (L57-78) — `Resumable → ContinueAsScreen`; **new `ui/screens/auth/ContinueAsScreen.kt`** (+VM); **`LoginScreen.kt`** — prefill from hint, autofill `ContentType` semantics, Sign in with Google via `CredentialManager.getCredential(GetGoogleIdOption(serverClientId, nonce))` → `/oauth/native` (Phase 3), passkeys via `GetPublicKeyCredentialOption` (Phase 4). `RootViewModel` calls `refreshIfExpiringSoon()` on ON_START.
- **New `ui/screens/settings/security/DevicesScreen.kt`** (+VM); `AccountDeleteSheet.kt` sends `X-Step-Up`.
- **`core/security/AppLockManager.kt`** — `promptWithCrypto(CryptoObject)` variant; `verifyPresence()` reused by ContinueAs; app-lock pref → encrypted prefs (consistent with iOS); restore SensitiveScreenGuard on Wallet/Payments.
- **`push/PushTokenSyncer.kt`, `PantopusMessagingService.kt`** — include deviceId; re-run `/devices/register` on FCM rotation; handle silent `session_revoked` push (confirm with 401 before wiping).
- **Manifest / backup rules** — exclude `sharedpref/device_identity.xml` from backup/transfer; Phase 3 `<meta-data android:name="asset_statements">` → `https://pantopus.com/.well-known/assetlinks.json`; keep `allowBackup=false` and token exclusions.
- **Phase 3 `data/auth/PlayIntegrityClient.kt`** — `StandardIntegrityManager` warm-up at app start; `requestHash = sha256(challenge)` token attached to login/resume; server maps verdicts to `attestation_level`/`trust_level`.
- **Tests** — `DPoPProofBuilderTest`, `DeviceIdentityTest`, `AuthRepositoryResumeTest` (Resumable, resume ok, grant invalid → SignedOut w/ prefill, no screen lock → login), extend `TokenAuthenticatorTest` (code propagation, pre-flight), `AuthRepositoryTest` (logout network call, hint retention); instrumented `DeviceKeyStoreTest`, `AccountHintStoreTest` (GMS-guarded).

## 10. Backend changes (`backend/…`)

- Migration `160_auth_devices.sql` (+ `supabase/migrations/…`) — §5.
- `middleware/dpop.js`, `middleware/stepUp.js`; `services/authDeviceService.js` (bindAtIssue, resolveSessionForRefresh, verifyProofAgainstBoundKey, trust evaluation, attestation verifiers in Phase 3: Android key-attestation chain vs Google roots + CRL, App Attest, Play Integrity `decodeIntegrityToken`), `services/authSessionService.js` (revoke registry + `admin.signOut` scopes + optional RPC, `mintSessionForUser` via generateLink+verifyOtp, resume-grant mint/redeem), `services/authNotifyService.js` (emails via existing SMTP + push; deep link `https://pantopus.com/app/settings/security`).
- `routes/authDevices.js` mounted at `/api/auth`; rate limiters (`challengeLimiter`, `resumeLimiter`, `stepUpLimiter`, per-thumbprint keys) — **move express-rate-limit and the jti/challenge stores to a shared store (Redis or Postgres) before flipping enforcement** if the backend runs > 1 instance.
- `routes/users.js` hooks per §6.3; `middleware/verifyToken.js` per §6.4; `socket/chatSocketio.js` decode + kick; `routes/notifications.js` + `services/pushService.js` accept `deviceId`, add `removeTokensForDevice`.
- Config/env: `PUBLIC_API_BASE_URL`, `STEP_UP_SECRET` (required in prod like `CSRF_SECRET`), `AUTH_DEVICE_BINDING=off|optional|required`, `AUTH_RESUME_GRANTS=on|off`, `AUTH_ATTESTATION=log|enforce`, `DPOP_CUTOVER` (timestamp), `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`, `ANDROID_PACKAGE_NAME`, Play Integrity service account; GoTrue: enable Apple/Google native audiences for `signInWithIdToken`; consider `[auth.sessions] inactivity_timeout` on Pro as defence in depth.
- **CI invariant:** grep that the Supabase anon key never appears in the iOS/Android bundles or the web JS bundle (otherwise `/auth/v1/token` bypasses our DPoP proxy; hosted Supabase cannot network-restrict GoTrue).
- Tests: `dpop.js` (valid / wrong htu / skewed iat / replayed jti / rth mismatch), refresh binding matrix (unbound-legacy / bound-match / mismatch / revoked / inactive / TOKEN_REUSE side effects / fail-to-save double), resume-grant lifecycle, logout scopes + proof, password change revoking others, devices `isCurrent`, step-up purposes and restored-context refusal, `DELETE /account` step-up.

## 11. Web + association-file prerequisites (Phase 0)

- Regenerate `frontend/apps/web/public/.well-known/apple-app-site-association` for `<TEAMID>.app.pantopus.ios` (applinks + `webcredentials`) and `assetlinks.json` for `app.pantopus.android` with `delegate_permission/common.handle_all_urls` **and** `common.get_login_creds`, using the Play App Signing + upload SHA-256s (keep the legacy Expo entries during transition). Serve on apex + www, no redirects, `application/json` (already forced in `next.config.js`).
- Web `/app/settings/security` page (cookie transport + CSRF): devices/sessions list, per-device Remove, Sign out everywhere, security prefs — same phase as the mobile screens so "everywhere" is true.
- Fix Next middleware clearing cookies before attempting refresh; align web session policy (sliding window) with mobile or document the asymmetry.
- Docs: update `docs/01-authentication-authorization.md` §1, `docs/mobile/auth-backend-contracts.md` §7 (+ new contracts/codes), supersede `docs/07` install-sentinel + deep-dive §7 with this reinstall policy; register device id / public key / account hint / Block Store item in `docs/compliance/privacy-data-inventory.md` and regenerate App Store privacy labels + Play Data safety (**before** the Phase 1 store submission).

---

## 12. Threat model

| Threat | Mitigation |
|---|---|
| Refresh token exfiltrated (backup, malware, log leak, cleartext dev traffic) and replayed elsewhere | `/refresh` requires an ES256 DPoP proof (with `rth`) from the SE/Keystore key bound to *that* session; wrong/no key ⇒ 401 `DEVICE_MISMATCH`, session revoked, event, email. Enforced once `AUTH_DEVICE_BINDING=required`. |
| Stolen 1-hour access token used to enrol an attacker device | Bind-at-issue-only; `/devices/register` cannot create/rotate bindings and requires a DPoP thumbprint equal to the session's bound key. |
| Refresh replay race / cloned client | Supabase rotation + 10 s reuse window (unchanged) + our TOKEN_REUSE handler revokes the session, forces `require_step_up` on the legit device (one-gesture recovery for the owner), emails + pushes. |
| Stolen unlocked device | App Lock pref survives reinstall (Keychain / encrypted prefs); Tier-2 guard on money surfaces (restored on native); owner revokes from web/other phone; revocation immediate (`AuthSession` check per request); push tokens deleted; socket kicked. |
| Stolen locked device + reinstall | L2 needs the device passcode/biometric; no OS lock ⇒ no L2; Android grant is E2EE, single-use, hardware-key-redeemable; owner can revoke any time. |
| Attacker restores victim's Google backup elsewhere | Grants not cloud-backed by default; redemption needs a hardware key + verified attestation chain; result is a `restored` session that cannot move money or change credentials; single-use so the legit device notices; new-device email when install/model differ. |
| Future iOS wipes Keychain / new iPhone | *ThisDeviceOnly* items unusable ⇒ L3 (AutoFill / passkeys / SIWA); no hard dependency. |
| Repackaged app / emulator farm abusing `/login` or `/resume` | App Attest (re-attested after reinstall), Play Integrity + key attestation ⇒ `trust_level`; `unverified` gets no grants and 30 d inactivity; `suspect` revoked; per-IP + per-grant + per-thumbprint limits. |
| Jailbroken / rooted device | Not fully preventable; DPoP key still non-exportable so off-device theft fails; low integrity ⇒ no grants, shorter inactivity, extra notifications. |
| Password change / reset after compromise | Change revokes all *others*; reset revokes *all* + `sessions_valid_after` watermark rejects even unexpired JWTs; devices/grants revoked. |
| Account deletion leaving live sessions | `DELETE /account` needs one-shot step-up (password/passkey for restored sessions); all sessions + push tokens revoked before `deleteUser`. |
| CSRF / abuse of logout scopes from web | `local` unauthenticated = cookie clearing only; row side effects need proof; `others`/`global` need verifyToken (+CSRF) + step-up. |
| DPoP proof replay / clock skew | `jti` cache (10 min), `iat` ±300 s, `htu/htm` bound, `rth` bound; proof useless without the refresh token and vice versa. |
| Backend DB leak | Grants stored as sha256; devices store public keys only; step-up tokens HMAC with separate secret; refresh tokens stay in `auth.refresh_tokens` as today (hashes only in our table). |
| Legacy clients during the optional window | Refresh without DPoP accepted only for sessions issued before `DPOP_CUTOVER`; adoption never for post-cutover sessions; enforcement flips per platform once ≥ 95 % of active installs send DPoP; inactivity rule ages the rest out. |
| Device-key loss (SE blob undecodable, Keystore invalidated, biometric re-enrolment) | DPoP key not biometry-gated ⇒ re-enrolment cannot brick sessions; missing key ⇒ regenerate + L3; step-up key invalidation ⇒ password/passkey step-up. |
| Multi-instance backend | Rate limits, jti and challenge stores in a shared store before enforcement. |

## 13. Trust levels & policy constants

| `trust_level` | Obtained by | Effects |
|---|---|---|
| `trusted` | valid App Attest / Play Integrity `MEETS_DEVICE_INTEGRITY` + `PLAY_RECOGNIZED` / valid key-attestation chain (TEE/StrongBox) | resume grants issued; 90 d inactivity; device-key step-up accepted (if enrolled interactively) |
| `unverified` | no attestation (old client, Simulator, GMS-less, outage) | session works; no grants; 30 d inactivity; step-up = password/passkey only |
| `suspect` | proof failures ×2, TOKEN_REUSE, `UNRECOGNIZED_VERSION`, `appAccessRisk` | session revoked; fresh interactive login + new-device email; grants revoked |

Constants: access JWT 3600 s (unchanged); proactive refresh at < 120 s; inactivity 90 d trusted / 30 d unverified; grants 90 d, single-use, re-issued on every resume/register; DPoP `iat` ±300 s, `jti` TTL 10 min; step-up token 5 min, purpose-bound, one-shot for destructive purposes; dormant > 30 d ⇒ L2 on next launch; new-device email on first login/resume on a key or when install/model differ (never deduped on model alone).

## 14. Rollout (each phase independently shippable; Phase 0 + 1 are the committed deliverable, later phases flag-gated)

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Prerequisites & hygiene** (~1 wk, no schema) | Regenerate AASA/assetlinks for native identifiers; `webcredentials` + `applinks:pantopus.com` into `project.yml`; both clients call `/logout` on sign-out + purge caches; persist `expiresAt` + proactive refresh + socket auth-error → refresh; structured 401 codes surfaced ("signed out for security"); `/oauth/token` pairs refresh with access; autofill hints (`.username`, Compose `ContentType`); privacy inventory + labels updated | no 401 tax on cold start; logout revokes server-side; Universal/App Links verify on device |
| **1 — Registry + DPoP (optional) + iOS Continue-as** (2–3 wk) | Migration 160; `dpop.js`; device/session services; hooks in `/login /oauth/* /refresh /logout`; `/devices/register` (metadata only), `GET /devices` (read-only) incl. web sessions; `verifyToken` session check + watermark; iOS `DeviceKey`/`InstallMarker`/`ContinueAsView`/`.resumable`, App-Lock pref → Keychain; Android `DeviceKeyStore` + DPoP on refresh (reinstall still full login) | backend binding matrix green; iOS reinstall → one gesture; dashboard "% refreshes with DPoP"; kill switch `AUTH_DEVICE_BINDING=off` |
| **2 — Device management, Android resume, notifications** (2–3 wk) | `DELETE /devices/:id`, revoke-others/all (Lockdown), step-up middleware + `/reauthenticate` token, password change/reset revocation, socket kick, security events + emails/push, iOS/Android Devices screens, web security page + middleware fix, Android `AccountHintStore` + `/resume` (restored context) + `ContinueAsScreen`, `DELETE /account` step-up, security prefs | revoke-from-web kills phone within one request; Android delete+reinstall on a Backup-enabled device resumes behind BiometricPrompt; e2e email snapshots |
| **3 — Enforcement, attestation, crypto step-up, native OS credentials** (3–4 wk, staged) | Flip `required` per platform at ≥ 95 % DPoP; Android key-attestation + Play Integrity, iOS App Attest (ramped); `trust_level` gates grants; biometry-bound step-up keys + `/step-up {device_key}` (with passcode fallback key); native SIWA + Credential Manager Sign in with Google → `/oauth/native`; SensitiveScreenGuard restored on money surfaces | attestation verifiers with recorded fixtures; enforcement canary by app version; PROOF_INVALID rate SLO |
| **4 — Passkeys & hardening** (opportunistic) | Supabase passkeys (beta) — iOS via supabase-swift/AutoFill + `.conditional` upgrades, Android proxied `/auth/v1/passkeys/*` until supabase-kt supports sign-in; DPoP `ath` on high-value routes; web device cookie so browsers appear as devices; Redis-backed limiters/jti; Android Restore Credentials for new-device transfer; optional iCloud-synced display hint | — |

Telemetry (names already reserved in docs/07 + new): `session_restore_ok{path,reinstall}`, `session_resume_prompt/ok/cancel`, `session_invalidated{code}`, `auth.device.bind/mismatch/revoked`, `auth.resume.ok/invalid`, `auth.dpop.invalid/replay`, `auth.refresh.inactive`, `auth.stepup.ok/fail`; SLOs: resume success ≥ 98 %, PROOF_INVALID < 0.1 % of refreshes, revocation p99 < 1 request.

## 15. Verification status, tradeoffs, decisions needed

**Verified** (details in [WORKFLOW-RESULTS.md §2, §4](WORKFLOW-RESULTS.md)): Keychain/SE persistence across reinstall (Apple DTS, non-contractual); App Attest keys don't survive reinstall; Android Keystore wiped on uninstall; Block Store persists only with Backup on; Restore Credentials ≠ same-device reinstall; Supabase `session_not_found` on deleted session rows (docs); `generateLink→verifyOtp` mints a session (already used in `users.js`); Supabase passkeys primary-factor beta; DPoP RFC 9449.

**Unverified / to test on the hosted project before Phase 1:** whether the `postgres` role may `DELETE FROM auth.sessions` (design does not depend on it); which refresh-token algorithm (v1/v2) the project runs and whether `sb-auth-refresh-token-reuse*` headers are present; `admin.signOut(jwt,'others')` behaviour with expired JWTs; Play Integrity quota vs enrolment volume; StrongBox/attestation variance on the OEM fleet; Apple Team ID (`project.yml` `DEVELOPMENT_TEAM` blank) and Play App Signing fingerprints for the association files.

**Tradeoffs accepted:** reinstall costs one gesture even on iOS (Instagram-on-iOS is silent) in exchange for requiring an OS lock and superseding the wipe policy; DPoP key not biometry-gated (background refresh) with a separate step-up key for server-verified presence; binding enforced at our proxy, not inside GoTrue (mitigated by the anon-key invariant); Android resume grant is a second hashed, single-use, hardware-redeemable secret held by Block Store (weaker than "nothing survives", far stronger than storing the refresh token); immediate revocation keeps the per-request `getUser` round trip already paid today; attestation is a signal, not a gate.

**Decisions for the product owner:**
1. Reinstall = L2 (one gesture) rather than silent L1 on iOS — confirm.
2. `security_prefs` defaults: `requireUnlockOnReinstall=false`, `allowRestoreGrants=true`, `newDeviceEmail=true` — confirm.
3. Block Store cloud backup stays off (same-device + D2D only) — confirm, or opt in later behind attestation + restored context.
4. Multi-account on one device: one hint per device (this design) vs Instagram-style switcher (per-account keys/hints) — defer?
5. Step-up for account deletion: password/passkey only, or also biometric device key (this design: device key allowed only for interactive-enrolled keys, never for restored sessions).
6. Inactivity windows 90 d / 30 d and web alignment.
7. iCloud-synced display-only hint (privacy inventory change-control) — Phase 4 opt-in?

---

## Appendix — how this maps to what big apps do

- **Instagram / Facebook**: silent reinstall restore on iOS + "Where you're logged in" with per-session logout + login alerts → this design's L1/L2, `GET /devices`, security events/emails, Lockdown.
- **Uber**: passkeys, 2-step verification, close-other-sessions from Account → Security; Play Integrity user (Google, Oct 2025) → Phase 3/4.
- **Google**: device-bound session credentials (DBSC, GA in Chrome 146) and google.com/devices → DPoP-bound refresh at our proxy is the native analogue; web device cookie in Phase 4.
- **YouTube / Gmail**: never sign you out over a flaky network → offline-first restore is preserved unchanged.
- **Banks / ChatGPT**: cryptographic biometric step-up (not a boolean) for money/credential changes → step-up key with `.biometryCurrentSet` / `setUserAuthenticationRequired`, restored-context downgrade.
