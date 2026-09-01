# Stage E — adversarial security review of the persistent-login backend

Status: DONE (2026-08-20)

Role: threat-model the *implemented* code (not the design) on the auth paths:
`backend/routes/users.js`, `backend/routes/authDevices.js`,
`backend/middleware/{dpop,stepUp,verifyToken,optionalAuth,validate,csrfProtection}.js`,
`backend/services/auth*.js`, `backend/services/pushService.js`,
`backend/socket/chatSocketio.js`, `backend/config/authPolicy.js`,
`backend/database/migrations/160_auth_devices.sql`. Fix every real issue, add a
regression test, run `pnpm test`.

## Summary (severity order)

Ten defects found and fixed across two passes. The four that matter most all
have the same shape: **a path that treats bearer material as if it were a
credential.** S6 let a stolen access+refresh pair re-bind a session to the
thief's device key; S8 let any access token set a new password; S1 let an
unauthenticated body hint revoke a stranger's session; S2 let a refresh (not a
login) rotate a device binding. Each is now gated on a proof the holder of a
copied token cannot produce.

| # | Severity | Title | Status |
|---|---|---|---|
| S1 | HIGH | `/api/users/refresh` — unauthenticated session kill + forged security alerts via the `sessionId` body hint | FIXED + test |
| S6 | HIGH | `POST /api/users/oauth/token` — a stolen access+refresh pair binds/rebinds a device key and takes over an existing session's binding | FIXED + test |
| S8 | HIGH | `POST /api/users/reset-password` — the JWT branch accepted any application access token as a reset credential | FIXED + test |
| S2 | MEDIUM-HIGH | `/api/users/refresh` legacy adoption could rotate an existing device binding | FIXED + test |
| S3 | MEDIUM | `/api/users/logout` scope=local resolved the caller *after* revoking the access token | FIXED + test |
| S5 | MEDIUM | Credential values echoed + logged by `middleware/validate.js` | FIXED + test |
| S7 | MEDIUM | `X-Token-Transport: cookie` (client-declared) disabled `required`-mode DPoP enforcement for unbound sessions | FIXED + test |
| S4 | LOW-MED | TOKEN_REUSE detection depended only on a GoTrue error-message regex | FIXED + test |
| S10 | LOW-MED | Unvalidated `req.ip` written to `inet` columns — a bad forwarded hop loses the whole registry write | FIXED + test |
| S9 | LOW | Device-descriptor strings kept control characters (log / push / e-mail-subject hygiene) | FIXED + test |
| S11 | LOW | `PUBLIC_API_BASE_URL` unset ⇒ DPoP `htu` trusts the request's own `Host` | HARDENED (warn + docs) |

Verified-safe areas are listed under "Threat model — what held". Accepted v1
risks and follow-ups are listed at the end.

---

## Findings

### S1 — HIGH · `/refresh` session kill + forged security alerts via the `sessionId` hint

`checkRefresh` resolves the session by refresh-token hash → previous hash →
`sessionId` (request body) → `session_id` claim of an access token. The last two
are **unauthenticated hints** — the body is arbitrary and the JWT is decoded,
never verified. Every failure branch then applied destructive side effects to
whatever row it landed on: revoke the `AuthSession`, mark the device `suspect`,
write a `device_mismatch` / `refresh_reuse` event and send the user a
"suspicious activity" e-mail + push. Anyone who learned a session UUID (it is
returned by `/login` and listed by `GET /api/auth/devices`) could sign that
session out and forge security alerts holding no credential at all.

**Fix** — `checkRefresh` computes `tokenResolved` (true only when the presented
refresh token hashes to that row, current or previous generation) and returns it
to the route. Hint-resolved rows still resolve (so an unpersisted rotation can
be recovered and `recordRefresh` does not clobber the row) and a *valid* proof
over them is still accepted, but every failure path is inert: revocation,
mismatch, inactivity, `TOKEN_REUSE` and the foreign-token branch are all gated on
`tokenResolved`. A hint-only failure answers a plain `401 UNAUTHORIZED`.
`services/authDeviceService.js` (`checkRefresh`), `routes/users.js` (reuse +
foreign-token branches). Tests: `authUsersHooks.test.js` "S1: …" ×4.

### S6 — HIGH · `/oauth/token` is a credential-free binding path

