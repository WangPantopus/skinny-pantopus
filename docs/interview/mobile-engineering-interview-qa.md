# Mobile Engineering Interview Q&A

This document captures a senior mobile engineering answer set for the Pantopus React Native / Expo app. It is written as if the engineer answering built and owns this codebase, with emphasis on production source of truth, threat models, release safety, offline behavior, and platform parity.

The main mobile app lives under:

```text
frontend/apps/mobile
```

The most important files referenced throughout this document are:

```text
frontend/apps/mobile/app.config.js
frontend/apps/mobile/app.json
frontend/apps/mobile/eas.json
frontend/apps/mobile/scripts/release-preflight.mjs
frontend/apps/mobile/src/lib/authSession.ts
frontend/apps/mobile/src/config/api.ts
frontend/apps/mobile/src/contexts/AuthContext.tsx
frontend/apps/mobile/src/lib/pushNotifications.ts
frontend/apps/mobile/src/contexts/PushNotificationContext.tsx
frontend/apps/mobile/src/utils/notificationRouting.ts
frontend/apps/mobile/src/utils/pushNotificationNavigation.ts
frontend/packages/api/src/client.ts
backend/services/notificationTemplateRegistry.js
backend/services/notificationService.js
backend/services/pushService.js
backend/tests/unit/notificationContextFirewall.test.js
```

## Executive Summary

The production mobile source of truth is the dynamic Expo config resolved from `frontend/apps/mobile/app.config.js` with `APP_ENV=production`, plus `frontend/apps/mobile/eas.json` for EAS build and submit behavior. Root-level Expo/EAS files exist, but they are legacy scaffold metadata and should not be treated as production authority.

The production iOS bundle identifier and Android package are both:

```text
com.pantopus.app
```

Auth tokens are stored in Expo SecureStore as a single versioned session object, with an in-memory cache only for synchronous request interception. The app mitigates iOS Keychain persistence across reinstall with an AsyncStorage install sentinel plus a SecureStore guard. The threat model is explicit: SecureStore helps with normal device-at-rest protection, but it does not defend against rooted devices, malware, live memory compromise, or an unlocked stolen device.

Auth refresh happens on boot, on request `401`, and when the app returns to foreground. Refresh failures are classified as invalid or transient. Invalid refresh clears the session; transient refresh failure preserves the local session so an offline user is not forcibly logged out.

Push notifications use backend context-aware template allowlists to prevent cross-context leakage. Push payloads should contain display text plus routing metadata, not full domain records. Opening a push still requires authenticated server fetches and authorization.

Offline behavior is intentionally degraded rather than offline-first. Chat has in-memory optimistic retry but no durable outbox. Gigs use in-memory React Query cache. Maps preserve stale in-memory markers and show an offline indicator. Homes fail closed for permissions and require the server for privileged actions.

Mobile intentionally does not duplicate every web surface. It prioritizes native loops around home, pulse/gigs, marketplace, chat, push, auth, maps, and quick action workflows. Some web-first surfaces, browser-specific settings, public marketing pages, and desktop management routes are not first-class mobile experiences.

Deep links are tested mostly through route-resolution unit tests and push-tap navigation tests. A production-grade next step would be device-level automation using `xcrun simctl openurl`, `adb shell am start`, and automated validation of Apple AASA / Android asset links.

Backend compatibility is handled through additive API changes, tolerant parsing, feature flags, shared client packages, and release preflight. A server-enforced minimum app version flow would be the right next hardening step for truly breaking backend migrations.

Platform parity comes from shared React Native code, centralized platform-specific config, Jest coverage for shared logic, release preflight, and physical-device smoke testing for push, biometrics, app links, maps, auth, and permissions.

## 1. Why Are There Multiple EAS/App Config Files With Different Project Or Package Identifiers?

### Short Answer

There are multiple config files because the repository has both legacy root Expo/EAS metadata and the actual mobile app package config. The production mobile app is under `frontend/apps/mobile`, and that package owns the real Expo and EAS configuration.

