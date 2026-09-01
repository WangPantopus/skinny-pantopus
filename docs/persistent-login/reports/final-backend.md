# Stage F — final BACKEND verification (persistent-login)

Status: DONE (2026-08-20) — **everything green, zero failures, no fixes needed.**

Role: run the full backend test surface exactly as `.github/workflows/ci.yml`
runs it, fix anything this feature broke, report exact pass/fail counts and any
pre-existing failures with evidence. **No source file was changed in this pass**
(nothing failed), so the working tree is byte-identical to the state Stage E
(security review) left behind.

---

## 1. On-disk state verified

Working tree on top of `5ee02db0` (branch `persistent-login`), backend scope:

```
 M backend/.env.example
 M backend/config/authPolicy.js
 M backend/routes/users.js
 M backend/services/authDeviceService.js
 M backend/services/authSessionService.js
 M backend/tests/authDeviceService.test.js
 M backend/tests/authUsersHooks.test.js
```
`649 insertions(+), 12 deletions(-)`; **no untracked files** under `backend/` or
`supabase/migrations/`. These are the Stage E S6–S11 fixes (rebind refusal on
`/oauth/token`, `/reset-password` recovery-token gate, `webExemption` for
`required`-mode DPoP, `clientIp()` `inet` validation, control-character
stripping, `PUBLIC_API_BASE_URL` production warning) plus their +28 regression
tests. The rest of the feature (migration 160, `middleware/dpop.js`,
`middleware/stepUp.js`, `routes/authDevices.js`, `services/auth*.js`,
`jobs/authRegistryPrune.js`, the `users.js` hooks) is already committed in
`5bdcee1a`.

---

## 2. CI-equivalent runs (all three CI backend steps)

### Step 1 — "Run Identity Firewall backend tests"
`pnpm test -- --runInBand tests/unit/identitySerializers tests/unit/identityPolicy
tests/unit/identityFirewallPrivacy tests/unit/identityFirewallHardening
tests/unit/identityFirewallRegression tests/unit/identityFirewallMigrationSmoke
tests/unit/identityFirewallRawUserAuditScript tests/unit/personaCompliance
tests/unit/feedIdentityAuthors tests/unit/rawUserIdentityResponses`

```
Test Suites: 10 passed, 10 total
Tests:       60 passed, 60 total
```
**PASS** (exit 0).

### Step 2 — "Run privacy gates"
`pnpm run test:privacy` (= `node scripts/ci/run-privacy-gates.js`)

All gates green:
* Gate 1/2 serializer + notification-context firewall — `1 suite / 24 tests passed`
* Gate 3a legacy identity-aliases — OK
* Gate 3b legacy UI terms — OK
* Gate 3c legacy CREATOR_SELECT — OK
* Gate 3d raw personal-identity SELECT — OK
* Gate 3e nested User select — OK
* Gate 4 Phase-1 audience-profile E2E — `1 suite / 15 tests passed`
* `OK — all privacy gates passed.`

**PASS** (exit 0). Note the auth work touches `routes/users.js` and adds
`services/authNotifyService.js`, both of which the raw-personal-SELECT and
notification-context gates police — they are clean.

### Step 3 — "Run Jest tests" (full suite)
`cd backend && pnpm test`

```
Test Suites: 1 skipped, 220 passed, 220 of 221 total
Tests:       16 skipped, 3479 passed, 3495 total
Snapshots:   0 total
Time:        12.2 s
EXIT=0
```
**PASS.** Re-run a second time to rule out flakes: identical
(`220 passed / 3479 passed / EXIT=0`, 13.0 s). Logs:
`…/scratchpad/backend-full-test.log`, `…/backend-full-test-2.log`.

Count check against the record: `5bdcee1a` committed at **3451** tests; Stage E
added 28 → **3479**. Matches exactly, so every new regression test really is
being collected and run.

### Auth-surface subset (evidence for this feature specifically)
`npx jest tests/authDpop tests/authStepUp tests/authDeviceService
tests/authDevicesRoutes tests/authUsersHooks tests/unit/verifyTokenSession
tests/integration/auth-exploits tests/unit/validateRedaction`

```
Test Suites: 8 passed, 8 total
Tests:       296 passed, 296 total
```

---

## 3. Pre-existing conditions (NOT caused by this feature)

| Observation | Evidence it is pre-existing / benign |
|---|---|
| `1 skipped suite, 16 skipped tests` | `tests/ai/supportTrainDraft.eval.test.js` = the whole suite (8 tests) behind `describeIfKey = HAS_API_KEY ? describe : describe.skip`; `tests/businessAddress.test.js` skips 8 tests behind `conditionalDescribe = hasEnv ? describe : describe.skip` (50 of its tests pass). Verified by running each file alone. CI has neither the API key nor the DB env, so CI skips the same 16. |
| `A worker process has failed to exit gracefully…` + `Force exiting Jest` | The `test` script has always been `jest --verbose --forceExit`; the warning is emitted on the untouched suites too and the run exits 0. |
| `watchman warning: Recrawled this watch 37 times` | Local watchman state on this machine; absent in CI. |
| `require('./jobs')` throws `Neither apiKey nor config.authenticator provided` outside jest | Stack is `jobs/index → … → stripe/stripeService.js:8 → getStripeClient` — a missing `STRIPE_SECRET_KEY` in this shell, nothing to do with auth. `jobs/authRegistryPrune` (the job this feature added) requires cleanly on its own. |
| `tests/integration/persona*` not collected | `jest.config.js testPathIgnorePatterns` — long-standing. |