`/login`, `/oauth/callback` and `/oauth/native` all prove a real secret
(password, single-use IdP code, IdP identity token). `/oauth/token` proves only
that the caller holds an `{accessToken, refreshToken}` pair — which is exactly
what a token thief has — and then called `bindAtIssue` like any other login.
GoTrue keeps `session_id` stable across rotation, so the pair resolved to the
victim's existing `AuthSession` row, which `insertSession` **upserts**. A thief
could therefore:

* **take the session over** — bind the victim's live session to their own key
  (`device_id` = attacker device, `bound_at_issue = true`), which both defeats
  `AUTH_DEVICE_BINDING=required` (the one control that makes a stolen refresh
  token useless) and locks the real device out of `/refresh` with
  `DEVICE_MISMATCH`; and
* **rotate the device row** — replay the victim's `deviceId` (readable from
  `GET /api/auth/devices` with the same stolen token) with their own key.
  `upsertDeviceForKey`'s rebind branch revokes every session on that device,
  wipes the enrolled `step_key_jwk`, clears `require_step_up` and re-marks the
  device `trusted`. This is S2 through a different door.

**Fix** — three parts.
1. `bindAtIssue` now looks the session up first. A row that **already exists and
   is bound** may only be re-issued by a caller whose DPoP thumbprint matches
   that device's key; otherwise it returns `rebindRefused` and writes nothing.
   Unconditional (a genuine credential always mints a fresh session id, so it
   never trips) but skipped in `off` mode, so the kill switch stays one.
2. `bindAtIssue` gained `credential` (default `true`). `/oauth/token` passes
   `false`, which forwards `allowRebind: false` to `upsertDeviceForKey` for any
   already-registered session and keeps the row's context (a re-presented pair
   can no longer promote a `restored` session to `interactive`).
3. `insertSession` no longer downgrades a registered session: the existing
   `device_id` / `bound_at_issue` are carried over when the call produced no
   device.
4. `/oauth/token` translates `rebindRefused` into the same verdict `/refresh`
   gives: `markMismatch` (revoke, flag the device, event, e-mail), revoke the
   pair GoTrue just minted, `401 DEVICE_MISMATCH`.

`services/authDeviceService.js` (`bindAtIssue`), `routes/users.js`
(`/oauth/token`). Tests: `authUsersHooks.test.js` §9 ×7 — 4 of them fail against
the pre-fix code, and the other 3 pin the flows that must keep working (the real
key still refreshes, `off` mode still passes, a fresh pair still binds).

### S8 — HIGH · `/reset-password` accepted any access token as a reset credential

`POST /api/users/reset-password` branches on `token.split('.').length === 3`.
The JWT branch called `auth.getUser(token)` and, on success, `admin.updateUserById(…,
{password})` — with **no check that the token came from a recovery flow**. A
normal login access token has the same shape, so a stolen bearer token was a
complete account takeover: set a new password without knowing the old one, while
`/api/users/password` right next to it demands the current password. The
persistent-login hook made the blast radius total — the same call now runs
`onPasswordReset` → every session and device revoked, every push token deleted,
every grant revoked, `sessions_valid_after = now` — i.e. it also locks the real
owner out. Pre-existing (present at `bf3abf3e`), but `/reset-password` is in
scope and the new hook is what turns it into a lockout.

**Fix** — `isRecoveryAccessToken()` in `routes/users.js`, two independent
fail-closed signals:
1. **`amr`** — GoTrue records how the session was authenticated. Reject as soon
   as it names a normal sign-in method (`password`, `oauth`, `id_token`, `totp`,
   `sso/saml`, `anonymous`, `webauthn`/`passkey`, `invite`, `signup`, …).
2. **the session registry** — every session we hand a client (login, OAuth,
   resume grant) gets an `AuthSession` row; the short-lived session behind a
   recovery link never does. A `session_id` we know is an application session
   whatever its `amr` says — this also covers resume-minted (`restored`)
   sessions, whose `amr` is `magiclink`.

Failures answer the existing generic `400 Invalid or expired reset token` (no
oracle). The `token_hash`/`verifyOtp` branch — the one iOS and Android actually
use — is untouched. Also added `resetPasswordLimiter` (10 / 15 min): the route
had no rate limit of its own despite being a lockout trigger.
Tests: `authUsersHooks.test.js` §11 ×5 (3 fail pre-fix).

