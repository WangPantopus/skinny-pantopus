# Google Play "Data safety" Form — Pantopus Android

**Derived from:** `docs/compliance/privacy-data-inventory.md`
**Package:** `app.pantopus.android`
**Last reviewed:** 2026-06-05

Answers to enter in **Play Console → App content → Data safety**. Play's
taxonomy differs from Apple's, so the same inventory is re-expressed in
Play's terms. Human/console work; this file is the script.

---

## Section 1 — Overview questions

| Question | Answer |
|----------|--------|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — all traffic is HTTPS/TLS to `api.pantopus.app`; Socket.IO over TLS. |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app account deletion (Settings) plus a privacy-policy contact. |

> **"Collected" vs "Shared".** Play defines *shared* = transferred to a
> third party. We **collect** to our backend. We **share** payment data with
> **Stripe** (payment processing) and diagnostics with **Sentry** (app
> functioning/diagnostics) — both are "service providers / processors",
> which Play lets you treat as collection-with-a-processor rather than
> advertising sharing. **No data is shared for advertising or with data
> brokers.**

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
| Payment info | Yes | **Yes → Stripe** | App functionality (payments) | Collected by Stripe SDK; app never stores the card. |

### Location
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Approximate location | Yes | No | App functionality | `ACCESS_COARSE_LOCATION` |
| Precise location | Yes | No | App functionality | `ACCESS_FINE_LOCATION`; "near you" + maps |

### Photos and videos
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Photos | Yes | No | App functionality | Profile, listings, mail capture |
| Videos | Yes | No | App functionality | Listing media where applicable |

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
| App interactions | Yes | **Yes → Sentry** | Analytics, App functionality | Screen views / CTA taps (typed taxonomy) |

### App info and performance
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Crash logs | Yes | **Yes → Sentry** | App functionality (diagnostics) | `sentry-android` |
| Diagnostics (performance) | Yes | **Yes → Sentry** | App functionality (diagnostics) | Performance / network tracing |

### Device or other IDs
| Play data type | Collected | Shared | Purpose | Notes |
|----------------|-----------|--------|---------|-------|
| Device or other IDs | Yes | No | App functionality | FCM registration token (push); account/user id |

---

## Section 3 — Security practices

| Question | Answer |
|----------|--------|
| Data encrypted in transit | **Yes** (TLS everywhere) |
| Users can request data deletion | **Yes** (in-app account deletion) |
| Committed to Play Families Policy | As applicable to target audience (set in Console) |
| Independent security review | Optional — leave per current status |

> **Note on `usesCleartextTraffic="true"`** in `AndroidManifest.xml`: present
> for local-dev (`10.0.2.2`) HTTP. Production traffic is HTTPS. Confirm the
> release build does not actually use cleartext to a production host before
> attesting "encrypted in transit"; if needed, gate cleartext to debug via a
> network-security-config so the attestation is unambiguous.

---

## Section 4 — Not collected (do **not** tick)

Health & fitness, Web browsing history, Search history (search *recents* are
stored locally only, not uploaded), Contacts (address book), Calendar,
Installed apps, SMS/Call logs, Purchase history (no IAP), Advertising ID
(not used). **No data shared for advertising; no data sold; no data brokers.**

---

## Consistency check (form ↔ App Store labels ↔ inventory)

| Inventory category (§2) | Play type | App Store label |
|-------------------------|-----------|-----------------|
| Contact Info | Name / Email / Phone / Address | Contact Info |
| Other Data (DOB) | Personal info → Other info | Other Data Types |
| Financial Info | Financial info → Payment info (shared→Stripe) | Payment Info |
| Location | Approximate + Precise location | Coarse + Precise Location |
| User Content (photos) | Photos / Videos | Photos or Videos |
| User Content (audio) | Voice or sound recordings | Audio Data |
| User Content (messages) | Other in-app messages | (User Content) |
| User Content (other) | Other user-generated content | Other User Content |
| Identifiers | Device or other IDs | User ID + Device ID |
| Diagnostics | Crash logs + Diagnostics (shared→Sentry) | Crash + Performance Data |
| Usage Data | App interactions (shared→Sentry) | Product Interaction |

The Play "shared" column is **stricter** than Apple's labels: Play counts a
processor (Stripe, Sentry) as "shared", while Apple treats the same as
first-party collection. Both are correct for their respective forms; the
underlying behavior is identical.
