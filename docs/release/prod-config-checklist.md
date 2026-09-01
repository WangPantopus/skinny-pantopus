# Production Config & Release Build Checklist (RR-D)

Goal: ship signed Release builds of the **native** apps
(`frontend/apps/ios`, bundle `app.pantopus.ios`; `frontend/apps/android`,
package `app.pantopus.android`) that point at the production backend with
**live** payments.

This doc covers two things:

1. **What the repo now does automatically** (code — already merged on this
   branch). You don't have to touch these.
2. **What a human must do in a console / CI** (can't live in the repo):
   backend Stripe live mode, and supplying real secrets to CI.

> Note: this is the native iOS/Android pipeline. The Expo app under
> `frontend/apps/mobile` (package `com.pantopus.app`) has its own release
> path documented in `docs/android-release-guide.md` and
> `frontend/apps/mobile/README.release.md`.

---

## 1. In-repo (done in code)

### iOS (`frontend/apps/ios`)

- **Per-configuration xcconfig** (`Config/Pantopus.{base,Debug,Staging,Release}.xcconfig`).
  Defaults that ship in git:

  | Config   | API base URL              | Stripe key default | APNs (`aps-environment`) |
  |----------|---------------------------|--------------------|--------------------------|
  | Debug    | `http://localhost:8000`   | `pk_test_REPLACE_ME` | `development`          |
  | Staging  | `https://staging.api.pantopus.app` | `pk_test_REPLACE_ME` | `production`  |
  | Release  | `https://api.pantopus.app` | `pk_live_REPLACE_ME` | `production`          |

  Each config `#include? "Secrets.xcconfig"` last, so the CI-injected values
  override the committed placeholders.
- **`aps-environment` is config-driven** via `$(APS_ENVIRONMENT)` so
  TestFlight/App Store builds use the production APNs environment.
- **`AppEnvironment`** resolves `.local` (Debug), `.staging` (Staging, via the
  `STAGING` compilation flag), `.production` (Release). For staging/prod the
  API/socket URL is read from Info.plist but **guarded to `https://`** — a
  stray localhost/http value can never leak into a prod build (falls back to
  the canonical host).
- **Staging scheme** `Pantopus (Staging)` added for a pre-prod target.
- **Secrets actually flow into the build:** `fastlane before_all` now runs
  `make env-to-xcconfig`, materializing `Config/Secrets.xcconfig` from the
  CI-written `.env`. (Previously the build silently shipped the
  `pk_test_REPLACE_ME` placeholder because the secrets file was never
  generated in CI.)
- **App Store Connect API key auth** wired into `beta`/`release`/`build_release`
  lanes (non-interactive CI). Apple account details come from env, not the
  committed `Appfile`.
- **Release logging floor** raised to `.notice` (`#if !DEBUG`) so APNs tokens,
  deep-link paths, and analytics breadcrumbs don't print in shipped builds.

### Android (`frontend/apps/android`)

- **`PANTOPUS_ENV` defaults to `production` for the release buildType** (was
  `local` everywhere) so Sentry tags events correctly and uses the 0.1 trace
  sample rate.
- **Release-config guard** in `app/build.gradle.kts`: a release build with a
  non-`https://`/localhost API URL or a non-`pk_live_` Stripe key **warns** by
  default and **fails** under `-Ppantopus.requireProdConfig=true` (set by the
  fastlane release lane / CI). Local `assembleRelease` smoke tests still work.
- **ProGuard/R8 rules verified complete** (`app/proguard-rules.pro`): keeps
  Stripe (`com.stripe.android.**` + `model.**` + `keepnames`), Moshi
  (`@JsonClass`, `JsonAdapter` subclasses, `*JsonAdapter`,
  `@com.squareup.moshi.*` members), and the API models package
  (`data.api.models.**`), plus Retrofit/OkHttp/Hilt/Coroutines/Socket.IO/Sentry.
- Release minify + resource shrink already on; signing reads keystore from
  env/secrets (debug-keystore fallback only for unsigned smoke builds).

### CI workflows (already present)

- `.github/workflows/ios-beta.yml` → `fastlane beta` (TestFlight), env
  `ios-release`.
- `.github/workflows/android-beta.yml` → `fastlane beta` (Play **internal**
  track), env `android-release`.

---

## 2. Human / console steps (NOT in repo)

### 2a. Backend — switch Stripe to LIVE

These are backend deployment env vars (see `backend/.env.example`,
`backend/stripe/`), set in the hosted backend's secret store — **not** in this
repo:

- [ ] Set **`STRIPE_SECRET_KEY`** to the live secret (`sk_live_…`).
- [ ] Set **`STRIPE_PUBLISHABLE_KEY`** to the live publishable key
      (`pk_live_…`). The backend returns this to clients
      (`/checkout` intents, `pays.js`, `gigs.js`).
- [ ] Set **`STRIPE_WEBHOOK_SECRET`** to the **live** endpoint's signing
      secret (`whsec_…`) — create a live webhook endpoint in the Stripe
      Dashboard pointing at the prod backend (`stripeWebhooks.js` verifies it).
- [ ] **Stripe Connect:** confirm Connect is enabled for **live** mode and
      Express payouts are turned on (the seller onboarding/payout flow in
      `backend/stripe/stripeService.js` requires live Connect for real
      payouts). Verify the platform profile / payout settings are completed in
      the live Dashboard.
- [ ] Confirm the live publishable key handed to CI (below) **matches** the
      live account the backend's secret key belongs to.

### 2b. Provide secrets to CI

Set these in the GitHub repository **environments** the workflows reference.
The app's prod API base URL is baked into the Release xcconfig (iOS) / passed
as a secret (Android); the **live** Stripe key, signing material, and store
API keys must all come from secrets.

**iOS — environment `ios-release`** (consumed by `ios-beta.yml` → `.env`):

| Secret | Value |
|--------|-------|
| `STRIPE_PUBLISHABLE_KEY` | **`pk_live_…`** (live) |
| `MATCH_GIT_URL` | private certs repo URL |
| `MATCH_PASSWORD` | match decryption passphrase |
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect API key id |
| `APP_STORE_CONNECT_ISSUER_ID` | issuer id |
| `APP_STORE_CONNECT_KEY_CONTENT` | **base64** of the `.p8` key |
| `APPLE_TEAM_ID` | 10-char team id |
| `SENTRY_DSN` _(optional)_ | prod Sentry DSN |
| `FASTLANE_APPLE_ID` / `APP_STORE_CONNECT_TEAM_ID` _(optional)_ | legacy auth / multi-team |

> The prod API base URL is the Release xcconfig default
> (`https://api.pantopus.app`); add `PANTOPUS_API_BASE_URL` to the iOS `.env`
> step only if it ever diverges.

**Android — environment `android-release`** (consumed by `android-beta.yml`):

| Secret | Value |
|--------|-------|
| `PANTOPUS_API_BASE_URL` | **`https://api.pantopus.app`** |
| `PANTOPUS_SOCKET_URL` | prod socket URL |
| `STRIPE_PUBLISHABLE_KEY` | **`pk_live_…`** (live) |
| `MAPS_API_KEY` | Maps key restricted to `app.pantopus.android` + SHA-1 |
| `ANDROID_KEYSTORE_BASE64` | base64 of the upload keystore |
| `PANTOPUS_KEYSTORE_PASSWORD` / `PANTOPUS_KEY_ALIAS` / `PANTOPUS_KEY_PASSWORD` | keystore creds |
| `PLAY_STORE_SERVICE_ACCOUNT_JSON` | Play Developer API service-account JSON |
| `SENTRY_DSN` _(optional)_ | prod Sentry DSN |

> `PANTOPUS_ENV` need not be set — the release buildType defaults to
> `production`. Set it only to ship a non-prod variant.

### 2c. Store consoles (one-time)

- [ ] App Store Connect: app record for `app.pantopus.ios`, API key issued,
      `match` certs/profiles repo seeded (`fastlane match appstore`).
- [ ] Google Play Console: app for `app.pantopus.android`, upload key
      registered, Play App Signing enabled, service account granted API
      access, internal testing track set up.

---

## 3. Verify (dry-run — signed artifact pointing at prod)

Run after secrets are in place; needs Xcode (macOS) / Android SDK + signing.

**iOS** (builds a signed Release archive, no upload):

```sh
cd frontend/apps/ios
# CI writes .env from secrets; locally export the same vars or use a .env
bundle exec fastlane ios build_release
```

Then confirm in the archive's `Info.plist`:
- `PantopusAPIBaseURL` = `https://api.pantopus.app`
- `StripePublishableKey` starts with `pk_live_`
- `aps-environment` (entitlements) = `production`

**Android** (signed AAB, prod config enforced):

```sh
cd frontend/apps/android
bundle exec fastlane android build_release         # bundleRelease + requireProdConfig
# or, equivalently:
./gradlew bundleRelease -Ppantopus.requireProdConfig=true
./gradlew publishReleaseBundle --dry-run           # Play upload dry run
```

The build fails fast if `PANTOPUS_API_BASE_URL` isn't an `https://` prod URL
or `STRIPE_PUBLISHABLE_KEY` isn't a `pk_live_` key. Inspect
`BuildConfig` in the AAB to confirm `PANTOPUS_ENV=production`.

---

## 4. Final pre-ship checks

- [ ] No `pk_test`, `localhost`, `10.0.2.2`, or staging URLs in the Release
      artifacts (the guards above enforce this; spot-check anyway).
- [ ] No verbose/debug logging in Release (iOS `.notice` floor; Android Timber
      tree only planted under `BuildConfig.DEBUG`; OkHttp logging `NONE` in
      release).
- [ ] A small live test transaction succeeds end-to-end (charge + Connect
      payout) before the public release lane (`fastlane ios release` /
      `fastlane android release`).
