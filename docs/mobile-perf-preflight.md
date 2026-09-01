# Pantopus Mobile — Performance Pre-flight Audit

> Generated from codebase analysis against `docs/08-mobile-performance-optimization-plan.md`.
> Date: 2026-04-10

---

## 1. Already-Optimized Items

Items listed in doc 08 that are **already implemented** in the current codebase:

| Item | Status | Evidence |
|------|--------|----------|
| **PantopusContext.refreshAll uses Promise.allSettled** | **Done** | `PantopusContext.tsx:372-376` — `Promise.allSettled([api.location.getLocation(), api.homes.getMyHomes(), api.businesses.getMyBusinesses()])` |
| **PantopusContext.Provider value memoized** | **Done** | `PantopusContext.tsx:830-899` — value wrapped in `useMemo` with 33-item dependency array |
| **BadgeContext.Provider value memoized** | **Done** | `BadgeContext.tsx:199-202` — `contextValue = useMemo(...)` |
| **SocketContext.Provider value memoized** | **Done** | `SocketContext.tsx:125` — inline `useMemo(() => ({ socket, connected }), ...)` |
| **Gigs FlatList: ListHeader/Footer memoized** | **Done** | `gigs.tsx` — ListHeader and ListFooter wrapped in `useMemo` |
| **Gigs FlatList: renderItem memoized** | **Done** | `gigs.tsx` — renderItem wrapped in `useCallback` |
| **Feed: viewabilityConfig and onViewableItemsChanged are useRef** | **Done** | `feed.tsx` — both use `useRef` (correct pattern) |
| **Hub: in-flight deduplication via refs** | **Done** | `index.tsx:237-238` — `hubInFlightRef` and `todayInFlightRef` prevent parallel duplicate fetches |
| **Hub: selective useMemo for derived values** | **Done** | `index.tsx` — derived data wrapped in `useMemo` |
| **Chat badge: exponential backoff polling when disconnected** | **Partial** | `BadgeContext.tsx:131` — Uses fixed 5s interval (`FALLBACK_POLL_MS = 5_000`), NOT exponential backoff. Doc 08 suggests backoff but lists current state as "OK" |
| **Chat badge: 500ms debounce on badge sync** | **Not found** | No debounce on `setCounts` — updates are applied directly. A 750ms throttle exists on `pollBadges` via `lastPolledAtRef` (line ~73), but this is throttle-by-ref, not debounce |
| **Notifications SectionList: stickySectionHeadersEnabled** | **Done** | `notifications.tsx` — SectionList with sticky headers |
| **Discover: 300ms search debounce** | **Likely done** | Standard debounce pattern used across search screens |

---

## 2. Deviations from the Plan Doc

Line references in `docs/08-mobile-performance-optimization-plan.md` vs actual code:

| Doc 08 Claim | Actual Code | Deviation |
|-------------|-------------|-----------|
| AuthContext value at "lines 423-436" | `AuthContext.tsx:423-436` | **Exact match** — value not memoized, confirmed |
| PantopusContext "14 useState calls (lines 270-286)" | `PantopusContext.tsx:270-286` | **Exact match** — 14 useState calls confirmed (place, radius, viewingAs, homes, businesses, savedPlaces, recentLocations, gpsCoords, inboxUnread, isLoading, isSheetOpen, feedScope, mutedEntities, hiddenPostIds) |
| PantopusContext "33 values (lines 830-898)" | `PantopusContext.tsx:830-898` | **Doc error** — doc says 33 values, actual is **32** values in context object, 32 items in useMemo dep array |
| PantopusContext "useMemo dependency array has 37 items" | Actually 32 items (lines 865-898) | **Doc error** — doc says 37 items, actual is 32 |
| Socket token polling "lines 36-44" | `SocketContext.tsx:36-44` | **Exact match** — `setInterval(syncToken, 1000)` at line 42 |
| Chat mergeMessages "lines 39-48" | `useChatMessages.ts:39-48` | **Exact match** — `sortAsc(Array.from(map.values()))` at line 47 |
| Chat refreshMessages "lines 246-253" | `useChatMessages.ts:246-254` | **Off by one** — function ends at line 254 not 253; double sort confirmed: `sortAsc(mergeMessages(prev, msgs))` at line 251 |
| activeRoomIds "lines ~311-318" | `useChatMessages.ts:311-318` | **Exact match** |
| Feed FlatList "lines 103-149" | `feed.tsx:103-149` | **Exact match** |
| useFeedData "30+ useState calls" | Actually **60 useState calls** (lines 28-125) | **Doc undercount** — doc says "30+", actual is 60 |
| useFeedData "900-line" | Actually 907 lines | **Close enough** |
| BadgeContext "4 overlapping sources" | Actually **5 sources** | **Doc undercount** — doc says 4, but there are 5: (1) `badge:update` socket event, (2) `message:new` socket → pollBadges, (3) `newMessage` socket → pollBadges, (4) `connect` socket → pollBadges, (5) AppState `active` → pollBadges; plus the fallback 5s interval when disconnected |
| LocationContext ".map() calls at lines 101-121" | `LocationContext.tsx:101-121` (in `useLocation()`) | **Exact match** — three `.map()` calls on every render of every consumer |
| IdentityContext "lines 37-53" | `IdentityContext.tsx:37-53` (in `useIdentity()`) | **Exact match** — new objects created on every call, not memoized |