The root config should be considered stale unless a future cleanup intentionally promotes it or deletes it. Production release work should happen from the mobile app package, not from the repository root.

### What Exists In The Repo

| Path | Role | Current Interpretation |
| --- | --- | --- |
| `app.json` at repo root | Legacy Expo metadata | Stale scaffold metadata; not production mobile authority |
| `eas.json` at repo root | Legacy/minimal EAS profiles | Stale or generic; not the production mobile build profile |
| `frontend/apps/mobile/app.json` | Static Expo base config | Real mobile base config |
| `frontend/apps/mobile/app.config.js` | Dynamic Expo config | Production source of truth for resolved Expo config |
| `frontend/apps/mobile/eas.json` | EAS build/submit profiles | Production source of truth for build and submit behavior |

The root `app.json` contains an older Android package:

```text
com.wyp_pantopus.pantopusplatform
```

The production mobile app uses:

```text
com.pantopus.app
```

for both iOS and Android.

The root config also has a different EAS project ID from the mobile app config. That difference is a strong signal that the root file is legacy project metadata, not the active production mobile app.

### Why This Happens In Real Codebases

This is common in monorepos. A team may start with an Expo app at the root, later move to a monorepo layout, then create a dedicated package under `frontend/apps/mobile`. If the root files are not removed, both sets of files remain.

The dangerous part is not that multiple files exist. The dangerous part is ambiguity. If an engineer runs EAS from the wrong directory, they can build with the wrong package ID, project ID, or submit profile.

### How This Repo Prevents Production Confusion

The mobile package has a release preflight script:

```text
frontend/apps/mobile/scripts/release-preflight.mjs
```

That script introspects the Expo config under production settings and validates the critical production invariants:

- `APP_ENV` resolves to `production`.
- iOS bundle identifier is `com.pantopus.app`.
- Android package is `com.pantopus.app`.
- iOS Apple Sign-In is enabled.
- Production ATS does not allow arbitrary loads.
- EAS project ID is present.
- EAS profiles exist.
- Build scripts exist.
- TypeScript and Expo health checks pass.

### What I Would Say In An Interview

I would explain that this is a monorepo artifact. The root Expo/EAS files are legacy and should not be used for mobile production. The authoritative mobile build config lives in `frontend/apps/mobile`, and production builds should always be run from there.

I would also call out that I would remove or clearly mark the stale root files to reduce operator error. Leaving stale mobile identifiers around is not a runtime bug, but it is a release-process risk.

## 2. Which Mobile Config Is The Production Source Of Truth?

### Short Answer

The production source of truth is the resolved Expo config from:

```text
frontend/apps/mobile/app.config.js
```

with:

```text
APP_ENV=production
```

and the production EAS build/submit profile from:

```text
frontend/apps/mobile/eas.json
```

Expo gives the dynamic `app.config.js` authority over static `app.json`. In this codebase, `app.config.js` imports the static `app.json` and then applies production-specific overrides.

### Production Identifiers

The production app identifiers are:

```text
iOS bundle identifier: com.pantopus.app
Android package:        com.pantopus.app
```

The production EAS project ID comes from `EAS_PROJECT_ID` if it is a valid UUID, otherwise from the mobile app config fallback.

### What The Dynamic Config Controls

`frontend/apps/mobile/app.config.js` controls or enforces:

- `APP_ENV`
- EAS project ID resolution
- iOS bundle identifier
- iOS build number
- Android package
- Android version code
- Google Maps key injection for both platforms
- production ATS behavior
- development localhost exceptions
- production runtime extra values

In production, arbitrary network loads are disabled. That matters because mobile production builds should not silently allow insecure endpoints.

### EAS Profile Behavior

`frontend/apps/mobile/eas.json` defines:

- `development`: dev client, internal distribution, development env
- `preview`: internal distribution, preview env
- `production`: production env, auto-incrementing builds, Android app bundle, iOS real-device build

The production profile sets:

