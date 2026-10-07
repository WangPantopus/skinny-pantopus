# Google Play "Data safety" Form — Pantopus Android

**Derived from:** `docs/compliance/privacy-data-inventory.md`
**Package:** `app.pantopus.android`
**Last reviewed:** 2026-10-07 (founder approved the answers with decisions A and B below; earlier: *Health info* added for emergency info, photo rows no longer mention listings)

Answers to enter in **Play Console → App content → Data safety**. Play's
taxonomy differs from Apple's, so the same inventory is re-expressed in
Play's terms. Human/console work; this file is the script.

---

## Section 1 — Overview questions

| Question | Answer |
|----------|--------|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — all traffic is HTTPS/TLS to `api.pantopus.com`; Socket.IO over TLS. |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app account deletion (Profile & Privacy) plus a privacy-policy contact. |
| Delete account URL (required when users can create an account) | `https://pantopus.com/delete-account` — text approved October 7 ([account-deletion-page.md](account-deletion-page.md)); the page ships with the web app and is live after the production web deploy (checklist P9), so submit after that. |

> **"Collected" vs "Shared" (founder decision A, October 7).** Play's form
> doesn't count data sent to a service provider that processes it on our
> behalf as *shared*. Stripe processes payments that way, and Sentry would
> process crash reports that way (it is off for the pilot, decision D7). So
> every row below is **collected, not shared**, and the form says no data is
> shared. If a partner ever uses data for its own purposes, that row changes
> first. **No data is shared for advertising or with data brokers.**
>
> **Crash data while Sentry is off (founder decision B, October 7).** With no
> Sentry key the apps send no crash or performance reports. The rows stay
> declared anyway: the Sentry library ships in the apps (its iOS privacy
> manifest lists crash, performance and other diagnostic data), and turning
> Sentry on later then needs no form change.

---

## Section 2 — Data types

For each: **Collected = Yes**, choose **processed ephemerally? No** (we
persist server-side), **required or optional**, and **purposes**. Default
purpose is **App functionality / Account management**; analytics where noted.

### Personal info
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Name | Yes | No | Account management, App functionality | Registration |
| Email address | Yes | No | Account management, App functionality | Registration / login |
| Phone number | Yes | No | Account management, App functionality | Registration |
| Address | Yes | No | App functionality | Registration + Homes |
| Other info (date of birth) | Yes | No | App functionality | Eligibility / age |

### Financial info
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Payment info | Yes | No | App functionality (payments) | Entered in Stripe's payment form, which processes it on our behalf; the app never stores the card. |

### Location
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Approximate location | Yes | No | App functionality | `ACCESS_COARSE_LOCATION` |
| Precise location | Yes | No | App functionality | `ACCESS_FINE_LOCATION`; "near you" + maps |

### Photos and videos
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Photos | Yes | No | App functionality | Profile, posts, home records, mail capture |
| Videos | Yes | No | App functionality | Posts where applicable |

### Health and fitness
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Health info | Yes (optional) | No | App functionality | Medical details a household chooses to enter in a home's emergency info (inventory §2.10); visible only to people the owner granted sensitive access. |

### Audio files
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Voice or sound recordings | Yes | No | App functionality | Chat voice messages |

### Messages
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Other in-app messages | Yes | No | App functionality | Chat / DMs |

### Photos / other user-generated content
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Other user-generated content | Yes | No | App functionality | Posts, gigs, listings, reviews, documents, bio |

### App activity
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| App interactions | Yes | No | Analytics, App functionality | Pantopus's own pilot measurement (session and reminder events sent to our API) |

### App info and performance
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Crash logs | Yes | No | App functionality (diagnostics) | `sentry-android`, off while no Sentry key is set (decision B) |
| Diagnostics (performance) | Yes | No | App functionality (diagnostics) | Performance / network tracing, off while no Sentry key is set |

### Device or other IDs
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Device or other IDs | Yes | No | App functionality, **Fraud prevention, security, and compliance** | FCM registration token (push); account/user id; **since 2026-08 (persistent login):** app-generated device id + install id (`device_identity` prefs, backup-excluded), the device's **public** key (Android Keystore P-256; private half never leaves the device), server session id, and the per-session IP address / user-agent the server records and shows back under Settings → Security → *Where you're logged in*. Not the Advertising ID / AAID; first-party, per-app; never shared. |