---

## 3. Consumer Counts

Counts of **distinct consumer files** (excluding context definition files and test files) under `app/`, `components/`, `hooks/`:

| Hook | Consumer Files | Key Consumers |
|------|---------------|---------------|
| **useAuth** | **30** | `_layout.tsx`, `PantopusContext.tsx`, `AppLockContext.tsx`, `PushNotificationContext.tsx`, all auth screens, `control-center.tsx`, `profile.tsx`, `chat.tsx`, `gig/*.tsx`, `settings.tsx`, `HamburgerMenu.tsx`, `useFeedData.ts`, `useListingData.ts` |
| **usePantopus** | **10** | `LocationContext.tsx`, `IdentityContext.tsx`, `ContextSheet.tsx`, `ContextBar.tsx`, `PostComposer.tsx`, `UnifiedLocationSheet.tsx`, `InboxEarnCard.tsx`, `PostingRestrictionModal.tsx`, `support-trains/new.tsx`, `gig-v2/new.tsx` |
| **useLocation** | **14** | `useFeedData.ts`, `useGigsData.ts`, `useRadiusSuggestion.ts`, `useMarketplaceData.ts`, `useExploreMapData.ts`, `useBusinessSearch.ts`, `index.tsx` (Hub), `gigs.tsx`, `gigs-map.tsx`, `listing/create.tsx`, `control-center.tsx`, `LocationBar.tsx`, `LocationToast.tsx`, `ResidencyGuard.tsx` |
| **useIdentity** | **4** | `HamburgerMenu.tsx`, `ContextSwitcher.tsx`, `homes/[id]/index.tsx`, `control-center.tsx`, `index.tsx` (Hub) |
| **useBadges** | **4** | `BottomTabBar.tsx`, `gig/[id].tsx`, `gig-v2/[id].tsx`, `_layout.tsx` (tabs), `chat.tsx` |
| **useSocket / useSocketConnected** | **5** | `useChatMessages.ts`, `useSocket.ts` (re-export), `BadgeContext.tsx`, `notifications.tsx`, `marketplace.tsx`, `gigs.tsx`, `chat.tsx` |

**Impact analysis**: `useAuth` has the highest consumer count (30 files). Memoizing `AuthContext.Provider` value (P1.1) will have the broadest impact. `useLocation` (14 consumers) is the next highest — but it delegates to `usePantopus`, so splitting `PantopusContext` (P2.3) will cascade benefits through all 14 `useLocation` consumers.

---

## 4. Image Import Inventory

Files importing `Image` from `react-native` (**65 files** total, including multi-line imports):

### `components/feed/` (5 files)
- `PostCard.tsx`, `PostMediaGrid.tsx`, `PostContentBlock.tsx`, `PostComposerModal.tsx`, `CommentSection.tsx`

### `components/chat/` (3 files)
- `ChatMessageBubble.tsx`, `ChatInput.tsx`, `ChatRichCard.tsx`

### `components/gig-browse/` (2 files)
- `FeaturedTaskCard.tsx`, `TaskRow.tsx`

### `components/gig-detail/` (4 files)
- `ConfirmCompletionModal.tsx`, `OffersPanel.tsx`, `LeaveReviewModal.tsx`, `GigMediaGallery.tsx`

### `components/gig-detail-v2/` (2 files)
- `OfferCardV2.tsx`, `ActiveTaskPanel.tsx`

### `components/hub/` (1 file)
- `HubTopBar.tsx`

### `components/listing-detail/` (4 files)
- `SellerCard.tsx`, `ListingGallery.tsx`, `OfferSheet.tsx`, `TradeSheet.tsx`

### `components/marketplace/` (3 files)
- `ListingCard.tsx`, `CreateListingSheet.tsx`, `MarketplaceCarousel.tsx`

### `components/media/` (2 files)
- `VideoPlayer.tsx`, `LivePhotoMedia.tsx`

### `components/business/` (5 files)
- `blocks/BlockRenderer.tsx`, `tabs/InboxTab.tsx`, `tabs/ProfileTab.tsx`, `tabs/ActivityTab.tsx`, `tabs/ReviewsTab.tsx`

### `components/discover-businesses/` (2 files)
- `BusinessCard.tsx`, `BusinessMapView.tsx`

### `components/profile/` (2 files)
- `PortfolioTab.tsx`, `ReviewsTab.tsx`