```text
APP_ENV=production
```

and uses EAS remote app versioning.

### Interview Framing

My answer would be: the source of truth is not one static JSON file. It is the resolved Expo config produced by the mobile app package's `app.config.js`, plus the EAS profile that invokes it. That distinction matters because dynamic config can enforce environment-dependent behavior that static `app.json` cannot safely express.

## 3. How Is SecureStore Token Storage Threat-Modeled?

### Short Answer

SecureStore is used for mobile session material because it is the right baseline for device-local secret storage in Expo. The app stores access and refresh tokens as one versioned session object in SecureStore, keeps a process-memory cache for request interception, and handles reinstall cleanup explicitly.

The threat model is intentionally honest:

- SecureStore helps against casual local filesystem inspection and normal app sandbox compromise.
- It does not protect against a rooted or jailbroken device.
- It does not protect against malware running as the user.
- It does not protect against live memory scraping while the app is running.
- It does not protect against an unlocked stolen device by itself.

### Session Storage Design

The session object is managed in:

```text
frontend/apps/mobile/src/lib/authSession.ts
```

The app stores a single JSON blob under:

```text
pantopus_auth_session
```

The session includes:

- schema version
- access token
- refresh token
- expiration time
- user ID
- update timestamp

Older split keys are migrated:

```text
pantopus_auth_token
pantopus_refresh_token
```

After migration, the old keys are deleted.

This avoids a class of bugs where the access token and refresh token are updated independently and the app ends up with an inconsistent session.

### In-Memory Cache

The module keeps a cached session in memory. That is not the durable source of truth. It exists because Axios-style request interceptors need synchronous access to the current access token.

The durable source remains SecureStore. The memory cache is refreshed from SecureStore during session load and updated when tokens rotate.

### Reinstall Sentinel

iOS Keychain items can survive uninstall/reinstall. That can accidentally resurrect a prior user's session on a fresh install. This repo explicitly mitigates that.

The app uses:

```text
INSTALL_SENTINEL_KEY in AsyncStorage
INSTALL_GUARD_KEY in SecureStore
```

AsyncStorage is removed on uninstall. SecureStore can survive. On startup:

- If the AsyncStorage sentinel is missing but the SecureStore guard exists, the app treats that as reinstall.
- It deletes the auth session and legacy token keys.
- It then writes the sentinel and guard for the new install.

The write order matters. The app writes the volatile AsyncStorage sentinel first, then the SecureStore guard, to reduce false-positive wipes if setup partially fails.

### Refresh Token Handling

The app uses short-lived access tokens and refresh tokens. Refresh token rotation is expected server-side. The client updates both access and refresh token material together after refresh.

The shared API client supports refresh responses using either camelCase or snake_case fields, for compatibility:

```text
accessToken / access_token
refreshToken / refresh_token
expiresAt / expires_at
```

That tolerant parsing helps with backend compatibility during migrations.

### Logout And Revocation

When the session is invalidated, the client clears local state first, then makes best-effort server revocation calls with the just-cleared tokens.

That ordering is important. The app should not keep the user locally logged in just because the network failed during logout or revocation.

### Biometrics Are A Local Gate, Not Token Cryptography

The app also has biometric/app-lock behavior, but biometrics are not the cryptographic root protecting tokens.

App lock uses local authentication to gate app access. Sensitive actions can require stronger biometric confirmation. But the SecureStore session is not modeled as being cryptographically unwrapped by biometrics for every request.

The accurate security statement is:

Pantopus uses device-protected local token storage, token rotation, local reinstall cleanup, best-effort revocation, short access token lifetime, and optional biometric UX gates. It does not claim hardware-backed proof of possession for every API request.

## 4. How Do Mobile Auth Refresh And App Foreground Behavior Work?

### Short Answer

Auth refresh happens through three paths:

1. Boot-time session restore.
2. API `401` response interception.
3. App foreground resume.

The app refreshes proactively within a five-minute expiry window and reactively after unauthorized responses.

### Boot-Time Restore