### S2 — MEDIUM-HIGH · legacy adoption could rotate an existing device binding

`recordRefresh`'s legacy-adoption branch called `upsertDeviceForKey`, whose
"same client `deviceId`, different key" path is credential-grade: it revokes the
row's live sessions, wipes the enrolled step-up key and moves the binding.
Reachable from `/refresh`, which is not a credential event — a stolen refresh
token plus a `deviceId` read from `GET /api/auth/devices` was enough.

**Fix** — `upsertDeviceForKey` gained `allowRebind` (default `true`); the
adoption call site passes `interactive: false, allowRebind: false`, so a refresh
may create a row for a key it has never seen but never takes an existing
`(user, deviceId)` row away from its key, never marks the device interactively
trusted and never clears `require_step_up`. Tests: "S2: …" ×2.

### S3 — MEDIUM · `/logout` local resolved the caller after revoking the token

`admin.signOut(jwt, 'local')` deletes the GoTrue session, after which
`auth.getUser(jwt)` answers 403 `session_not_found`. Proof (a) was established
*after* that call, so in production every registry side effect of a local logout
(revoke the session row, delete that device's push tokens, revoke its resume
grants) was silently forfeited — the session stayed listed as live in "Where
you're logged in" and its push tokens kept receiving.

**Fix** — resolve the caller (`getUser` + `session_id` claim) **before**
`revokeSessionByAccessToken`. Test: "S3: …" (verified to fail against the
pre-fix code before being kept).

### S5 — MEDIUM · credential values echoed and logged by `validate()`

Joi's `context.value` was returned to the client as `rejectedValue` **and**
written to the warn-level log line. A password one character too long, an
over-length resume grant, an OAuth code, a DPoP/step-up signature — all landed
verbatim in the 400 body and in the logs.

**Fix** — `middleware/validate.js` redacts `rejectedValue` (and scrubs any Joi
message that quotes the value) for credential-bearing **leaf** field names, so
`device.keyBacking` stays readable while `password` / `grant` / `idToken` /
`signature` do not. Tests: `tests/unit/validateRedaction.test.js` ×13.

### S7 — MEDIUM · a client-declared header disabled `required` mode

`isCookieTransport(req)` is `X-Token-Transport: cookie` — chosen by the caller.
`checkRefresh` used it directly as `enforceProof = mode === 'required' &&
!cookieTransport`, and `getRefreshTokenFromRequest` then reads the token from the
`pantopus_refresh` cookie, which the caller also controls. Anyone holding a
stolen **unbound** refresh token could opt out of `required` mode by sending one
header and one cookie — defeating the flag whose entire purpose is to force
legacy sessions to re-login. (Bound sessions were never at risk: they fail
`verifyRefreshProof` and get `DEVICE_MISMATCH` regardless of the declared
transport.)

**Fix** — the web exemption now also requires that nothing says "native client":
* the request carries no native markers (`X-Client-Platform: ios|android`,
  `X-Device-Id`, a `DPoP` header, or `device`/`deviceId` in the body), and
* the **session row** was not issued to a native client — `device_id` /
  `bound_at_issue` are conclusive, otherwise the `user_agent` recorded at
  issuance decides. That value was written by the genuine client and an attacker
  cannot rewrite it without first passing this very check.

Unknown/absent user agents still count as non-native, so server-side web proxies
keep working. `services/authDeviceService.js` (`checkRefresh`,
`looksNativeRequest`, `sessionLooksNative`). Tests: `authUsersHooks.test.js` §10
×8 (6 fail pre-fix), including the two that must keep passing — a real browser
session, and a bound session still answering `DEVICE_MISMATCH`.

### S4 — LOW-MED · reuse detection rested on an error-message regex

`/^already used|not found$/i` over `error.message` was the only signal. Fragile
(a GoTrue wording change silently disables reuse detection) and far too broad
(any unrelated "… not found" revokes a live session, flags the device
`suspect` and mails the user).

**Fix** — `isRefreshReuseError()` prefers GoTrue's structured `code`
(`refresh_token_already_used` / `refresh_token_not_found`) and falls back to the
regex only when no code is present. Tests: this pass added the missing coverage
for the branch the fix introduced — `authUsersHooks.test.js` §12 ×4: both reuse
codes fire regardless of wording, a non-reuse code whose message contains "not
found" is *not* punished, and code-less releases still use the regex.

