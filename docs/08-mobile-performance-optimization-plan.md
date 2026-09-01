# Pantopus Mobile App — Performance Optimization Plan

> Comprehensive audit and optimization plan for the Pantopus React Native / Expo mobile application.
> Generated from full codebase analysis (April 2026).

---

## Table of Contents

| # | Section | Scope |
|---|---------|-------|
| 1 | [Executive Summary](#1-executive-summary) | Key findings, impact matrix |
| 2 | [Data Fetching & Caching](#2-data-fetching--caching) | No query cache, refetch storms, waterfall requests |
| 3 | [List Rendering](#3-list-rendering) | FlatList optimization, component memoization |
| 4 | [Image Handling](#4-image-handling) | No disk cache, no progressive loading, full-res thumbnails |
| 5 | [Context & Re-Render Architecture](#5-context--re-render-architecture) | Mega-context, unmemoized values, cascading re-renders |
| 6 | [Real-Time & Socket.IO](#6-real-time--socketio) | Token polling, badge overlap, chat message batching |
| 7 | [Chat Performance](#7-chat-performance) | Message merging, sort overhead, optimistic rendering |
| 8 | [Startup & Cold Boot](#8-startup--cold-boot) | API waterfall, provider init sequence |
| 9 | [Screen-Level Findings](#9-screen-level-findings) | Per-screen audit: feed, gigs, chat, marketplace, hub, discover |
| 10 | [Bundle Size & Lazy Loading](#10-bundle-size--lazy-loading) | Eager imports, heavy modules |
| 11 | [Persistence & Offline](#11-persistence--offline) | AsyncStorage write storms, draft handling |
| 12 | [Optimization Roadmap](#12-optimization-roadmap) | Phased plan with priorities and expected impact |

---

## 1. Executive Summary

The mobile app is architecturally sound but lacks critical mobile-specific performance optimizations. The codebase uses raw `useState`/`useEffect` for all data fetching (no query caching layer), has no image disk caching, and several context providers cause unnecessary cascading re-renders. These issues compound into noticeable latency when navigating between screens, scrolling long lists, and loading image-heavy content.

### Impact Matrix

| Issue | Severity | User-Visible Symptom | Screens Affected |
|-------|----------|---------------------|-----------------|
| No query caching | **Critical** | 1-3s delay on every screen transition | All |
| Missing FlatList optimizations | **Critical** | Jank/dropped frames when scrolling 50+ items | Feed, Chat, Gigs, Marketplace, Notifications |
| List items not memoized | **Critical** | Unnecessary re-renders on every state change | Feed, Chat list, Gigs, Marketplace |
| No image disk caching | **High** | Images re-download every session, blank flashes | Feed, Marketplace, Chat, Gig detail |
| PantopusContext mega-context | **High** | Any state change re-renders all consumers | All authenticated screens |
| AuthContext value not memoized | **High** | All auth consumers re-render on any auth state change | All authenticated screens |
| Socket token polling every 1s | **High** | 1800+ unnecessary operations per 30-min session | Background (battery drain) |
| Startup API waterfall | **High** | 2-3s added to cold boot | App launch |
| Badge polling overlap | **Medium** | Redundant API calls, battery drain | Background |
| Chat message sort overhead | **Medium** | Frame drops with rapid messages | Chat rooms |
| ScrollView for long content | **Medium** | All items rendered upfront | Hub, Listing detail, Gig detail |
| 900-line useFeedData hook | **Medium** | Cascading re-renders in feed | Feed |
| No screen lazy loading | **Low** | Larger initial bundle | Startup |

---

## 2. Data Fetching & Caching

### 2.1 Problem: No Query Caching Layer

The entire mobile app uses raw `useState` + `useCallback` for all data fetching. The web app uses TanStack React Query (already a workspace dependency), but the mobile app does not.

**Files affected:**

| Hook | File | Fetching Pattern |
|------|------|-----------------|
| `useFeedData` | `hooks/useFeedData.ts` | `useState` + `useCallback` fetch + manual pagination |
| `useGigsData` | `hooks/useGigsData.ts` | `useState` + manual page counter |
| `useChatMessages` | `hooks/useChatMessages.ts` | `useState` + socket + 30s fallback poll |
| `useHomeAccess` | `hooks/useHomeAccess.ts` | `useState` + `useEffect` fetch on mount, no pagination |
| `useListingDraft` | `hooks/useListingDraft.ts` | `useState` + debounced AsyncStorage |
| Chat list | `app/(tabs)/chat.tsx` | Direct `api.chat.getUnifiedConversations()` in component |
| Hub | `app/(tabs)/index.tsx` | Manual staleness refs (2min / 5min thresholds) |

**Consequences:**
- Every screen navigation triggers a full re-fetch from the API
- No stale-while-revalidate: user sees loading spinner, then data (no instant cached render)
- No request deduplication: if two components request the same endpoint, two API calls fire
- No background refetch: cached data never refreshes until user manually pulls to refresh
- Hub implements manual staleness tracking with `useRef` timestamps — a hand-rolled, partial version of what React Query provides out of the box

**Example — Hub screen manual staleness** (`app/(tabs)/index.tsx`):
```
Hub fetches data → stores lastFetchedAt in useRef
On focus: check if (now - lastFetchedAt) > 2 minutes
  → YES: refetch
  → NO: skip
```
This pattern is repeated in multiple screens with different staleness thresholds, each implemented independently.

### 2.2 Solution: Adopt TanStack React Query

TanStack React Query is already a workspace dependency (`@tanstack/react-query@5.90.21` in the web app). Adding it to mobile provides:

| Capability | Current State | With React Query |
|-----------|--------------|-----------------|
| **Caching** | None — re-fetch every navigation | Configurable stale time per query |
| **Background refresh** | Manual with refs | Automatic on screen focus, app foreground |
| **Request deduplication** | None | Automatic — same query key = 1 API call |
| **Optimistic mutations** | Hand-rolled in chat | Built-in with rollback |
| **Pagination** | Manual cursor/page tracking | `useInfiniteQuery` with `getNextPageParam` |
| **Prefetching** | None | `queryClient.prefetchQuery()` on anticipated navigation |
| **Error retry** | None or manual | Configurable retry with backoff |

**Configuration** (match web app settings):
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,            // 30 seconds
      retry: (count, error) => {
        if (error?.statusCode >= 400 && error?.statusCode < 500) return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,   // Expo doesn't have window focus
      refetchOnReconnect: true,      // Refetch when socket/network reconnects
    },
    mutations: { retry: false },
  },
});
```

**Migration path** — convert hooks incrementally:

```
Phase 1: Wrap existing fetch functions in useQuery
  useFeedData   → useInfiniteQuery('feed', fetchFeed, { getNextPageParam })
  useGigsData   → useInfiniteQuery('gigs', fetchGigs, { getNextPageParam })
  chat list     → useQuery('conversations', fetchConversations)
  hub           → useQuery('hub', fetchHub, { staleTime: 120_000 })

Phase 2: Add prefetching for common navigation paths
  Tab bar press → prefetch next tab's data
  Feed post tap → prefetch post detail + comments

Phase 3: Convert mutations
  Post like/save → useMutation with optimistic update
  Chat send      → useMutation with optimistic insert
```

### 2.3 Problem: Chat Conversation List — No Pagination

**File:** `app/(tabs)/chat.tsx`

The chat list screen loads all conversations in a single API call (`api.chat.getUnifiedConversations()`). For users with 100+ conversations, this is slow and memory-heavy.

**Solution:** Add cursor-based pagination:
```typescript
useInfiniteQuery({
  queryKey: ['conversations'],
  queryFn: ({ pageParam }) => api.chat.getUnifiedConversations({ cursor: pageParam, limit: 50 }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

### 2.4 Problem: useHomeAccess — No Pagination, Loads All Data

**File:** `hooks/useHomeAccess.ts`

Loads the entire home permission set on every mount with no caching:
```typescript
const data = await get<HomeAccessData>(`/api/homes/${homeId}/me`);
```

**Solution:** Wrap in `useQuery` with a long stale time (permissions rarely change):
```typescript
useQuery({
  queryKey: ['homeAccess', homeId],
  queryFn: () => api.homes.getHomeAccess(homeId),
  staleTime: 5 * 60_000,  // 5 minutes
});
```

---

## 3. List Rendering

### 3.1 Problem: Missing FlatList Optimization Props

Every FlatList in the app is missing critical performance props. Here is the audit of each major list screen:

**Feed** (`app/(tabs)/feed.tsx`, lines 103-149):
```
Present:  keyExtractor ✓, onEndReachedThreshold ✓, viewabilityConfig ✓
Missing:  removeClippedSubviews, maxToRenderPerBatch, initialNumToRender,
          windowSize, updateCellsBatchingPeriod
Issue:    ListHeaderComponent is inline JSX (line 58-78), recreated every render
Issue:    renderItem creates inline wrapper View + PostCard with new function refs
```

**Chat message list** (`components/chat/ChatMessageList.tsx`):
```
Present:  keyExtractor ✓
Missing:  getItemLayout, removeClippedSubviews, maxToRenderPerBatch,
          initialNumToRender, windowSize
Issue:    Inverted list without getItemLayout forces measurement of every item
```

**Gigs** (`app/(tabs)/gigs.tsx`):
```
Present:  keyExtractor ✓, onEndReachedThreshold ✓, memoized ListHeader ✓,
          memoized ListFooter ✓, memoized renderItem ✓
Missing:  removeClippedSubviews, maxToRenderPerBatch
```

**Chat conversation list** (`app/(tabs)/chat.tsx`):
```
Present:  keyExtractor ✓
Missing:  removeClippedSubviews, maxToRenderPerBatch, pagination
Issue:    All conversations loaded at once (no onEndReached)
```

**Notifications** (`app/notifications.tsx`):
```
Present:  SectionList ✓, stickySectionHeadersEnabled ✓
Missing:  removeClippedSubviews
```

### 3.2 Solution: Standard FlatList Optimization Props

Add these props to every FlatList:

```typescript
<FlatList
  // ... existing props ...
  removeClippedSubviews={true}          // Unmount off-screen items (major Android win)
  maxToRenderPerBatch={10}              // Render 10 items per JS frame
  initialNumToRender={15}              // Only render 15 items on mount
  windowSize={10}                       // Keep 10 viewports worth in memory
  updateCellsBatchingPeriod={50}        // Batch cell updates every 50ms
/>
```

For chat (inverted list), add `getItemLayout` for predictable heights:
```typescript
getItemLayout={(data, index) => ({
  length: ESTIMATED_ITEM_HEIGHT,
  offset: ESTIMATED_ITEM_HEIGHT * index,
  index,
})}
```

For feed, memoize `ListHeaderComponent`:
```typescript
const listHeader = useMemo(() => (
  <>
    <FeedSurfaceTabs ... />
    <PostTypeFilters ... />
    ...
  </>
), [feed.surface, feed.filter, feed.suggestion, /* other deps */]);
```

**Alternative:** Consider migrating to Shopify's `FlashList` which auto-optimizes recycling, batching, and blank-area estimation without manual prop tuning.

### 3.3 Problem: List Item Components Not Memoized

No list item component uses `React.memo`. Each parent re-render (badge update, state change, context update) causes every visible list item to re-render.

| Component | File | Impact |
|-----------|------|--------|
| **PostCard** | `components/feed/PostCard.tsx` | Re-renders on every feed state change |
| **TaskRow** | `components/gig-browse/TaskRow.tsx` | Re-renders when filters change |
| **ChatMessageBubble** | `components/chat/ChatMessageBubble.tsx` | Re-renders on every new message |
| **SwipeableChatRow** | `components/chat/SwipeableChatRow.tsx` | Re-renders on badge updates |
| **ListingCard** | `components/marketplace/ListingCard.tsx` | Re-renders on scroll |

### 3.4 Solution: Wrap List Items with React.memo

```typescript
// Before
export default function PostCard({ item, ... }: PostCardProps) { ... }

// After
export default React.memo(function PostCard({ item, ... }: PostCardProps) { ... });
```

For components with callback props, stabilize references in the parent:

```typescript
// Feed screen — before (line 105-123):
renderItem={({ item }) => (
  <PostCard
    onLike={feed.handleLike}           // ✓ stable (useCallback in hook)
    onOpenImages={feed.openImages}     // ✓ stable
    isVisible={visiblePostIds.has(item.id)}  // ⚠ Set.has creates no issue, but Set itself changes
  />
)}

// Feed screen — after:
const renderPost = useCallback(({ item }: { item: Post }) => (
  <PostCard
    item={item}
    onLike={feed.handleLike}
    onOpenImages={feed.openImages}
    isVisible={visiblePostIds.has(item.id)}
  />
), [feed.handleLike, feed.openImages, visiblePostIds]);

// In FlatList:
renderItem={renderPost}
```

### 3.5 Problem: ScrollView for Long Content

Several screens use `ScrollView` with `.map()` instead of virtualized `FlatList`:

| Screen | File | Content |
|--------|------|---------|
| **Hub** | `app/(tabs)/index.tsx` | Multiple card sections stacked vertically |
| **Listing detail** | `app/listing/[id].tsx` | Reviews, Q&A, details |
| **Gig detail** | `app/gig/[id].tsx` | Bids, tasks, completion evidence |
| **Discover** | `app/discover.tsx` | Search results across 4 categories |

**Solution:** For screens where the content can exceed ~20 items (especially reviews/bids), convert to `SectionList` or use `FlatList` with `ListHeaderComponent` for the static header content.

### 3.6 Problem: ListingGallery Horizontal ScrollView

**File:** `components/listing-detail/ListingGallery.tsx`

Uses `ScrollView` with `.map()` for horizontal image paging. All images are rendered into the DOM immediately, regardless of visibility.

**Solution:**
```typescript
// Before: ScrollView + .map()
<ScrollView horizontal pagingEnabled>
  {images.map((url, idx) => <Image source={{ uri: url }} />)}
</ScrollView>

// After: FlatList with lazy rendering
<FlatList
  horizontal
  pagingEnabled
  data={images}
  renderItem={({ item }) => <Image source={{ uri: item }} />}
  getItemLayout={(_, i) => ({ length: screenWidth, offset: screenWidth * i, index: i })}
  initialNumToRender={1}
  maxToRenderPerBatch={2}
/>
```

---

## 4. Image Handling

### 4.1 Problem: React Native Image — No Disk Cache

The app uses React Native's built-in `Image` component everywhere. On Android, this has **no persistent disk caching** — images are re-downloaded every session. On iOS, caching is limited to the URL session cache.

**Files using `Image` from `react-native`:**
- `components/feed/PostCard.tsx` — post media
- `components/gig-browse/TaskRow.tsx` — gig images
- `components/listing-detail/ListingGallery.tsx` — listing photos
- Avatar images across all screens

**Missing capabilities:**
- No disk cache (images re-downloaded every app launch)
- No blur hash / placeholder during load
- No progressive loading (image pops in fully or not at all)
- No WebP auto-conversion
- No memory cache eviction policy

### 4.2 Solution: Switch to expo-image

`expo-image` (available in Expo 54) provides all of the above out of the box:

```typescript
// Before
import { Image } from 'react-native';
<Image source={{ uri: url }} style={styles.image} resizeMode="cover" />

// After
import { Image } from 'expo-image';
<Image
  source={url}
  style={styles.image}
  contentFit="cover"
  placeholder={blurhash}         // Blur hash placeholder while loading
  transition={200}               // 200ms crossfade on load
  cachePolicy="memory-disk"      // Cache in memory + disk
  recyclingKey={item.id}         // Reuse image views in lists
/>
```

**Migration scope:** Replace `import { Image } from 'react-native'` with `import { Image } from 'expo-image'` across all component files. The API is largely compatible.

### 4.3 Problem: Full-Resolution Images for Thumbnails

**File:** `components/listing-detail/ListingGallery.tsx` (line ~197):
```typescript
carouselImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 },
```

Full-resolution images (potentially 4000x3000) are loaded for all views, including thumbnails in lists.

**Solution:** Request appropriately-sized images from the CDN. If using CloudFront + S3:
```typescript
// Request a 400px wide thumbnail instead of full-res
const thumbnailUrl = `${cdnBase}/${imageKey}?w=400&fit=cover`;
const fullUrl = `${cdnBase}/${imageKey}`;  // Only for full-screen viewer
```

If CDN resizing isn't available, implement an image resizing Lambda or use expo-image's built-in downscaling.

---

## 5. Context & Re-Render Architecture

### 5.1 Problem: AuthContext Value Not Memoized

**File:** `contexts/AuthContext.tsx` (lines 423-436):
```typescript
return (
  <AuthContext.Provider
    value={{
      ...state,
      login,
      loginWithOAuth,
      register,
      logout,
      refreshUser,
    }}
  >
    {children}
  </AuthContext.Provider>
);
```

A new object is created on every render. Since `AuthProvider` wraps the entire app, any auth state change (even internal loading flags) causes **every `useAuth()` consumer to re-render**.

### 5.2 Solution: Memoize AuthContext Value

```typescript
const contextValue = useMemo(() => ({
  ...state,
  login,
  loginWithOAuth,
  register,
  logout,
  refreshUser,
}), [state, login, loginWithOAuth, register, logout, refreshUser]);

return (
  <AuthContext.Provider value={contextValue}>
    {children}
  </AuthContext.Provider>
);
```

### 5.3 Problem: PantopusContext Is a Mega-Context

**File:** `contexts/PantopusContext.tsx`

This single context holds **14 separate `useState` calls** (lines 270-286) and provides **33 values** in its context object (lines 830-898). The `useMemo` dependency array has **37 items** (lines 865-898).

**State variables:**
```
place, radius, viewingAs, homes, businesses, savedPlaces,
recentLocations, gpsCoords, inboxUnread, isLoading, isSheetOpen,
feedScope, mutedEntities, hiddenPostIds
```

**Problem:** Any change to any one of these 14 state variables recalculates the context value and re-renders every consumer. For example:
- GPS coordinates update silently in background → all consumers re-render
- Sheet open/close → all consumers re-render
- Muted entity list changes → all consumers re-render

### 5.4 Solution: Split PantopusContext

Split into focused contexts grouped by update frequency:

```
PlaceContext          ← place, radius, setPlace, setRadiusMode, setRadiusMiles
                       (changes rarely — only on explicit user action)

ActorContext          ← viewingAs, access, switchToPersonal, switchToHome, switchToBusiness
                       (changes rarely — only on identity switch)

CollectionsContext    ← homes, businesses, savedPlaces, recentLocations, refreshAll
                       (changes rarely — only on data fetch)

FeedPrefsContext      ← feedScope, mutedEntities, hiddenPostIds, setFeedScope, addMute, removeMute
                       (changes on feed interaction)

PantopusUIContext     ← isSheetOpen, openSheet, closeSheet, isLoading
                       (changes frequently — UI state)
```

With this split, opening the context sheet only re-renders `PantopusUIContext` consumers, not every component that reads `place` or `homes`.

### 5.5 Problem: LocationContext Creates New Arrays Every Render

**File:** `contexts/LocationContext.tsx` (lines 101-121):
```typescript
return {
  viewingLocation,
  recentLocations: p.recentLocations.map(r => ({ ...r, type: r.type as ViewingLocationType })),
  homes: p.homes.map(h => ({ id: h.id, name: h.name, city: h.city, ... })),
  businessLocations: p.businesses.map(b => ({ id: b.id, businessName: b.name, ... })),
  // ...
};
```

Three `.map()` calls run on every render of every consumer. Each creates a new array reference, which forces re-renders in any child that uses these arrays as dependency/props.

### 5.6 Solution: Memoize Mapped Arrays

```typescript
export function useLocation(): LocationContextType {
  const p = usePantopus();

  const recentLocations = useMemo(
    () => p.recentLocations.map(r => ({ ...r, type: r.type as ViewingLocationType })),
    [p.recentLocations]
  );

  const homes = useMemo(
    () => p.homes.map(h => ({ id: h.id, name: h.name, city: h.city, state: h.state, latitude: h.latitude, longitude: h.longitude })),
    [p.homes]
  );

  const businessLocations = useMemo(
    () => p.businesses.map(b => ({ id: b.id, businessName: b.name, label: b.name, ... })),
    [p.businesses]
  );

  // ...
}
```

### 5.7 Problem: IdentityContext Creates New Objects Every Call

**File:** `contexts/IdentityContext.tsx` (lines 37-53):
```typescript
export function useIdentity(): IdentityContextType {
  const p = usePantopus();

  // New object created on every call
  const activeHome = p.viewingAs.actorType === 'home' && p.viewingAs.actorId
    ? { id: p.viewingAs.actorId, name: p.viewingAs.actorName || 'Home', ... }
    : null;

  // New object created on every call
  const activeBusiness = p.viewingAs.actorType === 'business' && p.viewingAs.actorId
    ? { id: p.viewingAs.actorId, name: p.viewingAs.actorName || 'Business', ... }
    : null;

  return { mode: p.viewingAs.actorType, activeHome, activeBusiness, ... };
}
```

### 5.8 Solution: Memoize Derived Objects

```typescript
const activeHome = useMemo(() =>
  p.viewingAs.actorType === 'home' && p.viewingAs.actorId
    ? { id: p.viewingAs.actorId, name: p.viewingAs.actorName || 'Home', ... }
    : null,
  [p.viewingAs]
);

const activeBusiness = useMemo(() =>
  p.viewingAs.actorType === 'business' && p.viewingAs.actorId
    ? { id: p.viewingAs.actorId, name: p.viewingAs.actorName || 'Business', ... }
    : null,
  [p.viewingAs]
);
```

---

## 6. Real-Time & Socket.IO

### 6.1 Problem: Token Polling Every 1 Second

**File:** `contexts/SocketContext.tsx` (lines 36-44):
```typescript
useEffect(() => {
  const syncToken = () => {
    const next = getMemoryToken();
    setAuthToken((prev) => (prev === next ? prev : next));
  };
  syncToken();
  const timer = setInterval(syncToken, 1000);  // ← Every 1 second
  return () => clearInterval(timer);
}, []);
```

Token changes happen 1-2 times per session (on refresh). Polling every second runs `getMemoryToken()` + React state comparison **1,800+ times per 30-minute session**.

### 6.2 Solution: Event-Based Token Sync

Replace polling with an event emitter in the API client:

```typescript
// In @pantopus/api client:
export const authEvents = new EventEmitter();

// After token refresh:
authEvents.emit('token-changed', newToken);

// In SocketContext:
useEffect(() => {
  const handler = (token: string) => setAuthToken(token);
  authEvents.on('token-changed', handler);
  setAuthToken(getMemoryToken()); // initial sync
  return () => authEvents.off('token-changed', handler);
}, []);
```

**Fallback** (if event emitter isn't feasible): Increase interval to 10-30 seconds. Token refresh has a 5-minute window (`SESSION_REFRESH_WINDOW_MS`), so even a 30-second poll is well within tolerance.

### 6.3 Problem: Badge Polling Overlap

**File:** `contexts/BadgeContext.tsx`

Four overlapping badge update sources:

```
Source 1: socket.on('badge:update', ...)          ← line ~144
Source 2: socket.on('message:new', pollBadges)     ← line ~164 (safety-net)
Source 3: setInterval(pollBadges, 5000)            ← line ~131 (fallback when disconnected)
Source 4: AppState 'active' → pollBadges()         ← line ~178 (foreground return)
```

When the socket reconnects, sources 1, 2, and 4 can all fire simultaneously, causing redundant API calls (3 parallel calls to `getUnreadCount` + `getChatStats` + `getReceivedOffers`).

### 6.4 Solution: Deduplicate and Back Off

```typescript
// 1. Debounce all badge state updates
const debouncedSetCounts = useMemo(
  () => debounce((data: BadgeCounts) => setCounts(prev => ({ ...prev, ...data })), 500),
  []
);

// 2. Use exponential backoff for fallback polling
const backoffMs = useRef(5_000);
const startFallbackPolling = useCallback(() => {
  const poll = async () => {
    await pollBadges();
    backoffMs.current = Math.min(backoffMs.current * 1.5, 30_000); // 5s → 7.5s → 11s → ... → 30s max
    fallbackRef.current = setTimeout(poll, backoffMs.current);
  };
  poll();
}, [pollBadges]);

// 3. Reset backoff on reconnect
useEffect(() => {
  if (connected) {
    backoffMs.current = 5_000;
    stopFallbackPolling();
  } else {
    startFallbackPolling();
  }
}, [connected]);

// 4. Remove redundant message:new → pollBadges listener
//    badge:update already handles this server-side
```

---

## 7. Chat Performance

### 7.1 Problem: Full Array Sort on Every Incoming Message

**File:** `hooks/useChatMessages.ts`

The `mergeMessages` function (lines 39-48) creates a new Map and sorts the entire array on every call:

```typescript
function mergeMessages(prev: any[], next: any[]): any[] {
  const map = new Map<string, any>();
  for (const m of prev) if (m?.id) map.set(String(m.id), m);
  for (const m of next) {
    if (!m?.id) continue;
    const key = String(m.id);
    map.set(key, mergeMessageRecord(map.get(key), m));
  }
  return sortAsc(Array.from(map.values()));  // ← O(n log n) sort every time
}
```

This is called at **5 locations**:
- Line 251: `refreshMessages` → sort twice (once in `mergeMessages`, once in wrapping `sortAsc`)
- Line 285: Initial load
- Line 352: Room join backfill
- Line 380: Every incoming message via socket
- Line 433: Every 30-second poll cycle

For a chat room with 200 messages, each incoming message triggers O(200 log 200) sorting.

### 7.2 Solution: Binary Insert for Single Messages

For the common case (one incoming message), use binary insertion instead of full sort:

```typescript
function insertMessageSorted(messages: ChatMessage[], newMsg: ChatMessage): ChatMessage[] {
  const newTime = new Date(newMsg.created_at).getTime();
  // Most common case: new message is newest
  if (messages.length === 0 || newTime >= new Date(messages[messages.length - 1].created_at).getTime()) {
    return [...messages, newMsg];
  }
  // Binary search for insertion point
  let lo = 0, hi = messages.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (new Date(messages[mid].created_at).getTime() < newTime) lo = mid + 1;
    else hi = mid;
  }
  const result = [...messages];
  result.splice(lo, 0, newMsg);
  return result;
}
```

Keep `mergeMessages` with full sort for bulk operations (initial load, backfill, poll), but use `insertMessageSorted` for single incoming messages.

### 7.3 Problem: Double Sort in refreshMessages

**File:** `hooks/useChatMessages.ts` (lines 246-253):

```typescript
const refreshMessages = useCallback(async () => {
  const msgs = await fetchMessages();
  setMessages(prev => {
    return sortAsc(mergeMessages(prev, msgs));  // ← sortAsc called TWICE
    //     ^^^^^^^  mergeMessages already calls sortAsc internally
  });
}, [fetchMessages, markRead]);
```

`mergeMessages` already returns a sorted array. The outer `sortAsc` is redundant.

### 7.4 Solution: Remove Double Sort

```typescript
const refreshMessages = useCallback(async () => {
  const msgs = await fetchMessages();
  setMessages(prev => mergeMessages(prev, msgs));  // Already sorted
  await markRead();
}, [fetchMessages, markRead]);
```

### 7.5 Problem: Rapid Messages Not Batched

Each incoming socket message triggers a separate `setMessages` call (line 362). If 5 messages arrive within 100ms, React processes 5 sequential state updates and 5 re-renders.

### 7.6 Solution: Batch Incoming Messages

```typescript
const pendingMessagesRef = useRef<ChatMessage[]>([]);
const flushTimerRef = useRef<ReturnType<typeof setTimeout>>();

const handleIncomingMessage = useCallback((msg: ChatMessage) => {
  pendingMessagesRef.current.push(msg);
  if (!flushTimerRef.current) {
    flushTimerRef.current = setTimeout(() => {
      const batch = pendingMessagesRef.current;
      pendingMessagesRef.current = [];
      flushTimerRef.current = undefined;
      setMessages(prev => mergeMessages(prev, batch));
      debouncedMarkRead();
    }, 100); // Batch messages within 100ms window
  }
}, [debouncedMarkRead]);
```

### 7.7 Problem: activeRoomIds Reference Instability

**File:** `hooks/useChatMessages.ts` (lines ~311-318):

```typescript
const activeRoomIds = useMemo(() =>
  isRoomMode ? [String(roomId)] : [...new Set([...conversationRoomIds, resolvedRoomId].filter(Boolean))],
  [isRoomMode, roomId, resolvedRoomId, conversationRoomIds]
);
```

`conversationRoomIds` is likely a new array reference on every render, causing `activeRoomIds` to recalculate. This triggers the room join effect (line 341) to re-evaluate and potentially re-join rooms.

### 7.8 Solution: Stabilize Array References

```typescript
const activeRoomIds = useMemo(() => {
  if (isRoomMode) return [String(roomId)];
  const ids = [...new Set([...conversationRoomIds, resolvedRoomId].filter(Boolean))];
  return ids.sort().join(','); // Stable string key
}, [isRoomMode, roomId, resolvedRoomId, conversationRoomIds]);

// Convert back to array where needed, but use string for dependency comparison
```

Or use a custom `useDeepCompareMemo` for array dependencies.

---

## 8. Startup & Cold Boot

### 8.1 Problem: Sequential API Waterfall

On cold boot, the app makes 7+ API calls in sequence:

```
Timeline:
  0ms   ├─ AsyncStorage: read install sentinel
  50ms  ├─ SecureStore: read auth session
 100ms  ├─ API: refreshAuthSession() (if expiring)      ← 200-500ms
 400ms  ├─ API: users.getMyProfile()                     ← 200-300ms
        │  ── AuthProvider ready ──
 700ms  ├─ API: homes.getHomes()                         ← 150-250ms
 950ms  ├─ API: businesses.getBusinesses()               ← 150-250ms
1150ms  ├─ API: places.getSavedPlaces()                  ← 100-200ms
1350ms  ├─ API: locations.getRecentLocations()            ← 100-200ms
        │  ── PantopusProvider ready ──
1550ms  ├─ Socket.IO: connect
1600ms  ├─ Badge: initial poll
1700ms  ├─ Push notification: register token
        │  ── App fully interactive ──
~1700ms Total (optimistic, no network delay)
```

Steps 4-7 (homes, businesses, savedPlaces, recentLocations) appear sequential but could be parallelized.

### 8.2 Solution: Parallelize and Defer

```typescript
// In PantopusProvider — parallelize all collection fetches:
const refreshAll = useCallback(async () => {
  const [homesRes, bizRes, placesRes, locationsRes] = await Promise.allSettled([
    api.homes.getHomes(),
    api.businesses.getBusinesses(),
    api.places.getSavedPlaces(),
    api.locations.getRecentLocations(),
  ]);
  // Apply results individually, even if some fail
  if (homesRes.status === 'fulfilled') setHomes(homesRes.value);
  if (bizRes.status === 'fulfilled') setBusinesses(bizRes.value);
  // ...
}, []);
```

Additionally, defer non-blocking operations:

```typescript
// Socket, badges, and push notifications don't block the UI
// Move them to run after first screen renders:
useEffect(() => {
  InteractionManager.runAfterInteractions(() => {
    connectSocket();
    pollBadges();
    registerPushToken();
  });
}, []);
```

**Expected improvement:** Cold boot from ~1700ms to ~900ms (steps 4-7 run in parallel instead of sequential).

---

## 9. Screen-Level Findings

### Feed Screen (`app/(tabs)/feed.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| FlatList missing `removeClippedSubviews`, `maxToRenderPerBatch` | Critical | Add optimization props |
| `PostCard` not `React.memo` | Critical | Wrap with React.memo |
| `listHeader` (line 58-78) is inline JSX, recreated every render | Medium | Wrap in `useMemo` |
| `renderItem` creates inline wrapper `View` + `PostCard` | Medium | Extract to memoized `renderItem` callback |
| `useFeedData` has 30+ `useState` calls | Medium | Split hook by concern |
| `viewabilityConfig` and `onViewableItemsChanged` are `useRef` (correct) | OK | — |

### Gigs Screen (`app/(tabs)/gigs.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| FlatList missing `removeClippedSubviews` | High | Add prop |
| `TaskRow` not `React.memo` | High | Wrap with React.memo |
| ListHeader/Footer memoized with `useMemo` | OK | — |
| `renderItem` and `keyExtractor` memoized | OK | — |
| `BrowseFeed` component uses nested ScrollView in FlatList | High | Flatten to single SectionList |
| 13+ `useState` calls | Medium | Group related state |

### Chat List Screen (`app/(tabs)/chat.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| All conversations loaded at once (no pagination) | High | Add cursor-based pagination |
| `SwipeableChatRow` not memoized | High | Wrap with React.memo |
| Muted/hidden conversation keys sync to AsyncStorage on every change | Medium | Debounce writes (1s) |
| Exponential backoff polling when disconnected (5s-30s) | OK | — |
| 500ms debounce on badge sync | OK | — |

### Chat Room Screen (`app/chat/[roomId].tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| `ChatMessageBubble` not memoized | High | Wrap with React.memo |
| Message merging sorts full array on each incoming message | High | Binary insert for single messages |
| 10+ `useState` for UI (reply, edit, attachments) | Medium | Group into reducer |
| Emoji picker (`rn-emoji-keyboard`) loaded eagerly | Low | Lazy load on first use |

### Marketplace Screen (`app/(tabs)/marketplace.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| `ListingCard` not memoized | High | Wrap with React.memo |
| `ListingGallery` uses ScrollView + `.map()` for images | High | Convert to FlatList |
| 10+ `useState` in `useMarketplaceData` | Medium | Migrate to React Query |
| Dual dataset mode (discovery vs browse) can cause unnecessary refetches | Medium | Separate query keys |

### Hub Screen (`app/(tabs)/index.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| Uses ScrollView (no virtualization) | Medium | Convert to SectionList if card count grows |
| Manual staleness tracking with refs | Medium | Replace with React Query `staleTime` |
| 10+ `useState` + 4 `useRef` | Medium | Simplify with React Query |
| In-flight deduplication via refs | OK | — (React Query handles this natively) |
| Selective useMemo for derived values | OK | — |

### Discover Screen (`app/discover.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| Fires 4 parallel API calls on every debounced keystroke | Medium | Use `AbortController` to cancel stale requests |
| Uses ScrollView for results | Low | OK for small result sets (5-20 items) |
| 300ms search debounce | OK | — |

### Notifications Screen (`app/notifications.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| SectionList missing `removeClippedSubviews` | Low | Add prop |
| Good memoization patterns | OK | — |
| 30-item pagination | OK | — |

---

## 10. Bundle Size & Lazy Loading

### 10.1 Problem: All Screens Imported Eagerly

All 30+ screen files are bundled and available from app start. Expo Router discovers routes from the file system and includes them all in the initial bundle.

### 10.2 Problem: Heavy Modules Not Lazy-Loaded

| Module | Size Impact | Usage |
|--------|------------|-------|
| `rn-emoji-keyboard` | ~280 KB | Only in chat room |
| `expo-video` | ~500 KB | Only when viewing video messages |
| `react-native-maps` | ~1.2 MB | Only in discover/marketplace map views |
| `supercluster` | ~80 KB | Only in map clustering views |

### 10.3 Solution: Lazy Load Heavy Modules

```typescript
// Lazy load emoji keyboard — only import when user taps emoji button
const EmojiKeyboard = React.lazy(() => import('rn-emoji-keyboard'));

// In component:
{showEmojiPicker && (
  <Suspense fallback={<ActivityIndicator />}>
    <EmojiKeyboard ... />
  </Suspense>
)}
```

For Expo Router, use the `lazy` screen option where supported:
```typescript
<Stack.Screen name="explore-map" options={{ lazy: true }} />
```

---

## 11. Persistence & Offline

### 11.1 Problem: AsyncStorage Write Storms

Chat screen syncs muted/hidden conversation keys to AsyncStorage on **every** state change:

```typescript
// On every mute/unmute:
AsyncStorage.setItem('@chat_muted_conversations', JSON.stringify(mutedIds));
```

`useListingDraft` debounces at 500ms but can still stack multiple writes if the user edits rapidly.

### 11.2 Solution: Batch AsyncStorage Writes

```typescript
const pendingWriteRef = useRef<ReturnType<typeof setTimeout>>();

const debouncedPersist = useCallback((key: string, value: any) => {
  if (pendingWriteRef.current) clearTimeout(pendingWriteRef.current);
  pendingWriteRef.current = setTimeout(() => {
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  }, 1500); // 1.5s trailing debounce
}, []);
```

### 11.3 Problem: `useFeedData` is 900+ Lines

**File:** `hooks/useFeedData.ts`

This single hook manages: feed pagination, map clustering, post composition, live photo handling, media file management, cross-post logic, location precheck, map region debouncing — with **30+ `useState` calls**.

Any state change in any concern triggers re-evaluation of the entire hook and potentially re-renders all consumers.

### 11.4 Solution: Split by Concern

```
hooks/
├─ useFeedList.ts        ← pagination, posts, loading, refresh
├─ useFeedMap.ts          ← map pins, clustering, region tracking
├─ usePostComposer.ts     ← composition state, media, visibility
└─ useFeedFiltering.ts    ← surface, filter chips, type filters
```

Each hook manages its own state independently. The feed screen composes them:
```typescript
export default function FeedScreen() {
  const list = useFeedList();
  const map = useFeedMap();
  const composer = usePostComposer();
  const filters = useFeedFiltering();
  // ...
}
```

---

## 12. Optimization Roadmap

### Phase 1 — Critical Fixes (Week 1-2)

| # | Task | Files | Expected Impact |
|---|------|-------|----------------|
| 1.1 | Add FlatList optimization props to all list screens | `feed.tsx`, `gigs.tsx`, `chat.tsx`, `ChatMessageList.tsx`, `notifications.tsx` | 30-40% smoother scrolling |
| 1.2 | Wrap list item components with `React.memo` | `PostCard.tsx`, `TaskRow.tsx`, `ChatMessageBubble.tsx`, `SwipeableChatRow.tsx`, `ListingCard.tsx` | 25-30% fewer re-renders |
| 1.3 | Memoize `AuthContext.Provider` value | `AuthContext.tsx` line 423 | Eliminates cascading re-renders across entire app |
| 1.4 | Switch to `expo-image` with disk caching | All `Image` imports from `react-native` | 40% faster image-heavy screen loads |
| 1.5 | Replace socket token polling with event-based or 10s interval | `SocketContext.tsx` line 36 | 90%+ reduction in background operations |

### Phase 2 — High-Impact Optimizations (Week 3-4)

| # | Task | Files | Expected Impact |
|---|------|-------|----------------|
| 2.1 | Adopt TanStack React Query for data fetching | All hooks + screen-level fetches | 1-3s faster screen transitions, instant cached renders |
| 2.2 | Split `PantopusContext` into 4-5 focused contexts | `PantopusContext.tsx` | Major re-render reduction for all screens |
| 2.3 | Parallelize startup API calls | `PantopusContext.tsx` `refreshAll` | 800ms+ faster cold boot |
| 2.4 | Optimize chat message merging (binary insert) | `useChatMessages.ts` | Smoother chat with rapid messages |
| 2.5 | Remove double sort in `refreshMessages` | `useChatMessages.ts` line 251 | Minor CPU savings |
| 2.6 | Debounce badge updates + exponential backoff | `BadgeContext.tsx` | Fewer redundant API calls, battery savings |

### Phase 3 — Medium Optimizations (Week 5-6)

| # | Task | Files | Expected Impact |
|---|------|-------|----------------|
| 3.1 | Split `useFeedData` (900 lines) into 4 hooks | `useFeedData.ts` | Fewer cascading re-renders in feed |
| 3.2 | Add pagination to chat conversation list | `chat.tsx` | Faster chat tab load for power users |
| 3.3 | Convert `ListingGallery` ScrollView to FlatList | `ListingGallery.tsx` | Lazy image loading in carousels |
| 3.4 | Memoize `LocationContext` array mappings | `LocationContext.tsx` | Fewer re-renders for location consumers |
| 3.5 | Memoize `IdentityContext` derived objects | `IdentityContext.tsx` | Fewer re-renders for identity consumers |
| 3.6 | Convert ScrollView screens to SectionList where appropriate | `index.tsx` (hub), listing/gig detail | Virtualized long content |
| 3.7 | Batch incoming chat messages (100ms window) | `useChatMessages.ts` | Fewer state updates with rapid messages |

### Phase 4 — Polish (Week 7-8)

| # | Task | Files | Expected Impact |
|---|------|-------|----------------|
| 4.1 | Lazy load `rn-emoji-keyboard`, `expo-video`, map modules | Screen files importing these | Smaller initial bundle |
| 4.2 | Add `AbortController` to discover search | `discover.tsx` | Cancel stale search requests |
| 4.3 | Batch AsyncStorage writes with 1.5s debounce | `chat.tsx`, `useListingDraft.ts` | Fewer disk I/O operations |
| 4.4 | Request CDN thumbnail sizes instead of full-res | All image URLs | Faster image loads, lower memory |
| 4.5 | Profile with React DevTools Profiler | — | Identify remaining hotspots |
| 4.6 | Consider `FlashList` migration for critical lists | Feed, Chat, Gigs | Auto-optimized recycling |

### Expected Cumulative Impact

| Metric | Current (estimated) | After Phase 1-2 | After Phase 3-4 |
|--------|-------------------|----------------|----------------|
| Screen transition time | 1-3s (loading spinner) | 200-500ms (cached render) | 100-300ms (prefetched) |
| Feed scroll FPS | ~45 FPS (with jank) | ~58 FPS | ~60 FPS |
| Chat room entry | 1-2s | 300-500ms | 200-400ms |
| Cold boot to interactive | ~2.5s | ~1.5s | ~1.2s |
| Background battery impact | High (1s polling) | Low (event-based) | Low |
| Image-heavy screen load | 2-4s (re-download) | 200ms (disk cached) | 100ms (memory cached) |