On app boot, `AuthContext`:

1. Initializes the API client.
2. Loads the persisted SecureStore session.
3. Populates the synchronous token cache.
4. Checks whether the session expires soon.
5. Attempts refresh if needed.
6. Fetches the user profile.

If the session is invalid, it is cleared.

If refresh fails for a transient reason, such as offline network or server trouble, the app keeps the user in an authenticated local state and retries profile loading later.

That is important mobile behavior. A user should not be forced out of the app just because they opened it in an elevator, airplane, subway, or bad network zone.

### Request-Time Refresh

The shared API client in:

```text
frontend/packages/api/src/client.ts
```

handles `401` responses.

For mobile, it sends the refresh token to:

```text
/api/users/refresh
```

The refresh code has a mutex so multiple simultaneous `401`s do not trigger multiple refresh calls. Instead, concurrent requests share the same refresh promise.

Refresh outcomes are classified:

- success: update session and retry the original request
- invalid: clear session and emit unauthorized behavior
- transient: preserve session and surface failure without destroying local auth

The client does not try to refresh auth endpoints themselves. That prevents loops where a failed login or refresh request recursively triggers refresh logic.

### Foreground Refresh

When the app moves from background or inactive to active, `AuthContext` checks the current session again.

If the token is expiring soon, it refreshes with a foreground trigger. If refresh succeeds and the user profile is missing, it refetches the user. If refresh is invalid, it clears auth.

Other mobile foreground behavior also runs:

- chat sockets reconnect if disconnected
- chat messages refresh and read receipts are retried
- push notification permissions are rechecked
- push token registration can run if permission was granted outside the app
- badge count is cleared
- map/offline health probes run
- buffered signal/analytics state flushes on background or inactive transitions

### Interview Framing

The key point is that mobile auth is not a single "load token once" flow. It is a lifecycle-aware system. It distinguishes invalid credentials from transient network failure, refreshes proactively, deduplicates refresh attempts, and uses foreground transitions as a repair point.

## 5. How Do Push Notifications Avoid Leaking Sensitive Context?

### Short Answer

Push notification privacy is handled through backend template context boundaries, preference checks, token ownership rules, and route-only payload design.

The goal is not to put full domain context in the push payload. The push should wake the user and route them back into the authenticated app, where the server re-authorizes the actual data fetch.

### Notification Context Firewall

The backend template registry lives at:

```text
backend/services/notificationTemplateRegistry.js
```

It defines notification contexts such as:

```text
personal
audience
platform
```

Each context has an allowlist of fields. For example:

- personal notifications may refer to local profile, home, gig, listing, mailbox, task, and business concepts
- audience notifications may refer to persona/fan concepts
- platform notifications are intentionally generic and limited

The registry rejects cross-context placeholders at module registration and render time.

Tests in:

```text
backend/tests/unit/notificationContextFirewall.test.js
```

verify that:

- personal templates cannot pull audience-only data
- audience templates cannot pull personal home/gig/mailbox context
- real templates validate
- notification grouping preserves context
- persisted notifications carry context

### Preference Gates

Notification delivery goes through user preferences. The backend checks whether push is globally enabled and whether the specific notification type is enabled before sending.

This means the privacy model is not just "send everything but be careful." It is "only send if the user allows this channel and type."

### Push Token Ownership

Push token handling lives in:

```text
backend/services/pushService.js
```

Expo push tokens are globally unique device/app install identifiers. The backend upserts by token value and reassigns the token to the current user when needed.

That matters for shared devices or account switching. Without this, one user could log out, another user could log in, and notifications could continue going to the wrong account.

On logout, mobile unregisters the current push token before clearing the bearer token.

### Payload Design

The push payload should contain:

- title
- body
- notification type
- notification ID
- route link or minimal routing metadata

It should not contain full private records.

When the user taps the notification, the app navigates to the relevant route. The route then fetches data from the backend using the user's current auth session. Authorization still happens server-side.

### Honest Caveat

