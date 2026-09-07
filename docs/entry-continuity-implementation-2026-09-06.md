# Home, Pulse, and Beacon entry continuity

Implemented September 6, 2026, against repository baseline `6a936e4b6`.

This is the first **web and shared-backend increment** from the release brief. It is not an all-platform release sign-off. No deployment, production account creation, real email, or public follow/post was performed.

## Result

- Login/signup cross-links, verification screens and emails, OAuth callbacks, password recovery, and authenticated middleware redirects preserve a validated internal destination. Public Beacon handles, public posts, app routes and invitation routes are supported. External destinations, encoded traversal and malformed paths fall back safely. Nested query values retain their encoding.
- OAuth returns to the callback that exchanges credentials before returning to the intended page. The callback and email verification reuse an in-flight request during React Strict Mode remounts, avoiding duplicate one-time token exchanges.
- Shared Pulse posts offer **Join the conversation** on the web. Address-free browsing opens the existing Beacon feed. Feed surface selection is reflected in the URL. Local posting permissions remain enforced by the existing services.
- Beacon legacy-follow visitors sign in and return to the same public profile; following requires another explicit click. Failures are visible and retryable. The flag-enabled privacy handshake remains in place. No follow or post is submitted automatically after authentication.
- An address preview survives signup, verification in a second tab of the same browser, login and reload. The user sees **Save privately**. A failed or unconfirmed save retains the preview; a confirmed save clears it. Returning users can reopen saved public address information and enter the existing household setup flow with the address input prefilled.
- Corrected the shared SavedPlace API client from `/saved-places` to the actual `/api/saved-places` route. The real-browser test exposed this gap, which component mocks alone had not caught.

## Private address contract

An unfinished preview is a device-local draft with a random identifier and a 24-hour expiry. Auth URLs and verification emails carry the identifier, never the address or coordinates. The draft is bound to the account returned by credential exchange or registration. A different account cannot confirm that draft. Explicit signout, cancellation and starting a different preview clear it; expired drafts are inaccessible and are purged on the next app visit. Browser storage must be available. Another browser or device cannot recover an unfinished local draft; the UI explains when it is unavailable.

Saving uses the existing account-scoped SavedPlace upsert and its `(user_id, latitude, longitude)` unique constraint. The confirmation request includes the expected account id; the backend refuses a request under a different session. Lists and deletion remain scoped to the authenticated account. No Home, owner, claim or household membership is created by this save. Household setup still uses the existing address validation, unit disambiguation and authorization flow after a separate user action.

The home public-profile and discovery responses no longer expose owner account identifiers, usernames, profile photos or names to outsiders. Custom household names/descriptions are also withheld. A claim alone never grants the full profile projection. An active claimant may see a redacted private-home preview to continue onboarding; terminal claims alone do not grant that preview. Current household access remains authoritative for private fields. Knowing an address does not reveal its owner's account.

The redacted owner is `null`, which the inspected web, iOS and Android public-preview models already support. Returning an owner object with `id: null` would break existing native decoders. This is a focused entitlement correction, not certification of every privacy setting or endpoint in the broader B01 audit.

## Existing home intelligence

The existing Home intelligence service, section adapters, provider coverage, verification tiers and detail views are preserved. This includes supported ATTOM/property information, weather, air quality, alerts, the sunrise/sunset daylight arc, environmental information, and civic/election sections. The existing `TodayDetail` contains the sun visualization. No property or civic provider integration was removed or replaced.

SavedPlace previews show the existing public preview contract. They do not pretend to unlock household-only or licensed/verification-gated information. Existing authorized Home dashboards retain their full supported section contract. Provider availability and production credentials were not validated by the mocked tests.

## Verification

- **Web: 11 suites, 129 tests passed.** Includes arrival validation, auth screens, Strict Mode verification/OAuth, explicit save/retry/account isolation, saved-context return, Beacon errors, feed entry, session recovery, existing Home detail sections, navigation and security-settings behavior.
- **Backend: 6 suites, 67 tests passed.** Includes home access/redaction, privacy mirror, registration and recovery email destinations, OAuth routes, SavedPlace idempotency and account isolation, and redirect validation. Database and mail integrations were mocked.
- **Browser: 1 Playwright journey passed.** Exercises anonymous preview → signup → verification in another tab → sign-in → explicit save → simulated failure → reload/retry → saved-context reload. All API responses are fixtures. Mobile width and rendered layout were inspected at 390px; no page JavaScript errors were observed.
- Targeted web lint passed with warnings from existing code; whitespace validation passed.
- Full TypeScript checking is **not clean**: 164 errors versus 178 on an isolated copy of the unchanged commit using the same generated Next declarations. No new file/error-code counts were introduced. The repository's type gate still fails on six existing signatures in Nearby map typings and address-calendar fixtures in two dev pages and `placeGroupDetail.test.tsx`. The baseline was not relaxed.

Commands, from `frontend/apps/web`:

```sh
pnpm exec jest --runInBand --runTestsByPath tests/authArrival.test.tsx tests/pendingPlaceSave.test.tsx tests/savedPlaceContext.test.tsx tests/beaconArrival.test.tsx tests/feedArrival.test.tsx tests/startFunnel.test.tsx tests/sessionRefresh.test.tsx tests/personaHandshakePage.test.tsx tests/securitySettingsPage.test.tsx tests/placeGroupDetail.test.tsx tests/audienceNav.test.tsx
pnpm exec playwright test tests/e2e/entryContinuity.spec.ts
pnpm run type-check:gate
```

The browser run used a temporary config pointing to a dedicated localhost server on port 3107 and installed Chrome. The committed test also works with the project's standard Playwright server configuration.

From `backend`:

```sh
pnpm exec jest --runInBand --runTestsByPath tests/homeAddressRedaction.test.js tests/unit/homeMirror.test.js tests/unit/registerRoutes.test.js tests/unit/oauthRoutes.test.js tests/unit/savedPlaces.routes.test.js tests/unit/authRedirect.test.js
```

## Before deployment and the next increment

Deploy the additive backend auth fields and expected-account save check before the new web build. No new database migration is introduced by this package. Verify the existing SavedPlace unique constraint and required deployed schema as part of staging checks. Exercise real email delivery and Google/Apple callbacks in staging, including the configured callback allowlist, cookie origin, expired sessions and actual restricted-post permissions. The browser fixture test is not evidence of those external integrations.

**Native follow-up implemented:** iOS and Android now replace automatic Home creation with explicit private bookmarking, expiring account-bound drafts, save retries, and social destination continuity. See [native implementation and verification notes](native-entry-continuity-2026-09-06.md). Native device/email/OAuth acceptance and the existing local iOS build blocker still need release validation.

The rest of the [journey audit](v1-journey-audit-2026-09-06.md), including calendar accuracy/delivery, social navigation, release flags and full cross-account verification, remains separate work.
