# Plan: iOS App Store Launch – Pantopus Mobile

## TL;DR
Pantopus mobile (Expo SDK 54 / React Native 0.81) is ~90% code-complete for iOS release. The app has Apple Sign-In, Stripe payments, content moderation, account deletion, privacy manifests, and legal screens all implemented. What remains is **Apple Developer Portal / App Store Connect configuration**, a handful of **code fixes** (ascAppId placeholder, env vars, Apple secret refactor), **asset verification**, **compliance paperwork** (age rating, privacy questionnaire), and **TestFlight testing**. No new features are required for a minimum viable iOS launch.

---

## Current State Summary

### Already Done (in code)
- Bundle ID `com.pantopus.app` configured
- Apple Sign-In OAuth flow (frontend + backend)
- Stripe payments with Apple Pay merchant ID `merchant.com.pantopus`
- EAS Build profiles (dev / preview / production)
- EAS Submit profile (with placeholder ascAppId)
- Privacy manifests (NSPrivacyAccessedAPITypes)
- ATS strict mode for production
- iOS permission strings (camera, photos, location)
- Account deletion (UI + backend cascade across ~70 tables)
- Content moderation: post reporting, gig reporting, user blocking
- Legal screens: Privacy Policy (`pantopus.com/privacy`), Terms (`pantopus.com/terms`)
- Settings screen with legal links, support email, app version
- Release preflight script (`release-preflight.mjs`)
- Deep link scheme `pantopus://`

### Not Done / Needs Work
- Apple Developer Portal: App ID registration, capabilities
- App Store Connect: App entry, metadata, screenshots, age rating
- Apple Pay merchant ID registration
- EAS environment variables for production builds
- Replace `ascAppId: "0"` placeholder in eas.json
- Refactor `generate-apple-secret.js` to use env vars
- Verify icon is 1024×1024 with no alpha/transparency
- Host `apple-app-site-association` for universal links (optional for MVP)
- Push notifications (not implemented, optional for MVP)
- App Tracking Transparency (not needed unless using tracking/ads)
- Age rating questionnaire in App Store Connect
- App Store privacy questionnaire
- App Store screenshots (6.7" and 6.5" iPhone)
- TestFlight internal/external testing

---

## Steps

### Phase 1: Apple Developer Portal Setup (Manual – apple.developer.com)

1. **Register App ID**
   - Go to Certificates, Identifiers & Profiles → Identifiers → + → App IDs
   - Bundle ID: `com.pantopus.app` (Explicit)
   - Enable capabilities: **Sign In with Apple**, **Apple Pay** (for merchant.com.pantopus)
   - Description: "Pantopus"

2. **Register Apple Pay Merchant ID**
   - Identifiers → Merchant IDs → +
   - Merchant ID: `merchant.com.pantopus`
   - Description: "Pantopus Payments"

3. **Create/Verify Sign In with Apple Service ID** (for web OAuth)
   - Already partially done (CLIENT_ID `com.pantopus.web` in generate-apple-secret.js)
   - Verify the Service ID exists and has the correct return URL configured

4. **Create/Verify Sign In with Apple Key**
   - Already partially done (KEY_ID `9LY66UHH2P` referenced in generate-apple-secret.js)
   - Verify the .p8 key file is backed up securely

### Phase 2: App Store Connect Setup (Manual – appstoreconnect.apple.com)

5. **Create new app in App Store Connect**
   - Platform: iOS
   - Name: "Pantopus"
   - Primary language: English (U.S.)
   - Bundle ID: `com.pantopus.app` (from step 1)
   - SKU: `com.pantopus.app`
   - **Record the numeric Apple ID** (shown in App Information → General → Apple ID)

6. **Fill App Store metadata**
   - Subtitle (30 chars)
   - Category: Lifestyle or Social Networking (primary), Utilities (secondary)
   - Description (up to 4000 chars)
   - Keywords (100 chars max, comma-separated)
   - Support URL: `https://pantopus.com/support` or `mailto:support@pantopus.com`
   - Marketing URL (optional): `https://pantopus.com`
   - Privacy Policy URL: `https://pantopus.com/privacy` (REQUIRED)

7. **Complete Age Rating questionnaire** in App Store Connect
   - Answer content questions (violence, profanity, etc.)
   - Since app has marketplace/payments but likely no mature content, expect 12+ or 17+ rating
   - If app is 17+ adults-only → no special COPPA concerns
   - If allowing under-13 users → need COPPA compliance (not currently implemented)