Some personal notification titles and bodies can still reveal limited context on a lock screen, such as a home label, gig label, or task label. The current system prevents cross-context leakage and constrains template data, but it is not equivalent to a "no sensitive text on lock screen ever" product posture.

If the product required maximum lock-screen privacy, I would add a user preference for generic push previews and render messages like:

```text
You have a new Pantopus notification.
```

Then the app would show details only after unlock.

### Interview Framing

I would describe this as a layered privacy design:

- backend template firewall
- explicit notification context
- field allowlists
- user preference checks
- token ownership reassignment
- minimal route payloads
- authenticated fetch on open
- tests for context leakage

I would also be candid about the remaining lock-screen preview tradeoff.

## 6. What Happens Offline For Chat, Gigs, Maps, And Homes?

### Short Answer

The mobile app is stale-data tolerant, not offline-first. It preserves what it can in memory, avoids destructive offline assumptions, and fails closed for permission-sensitive surfaces. It does not currently have a persisted offline cache or durable mutation queue.

### Shared Query Behavior

The app uses React Query for many network-backed surfaces. The mobile query client uses defaults like:

- short stale time
- retry for non-4xx failures
- refetch on reconnect
- no mutation retry by default

There is no persisted React Query cache in AsyncStorage and no durable offline mutation queue. So data usually survives transient offline states while the app process is alive, but not necessarily after app kill.

### Chat Offline Behavior

Chat uses a mix of socket and REST behavior.

Important pieces:

- sockets reconnect with backoff
- room joins can receive backfill
- REST polling acts as fallback when disconnected
- foreground resume refreshes messages
- optimistic sends use a client message ID
- failed sends are shown as failed and can be retried

If the user sends while offline, the app can create an optimistic local message. If the send fails, the message is marked failed and retryable.

The important limitation: this failed state is in memory. There is no durable outbox persisted across app restart.

Interview answer:

Chat handles short network interruptions gracefully, but it is not a guaranteed offline messaging system. I would add a persisted outbox if the product requirement became "compose and send reliably while offline."

### Gigs Offline Behavior

Gigs use React Query infinite loading.

If gigs were already fetched, the app can continue showing the in-memory cached list when offline. Refetches may fail, but the user still sees stale data during the process lifetime.

If the app cold-starts offline, there is no persisted cache to hydrate from. The screen will depend on its current loading/error/empty-state handling.

Mutations such as creating, editing, accepting, or bidding on gigs require the server. There is no offline job queue for gig writes.

Interview answer:

Gigs are browse-tolerant but not offline-authoritative. We show stale data when available and require connectivity for writes.

### Maps Offline Behavior

The explore map intentionally preserves existing markers when marker refresh fails. It also has an offline indicator that probes the backend health endpoint and shows the user that cached or stale data is being displayed.

The behavior is:

- successful marker fetch updates marker state and last-fetched timestamp
- failed marker fetch preserves existing markers
- app shows offline UI when the health probe fails
- map SDK tile behavior depends on platform/cache, not an explicit app-managed offline tile pack

There is no durable offline marker cache and no offline map tile download system.

Interview answer:

Maps degrade by keeping stale in-memory pins and telling the user they are offline. They do not promise offline navigation or complete offline discovery.

### Homes Offline Behavior

Homes are permission-sensitive, so the app fails closed.

Home access data uses React Query. If access checks fail, capabilities become false rather than optimistic. That is the right default because homes involve private membership, identity, address, and permission boundaries.

Home intelligence has some short-lived in-memory caching, but critical actions still require the backend. Mutations show errors instead of queuing offline writes.

Interview answer:

Homes prioritize correctness and privacy over offline optimism. If the app cannot verify access, it does not grant capabilities.

### Offline Summary Table

| Surface | Offline Read Behavior | Offline Write Behavior | Persistence |
| --- | --- | --- | --- |
| Chat | in-memory messages, socket reconnect, polling fallback | optimistic send, failed retry | no durable outbox |
| Gigs | in-memory React Query cache if already loaded | server required | no persisted query cache |
| Maps | preserves existing in-memory markers | no offline map writes | no offline tile/marker persistence |
| Homes | limited stale data, access fails closed | server required | short-lived in-memory cache only |