### S10 — LOW-MED · unvalidated `req.ip` reaches `inet` columns

`clientIp()` returned `req.ip` verbatim. With `trust proxy` enabled, Express
derives that from `X-Forwarded-For` and neither Express nor `proxy-addr`
validates the hop it picks (verified: `proxyaddr(req, () => true)` on
`X-Forwarded-For: not-an-ip-at-all` returns the string unchanged). It flows into
three `inet` columns — `AuthSession.last_ip`, `AuthDevice.last_ip`,
`AuthSecurityEvent.ip` — where a non-address value fails the write with 22P02
and takes the whole row with it: no session row on login (the session escapes
the registry entirely — unlistable, unrevocable), no rotation hashes on refresh
(which in `required` mode signs the user out on the next call), no security
event. Reachable without an attacker whenever an upstream emits the literal
`unknown` that RFC 7239 permits, and attacker-controlled whenever the configured
hop count exceeds the real proxy chain.

**Fix** — `authSessionService.clientIp()` drops an IPv6 zone index and returns
`null` unless `net.isIP()` accepts the value. One central chokepoint; all three
columns go through it. Test: `authDeviceService.test.js` "clientIp — only real
addresses reach the inet columns (S10)" ×4, including an `insertSession` that
still stores its row under a bogus forwarded IP.

### S9 — LOW · control characters survived in device descriptors

`str()` trimmed but did not strip C0/C1 control characters, so a client-chosen
`device.name` / `model` / `osVersion` carried `CR`/`LF`/`NUL` into log lines, push
bodies, the security-event feed and the **e-mail subject**
(`New sign-in on <name>`). Nodemailer collapses newlines in header values, so
SMTP header injection was already blocked — log-record forgery was not.

`str()` replaces `[\u0000-\u001f\u007f-\u009f]` with a space before
trimming. Test in `authDeviceService.test.js`'s descriptor case.

### S11 — LOW · DPoP `htu` trusts the request's own Host when unpinned

With `PUBLIC_API_BASE_URL` unset, `expectedHtu()` derives the origin from the
request's `Host`/`X-Forwarded-Proto`. A proof a client was tricked into minting
for an attacker-controlled host can then be replayed against the real API by
spoofing that same `Host`, wherever the edge forwards unknown Host values.

**Hardened, not changed** — pinning is an ops action, and failing closed on
deploy would be worse than the risk. `publicApiBaseUrl()` now warns once at
startup in production when it is unset, and `.env.example` says why it matters.
**Ops: set `PUBLIC_API_BASE_URL` before flipping `AUTH_DEVICE_BINDING=required`.**

---

## Threat model — what held

Each of these was attacked and did not break.

**Stolen access token, bearer only.** Cannot create or rotate a binding
(`/devices/register` and `/step-up-key` both demand a DPoP proof matching the
session's bound key; `bindAtIssue` is unreachable without a credential — S6 was
the exception and is closed). Cannot obtain a resume grant (same gate). Cannot
enrol a step-up key (same gate, plus an interactive bound session). Cannot revoke
devices or sessions (`X-Step-Up` needs the password or a signature from the
biometry-gated step-up key). *Can* read `GET /api/auth/devices` and
`/security-events` — contract-sanctioned, own account only.

**Stolen refresh token.** Bound session ⇒ `verifyRefreshProof` requires the
session's key *and* `rth == sha256(presented token)`. Unbound legacy session ⇒
adoptable in `optional` mode, which is the documented status-quo risk of that
mode; it cannot rotate an existing binding (S2) and it never happens in
`required` mode (unbound ⇒ `DPOP_REQUIRED` before adoption is considered — S7
closed the header-spoof around that).

**`/logout` without proof.** Cookie clearing and revoking the presented JWT
always run; every row side effect needs a valid Bearer whose session is bound to
the given `deviceId`, or a refresh token whose session's bound key verifies the
DPoP. A wrong key, a missing proof or a bearer bound to another device yields
`{success:true}` and no writes. `SameSite=Lax` keeps cross-site POSTs from
carrying the cookies.

