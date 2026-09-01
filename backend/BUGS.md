# Backend bugs and issues

Summary of bugs, config issues, and technical debt found in the backend (as of audit).

---

## 1. Test and config issues

### 1.1 Jest integration config typo

- **File:** `jest.integration.config.js`
- **Line:** 16
- **Issue:** Option is `setupFilesAfterSetup: []` but the correct Jest option is `setupFilesAfterEnv`. This causes a validation warning and the intended setup file is never run.
- **Fix:** Rename to `setupFilesAfterEnv` and set the correct path if you use a setup file.

### 1.2 Integration tests require env and fail without it

- **Suites affected:** 8 failed when run without Supabase env vars:
  - `tests/integration/auth-exploits.test.js` (requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
  - `tests/integration/chatMessageDelivery.test.js` (requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`)
  - `tests/integration/chatAccessControl.test.js` (same)
  - `tests/integration/neighborhoodPulse.integration.test.js`
  - `tests/integration/schema-validation.test.js`
  - `tests/integration/home-mailbox.test.js`
  - `tests/integration/gig-lifecycle.test.js`
- **Issue:** Suites throw at load time if env is missing, so `npm run test:integration` fails with 40 failed tests when Supabase is not configured. Not a logic bug, but CI/local must have env (or suites should skip gracefully like `businessAddress.test.js`).
- **Suggestion:** Document required env in README; optionally skip integration suites with a clear message when env is missing instead of throwing.

### 1.3 Unit test worker exit warning

- **Observed:** Jest reports: “A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown.”
- **Issue:** Possible open handles (timers, connections, etc.) not cleaned up after tests.
- **Suggestion:** Run with `--detectOpenHandles` to find leaks and add proper teardown (e.g. close DB/socket servers, clear timers).

### 1.4 Skipped unit tests

- **Count:** 8 tests skipped in the unit run (1955 passed, 8 skipped, 1963 total).
- **Example:** `tests/businessAddress.test.js` uses `const conditionalDescribe = hasEnv ? describe : describe.skip` so the “with live Supabase” block is skipped when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are not set. Intentional; worth documenting so it’s clear why some tests don’t run in default unit mode.

---

## 2. Code quality / potential bugs

### 2.1 Empty catch blocks in gigs route

- **File:** `routes/gigs.js`
- **Lines:** 1880, 1889
- **Code:**
  - `catch {}` around `getUserExclusions(currentUserId)` and `applyUserExclusions(rows, excl)`.
  - `catch {}` around `affinityService.getUserAffinities(currentUserId)`.
- **Issue:** Errors are swallowed; no logging or fallback. Failures in exclusions or affinities can make behavior hard to debug and may hide real bugs.
- **Fix:** At least log the error (e.g. `logger.warn('getUserExclusions failed', { err })`); optionally fall back to “no exclusions” / “no affinities” and document that behavior.

---

## 3. Documented BUG references (tracking / fixes)

These are in-code references to past or planned work. Many are already fixed (comments note “fix” or describe the fix).

| Ref   | File(s) | Description |
|-------|---------|-------------|
| BUG 1A | `routes/home.js:1176` | Targeted invite: strict identity check (comment notes “BUG 1A fix”) |
| BUG 1C | `routes/upload.js:1271, 1275, 1311` | Content hash, MIME validation, duplicate evidence checks (documented as BUG 1C) |
| BUG 3A | `routes/home.js:4922` | 3-path cold-start routing (comment notes “BUG 3A fix”) |
| BUG 4B | `routes/homeOwnership.js:1713` | Per-address postcard rate limit — max 2 pending codes per home_id |
| BUG 5A | `routes/homeOwnership.js:206` | Property data match — auto-verify against public records |
| BUG 5B | `routes/homeIam.js:91, 130`, `jobs/index.js:267`, `jobs/notifyClaimWindowExpiry.js:2` | Surface claim_window_ends_at; notify claim window expiry |
| BUG 6B | `jobs/index.js:258` | Validate Home Coordinates |
| BUG 6C | `routes/home.js:407` | Auto-link unit homes to parent building |
| BUG 7A | `routes/home.js:140` | All server routes use supabaseAdmin (service_role) exclusively (comment notes “BUG 7A fix”) |

Treat these as product/security tracking items; confirm in code whether each is fully implemented or still pending.

---

## 4. TODOs and deferred work

| File | Line | TODO |
|------|------|------|
| `routes/professional.js` | 353 | Integrate with external verification provider |
| `routes/home.js` | 502 | Make claim method dynamic once property_data_match is implemented |
| `routes/businessSeats.js` | 566 | Send invite email via emailService (Prompt 6 will add notification routing) |
| `services/geo/mapboxProvider.js` | 88 | Upgrade to Mapbox Search Box API v2 when access is available |

---

## 5. Summary counts

| Category | Count |
|----------|--------|
| Config/typo (actionable) | 1 (Jest `setupFilesAfterSetup`) |
| Integration suites failing without env | 8 suites (40 tests) |
| Empty catch blocks | 2 (same file) |
| Documented BUG refs in code | 9 refs across multiple files |
| TODOs | 4 |
| Unit test leak warning | 1 (investigate with `--detectOpenHandles`) |

---

*Generated from backend audit. Re-run tests and codebase scan to refresh.*
