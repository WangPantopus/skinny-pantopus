# Release Readiness & Hardening Sweep — RR-C

**Date:** 2026-06-05 · **Branch:** `claude/tender-brahmagupta-qSVBG` · **Base:** `896723d`
**Scope:** iOS (`frontend/apps/ios`) + Android (`frontend/apps/android`), backend contract checks.
**Method:** Static end-to-end trace of each surface through both clients and the backend, plus a live
DNS/hosting probe of the app-link domains. Small corrective edits applied where safe; larger gaps
reported with a remediation plan.

> **Environment caveat (read this first).** This sweep ran in a Linux container with **no Swift
> toolchain and no Android SDK** (`ANDROID_HOME` unset; SwiftLint/SwiftFormat/`xcodebuild` absent).
> Therefore **neither app could be compiled or linted locally** — `build + lint` is delegated to CI
> (`.github/workflows/ios-ci.yml`, `android-ci.yml`). All code edits below were kept minimal,
> idiomatic, and matched to existing patterns/imports to be CI-safe; each is justified inline. The
> CI build+lint result is the authoritative gate.

---

## Executive summary

| # | Check | iOS | Android | Backend | Release impact |
|---|-------|-----|---------|---------|----------------|
| 1 | **Push notifications** e2e | ✅ PASS | ✅ PASS | ✅ PASS | Config gates only (APNs prod env, FCM/APNs secrets) |
| 2 | **Account deletion** e2e | ❌ **FAIL** | ❌ **FAIL** | ✅ PASS | 🚫 **BLOCKER** (Apple Guideline 5.1.1(v)) |
| 3 | **Deep links** e2e | ❌ **FAIL** → ⚠️ partial after fix | ⚠️ PASS (code) / **FAIL (hosting)** | n/a | 🚫 **BLOCKER** (`pantopus.app` not resolvable) |
| 4 | **State consistency (2F)** | ✅ PASS | ⚠️ **PARTIAL** | n/a | Non-blocking parity debt (offline banner) |
| 5 | **Parity + a11y (2G)** | ⚠️ PARTIAL | ⚠️ PARTIAL | n/a | One real-work item (iOS Dynamic Type); rest small |

**Two hard release blockers:** (2) account deletion is a non-functional placeholder on both clients,
and (3) the universal/app-link host `pantopus.app` does not resolve in DNS so deep links silently
fail end-to-end. Both must be resolved before App Store / Play submission.

---

## Check 1 — PUSH NOTIFICATIONS — ✅ PASS (both platforms)

The full chain is real and wired symmetrically: client registers a token → backend stores it with
the right provider → real APNs/FCM senders dispatch a payload carrying a `link` → tap routes through
the deep-link router.

**Token registration — PASS.**
- iOS `AppDelegate.didRegisterForRemoteNotificationsWithDeviceToken` → `APIClient.registerPushToken(_, platform:"ios")` → `POST /api/notifications/register` (`AppDelegate.swift:54-67`, `APIClient.swift:145-160`).
- Android `PantopusMessagingService.onNewToken` → `NotificationsRepository.registerPushToken(token, platform:"android")` → same endpoint, plus `PushTokenSyncer` re-registration on app open (`PantopusMessagingService.kt:41-52`, `PushTokenSyncer.kt:31-80`).
- Backend `POST /api/notifications/register` accepts `{ token, platform?, provider? }` and derives provider from platform when omitted (`backend/routes/notifications.js:275-313`, `tokenRouting.js:42-65`). Contract matches: both clients send `{token, platform}`, backend infers `ios→apns`/`android→fcm`.

**Foreground + background delivery + tap deep-link — PASS.**
- Backend sends **data-only** FCM (so Android `onMessageReceived` fires in every app state) and APNs payloads that always include `aps.alert` (so iOS renders natively even when killed) (`fcmClient.js:92-103`, `apnsClient.js:84-97`).
- Android `NotificationDispatcher` builds a `pantopus://`-normalized `PendingIntent` → `MainActivity.onNewIntent` → `DeepLinkRouter.handle(uri)` (`NotificationDispatcher.kt:194-221`, `MainActivity.kt:84-95`).
- iOS `willPresent` returns banner/list/sound/badge; `didReceive` reads `userInfo["link"]` → `DeepLinkRouter.shared.handle(path:)` (`AppDelegate.swift:80-106`).

