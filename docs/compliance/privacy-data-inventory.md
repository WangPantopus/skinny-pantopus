# Pantopus — Privacy Data Inventory

**Status:** Pre-launch (Bucket 2, Block RR-A)
**Last reviewed:** 2026-06-05
**Owner:** Mobile / Compliance

This is the single source of truth for **what personal data the Pantopus
mobile apps collect, why, and where it goes.** It is derived from a direct
read of the iOS (`frontend/apps/ios`) and Android (`frontend/apps/android`)
code — not a guess — and it feeds three downstream artifacts that must stay
consistent with it:

| Output | File | Surface |
|--------|------|---------|
| iOS privacy **manifest** | `frontend/apps/ios/Pantopus/PrivacyInfo.xcprivacy` | Bundled in the `.app`; read by App Store static analysis |
| App Store privacy **labels** ("nutrition labels") | `docs/compliance/appstore-privacy-labels.md` | App Store Connect → App Privacy |
| Google Play **Data safety** form | `docs/compliance/play-data-safety.md` | Play Console → App content → Data safety |

> **Cross-platform note.** Both apps talk to the same backend
> (`api.pantopus.app`) and collect the same product data, so the data
> *categories* are shared. Platform-specific mechanics (APNs vs FCM tokens,
> required-reason APIs, SDK lists) are called out inline.

---

## 1. How data leaves the device

All first-party data egress flows through a small number of chokepoints:

| Chokepoint | iOS | Android | Notes |
|------------|-----|---------|-------|
| REST API | `Core/Networking/APIClient.swift` | `data/api/**` (Retrofit) | JSON over TLS to `https://api.pantopus.app`. Bearer token from secure storage. |
| File upload | `Core/Networking/MultipartUploader.swift` → `POST /api/files/upload` | mirror | Photos / documents as `multipart/form-data`. |
| Realtime | `Core/Realtime` (Socket.IO) | Socket.IO | Chat messages, presence. |
| Payments | Stripe `PaymentSheet` (`Core/Payments`) | Stripe Android SDK | Card data goes **device → Stripe**, never through our servers. |
| Crash / perf | Sentry (`Core/Observability/Observability.swift`) | `sentry-android` | PII-scrubbed before send; `sendDefaultPii = false`. |
| Push register | APNs token → `POST /api/notifications/register` (`App/AppDelegate.swift`) | FCM token → same endpoint (`push/PantopusMessagingService`) | Device token + `platform`. |

**No advertising / cross-app tracking.** Neither app links AdSupport /
`ASIdentifierManager`, requests App Tracking Transparency, embeds an ad SDK,
or shares data with data brokers. → **iOS `NSPrivacyTracking = false`;**
Play "Data shared with third parties for advertising" = **No**.

---

## 2. Collected-data inventory

Legend — **Linked** = tied to the user's identity. **Tracking** = used to
track across apps/sites owned by other companies (always *No* here).
**Purpose** maps to Apple's purpose vocabulary (App Functionality / Analytics).

### 2.1 Contact Info — *App Functionality, Linked, not Tracking*

| Field | Evidence | Sent to |
|-------|----------|---------|
| Email address | `RegisterRequest.email`, `LoginRequest.email`, forgot/verify flows (`Core/Networking/Models/Auth/AuthDTOs.swift`); `AuthManager.signUp/signIn` | Backend; Sentry user context (`Observability.identify(userId:email:)`) |
| Name (first / middle / last, username, display name) | `RegisterRequest.firstName/middleName/lastName/username`, `AuthenticatedUser.name` | Backend |
| Phone number | `RegisterRequest.phoneNumber` | Backend |
| Physical address (street, city, state, zip) | `RegisterRequest.address/city/state/zipcode`; Homes features (address verification, property details) | Backend |

### 2.2 Other Data — *App Functionality, Linked, not Tracking*

| Field | Evidence | Sent to |
|-------|----------|---------|
| Date of birth | `RegisterRequest.dateOfBirth` (`AuthManager.signUp`) | Backend |

> Apple has no dedicated "date of birth" data type → mapped to **Other Data
> Types**. Play → **"Other info"** under Personal info (age/DOB is not its
> own Play type either).

