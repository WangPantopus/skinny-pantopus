# Android Release Readiness Review

**Date:** 2026-03-16
**Reviewer:** Claude (automated review)
**Verdict:** READY for Android release (with minor items to address)

---

## Current Status: What's Already in Place

| Area | Status | Details |
|------|--------|---------|
| Expo/EAS config | ✅ Ready | `app.config.js` sets `com.pantopus.app`, env-driven `ANDROID_VERSION_CODE`, Google Maps key wiring |
| EAS build profiles | ✅ Ready | `eas.json` has development (APK), preview (AAB), production (AAB + autoIncrement) |
| Build/submit scripts | ✅ Ready | `build:android:preview`, `build:android:prod`, `submit:android:prod` in package.json |
| EAS project ID | ✅ Set | `8a19618c-d169-4fae-bc64-5c01623f495e` in app.json |
| Preflight script | ✅ Ready | `scripts/release-preflight.mjs` validates Android package, versionCode, profiles, dependencies, types |
| Adaptive icon | ✅ Ready | `assets/adaptive-icon.png` + white background configured |
| App icon | ✅ Ready | `assets/icon.png` configured |
| API config | ✅ Ready | Production requires HTTPS, proper error if missing `EXPO_PUBLIC_API_URL` |
| Token storage | ✅ Ready | Uses `expo-secure-store` (encrypted on-device storage) |
| Deep linking / OAuth | ✅ Ready | Scheme `pantopus://` configured, OAuth callback uses `pantopus://auth/callback` |
| Signing | ✅ Ready | EAS-managed (no local keystore needed) |
| CI smoke test | ✅ Ready | `expo export --platform android` runs in GitHub Actions |
| Release docs | ✅ Ready | `docs/android-release-guide.md`, `README.release.md`, `docs/maps-key-restrictions.md` |

---

## Issues Found

### Issue 1: Splash screen uses icon.png instead of dedicated splash-icon.png (LOW)

**File:** `frontend/apps/mobile/app.json` line 11

```json
"splash": {
  "image": "./assets/icon.png",   // <-- uses app icon
  "resizeMode": "contain",
  "backgroundColor": "#FFFFFF"
}
```

A dedicated `assets/splash-icon.png` (18KB, optimized) exists but is unused. The app icon (140KB) is used instead. This works but may not display optimally on all Android screen sizes.

**Recommendation:** Update splash image to `./assets/splash-icon.png` for a cleaner launch experience.

### Issue 2: Incomplete listing creation refactoring (MEDIUM)

**File:** `frontend/apps/mobile/src/app/(tabs)/marketplace.tsx` line 206

```jsx
{/* TODO: Remove CreateListingSheet after full-screen flow is stable */}
```

Two listing creation flows coexist (legacy bottom sheet + new full-screen flow). This increases bundle size and could cause user confusion.

**Recommendation:** Stabilize the full-screen flow and remove the legacy sheet before production release, or confirm both flows work correctly and defer cleanup.

### Issue 3: Limited test coverage (MEDIUM)

Only 4 test files exist for ~50+ feature files:
- `components/chat/__tests__/MessageActionSheet.test.tsx`
- `hooks/__tests__/useGigsData.test.ts`
- `hooks/__tests__/useFeedData.test.ts`
- `hooks/__tests__/useFeedData.compose.test.ts`

**Recommendation:** Run existing tests before release. Consider adding tests for critical Android paths (auth flow, payment, location permissions).

### Issue 4: CI type-check is non-blocking (LOW)

**File:** `.github/workflows/ci.yml` line 88

```yaml
- name: Type-check mobile
  run: pnpm --filter pantopus-mobile exec tsc --noEmit
  continue-on-error: true    # <-- TS errors won't block builds
```

TypeScript errors won't prevent merging to main. This means type regressions could slip into production builds.

**Recommendation:** Address existing TS debt and make type-check blocking before production release.

---

## Pre-Release Checklist (External Setup Required)

These items require manual setup outside the codebase:

- [ ] **Google Play Developer account** — $25 one-time registration
- [ ] **Create app in Play Console** — Package name must be `com.pantopus.app`
- [ ] **Complete store listing** — Description, screenshots, feature graphic, privacy policy URL
- [ ] **Content rating** — Complete the questionnaire
- [ ] **Data safety declaration** — Declare data collection practices
- [ ] **Google Play service account** — For automated EAS submit (see `docs/android-release-guide.md` Phase A3)
- [ ] **EAS environment variables** for production:
  - `APP_ENV=production`
  - `EXPO_PUBLIC_API_URL=https://api.pantopus.com`
  - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
  - `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<restricted key>`
- [ ] **Google Maps key restriction** — Restrict to `com.pantopus.app` + SHA-1 fingerprints (after first build)
- [ ] **Run preflight** — `pnpm --filter pantopus-mobile run preflight:release`
- [ ] **Run tests** — `pnpm --filter pantopus-mobile test`

---

## Conclusion

The repository is **well-prepared for Android release**. The EAS build pipeline, signing management, environment variable handling, and production validation are all properly configured. The existing `docs/android-release-guide.md` provides a comprehensive step-by-step walkthrough.

The main blockers are external setup (Google Play Console, service account, API key restrictions) rather than code issues. The minor code items (splash image, listing flow TODO, test coverage) are non-critical for an initial internal testing release.