> **Purpose wording (2026-08).** Tick **both** *App functionality* (sign the
> user in, keep them signed in on this device, list/remove devices) and
> *Fraud prevention, security, and compliance* (bind the refresh token to the
> device key, detect refresh-token reuse, security-event log, new-device
> emails). Play has no separate "IP address" type — it falls under *Device or
> other IDs* here, and the security-event log (sign-in / sign-out / device
> removed / refresh reuse / password change with timestamp, device, IP, UA) is
> the same row. Inventory §2.6 / §2.9 are the source.
>
> **Ephemeral?** No — `AuthDevice` / `AuthSession` / `AuthSecurityEvent` rows
> persist server-side (retention in inventory §5). **Required?** Yes — the
> device id / key are created on first sign-in and cannot be opted out of
> (the security preferences only govern resume grants and new-device email).

### Not new data types — biometrics and Block Store
- **Biometrics / device credential** (`USE_BIOMETRIC`, `BiometricPrompt` with
  `BIOMETRIC_STRONG or DEVICE_CREDENTIAL`) gate "Continue as X" after a
  reinstall and unlock the biometry-bound step-up key. The app receives only
  the prompt result and a Keystore signature — **no biometric data is
  collected or leaves the OS**, so biometrics add nothing under *Health & fitness*.
- **Google Play services Block Store** (`play-services-auth-blockstore`)
  keeps the account hint (display name, avatar URL, masked email) and a
  single-use resume grant **on the device only** (`setShouldBackupToCloud
  (false)`, so same-device reinstall + device-to-device transfer, no cloud
  copy). It is neither collected by us nor "shared" with Google in a
  readable form; nothing to declare beyond the SDK row in inventory §4.
- Nothing is uploaded from Block Store; the resume grant is redeemed against
  `POST /api/auth/resume` and the server holds only its SHA-256.

---

## Section 3 — Security practices

| Question | Answer |
|----------|--------|
| Data encrypted in transit | **Yes** (TLS everywhere) |
| Users can request data deletion | **Yes** (in-app account deletion) |
| Committed to Play Families Policy | As applicable to target audience (set in Console) |
| Independent security review | Optional — leave per current status |

> **Cleartext (checked 2026-10-07):** `usesCleartextTraffic="true"` is set only in
> `app/src/debug/AndroidManifest.xml` (local `10.0.2.2` HTTP). The main manifest
> doesn't allow it, so release builds can't send cleartext, and their API host is
> `https://api.pantopus.com`. "Encrypted in transit: Yes" stands.

---

## Section 4 — Not collected (do **not** tick)

Fitness info, Web browsing history, Search history (search *recents* are
stored locally only, not uploaded), Contacts (address book), Calendar,
Installed apps, SMS/Call logs, Purchase history (no IAP), Advertising ID
(not used). **No data shared for advertising; no data sold; no data brokers.**

---

## Consistency check (form ↔ App Store labels ↔ inventory)

| Inventory category (§2) | Play type | App Store label |
|-------------------------|-----------|-----------------|
| Contact Info | Name / Email / Phone / Address | Contact Info |
| Other Data (DOB) | Personal info → Other info | Other Data Types |
| Financial Info | Financial info → Payment info (collected, not shared) | Payment Info |
| Location | Approximate + Precise location | Coarse + Precise Location |
| User Content (photos) | Photos / Videos | Photos or Videos |
| User Content (audio) | Voice or sound recordings | Audio Data |
| User Content (messages) | Other in-app messages | (User Content) |
| User Content (other) | Other user-generated content | Other User Content |
| Identifiers (incl. 2026-08 device id / install id / device public key / session id) | Device or other IDs (App functionality + Fraud prevention, security, and compliance) | User ID + Device ID |
| Security & session records (§2.9: IP + UA, security events) | Device or other IDs (same row, security purpose) | Other Data Types (note) |
| Diagnostics | Crash logs + Diagnostics (collected, not shared) | Crash + Performance Data |
| Usage Data | App interactions (collected, not shared) | Product Interaction |

Both forms treat a service provider that processes data on our behalf
(Stripe, and Sentry if it is turned on) as part of our own collection, so
nothing is declared as shared.