### 2.3 Financial Info — *App Functionality, Linked, not Tracking*

| Field | Evidence | Sent to |
|-------|----------|---------|
| Payment card info | Stripe `PaymentSheet` (`Core/Payments/PaymentSheetPresenter.swift`, `StripeBootstrap.swift`). Server mints the intent + ephemeral key; the SDK collects the card. | **Stripe** (the app never sees the PAN) |

> We deliberately never build a card form and never store raw card data
> (`PaymentSheetPresenter` doc-comment). Card data is collected by Stripe on
> our behalf — still declarable as **Payment Info** on both stores.

### 2.4 Location — *App Functionality, Linked, not Tracking*

| Field | Evidence | Sent to |
|-------|----------|---------|
| Coarse / precise location | Maps + "near you" surfaces (Nearby, Explore, Gigs/Tasks map, Mailbox map). iOS purpose strings `NSLocationWhenInUseUsageDescription` / `…AlwaysAndWhenInUse…` in `project.yml`. Android `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` in `AndroidManifest.xml`. | Backend (lat/lng query params on nearby/gig reads) |

> ⚠️ **iOS implementation-status finding (not a fabrication).** On iOS the
> live `CLLocationManager` provider is **not yet wired** —
> `Core/Location/LocationProvider.swift` ships a `FallbackLocationProvider`
> that returns a hardcoded coordinate, and no `CLLocationManager` symbol is
> referenced anywhere in the app. The location **permission strings already
> ship** in `project.yml`, the map/Nearby features are built around device
> location, and **Android already collects real device location**, so
> location is **forward-declared** in the iOS manifest + labels for GA. This
> is the App-Review-safe direction (over-declaring is permitted;
> under-declaring is the rejection risk). **Action for the GA build:** confirm
> the real location provider is wired *or* drop the iOS location entries +
> purpose strings before submission so the manifest matches the binary.

### 2.5 User Content — *App Functionality, Linked, not Tracking*

| Field | Evidence | Apple type |
|-------|----------|-----------|
| Photos / videos | Camera + photo library (profile photos, listing images, mail capture). iOS `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`; Android `CAMERA` / `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`. Upload via `MultipartUploader`. | Photos or Videos |
| Audio (voice messages) | Chat voice messages. iOS `NSMicrophoneUsageDescription`; Android — recorded in-chat. | Audio Data |
| Messages (direct / chat) | `Features/Chat`, Socket.IO realtime + `ChatEndpoints` | Emails or Text Messages |
| Other user content (posts, gigs, listings, reviews, documents, profile bio, polls, home records) | Compose flows (`Features/Compose/**`), Homes documents (`UploadDocumentFormViewModel`), posts/listings/gigs/reviews endpoints | Other User Content |

### 2.6 Identifiers — *App Functionality, Linked, not Tracking*

| Field | Evidence | Apple type |
|-------|----------|-----------|
| User / account ID | `AuthenticatedUser.id`, persisted to Keychain (`SecureStoreKey.userId`), set on Sentry scope | User ID |
| Push device token | APNs token (`AppDelegate.didRegisterForRemoteNotifications…`) / FCM token (Android `PantopusMessagingService`) → `registerPushToken(_:platform:)` | Device ID |

### 2.7 Diagnostics — *App Functionality, Linked, not Tracking*

| Field | Evidence | Apple type |
|-------|----------|-----------|
| Crash data | Sentry (`Observability.capture`, `SentrySDK.start`) | Crash Data |
| Performance data | Sentry `enableAutoPerformanceTracing`, `enableNetworkTracking` | Performance Data |

> **Linked = Yes** because `Observability.identify(userId:email:)` attaches
> the user id (and email) to the Sentry scope. Mitigations: `sendDefaultPii =
> false`, `attachScreenshot/attachViewHierarchy = false`, and an explicit PII
> scrubber (`Observability.scrubPII`) redacts email/phone/address/name/secret
> keys and email/phone-shaped strings from `extra`, breadcrumb `data`, and
> breadcrumb messages before send.

### 2.8 Usage Data — *Analytics, Linked, not Tracking*

