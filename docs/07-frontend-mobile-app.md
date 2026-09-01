# Pantopus Frontend Mobile Application Architecture

> Comprehensive design document for the Pantopus React Native / Expo mobile application (iOS & Android).
> Generated from full codebase analysis (April 2026).

---

## Table of Contents

| # | Section | Scope |
|---|---------|-------|
| 1 | [Architecture Diagram](#1-architecture-diagram) | Provider hierarchy, native bridges, data flow |
| 2 | [Technology Stack](#2-technology-stack) | Expo, React Native, native modules |
| 3 | [Provider Hierarchy](#3-provider-hierarchy) | Exact nesting order, responsibilities |
| 4 | [Navigation Architecture](#4-navigation-architecture) | Expo Router, tabs, modals, deep linking |
| 5 | [Authentication & Session Management](#5-authentication--session-management) | Token storage, OAuth, session restoration |
| 6 | [Biometric Security](#6-biometric-security) | AppLock, two-tier auth, rollout |
| 7 | [PantopusContext](#7-pantopuscontext) | Place, radius, viewingAs, access, persistence |
| 8 | [Real-Time Architecture](#8-real-time-architecture) | Socket.IO, mobile backgrounding, badge polling |
| 9 | [Push Notifications](#9-push-notifications) | Token lifecycle, foreground handling, routing |
| 10 | [Chat Architecture](#10-chat-architecture) | Dual-mode, message merging, optimistic rendering |
| 11 | [Payment Integration](#11-payment-integration) | Stripe, two-intent pattern, sensitive action guard |
| 12 | [Native Features](#12-native-features) | Camera, location, haptics, secure storage, maps |
| 13 | [Offline & Persistence](#13-offline--persistence) | AsyncStorage keys, drafts, connectivity |
| 14 | [Build & Deployment](#14-build--deployment) | EAS profiles, app.json, deep link domains |
| 15 | [Telemetry & Monitoring](#15-telemetry--monitoring) | Auth telemetry, signal buffer |

---

## 1. Architecture Diagram

```
 Mobile Device (iOS / Android)
 +-----------------------------------------------------------------+
 |                                                                 |
 |  Expo 54 + React Native 0.81.5                                  |
 |  ┌───────────────────────────────────────────────────────────┐  |
 |  │  Root Layout (_layout.tsx)                                │  |
 |  │  14 nested providers (see Section 3)                      │  |
 |  │                                                           │  |
 |  │  ┌─────────────────────────────────────────────────────┐  │  |
 |  │  │  AuthGate                                           │  │  |
 |  │  │  ├─ (auth) group — Login, Register (fade anim)      │  │  |
 |  │  │  ├─ (tabs) group — 5 main tabs (fade anim)          │  │  |
 |  │  │  ├─ Modal screens — gig/new, homes/new, profile/edit│  │  |
 |  │  │  └─ Stack screens — all other routes (slide_right)  │  │  |
 |  │  └─────────────────────────────────────────────────────┘  │  |
 |  │  + ContextSheet (global)                                  │  |
 |  │  + LocationToast (global)                                 │  |
 |  │  + AppLockSetupPromptLayer (post-login biometric prompt)  │  |
 |  └───────────────────────────────────────────────────────────┘  |
 |                                                                 |
 +------+------+-------+-------+------+----------------------------+
        |      |       |       |      |
   Bearer   Socket.IO  Push   Stripe  Deep Links
   Token    WebSocket  Notif  Native  (Universal Links
   (JWT)               (Expo) SDK     + Intent Filters)
        |      |       |       |      |
 +------v------v-------v-------v------v----------------------------+
 |                                                                 |
 |  Express 5.1 Backend API (Node.js 20)                           |
 |  ├─ REST endpoints (JWT auth via Bearer token)                  |
 |  ├─ Socket.IO server (real-time events)                         |
 |  └─ Push notification dispatch (via Expo Push Service)          |
 |                                                                 |
 +-----------------------------------------------------------------+
```

### Native Bridge Dependencies

```
 React Native Layer
 ├── expo-secure-store ─────────── iOS Keychain / Android Keystore
 ├── expo-local-authentication ─── Face ID / Touch ID / Biometrics
 ├── expo-notifications ────────── APNs / FCM
 ├── expo-camera ───────────────── Camera hardware
 ├── expo-image-picker ─────────── Photo library access
 ├── expo-location ─────────────── GPS / Location Services
 ├── expo-haptics ──────────────── Haptic feedback engine
 ├── expo-video ────────────────── Native video player
 ├── expo-document-picker ──────── File system access
 ├── expo-web-browser ──────────── In-app browser (OAuth)
 ├── expo-clipboard ────────────── System clipboard
 ├── react-native-maps ─────────── Apple Maps / Google Maps
 └── @stripe/stripe-react-native ─ Stripe payment sheet
```

---

## 2. Technology Stack

### Core Framework

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | React Native | 0.81.5 | Cross-platform native UI |
| **Build System** | Expo | 54.0.32 | Managed workflow, OTA updates |
| **Navigation** | Expo Router | 6.0.22 | File-based routing |
| **Language** | TypeScript | 5.9.2 | Type safety |
| **UI** | React | 19.1.0 | Component model |
| **Bundler** | Metro | (Expo default) | JavaScript bundler |

### Native Modules

| Module | Version | Purpose |
|--------|---------|---------|
| **expo-secure-store** | 15.0.8 | Encrypted token storage (Keychain/Keystore) |
| **expo-local-authentication** | 17.0.8 | Biometric auth (Face ID, Touch ID, fingerprint) |
| **expo-notifications** | 0.32.16 | Push notification registration & handling |
| **expo-camera** | 17.0.10 | Camera capture |
| **expo-image-picker** | 17.0.10 | Photo/video selection from library |
| **expo-location** | 19.0.8 | GPS coordinates & permissions |
| **expo-haptics** | 15.0.8 | Haptic feedback |
| **expo-video** | 3.0.16 | Video playback |
| **expo-document-picker** | 14.0.8 | File/document selection |
| **expo-web-browser** | 15.0.10 | In-app browser for OAuth flows |
| **expo-clipboard** | 8.0.8 | System clipboard access |
| **expo-device** | 8.0.10 | Device information |

### Maps & Location

| Library | Version | Purpose |
|---------|---------|---------|
| **react-native-maps** | 1.20.1 | Native map views (Apple Maps / Google Maps) |
| **supercluster** | 8.0.1 | Client-side marker clustering |

### Payments

| Library | Version | Purpose |
|---------|---------|---------|
| **@stripe/stripe-react-native** | 0.50.3 | Native payment sheet, card input |

### Data & Communication

| Library | Version | Purpose |
|---------|---------|---------|
| **socket.io-client** | 4.8.3 | Real-time WebSocket communication |
| **axios** | 1.7.9 | HTTP client (via @pantopus/api) |
| **@react-native-async-storage/async-storage** | 2.2.0 | Local key-value persistence |

### UI

| Library | Version | Purpose |
|---------|---------|---------|
| **@expo/vector-icons** | 15.0.3 | Icon library |
| **rn-emoji-keyboard** | 1.7.0 | Emoji picker for chat |
| **@react-native-community/datetimepicker** | 8.4.4 | Native date/time picker |
| **react-native-webview** | 13.15.0 | In-app web content |
| **react-native-safe-area-context** | 5.6.2 | Safe area insets |
| **react-native-screens** | 4.16.0 | Native screen containers |

### Shared Packages (Monorepo)

| Package | Purpose |
|---------|---------|
| **@pantopus/api** | HTTP client, token management, 40+ endpoint namespaces |
| **@pantopus/types** | Shared TypeScript types |
| **@pantopus/theme** | Design tokens (colors, typography, spacing, shadows) |
| **@pantopus/utils** | Utility functions, API_BASE_URL |
| **@pantopus/ui-utils** | UI helpers (getInitials, type mappings) |

### Testing

| Tool | Version | Purpose |
|------|---------|---------|
| **Jest** | 29.7.0 | Unit testing |
| **jest-expo** | 54.0.0 | Expo-aware Jest environment |
| **@testing-library/react-native** | 13.3.3 | Component testing |

---

## 3. Provider Hierarchy

**File**: `src/app/_layout.tsx`

The root layout wraps all screens in 14 nested providers. The order is intentional — each provider may depend on providers above it.

```
MaybeStripeProvider          ← Stripe SDK initialization (conditional on API key)
  └─ ThemeProvider           ← Dark/light mode detection, color tokens
      └─ AuthProvider        ← Session restoration, login/logout, token refresh
          └─ AppLockProvider ← Biometric auth, app lock state, setup prompt
              └─ PantopusProvider    ← Place, radius, viewingAs, access, homes, businesses
                  └─ IdentityProvider    ← User identity resolution
                      └─ LocationProvider    ← GPS coordinates, permissions
                          └─ SocketProvider       ← Socket.IO connection lifecycle
                              └─ BadgeProvider        ← Notification/chat/offer badge counts
                                  └─ ToastProvider        ← Toast notification queue
                                      └─ ConfirmProvider      ← Confirm dialog state
                                          └─ PasswordReauthProvider  ← Password re-entry modal
                                              └─ PushNotificationProvider  ← Push token lifecycle
                                                  └─ ThemedStatusBar
                                                  └─ AuthGate
                                                  └─ ThemedStack (routes)
                                                  └─ ContextSheet (global overlay)
                                                  └─ LocationToast (global overlay)
                                                  └─ AppLockSetupPromptLayer
```

### Provider Responsibilities

| Provider | Context File | Key State | Dependencies |
|----------|-------------|-----------|-------------|
| **MaybeStripeProvider** | `components/MaybeStripeProvider.tsx` | Stripe publishable key | None |
| **ThemeProvider** | `contexts/ThemeContext.tsx` | `isDark`, `colors` | System color scheme |
| **AuthProvider** | `contexts/AuthContext.tsx` | `user`, `isAuthenticated`, `isLoading`, `lastInteractiveSignInAt` | SecureStore, API client |
| **AppLockProvider** | `contexts/AppLockContext.tsx` | `isEnabled`, `capability`, `setupPromptState`, `rollout` | AuthProvider (userId) |
| **PantopusProvider** | `contexts/PantopusContext.tsx` | `place`, `radius`, `viewingAs`, `access`, `homes`, `businesses`, `gpsCoords`, `feedScope` | AuthProvider |
| **IdentityProvider** | `contexts/IdentityContext.tsx` | User identity data | AuthProvider, PantopusProvider |
| **LocationProvider** | `contexts/LocationContext.tsx` | GPS coordinates, permission status | expo-location |
| **SocketProvider** | `contexts/SocketContext.tsx` | `socket`, `connected` | AuthProvider (token) |
| **BadgeProvider** | `contexts/BadgeContext.tsx` | `unreadMessages`, `totalMessages`, `pendingOffers`, `notifications` | SocketProvider |
| **ToastProvider** | `components/ui/ToastProvider.tsx` | Toast queue | None |
| **ConfirmProvider** | `components/ui/ConfirmProvider.tsx` | Confirm dialog state | None |
| **PasswordReauthProvider** | `components/security/PasswordReauthProvider.tsx` | Re-authentication modal state | AuthProvider |
| **PushNotificationProvider** | `contexts/PushNotificationContext.tsx` | Push token, permission status | AuthProvider, expo-notifications |

---

## 4. Navigation Architecture

### Tab Structure

**File**: `src/app/(tabs)/_layout.tsx`

```
(tabs)
├─ index          → Hub (home dashboard)
├─ feed           → Pulse (social feed)
├─ gigs           → Tasks (gig browsing)
├─ chat           → Messages (chat list) [badge: unreadMessages]
├─ profile        → Profile
└─ marketplace    → (hidden tab, accessible via navigation)
```

### Route Map

```
src/app/
├─ _layout.tsx                      ← Root: 14 providers + AuthGate
│
├─ (auth)/                          ← Auth screens (fade animation)
│  ├─ login.tsx
│  ├─ register.tsx
│  └─ forgot-password.tsx
│
├─ (tabs)/                          ← Main tabs (fade animation)
│  ├─ _layout.tsx                   ← Tab bar configuration
│  ├─ index.tsx                     ← Hub
│  ├─ feed.tsx                      ← Pulse / Feed
│  ├─ gigs.tsx                      ← Task browsing
│  ├─ chat.tsx                      ← Chat room list
│  ├─ profile.tsx                   ← User profile
│  └─ marketplace.tsx               ← Marketplace browse
│
├─ Modal screens (slide_from_bottom):
│  ├─ gig/new.tsx                   ← Create new gig
│  ├─ homes/new.tsx                 ← Add new home
│  └─ profile/edit.tsx              ← Edit profile
│
├─ Stack screens (slide_from_right — auto-discovered):
│  ├─ chat/
│  │  ├─ [roomId].tsx               ← Chat room
│  │  ├─ conversation/[otherUserId].tsx
│  │  └─ ai-assistant.tsx           ← AI chat
│  ├─ gig/[id].tsx                  ← Gig detail
│  ├─ gig-v2/[id].tsx               ← Gig detail v2
│  ├─ gigs/[id].tsx                 ← Public gig detail
│  ├─ gigs-map.tsx                  ← Map view for gigs
│  ├─ my-gigs.tsx / my-gigs-v2.tsx  ← User's posted gigs
│  ├─ my-bids.tsx                   ← User's bids
│  ├─ offers.tsx                    ← Offer management
│  │
│  ├─ listing/[id].tsx              ← Listing detail
│  ├─ listings/[id].tsx             ← Public listing detail
│  ├─ listing-offers.tsx            ← Listing offer management
│  ├─ my-listings.tsx               ← User's listings
│  ├─ marketplace/[id].tsx          ← Marketplace item
│  │
│  ├─ homes/
│  │  ├─ index.tsx                  ← Homes list
│  │  ├─ [id]/                      ← Home detail
│  │  │  ├─ index.tsx
│  │  │  └─ dashboard.tsx
│  │  └─ invite.tsx                 ← Household invite
│  │
│  ├─ discover.tsx                  ← Location-based discovery
│  ├─ discover-hub.tsx              ← Curated discovery
│  ├─ discover-businesses.tsx       ← Business discovery
│  ├─ explore-map.tsx               ← Full-screen explore map
│  │
│  ├─ mailbox/                      ← Mailbox screens
│  ├─ wallet.tsx                    ← Wallet & balance
│  ├─ invoice/                      ← Invoice management
│  ├─ notifications.tsx             ← Notification center
│  ├─ connections.tsx               ← Network management
│  ├─ control-center.tsx            ← Admin dashboard
│  │
│  ├─ settings/                     ← Settings pages
│  ├─ businesses/                   ← Business management
│  ├─ admin/                        ← Admin tools
│  ├─ legal/                        ← Legal pages
│  │
│  ├─ post/[id].tsx                 ← Public post detail (deep link)
│  ├─ posts/[id].tsx                ← Public post detail (deep link)
│  ├─ support-trains/[id].tsx       ← Support train (deep link)
│  ├─ invite/[token].tsx            ← Invite acceptance (deep link)
│  ├─ b/[username]/                 ← Public business profile (deep link)
│  └─ u/[userId].tsx                ← Public user profile (deep link)
```

### Screen Animations

| Route Group | Animation | Presentation |
|-------------|-----------|-------------|
| `(tabs)` | `fade` | Inline |
| `(auth)` | `fade` | Inline |
| `gig/new`, `homes/new`, `profile/edit` | `slide_from_bottom` | Modal |
| All other routes | `slide_from_right` (default) | Stack |

### Deep Linking

**Custom scheme**: `pantopus://`

**iOS Universal Links** (Associated Domains):
```
applinks:www.pantopus.com
applinks:pantopus.com
```

**Android Intent Filters** (auto-verified):

| Path Prefix | Example URL |
|-------------|-------------|
| `/gig/` | `https://pantopus.com/gig/abc123` |
| `/gigs/` | `https://pantopus.com/gigs/abc123` |
| `/post/` | `https://pantopus.com/post/abc123` |
| `/posts/` | `https://pantopus.com/posts/abc123` |
| `/listing/` | `https://pantopus.com/listing/abc123` |
| `/listings/` | `https://pantopus.com/listings/abc123` |
| `/b/` | `https://pantopus.com/b/acme-shop` |
| `/u/` | `https://pantopus.com/u/johndoe` |
| `/marketplace/` | `https://pantopus.com/marketplace/abc123` |
| `/invite/` | `https://pantopus.com/invite/token123` |

Both `www.pantopus.com` and `pantopus.com` are registered for all paths.

### AuthGate

**File**: `src/app/_layout.tsx` (AuthGate component)

The AuthGate checks authentication state and redirects:

```
isLoading? → Show splash screen (Pantopus logo + spinner)
  │
  ├─ Not authenticated + not in auth/legal/public-deep-link route
  │   → Redirect to /(auth)/login
  │
  ├─ Authenticated + in auth group
  │   → Redirect to /control-center
  │
  └─ Otherwise → Render children
```

**Public deep-link routes** (accessible without auth):
`gig`, `gigs`, `post`, `posts`, `support-trains`, `listing`, `listings`, `marketplace`, `invite`, `b`, `u`, `business`, `user`, `homes/invite`

---

## 5. Authentication & Session Management

### Three-Layer Token Storage

```
 ┌─────────────────────────────────────────────────────────┐
 │  Layer 1: Memory Cache (fastest)                        │
 │  ├─ cachedSession variable                              │
 │  ├─ Synchronous access via getCachedSession()           │
 │  └─ Updated eagerly when API client persists tokens     │
 ├─────────────────────────────────────────────────────────┤
 │  Layer 2: Secure Persistent (expo-secure-store)         │
 │  ├─ Key: "pantopus_auth_session"                        │
 │  ├─ iOS Keychain / Android Keystore                     │
 │  ├─ Stores: { accessToken, refreshToken, expiresAt,     │
 │  │            userId, updatedAt, version }               │
 │  └─ JSON stringified                                    │
 ├─────────────────────────────────────────────────────────┤
 │  Layer 3: Install Sentinel (AsyncStorage)               │
 │  ├─ Key: "pantopus_install_sentinel"                    │
 │  ├─ Detects app uninstall → reinstall                   │
 │  └─ If missing on boot: wipes SecureStore session       │
 │     (prevents stale token reuse after reinstall)        │
 └─────────────────────────────────────────────────────────┘
```

### Session Restoration Flow

```
App Cold Boot
  │
  ├─ 1. Check install sentinel in AsyncStorage
  │     ├─ Missing → App was reinstalled → Wipe SecureStore session
  │     └─ Present → Continue
  │
  ├─ 2. Read session from SecureStore
  │     ├─ No session → Mark unauthenticated, show login
  │     └─ Session found → Check expiry
  │
  ├─ 3. Is session expiring soon? (within 5 minutes)
  │     ├─ YES → Call token refresh API
  │     │   ├─ Success → Update all 3 layers, mark authenticated
  │     │   └─ Failure → Clear session, show login
  │     └─ NO → Mark authenticated, load user profile
  │
  └─ 4. Start AppState listener for foreground returns
        └─ On foreground: Re-check expiry, refresh if needed
```

### Token Refresh Window

```
SESSION_REFRESH_WINDOW_MS = 5 minutes

isSessionExpiringSoon(session):
  return session.expiresAt <= Date.now() + 5 * 60 * 1000
```

### OAuth Flow

```
User taps "Sign in with Google/Apple"
  │
  ├─ 1. Resolve redirect URI: pantopus://auth/callback
  │
  ├─ 2. WebBrowser.openAuthSessionAsync(authUrl, redirectUri)
  │     ← Opens in-app browser (Safari/Chrome custom tab)
  │
  ├─ 3. User authenticates with provider
  │
  ├─ 4. Provider redirects to pantopus://auth/callback?code=...
  │     or pantopus://auth/callback#access_token=...
  │
  ├─ 5. Extract code or access_token from URL
  │     ├─ code → Call backend oauthCallback(provider, code)
  │     └─ access_token → Call backend oauthTokenCallback(provider, token)
  │
  └─ 6. Backend returns JWT tokens → Persist to all 3 layers
```

### Token Storage Adapter

The mobile app provides a custom `TokenStorage` implementation to the shared `@pantopus/api` client:

```typescript
mobileTokenStorage = {
  getToken()        → getCachedSession()?.accessToken
  setToken(token)   → updateSession({ accessToken: token })
  clearToken()      → clearSession()
  getRefreshToken() → getCachedSession()?.refreshToken
  setRefreshToken() → updateSession({ refreshToken: token })
  saveSession()     → updateSession(session)  // writes to SecureStore
  clearSession()    → clearSession()          // wipes all 3 layers
}
```

### API Base URL Resolution

| Priority | Source | Example |
|----------|--------|---------|
| 1 | `EXPO_PUBLIC_API_URL` env var | `https://api.pantopus.com` |
| 2 | Auto-detect from Expo dev server | `http://192.168.1.42:8000` |
| 3 | Fallback | `http://localhost:8000` |

Auto-detection extracts the host IP from `Constants.expoConfig.hostUri` (Metro bundler host) and replaces the port with `8000`.

---

## 6. Biometric Security

### AppLockContext

**File**: `src/contexts/AppLockContext.tsx`

### Two-Tier Authentication Model

```
 ┌────────────────────────────────────────────────────────────────┐
 │  Tier 1: Screen-Level Guard (App Unlock)                       │
 │  ├─ Biometric + device passcode fallback                       │
 │  ├─ disableDeviceFallback: false                               │
 │  ├─ biometricsSecurityLevel: configurable ('weak' or 'strong') │
 │  ├─ requireConfirmation: false                                 │
 │  └─ Used for: app unlock after backgrounding                   │
 ├────────────────────────────────────────────────────────────────┤
 │  Tier 2: Sensitive Action Guard (High Security)                │
 │  ├─ Strong biometric ONLY — no passcode fallback               │
 │  ├─ disableDeviceFallback: true                                │
 │  ├─ biometricsSecurityLevel: 'strong'                          │
 │  ├─ requireConfirmation: true                                  │
 │  ├─ 5-minute grace period (skip re-auth within window)         │
 │  └─ Used for: payments, account changes, sensitive actions     │
 └────────────────────────────────────────────────────────────────┘
```

### Biometric Capability Detection

```typescript
BiometricCapability = {
  available: boolean          // hasHardware AND enrolled
  enrolled: boolean           // user has registered biometrics
  hasHardware: boolean        // device has biometric sensor
  label: string               // 'Face ID' | 'Touch ID' | 'Face Unlock' | 'Fingerprint' | 'Biometrics'
  securityLevel: SecurityLevel
  supportedAuthenticationTypes: AuthenticationType[]
  supportsDeviceCredential: boolean
}
```

### Setup Prompt State Machine

```
                        App install
                            │
                            v
 ┌──────────┐  post-login  ┌──────────┐  user taps  ┌──────────┐
 │          │  prompt       │          │  "Enable"   │          │
 │ pending  ├──────────────►│  prompt  ├────────────►│ enabled  │
 │          │               │  shown   │             │          │
 └──────────┘               └────┬─────┘             └──────────┘
                                 │
                            user taps
                            "Not Now"
                                 │
                                 v
                            ┌──────────┐
                            │          │
                            │ declined │  (no re-prompt)
                            │          │
                            └──────────┘
```

**Persistence**: `AsyncStorage` key `pantopus_app_lock_preferences_${userId}` stores per-user state.

**Trigger conditions** (all must be true):
- User just completed an interactive sign-in
- Rollout enabled for this user (hash-based bucketing)
- Hardware available and enrolled
- Setup state is `pending`
- Not on auth or legal screen
- Haven't already prompted for this sign-in session

### Rollout Configuration

```json
// app.json → extra.security
{
  "biometricAppLockEnabled": true,        // kill switch
  "biometricAppLockRolloutPercent": 100   // 0-100, hash-based stable bucketing
}
```

**Bucketing**: `hash(userId) % 100 < rolloutPercent`

### Error Handling — Auto-Disable

When biometric auth fails with these errors, biometrics are automatically disabled:

| Error Code | Meaning | Action |
|------------|---------|--------|
| `not_available` | Hardware gone (e.g., broken sensor) | Disable, warn user |
| `not_enrolled` | User removed all biometrics from Settings | Disable, warn user |
| `passcode_not_set` | Device passcode removed | Disable, warn user |
| `invalid_context` | Auth context invalidated | Disable, log telemetry |

---

## 7. PantopusContext

**File**: `src/contexts/PantopusContext.tsx`

The PantopusContext is the central "operating mode" context. It unifies location, identity, and access control into a single provider.

### State Shape

```
PantopusContext
├─ place                    ← Where the user is operating
│  ├─ placeType: 'current_location' | 'home' | 'neighborhood' | 'business' | 'city' | 'saved_place'
│  ├─ placeId: string | null
│  ├─ label: string
│  ├─ centerLat / centerLng: number
│  └─ city / state: string | null
│
├─ radius                   ← Content filtering radius
│  ├─ radiusMode: 'auto' | 'fixed'
│  └─ radiusMiles: number
│
├─ viewingAs                ← Who the user is acting as
│  ├─ actorType: 'personal' | 'home' | 'business'
│  ├─ actorId: string | null
│  ├─ actorName: string | null
│  └─ actorRole: string | null
│
├─ access                   ← Computed permissions
│  ├─ accessLevel: 'owner' | 'member' | 'visitor'
│  ├─ canPost / canComment: boolean
│  ├─ canSeeMailbox: boolean
│  └─ canSeeHouseholdCounts: boolean
│
├─ homes: HomeInfo[]        ← User's homes
├─ businesses: BusinessInfo[] ← User's businesses
├─ savedPlaces: SavedPlace[] ← User's saved locations
├─ recentLocations: RecentLocation[]
│
├─ gpsCoords               ← Silently tracked GPS
│  └─ { latitude, longitude } | null
│
├─ feedScope                ← Feed content filter
│  └─ 'nearby' | 'following' | 'connections' | 'home' | 'saved-place'
│
├─ mutedEntities            ← Muted content sources
│  └─ [{ entityType, entityId }]
│
└─ hiddenPostIds: string[]  ← Explicitly hidden posts
```

### Auto-Radius Rules

| Place Type | Default Radius |
|-----------|---------------|
| Home | 3 miles |
| Neighborhood | 3 miles |
| Business | 1 mile |
| City | 10 miles |
| Current Location | 10 miles |
| Saved Place | 10 miles |

### Initialization Flow

```
PantopusProvider mounts
  │
  ├─ 1. Load cached state from AsyncStorage (@pantopus_context)
  │     Restores: place, radius, viewingAs, feedScope
  │
  ├─ 2. Call api.location.resolveLocation()
  │     Server resolves location from IP/GPS
  │
  ├─ 3. Fetch in parallel:
  │     ├─ User's homes
  │     ├─ User's businesses
  │     └─ Recent locations
  │
  └─ 4. Silently track GPS in background
        (no permission prompt — uses existing grant)
```

### Persistence

**Key**: `@pantopus_context` in AsyncStorage

**Fields persisted**: `place`, `radius`, `viewingAs`, `feedScope`

Updated on every state change via debounced write.

---

## 8. Real-Time Architecture

### Socket.IO Configuration

**File**: `src/contexts/SocketContext.tsx`

| Setting | Value |
|---------|-------|
| **Server URL** | `API_BASE_URL` (resolved per Section 5) |
| **Auth** | `{ token: authToken }` in handshake |
| **Transports** | `['websocket', 'polling']` |
| **tryAllTransports** | `true` |
| **Reconnection attempts** | 50 |
| **Reconnection delay** | 2 s initial |
| **Reconnection delay max** | 30 s |

### Mobile Backgrounding

```
App State Change
  │
  ├─ active → background (user leaves app)
  │   └─ Socket stays alive (OS may suspend after ~30s)
  │
  ├─ background → active (user returns)
  │   └─ AppState listener fires
  │       ├─ Check socket.connected
  │       ├─ If disconnected → Force reconnect
  │       └─ BadgeProvider polls badges immediately
  │
  └─ inactive (iOS transient state, e.g., Control Center)
      └─ Socket stays alive, no action needed
```

### Token Synchronization

Same pattern as web: polls `getMemoryToken()` every 1000ms. Auto-reconnects on token change, disconnects on token clear.

### Badge Polling

**File**: `src/contexts/BadgeContext.tsx`

```
Badge Update Sources (priority order):
  │
  ├─ 1. Socket event: badge:update (primary, real-time)
  │
  ├─ 2. Safety-net polling on socket lifecycle events:
  │     ├─ message:new
  │     ├─ newMessage
  │     └─ connect
  │
  ├─ 3. Fallback polling: Every 5 seconds when socket disconnected
  │
  └─ 4. App foreground: Single poll when returning from background
```

**Muted conversation filtering**:
- Key: `@chat_muted_conversations` in AsyncStorage
- Unread count formula: `unread = total - mutedUnread`

---

## 9. Push Notifications

### Token Lifecycle

**File**: `src/contexts/PushNotificationContext.tsx`

```
Authentication Complete
  │
  ├─ 1. Request OS notification permission
  │     ├─ Granted → Continue
  │     └─ Denied → Skip registration
  │
  ├─ 2. Get Expo push token
  │     └─ Expo.getExpoPushTokenAsync()
  │
  ├─ 3. Register token with backend
  │     └─ api.pushTokens.register(token)
  │
  ├─ 4. On foreground return:
  │     └─ Re-check permission (user may have toggled in Settings)
  │
  └─ 5. On logout:
        ├─ Unregister push token FIRST (critical ordering)
        │   └─ api.pushTokens.unregister(token)
        └─ THEN clear bearer token and session
```

**Critical ordering on logout**: Push token must be unregistered *before* clearing the auth token, otherwise the unregister API call will fail with 401.

### Notification Handling

| App State | Handler | Behavior |
|-----------|---------|----------|
| **Foreground** | `setNotificationHandler()` | Show banner, play sound, set badge |
| **Background (tap)** | `addNotificationResponseListener()` | Route to target screen |
| **Killed (tap)** | `getLastNotificationResponse()` | Checked on mount (500ms delay), route to screen |

### Notification Routing Table

**File**: `src/lib/notificationRouting.ts`

| Notification Type | Route |
|-------------------|-------|
| Support train | `/support-trains/{id}` |
| Post / Comment | `/post/{id}` |
| Gig | `/gig/{id}` |
| Listing | `/listing/{id}` |
| Home | `/homes/{id}` |
| Home dashboard | `/homes/{id}/dashboard` |
| Home member requests | `/homes/{id}/members?tab=requests` |
| Chat message | `/chat/{roomId}` |
| User | `/user/{userId}` |
| Connections | `/connections` |

---

## 10. Chat Architecture

### Dual-Mode Message Fetching

**File**: `src/hooks/useChatMessages.ts`

```
useChatMessages({ roomId?, otherUserId? })
  │
  ├─ Room Mode (roomId provided)
  │   └─ Fetch messages for specific room
  │
  └─ Person Mode (otherUserId provided)
      └─ Fetch conversation messages (may span multiple rooms)
```

### Message Merging Strategy

```typescript
mergeMessages(existingMessages, newMessages):
  1. Create Map of existing messages by ID
  2. For each incoming message:
     ├─ If exists → Merge (preserve local reactions)
     └─ If new → Add to map
  3. Sort all messages by created_at ascending
  4. Return as array

Result: Reactions are never lost on refresh,
        optimistic messages are preserved until confirmed
```

### Optimistic Rendering

```
User sends message
  │
  ├─ 1. Generate client-side ID (UUIDv4)
  ├─ 2. Add message to local state with _optimistic: true
  ├─ 3. Render immediately (shows in chat)
  ├─ 4. Emit via socket / POST to API
  │
  ├─ On success:
  │   └─ Replace client ID with server ID
  │
  └─ On failure:
      └─ Mark with error state, show retry button
```

### Real-Time Updates

| Socket Event | Handler |
|--------------|---------|
| `message:new` | Append to message list, trigger markRead (debounced 2s) |
| `messageUpdated` | Update message in-place |
| `messageDeleted` | Remove message from list |
| `message:react` | Update reaction counts on message |

### Message Type Resolution

```typescript
resolveMessageType(message):
  ├─ metadata.listingId exists → 'listing_offer'
  ├─ metadata.gigId exists → 'gig_offer'
  └─ otherwise → raw message_type
```

### Pagination

- Cursor-based: `nextCursor` from API response
- Direction: Backwards (`before` cursor parameter)
- `hasMore` flag tracks availability of older messages

---

## 11. Payment Integration

### Stripe Two-Intent Pattern

**File**: `src/hooks/useGigPaymentFlow.ts`

```
User initiates payment
  │
  ├─ 1. Call api.payments.getPaymentSheetParams(gigId)
  │     Returns: { clientSecret, isSetupIntent, ephemeralKey,
  │                customerId, publishableKey }
  │
  ├─ 2. ensureStripeInitialized(publishableKey)
  │     └─ Initialize Stripe SDK if not already
  │
  ├─ 3. initPaymentSheet(params)
  │     ├─ If isSetupIntent:
  │     │   └─ { setupIntentClientSecret: clientSecret, ... }
  │     └─ If paymentIntent:
  │         └─ { paymentIntentClientSecret: clientSecret, ... }
  │
  ├─ 4. presentPaymentSheet()
  │     └─ Native Stripe payment UI (card input, Apple Pay, etc.)
  │
  └─ 5. Handle result:
        ├─ Canceled → Info toast ("You can complete payment later")
        ├─ Error (missing API key) → Special error message
        └─ Success → Confirmation toast + refresh gig state
```

### Sensitive Action Guard

**File**: `src/hooks/useSensitiveActionGuard.ts`

Multi-factor authentication fallback for sensitive operations:

```
guard(options)
  │
  ├─ 1. Try authenticateWithDeviceCredential()
  │     ├─ Success → return true
  │     ├─ Cancelled → return false
  │     └─ Failed (hardware unavailable) → fall through
  │
  ├─ 2. Check api.auth.getAuthMethods()
  │     ├─ No password set → Navigate to /settings/password
  │     │   └─ return false (user must set password first)
  │     └─ Password exists → continue
  │
  ├─ 3. Show PasswordReauthProvider modal
  │     └─ User enters password
  │
  ├─ 4. Call api.auth.reauthenticate(password)
  │     ├─ Success → return true
  │     └─ Failure → Show error, return false
  │
  └─ Usage:
       const guard = useSensitiveActionGuard();
       const ok = await guard({
         reason: 'Confirm identity to update payment method',
         passwordTitle: 'Confirm password',
       });
       if (ok) { /* proceed with sensitive action */ }
```

---

## 12. Native Features

### Camera & Media

| Module | Usage |
|--------|-------|
| **expo-camera** | Direct camera capture in chat |
| **expo-image-picker** | Photo/video selection from library with compression |
| **expo-video** | Video playback in chat and feed |
| **expo-document-picker** | Document/file selection (PDF, Word, etc.) |

**Upload flow**: `pickUploadFiles()` utility abstracts camera/library/document selection, validates file types and sizes, then uploads via `api.upload.uploadFile()`.

### Location

| Module | Usage |
|--------|-------|
| **expo-location** | Foreground permission for current location |

- **Permission**: Requested on first use, `whenInUse` only
- **Background tracking**: Silent GPS updates for access checks (no background permission)
- **Reverse geocoding**: Location labels from coordinates
- **PantopusContext**: GPS coords fed into place/radius system

### Haptics

| Module | Usage |
|--------|-------|
| **expo-haptics** | Tactile feedback on interactions |

Used for: button presses, confirmations, long-press actions, pull-to-refresh completion.

### Secure Storage

| Module | Usage |
|--------|-------|
| **expo-secure-store** | Auth tokens (iOS Keychain / Android Keystore) |

Single key `pantopus_auth_session` stores JSON-stringified session object.

### Maps

| Module | Usage |
|--------|-------|
| **react-native-maps** | Native map views in discover, gigs, marketplace |
| **supercluster** | Client-side marker clustering |

**Clustering**: Same supercluster library as web, adapted for react-native-maps.
Maps render natively (Apple Maps on iOS, Google Maps on Android).

### Clipboard

| Module | Usage |
|--------|-------|
| **expo-clipboard** | Copy message text, share links |

---

## 13. Offline & Persistence

### AsyncStorage Keys

| Key | Data | Purpose |
|-----|------|---------|
| `@pantopus_context` | `{ place, radius, viewingAs, feedScope }` | Restore operating mode across sessions |
| `pantopus_app_lock_preferences_${userId}` | `{ enabled, securityLevel, ... }` | Per-user biometric preferences |
| `pantopus_app_lock_setup_prompt_${userId}` | `'pending' \| 'declined' \| 'enabled'` | Per-user setup prompt state |
| `pantopus_install_sentinel` | `'installed'` | Detect app uninstall/reinstall |
| `@chat_muted_conversations` | `string[]` (conversation IDs) | Muted chat filter |

### Draft Persistence

| Feature | Hook | Storage |
|---------|------|---------|
| **Listing creation** | `useListingDraft()` | React state (in-memory) |
| **Gig creation** | Form state in gig/new | React state (in-memory) |

### Connectivity Handling

```
Socket connected?
  ├─ YES → Real-time events, no polling
  └─ NO  →
      ├─ BadgeProvider: Poll every 5s
      ├─ API calls: Network errors formatted as transient
      ├─ Auth: Session refresh retried on foreground
      └─ UI: Offline indicator (if implemented)
```

### App Lifecycle & State Sync

| AppState Transition | Actions |
|---------------------|---------|
| `inactive → active` | (no action, iOS transient) |
| `background → active` | Reconnect socket, poll badges, check token expiry |
| `active → background` | Socket stays alive (OS may suspend) |

---

## 14. Build & Deployment

### App Identity

| Field | Value |
|-------|-------|
| **App name** | Pantopus |
| **Slug** | `pantopus-mobile` |
| **Version** | 1.2.0 |
| **iOS Bundle ID** | `com.pantopus.app` |
| **Custom scheme** | `pantopus://` |
| **Orientation** | Portrait only |
| **EAS Project ID** | `8a19618c-d169-4fae-bc64-5c01623f495e` |

### EAS Build Profiles

| Profile | Distribution | Android | iOS | Env |
|---------|-------------|---------|-----|-----|
| **development** | Internal | APK | Simulator | `APP_ENV=development` |
| **preview** | Internal | App bundle | Real device | `APP_ENV=preview` |
| **production** | Store | App bundle + auto-increment | Real device + auto-increment | `APP_ENV=production` |

### Store Submission

| Platform | Configuration |
|----------|--------------|
| **Android** | Track: production, Release status: draft |
| **iOS** | ASC App ID: `6760512315` |

### Expo Plugins

| Plugin | Configuration |
|--------|--------------|
| **expo-router** | File-based routing |
| **expo-font** | Custom font loading |
| **expo-secure-store** | Keychain/Keystore access |
| **expo-local-authentication** | Face ID permission string |
| **expo-notifications** | Icon + color (`#0284c7`) |
| **@stripe/stripe-react-native** | Merchant identifier (empty for default) |
| **expo-image-picker** | Camera + photo library permissions |
| **expo-camera** | Camera permission string |
| **expo-location** | Location when-in-use permission string |
| **expo-video** | Video playback |
| **expo-document-picker** | File access |
| **expo-web-browser** | In-app browser |
| **expo-build-properties** | iOS privacy manifests (UserDefaults, FileTimestamp, DiskSpace, SystemBootTime) |

### iOS Privacy Manifest

Required API declarations for App Store compliance:

| API Type | Reason Code |
|----------|-------------|
| UserDefaults | CA92.1 |
| FileTimestamp | C617.1 |
| DiskSpace | E174.1 |
| SystemBootTime | 35F9.1 |

### iOS Entitlements

| Entitlement | Value |
|-------------|-------|
| Apple Sign In | `["Default"]` |
| Associated Domains | `applinks:www.pantopus.com`, `applinks:pantopus.com` |

### iOS Info.plist

| Key | Value |
|-----|-------|
| `NSPhotoLibraryUsageDescription` | "Allow Pantopus to access your photos so you can share images in chat." |
| `NSCameraUsageDescription` | "Allow Pantopus to use your camera so you can capture photos in chat." |
| `NSLocationWhenInUseUsageDescription` | "Allow Pantopus to access your location so you can share it in chat." |
| `NSFaceIDUsageDescription` | "Allow Pantopus to use Face ID so you can unlock the app securely." |
| `LSSupportsOpeningDocumentsInPlace` | `true` |
| `ITSAppUsesNonExemptEncryption` | `false` |

---

## 15. Telemetry & Monitoring

### Auth Telemetry

**File**: `src/lib/authTelemetry.ts`

**Enabled via**: `app.json → extra.security.authTelemetryEnabled`

| Event | Trigger |
|-------|---------|
| `session_restore_ok` | Bootstrap completed successfully |
| `session_invalidated` | Session became invalid (refresh failed, forced logout) |
| `biometric_unlock_ok` | Successful biometric authentication |
| `biometric_unlock_cancel` | User cancelled or biometric failed |
| `biometric_key_invalidated` | Biometric hardware became unavailable |

Events are sent to the backend for debugging auth issues across devices.

### Signal Buffer

**File**: `src/lib/signal-buffer.ts`

- Batches analytics events in memory
- Flushed on periodic intervals
- **Critical**: Flushed before logout to ensure all events are delivered before token is cleared

---

## Appendix: File & Code Metrics

| Category | Count |
|----------|-------|
| Total screens / routes | ~29+ |
| Component files | ~235+ |
| Component directories | 54 |
| Custom hooks | 21 |
| Context providers | 9 |
| Lines in screens | ~55,579 |
| Lines in components | ~55,067 |

### Context Provider Count

| Provider | File |
|----------|------|
| AuthContext | `contexts/AuthContext.tsx` |
| AppLockContext | `contexts/AppLockContext.tsx` |
| PantopusContext | `contexts/PantopusContext.tsx` |
| IdentityContext | `contexts/IdentityContext.tsx` |
| LocationContext | `contexts/LocationContext.tsx` |
| SocketContext | `contexts/SocketContext.tsx` |
| BadgeContext | `contexts/BadgeContext.tsx` |
| ThemeContext | `contexts/ThemeContext.tsx` |
| PushNotificationContext | `contexts/PushNotificationContext.tsx` |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useChatMessages` | Real-time chat with optimistic rendering |
| `useGigPaymentFlow` | Stripe payment sheet integration |
| `useSensitiveActionGuard` | Biometric + password fallback |
| `useFeedData` | Feed pagination with location |
| `useGigsData` | Gig list with filters |
| `useHomeAccess` | Home membership verification |
| `useListingDraft` | Listing form state |
| `useAIChat` | AI assistant conversation |
| `useProfileForm` | Profile edit form |
| `usePromoModal` | Promotional modal triggers |
| `usePromoTriggers` | Promo trigger logic |
| `useSocket` | Socket.IO access |
| `useTheme` | Theme colors and dark mode |
| `useToast` | Toast notifications |
| `useConfirm` | Confirm dialogs |
| `usePasswordReauth` | Password re-authentication |
| `usePaymentSheet` | Payment sheet state |
| `useAddressValidation` | Address form validation |
| `useMailVerification` | Email verification |
| `useRadiusSuggestion` | Auto-radius suggestions |
| `useDismissGig` | Gig dismissal logic |
