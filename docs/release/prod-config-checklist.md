# Production Config & Release Build Checklist (RR-D)

## September22 consolidated provider and activation package (L01 draft)

This section is the current planning source for the existing80-row backlog; the historical
native checklist below is implementation context, not proof of current hosted readiness.
Prices were checked against official pages on2026-09-22, in USD using US public rates where
applicable. No subscription, new provider, key, resource, deployment or production flag was
activated. Existing subscriptions may already cover part of these amounts; account invoices
and exact hosted capacity are not available in the accepted evidence.

### Existing integration, cost basis and remaining acceptance

| Existing dependency | Published cost basis | Concrete prerequisite / remaining boundary |
|---|---|---|
| Supabase Postgres/Auth/private Storage | Pro from$25/month; includes one Micro project through compute credit; another Micro from$10/month. PITR from$100/month is extra. [Pricing](https://supabase.com/pricing) | Select production plus staging projects/regions and recovery objective. Reconcile each actual hosted ledger; local canonical replay and retained candidate ledger84 are different. Verify private Home/task/completion buckets and restore bytes independently. |
| Vercel web | Pro$20/month with included usage credit; additional developer seats/usage extra. [Pricing](https://vercel.com/pricing) | Bind exact release SHA, API/web domains, redirect allowlist and build env. Existing Vercel Git integration is retained; no hosting replacement proposed. |
| EC2 backend + Docker + existing scheduler/Socket.IO | Region, instance, EBS, IPv4, transfer and uptime determine cost; no flat total inferred. [EC2 pricing](https://aws.amazon.com/ec2/pricing/on-demand/) | Obtain selected EC2 instance/region/disk/traffic quote and bind existing deployment/rollback workflows. One tested local worker is not hosted throughput/capacity evidence. Include monitoring, backups and any load balancer/NAT costs actually selected. |
| S3 + optional CloudFront for public uploads | Storage/requests/transfer and selected CDN plan are metered. [S3](https://aws.amazon.com/s3/pricing/), [CloudFront](https://aws.amazon.com/cloudfront/pricing/) | Existing `backend/config/aws.js` defaults to us-west-2; bind actual bucket/region/IAM/CDN and external byte restore. Private Home/completion bytes use the existing Supabase private mechanism; do not make those public or count one storage provider as proof of the other. |
| Postmark SMTP (current example/provider) | Basic$15/month for10,000 emails; excess$1.80/1,000. Pro$16.50 includes configurable retention/inbound features. [Pricing](https://postmarkapp.com/pricing) | Verify sending domain, SMTP sender, DKIM/SPF/DMARC, signup/reset/invitation delivery and bounces. Choose retention based on actual data policy. Local capture/preview does not establish delivered email. No need to purchase another SMTP vendor for this code. |
| Smarty US address verification | Published Professional option$552/year (monthly equivalent$46); confirm selected allowance/term in the actual quote. [Pricing](https://www.smarty.com/pricing) | Existing provider previously returned402 for inactive subscription. Confirm existing entitlement, supported US/DPV scope, renewal/lookup cap and successful residential acceptance. A free trial is not a continuing launch entitlement. |
| Google Address Validation + Places + Android Maps | Address Validation Pro has5,000 monthly free events then$17/1,000 in the first paid tier; Enterprise and Places/Maps SKUs differ. [SKU table](https://developers.google.com/maps/billing-and-pricing/pricing) | Bind billing project, exact invoked SKUs, API restrictions, supported geography and caps. Google result alone did not satisfy the unavailable Smarty residential boundary. Do not assume all Maps/Places calls share one free allowance. |
| Mapbox geocoding/maps | GL JS starts with50,000 free monthly map loads then$5/1,000 in the first paid tier; search/geocoding have separate meters. [Pricing](https://www.mapbox.com/pricing) | Existing geo provider defaults to Mapbox. Quote actual endpoints plus token restrictions and measured requests. The web-load allowance is not a geocoding allowance or proof of native provider configuration. |
| Lob operational verification postcards | Developer subscription from$0; published postcards start$0.905/piece. Format, postage/service and plan determine final rate. [Pricing](https://www.lob.com/pricing) | Accepted TEST operational postcard create/read/delete sent no physical mail. Bind live account/from address/template/webhook, paid inventory/caps and real delivery/lost-mail policy. No physical mail is authorized by this draft. |
| Stripe Payments | US domestic cards2.9%+$0.30 per successful charge; international/FX/disputes and optional products add costs. [Pricing](https://stripe.com/us/pricing) | Match account/live keys and webhook signing, retain exact originals/refund/dispute controls, verify hosted retry and truthful unknown outcomes. TEST charges and local wallet credits are not bank delivery. |
| Stripe Connect (platform controls pricing) | $2 per monthly active payout account plus0.25%+$0.25 per payout. [Connect pricing](https://stripe.com/connect/pricing) | Confirm actual Connect commercial model/country, account onboarding, live payouts and responsibility for fees/losses. Existing wallet/reversal/debt limits remain P06/P09. Founder cancellation-fee payer/recipient decision remains separate; these prices do not decide that policy. |
| Apple Developer + App Store Connect/APNs | $99/year membership. [Enrollment](https://developer.apple.com/programs/enroll/) | Confirm organization/team/signing/entitlements, production APNs credentials and installed physical-device delivery/callbacks. Existing simulator push records are not APNs delivery. |
| Google Play + FCM | Play$25 one-time registration; FCM is no-cost. [Play](https://support.google.com/googleplay/android-developer/answer/6112435), [FCM](https://firebase.google.com/pricing) | Confirm Play account/signing/internal track, Firebase project/service-account scoping and real token/foreground/background/cold delivery. Other Firebase services are priced separately. |
| Google/Apple OAuth | No additional per-login charge assumed here; no verified account-specific commercial quote. Existing Auth and developer plans above cover only their listed products. | Configure provider IDs/secrets, consent/scope, verified domains and exact redirects in the selected Auth project. Exercise cancel/error/revocation/return on all clients before acceptance. |
| OpenAI app AI features | Current code defaults: GPT-4o$2.50 input/$10 output per1M text tokens; GPT-4o-mini$0.15/$0.60. [GPT-4o](https://developers.openai.com/api/docs/models/gpt-4o), [GPT-4o-mini](https://developers.openai.com/api/docs/models/gpt-4o-mini) | Bind selected deployed models, metered input/output/image/tool usage and project budget. Missing key uses existing fallback. No model migration or AI activation proposed; optional gap-fill flag and visible AI features need their own acceptance. |
| Twilio / mailbox SMS | US long-code SMS$0.0083/segment plus carrier fees; number$1.15/month; registration costs extra. [Pricing](https://www.twilio.com/en-us/sms/pricing/us) | **Implementation boundary:** `backend/routes/mailbox.js` calls `smsService.sendSms`, whose current body only logs and returns placeholder success. Credentials alone cannot establish delivery. Confirm intended SMS product/recipient/consent contract, reproduce through the actual caller, then assign focused repair before buying capacity. |
| Domains, certificates, error monitoring and CI/distribution | Existing domains/plan entitlements and usage must be quoted; no unverified zero-cost assumption. | Reconcile pantopus.com/pantopus.app/API host, AASA/assetlinks and signing fingerprints; exact SHA artifacts, logs/alerts, GitHub Actions retention/minutes and operator support. Existing release docs contain historical host claims, not current DNS acceptance. |

### Reviewable budgeting example (not an approved purchase or traffic forecast)

For **one production Micro plus one staging Micro**, one Vercel developer seat and Postmark
Basic, the known recurring subtotal is **$70/month** before usage ($25+$10+$20+$15).
If the displayed Smarty annual option is selected, add **$552 paid annually**, equivalent to
$46/month: **$116/month equivalent**. Apple adds$99/year; new Play registration adds$25 once.
These sums exclude existing-account credits and taxes, EC2/EBS/network, public storage/CDN,
PITR, domain renewals, monitoring/CI, card/payout fees, postage, SMS, address/maps excess and AI.
They are a partial subtotal, never a total launch budget.

Illustrative usage, independent of a launch cohort:100 domestic$20 card charges imply$88
base processing fees;20 monthly active Connect payout accounts each receiving one$80 payout
imply$49 in the stated Connect model, for$137 combined before other fees.100 postcards at the
published starting rate imply$90.50 before format/service differences.1M uncached input plus
0.25M output text tokens implies$5.00 on GPT-4o or$0.30 on GPT-4o-mini. Provider rounding,
actual capabilities and selected commercial terms govern the bill. These examples neither
set Pantopus fees nor authorize transactions.

### One activation decision, followed by bounded acceptance

1. Finish the reviewed application merge queue and bind final master CI/build/schema hashes;
   keep the existing80-row evidence matrix authoritative. Resolve P04/P05 policy, daily-agenda
   producer semantics, attachments and other explicit founder decisions in their owner rows.
2. Supply one account/entitlement and cost sheet using this table: existing subscriptions,
   selected region/instance/storage/egress, exact Smarty quote, traffic and mail/payment/payout
   assumptions, recovery objective/PITR choice, geography, per-provider caps and responsible owner.
   Missing quoted components remain visible; no piecemeal purchase/activation.
3. Prepare exact hosted ledger adoption, private byte restore, signed artifact/config manifest,
   domain/association and worker/webhook plans. The recent local ops metadata receipt found
   deployment/migration flags disabled and no configured repository/environment secrets;
   that read-only observation must be refreshed before any eventual activation.
4. Present the concrete combined cost/configuration/cutover plan for the founder's authorization.
   After authorization and access, execute the listed provider/device journeys and record real
   receipts. Keep rollback and failure handling available. Do not mark L01/L02 complete from
   pricing research, local fixtures or CI, and do not start a pilot until L03/L04 gates hold.

Source binding: inspected existing checkout6c49692d6, masterb30e0d395 and current live
coordination. Core integration paths: `backend/.env.example`, `backend/config/aws.js`,
`backend/config/openai.js`, `backend/services/emailService.js`, `smsService.js`,
`s3Service.js`, addressValidation providers, push clients and existing deployment/native lanes.
No secret values were read for this inventory and no raw logs are included.


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