### `components/` (root — 4 files)
- `ImageViewerModal.tsx`, `FloatingPromoModal.tsx`, `ListingPickerModal.tsx`, `PostComposer.tsx`

### `app/` (26 files)
- `(tabs)/profile.tsx`, `(tabs)/chat.tsx`
- `chat/[roomId].tsx`, `chat/conversation/[otherUserId].tsx`, `chat/new.tsx`, `chat/ai-assistant.tsx`
- `gig/[id].tsx`, `gig/_components/AttachmentsList.tsx`
- `gig-v2/_components/DeliveryProofSheet.tsx`
- `post/[id].tsx`, `user/[id].tsx`, `business/[username].tsx`
- `listing/create.tsx`, `listing-offers.tsx`, `my-listings.tsx`
- `offers.tsx`, `my-gigs.tsx`, `my-pulse.tsx`, `connections.tsx`, `discover.tsx`
- `profile/edit.tsx`, `businesses/new.tsx`
- `homes/[id]/pets.tsx`, `homes/[id]/claim-owner/evidence.tsx`
- `admin/review-claims.tsx`, `settings/blocked-users.tsx`

**Total: 65 files** that need `Image` → `expo-image` migration (P1.7–P1.10).

**Note**: An earlier version of this inventory used a single-line grep and caught only 21 files. A multiline-aware grep reveals the true scope is 3x larger, as many files use multi-line import destructuring.

---

## 5. Startup Sequence Reality

Traced from `_layout.tsx` → `AuthContext.tsx` → `PantopusContext.tsx`:

```
Cold Boot Timeline (sequential dependencies shown with →):

0ms   ┌─ RootLayout mounts
      │  getRuntimeConfigError() — sync config check
      │
      ├─ Provider tree mounts top-down:
      │  MaybeStripeProvider → ThemeProvider → AuthProvider → AppLockProvider
      │  → PantopusProvider → IdentityProvider → LocationProvider
      │  → SocketProvider → BadgeProvider → ToastProvider → ConfirmProvider
      │  → PasswordReauthProvider → PushNotificationProvider
      │
      ├─ AuthProvider.restorePersistedSession() fires (useEffect):
      │
~10ms │  1. initializeApiClient()                    ← loads from SecureStore
      │     └─ No session? → setUnauthenticated(), STOP
      │
~50ms │  2. isSessionExpiringSoon(session)?
      │     └─ YES → api.refreshAuthSession()        ← BLOCKING, 200-500ms
      │     └─ NO  → skip
      │
~300ms│  3. api.users.getMyProfile()                  ← BLOCKING, 200-300ms
      │     └─ setAuthenticated(user)
      │     ── AuthProvider ready ──
      │
      ├─ PantopusProvider.init() fires (depends on isAuthenticated):
      │
~550ms│  4. loadCached() from AsyncStorage            ← ~50ms
      │
~600ms│  5. api.location.resolveLocation()            ← BLOCKING, 100-200ms
      │                                                  (SEQUENTIAL — not in Promise.allSettled)
      │
~800ms│  6. refreshAll() via Promise.allSettled:       ← PARALLEL, 150-250ms
      │     ├─ api.location.getLocation()
      │     ├─ api.homes.getMyHomes()
      │     └─ api.businesses.getMyBusinesses()
      │     ── PantopusProvider ready ──
      │
      ├─ SocketProvider: setInterval token poll starts (1s loop)
~1050ms│ 7. Socket.IO connect (async, non-blocking)
      │
      ├─ BadgeProvider: initial pollBadges()
~1100ms│ 8. Badge poll: getChatStats + getUnreadCount + getUnifiedConversations
      │
      ├─ PushNotificationProvider: register push token
~1200ms│ 9. Expo push token registration
      │
      │  ── App fully interactive ──
~1200ms Total (optimistic estimate, no network delay)
```

### Sequential Bottlenecks

| Step | Call | Blocks | Could Parallelize? |
|------|------|--------|-------------------|
| 2 | `refreshAuthSession()` | Step 3 | No — token must be valid before profile fetch |
| 3 | `getMyProfile()` | Step 4-6 | No — auth must complete before PantopusProvider |
| 5 | `resolveLocation()` | Step 6 | **YES** — could run in parallel with `refreshAll()` |

**Key finding**: Step 5 (`resolveLocation`) is called **before** `refreshAll()` in a sequential `await` chain (line 496 then line 520). This adds 100-200ms of unnecessary blocking. The doc 08 plan (P2.2) suggests parallelizing startup, and this is the primary target — `resolveLocation()` could run inside `Promise.allSettled` alongside the three `refreshAll` calls.

---

## 6. Risk Flags

Areas requiring extra caution during optimization:

### HIGH RISK