**Notes (not code defects — release/ops gates):**
- iOS `aps-environment` is `development` (`Pantopus.entitlements:6`). Must flip to `production` for
  TestFlight/App Store pushes, paired with `APNS_PRODUCTION=true` on the backend (`apnsClient.js:50-53`).
- Senders no-op unless `FCM_*` / `APNS_*` secrets are configured (`fcmClient.js:72-75`, `apnsClient.js:57-60`) — verify production secrets.
- Android status-bar icon still uses `R.mipmap.ic_launcher`; swap for a monochrome `ic_notification`
  before launch (already TODO'd at `NotificationDispatcher.kt:150-157`). Cosmetic.

---

## Check 2 — ACCOUNT DELETION — ❌ FAIL (both platforms) · 🚫 RELEASE BLOCKER

The backend is real and irreversible, but **both mobile clients render a "Delete account" row that
does nothing when tapped.** A user cannot delete their account from either app. This violates Apple
App Store Guideline 5.1.1(v) (apps with account creation must offer in-app account deletion) and is a
hard submission blocker.

**Backend — PASS.** `DELETE /api/users/account` (`backend/routes/users.js:3945`, mounted `app.js:306`):
auth-gated, self-only; pre-checks block deletion with in-progress gigs / escrow (409); tears down FK
rows in correct order; hard-deletes the `User` row (`:4103-4106`) and the Supabase Auth user
(`:4114-4116`). **Caveat:** deletion is **immediate and synchronous** — there is **no grace period
and no scheduled purge job** (none in `backend/jobs/`), yet both apps' UI copy says *"Permanent.
30-day grace period."* (mismatch — see small fixes).

**iOS — FAIL.** Privacy screen renders the row (`PrivacyViewModel.swift:204-217`) but `tapRow(_:)` is
an explicit no-op (`PrivacyViewModel.swift:72-75`). No confirmation alert, no API call, no sign-out.
The endpoint constant `AuthMethodsEndpoints.deleteAccount` exists (`SettingsEndpoints.swift:70-72`)
but has **zero call sites** — dead code.

**Android — FAIL.** Privacy VM renders the row (`SettingsViewModels.kt:712-725`) but exposes no
tap handler (`onRadio`/`onToggle`/`onSetFuzz` only). `UsersApi.kt` has **no** delete method;
`AccountRepository.kt:19-36` has no delete. No dialog, no call, no sign-out.

**Remediation (needs real work — see "Real-work items").**

---

## Check 3 — DEEP LINKS — ❌ FAIL · 🚫 RELEASE BLOCKER (hosting) + iOS entry-point gap (fixed)

Three independent problems. The hosting one is fatal and unfixable in code.

### 3a. CRITICAL — app-link host `pantopus.app` is not resolvable — 🚫 BLOCKER
Live probe from this environment (egress confirmed working: `github.com → 200`):

| Host | DNS | `/.well-known/apple-app-site-association` |
|------|-----|-------------------------------------------|
| `pantopus.app` | **no DNS resolution** | unreachable |
| `www.pantopus.app` | **no DNS resolution** | unreachable |
| `pantopus.com` | 216.198.79.1 (Vercel) | HTTP 403 |
| `www.pantopus.com` | resolves | HTTP 403 |

The apps claim `pantopus.app` / `www.pantopus.app` everywhere — iOS entitlements
(`Pantopus.entitlements:9-10`), Android manifest (`AndroidManifest.xml:56-57`), and the AASA `appID`.
But **that domain does not resolve**, while the actual web deployment is on `pantopus.com` (matching
`NEXT_PUBLIC_APP_URL=https://www.pantopus.com`, `web/next.config.js:39`). iOS Universal Links and
Android App Links **fetch the `.well-known` association file from the claimed host at install/verify
time**; if the host doesn't resolve, verification silently fails and links fall back to the browser.
So **no deep link works end-to-end today, on either platform, regardless of the client code.**

> Caveat: this environment may use a curated DNS allowlist. The signal (`.com` resolves, `.app` does
> not, `github.com`/`example.com` resolve) strongly indicates `pantopus.app` is unprovisioned, but
> **confirm from an unrestricted network**. The `pantopus.com` 403 (on root too) looks like Vercel
> deployment-protection/geo gating and also needs an unrestricted re-check.

**Decision required (ops/product):** either (a) register + deploy `pantopus.app` / `www.pantopus.app`
and serve `/.well-known/{apple-app-site-association,assetlinks.json}` there (the web app already sets
the correct `Content-Type` headers — `next.config.js:44-55`), **or** (b) change the iOS entitlements
and Android manifest hosts to `pantopus.com` / `www.pantopus.com` to match the live deployment. Not
changed here — it is a domain/infra decision, not a code cleanup. Also re-verify the `assetlinks.json`
`sha256_cert_fingerprints` matches the Play App Signing cert.

### 3b. iOS had no universal-link entry point — FIXED (small)
`DeepLinkRouter` and the consumption machinery (`RootTabView` observes `router.pending` via
`.onChange` + `.task`) are fully built and unit-tested, and the **notification-tap path already
exercises cold-start routing successfully**. But nothing called `DeepLinkRouter.shared.handle(url:)`
for an incoming web/scheme URL — a repo-wide search for `onOpenURL` / `onContinueUserActivity` /
`NSUserActivityTypeBrowsingWeb` returned zero matches. So even with a working AASA, a tapped
`https://pantopus.app/post/123` was dropped.

**Fix applied:** wired `.onOpenURL` (custom scheme) and `.onContinueUserActivity(NSUserActivityTypeBrowsingWeb)`
(universal links) on the root scene → `DeepLinkRouter.shared.handle(url:)` (`PantopusApp.swift:38-45`).
This reuses the exact router + `pending`-observation path the notification tap uses, so it routes on
cold and warm start. (Compile-safety: `RootTabView`'s existing `.onChange` closure already calls the
`@MainActor` `router.consume()` directly — same isolation context, so the new closures are valid.)

### 3c. AASA path coverage was incomplete — FIXED (small)
The hosted AASA listed only `/gig*,/gigs*,/post*,/posts*,/listing*,/listings*,/b/*,/u/*,/marketplace/*,/invite/*`
— missing home, mailbox, verify-email, reset-password, and the user/business persona paths, and it
even claimed `/u/*`,`/b/*`,`/marketplace/*` which the iOS router does **not** resolve.

**Fix applied:** expanded `web/public/.well-known/apple-app-site-association` to the full set of
paths the iOS `DeepLinkRouter.resolve(url:)` actually handles (post, gig, listing, marketplace, home,
user/users, business/businesses, mailbox, chat/messages/conversation, support-trains, connections,
notifications, wallet, invite, auth, verify-email, reset-password, settings/payments). Validated as
JSON. Android already captures all paths via a host-wide intent-filter, so this only affected iOS.

> Unresolved data point for product: the web public persona URL is `/@handle`
> (`web/.../persona/page.tsx:520`), which neither the AASA nor the iOS router (`/user/:id`,
> `/business/:username`) handles. If `/@handle` is the canonical share URL, the router + AASA both
> need a `/@*` rule and a resolver case. Left for a product decision (not guessed here).

### Coverage matrix (post-fix)

| Surface | AASA path | iOS router | Android manifest | Android router |
|---|---|---|---|---|
| post | ✅ | ✅ | ✅ host-wide | ✅ |
| listing | ✅ | ✅ | ✅ | ✅ |
| gig | ✅ | ✅ | ✅ | ✅ |
| home | ✅ (added) | ✅ | ✅ | ✅ |
| persona (user/business) | ✅ (added `/user`,`/business`) | ✅ | ✅ | ✅ |
| persona (`/@handle`) | ❌ | ❌ | ✅ host-wide | ⚠️ |
| mailbox item | ✅ (added) | ✅ | ✅ | ✅ |
| verify-email | ✅ (added) | ✅ | ✅ | ✅ (AuthNavHost) |
| reset-password | ✅ (added) | ✅ | ✅ | ✅ (AuthNavHost) |
| invite/token | ✅ | ✅ | ✅ | ✅ |

All ✅ rows are still gated on **3a** (the host must resolve) to work in production.

---

## Check 4 — STATE CONSISTENCY (2F) — iOS ✅ PASS / Android ⚠️ PARTIAL

**Shared components — PASS (both).** `ErrorState`, `EmptyState`, `Shimmer`, and `OfflineBanner` exist
on both platforms with near-1:1 APIs (iOS `Core/Design/Components/*`; Android `ui/components/*`).

**Screens use real loading/empty/error states — PASS (both).** No wired list/detail screen uses a
raw screen-level spinner or blank screen. Shared shells (`ListOfRowsView`/`ListOfRowsScreen`) enforce
shimmer/empty/error; bespoke screens (Feed, Marketplace, MailboxItemDetail, PublicProfile, CreatorInbox,
Notifications) all use real skeletons + `EmptyState`. The residual `ProgressView`/`CircularProgressIndicator`
hits are legitimate inline submit-button spinners and gated load-more sentinels.

**Offline banner + mutation gating parity — ⚠️ FAIL (the real 2F gap).**
- Both platforms have a real `NetworkMonitor` (iOS `NWPathMonitor`; Android `ConnectivityManager.NetworkCallback`), at parity.
- **Offline banner coverage is wildly asymmetric:** iOS wraps **56 screens** in `.offlineBanner(isOffline:)`; Android wires it correctly on **one** (`BusinessTeamScreen.kt:104`). Two other Android screens rendered the banner **unconditionally** (permanently showing "You're offline" even when online) — a visible bug. **Fixed** (see small fixes).
- **Mutation gating:** iOS gates submit on connectivity in 15 view-models; Android in 8. Seven iOS-gated flows have no Android counterpart (AddHouseholdTask, AddEvent, AddBill, StartPoll, EditAccessCode, UploadDocument, DisambiguateMail).

The Android `CLAUDE.md` documents the offline-banner convention, but it is, in practice, almost
entirely unimplemented on Android. Rolling it out across ~55 screens is **real work** (mechanical but
broad; reference pattern exists in `BusinessTeamScreen.kt`).

---

## Check 5 — PARITY + A11Y (2G) — ⚠️ PARTIAL (both)

Strong foundation (decorative-by-default `Icon`/`PantopusIconImage`, ~1,478 matching test identifiers,
existing audit infra). Gaps are a small, mostly-symmetric tail plus one systemic iOS item.

| Sub-area | iOS | Android |
|---|---|---|
| testTag / accessibilityIdentifier parity | ✅ (1,922) | ✅ (1,874); ~15 wrapper screens miss root tag |
| VoiceOver / TalkBack labels | ⚠️ a few icon-only buttons unlabeled | ⚠️ matching gaps |
| Dynamic Type / font scale | ❌ **fonts don't scale** | ✅ `.sp` scales |
| Tap targets ≥ 44/48 | ⚠️ a few <44pt sites | ⚠️ matching <48dp sites |
| Token contrast | ✅ (documented `appTextMuted` use) | ✅ |

**iOS Dynamic Type — needs real work.** Typography uses fixed `Font.system(size:)` with **no
`relativeTo:`** (`Core/Design/Typography.swift:78-90`) across ~2,181 call sites; zero `@ScaledMetric`/
`UIFontMetrics`. iOS text does **not** scale with the user's accessibility text-size setting. **This
also corrects an inaccurate claim** in `docs/a11y-audit-current.md:204-211` (and the iOS
`a11y_audit.md`) that type "scales with Dynamic Type natively" — it does not. Architectural; reported,
not patched.

**Labels — small fixes applied** (verified genuine; the agent-flagged `EditFab` was a **false
positive** — it is already labeled at `OwnerHeader.swift:168,207`, so left untouched):
- iOS Ceremonial back button now `.accessibilityLabel("Back")` (`CeremonialMailOpenView.swift`).
- iOS + Android RSVP plus-one steppers now labeled "Add/Remove a plus-one" (`RsvpCluster.swift`, `RsvpCluster.kt`).

**Remaining small items (reported, not patched to limit unverifiable churn):**
- ~15 Android wrapper screens missing a root `testTag` (`blockedUsers`, `verificationCenter`,
  `homeDashboard`, `privacySettings`, `notificationSettings`, …) — UI-test targeting only, low risk.
- iOS `composeIcon` is an **unlabeled no-op `Button(action: {})`** (`CeremonialMailOpenView.swift:1113`)
  — the right fix is to wire or remove the action, not just label it.
- Sub-minimum tap targets on RSVP steppers (24pt) and the Ceremonial back button (36pt) — resizing
  shifts layout; deferred to a visual-review pass.

**Audit docs are ~1 week stale** (last touched 2026-05-29) and were produced by static reads;
real VoiceOver/TalkBack/Scanner passes were deferred to simulator-equipped CI.

---

## Fixes applied in this sweep (small, CI-safe)

| # | File | Change | Check |
|---|------|--------|-------|
| 1 | `web/public/.well-known/apple-app-site-association` | Expanded paths to the full iOS-router vocabulary (home, mailbox, verify-email, reset-password, user/business, …) | 3c |
| 2 | `ios/.../App/PantopusApp.swift` | Wired `.onOpenURL` + `.onContinueUserActivity` → `DeepLinkRouter` (the missing universal-link entry point) | 3b |
| 3 | `android/.../businesses/BusinessWaitlistScreen.kt` | Removed always-on `OfflineBanner` (+ unused import) | 4 |
| 4 | `android/.../homes/documents/DocumentDetailScreen.kt` | Removed always-on `OfflineBanner` (+ unused import) | 4 |
| 5 | `ios/.../CeremonialMailOpen/CeremonialMailOpenView.swift` | Added `.accessibilityLabel("Back")` to icon-only back button | 5 |
| 6 | `ios/.../Mailbox/.../RsvpCluster.swift` | Labeled +/- steppers for VoiceOver | 5 |
| 7 | `android/.../mailbox/.../RsvpCluster.kt` | Labeled +/- steppers for TalkBack (semantics) | 5 |

Each edit was checked for unused-import / import-order fallout and snapshot-test impact (no Paparazzi
baselines exist for the two touched Android screens; the a11y additions don't change pixels).

---

## Real-work items (not small fixes) — prioritized

**🚫 Release blockers**
1. **Account deletion (both clients).** iOS: implement `PrivacyViewModel.tapRow("deleteAccount")` → a
   destructive confirmation alert → call the existing `AuthMethodsEndpoints.deleteAccount` → clear
   tokens via `AuthManager.signOut()` → land on login. Android: add `@DELETE("api/users/account")` to
   `UsersApi`, a repo method, a tap handler + confirmation dialog in `PrivacySettingsViewModel`, then
   sign-out + nav. Add a confirmation dialog on both (Apple requires explicit confirmation).
2. **Deep-link host (`pantopus.app`).** Provision+host `.well-known` on `pantopus.app`/`www.pantopus.app`,
   **or** repoint iOS entitlements + Android manifest to `pantopus.com`. Then live-verify AASA fetch
   (200 + `application/json`) and Android `autoVerify`. Verify the assetlinks SHA-256 matches Play
   App Signing.

**⚠️ Should-fix (not blocking, but parity/quality debt)**
3. **iOS Dynamic Type.** Introduce `relativeTo:` / `@ScaledMetric` (or `UIFontMetrics`) into the type
   system so text honors accessibility sizes; audit fixed-height text containers for clipping.
4. **Android offline-banner rollout.** Expose `networkMonitor.isOnline` from each VM and wrap ~55
   screens in `OfflineBannerHost`, mirroring `BusinessTeamScreen.kt`.
5. **Android mutation gating** on the 7 flows iOS gates but Android doesn't.
6. **Account-deletion copy vs. behavior.** Both apps say "30-day grace period," backend hard-deletes
   immediately. Either add a backend grace-period/scheduled purge or correct the parity copy
   (`PrivacyViewModel.swift:211`, `SettingsViewModels.kt:720`).
7. **Persona `/@handle` deep link** — add resolver + AASA rule, or settle the canonical share URL.
8. **a11y tail** — ~15 Android wrapper root `testTag`s; iOS `composeIcon` no-op; sub-44pt tap targets.

---

## Build + lint status

- **Cannot be run in this environment** (no Swift toolchain; no Android SDK — see top caveat). Edits
  were constrained to be CI-safe: import order preserved (Swift alphabetical; Kotlin ktlint order for
  the two added `androidx.compose.ui.semantics.*` imports), no unused imports introduced (removed
  imports verified to have no other references; retained imports verified still used), no design-token
  / hex-grep violations, no Paparazzi/snapshot baseline changes.
- **Authoritative gate:** `ios-ci.yml` and `android-ci.yml` on the PR. The web AASA JSON was validated
  with a JSON parser locally.

## Verdict

**Not release-ready.** Two blockers stand between the current state and submission: **account deletion
must be implemented on both clients**, and the **`pantopus.app` app-link host must be live** (and the
domain mismatch reconciled). Push, shared state components, and the deep-link *client code* (post-fix)
are in good shape. The remaining items are quality/parity debt, with iOS Dynamic Type the most
substantive.
