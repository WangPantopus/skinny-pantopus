# Staging setup for physical notification tests

## Status — September 8, 2026

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
| Firebase | Created `Pantopus Staging` (`pantopus-staging`) with the owner's terms approval. The console confirms Spark, $0/month; Analytics and the Developer Program opt-in were left off. Registered `app.pantopus.android.debug`; the downloaded client configuration is privately saved in the ignored debug variant directory and passes the native config check. |
| Push server credentials | Both healthy staging processes load APNs sandbox and FCM credentials. The supplied Apple key passed EC P-256 signing checks, but Apple rejected the first push with `403 InvalidProviderToken`; the Developer portal confirmed it is a WeatherKit-only key. A sandbox, topic-specific APNs key is prepared and awaits owner approval. The live staging API passed Google OAuth and an FCM validation-only request. Physical push delivery remains unverified. Isolated storage and backend email delivery remain unconfigured. |
| iOS | A signed physical-device Staging build succeeded. Strict signature verification passed; the signed entitlement is `aps-environment=development` and both bundled endpoints resolve to the staging HTTPS origin. The app was installed on the paired iPhone 16 Pro after confirming no existing Pantopus installation. The owner logged in with a dedicated synthetic staging account. Its APNs token is registered and linked to the device, with push enabled. |
| Android | The debug APK build succeeded with the real staging client configuration. APK signature, `app.pantopus.android.debug` package, and packaged Firebase project/sender ID were verified. No app was installed; no ADB-connected phone. |
| Recipients | The owner designated their iPhone and logged into a dedicated synthetic account. One stored test notification was created; Apple rejected its push before acceptance. No other recipient was targeted. |

Do not label provider acceptance, a simulator test, or the presence of config
fields as proof of device delivery. Record text evidence; screenshots are not
required for this milestone.

The dedicated Google service account `pantopus-staging-push` was granted only
`roles/firebasecloudmessaging.admin` in `pantopus-staging`, with the owner's
explicit approval. Key generation initially failed because the inherited
`iam.disableServiceAccountKeyCreation` policy was enforced. The owner separately
approved a temporary exception for this staging project. One JSON key was
generated, then the original inheritance was immediately restored; the console
again showed **Enforced**. No organization-wide policy or other project was
changed. Both the service-account JSON and mobile client configuration remain
private and excluded from Git.

The FCM credential passed local RSA signing checks. Using the unchanged deployed
backend image on AWS, it then passed Google OAuth authentication and an FCM HTTP v1
`validate_only: true` request (HTTP 200). The validation used a dedicated test
topic and did not deliver a notification. It establishes sender permission,
not device-token registration, physical delivery, or notification tap behavior.

Only the three approved FCM fields were transferred over pinned SSH and combined
with the existing host configuration. The rollout reused backend release
`9d1fe24dc` and its unchanged image. Both live staging processes passed APNs and
FCM configuration checks; the running API repeated the FCM validation-only
request successfully. Public HTTPS `/health` returned HTTP 200 with the database
connected. The old production container remained healthy. The prior staging
environment and stopped containers are retained for recovery.

Initial local preparation validation passed: 26 deployment/migration/configuration tests,
Android `ktlintCheck`, Xcode's resolved Staging settings, and Android's generated
BuildConfig/Firebase resources. The native checks used synthetic public config;
both explicit staging paths rejected a missing env file. Test inputs and
generated secret overlays were removed afterward. No signed app was installed,
and that initial validation sent no staging release or live notification. Later
deployment and credential configuration are recorded in the current status above.

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

## First iPhone test — September 8, 2026

Login succeeded. Registration then exposed a schema gap: `PushToken.platform`
and `provider` were missing. Numbered migration
`backend/database/migrations/152_push_token_platform_provider.sql` contains the
required change, but it has no counterpart in the timestamped migrations used
for the initial reconciliation. Passing the identity-firewall checks did not
establish native-push schema readiness.

The local Docker rehearsal database was unavailable. The exact narrow DDL was
therefore tested in a short, rollback-only staging transaction before applying
it: iOS/APNs insert, Android/FCM upsert, device linkage, legacy Expo backfill,
idempotent replay, unchanged security settings, and complete rollback all
passed. The guarded staging transaction then added the two nullable text fields
and provider index and notified PostgREST to reload its schema. No migration
ledger or existing production/testing database was changed.

After a background app restart, the authenticated iPhone registered one APNs
token with device linkage and push preferences enabled. The current
`notificationService.createNotification` path created one notification and
invoked the native sender once. Apple returned **HTTP 403,
`InvalidProviderToken`**, with zero accepted or invalid device tokens. The
private token was retained. Display and tap navigation remain unverified.

The live key's signature and JWT timestamps were valid locally. In the Apple
Developer portal, its Key ID belongs to **Pantopus WeatherKit** and has no APNs
capability. An existing Expo APNs key is listed, but its private file was not
found in the checked recovery locations. A proposed **Pantopus Staging Push**
key is prepared with **Sandbox**, **Topic Specific**, and only
`app.pantopus.ios`. Creation is pending the owner's explicit approval; no
existing Apple key has been modified or revoked.

Before future device tests, verify the live table contract explicitly (this
read-only query returns no device data):

```sql
SELECT token, platform, provider, device_id, updated_at
FROM public."PushToken" WHERE false;
```

A matching staging schema is still not proof of a complete production upgrade.
Include native-push columns when finishing the production gap audit; both old
schemas lacked them, so comparing only against the initial staging catalog
could not detect this omission.

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
