# Pantopus — Privacy Data Inventory

**Status:** Pre-launch (Bucket 2, Block RR-A)
**Last reviewed:** 2026-08-18 (persistent login & trusted devices — new identifiers, see §2.6, §2.9, §5)
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
| Push register | APNs token → `POST /api/notifications/register` (`App/AppDelegate.swift`) | FCM token → same endpoint (`push/PantopusMessagingService`) | Device token + `platform` (+ `deviceId` since 2026-08, so the token can be deleted when the device is removed). |
| Device registry (persistent login, 2026-08) | `Core/Auth/DeviceDescriptor.swift`, `AuthManager+Devices.swift` → `device` object on `/api/users/login`, `/oauth/*`, `POST /api/auth/devices/register`; `X-Device-Id` + `DPoP` headers (`Core/Networking/APIClient.swift`) | `data/auth/DeviceDescriptorProvider.kt`, `DeviceIdentity.kt`, `AuthInterceptor.kt` → same endpoints + `POST /api/auth/resume` | Client-generated device id, install id, device **public** key (JWK), device name/model/OS/app version, key backing (`secure_enclave` / `strongbox` / `tee` / `software`), has-OS-lock flag. Private keys never leave the device. |

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
| **Device ID** (client UUIDv4, generated once per hardware key) — *new 2026-08* | iOS `SecureStoreKey.deviceId` (Keychain, `afterFirstUnlockThisDeviceOnly`, non-sync; survives reinstall) / Android `device_identity` prefs `device_id` (backup-excluded; dies with uninstall). Sent as `device.deviceId` at login/OAuth/resume/register and as `X-Device-Id` on every request; stored server-side in `AuthDevice.device_id`. Purpose: bind the session to *this* device, show it in "Where you're logged in", let the user revoke it. | Device ID |
| **Install ID** (random per install; rotates on reinstall) — *new 2026-08* | iOS `Library/Application Support/.pantopus-install` (excluded from backup) + Keychain mirror `installId`; Android `device_identity` prefs `install_id`. Sent in the `device` descriptor; stored in `AuthDevice.install_id`. Purpose: detect reinstall (one-gesture "Continue as X" instead of silent restore) and dedupe new-device emails. | Device ID |
| **Device public key** (P-256 JWK + RFC 7638 thumbprint) — *new 2026-08* | Secure Enclave / Android Keystore key created by `DeviceKey.swift` / `DeviceKeyStore.kt`; only the **public** half is sent (embedded in the `DPoP` proof) and stored in `AuthDevice.public_key_jwk` / `key_thumbprint`. Optional biometry-bound step-up public key → `AuthDevice.step_key_jwk` (`POST /api/auth/step-up-key`). Not personal data on its own; declared under Device ID because it is a stable per-device identifier. | Device ID |
| **Session ID** (Supabase JWT `session_id`) — *new 2026-08* | Returned as `sessionId` by login/refresh; persisted next to the tokens (Keychain `sessionId`, Android `session_id`); server row `AuthSession`. | User ID (session of the account) |
| Device metadata (name, model, OS version, app version, key backing, has-OS-lock) — *new 2026-08* | `DeviceDescriptor` / `DeviceDescriptorProvider`; server `AuthDevice.name/model/os_version/app_version/key_backing`. Shown back to the user in Settings → Security. | (Device ID row — descriptive attributes of the same record) |

