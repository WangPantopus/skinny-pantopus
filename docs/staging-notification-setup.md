# Staging setup for physical notification tests

## Status — September 7, 2026

The code baseline is master `e30e76036a89c49fd3a27c1bdaff1fa5cd147424`
(merged PRs #4 and #1). This preparation adds explicit native staging inputs
and local configuration checks. **Staging is not deployed and physical push
delivery is not verified.**

Read-only discovery found:

| Dependency | Observed state |
| --- | --- |
| GitHub staging | Exists; no environment secrets; backend deployment and DB migration flags are false. |
| Staging source branch | No remote `dev` branch exists yet. |
| Supabase | The authenticated account lists only `Pantopus-backend`; no project has been designated for staging. |
| Backend host | AWS's configured credentials fail authentication. No staging host is confirmed. |
| Firebase | Google CLI needs interactive reauthentication. The committed Android config is a placeholder. |
| Push server credentials | No APNs/FCM credentials in the active local backend env; no staging runtime env exists. |
| iOS | Paired iPhone 16 Pro is available; a local Apple Development signing identity exists. |
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

## Configure the backend

1. Designate the staging Supabase project and an HTTPS backend host. Restore
   AWS/Google CLI access if those accounts will be used. Keep resource IDs and
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