| Area | File | Risk | Mitigation |
|------|------|------|-----------|
| **Chat optimistic rendering** | `useChatMessages.ts:359-384` | `handleIncomingMessage` does complex optimistic-to-real message replacement using `_clientMessageId` matching and legacy sender+text fallback. Any change to `mergeMessages` or message state shape could break message deduplication, causing duplicate or lost messages. | Do not modify the optimistic message matching logic in P2.5/P2.6. Only touch the sort path. Test with rapid send + receive. |
| **Chat room join / backfill** | `useChatMessages.ts:341-356` | Room join callback merges backfill messages. `activeRoomIds` instability (P3.8) could cause re-joins and duplicate backfills. | Stabilize `activeRoomIds` before touching join logic. |
| **Live photo pipeline** | `useFeedData.ts` (compose section) | Media upload handles paired live photo video assets with special logic. The 60 useState calls make this hook extremely sensitive to re-render cascading. | P3.1 (split useFeedData) must preserve the exact compose/media state grouping. Do not interleave live photo state across split hooks. |

### MEDIUM RISK

| Area | File | Risk | Mitigation |
|------|------|------|-----------|
| **AuthContext logout ordering** | `AuthContext.tsx:407-421` | Push token must be unregistered **before** clearing auth token (401 otherwise). Any refactoring of auth state must preserve this ordering. | Do not reorder logout steps when memoizing auth value (P1.1). |
| **PantopusContext persistence** | `PantopusContext.tsx:459-475` | Debounced AsyncStorage write on every state change. Splitting context (P2.3) must preserve persistence of `place`, `radius`, `viewingAs`, `feedScope` under the same `@pantopus_context` key. | Keep a single persist function that all split contexts can call, or migrate to per-context keys with a one-time migration. |
| **Badge muted conversation filtering** | `BadgeContext.tsx:92-103` | Unread count subtracts muted conversation unreads. If `pollBadges` is debounced (P2.4), stale muted keys could cause badge count flicker. | Apply muted filter synchronously after debounced poll resolves. |
| **Hub staleness refs** | `index.tsx:227-238` | Hand-rolled staleness with `hubFetchedAtRef` / `todayFetchedAtRef` and in-flight dedup refs. Migration to React Query (P2.8) must replicate the 2min/5min stale thresholds exactly. | Use `staleTime: 120_000` for hub, `staleTime: 300_000` for today data. |
| **Feed map clustering** | `useFeedData.ts:74-79` | Uses `InteractionManager.runAfterInteractions` to defer clustering. Splitting to `useFeedMap` (P3.1) must preserve this deferral or scrolling jank will appear. | Keep the InteractionManager pattern in the split hook. |

### LOW RISK

| Area | File | Risk | Mitigation |
|------|------|------|-----------|
| **LocationContext / IdentityContext are thin wrappers** | `LocationContext.tsx`, `IdentityContext.tsx` | Both are backward-compat shims delegating to `usePantopus()`. Splitting PantopusContext (P2.3) will require updating these shims to consume the new split contexts instead. | These files are small and well-isolated. Update after P2.3. |

---

## 7. Startup Sequence — Audited

> Detailed audit of every provider on the cold-boot critical path.
> Date: 2026-04-11 (post-Phase 1)

### Provider Mount Order

From `_layout.tsx`, providers mount top-down in this order:

```
MaybeStripeProvider → ThemeProvider → QueryProvider → AuthProvider → AppLockProvider
→ PantopusProvider → IdentityProvider → LocationProvider → SocketProvider
→ BadgeProvider → ToastProvider → ConfirmProvider → PasswordReauthProvider
→ PushNotificationProvider → [children]
```

### Per-Provider Bootstrap Behavior

#### 1. AuthProvider (`AuthContext.tsx`)

**Mount behavior:**
- State initializes with `isLoading: true` (line 84)
- `useEffect` at line 235 fires `restorePersistedSession()` on mount

**`restorePersistedSession()` (lines 147-232) — BLOCKS RENDERING via isLoading:**

```
Step 1: await initializeApiClient()                    ~10-50ms
        └─ Loads session from SecureStore
        └─ No session? → setUnauthenticated() → isLoading=false, DONE

Step 2: isSessionExpiringSoon(session)?
        └─ YES → await api.refreshAuthSession()        ~200-500ms  ← BLOCKING
        │         └─ invalid? → invalidateSession() → DONE
        │         └─ transient? → setAuthenticated() → isLoading=false, DONE
        └─ NO → skip

Step 3: await api.users.getMyProfile()                  ~200-300ms  ← BLOCKING
        └─ Success → setAuthenticated(user) → isLoading=false
        └─ Invalid → invalidateSession() → DONE
        └─ Transient/network → setAuthenticated() → isLoading=false (no user)
```

**Blocks rendering:** YES — `AuthGate` shows splash screen while `isLoading=true`. Nothing below AuthProvider renders until auth bootstrap completes.

**Foreground refresh** (lines 240-280): Separate useEffect, listens to AppState. Does NOT block initial render.