## 7. Which Web Features Are Intentionally Absent On Mobile?

### Short Answer

Mobile is not meant to mirror every web route. It is optimized for native, high-frequency workflows: home, pulse/gigs, marketplace, messages, push, maps, auth, and quick action loops.

The mobile navigation decision intentionally keeps the bottom tab model small. Some surfaces remain reachable but are not primary tabs. Other web-only or desktop-oriented features are intentionally absent or delegated to web.

### Examples Of Mobile Simplification

The mobile bottom navigation is intentionally constrained. Profile and audience/persona surfaces may exist as routes, but they are not bottom-tab anchors.

Mobile prioritizes:

- Home
- Pulse or gigs
- Tasks or marketplace flows
- Messages
- Native push and foreground behavior

This keeps the app from becoming a compressed desktop web app.

### Web-First Or Desktop-First Surfaces

Examples of features that are absent, reduced, or not first-class native mobile surfaces:

- public marketing pages such as full about/contact style web pages
- browser notification settings, because mobile uses OS push permissions
- some deep mailbox theme/settings pages
- desktop-style network management pages
- landlord/property portfolio console style routes
- admin/back-office style workflows
- some saved/list-management pages that are better folded into native browse surfaces

The important distinction is that some functionality may still exist in another mobile shape. A route being absent does not always mean the capability is absent. Sometimes it means the mobile UX represents it differently.

### Persona Subscription Checkout

One clear intentional product decision is that persona subscription checkout uses web checkout rather than StoreKit or Play Billing in the current mobile implementation.

The app opens a checkout URL in the system browser and relies on webhook/backend state to update membership. Universal links or app links can bring the user back into the app afterward.

This is a practical v1 choice, but it has platform-policy implications that would need to be revisited depending on the exact digital goods model and App Store / Play Store review posture.

### Interview Framing

I would say mobile intentionally avoids being a one-to-one route clone of web. The native app should optimize for the moments where mobile is strongest: push, location, camera/media, fast messaging, foreground/background lifecycle, and quick task completion.

## 8. How Are Deep Links Tested?

### Short Answer

Deep links are tested at the routing and notification-navigation layer today. Platform-level universal link validation is mostly a release QA responsibility and should be strengthened with device automation.

### Supported Link Types

The mobile app supports:

```text
pantopus://
https://pantopus.com/...
https://www.pantopus.com/...
```

The custom scheme is used for app-level callbacks such as OAuth:

```text
pantopus://auth/callback
```

iOS associated domains and Android intent filters cover key paths such as:

- gigs
- posts
- listings
- business profiles
- user profiles
- persona pages
- marketplace
- invites
- joins

### Auth-Aware Deep Link Handling

The app allows public deep-link routes before authentication. For protected routes:

1. The app stores the pending deep link in memory.
2. It redirects the user to login or registration.
3. After authentication, it consumes the pending route and redirects.

This is the right user experience, but it has an honest limitation: the pending route is in memory. If the app is killed during login, the user may need to tap the link again.

### Route Normalization

The app maps web-style routes to mobile-native routes. Examples:

| Incoming Link | Mobile Destination |
| --- | --- |
| `/gigs/:id` | `/gig-v2/:id` |
| `/listings/:id` | `/listing/:id` |
| `/marketplace/:id` | `/listing/:id` |
| `/broadcast/:id` | `/post/:id` |
| `/invite/:token` | `/homes/invite?code=:token` |
| `/join/:code` | invite-aware register or authenticated handling |
| `/b/:username` | `/business/:username` |
| `/u/:username` | `/user/:username` |

### Notification Routing Tests

Notification routing is tested in:

```text
frontend/apps/mobile/src/utils/__tests__/notificationRouting.test.ts
frontend/apps/mobile/src/contexts/__tests__/PushNotificationContext.test.ts
```