**There are no failing tests in the backend, pre-existing or otherwise.**

---

## 4. Extra checks run beyond the three CI commands

* **Syntax** — `node --check` on all six changed `.js` files: OK.
* **Module load** — required with dummy Supabase env:
  `routes/authDevices`, `routes/users`, `jobs/authRegistryPrune`,
  `middleware/{dpop,stepUp,optionalAuth,verifyToken}`,
  `services/{authDeviceService,authSessionService,authNotifyService}`,
  `config/authPolicy` → **all load** (catches a mount-time typo that the
  per-router tests, which build their own express app, would not).
* **No `.only` / stray skips** — grepped `tests/`: the only `describe.skip`s are
  the two env-gated ones above; no `it.only`/`describe.only` anywhere.
* **Real `verifyToken` is exercised** — `jest.config.js` maps
  `^../middleware/verifyToken$` to a mock, but `tests/unit/verifyTokenSession.test.js`
  requires `../../middleware/verifyToken` (not matched by the mapper), so the new
  session-revocation + `sessions_valid_after` watermark logic is genuinely tested,
  not mocked away. Socket revocation likewise: `tests/unit/chatSocketSessionRevoke.test.js`.
* **Backward compatibility is covered by tests, not just by claim** —
  `authUsersHooks.test.js` has explicit cases for pre-registry sessions with no
  row, unbound legacy rows in `optional` vs `required` mode, adoption before/after
  `DPOP_CUTOVER`, adoption refused without a client `deviceId`, and web cookie
  transport still refreshing in `required` mode; `authDeviceService.test.js`
  covers "no device descriptor (web / legacy) → unbound session row, no device".
* **Migration numbering** — `backend/database/migrations/160_auth_devices.sql` is
  still the head (159 → 160, no collision), mirrored as
  `supabase/migrations/20260818000000_auth_devices.sql`. Both committed.
* **Review of the uncommitted Stage E diff** (read in full, nothing to fix):
  `bindAtIssue` now resolves `getSessionById` first and refuses to re-point an
  already-bound session (`rebindRefused`) unless the caller proves the bound key —
  gated on `mode !== 'off'` so the kill switch still kills, and skipped entirely
  for unbound sessions, so web/Expo `/oauth/token` callers are unaffected;
  `allowRebind: credential || !existingSession` keeps device-row rotation on
  credential paths only; `checkRefresh`'s `webExemption` requires
  *both* the client-declared `X-Token-Transport: cookie` *and* no native marker on
  the request *and* a non-native stored session row, so the exemption cannot be
  claimed by a stolen-token holder; `isRecoveryAccessToken` fails closed on any
  `amr` naming a normal sign-in **and** on any `session_id` that has an
  `AuthSession` row. All consistent with CONTRACT.md and with the security
  invariants (bind only at credential issuance; refresh proof verified against the
  key bound to *that* session; no bearer-only path creates or rotates a binding).

---

## 5. What the next stage must know

1. **Backend is CI-green as it stands.** Nothing in this pass required a code
   change; the tree Stage E left is the tree that passes.
2. **The Stage E fixes are still uncommitted** (7 files). The parent session
   commits — these must go in before the branch is considered complete, or CI on
   `origin/persistent-login` is testing the *old* (S6/S8-vulnerable) backend.
3. **Ops preconditions before flipping `AUTH_DEVICE_BINDING=required`** (unchanged,
   restated because they are release-blocking): set `PUBLIC_API_BASE_URL` (DPoP
   `htu` otherwise trusts the request Host; production now logs a warning once) and
   set `DPOP_CUTOVER` to the DPoP-capable client ship date (default is far future,
   i.e. every legacy session stays adoptable). Also move the in-process rate
   limiters to a shared store on a multi-instance fleet.
4. **Accepted v1 risks** are listed in `reports/security-review.md` ("Accepted
   risks / follow-ups") — self-asserted `keyBacking`/`hasOsLock`, in-process
   limiters, `pushService.saveToken` upserting on `token` alone. None of them are
   test failures; all are tracked.

---

## Log (append-only)
- 2026-08-20: report created; read CONTRACT.md, WORKLOG IMPLEMENTATION section,
  reports/security-review.md, git status/diff scoped to backend.
- 2026-08-20: CI step 1 (identity firewall) 10 suites / 60 tests PASS.
- 2026-08-20: CI step 2 (`pnpm run test:privacy`) all gates PASS.
- 2026-08-20: CI step 3 (`pnpm test`) 220 suites / 3479 tests / 0 failures,
  exit 0; second run identical (no flakes).
- 2026-08-20: auth subset 8 suites / 296 tests PASS; skipped-suite provenance
  identified (env-gated, pre-existing); `node --check` + module-load smoke on all
  new/changed backend modules; read the full uncommitted Stage E diff — no defects,
  no changes made. Status: DONE.
