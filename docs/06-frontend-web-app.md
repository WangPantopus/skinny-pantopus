# Pantopus Frontend Web Application Architecture

> Comprehensive design document for the Pantopus Next.js web application.
> Generated from full codebase analysis (April 2026).

---

## Table of Contents

| # | Section | Scope |
|---|---------|-------|
| 1 | [Architecture Diagram](#1-architecture-diagram) | High-level data flow, provider hierarchy |
| 2 | [Technology Stack](#2-technology-stack) | Framework, libraries, tooling |
| 3 | [Monorepo & Shared Packages](#3-monorepo--shared-packages) | `@pantopus/*` workspace packages |
| 4 | [Routing & Navigation](#4-routing--navigation) | App Router, route groups, middleware |
| 5 | [App Shell & Layout](#5-app-shell--layout) | Sidebar, header, responsive behavior |
| 6 | [Authentication Flow](#6-authentication-flow) | Cookie-based auth, CSRF, token refresh |
| 7 | [State Management](#7-state-management) | React Query, Context providers, stores |
| 8 | [Real-Time Architecture](#8-real-time-architecture) | Socket.IO, events catalog, reconnection |
| 9 | [API Layer](#9-api-layer) | Axios client, interceptors, error handling |
| 10 | [Key Feature Areas](#10-key-feature-areas) | Chat, feed, mailbox, marketplace, maps, gigs, payments, AI, homes, business |
| 11 | [Performance Patterns](#11-performance-patterns) | Lazy loading, virtualization, caching |
| 12 | [Styling & Theming](#12-styling--theming) | Tailwind, dark mode, CSS variables |

---

## 1. Architecture Diagram

```
 Browser
 +-----------------------------------------------------------------+
 |                                                                 |
 |  Next.js App Router (React 19)                                  |
 |  ┌───────────────────────────────────────────────────────────┐  |
 |  │  Root Layout                                              │  |
 |  │  ├─ QueryProvider (TanStack React Query)                  │  |
 |  │  ├─ ToastContainer                                        │  |
 |  │  └─ ConfirmDialog                                         │  |
 |  │     ┌──────────────────────────────────────────────────┐  │  |
 |  │     │  (app) Layout — Protected Routes                 │  │  |
 |  │     │  ├─ SocketProvider                               │  │  |
 |  │     │  ├─ BadgeProvider                                │  │  |
 |  │     │  ├─ MailboxProvider                              │  │  |
 |  │     │  └─ AppShell (sidebar + header + content)        │  │  |
 |  │     └──────────────────────────────────────────────────┘  │  |
 |  │     ┌──────────────────────────────────────────────────┐  │  |
 |  │     │  (auth) Layout — Public Auth Routes              │  │  |
 |  │     │  Login, Register, Reset Password, Verify Email   │  │  |
 |  │     └──────────────────────────────────────────────────┘  │  |
 |  │     ┌──────────────────────────────────────────────────┐  │  |
 |  │     │  Public Routes                                   │  │  |
 |  │     │  /, /[username], /gigs/[id], /posts/[id], etc.   │  │  |
 |  │     └──────────────────────────────────────────────────┘  │  |
 |  └───────────────────────────────────────────────────────────┘  |
 |                                                                 |
 +-----------+----------+------------------------------------------+
             |          |
    httpOnly cookies   WebSocket
    (same-origin)      (Socket.IO)
             |          |
 +-----------v----------v----------+       +-------------------+
 |   Express 5.1 Backend API       |       |   Stripe.js       |
 |   (Node.js 20)                  |       |   (client-side)   |
 |   ├─ REST endpoints             |       +-------------------+
 |   ├─ Socket.IO server           |
 |   ├─ Cookie auth (web)          |       +-------------------+
 |   └─ CSRF protection            |       |   Leaflet Tiles   |
 +--+----------+-------------------+       |   (map provider)  |
     |          |                           +-------------------+
     v          v
 Supabase    AWS S3 + CloudFront
 PostgreSQL  (media CDN)
```

### Provider Hierarchy (Authenticated Routes)

```
QueryProvider
  └─ ToastContainer
      └─ ConfirmDialog
          └─ SocketProvider
              └─ BadgeProvider
                  └─ MailboxProvider
                      └─ AppShell
                          └─ Page Component
```

---

## 2. Technology Stack

### Core Framework

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js | 15.1.6 | App Router, SSR, middleware |
| **UI Library** | React | 19.2.3 | Component model |
| **Language** | TypeScript | 5.7.2 | Type safety |
| **Styling** | Tailwind CSS | 3.4.17 | Utility-first CSS |
| **Build** | PostCSS + Autoprefixer | 8.4 / 10.4 | CSS processing |

### Data & State

| Library | Version | Purpose |
|---------|---------|---------|
| **TanStack React Query** | 5.90.21 | Server state caching, mutations, pagination |
| **React Context API** | (React 19) | Client-side global state (socket, badges, mailbox) |
| **Socket.IO Client** | 4.8.3 | Real-time WebSocket communication |

### UI & Interaction

| Library | Version | Purpose |
|---------|---------|---------|
| **Leaflet** | 1.9.4 | Interactive maps |
| **React Leaflet** | 5.0.0 | React bindings for Leaflet |
| **Supercluster** | 8.0.1 | Map marker clustering |
| **Emoji Mart** | 5.6.0 | Emoji picker for chat & posts |
| **Lucide React** | 0.575.0 | Icon library |
| **DOMPurify** | 3.3.2 | HTML sanitization (XSS prevention) |
| **CLSX** | 2.1.1 | Conditional className utilities |
| **TanStack React Virtual** | 3.x | Virtualized list rendering |

### Payments

| Library | Version | Purpose |
|---------|---------|---------|
| **@stripe/react-stripe-js** | 5.6.0 | Stripe Elements React components |
| **@stripe/stripe-js** | 8.7.0 | Stripe.js client SDK |

### Testing & Quality

| Tool | Version | Purpose |
|------|---------|---------|
| **Jest** | 30.2.0 | Unit testing |
| **Playwright** | 1.53.0 | E2E browser testing |
| **Testing Library** | 16.3.2 | React component testing |
| **ESLint** | 9.18.0 | Code linting |

---

## 3. Monorepo & Shared Packages

The web app lives in a pnpm workspace monorepo alongside the mobile app and shared packages:

```
frontend/
├─ apps/
│  ├─ web/          ← @pantopus/web (this doc)
│  └─ mobile/       ← pantopus-mobile (see 07-frontend-mobile-app.md)
└─ packages/
   ├─ api/          ← @pantopus/api
   ├─ types/        ← @pantopus/types
   ├─ theme/        ← @pantopus/theme
   ├─ utils/        ← @pantopus/utils
   └─ ui-utils/     ← @pantopus/ui-utils
```

### @pantopus/api

Axios-based HTTP client shared by web and mobile. Provides:

- **40+ endpoint namespaces**: auth, users, gigs, chat, homes, businesses, posts, mailbox (v2 Phase 2 & 3), marketplace, payments, wallet, AI, admin, notifications, relationships, location, upload, privacy, magic-tasks, support-trains, etc.
- **Token management**: Pluggable `TokenStorage` adapter — web uses httpOnly cookies, mobile uses SecureStore
- **Request interceptors**: Adds `x-token-transport: cookie` and `x-csrf-token` headers on web; Bearer token on mobile
- **Response interceptors**: 401 handling with token refresh mutex, error normalization
- **Helpers**: `apiRequest()`, `get()`, `post()`, `put()`, `del()`, `patch()`, `uploadFile()`, `postNoBody()`

### @pantopus/types

Shared TypeScript type definitions with subpath exports:

| Subpath | Types |
|---------|-------|
| `@pantopus/types/post` | Post, PostType, PostVisibility, PostFormat, FeedSurface, PostComment, PostCreator, PostingIdentity |
| `@pantopus/types/notification` | Notification types |
| `@pantopus/types/home` | OwnershipClaim, OwnershipClaimDetail, HouseholdResolutionState, SecuritySettings |
| `@pantopus/types/wallet` | Wallet, Transaction types |
| `@pantopus/types/business` | BusinessSeat, VerificationStatus, BusinessMembership, BusinessReview, BusinessHours |
| `@pantopus/types/identity` | Identity, Actor types |
| `@pantopus/types/relationship` | Relationship types |

### @pantopus/theme

Design tokens exported via `@pantopus/theme/tailwind`:

- Color system (primary, surface, text, border, status colors)
- Dark mode color variants
- Typography scales
- Spacing, radii, shadow definitions

### @pantopus/utils

- `API_BASE_URL` — base URL for API requests (empty string on web for same-origin proxy)
- Date formatting, text processing helpers
- Shared constants

### @pantopus/ui-utils

- `getInitials(name)` — avatar initial generation
- `PURPOSE_TO_POST_TYPE` — maps post purpose to type enum
- UI-specific helpers shared between web and mobile

---

## 4. Routing & Navigation

### Route Architecture (Next.js App Router)

```
src/app/
├─ layout.tsx                      ← Root: QueryProvider, Toast, ConfirmDialog
├─ middleware.ts                   ← Cookie-based auth checks
│
├─ (auth)/                         ← Public auth group
│  ├─ login/page.tsx
│  ├─ register/page.tsx
│  ├─ forgot-password/page.tsx
│  ├─ reset-password/page.tsx
│  ├─ verify-email/page.tsx
│  └─ verify-email-sent/page.tsx
│
├─ (app)/app/                      ← Protected authenticated group
│  ├─ layout.tsx                   ← AppShell + SocketProvider + BadgeProvider + MailboxProvider
│  │
│  ├─ hub/                         ← Dashboard
│  ├─ feed/                        ← Social feed
│  ├─ chat/                        ← Messaging
│  │  ├─ layout.tsx                ← Chat list + room split view
│  │  ├─ [roomId]/page.tsx         ← Chat room
│  │  ├─ conversation/[otherUserId]/page.tsx
│  │  └─ new/page.tsx              ← New conversation
│  │
│  ├─ gigs/[id]/                   ← Gig detail (v1)
│  ├─ gigs-v2/[id]/                ← Gig detail (v2)
│  ├─ my-gigs/ & my-gigs-v2/      ← User's posted gigs
│  ├─ my-bids/                     ← User's submitted bids
│  ├─ offers/                      ← Offer management
│  │
│  ├─ mailbox/                     ← Mailbox system
│  │  ├─ layout.tsx                ← MailboxProvider, MailboxNav
│  │  ├─ [drawer]/layout.tsx       ← Drawer-specific layout
│  │  └─ [drawer]/[itemId]/page.tsx
│  │
│  ├─ marketplace/                 ← Browse listings
│  ├─ my-listings/                 ← User's listings
│  ├─ saved-listings/              ← Saved/bookmarked listings
│  ├─ listing-offers/              ← Listing offer management
│  │
│  ├─ homes/[id]/                  ← Household dashboard
│  ├─ businesses/[id]/             ← Business dashboard
│  │  ├─ dashboard/
│  │  ├─ chat/
│  │  └─ pages/[pageId]/edit/
│  │
│  ├─ discover/                    ← Location-based discovery
│  ├─ discover-hub/                ← Curated discovery
│  ├─ map/                         ← Full-screen map
│  │
│  ├─ wallet/                      ← Wallet & payments
│  ├─ invoice/                     ← Invoice management
│  ├─ profile/                     ← User profile
│  ├─ settings/                    ← User settings
│  │  ├─ payments/
│  │  └─ notifications/
│  ├─ notifications/               ← Notification center
│  ├─ connections/                 ← Network management
│  │
│  ├─ support-trains/              ← Support trains
│  ├─ professional/                ← Professional verification
│  ├─ landlord/                    ← Landlord tools
│  ├─ control-center/              ← Admin dashboard
│  ├─ admin/                       ← Admin tools
│  └─ address-verify/              ← Address verification
│
├─ [username]/page.tsx             ← Public user profile
├─ gigs/[id]/page.tsx              ← Public gig detail
├─ posts/[id]/page.tsx             ← Public post detail
├─ listing/[id]/page.tsx           ← Public marketplace listing
├─ homes/[id]/page.tsx             ← Public home detail
├─ b/[username]/[slug]/page.tsx    ← Public business page
├─ guest/[token]/page.tsx          ← Guest access
├─ invite/[token]/page.tsx         ← Invite acceptance
├─ shared/[token]/page.tsx         ← Shared links
├─ support-trains/[id]/page.tsx    ← Public support train
│
└─ Static pages: /, /about, /terms, /privacy, /child-safety, /contact
```

### Middleware Route Protection

**File**: `src/middleware.ts`

The middleware runs on every request matching `['/', '/app/:path*', '/login', '/register']` and enforces auth routing rules:

```
Request
  │
  ├─ Has pantopus_session=1 AND pantopus_access cookie?
  │   ├─ YES (authenticated)
  │   │   ├─ Visiting / → redirect to /app/hub
  │   │   ├─ Visiting /login or /register → redirect to /app/hub
  │   │   └─ Visiting /app/* → allow through
  │   │
  │   └─ NO (unauthenticated)
  │       ├─ Has session flag but no access token? (stale session)
  │       │   ├─ Visiting /app/* → clear cookies, redirect to /login?redirectTo=...
  │       │   └─ Visiting / or auth page → clear cookies, allow through
  │       │
  │       ├─ Visiting /app/gigs/[id] → redirect to /gigs/[id] (public alias)
  │       ├─ Visiting /app/marketplace/[id] → redirect to /listing/[id]
  │       ├─ Visiting /app/feed/post/[id] → redirect to /posts/[id]
  │       │
  │       └─ Visiting /app/* → redirect to /login?redirectTo=...
  │
  └─ All other routes → allow through
```

**Cookies used by middleware**:

| Cookie | Purpose | Flags |
|--------|---------|-------|
| `pantopus_access` | JWT access token | httpOnly, Secure, SameSite |
| `pantopus_session` | Session presence flag (`"1"`) | Non-httpOnly (JS-visible) |
| `pantopus_refresh` | Refresh token | httpOnly, path: `/api/users/refresh` |
| `pantopus_csrf` | CSRF token | Non-httpOnly (read by JS for headers) |

---

## 5. App Shell & Layout

**File**: `src/components/AppShell.tsx`

The AppShell is the main layout wrapper for all authenticated routes. It provides a responsive sidebar + header + content area.

### Sidebar Architecture

```
+--+----+--+----------------------------------------------+
|  |    |  |                                              |
|  | S  |  |          Main Content Area                   |
|  | I  |  |          (page component)                    |
|  | D  |  |                                              |
|  | E  |  |                                              |
|  | B  |  |                                              |
|  | A  |  |                                              |
|  | R  |  |                                              |
|  |    |  |                                              |
+--+----+--+----------------------------------------------+
```

**Responsive behavior**:

| Viewport | Sidebar state | Width |
|----------|--------------|-------|
| Desktop (expanded) | Full sidebar with labels | 240 px |
| Desktop (collapsed) | Icon-only rail | 64 px |
| Desktop (hover) | Overlay expansion on hover | 240 px overlay |
| Mobile | Hidden, drawer toggle | Full-width drawer |

**State persistence**: Collapse state saved to `localStorage` key `pantopus-sidebar-collapsed`.

### Context-Aware Navigation

The sidebar renders different navigation links based on the current URL context:

| URL Pattern | Sidebar Variant | Navigation Items |
|-------------|----------------|-----------------|
| Default | `PersonalSidebarContent` | Hub, Feed, Gigs, Chat, Mailbox, Marketplace, Discover, Map, Profile, Settings |
| `/app/homes/[id]` | `HomeSidebarContent` | Home-specific: members, bills, tasks, calendar, packages, issues, vendors |
| `/app/businesses/[id]` | `BusinessSidebarContent` | Business-specific: dashboard, chat, pages, team, settings |

### Header Components

- **Search bar** (desktop only)
- **NotificationBell** with unread badge count
- **Chat badge** with unread message count
- **ProfileToggle** — profile avatar menu with context switching

### Global Modals

The AppShell manages two global composition modals, triggered via window events:

| Event | Modal | Purpose |
|-------|-------|---------|
| `FEED_COMPOSER_OPEN_EVENT` | PostComposer | Create new feed post |
| `MAGIC_TASK_OPEN_EVENT` | MagicTaskComposer | AI-assisted task creation |

---

## 6. Authentication Flow

### Web Authentication Model

The web app uses **httpOnly cookie-based authentication** with CSRF protection. The browser never sees the JWT access token directly — it is stored in an httpOnly cookie managed by the backend.

```
                          Login / Register
                                │
                                v
 ┌─────────────────────────────────────────────────────────────┐
 │  POST /api/auth/login                                       │
 │  Backend sets cookies:                                       │
 │    pantopus_access  = <JWT>     (httpOnly, Secure, SameSite) │
 │    pantopus_refresh = <token>   (httpOnly, path=/api/users/refresh) │
 │    pantopus_session = "1"       (non-httpOnly, JS-visible)   │
 │    pantopus_csrf    = <token>   (non-httpOnly, JS-readable)  │
 └──────────────────────────────────┬──────────────────────────┘
                                    │
                                    v
 ┌─────────────────────────────────────────────────────────────┐
 │  Subsequent API requests (same-origin proxy)                 │
 │  Request interceptor adds:                                   │
 │    x-token-transport: cookie                                 │
 │    x-csrf-token: <from pantopus_csrf cookie>                 │
 │  Cookies sent automatically (same-origin + withCredentials)  │
 └──────────────────────────────────┬──────────────────────────┘
                                    │
                                    v
 ┌─────────────────────────────────────────────────────────────┐
 │  401 Response (token expired)                                │
 │  Response interceptor:                                       │
 │    1. Acquire refresh mutex (prevent concurrent refreshes)   │
 │    2. POST /api/users/refresh (refresh cookie sent auto)     │
 │    3a. Success → backend sets new cookies → retry request    │
 │    3b. Failure → clear session → redirect to /login          │
 └─────────────────────────────────────────────────────────────┘
```

### CSRF Protection

All mutating requests (POST, PUT, PATCH, DELETE) include `x-csrf-token` header read from the `pantopus_csrf` cookie. The backend validates this token against the session.

### Auth Events

The API client emits lifecycle events via callback:

| Event | Trigger | Action |
|-------|---------|--------|
| `session_refresh_ok` | Token refreshed successfully | Continue normal operation |
| `session_refresh_failed` | Refresh token invalid | Clear session, redirect to login |
| `session_invalidated` | Session forcefully cleared | Redirect to login |

---

## 7. State Management

### Server State — TanStack React Query

**Configuration** (`src/lib/query-provider.tsx`):

| Setting | Value | Rationale |
|---------|-------|-----------|
| `staleTime` | 30 seconds | Prevents over-fetching on re-renders |
| `retry` | 2 attempts | Skips retry on 4xx client errors |
| `refetchOnWindowFocus` | `false` | Prevents data flashing when switching tabs |
| `mutations.retry` | `false` | Mutations should not auto-retry |

### Client State — React Context Providers

| Context | File | Purpose | Key State |
|---------|------|---------|-----------|
| **SocketProvider** | `src/contexts/SocketContext.tsx` | Socket.IO connection lifecycle | `socket`, `connected` |
| **BadgeProvider** | `src/contexts/BadgeContext.tsx` | Notification/chat/offer badge counts | `unreadMessages`, `totalMessages`, `pendingOffers`, `notifications` |
| **MailboxProvider** | `src/contexts/MailboxContext.tsx` | Mailbox drawer state, themes | `activeDrawer`, `selectedItemId`, `activeTheme`, `travelModeActive` |

### UI State — Store Pattern

Lightweight zustand-style stores for ephemeral UI state:

| Store | File | Purpose |
|-------|------|---------|
| `toast-store` | `src/lib/toast-store.ts` | Toast notification queue |
| `confirm-store` | `src/lib/confirm-store.ts` | Confirm dialog state |
| `promo-modal-store` | `src/lib/promo-modal-store.ts` | Promotional modal triggers |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useSocket()` | Access Socket.IO instance |
| `useSocketConnected()` | Check socket connection status |
| `useSocketEvent(event, handler)` | Subscribe to socket events with auto-cleanup |
| `useSocketEmit()` | Emit socket events safely |
| `useBadges()` | Access badge counts |
| `useChatMessages()` | Chat message fetching, real-time sync, reactions |
| `useFeedData()` | Feed pagination with location filtering |
| `useGigsData()` | Gig list with status/category filters |
| `useHomeData()` | Household data sync |
| `useHomeAccess()` | Home membership verification |
| `useHomePanels()` | Home panel slide-over state |
| `useViewerHome()` | Detect viewer's home from URL |
| `useListingDraft()` | Draft persistence for listing creation |
| `useGigPaymentFlow()` | Stripe payment sheet integration |
| `useAIChat()` | AI assistant conversation state |
| `useProfileForm()` | Profile edit form state |
| `usePromoTriggers()` | Promotional modal logic |
| `useFeedPreferences()` | Feed filter preferences |
| `useMailVerification()` | Email verification flows |
| `useConfirm()` | Confirm dialog management |
| `useToast()` | Toast notification management |
| `useDesktopNotifications()` | Browser notification permission |
| `useAddressValidation()` | Address form validation |
| `useRadiusSuggestion()` | Auto-radius suggestions |
| `useAreaPicker()` | Area/region picker state |
| `useReviewMedia()` | Review media upload |
| `useDismissGig()` | Gig dismissal logic |

---

## 8. Real-Time Architecture

### Socket.IO Configuration

**File**: `src/contexts/SocketContext.tsx`

| Setting | Value |
|---------|-------|
| **Server URL** | `API_BASE_URL` (same-origin on web) |
| **Auth** | `{ token: authToken }` in handshake |
| **Transports** | `['websocket', 'polling']` (WebSocket first, polling fallback) |
| **withCredentials** | `true` (send cookies as fallback auth) |
| **Reconnection attempts** | `Infinity` |
| **Reconnection delay** | 2 s initial, 30 s max (exponential backoff) |

### Token Synchronization

The SocketProvider polls `getAuthToken()` from the API package every 1 second. If the token changes (e.g., after a refresh), the socket disconnects and reconnects with the new token. If the token is cleared (logout), the socket disconnects entirely.

### Socket Events Catalog

#### Badge & Notification Events

| Event | Direction | Payload | Handler |
|-------|-----------|---------|---------|
| `badge:update` | Server → Client | `{ unreadMessages, totalMessages, pendingOffers, notifications }` | BadgeProvider updates counts |
| `notification:new` | Server → Client | Notification object | NotificationBell triggers |

#### Chat Events

| Event | Direction | Payload | Handler |
|-------|-----------|---------|---------|
| `message:new` | Server → Client | Message object | ChatRoomView appends message |
| `message:react` | Client → Server | `{ messageId, emoji }` | Server processes, broadcasts update |
| `message:react` | Server → Client | Updated reactions | ChatRoomView updates reaction counts |
| `messageUpdated` | Server → Client | Updated message | ChatRoomView updates in-place |
| `messageDeleted` | Server → Client | `{ messageId }` | ChatRoomView removes message |

#### Gig Events

| Event | Direction | Payload | Handler |
|-------|-----------|---------|---------|
| `gig:join` | Client → Server | `{ gigId }` | Joins gig room for updates |
| `gig:leave` | Client → Server | `{ gigId }` | Leaves gig room |
| `gig:status-change` | Server → Client | `{ gigId, status }` | GigDetail updates status |
| `gig:bid-update` | Server → Client | Bid object | GigDetail refreshes bids |
| `gig:bid-accepted` | Server → Client | `{ gigId, bidId }` | GigDetail shows acceptance |
| `gig:payment-update` | Server → Client | Payment status | GigDetail updates payment |
| `gig:completion-update` | Server → Client | Completion data | GigDetail shows completion |
| `gig:qa-update` | Server → Client | Q&A entry | GigDetail appends Q&A |
| `gig:eta-update` | Server → Client | ETA data | GigDetail updates ETA tracker |

### Fallback Polling (BadgeProvider)

When the socket is disconnected, the BadgeProvider falls back to HTTP polling:

```
Socket connected?
  ├─ YES → Listen for badge:update events (real-time)
  └─ NO  → Poll every 5 seconds via:
            ├─ notifications.getUnreadCount()
            ├─ chat.getChatStats()
            └─ gigs.getReceivedOffers()
```

---

## 9. API Layer

### Axios Client Configuration

**File**: `packages/api/src/client.ts`

| Setting | Web Value | Mobile Value |
|---------|-----------|-------------|
| **Base URL** | `''` (same-origin proxy) | `EXPO_PUBLIC_API_URL` or auto-detected dev IP |
| **Timeout** | 30 s | 30 s |
| **Content-Type** | `application/json` | `application/json` |

### Request Interceptor (Web)

Every outgoing request on web adds:

```
Headers:
  x-token-transport: cookie
  x-csrf-token: <value from pantopus_csrf cookie>   ← only on POST/PUT/PATCH/DELETE
```

### Response Interceptor (Error Handling)

```
API Error Response
  │
  ├─ 401 Unauthorized
  │   ├─ Acquire refresh mutex (prevents concurrent refresh attempts)
  │   ├─ POST /api/users/refresh
  │   │   ├─ Success → Retry original request with new cookies
  │   │   └─ Failure → Emit session_refresh_failed → Clear session → Redirect
  │   └─ If mutex already held → Queue request, retry after mutex releases
  │
  ├─ 4xx Client Error
  │   └─ Normalize to: { message, statusCode, data, validationErrors, validationDetails }
  │
  ├─ 5xx Server Error
  │   └─ Emit session_refresh_failed (transient) → Keep session valid
  │
  └─ Network Error
      └─ Format as: "Network error: cannot reach API at [url]"
```

### Endpoint Namespaces (40+)

| Namespace | Key Endpoints |
|-----------|--------------|
| `auth` | login, register, logout, forgotPassword, resetPassword, oauthCallback |
| `users` | getProfile, updateProfile, follow, unfollow, getFollowers, getSignals |
| `gigs` | browse, create, update, getBids, placeBid, acceptBid, complete, getReceivedOffers |
| `chat` | getRooms, getMessages, sendMessage, reactToMessage, getChatStats, getPreBidStatus |
| `homes` | getHome, getMembers, inviteMember, claimOwnership, getActivities, getBills, getTasks |
| `businesses` | create, verify, getTeam, manageSeat, getDashboard, updatePages |
| `posts` | create, getFeed, getComments, addComment, react, getDiscovery |
| `mailbox` | getDrawer, getItem, react, getVault, getEarn, setVacationHold (v2 Phase 2 & 3) |
| `marketplace` | getListings, createListing, saveItem, makeOffer, getOffers |
| `payments` | getPaymentMethods, createPaymentIntent, getPayoutSettings, connectStripe |
| `wallet` | getBalance, getTransactions, requestPayout |
| `ai` | chat, getDrafts, summarize |
| `notifications` | getAll, markRead, getUnreadCount |
| `relationships` | getConnections, sendRequest, accept, endorse, getEndorsements |
| `location` | resolveLocation, reverseGeocode, getSavedPlaces |
| `upload` | uploadFile, getPresignedUrl |
| `admin` | getUsers, getStats, moderate |
| `privacy` | getSettings, updateSettings, deleteAccount |
| `magicTasks` | create, getDrafts, refine |
| `supportTrains` | get, join, contribute |
| `professional` | getVerification, submitVerification |
| `invoice` | create, getInvoices, markPaid |

---

## 10. Key Feature Areas

### 10.1 Chat System

**Components**: `src/components/chat/` (23 files)

| Component | Purpose |
|-----------|---------|
| `ChatRoomView` | Main chat room with messages, input, actions |
| `ChatMessageBubble` | Individual message rendering |
| `ChatMessageActions` | Reaction picker, edit, delete, copy |
| `ChatReactions` | Reaction display and interaction |
| `ChatLightbox` | Image viewer for attachments |
| `ChatFloatingWidget` | Quick-access chat from other pages |
| `GigPickerModal` | Attach gig to chat message |
| `ListingPickerModal` | Attach listing to chat message |

**Key behaviors**:
- Real-time message delivery via Socket.IO
- Emoji reactions with callback-based socket events
- Message types: text, listing_offer, gig_offer, attachments
- Pre-bid status checking before gig-related messages
- Historical context loading from related rooms
- Business identity detection for sending as business

### 10.2 Feed & Post Composer

**Components**: `src/components/feed/` (21 files)

**PostComposer** (`PostComposer.tsx` — 799 lines):

| Feature | Details |
|---------|---------|
| **Post types** | Event, deal, lost-found, safety alert, service offer, marketplace |
| **Visibility** | Public, neighborhood, followers, connections, household |
| **Audience targeting** | Location-based (nearby, saved_place), follower/connection based |
| **Media** | File upload with drag-drop, validation, progress tracking |
| **AI helper** | InlineDraftHelper for content suggestions |
| **Safety checks** | Pre-publish content validation |

**Feed rendering**:
- PostCard list with infinite scroll pagination
- Comment threading with nested replies
- Link preview cards
- Post visibility/targeting indicators

### 10.3 Mailbox System

**Components**: `src/components/mailbox/` (35 files)
**Routes**: `src/app/(app)/app/mailbox/`

The mailbox is the most complex single feature by lines of code. It implements a virtual mail system with four drawer types:

| Drawer | Purpose | Key Features |
|--------|---------|-------------|
| **Personal** | User's personal mail | Items, reactions, translations, assets, memories |
| **Home** | Household mail | Shared with household members |
| **Business** | Business mail | Business-scoped correspondence |
| **Earn** | Rewards & offers | Wallet balance, offer redemption, transaction history |

**Additional subsystems**:
- **Vault**: Folder-based archival with search
- **Mail Day**: Daily summary with priority routing
- **Vacation hold**: Scheduled holds with mail action routing
- **Community**: Shared mail, reactions, stamps
- **Coupon pipeline**: Complex state machine for coupon workflows
- **Seasonal themes**: CSS-customizable accent colors (`--mailbox-accent`, `data-mailbox-theme`)
- **Travel mode**: Polling every 5 minutes for vacation hold status
- **Virtualized list**: TanStack React Virtual for performance with 1000+ items

### 10.4 Marketplace

**Components**: `src/components/marketplace-browse/`

| Feature | Implementation |
|---------|---------------|
| **Browse** | Category, condition, location filters |
| **Map view** | Supercluster marker clustering |
| **Carousels** | Featured, popular, trending listings |
| **Quick listing** | Snap-sell modal for quick creation |
| **Search** | Autocomplete with advanced filters |
| **Offers** | Accept/reject listing offers |
| **Statuses** | Active, sold, draft listing states |

### 10.5 Maps & Location

**Components**: `src/components/map/`, `src/components/discover/`

| Technology | Purpose |
|------------|---------|
| **Leaflet + React Leaflet** | Interactive map rendering |
| **Supercluster** | Client-side marker clustering |
| **Tile caching** | Offline-capable tile layer |
| **LocationPicker** (1.8k lines) | Address autocomplete + map pin selection |

**Map interactions**:
- Bounds-based API fetching for discover features
- Zoom-responsive clustering (markers merge/split with zoom level)
- Animated pin rendering
- Debounced bounds tracking to prevent over-fetching
- Offline indicator when tiles unavailable
- Radius-based content filtering

### 10.6 Gig System

**Components**: `src/components/gig-detail/`, `src/components/gig-detail-v2/`, `src/components/gig-v2-create/`

**Gig Detail** (v2 — primary):
- Tabbed interface: Overview, Bids, Payment, Completion, Q&A
- Real-time updates via socket room (`gig:join`/`gig:leave`)
- Live ETA tracking for time-based gigs
- Bid management: accept, decline, counter-offer
- Payment tracking: escrow, payout, dispute handling
- Completion evidence: photo/document upload and approval

**Gig Creation** (v2 — 17 files):
- Multi-step wizard with form validation
- Location binding from PantopusContext
- Media upload for gig photos
- AI-assisted task description (MagicTask integration)

### 10.7 Payments & Wallet

**Components**: `src/components/payments/`, `src/components/wallet/`

| Feature | Implementation |
|---------|---------------|
| **Stripe Elements** | `@stripe/react-stripe-js` for card input UI |
| **Card management** | Add/remove payment methods |
| **Payout setup** | Stripe Connect onboarding flow |
| **Wallet balance** | Real-time balance display |
| **Transactions** | History with filtering |
| **Withdrawal** | Modal flow for payout requests |
| **Tip modal** | Post-gig tipping |
| **Payment breakdown** | Itemized payment display |

### 10.8 AI Features

**Components**: `src/components/ai-assistant/` (6 files)

| Component | Purpose |
|-----------|---------|
| `AIChatView` | Full AI conversation interface |
| `AIMessageBubble` | AI response rendering |
| `AIDraftCard` | Draft content suggestions |
| `ClarifyingQuestionsPanel` | Follow-up question prompts |
| `InlineDraftHelper` | In-context AI writing assistance |
| `InspirationPrompts` | Suggested prompts for new conversations |

**MagicTask** (`src/components/magic-task-v2/` — 12 files):
- AI-assisted gig/task creation
- Live streaming response panel
- Clarifying question flow
- Draft refinement

### 10.9 Homes & Household

**Components**: `src/components/home/` (45 files), `src/components/homes/`

The home/household system manages physical addresses and their occupants:

| Feature | Purpose |
|---------|---------|
| **Member management** | Invite, approve, remove household members |
| **Bills tracking** | Shared household bills with budget cards |
| **Task lists** | Household chore/task management |
| **Calendar** | Household event calendar |
| **Package tracking** | Package delivery tracking |
| **Issue tracking** | Home maintenance issues |
| **Vendor management** | Service provider contacts |
| **Residency claims** | Ownership/tenancy verification |
| **Audit log** | Activity timeline for household changes |

**Slide panels**: Task, Bill, Package, Issue — each with dedicated panel components for detail views.

### 10.10 Business Management

**Components**: `src/components/business/`

| Feature | Purpose |
|---------|---------|
| **Block editor** | Drag-drop page builder with 8+ block types |
| **Block renderer** | Renders blocks: text, image, map, gallery, CTA, video, etc. |
| **Seat management** | Team member roles and permissions |
| **Business IAM** | Access control for business features |
| **Dashboard** | Business analytics and overview |
| **Verification** | Business identity verification flow |

---

## 11. Performance Patterns

### Lazy Loading

- **Suspense boundaries** on all protected route groups
- **Dynamic imports** for heavy components (map, editor, payment forms)
- **Next.js Image** with `unoptimized` flag for external CDN URLs

### Virtualization

- **TanStack React Virtual** for mailbox lists (handles 1000+ items)
- Scroll-based pagination for feed, chat history, marketplace

### Caching

| Layer | Strategy |
|-------|----------|
| **React Query** | 30s stale time, no refetch on window focus |
| **Map tiles** | Client-side tile caching layer |
| **Sidebar state** | localStorage persistence |
| **Badge counts** | In-memory with socket + polling sync |

### Clustering

- **Supercluster** for marketplace and discover map views
- Client-side clustering with zoom-responsive density
- Reduces DOM nodes from thousands of markers to manageable cluster count

### Query Optimization

- Cursor-based pagination for chat messages
- Offset-based pagination for mailbox items
- React Query cache key factories organized by domain (100+ key patterns in mailbox alone)
- Optimistic mutations for reactions, reads, sends

---

## 12. Styling & Theming

### Tailwind CSS

- Utility-first approach across all components
- Responsive breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Dark mode via `dark:` prefix classes

### Color System

Colors defined in `@pantopus/theme` and consumed via Tailwind config:

| Token | Purpose |
|-------|---------|
| `primary` | Brand color, primary actions |
| `surface.base` | Page background |
| `surface.card` | Card/panel backgrounds |
| `text.primary` | Main text color |
| `text.secondary` | Subdued text |
| `border` | Border colors |
| `status.*` | Success, warning, error, info |

### Dark Mode

- System-preference detection via `prefers-color-scheme`
- All components use `dark:` Tailwind variants
- `@pantopus/theme` exports separate dark color tokens

### Seasonal Themes (Mailbox)

The mailbox supports seasonal themes via CSS custom properties:

```css
[data-mailbox-theme="spring"] {
  --mailbox-accent: #10b981;
}
[data-mailbox-theme="winter"] {
  --mailbox-accent: #3b82f6;
}
```

Themes are fetched from the API and applied as data attributes on the mailbox container.

### Reusable UI Components

**Directory**: `src/components/ui/` (19 components)

| Component | Purpose |
|-----------|---------|
| `ToastContainer` | Toast notification display |
| `ConfirmDialog` | Confirmation modal |
| `ModalShell` | Reusable modal wrapper |
| `Pill` | Tag/chip component |
| `StarRating` | Rating display/input |
| `Skeleton` | Loading placeholder |
| `Shimmer` | Animated loading effect |

---

## Appendix: File & Code Metrics

| Category | Count |
|----------|-------|
| Total `.ts` / `.tsx` files | ~696 |
| Route files (pages) | ~184 |
| Component files | ~396 |
| Component directories | 40 |
| Custom hooks | 23 |
| API endpoint namespaces | 40+ |
| Type definition subpaths | 7 |
| UI primitive components | 19 |
| Context providers | 3 (app-level) |
| Store modules | 3 |

### Largest Component Suites

| Feature Area | File Count |
|-------------|-----------|
| Home / Household | 45 |
| Mailbox | 35 |
| Chat | 23 |
| Feed | 21 |
| Gig Create v2 | 17 |
| Discover | 13 |
| Payments | 12 |
| AI Assistant | 6 |