| Field | Evidence | Apple type |
|-------|----------|-----------|
| Product interaction (screen views, CTA taps) | Typed taxonomy `Core/Analytics/Analytics.swift` → `Observability.track` (Sentry breadcrumbs today; vendor SDK later). Event names + flat string props only (no free-form PII). | Product Interaction |

---

## 3. Required-reason API audit (iOS — Apple "privacy-impacting" APIs)

Apple requires a declared reason for five API categories. Scanned the **app's
own** Swift (`frontend/apps/ios/Pantopus`); third-party SDKs declare their own
manifests and are **out of scope** for this file.

| Apple category | Used by app code? | Evidence | Reason code in manifest |
|----------------|-------------------|----------|-------------------------|
| **UserDefaults** (`NSPrivacyAccessedAPICategoryUserDefaults`) | **Yes** | Hub banner-dismissed flag (`Features/Hub/HubViewModel.swift`); per-surface search recents (`Features/Shared/SearchList/SearchListState.swift`, `RecentQueriesStore`) | **`CA92.1`** — read/write info accessible only to the app itself |
| File timestamp (`…FileTimestamp`) | **No** | The only `FileManager.attributesOfItem(atPath:)` call (`Features/Homes/Documents/UploadDocumentFormViewModel.swift:286`) reads **`.size` only** — no `.modificationDate`/`.creationDate`/`stat` timestamp symbol is referenced. Not triggered. | — |
| System boot time (`…SystemBootTime`) | **No** | No `systemUptime` / `mach_absolute_time` / boot-time API in app code. | — |
| Disk space (`…DiskSpace`) | **No** | No `volumeAvailableCapacity` / `systemFreeSize` / `statfs`. (`.size` of a single picked file is not the disk-space category.) | — |
| Active keyboards (`…ActiveKeyboards`) | **No** | No `activeInputModes`. | — |

→ iOS manifest `NSPrivacyAccessedAPITypes` = **UserDefaults `CA92.1`** only.

> Sentry and Stripe **do** use file-timestamp / boot-time / disk-space /
> UserDefaults APIs, but they ship their own `PrivacyInfo.xcprivacy` inside
> their SPM packages, which Apple aggregates automatically. Do not restate
> them in the app manifest.

---

## 4. Third-party SDKs (data processors)

| SDK | iOS | Android | Data handled | Ships own privacy manifest |
|-----|-----|---------|--------------|----------------------------|
| Stripe | `StripePaymentSheet`, `StripeApplePay` (`project.yml`) | `com.stripe:stripe-android` | Payment card info | Yes |
| Sentry | `sentry-cocoa` | `sentry-android` (+ timber, okhttp) | Crash, performance, user id/email | Yes |
| Firebase Cloud Messaging | — | `firebase-messaging` (BoM) | FCM registration token, Firebase installation id | Yes (Google) |
| Socket.IO | `socket.io-client-swift` | `socket.io` | Message transport | n/a (transport) |
| Google Maps | Apple MapKit (no key) | `com.google.android.geo` maps SDK | Map tiles; approximate location on Android | Yes (Google) |
| KeychainAccess / EncryptedSharedPreferences | Keychain | encrypted token store | Local secure token storage (not "collected") | n/a |

---

## 5. Retention & deletion

- **Account deletion** is implemented in-app (Settings → account deletion),
  which removes the server-side account and associated personal data —
  satisfies App Store Guideline 5.1.1(v) and Play's account-deletion
  requirement.
- **Local secure storage:** access/refresh tokens + user id in the iOS
  Keychain (`KeychainStore`, `afterFirstUnlockThisDeviceOnly`,
  `synchronizable = false`) / Android encrypted store; cleared on sign-out
  (`AuthManager.signOut`).

---

## 6. Change control

When any of the following changes, update **this file first**, then
regenerate the three outputs and re-verify they agree:

- A new field is added to `RegisterRequest` / profile DTOs.
- A new permission string (Info.plist) or `uses-permission` (manifest).
- A new SDK that collects data, or a new analytics vendor.
- A new first-party use of a required-reason API.

Consistency check (manifest ↔ labels ↔ this inventory) is documented at the
bottom of `appstore-privacy-labels.md` and `play-data-safety.md`.
