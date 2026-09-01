# Mobile observability & analytics vendors (RR-B)

Single record of the third-party telemetry SDKs wired into the **native**
mobile apps (`frontend/apps/ios`, `frontend/apps/android`), the data they
collect, how they're gated, and the App Store / Play Store privacy answers
that follow. Keep this in sync with RR-A's privacy inventory.

> Scope note: this covers the native SwiftUI / Compose apps. The legacy Expo
> app (`frontend/apps/mobile`) is tracked separately in
> `docs/ios-release-plan.md`.

## Vendors

| Concern | Vendor | iOS | Android |
| --- | --- | --- | --- |
| Crash + performance | **Sentry** | `sentry-cocoa` (SPM, `project.yml`) | `sentry-android*` (`libs.versions.toml`) |
| Product analytics | **PostHog** | `posthog-ios` (SPM, `project.yml`) | `posthog-android` (`libs.versions.toml`) |

Both platforms use the **same** vendors and, for analytics, the **same event
names** — the closed `AnalyticsEvent` taxonomy
(`Core/Analytics/Analytics.swift` ↔ `data/analytics/Analytics.kt`).

## Initialization & gating

Everything is gated on a config key so dev / CI builds send **nothing**, and
beta / prod are flipped on with no code change:

| SDK | Key | Empty key behaviour |
| --- | --- | --- |
| Sentry | `SENTRY_DSN` | `Observability.start` skips init |
| PostHog | `POSTHOG_API_KEY` (+ `POSTHOG_HOST`) | vendor not created → analytics no-ops |

- **iOS** init at launch in `App/AppDelegate.swift` →
  `Observability.shared.start(...)` and `Analytics.start(...)`.
- **Android** init at launch in `PantopusApplication.onCreate` →
  `observability.start(this)` and `Analytics.bindVendor(PostHogAnalytics.create(...))`.

Keys resolve from `.env` → `Config/Pantopus.xcconfig` → Info.plist on iOS, and
`.env` → `BuildConfig` on Android. `POSTHOG_HOST` defaults to PostHog **EU
Cloud** (`https://eu.i.posthog.com`); override for US Cloud or self-host.

## Privacy posture

- **No IDFA / advertising identifier** is collected by either SDK as
  configured, so iOS `NSPrivacyTracking` stays **false** and **no App Tracking
  Transparency (ATT) prompt** is required. (If an ad-tracking SDK is ever added,
  ATT + `NSPrivacyTracking=true` become mandatory.)
- **Autocapture is OFF** for PostHog (no screen-view, lifecycle, or
  element-interaction autocapture). Only the explicit, typed `AnalyticsEvent`
  taxonomy reaches the wire.
- **Anonymous by default.** PostHog `personProfiles = identifiedOnly`; a person
  profile is created only when `Analytics.identify(userId)` runs at sign-in,
  using the **app user id only** — never email / name.
- **PII scrubbing** runs before every send. Sentry `beforeSend` /
  `beforeBreadcrumb` scrub events + breadcrumbs; the PostHog vendor scrubs
  event properties (redacts personal keys + email / phone patterns). No card
  data, tokens, or secrets are ever placed in breadcrumbs or event properties.
- Analytics events are also mirrored into **Sentry breadcrumbs** so they appear
  as context on the next crash (parity across iOS + Android).

## App Store privacy labels (iOS)

PostHog + Sentry collect, per Apple's data-type taxonomy:

- **Product Interaction / Usage Data** — screen + CTA events (the
  `AnalyticsEvent` taxonomy). Linked to a pseudonymous user id after sign-in.
- **Crash Data / Diagnostics** — Sentry crash + performance traces.
- **Used for Tracking: NO** (no IDFA, no cross-app/cross-site tracking).

Action for RR-A: this app has no app-level `PrivacyInfo.xcprivacy` yet. Add one
that declares the above collected data types with `NSPrivacyTracking = false`.
(The PostHog and Sentry SDKs ship their own SDK-level privacy manifests.)

## Play Data Safety (Android)

- **App activity → Product interaction / Other actions** — analytics events.
- **App info & performance → Crash logs / Diagnostics** — Sentry.
- Data is encrypted in transit; not used for advertising; tied to a
  pseudonymous user id only after sign-in.

## Release tooling

- iOS dSYM upload to Sentry is wired in `fastlane/Fastfile`
  (`upload_dsyms_to_sentry`, run in the `beta` + `release` lanes via the
  `fastlane-plugin-sentry` plugin). Gated on `SENTRY_AUTH_TOKEN` / `SENTRY_ORG`
  / `SENTRY_PROJECT`; skipped (with a notice) when unset. Bitcode is OFF, so
  gym's local dSYMs are final.

## Verification checklist

- [ ] Set `SENTRY_DSN` (test project) → force a test crash → it appears in the
      Sentry dashboard for the test env.
- [ ] Set `POSTHOG_API_KEY` (test project) → trigger a tracked screen → the
      event lands in PostHog with the expected `screen.*` / `cta.*` name.
- [ ] Confirm an iOS event name and its Android counterpart are identical for
      the same `AnalyticsEvent` case.
- [ ] With both keys empty, confirm no network calls to Sentry / PostHog and no
      ATT prompt.
- [ ] Run a `beta` lane with the Sentry token set → dSYMs upload; without it →
      the step is skipped, not failed.
