# App Store Privacy "Nutrition Labels" — Pantopus iOS

**Derived from:** `docs/compliance/privacy-data-inventory.md`
**Mirrors:** `frontend/apps/ios/Pantopus/PrivacyInfo.xcprivacy`
**Bundle:** `app.pantopus.ios`
**Last reviewed:** 2026-06-05

These are the answers to enter in **App Store Connect → your app → App
Privacy**. This is human/console work; this file is the script for it. Every
row here must match the inventory and the bundled `PrivacyInfo.xcprivacy`.

---

## Step 0 — Top-level questions

| Question | Answer |
|----------|--------|
| Do you or your third-party partners collect data from this app? | **Yes** |
| Is any collected data used to **track** the user? (ATT sense) | **No** — no IDFA, no ad SDK, no data-broker sharing. (`NSPrivacyTracking = false`.) |

For every data type below: **"Used to Track You" = No.** Each is **linked to
the user's identity = Yes** (we operate behind a login).

---

## Step 1 — Data types collected

Apple groups by category → type. Enter each, then pick **purposes**,
**linked = Yes**, **tracking = No**.

### Contact Info
| Type | Collected | Purpose(s) | Linked | Tracking |
|------|-----------|------------|--------|----------|
| Name | Yes | App Functionality | Yes | No |
| Email Address | Yes | App Functionality | Yes | No |
| Phone Number | Yes | App Functionality | Yes | No |
| Physical Address | Yes | App Functionality | Yes | No |

### Financial Info
| Type | Collected | Purpose(s) | Linked | Tracking |
|------|-----------|------------|--------|----------|
| Payment Info | Yes | App Functionality | Yes | No |

> Collected by Stripe's PaymentSheet on our behalf; the app never stores the
> card number. Apple still requires declaring **Payment Info**.

### Location
| Type | Collected | Purpose(s) | Linked | Tracking |
|------|-----------|------------|--------|----------|
| Precise Location | Yes | App Functionality | Yes | No |
| Coarse Location | Yes | App Functionality | Yes | No |

> ⚠️ **Pre-submission gate.** iOS device-location collection is forward-declared
> — the live `CLLocationManager` provider is not yet wired (see inventory
> §2.4). Before you submit GA, **either** confirm the provider is wired **or**
> remove these two rows *and* the location purpose strings from `project.yml`
> so labels match the binary.

### User Content
| Type | Collected | Purpose(s) | Linked | Tracking |
|------|-----------|------------|--------|----------|
| Photos or Videos | Yes | App Functionality | Yes | No |
| Audio Data | Yes | App Functionality | Yes | No |
| Other User Content (messages, posts, listings, gigs, reviews, documents) | Yes | App Functionality | Yes | No |

> Apple's label UI folds chat messages and other content under **User
> Content**. (The bundled manifest splits them into `EmailsOrTextMessages` +
> `OtherUserContent` for finer granularity — same underlying data.)

### Identifiers
| Type | Collected | Purpose(s) | Linked | Tracking |
|------|-----------|------------|--------|----------|
| User ID | Yes | App Functionality | Yes | No |
| Device ID | Yes | App Functionality | Yes | No |

> Device ID = APNs push token registered for notifications.

### Usage Data
| Type | Collected | Purpose(s) | Linked | Tracking |
|------|-----------|------------|--------|----------|
| Product Interaction | Yes | Analytics | Yes | No |

### Diagnostics
| Type | Collected | Purpose(s) | Linked | Tracking |
|------|-----------|------------|--------|----------|
| Crash Data | Yes | App Functionality | Yes | No |
| Performance Data | Yes | App Functionality | Yes | No |

### Other Data
| Type | Collected | Purpose(s) | Linked | Tracking |
|------|-----------|------------|--------|----------|
| Other Data Types (date of birth) | Yes | App Functionality | Yes | No |

---

## Step 2 — Not collected (explicit "No")

To avoid over-declaring, these App Store categories/types are **not**
collected: Health & Fitness, Browsing History, Search History (search
*recents* are stored locally in UserDefaults and not sent to a server),
Contacts (address book), Purchases (no IAP), Sensitive Info (race, religion,
sexual orientation, etc.), Gameplay Content, Advertising Data.

---

## Consistency check (manifest ↔ labels ↔ inventory)

| Inventory category (§2) | This doc | `PrivacyInfo.xcprivacy` type |
|-------------------------|----------|------------------------------|
| Contact Info | ✔ Name/Email/Phone/Address | Name, EmailAddress, PhoneNumber, PhysicalAddress |
| Other Data (DOB) | ✔ Other Data Types | OtherDataTypes |
| Financial Info | ✔ Payment Info | PaymentInfo |
| Location | ✔ Precise + Coarse | PreciseLocation, CoarseLocation |
| User Content | ✔ Photos/Audio/Other | PhotosorVideos, AudioData, EmailsOrTextMessages, OtherUserContent |
| Identifiers | ✔ User ID + Device ID | UserID, DeviceID |
| Diagnostics | ✔ Crash + Performance | CrashData, PerformanceData |
| Usage Data | ✔ Product Interaction | ProductInteraction |
| Tracking | ✔ No (everywhere) | `NSPrivacyTracking = false` |

If you change a row here, change the manifest and the inventory in the same
PR.
