# Web + Docs layer — progress report

Status: DONE

Owner: web/docs implementer (layer: frontend/apps/web, frontend/packages, docs, tools).
Started: 2026-08-18.

## Plan
1. Association files (AASA + assetlinks) — add native iOS appID; Android entry only if fingerprint determinable, else generator script + ASSOCIATION-FILES.md.
2. Web: packages/api client functions for /api/auth/*; /app/settings/security page; link from settings index; tests if setup exists.
3. Next middleware hasStaleSession fix (refresh-before-clear).
4. Docs: docs/01 §1, docs/mobile/auth-backend-contracts.md §7 + new contracts, docs/07 supersede note, deep-dive §7 supersede note, privacy inventory + labels/data-safety notes.
5. Run typecheck/lint/tests; record exactly what ran.

## Files created / changed
- `frontend/apps/web/public/.well-known/apple-app-site-association` — added `6UYZBA546R.app.pantopus.ios` to applinks.details (same paths) + webcredentials.apps; legacy Expo entry kept.
- `frontend/apps/web/public/.well-known/assetlinks.json` — content unchanged (legacy entry only; reformatted to the generator's stable JSON). Native Android statement NOT added: fingerprint not in repo (keystore is CI secret `ANDROID_KEYSTORE_BASE64`; Play App Signing key only in Play Console).
- `tools/gen-association-files.mjs` — node, no deps; upserts native entries from env (APPLE_TEAM_ID, IOS_BUNDLE_ID, ANDROID_PACKAGE, ANDROID_SHA256_FINGERPRINTS, AASA_PATHS, WELL_KNOWN_DIR), preserves legacy entries, `--check` mode.
- `docs/persistent-login/ASSOCIATION-FILES.md` — what values are needed, how to regenerate, how to verify (Apple CDN, swcutil, Google statements:list, adb pm get-app-links), and note that Android asset_statements meta-data lands with Credential Manager (Android layer).

### Web API client (frontend/packages/api)
- `src/endpoints/authDevices.ts` (NEW) — types + functions per CONTRACT: `getDevices`, `revokeDevice(id, stepUpToken)`, `revokeOtherSessions`, `revokeAllSessions`, `stepUpWithPassword`, `stepUpWithDeviceKey`, `createChallenge`, `getSecurityPrefs`, `updateSecurityPrefs(prefs, token)`, `getSecurityEvents(limit)`; helpers `isStepUpRequired`, `getApiErrorCode`, `isSecuritySignOutCode`, `STEP_UP_HEADER`. `X-Step-Up` sent via request config headers; cookie transport + CSRF come from the shared client. DPoP-only endpoints (`/devices/register`, `/resume`, `/step-up-key`) intentionally not exposed.
- `src/endpoints/auth.ts` — additive: `AuthResponse` gains `sessionId`, `session.{id,context}`, `device`; `logout(options?: {scope, stepUpToken})` (default local = exact legacy request); `reauthenticate` typed as `ReauthenticateResponse` (`stepUpToken`, `expiresAt`, `purpose`).
- `src/index.ts` — exports `authDevices` namespace + types.

### Web app (frontend/apps/web)
- `src/app/(app)/app/settings/security/page.tsx` (NEW) — "Where you're logged in": current browser pinned, native devices (trust badge, last seen/IP, Remove → step-up `revoke_device` → DELETE), other web sessions, "Sign out of all other devices" (step-up `revoke_sessions` → revoke-others), "Sign out everywhere" (revoke-all → local logout → /login), security prefs toggles (step-up `change_security_prefs` → PATCH), recent security events (+ Show more via /security-events). Graceful error banner + retry if GET /devices fails (backend not deployed yet).
- `src/components/settings/StepUpPasswordModal.tsx` (NEW) — password step-up modal on ModalShell; handles 401/429; no-password (OAuth-only) accounts get "Set a password" guidance (device_key step-up is native-only).
- `src/lib/securityActivity.ts` (NEW) — pure helpers: event labels, UA → "Chrome on macOS", relative time, trust labels, meta summary.
- `src/app/(app)/app/profile/settings/page.tsx` — new "Security" card linking to /app/settings/security.
- `src/middleware.ts` — stale session (`pantopus_session=1`, no `pantopus_access`) NO LONGER clears cookies. `/app/*` → 307 to `/session/refresh?redirectTo=…(&onFail=<public twin>)`; `/` → `/session/refresh?redirectTo=/app/place&onFail=/`; auth pages pass through untouched; `/session/refresh` always passes. Anonymous + authenticated behaviour unchanged.
- `src/lib/session-refresh.ts` (NEW, Edge-safe) — `SESSION_REFRESH_PATH`, loop-guard helpers, `safeLocalPath`, `hardNavigate`.
- `src/app/session/refresh/page.tsx` (NEW) — calls `refreshAuthSession({trigger:'middleware_stale_session'})` (shares the single-flight mutex in packages/api client.ts); success → full navigation to redirectTo; invalid → `POST /api/users/logout` (clears the path-scoped refresh cookie) → onFail or /login?redirectTo; transient → keep cookies, Retry / Sign in; sessionStorage loop guard (15 s).
- `tests/__mocks__/@pantopus/api.ts` — added `auth`, `authDevices`, `clearAuthToken`, `refreshAuthSession` mocks (additive).
- Tests (NEW): `tests/securitySettingsPage.test.tsx` (11), `tests/sessionRefresh.test.tsx` (17: middleware + refresh page + helpers), `tests/securityActivity.test.ts` (7), `tests/associationFiles.test.ts` (5: hosted files + generator).

### Docs (step 4)
- `docs/01-authentication-authorization.md` — §1 Token Lifecycle rewritten; NEW §1.1 sessions/devices/binding, §1.2 revocation semantics, §1.3 error codes, §1.4 flags, §1.5 web session recovery; cookie table extended. (Written in run 1; verified present on disk in run 2. References `docs/mobile/auth-backend-contracts.md §8` — created in run 2.)

## Done (all steps)
- Step 1 (association files + generator + doc). Android native statement deliberately NOT written (fingerprint unknown — see ASSOCIATION-FILES.md).
- Step 2 (API client, security page, step-up modal, settings link, tests).
- Step 3 (middleware refresh-before-clear + /session/refresh route + tests; documented in docs/01 §1.5).
- Step 4 docs: docs/01 §1 (+§1.1–1.5), auth-backend-contracts §1/§7/§8, docs/07 supersede note, deep-dive §7 supersede + Finding 1 FIXED, privacy inventory, appstore-privacy-labels, play-data-safety.
- Step 5 final verification (see "Final verification" below).

## Remaining
- Nothing in this layer. Follow-ups for humans/other layers:
  - Confirm the native iOS Team ID really is `6UYZBA546R` (project.yml DEVELOPMENT_TEAM is blank); if not, rerun `APPLE_TEAM_ID=<id> node tools/gen-association-files.mjs`.
  - Obtain the Play App Signing + upload SHA-256s for `app.pantopus.android` and run the generator with `ANDROID_SHA256_FINGERPRINTS=…` (adds handle_all_urls + get_login_creds statement); the Android `asset_statements` meta-data lands with Credential Manager (Android layer).
  - iOS entitlements need `webcredentials:pantopus.com` (+www) — iOS layer.
  - Backend must serve `/api/auth/*` for the page to show data; the page degrades gracefully (banner + Retry) until then.

## Resume log
- Run 2 (2026-08-18, after cutoff): `git status` confirmed all files above exist; re-ran `tsc --noEmit` (exit 0) and the 4 new jest suites (40 passed). Continuing with step 4b.

- Run 3 (2026-08-18, after second cutoff): `git status` shows all files above on disk. Run 2 additionally completed (verified via `git diff`): `docs/compliance/privacy-data-inventory.md` (§1 chokepoints row, §2.6 identifiers rows, NEW §2.9 security & session records + local-only items table, §3 required-reason re-check, §4 SDK rows, §5 retention/deletion/local storage, §6 change-control), `docs/compliance/appstore-privacy-labels.md` (Device ID note, Other Data row + IP/UA note, biometrics note, consistency table). `docs/compliance/play-data-safety.md` only had its "Last reviewed" line changed — the Device-or-other-IDs / security-purpose content update is what Run 3 continues with, then the final typecheck/lint/test pass.

## Commands run
- `APPLE_TEAM_ID=6UYZBA546R node tools/gen-association-files.mjs` → wrote both files; `--check` → up to date. Scratch run with fake fingerprints verified upsert + idempotence + rejection of malformed fingerprints.
- `frontend/apps/web: ./node_modules/.bin/tsc --noEmit` → exit 0 (0 errors) after api + web changes.
- `frontend/apps/web: eslint <changed files>` → 0 errors (1 pre-existing @ts-nocheck warning in profile/settings/page.tsx).
- `jest tests/securitySettingsPage.test.tsx` → 11 passed; `jest tests/sessionRefresh.test.tsx` → 17 passed; `jest tests/securityActivity.test.ts tests/associationFiles.test.ts` → 12 passed; `jest tests/identityFirewallWeb.test.tsx --runInBand` (CI's web test) → 19 passed.
- `frontend/packages/api: ./node_modules/.bin/tsc --noEmit` → 32 pre-existing lib-target errors (process/padStart/includes), none in changed files; the web app tsc (which type-checks the transpiled package) is clean.
- Run 2: `docs/mobile/auth-backend-contracts.md` — intro note; §1 /login additive `device`/`DPoP`/`sessionId`/`session`/`device` echo; §7 /refresh rewritten (request extras, server order, response `sessionId`/`session`, full 401 code table, TOKEN_REUSE claim corrected); NEW §8 (headers, error envelope, existing-route additive changes, `/api/auth` router table, step-up tokens, session context, client storage keys, client behaviour).
- Run 2: `docs/07-frontend-mobile-app.md` — SUPERSEDED callout at §5 (install-sentinel wipe → keep-the-credential-gate-it, 120 s proactive refresh, 401 codes) pointing to the design/contract; RN diagrams kept as history.
- Run 2: `docs/interview/auth-session-security-deep-dive.md` — §7 "Mobile reinstall guard" superseded (new policy + updated interview answer, historical text kept); Finding 1 (web middleware discards refresh sessions) marked FIXED with the /session/refresh hand-off summary.
- Run 3: `docs/compliance/play-data-safety.md` — Device-or-other-IDs row now lists device id / install id / device public key / session id / IP+UA with purposes App functionality + Fraud prevention, security, and compliance; purpose/ephemeral/required guidance note; "Not new data types" (biometrics, Block Store); consistency table rows.

- Run 4 (2026-08-18, after third cutoff): `git status` re-confirmed every file above is on disk. Re-read all new/changed web + api files against CONTRACT.md — consistent. `docs/compliance/play-data-safety.md` turned out to be COMPLETE on disk (Device-or-other-IDs row + purpose note + "Not new data types" + consistency rows), so step 4b is done. Re-checked the Android fingerprint question once more (android-beta.yml: keystore only as `ANDROID_KEYSTORE_BASE64` secret; no .jks in repo) — generator+doc approach stands. Remaining in this run: align `securityActivity.ts` event labels with the backend's actual event types (read-only look at backend/services/authDeviceService.js + authNotifyService.js), then the final typecheck / lint / test pass.
- Run 4: `frontend/apps/web/src/lib/securityActivity.ts` — EVENT_LABELS now keyed on the backend's real `AuthSecurityEvent.type` values (added `step_up_key_enrolled`, `password_changed_email_sent`, `lockdown_email_sent`; clarified `lockdown` / `password_changed` / `password_reset` copy; `inactivity_expired` marked as an alert). Backend's `SECURITY_DEEP_LINK` = `https://pantopus.com/app/settings/security` — matches the page route. `tests/securityActivity.test.ts` extended accordingly.

## Final verification (Run 4, 2026-08-18) — exactly what ran
- `frontend/apps/web: ./node_modules/.bin/tsc --noEmit` → exit 0.
- `frontend/apps/web: ./node_modules/.bin/eslint ./src/` (== CI `pnpm --filter=@pantopus/web lint`) → 0 errors, 1142 pre-existing warnings; the 7 changed/new web files produce only the pre-existing `@ts-nocheck` warning in profile/settings/page.tsx.
- `frontend/apps/web: ./node_modules/.bin/jest --forceExit tests/securitySettingsPage.test.tsx tests/sessionRefresh.test.tsx tests/securityActivity.test.ts tests/associationFiles.test.ts` → 4 suites, 40 tests passed.
- `frontend/apps/web: ./node_modules/.bin/jest --forceExit tests/identityFirewallWeb.test.tsx --runInBand` (CI's web test) → 19 passed.
- `frontend/apps/web: ./node_modules/.bin/jest --forceExit` (whole web suite) → 21 suites, 199 tests passed.
- `frontend/packages/api: ./node_modules/.bin/tsc --noEmit` → 32 errors, ALL pre-existing in `../utils/src/index.ts` / lib-target (`process`, `padStart`), none in `endpoints/authDevices.ts`, `endpoints/auth.ts`, `index.ts` (the web app's tsc, which type-checks the package, is clean).
- `APPLE_TEAM_ID=6UYZBA546R node tools/gen-association-files.mjs --check` → "up to date" (exit 0); both .well-known files parse as JSON.
- Not run: `next build` (not requested; tsc+eslint+jest cover the change), Playwright e2e (needs a running stack).
