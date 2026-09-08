# Staging setup for physical notification tests

## Status — September 7, 2026

The code baseline is master `e60c19cc69d065a78df85d0f3d26c5897c5a0555`
(including merged PR #5). Explicit native staging inputs and local configuration
checks are available. The runtime preparation below adds sandbox vendor checks
without disabling production security settings. **The staging backend is live
at `https://staging-api.pantopus.com`; physical push delivery is not verified.**

The operator subsequently authorized restarting the existing server, configuring
its management access, and deploying the current backend to staging, while
retaining the restriction **against new paid resources**. A separate Free
Supabase project has been created. See the [recovery record](backend-recovery-2026-09-07.md)
for the corrected database ownership, local schema rehearsal, and host sharing.

Current discovery and remaining prerequisites:

| Dependency | Observed state |
| --- | --- |
| GitHub staging | Exists; no environment secrets; backend deployment and DB migration flags are false. |
| Staging source branch | No remote `dev` branch exists yet. |
| Supabase | `Pantopus-backend` is the existing testing database. New Free project `Pantopus-staging` is isolated from both it and production; preserve both existing projects. |
| Backend host | API and worker release `9d1fe24dc` are healthy on the existing server. Staging API uses loopback port 18001 behind nginx; the old production container is preserved. |
| DNS | Production API DNS still points to the old address. DNS-only `staging-api.pantopus.com` points to the current server, with verified HTTPS and tested certificate renewal. |
| Registry | The operator has a Docker Hub account; staging registry secrets are not configured. |
| Firebase | Google CLI needs interactive reauthentication. The committed Android config is a placeholder. |
| Push server credentials | Private staging runtime env exists, with isolated database credentials and test vendors. APNs/FCM, isolated storage and email delivery remain unconfigured. |
| iOS | Paired iPhone 16 Pro is available; a local Apple Development signing identity exists. The private staging overlay resolves the live HTTPS endpoint and development APNs entitlement; no app was installed. |
| Android | No ADB-connected phone. |
| Recipients | Test accounts/devices have not yet been designated. |

Do not label provider acceptance, a simulator test, or the presence of config
fields as proof of device delivery. Record text evidence; screenshots are not
required for this milestone.

Local preparation validation passed: 26 deployment/migration/configuration tests,
Android `ktlintCheck`, Xcode's resolved Staging settings, and Android's generated
BuildConfig/Firebase resources. The native checks used synthetic public config;
both explicit staging paths rejected a missing env file. Test inputs and
generated secret overlays were removed afterward. No signed app was installed,
and no staging release or live notification was sent.

Read-only inspection of the existing **testing** database found PostgreSQL 17.6 and 288 public
tables. A schema-only export was saved outside the repository with private
permissions; it contains no row INSERT/COPY statements. This is an inspection
artifact, not an adopted production baseline. Both `AuthDevice` and
`AuthSession`, used by the current device/session implementation, are absent.
The missing schema has since been rehearsed in isolation, with corrections and
limitations recorded in the recovery document. No production application schema
or migration ledger was changed.

Runtime preparation validation passed: 4,279 backend tests (16 skipped), all
privacy gates, and 28 deployment/native-configuration/database-safeguard tests.
The backend total includes 16 new staging startup checks. These tests use
synthetic credentials and do not deploy or call live providers.

## Hosted staging runtime

The deployment script explicitly sets `NODE_ENV=production` and `APP_ENV` to
the selected target on the candidate, API and worker. Thus staging retains the
existing production requirements for CSRF, step-up secrets and vendor config.
The staging runtime requires:

```dotenv
NODE_ENV=production
APP_ENV=staging
LOB_ENV=test
LOB_API_KEY=test_REPLACE_ME
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
```

These lines describe required modes, not a complete or usable runtime env.
Provide real sandbox keys privately. A restricted Stripe `rk_test_` key is also
accepted if it has the permissions the app needs. Lob chooses test/live delivery
from the key itself, so `LOB_ENV=test` with a live key is rejected. Both process
entry points validate before loading services or registering jobs. Hosted
staging still requires Google/Smarty configuration and the Lob webhook signing
secret; ordinary production still requires `LOB_ENV=live`.

The checks do not establish database isolation, credential validity, email/SMS
recipient restrictions, storage isolation or push delivery. Configure those
separately before deploying. No live provider call is made by validation.

## Configure the backend

1. Designate the staging Supabase project and an HTTPS backend host. Restore
   Google CLI access if that account will be used. Keep resource IDs and
   secret-file locations in the operator's private configuration.
2. Follow [CI/CD host setup](ci-cd.md#configure-each-environment). Install
   `~/pantopus/.env.staging` with the staging database credentials and runtime
   configuration; API port is 8000. Provision the separate API/worker deployment.
   Check all backend startup requirements, including external service settings.
   Do not copy a development env wholesale or enable live billing/mail merely
   to make startup pass.
3. Configure the six GitHub staging environment secrets from the CI/CD guide.
   APNs and FCM **server** credentials belong in the host runtime env, never in
   the mobile files below. See [push credentials](push-native-migration.md#6-environment-variables).
4. Create/update `dev` with the approved release commit and wait for its full CI
   run. The deployment workflow only accepts the current successful `dev` head.
   Enable `BACKEND_DEPLOY_ENABLED` after the host is configured. Keep database
   automation disabled until the baseline-adoption runbook is complete; the
   current frozen migration history must not be replayed blindly into a new DB.
5. Verify `/health`, record the deployed commit/image digest, and check the real
   staging schema supports Following, notification tokens and device/session
   associations. A new empty Supabase project alone is insufficient.

In the staging runtime, `node scripts/push-smoke.js --check --platform ios`
and the Android equivalent check server config without sending. They do not
validate credential authority. Use a verified test token for the later live send.

## Prepare iOS

Copy `frontend/apps/ios/.env.staging.example` to `.env.staging` in that directory.
Fill the designated HTTPS API/socket origins and Stripe **test** publishable
key. Use unquoted `KEY=value` lines; put comments on separate lines.

Run `make bootstrap-staging` from `frontend/apps/ios`, then build the
**Pantopus (Staging)** scheme. It reads `Config/Secrets.Staging.xcconfig`, which
is separate from the local Debug/Release overlay. A regular `make bootstrap`
does not refresh staging configuration. Both generated overlays are ignored.

Use `APS_ENVIRONMENT=development` for a development-signed device build and
`production` for TestFlight/distribution. Match the backend's
`APNS_PRODUCTION` setting to the **signed app's** entitlement; inspect with
`codesign -d --entitlements :- /path/to/Pantopus.app`. The scheme name alone
does not establish the signing environment. Apple documents this distinction
in the [APNs entitlement reference](https://developer.apple.com/documentation/bundleresources/entitlements/aps-environment).
The existing Fastlane `beta` lane uploads Release; it does not upload this
Staging scheme. Do not use that lane for staging without configuring it first.

## Prepare Android

Copy `frontend/apps/android/.env.staging.example` to `.env.staging` in that
directory. Fill the public staging settings. Download the Firebase client
config for **`app.pantopus.android.debug`** into
`app/src/debug/google-services.json` (ignored). It must belong to the project
targeted by the backend FCM sender. The [Firebase variant configuration guide](https://firebase.google.com/docs/projects/multiprojects)
describes this directory layout. A service-account JSON is a different file
and must never be packaged in the app.

From the repository root, run this with the designated project ID:

```sh
node scripts/staging/check-native-config.cjs --platform android \
  --env-file frontend/apps/android/.env.staging \
  --firebase-config frontend/apps/android/app/src/debug/google-services.json \
  --fcm-project-id YOUR_STAGING_FIREBASE_PROJECT_ID
```

Then, from `frontend/apps/android`, use
`./gradlew -Ppantopus.envFile=.env.staging :app:assembleDebug`.
`PANTOPUS_ENV_FILE` is an alternative selector; the Gradle property takes
precedence. A selected missing file fails immediately. Without either selector,
the normal local `.env` behavior remains. Run the same selector with
`:app:installDebug` once the designated phone is connected and authorized.
These are physical test debug builds; Play internal-track distribution requires
the release package's Firebase config and signing/distribution setup separately.

## Verify and record

Follow the [full Beacon staging journey](beacon-staging-verification-2026-09-07.md#full-beacon-journey)
with a dedicated creator/follower and no unrelated recipients. Record for each
platform and foreground/background/normal-termination state:

- Release SHA, device model/OS, app build and signing/APNs environment.
- Token registration acknowledged (provider/platform/device association only;
  keep the raw token private).
- Test post ID, provider acceptance timestamp, visible notification result,
  and tap destination matching that exact permitted post.
- Mute, global/type opt-out, membership and revoked-access results.

Android force-stop is a separate state from normal termination. Also test
sign-out/token revocation before finishing. Restore test preferences and remove
only the fixtures created for this run. Mark any unavailable case unverified.
