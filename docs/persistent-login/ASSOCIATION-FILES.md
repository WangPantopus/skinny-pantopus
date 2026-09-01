# OS association files for the native apps (AASA + assetlinks.json)

Part of the persistent-login work (design §11 / Phase 0). These two files are
served by the web app from `frontend/apps/web/public/.well-known/` on
`https://pantopus.com` **and** `https://www.pantopus.com` (both apex and www,
`Content-Type: application/json` forced in `next.config.js`, no redirects).

They gate four things the design depends on:

| File | Enables | Needed by |
|---|---|---|
| `apple-app-site-association` → `applinks` | Universal Links (`https://pantopus.com/…` opens the app) | invite / verify-email / reset-password / security-email deep links |
| `apple-app-site-association` → `webcredentials` | Password AutoFill for `pantopus.com` saved passwords, passkeys, shared web credentials | L3 "the phone remembers my account" on iOS |
| `assetlinks.json` → `common.handle_all_urls` | Android App Links (`autoVerify`) | same deep links on Android |
| `assetlinks.json` → `common.get_login_creds` | Credential Manager: saved passwords / passkeys / Sign in with Google for the app are shared with the site | L3 on Android (Phase 3) |

## Current state (2026-08-18)

- **iOS — done.** `6UYZBA546R.app.pantopus.ios` was added to `applinks.details`
  (same paths as the legacy entry) and to `webcredentials.apps`. The legacy Expo
  entry `6UYZBA546R.com.pantopus.app` is kept until that app is retired.
  ⚠️ The Team ID `6UYZBA546R` is inherited from the Expo app; the native
  project's `DEVELOPMENT_TEAM` is intentionally blank in
  `frontend/apps/ios/project.yml`. **Confirm the native app is signed by the
  same team** (Xcode → Signing & Capabilities → Team, or
  `security find-identity -v -p codesigning`). If it is a different team, rerun
  the generator with the right `APPLE_TEAM_ID`.
- **Android — NOT done, on purpose.** The `app.pantopus.android` statement
  needs the SHA-256 fingerprint(s) of the certificate(s) that sign the APK the
  user actually installs. Those are **not in the repo**: the release keystore is
  a CI secret (`ANDROID_KEYSTORE_BASE64` in `.github/workflows/android-beta.yml`)
  and, with Play App Signing, Google re-signs the app with a key only visible in
  Play Console. Writing a guessed fingerprint would silently break App Link
  verification, so nothing was added. The legacy `com.pantopus.app` statement is
  kept.

## What values are needed

| Variable | Where to get it |
|---|---|
| `APPLE_TEAM_ID` | Apple Developer → Membership → Team ID; must equal the team that signs `app.pantopus.ios` |
| `IOS_BUNDLE_ID` | `app.pantopus.ios` (default) |
| `ANDROID_PACKAGE` | `app.pantopus.android` (default; `applicationId` in `frontend/apps/android/app/build.gradle.kts`) |
| `ANDROID_SHA256_FINGERPRINTS` | Comma-separated. Include **all** of: |
| | 1. **Play App Signing certificate** — Play Console → *Setup* → *App signing* → "App signing key certificate" → SHA-256. This is what production/internal-testing installs from Play are signed with. |
| | 2. **Upload certificate** — same page, "Upload key certificate" → SHA-256, or locally: `keytool -list -v -keystore pantopus-release.jks -alias "$PANTOPUS_KEY_ALIAS"` (needs the CI keystore secrets). Needed for APKs installed directly from CI artifacts. |
| | 3. *(debug builds only, never in production)* the debug keystore: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`. Note debug builds use `applicationIdSuffix ".debug"` → package `app.pantopus.android.debug`; add a separate statement for it if you need App Links on debug builds. |

Play Console also shows the exact JSON it expects under *Grow* → *Deep links*
(or *Setup* → *App signing* → "Digital Asset Links JSON snippet"). Copy the
fingerprint from there rather than retyping it.

## Regenerate

```bash
# from the repo root; node >= 18, no deps
APPLE_TEAM_ID=6UYZBA546R \
ANDROID_SHA256_FINGERPRINTS="<play-app-signing-sha256>,<upload-key-sha256>" \
node tools/gen-association-files.mjs