> **App Store label:** Device ID stays **App Functionality** (Apple's
> definition of App Functionality explicitly covers "authenticate the user…
> prevent fraud, implement security measures"). **Play:** *Device or other IDs*
> with purposes **App functionality** + **Fraud prevention, security, and
> compliance**. Both already say *Linked = Yes, Tracking = No* — the device id
> is a first-party, per-app identifier (not IDFA/AAID) and is never shared.

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

### 2.9 Security & session records — *App Functionality (security), Linked, not Tracking* — *new 2026-08*

Server-side records created by the persistent-login layer
(`backend/database/migrations/160_auth_devices.sql`; design
`docs/persistent-login/persistent-login-design-2026-08-18.md` §5). Nothing
here is collected by an SDK — it is derived from the request itself.

| Field | Where | Why | Apple type / Play type |
|-------|-------|-----|------------------------|
| IP address + User-Agent per session / device (`AuthSession.last_ip`, `user_agent`; `AuthDevice.last_ip`, `last_user_agent`) | request metadata on login / refresh / register | show "last active · IP" in *Where you're logged in*, detect anomalies | Apple: **Other Data Types** (security-log metadata; ¹) · Play: **Device or other IDs** (purpose *Fraud prevention, security, and compliance*) |
| Security events (`AuthSecurityEvent`: type, timestamp, device, session, IP, UA, small `meta` JSON — e.g. `login`, `logout`, `refresh_reuse`, `device_revoked`, `revoke_all`, `password_changed`, `step_up`) | written by `backend/services/authSessionService.js` / `authDeviceService.js` | user-visible security activity (`GET /api/auth/security-events`, Settings → Security on web/iOS/Android) + new-device / device-removed emails | same as above |
| Trust level / attestation summary (`AuthDevice.trust_level`, `attestation`, `attestation_level` — stays `none` in v1) | server | grade how much to trust a device (grants, inactivity window) | (attribute of the Device ID record) |
| Security preferences (`User.security_prefs = {allowRestoreGrants, newDeviceEmail}`) | server; edited via `PATCH /api/auth/security-prefs` (step-up gated) | user choice | — (settings, not personal data) |
| Android resume grant (`AuthResumeGrant.grant_hash` = sha256 of a 32-byte random grant; 90 d; single-use) | server stores the **hash only**; the grant itself lives in the device's Block Store item | one-tap "Continue as X" after reinstall | — (credential, not personal data) |
| DPoP `jti` / step-up challenges (`AuthDpopJti`, `AuthChallenge`) | server, 10-min TTL | replay protection | — |

¹ Apple has no dedicated "IP address" type. Because IP + UA are recorded on
every authenticated session (not "infrequent"), we do **not** rely on the
optional-disclosure exemption; they are covered by the already-declared
**Other Data Types** row (see `appstore-privacy-labels.md`). Compliance owner
to confirm the wording at submission time.

**Local-only items (stored on the device, never uploaded — listed for the
Keychain/Keystore review, not for the labels):**

| Item | iOS | Android | Notes |
|------|-----|---------|-------|
| Device private key (DPoP) | Secure Enclave, blob in Keychain `deviceKey` (`afterFirstUnlockThisDeviceOnly`, `synchronizable=false`, **no** biometry gate — background refresh must work); software P-256 fallback on Simulator / no-SE hardware | Android Keystore alias `pantopus_device_key` (StrongBox when available; dies with uninstall) | non-exportable |
| Step-up private key (biometry-bound) | Secure Enclave, `SecAccessControl(.privateKeyUsage \| .biometryCurrentSet)` (passcode-fallback key `.userPresence`), Keychain `stepUpKey` | Keystore `pantopus_stepup_key`, `setUserAuthenticationRequired(true)`, `setInvalidatedByBiometricEnrollment(true)`, signed through `BiometricPrompt` `CryptoObject` | non-exportable; invalidated when biometrics are re-enrolled |
| Account hints (display-only: `userId`, `displayName`, `avatarUrl`, `maskedEmail`, `lastMethod`, `lastSeenAt`; most-recent-first, max 3) | Keychain `accountHints` (JSON, non-sync) | inside the Block Store item | pre-fill "Continue as X"; **kept** after ordinary sign-out (non-secret), **wiped** on "Not you? Remove", account deletion, and security sign-out where required |
| Block Store item `pantopus.account_hint` (`{ v:1, accounts:[…], resumeGrant?, grantUserId?, issuedAt }`) | — | Google Play services Block Store, `setShouldBackupToCloud(false)` → same-device + device-to-device transfer only, **no cloud copy**; `deleteBytes` on remove / account deletion; no-op without GMS | ≤ 4 KB; the only place the resume grant lives |
| Install marker | `Library/Application Support/.pantopus-install` (`isExcludedFromBackup = true`) + Keychain `installId` | `device_identity` prefs `install_id` | random; not personal |
| `expiresAt`, `sessionId`, `sessionContext` | Keychain | `TokenStorage` (`expires_at`, `session_id`, `session_context`) | session bookkeeping next to the tokens |
| App-lock preference `appLockEnabled.<uid>` | Keychain (migrated from UserDefaults so it survives reinstall) | encrypted prefs | user setting |

> **Android backup rules — action for the Android layer:** `res/xml/backup_rules.xml`
> and `data_extraction_rules.xml` must exclude `sharedpref/device_identity.xml`
> in addition to `secure_auth_tokens.xml` (`allowBackup=false` already
> covers Auto Backup; the explicit exclusion covers device-to-device transfer).
> Verify before the Phase-1 store submission.

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

> **2026-08 re-check (persistent login).** The new auth code uses
> `LocalAuthentication` (`LAContext.evaluatePolicy`), `CryptoKit`
> `SecureEnclave.P256`, Keychain (`SecAccessControl`), and writes one marker
> file under `Library/Application Support` with `isExcludedFromBackup` — none
> of these is a required-reason API category. `InstallMarker` reads/writes
> file *contents* only (no `modificationDate` / `creationDate`). The app-lock
> preference migration reads `UserDefaults` — already covered by `CA92.1`.
> **No manifest change required** for the required-reason section; the
> collected-data section already lists `DeviceID` (App Functionality), which
> now also covers the device / install id (§2.6).

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
| Google Play services **Block Store** (`play-services-auth-blockstore`) — *2026-08* | — | `data/auth/AccountHintStore.kt` | Stores the account hint + single-use resume grant **on the device only** (`setShouldBackupToCloud(false)`); Google does not receive the bytes in a readable form and no cloud copy is made. Not "collected" by us; not "shared". | Yes (Google) |
| Apple `LocalAuthentication` / `CryptoKit` Secure Enclave; Android `BiometricPrompt` / Keystore — *2026-08* | system frameworks | system frameworks | Biometric / passcode presence check and hardware-backed keys. **Biometric templates never leave the OS**; the app only receives a yes/no and a signature. | n/a (OS) |

---

## 5. Retention & deletion

- **Account deletion** is implemented in-app (Settings → account deletion),
  which removes the server-side account and associated personal data —
  satisfies App Store Guideline 5.1.1(v) and Play's account-deletion
  requirement. *2026-08:* deletion now requires a step-up (`X-Step-Up`,
  purpose `delete_account`); before `admin.deleteUser` the backend revokes
  every session and deletes the user's `PushToken` rows; `AuthDevice`,
  `AuthSession`, `AuthResumeGrant`, `AuthSecurityEvent` rows are
  `ON DELETE CASCADE` from `auth.users`. The clients wipe Keychain /
  `TokenStorage` **including** the account hints and install marker, and
  Android calls Block Store `deleteBytes` + `clearCredentialState`.
- **Server-side session / security records (2026-08):** `AuthSecurityEvent`
  180 days; revoked `AuthSession` / `AuthDevice` rows 90 days after
  revocation; `AuthResumeGrant` 90 days (single-use); `AuthDpopJti` /
  `AuthChallenge` 10 minutes (pruned by the existing jobs runner).
- **Local secure storage:** access/refresh tokens + user id + (2026-08)
  `expiresAt`, `sessionId`, `sessionContext`, `deviceId`, `deviceKey`,
  `stepUpKey`, `installId`, `accountHints`, `appLockEnabled.<uid>` in the iOS
  Keychain (`KeychainStore`, `afterFirstUnlockThisDeviceOnly`,
  `synchronizable = false`) / Android encrypted store + `device_identity`
  prefs + Block Store item. On **ordinary sign-out** the tokens, `expiresAt`
  and `sessionId` are cleared and `POST /api/users/logout` revokes the
  session server-side; the device key, install marker and the *non-secret*
  account hints are **kept** so the login screen can offer "Continue as X".
  "Not you? Remove" (and account deletion) wipes the hints too. On iOS the
  Keychain items intentionally **survive uninstall** (the reinstall path
  requires the OS lock — design §2 principle 1); on Android nothing in app
  storage survives uninstall and the Block Store item is same-device only.

---

## 6. Change control

When any of the following changes, update **this file first**, then
regenerate the three outputs and re-verify they agree:

- A new field is added to `RegisterRequest` / profile DTOs.
- A new permission string (Info.plist) or `uses-permission` (manifest).
- A new SDK that collects data, or a new analytics vendor.
- A new first-party use of a required-reason API.
- A new identifier or device/session record (e.g. the 2026-08 device id /
  install id / device public key / security events — §2.6, §2.9), a new
  Keychain / Keystore / Block Store item, or a change to backup / sync flags
  (`synchronizable`, `setShouldBackupToCloud`, backup rules). The design's
  Phase-4 "iCloud-synced display hint" is **not** approved by this inventory
  and needs its own review.

Consistency check (manifest ↔ labels ↔ this inventory) is documented at the
bottom of `appstore-privacy-labels.md` and `play-data-safety.md`.