**Restored sessions.** `requireStepUp` refuses `device_key` tokens whenever the
current session's context is `restored`, and `verifyStepUpDeviceKey` refuses to
mint one; `enrolStepUpKey` refuses non-interactive sessions. Password (and the
`generic` wildcard from `/reauthenticate`, which *is* a password) is accepted and
promotes the session — per design §7.10. S6 closed the one path that promoted a
restored session without a credential.

**DPoP.** `alg` pinned to ES256 in the header *and* in `jwtVerify`; the embedded
JWK must be a public P-256 EC key (`oct`/RSA/P-384/`alg:none`/private `d`
rejected before verification); `htm`/`htu` bound to the request (query stripped,
RFC 3986 normalised) so a proof cannot cross paths; `iat` ±300 s enforced twice;
`jti` single-use via an `AuthDpopJti` **primary-key insert** (not check-then-
write), burned only after the cheaper checks pass so a bad proof cannot consume a
legitimate one; the thumbprint is computed from the canonical `{kty,crv,x,y}`;
`rth` compared with `timingSafeEqual`. Host confusion is S11.

**Resume grants.** 32 random bytes, stored hashed, unique-constrained;
single-use through an atomic `update … is('used_at',null).is('revoked_at',null)
.select()` (DB compare-and-set, no race); expiry, revocation, `allowRestoreGrants
= false` and a banned auth user all yield the same opaque `RESUME_GRANT_INVALID`;
cross-user is impossible (the row carries `user_id` and `mintSessionForUser`
re-checks the minted user); rate-limited 5/15 min per IP **and** 3/15 min per
grant hash. Device revoke / lockdown / password reset all revoke grants.

**Step-up tokens.** HMAC-SHA256 verified with `timingSafeEqual` before the
payload is parsed; `uid` checked against `req.user.id`; `purpose` must match or
be the password-only `generic` wildcard; `sid` must match the current session;
`exp` 5 min; one-shot for `delete_account`/`revoke_device`/`revoke_sessions` via
an `AuthChallenge` PK insert that fails closed on any DB error.
`delete_account` additionally enforces the strongest-method rule twice (in
`availableStepUpMethods` and in `requireStrongestStepUpForDeletion`).
Challenges are consumed by an atomic `DELETE … RETURNING`, so a wrong signature
burns the nonce.

**Injection / mass assignment.** Every new query uses supabase-js builders with
parameterised `.eq()`; no template-interpolated filters were added. All writes
build explicit column maps (`descriptorPatch`, `insertSession`,
`patchSecurityPrefs` coerces to booleans) — no spread of request bodies.
Descriptors go through `normalizeDeviceDescriptor` (UUID, enum, regex, 16 KB cap
on `attestation`) before touching a row.

**Information leaks.** `listDevices`, `listActiveSessions`, `listSecurityEvents`
and `revokeDevice` are all scoped by `user_id`, and `revokeDevice` 404s on
another user's row. No token, grant, signature, JWK or secret is logged anywhere
in the new code (grepped).

**Rate limiters.** `/step-up` and `/devices/register` key on `req.user.id`;
`/resume` on IP *and* grant hash; `/reauthenticate` and `/password` gained a
per-account limiter next to the per-IP one (S5 pass), closing the distributed
password-guessing hole a stolen access token opened; `/reset-password` gained one
in this pass (S8).

**Web / CSRF.** All `/api/auth/*` routes run behind `verifyToken`, which invokes
`csrfProtection` for cookie transport (double-submit + HMAC session binding) and
skips it for Bearer. `/api/auth/resume` is unauthenticated but needs a grant and
a DPoP proof, and is not cookie-authenticated.