8. **Complete App Privacy questionnaire** in App Store Connect
   - Declare data collection: location, contacts/identifiers (email, name), usage data, payment info
   - Linked to user identity: yes (authenticated app)
   - Used for tracking: no (no ad tracking implemented)

9. **Prepare App Store screenshots**
   - Required sizes: 6.7" (iPhone 15 Pro Max: 1290×2796) and 6.5" (iPhone 11 Pro Max: 1284×2778)
   - Minimum 3 screenshots, recommend 5-10
   - Can use Simulator + screenshot tool or Expo preview build on device
   - Key screens: Hub, Feed/Posts, Gig marketplace, Chat, Profile, Map view

10. **Prepare App Store icon**
    - Verify `frontend/apps/mobile/assets/icon.png` is exactly 1024×1024 px
    - Must have NO transparency/alpha channel (App Store rejects transparent icons)
    - No rounded corners (iOS adds them automatically)

### Phase 3: Code Changes (Copilot can implement)

11. **Update `eas.json` ascAppId** (*depends on step 5*)
    - File: `frontend/apps/mobile/eas.json`
    - Replace `"ascAppId": "0"` with actual numeric Apple ID from App Store Connect

12. **Set EAS environment variables** via `eas env:create` or Expo dashboard
    - `APP_ENV=production`
    - `EXPO_PUBLIC_API_URL=https://api.pantopus.com`
    - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` (your Stripe live publishable key)
    - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...` (iOS-restricted Google Maps key)
    - `IOS_BUILD_NUMBER=1` (or let autoIncrement handle it)

13. **Refactor `generate-apple-secret.js` to use environment variables**
    - File: `backend/generate-apple-secret.js`
    - Move hardcoded TEAM_ID, KEY_ID, CLIENT_ID to env vars
    - Move .p8 key file path to env var or read from AWS Secrets Manager
    - Ensure the generated secret is stored as env var `APPLE_CLIENT_SECRET` on EC2

14. **Verify backend env vars on EC2** for Apple Sign-In
    - `APPLE_CLIENT_ID` = `com.pantopus.web` (or `com.pantopus.app` for native)
    - `APPLE_CLIENT_SECRET` = generated JWT
    - `APPLE_TEAM_ID` = `6UYZBA546R`
    - Verify these are loaded in `backend/config/auth.js`

15. **Restrict Google Maps API key for iOS** (*parallel with step 12*)
    - In Google Cloud Console → Credentials → API key
    - Add iOS app restriction: bundle ID `com.pantopus.app`
    - Or create a separate iOS-only key

16. **Verify Stripe live mode configuration**
    - Ensure Stripe account is activated (not in test mode) for production
    - Verify webhook endpoint `https://api.pantopus.com/api/webhooks/stripe` is registered in Stripe Dashboard for live mode
    - Register Apple Pay domain in Stripe Dashboard → Settings → Payment Methods → Apple Pay

17. **Verify legal pages are live**
    - Confirm `https://pantopus.com/privacy` returns a valid privacy policy
    - Confirm `https://pantopus.com/terms` returns valid terms of service
    - These are loaded via WebView in the app's legal screens

### Phase 4: Build & Test

18. **Run preflight validation**
    ```
    cd frontend/apps/mobile
    pnpm run preflight:release
    ```
    - Validates bundle ID, Apple Sign-In, ATS, build number, EAS config, TypeScript, dependencies

19. **Build preview IPA for internal testing**
    ```
    pnpm run build:ios:preview
    ```
    - Install on physical device via EAS internal distribution
    - Test all critical flows on real device

20. **Critical test checklist** (manual testing on device):
    - [ ] Apple Sign-In flow end-to-end
    - [ ] Google Sign-In flow
    - [ ] Email registration + verification
    - [ ] Location permissions + map display
    - [ ] Camera + photo library access
    - [ ] Create a gig (task)
    - [ ] Browse/search gigs
    - [ ] Stripe payment flow (Apple Pay + card)
    - [ ] Real-time chat (Socket.IO)
    - [ ] Report a post / report a gig
    - [ ] Account deletion flow
    - [ ] Privacy Policy + Terms links work
    - [ ] Deep link `pantopus://` opens app
    - [ ] App works on airplane mode (graceful degradation)
    - [ ] Light mode + dark mode appearance