These tests cover:

- routing from notification type and metadata
- support train notification routes
- briefing routes
- persona routes
- push response deduplication
- fallback route behavior

### Current Test Gap

What I did not find is a complete device-level deep-link automation suite.

A stronger production suite would add:

```text
xcrun simctl openurl booted "pantopus://..."
adb shell am start -a android.intent.action.VIEW -d "pantopus://..."
adb shell am start -a android.intent.action.VIEW -d "https://www.pantopus.com/gigs/..."
```

It would also validate:

- Apple AASA file
- Android asset links file
- installed app association
- cold-start link handling
- warm-start link handling
- authenticated and unauthenticated flows
- OAuth callback flow

### Interview Framing

I would say: unit-level route mapping is covered, push-tap routing is covered, and app config declares universal/app links. The next quality step is platform-level automation for both custom scheme and HTTPS app links.

## 9. How Do You Handle App Upgrades That Require Backend Compatibility?

### Short Answer

Mobile clients cannot be upgraded instantly. Backend changes must be additive first, feature-gated when possible, and backward compatible through at least one store rollout window.

### Compatibility Principles

The rules I would enforce are:

1. Add before remove.
2. Accept old and new request shapes during migration.
3. Return old and new response fields when necessary.
4. Gate new client behavior behind remote flags or server capabilities.
5. Keep old mobile builds working until adoption is high enough.
6. Never make a backend deployment require an already-approved App Store or Play Store rollout unless a forced-upgrade path exists.

### What This Repo Already Does

This repo already has several compatibility-friendly patterns:

- shared API package under `frontend/packages/api`
- shared types/utilities across frontend packages
- tolerant auth response parsing
- feature flag hooks and mobile feature flag config
- release preflight for production mobile config
- separate development, preview, and production EAS profiles
- store build number/version code injection
- production API URL validation

For auth specifically, the client accepts both:

```text
accessToken
access_token
```

and similar variants for refresh token and expiration fields. That is exactly the kind of tolerance that prevents a backend naming migration from breaking old mobile builds.

### Recommended Rollout Pattern

For a backend change that affects mobile:

1. Deploy backend support for the new behavior while preserving the old behavior.
2. Ship mobile with tolerant parsing and feature flag checks.
3. Enable the feature for internal users or preview builds first.
4. Release to TestFlight and Play internal testing.
5. Roll out production gradually.
6. Monitor crashes, auth refresh failures, notification delivery, and API errors.
7. Only remove old backend behavior after old mobile versions age out.

### Truly Breaking Changes

If the backend must stop supporting old clients, the app needs a minimum-supported-version flow.

That means the backend should expose something like:

```text
minimum_supported_ios_build
minimum_supported_android_version_code
upgrade_required_message
store_url
```

The app should check this early in boot and show a blocking upgrade screen if required.

I did not find a dedicated minimum-version enforcement endpoint in the current repo. So my answer would be: the repo has many compatibility practices already, but a hard forced-upgrade mechanism should be added before intentionally breaking old mobile clients.

### Interview Framing

The senior answer is that mobile compatibility is a distributed systems problem. The App Store and Play Store add delayed deployment, partial adoption, and review uncertainty. Backend migrations must account for that.

## 10. How Do You Test iOS And Android Parity?

### Short Answer

Parity is tested by sharing as much code as possible, centralizing platform-specific differences, validating config before release, covering shared logic with Jest, and smoke-testing platform integrations on real devices.

### Shared Code First

Most mobile behavior is shared React Native / Expo code. Platform-specific behavior is kept in predictable places:

- Expo config
- permissions
- push notification channel setup
- biometrics labels and capability checks
- OAuth/web browser behavior
- maps key injection
- native plugin configuration

This keeps iOS and Android from drifting in business logic.

### Config Parity

The dynamic app config enforces both platform identities:

```text
iOS:     com.pantopus.app
Android: com.pantopus.app
```