**Socket layer.** The handshake now refuses revoked sessions and tokens older
than `sessions_valid_after`, and `session_revoked` events disconnect the matching
sockets (all of the user's for user-wide reasons).

---

## Accepted risks / follow-ups (not defects)

1. **`keyBacking` and `hasOsLock` are self-asserted.** Trust level, grant
   eligibility and the "software keys can never redeem a grant" rule all rest on
   client claims; `attestation` is stored but not verified and
   `attestation_level` stays `none` in v1 (design §13, Phase 3). A rooted device
   can claim `strongbox`.
2. **Rate limiters are in-process.** `routes/authDevices.js` says so already:
   move them to a shared store before flipping `AUTH_DEVICE_BINDING=required` on
   a multi-instance fleet, or the per-grant and per-user caps divide by the
   instance count.
3. **`pushService.saveToken` upserts on `token` alone**, so registering another
   user's APNs/FCM token re-points that row at the registering account.
   Pre-existing (`/api/notifications/register` has the same shape) and hard to
   exploit (you need the victim's device token), but `/api/auth/devices/register`
   is a second door to it. Proper fix needs a `(user_id, token)` unique
   constraint — a migration, out of this review's scope.
4. **`/oauth/:provider` accepts any host under `pantopus:` / `exp:` / `exps:`**
   for `redirectTo`. Pre-existing; the authoritative gate is Supabase's own
   Redirect-URL allow-list, this check is only a second layer. Worth tightening
   when the dev-time `exp:` schemes are retired.
5. **Cache staleness.** `verifyToken`'s role/watermark cache is 60 s and the
   session-state cache 15 s, so a revocation from another instance takes effect
   within that window on soft reads. `/refresh` always reads uncached. Documented
   in the code; unchanged.
6. **Step-up challenges are not bound to a user or a purpose.** A nonce is
   unauthenticated to fetch and single-use to spend, and an attacker cannot sign
   it, so this is not exploitable today — but binding `purpose` into the
   challenge would make a compromised client unable to reuse a signature the user
   approved for a different action. Worth doing if step-up gains more purposes.

---

## Files changed in this pass

| File | Change |
|---|---|
| `backend/services/authDeviceService.js` | S6 `bindAtIssue`: refuse to re-point an already-bound session (`rebindRefused`), `credential` flag → `allowRebind`, never downgrade a registered row's binding/context. S7 `checkRefresh`: `webExemption` + `looksNativeRequest` / `sessionLooksNative`. S9 `str()` strips control characters. |
| `backend/services/authSessionService.js` | S10 `clientIp()` validates with `net.isIP()` (zone index dropped) so a bad forwarded hop cannot fail an `inet` write. |
| `backend/routes/users.js` | S6 `/oauth/token` passes `credential:false` and turns `rebindRefused` into `markMismatch` + pair revocation + 401 `DEVICE_MISMATCH`. S8 `isRecoveryAccessToken()` + the `/reset-password` JWT-branch gate + `resetPasswordLimiter`. |
| `backend/config/authPolicy.js` | S11 warn once in production when `PUBLIC_API_BASE_URL` is unset; reset the flag in `_resetForTests`. |
| `backend/.env.example` | S11 documents why `PUBLIC_API_BASE_URL` matters. |
| `backend/tests/authUsersHooks.test.js` | +24 tests: §9 S6 (7), §10 S7 (8), §11 S8 (5), §12 S4 (4). |
| `backend/tests/authDeviceService.test.js` | +4 tests for S10 `clientIp`, + S9 assertions in the descriptor case. |

## Commands run

* Baseline (before any change):
  `npx jest tests/authDpop tests/authStepUp tests/authDeviceService tests/authDevicesRoutes tests/authUsersHooks tests/unit/validateRedaction tests/unit/oauthRoutes`
  → **7 suites / 248 tests / 0 failures**.
* Pre-fix verification (fix temporarily neutralised, then restored):
  S6 → 4 of 7 new tests fail; S7 → 6 of 8 fail; S8 → 3 of 5 fail.
* Final: `cd backend && pnpm test` →
  **220 suites passed (1 skipped) / 3479 tests passed, 16 skipped, 0 failures**
  (3451 before this pass; +28 new tests).

## Log (append-only)

- 2026-08-19: report created; CONTRACT.md, WORKLOG IMPLEMENTATION, conformance.md
  and the whole backend surface read. S1–S4 found and fixed.
- 2026-08-19: S5 fixed; DPoP key-confusion coverage widened; per-account limiter
  added to `/reauthenticate` and `/password`.
- 2026-08-20 (resumed after a session cut-off): working tree clean at `5ee02db0`;
  re-read every file in scope and confirmed S1–S5 are present and correct in the
  working tree (not merely claimed by this report). Continued the threat model
  into the uncovered areas — `/oauth/*`, `/reset-password`, transport
  declaration, resume grants, challenges, rate-limiter keys, notification and
  e-mail sinks, `inet` columns, the socket layer — and found S6–S11. All fixed
  with regression tests; full suite green. Status: DONE.