#### 2. AppLockProvider (`AppLockContext.tsx`)

**Mount behavior:** Reads persisted preferences from AsyncStorage. Does not make API calls. Does not block rendering.

#### 3. PantopusProvider (`PantopusContext.tsx`)

**Mount behavior:**
- State initializes with `isLoading: true` (line 280)
- Init useEffect (lines 479-529) fires when `isAuthenticated` becomes `true`

**Init flow (lines 486-522) — BLOCKS PantopusContext-dependent rendering:**

```
Step 4: loadCached() from AsyncStorage                  ~10-30ms
        └─ Restores place, radius, viewingAs, feedScope

Step 5: await api.location.resolveLocation()            ~100-200ms  ← BLOCKING, SEQUENTIAL
        └─ Updates place + radius from server

Step 6: await refreshAll()                              ~150-250ms  ← BLOCKING, SEQUENTIAL
        └─ Promise.allSettled([                          (parallel internally)
             api.location.getLocation(),
             api.homes.getMyHomes(),
             api.businesses.getMyBusinesses(),
           ])

Step 7: setIsLoading(false)                             ← PantopusProvider ready
```

**Key finding:** Steps 5 and 6 are **sequentially chained** — `resolveLocation()` must complete before `refreshAll()` starts. These could be parallelized.

**GPS tracking** (lines 533-553): Separate useEffect, fire-and-forget async. Does NOT block init.

#### 4. IdentityProvider / LocationProvider

**Mount behavior:** Both are thin pass-through wrappers. `IdentityProvider` and `LocationProvider` render `<>{children}</>` — zero cost. Their hooks (`useIdentity`, `useLocation`) delegate to `usePantopus()`.

#### 5. SocketProvider (`SocketContext.tsx`)

**Mount behavior:**
- Seeds `authToken` from `getMemoryToken()` on mount (line 39)
- Subscribes to `onTokenChange` (line 41) — event-driven (P1.3)
- Connection useEffect (lines 47-123) fires when `authToken` changes

**Blocks rendering:** NO — socket connection is async, happens after first render.

#### 6. BadgeProvider (`BadgeContext.tsx`)

**Mount behavior — starts work immediately:**

| useEffect | Line | What it does | When |
|-----------|------|-------------|------|
| Socket `badge:update` listener | 141-158 | Listens for real-time badge events | On socket availability |
| Socket safety-net listeners | 161-172 | `message:new`, `newMessage`, `connect` → pollBadges | On socket availability |
| AppState listener | 175-182 | pollBadges on foreground return | Immediately on mount |
| Fallback polling manager | 185-192 | `startFallbackPolling()` if not connected | Immediately on mount |
| **Initial poll** | **195-197** | **`pollBadges()`** | **Immediately on mount** |