The release preflight validates that production config still matches expectations before a store build.

### Unit And Integration Coverage

The mobile app has Jest coverage around important shared behaviors, including:

- auth restore and refresh behavior
- SecureStore migration and reinstall cleanup
- biometrics and app lock behavior
- push notification context behavior
- notification route resolution
- feature flags
- gig data hooks
- settings and privacy flows
- chat interaction pieces
- media and home-related flows

These tests are valuable because they run the same business logic for both platforms.

### Physical Device Matrix

Some mobile behavior cannot be trusted from unit tests or simulators alone.

The real-device parity matrix should include iOS and Android coverage for:

- login
- logout
- token refresh
- expired-token recovery
- foreground/background resume
- push permission prompt
- push token registration
- push tap routing
- push unregister on logout
- app links and custom scheme links
- OAuth callback
- biometrics
- device credential fallback
- camera permissions
- photo library permissions
- document picker
- location permission
- map rendering
- Google Maps key restrictions
- chat reconnect
- optimistic chat retry
- Stripe or web checkout return path
- app upgrade over an existing install

Push and biometrics specifically require real physical devices for meaningful confidence. The code intentionally does not register Expo push tokens on non-physical devices.

### Store Track Validation

Parity testing should run through:

- EAS development builds for local native integration
- preview/internal builds for QA
- TestFlight for iOS
- Play internal testing for Android
- production candidate builds using the production EAS profile

### Interview Framing

I would say parity is not just "does the UI render on both platforms." It includes auth lifecycle, push lifecycle, permissions, app links, native plugin behavior, build config, and upgrade behavior. The best approach is shared logic, narrow platform abstraction, automated config preflight, and real-device smoke testing.

## 11. Production Release Guardrails

Although not one of the original questions, production release guardrails tie several of the answers together.

The mobile release preflight verifies:

- production environment
- bundle and package identifiers
- EAS project ID
- iOS Apple Sign-In entitlement
- production network security
- required plugins
- build scripts
- EAS profile presence
- Expo dependency health
- TypeScript health

That is valuable because the highest-risk production mobile failures are often not TypeScript bugs. They are wrong bundle IDs, wrong API URLs, missing entitlements, broken native plugin config, invalid map keys, or stale EAS project IDs.

## 12. What I Would Improve Next

If I were hardening this mobile system further, I would prioritize:

1. Remove or clearly mark root-level stale Expo/EAS files.
2. Add device-level deep-link automation for iOS and Android.
3. Add a minimum-supported-app-version endpoint and forced-upgrade screen.
4. Add optional generic lock-screen notification previews for privacy-sensitive users.
5. Migrate all notification push display generation through the template registry.
6. Add a persisted chat outbox if offline sending becomes a product requirement.
7. Add persisted query cache only for surfaces where stale data is safe.
8. Add Detox or Maestro smoke tests for release-candidate builds.
9. Add explicit AASA and Android asset-links validation to release preflight.
10. Document the mobile release command path so EAS is never run from the wrong directory.

## Interview-Ready Closing Answer

The mobile app is designed around a few core production principles:

- There is one real mobile config source of truth: the resolved Expo config under `frontend/apps/mobile`.
- Token storage is secure for normal mobile threat models, but not oversold as protection against compromised devices.
- Auth refresh is lifecycle-aware and distinguishes invalid credentials from transient network failure.
- Push privacy is enforced with context-aware backend templates, minimal payloads, preference gates, and token ownership rules.
- Offline behavior is intentionally conservative and stale-data tolerant, not offline-first.
- Mobile does not clone every web route; it prioritizes native workflows.
- Deep links have route-level tests today and should gain device-level automation.
- Backend changes must be mobile-backward-compatible because store rollouts are delayed and partial.
- iOS/Android parity requires shared logic plus real-device validation for native integrations.

That is the engineering posture I would defend in an interview: practical, explicit about tradeoffs, and honest about current gaps while showing the architecture already anticipates production mobile failure modes.