21. **Build production IPA**
    ```
    pnpm run build:ios:prod
    ```

22. **Submit to App Store Connect** (*depends on steps 5, 11*)
    ```
    pnpm run submit:ios:prod
    ```
    - This uploads the IPA to App Store Connect

### Phase 5: TestFlight & Submission

23. **TestFlight internal testing**
    - In App Store Connect → TestFlight → Internal Testing
    - Add yourself and team members as internal testers
    - Install via TestFlight app, run through test checklist again
    - Fix any issues found, rebuild if needed

24. **TestFlight external testing** (optional but recommended)
    - Create external testing group
    - Add beta testers (up to 10,000)
    - Requires Beta App Review (usually < 24 hours)
    - Gather feedback, iterate

25. **Submit for App Review**
    - In App Store Connect → App Store → submit for review
    - Provide demo account credentials for reviewer (if login is required)
    - Add review notes explaining app functionality
    - Expected review time: 24-48 hours (first submission may take longer)

26. **Handle review feedback**
    - If rejected: read rejection reason, fix issues, rebuild, resubmit
    - Common rejection reasons for marketplace apps:
      - Missing content moderation ✅ (already implemented)
      - Missing account deletion ✅ (already implemented)
      - Missing privacy policy ✅ (already implemented)
      - Payments must use Apple IAP for digital goods (Pantopus uses Stripe for physical services, which is allowed)

27. **Release to App Store**
    - Choose release method: Manual or Automatic after approval
    - Phased release (recommended): rolls out to 1% → 2% → 5% → 10% → 20% → 50% → 100% over 7 days

---

## Relevant Files

- `frontend/apps/mobile/app.json` — iOS config, bundle ID, plugins, privacy manifests
- `frontend/apps/mobile/app.config.js` — Dynamic config, ATS policy, maps key, build numbers
- `frontend/apps/mobile/eas.json` — EAS build/submit profiles, **ascAppId placeholder to fix**
- `frontend/apps/mobile/.env.example` — Environment variable template
- `frontend/apps/mobile/scripts/release-preflight.mjs` — Production validation script
- `frontend/apps/mobile/assets/icon.png` — App icon (verify 1024×1024, no alpha)
- `backend/generate-apple-secret.js` — Apple Sign-In JWT generator (needs env var refactor)
- `backend/config/auth.js` — Apple OAuth configuration
- `backend/routes/users.js` — Apple Sign-In routes + account deletion endpoint
- `docs/ios-release-guide.md` — Existing release documentation (comprehensive)
- `docs/deployment-checklist.md` — General deployment checklist

---

## Verification

1. `pnpm run preflight:release` passes all checks (from `frontend/apps/mobile/`)
2. Preview build installs and runs on physical iPhone
3. All 15 items in manual test checklist pass
4. Production build uploads to App Store Connect without errors
5. TestFlight build installs and works for internal testers
6. App Store Connect shows no compliance warnings
7. App Review approval received

---

## Decisions

- **Push notifications**: Not blocking for MVP launch. Can be added post-launch via `expo-notifications` + APNs certificate
- **Universal links**: Not blocking for MVP. Custom scheme `pantopus://` handles OAuth callbacks. Universal links (`apple-app-site-association`) can be added later
- **App Tracking Transparency**: Not needed unless you add ad tracking or analytics SDKs that use IDFA
- **Age rating**: Recommend targeting 17+ to avoid COPPA complexity (no age gate currently implemented)
- **In-App Purchases**: Not needed. Pantopus marketplace is for physical services (allowed to use Stripe per App Store guidelines §3.1.3(e))
- **Message-level reporting**: Not blocking but recommended to add before or shortly after launch for App Review compliance with UGC guidelines

## Further Considerations

1. **Stripe vs Apple IAP**: Since Pantopus is a marketplace for physical-world services/tasks, Stripe is permitted under App Store Review Guideline 3.1.3(e) "goods and services consumed outside of the app." Recommend adding a brief note in App Review submission notes explaining this.

2. **Apple Sign-In JWT expiry**: The `generate-apple-secret.js` creates a 180-day token. Set a calendar reminder to regenerate before expiry or automate rotation.

3. **Post-launch priorities**: Push notifications (APNs), universal links, crash reporting (Sentry/Bugsnag), analytics (PostHog/Mixpanel with ATT if needed).