# CI / pre-commit style guard: exit 1 if the files would change
APPLE_TEAM_ID=6UYZBA546R ANDROID_SHA256_FINGERPRINTS=… node tools/gen-association-files.mjs --check
```

The script upserts only the native entries and preserves everything else
(legacy Expo entries, hand-added statements). It validates the Team ID shape and
each fingerprint (32 bytes, normalised to `AA:BB:…`), and refuses to run when it
has nothing to write. Optional: `AASA_PATHS="/a/*,/b"` to override the applinks
path list (default = copy of the legacy entry's paths); `WELL_KNOWN_DIR` to write
elsewhere (used by the tests/scratch runs).

## Verify after deploy

**Apple (AASA)**
1. Both `https://pantopus.com/.well-known/apple-app-site-association` and
   `https://www.pantopus.com/.well-known/apple-app-site-association` return
   200, `application/json`, no redirect, < 128 KB:
   `curl -sI https://pantopus.com/.well-known/apple-app-site-association`.
2. Apple's CDN copy (what devices actually fetch; can lag up to ~24 h after
   deploy — Apple caches it):
   `curl -s https://app-site-association.cdn-apple.com/a/v1/pantopus.com | jq .`
   Look for `6UYZBA546R.app.pantopus.ios` in `applinks.details[].appID` **and**
   `webcredentials.apps`.
3. On a device with the TestFlight build: Settings → Developer → *Universal
   Links* → *Diagnostics* → enter `https://pantopus.com/join/abc` → should say
   "Opens in app: Pantopus". For AutoFill: on the login screen the QuickType bar
   should offer the saved `pantopus.com` password once the entitlement
   `webcredentials:pantopus.com` ships (iOS agent's change to
   `Pantopus.entitlements` + `project.yml`).
4. Alternative-mode debugging: `swcutil dl -d pantopus.com` (macOS) or, on the
   Mac, `sudo swcutil verify -d pantopus.com -j /path/to/apple-app-site-association`.

**Android (assetlinks.json)**
1. Same hosting checks for `https://pantopus.com/.well-known/assetlinks.json`
   (both hosts, 200, `application/json`, no redirect).
2. Google's statement-list tester (checks the JSON, the fingerprint and the
   relation for a given package):
   `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://pantopus.com&relation=delegate_permission/common.handle_all_urls`
   — the response must list a statement with `target.androidApp.packageName ==
   "app.pantopus.android"` and the certificate SHA-256 you expect. Repeat with
   `relation=delegate_permission/common.get_login_creds`.
3. On a device with the Play build installed:
   `adb shell pm get-app-links app.pantopus.android` → `pantopus.com: verified`
   (`adb shell pm verify-app-links --re-verify app.pantopus.android` to force a
   re-check). If it says `legacy_failure`/`1024`, the fingerprint does not match
   the installed APK's signer: `keytool -printcert -jarfile app.apk`.
4. Play Console → *Grow* → *Deep links* shows per-domain verification status
   once the release is rolled out.

## What is NOT in this layer

- **`AndroidManifest.xml` `asset_statements` meta-data** — required for
  Credential Manager to trust the site ↔ app link
  (`<meta-data android:name="asset_statements" android:resource="@string/asset_statements"/>`
  pointing at `https://pantopus.com/.well-known/assetlinks.json`). It lands with
  the Credential Manager work (Phase 3, Android agent); the manifest is owned by
  the Android layer, not the web/docs layer.
- **iOS entitlements** (`webcredentials:pantopus.com` etc.) — iOS layer
  (`Pantopus.entitlements` **and** `project.yml`, because `make bootstrap`
  regenerates the entitlements from `project.yml`).
- Removing the legacy Expo identifiers — only after that app is unpublished.

## Change control

Any change to signing (new upload key, key rotation in Play Console, new Team
ID) must be followed by rerunning the generator and redeploying the web app;
add a note to `docs/release/readiness-report.md` §deep-links. Until the Android
statement exists, `autoVerify` App Links silently fall back to the browser and
Credential Manager will not offer saved credentials to the app.