**Key finding:** On mount, `connected` is `false` (socket hasn't connected yet), so the fallback polling manager (line 185-192) calls `startFallbackPolling()` which:
1. Fires `pollBadges()` once immediately
2. Starts `setInterval(pollBadges, 5000)` — 5-second fallback loop

This means **two concurrent `pollBadges()` calls** fire on mount: one from the initial poll (line 196) and one from `startFallbackPolling()` (line 129). The throttle guard at line 73 (`lastPolledAtRef`, 750ms minimum) prevents the second from executing, but it's wasteful.

**Blocks rendering:** NO — all async. But `pollBadges()` fires 3 parallel API calls (`getChatStats`, `getUnreadCount`, `getUnifiedConversations`) which compete for network bandwidth with PantopusContext init.

#### 7. PushNotificationProvider (`PushNotificationContext.tsx`)

**Mount behavior:**
- `registerToken()` useEffect (lines 86-96): Fires when `isAuthenticated` is true. Calls `registerForPushNotifications()` which requests OS permission, gets Expo push token, registers with backend.
- Notification response listeners (lines 115-134): Checks `getLastNotificationResponse()` with 500ms delay, adds tap listener.
- Badge clear on foreground (lines 137-144): AppState listener.

**Blocks rendering:** NO — all async, all in useEffects.

**Key finding:** Push token registration fires concurrently with BadgeContext polling and any remaining PantopusContext init, adding to network contention.

### Critical Path Timeline

```
0ms     AuthProvider mounts, isLoading=true → splash screen shown
        ├─ initializeApiClient()                          ~10-50ms
~50ms   ├─ refreshAuthSession() [if expiring]             ~200-500ms
~350ms  ├─ getMyProfile()                                 ~200-300ms
~600ms  └─ isLoading=false → AuthGate renders children
        ═══════════════════════════════════════════════════
        PantopusProvider init fires (isAuthenticated=true)
~610ms  ├─ loadCached()                                   ~10-30ms
~640ms  ├─ resolveLocation()                              ~100-200ms  ← SEQUENTIAL
~840ms  ├─ refreshAll() via Promise.allSettled             ~150-250ms  ← SEQUENTIAL after above
        │   ├─ getLocation()
        │   ├─ getMyHomes()
        │   └─ getMyBusinesses()
~1050ms └─ isLoading=false → PantopusProvider ready
        ═══════════════════════════════════════════════════
        SocketProvider: token received, socket.connect()   (async, non-blocking)
        BadgeProvider: pollBadges() fires immediately       (async, non-blocking)
         └─ getChatStats + getUnreadCount + getUnifiedConversations
        PushNotificationProvider: registerToken()           (async, non-blocking)
         └─ request permission + register push token

~1050ms  App fully interactive (estimated, no network delay)
```

### Identified Optimizations

#### A. Sequential calls that could be parallelized

| Current | Fix | Estimated savings |
|---------|-----|-------------------|
| `resolveLocation()` then `refreshAll()` (lines 496, 520) | Run `resolveLocation()` inside `Promise.allSettled` alongside the 3 `refreshAll` calls | **100-200ms** — eliminates sequential wait for resolveLocation |

#### B. Work that could be deferred with `InteractionManager.runAfterInteractions`

| Current | Fix | Rationale |
|---------|-----|-----------|
| BadgeProvider initial `pollBadges()` fires immediately on mount | Wrap in `InteractionManager.runAfterInteractions` | Badge counts are not needed before first screen renders; deferring reduces network contention during critical auth+location init |
| PushNotificationProvider `registerToken()` fires on `isAuthenticated` | Wrap in `InteractionManager.runAfterInteractions` | Push token registration is never time-critical; deferring reduces network contention and avoids OS permission dialog during boot animation |
| BadgeProvider `startFallbackPolling()` fires on mount because `connected=false` | Defer initial fallback start by 3-5 seconds to give socket time to connect first | On mount, socket hasn't connected yet — the fallback immediately starts its 5s polling. If socket connects within 2-3s (typical), the fallback is unnecessary |

#### C. `refreshAll` chaining

`refreshAll()` uses `Promise.allSettled` internally (3 calls in parallel) — this is correct. However, it is **awaited sequentially after `resolveLocation()`** in the init function (lines 496 → 520). The fix is to merge `resolveLocation()` into the same `Promise.allSettled` batch.

#### D. BadgeContext and PushNotificationContext on the critical path

Both providers **do not block rendering** (no `isLoading` gate). However, they start network requests immediately on mount, competing with PantopusProvider's init for bandwidth.

- BadgeContext fires `pollBadges()` on mount (line 196), which makes 3 API calls
- PushNotificationContext fires `registerToken()` on `isAuthenticated` (line 88)
- These run concurrently with PantopusProvider's `resolveLocation` + `refreshAll` (4 API calls)
- Total: **7+ concurrent API calls** during the first 500ms after auth

### Concrete Fix List for P2.2

1. **Parallelize `resolveLocation` with `refreshAll`**: In `PantopusContext.tsx` init (line 479-529), merge `api.location.resolveLocation()` into the existing `Promise.allSettled` call in `refreshAll`, making it a 4-call parallel batch instead of sequential `resolveLocation()` → `refreshAll()`. Expected savings: **100-200ms** off cold boot.

2. **Defer BadgeProvider initial poll**: Wrap the initial `pollBadges()` call (line 196) and the fallback polling start in `InteractionManager.runAfterInteractions`. This ensures badge API calls don't compete with PantopusProvider's critical init fetches.

3. **Defer PushNotificationProvider registration**: Wrap the `registerToken()` call (line 88) in `InteractionManager.runAfterInteractions`. Push token registration is never needed before the first screen renders.

4. **Eliminate double initial poll in BadgeProvider**: The fallback polling manager (line 185-192) calls `startFallbackPolling()` on mount (because `connected=false`), which calls `pollBadges()` — but the initial poll (line 196) also calls `pollBadges()`. The throttle guard prevents duplicate execution, but the logic should be simplified: remove the standalone initial poll (line 196) since the fallback manager already handles it, OR delay the fallback manager start by a few seconds to give the socket time to connect.

5. **Defer GPS tracking start**: The GPS useEffect in PantopusProvider (line 533-553) is already fire-and-forget async, but wrapping it in `InteractionManager.runAfterInteractions` would ensure it doesn't compete for CPU during init animations.
| **SocketContext Provider inline useMemo** | `SocketContext.tsx:125` | Uses inline `useMemo` in JSX. Functionally correct but unusual pattern. | Leave as-is — already memoized. |

---

## 8. Backend Blockers

### Suite A — Chat Cursor Pagination (P3.2 blocker)

**Status:** NOT SHIPPED

**Required:** The `GET /api/chat/unified-conversations` endpoint currently accepts `limit` but does **not** accept a `cursor` parameter. Without cursor-based pagination, the mobile chat list cannot be migrated from `useQuery` (single-page load) to `useInfiniteQuery` (progressive loading).

**Current mobile state:** P2.11 wrapped the call in `useQuery` with `staleTime: 30_000`. The full conversation list is loaded in one request. For users with 100+ conversations this is slow and memory-heavy.

**What's needed from backend:**
1. Add `cursor` (opaque string) and `limit` (default 50) parameters to `GET /api/chat/unified-conversations`
2. Return `nextCursor` in the response (null when no more pages)
3. Preserve `totalUnread` and `totalMessages` in the first-page response (needed for badge sync)

**Mobile work blocked:**
- Convert `useQuery(['conversations'])` to `useInfiniteQuery` with `getNextPageParam: (lastPage) => lastPage.nextCursor`
- Add `onEndReached` to the chat FlatList
- Update `api.chat.getUnifiedConversations` type signature in `frontend/packages/api/src/endpoints/chat.ts`

**Filed:** 2026-04-11

### Suite B — AbortSignal Support in @pantopus/api (P4.2 blocker)

**Status:** NOT SHIPPED

**Required:** The `get()`, `post()`, and other HTTP helpers in `frontend/packages/api/src/client.ts` do not accept an `AbortSignal` parameter. Without this, discover search cannot cancel stale in-flight requests when the user types faster than the debounce window.

**Current state:** One specialized function (`geo.autocompleteWithAbort`) passes signal directly to `apiRequest`, proving the pattern works. But the general-purpose `get()`/`post()` helpers and the discover search endpoints (`api.posts.getFeedV2`, `api.gigs.getGigs`, `api.listings.searchListings`, `api.businesses.searchBusinesses`) don't support it.

**What's needed from @pantopus/api:**
1. Add optional `signal?: AbortSignal` to the `ApiRequestConfig` type
2. Pass it through to `axios` in the request interceptor
3. Export updated `get()` / `post()` signatures that accept config with signal

**Mobile work blocked:**
- Create `AbortController` per debounced keystroke in `discover.tsx`
- Abort previous controller on new keystroke
- Pass signal to each of the 4 parallel API calls

**Filed:** 2026-04-11

### Suite C — CDN Image Resize Pipeline (P4.4 blocker)

**Status:** PARTIAL — marketplace-only, not general CDN

**Current state:** `backend/services/marketplace/imageResizeService.js` generates pre-resized variants for marketplace listing images using Sharp with fixed filename suffixes (`_thumb` 200px, `_card` 400px, `_detail` 800px, `_full` 1200px). This is a build-time resize, not an on-the-fly CDN pipeline.

**What's missing:**
1. No general CDN resize for feed post images, gig images, avatars, or chat attachments
2. No query-param-based URL format (e.g. `?w=400&fit=cover`) — current approach uses filename suffixes
3. No documented URL format for a `thumbnailUrl(url, width)` helper to construct

**What's needed:**
- Either a CloudFront + Lambda@Edge on-the-fly resize pipeline with `?w=400` query params
- Or extend the existing Sharp pipeline to all upload types (posts, gigs, chat, avatars) and expose variant URLs in API responses

**Mobile work blocked:**
- Create `lib/imageUrl.ts` with `thumbnailUrl(url, width)` helper
- Add `targetWidth` prop to `OptimizedImage`
- Update PostMediaGrid, ListingCard, TaskRow to request appropriately-sized thumbnails

**Filed:** 2026-04-11

---

## 9. Phase 4 Profiling Checkpoint

> Manual profiling checklist for YP to run on physical devices (iOS + Android).
> Run after all Phase 1-4 changes are deployed to a preview build.

### Test Conditions

- **Devices:** One iOS (iPhone 12 or newer), one Android (mid-range, e.g. Pixel 6a)
- **Build:** EAS preview profile (`APP_ENV=preview`)
- **Network:** Wi-Fi, stable connection
- **Account:** Test account with 100+ conversations, 50+ posts in feed, 20+ gigs
- **Pre-warm:** Launch app once, log in, close fully, then measure cold boot

### Checklist

#### 1. Cold Boot to Interactive

**How to measure:** Kill app from recents. Tap app icon. Start timer. Stop when Hub screen content is visible and scrollable (not loading spinner).

| Metric | Pre-optimization baseline | Target (Phase 1-2) | Target (Phase 3-4) |
|--------|--------------------------|--------------------|--------------------|
| Cold boot to interactive | ~2.5s | ~1.5s | **~1.2s** |

**What changed:** P2.2 parallelized `resolveLocation` + `refreshAll`, deferred badge poll / push registration / GPS tracking via InteractionManager.

- [ ] iOS cold boot time: _____ ms
- [ ] Android cold boot time: _____ ms
- [ ] Auth gate splash screen visible for < 800ms
- [ ] Hub cards render within 1.5s of tap

#### 2. Feed Scroll FPS Over 200 Posts

**How to measure:** Open Feed tab. Scroll down through 200+ posts (load more as needed). Use React Native Perf Monitor (dev menu -> "Show Perf Monitor") or Xcode Instruments / Android GPU Profiler to measure FPS.

| Metric | Pre-optimization baseline | Target (Phase 1-2) | Target (Phase 3-4) |
|--------|--------------------------|--------------------|--------------------|
| Feed scroll FPS | ~45 FPS (with jank) | ~58 FPS | **~60 FPS** |

**What changed:** P1.4 React.memo on PostCard, P1.5/P3.9 FlashList migration, P1.6 memoized renderItem, P1.8 expo-image with disk caching, P3.1 split useFeedData reduces re-render cascading.

- [ ] iOS feed scroll FPS (sustained): _____ FPS
- [ ] Android feed scroll FPS (sustained): _____ FPS
- [ ] No visible jank or dropped frames during continuous scroll
- [ ] Image-heavy posts render without blank flashes (expo-image disk cache)
- [ ] FlashList: no console warnings about estimatedItemSize

#### 3. Chat Room Entry to First Message Paint

**How to measure:** From the Chat tab (conversation list), tap a conversation with 50+ messages. Measure time from tap to when the first batch of messages is visible.

| Metric | Pre-optimization baseline | Target (Phase 1-2) | Target (Phase 3-4) |
|--------|--------------------------|--------------------|--------------------|
| Chat room entry | 1-2s | 300-500ms | **200-400ms** |

**What changed:** P2.5 removed double sort, P2.6 binary insert, P2.11 React Query cached conversation list, P3.7 batched incoming messages, P3.8 stable activeRoomIds, P3.9 FlashList with getItemType.

- [ ] iOS chat entry time: _____ ms
- [ ] Android chat entry time: _____ ms
- [ ] Messages render without visible re-layout or flicker
- [ ] Rapid incoming messages (5+ in 1s) don't cause visible jank
- [ ] Back-navigation to conversation list shows instant cached render

#### 4. Marketplace Tab Scroll FPS

**How to measure:** Open Marketplace tab. Scroll through grid/list of listings. Measure FPS with Perf Monitor.

| Metric | Pre-optimization baseline | Target |
|--------|--------------------------|--------|
| Marketplace scroll FPS | ~50 FPS (estimated) | **~58-60 FPS** |

**What changed:** P1.4 React.memo on ListingCard, P1.5 FlatList optimization props, P1.8 expo-image with disk caching.

- [ ] iOS marketplace scroll FPS: _____ FPS
- [ ] Android marketplace scroll FPS: _____ FPS
- [ ] Listing images load from disk cache on revisit (no re-download flash)

#### 5. Memory Footprint After 5 Minutes of Mixed Use

**How to measure:** Launch app. Navigate through all 5 tabs, open 3 chat rooms, scroll feed for 30s, open 2 gig details, browse marketplace. After 5 minutes, check memory via Xcode Memory Gauge (iOS) or Android Studio Profiler.

| Metric | Acceptable range |
|--------|-----------------|
| iOS memory | < 200 MB |
| Android memory | < 250 MB |

**What changed:** P1.8-P1.10 expo-image memory-disk caching (eviction policy), P3.9 FlashList cell recycling, P2.3 split PantopusContext reduces re-render allocations.

- [ ] iOS memory after 5 min: _____ MB
- [ ] Android memory after 5 min: _____ MB
- [ ] No memory warnings or OOM crashes
- [ ] Memory does not grow unbounded during scroll (FlashList recycles)

#### 6. Background Battery Drain Over 15 Minutes

**How to measure:** Fully charge device or note battery %. Open app, log in, then background the app (press home). Wait 15 minutes. Check battery % drop. Also check network activity via Charles Proxy or Xcode Network Gauge.

| Metric | Pre-optimization baseline | Target |
|--------|--------------------------|--------|
| Background network requests | High (1s token polling + 5s badge polling) | **Near zero** (event-based token sync, deferred badge backoff) |
| Battery drain (15 min background) | Noticeable | **< 1% on modern devices** |

**What changed:** P1.3 event-based token sync (eliminated 1s polling), P2.4 exponential backoff badge polling (5s -> 30s cap), P2.2 deferred badge/push startup.

- [ ] iOS battery drain (15 min bg): _____ %
- [ ] Android battery drain (15 min bg): _____ %
- [ ] Network monitor shows no polling while backgrounded (socket disconnected, no intervals)
- [ ] App resumes correctly from background (socket reconnects, badges refresh)

### Regression Checks

- [ ] Login/logout flow works correctly
- [ ] Push notifications arrive and route to correct screen
- [ ] Biometric unlock (if enabled) works after backgrounding
- [ ] Deep links open correct screens
- [ ] Pull-to-refresh works on all tabs (Hub, Feed, Gigs, Chat, Marketplace)
- [ ] Post creation + media upload works
- [ ] Chat send/receive with optimistic rendering works
- [ ] Map view on Feed/Gigs renders correctly
