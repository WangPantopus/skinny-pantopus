# Pantopus Web App — Performance Optimization Plan

> Comprehensive audit and optimization plan for the Pantopus Next.js web application.
> Generated from full codebase analysis (April 2026).

---

## Table of Contents

| # | Section | Scope |
|---|---------|-------|
| 1 | [Executive Summary](#1-executive-summary) | Key findings, impact matrix |
| 2 | [Data Fetching & Caching](#2-data-fetching--caching) | React Query underutilization, raw useState patterns |
| 3 | [Component Memoization](#3-component-memoization) | Zero React.memo usage, list item re-renders |
| 4 | [List Virtualization](#4-list-virtualization) | Feed, chat, gigs — no virtualization |
| 5 | [Image Optimization](#5-image-optimization) | 84 `unoptimized` flags defeating Next.js optimization |
| 6 | [Context & Re-Render Architecture](#6-context--re-render-architecture) | Socket polling, badge overlap, AppShell state explosion |
| 7 | [Server Components & SSR](#7-server-components--ssr) | 210 client components, minimal SSR/SSG usage |
| 8 | [Chat Performance](#8-chat-performance) | Message merging, handler churn, conversation list |
| 9 | [Screen-Level Findings](#9-screen-level-findings) | Per-page audit: hub, feed, gigs, marketplace, chat, mailbox, discover |
| 10 | [AppShell & Layout](#10-appshell--layout) | 16 useState calls, media query overhead |
| 11 | [Bundle & Loading](#11-bundle--loading) | Dynamic imports, code splitting |
| 12 | [Optimization Roadmap](#12-optimization-roadmap) | Phased plan with priorities and expected impact |

---

## 1. Executive Summary

The web app has a solid architecture — proper Next.js App Router structure, dynamic imports for maps, and React Query configured — but React Query is almost entirely unused. Data fetching across the app relies on raw `useState` + `useEffect`, meaning no caching, no deduplication, and full refetches on every navigation. Component memoization is nonexistent (0 instances of `React.memo`), and Next.js image optimization is disabled across 65 files. These gaps compound into slow page transitions and unnecessary re-renders.

### Codebase Statistics

| Metric | Value | Status |
|--------|-------|--------|
| React Query adoption | **1 file** out of ~696 (mailbox-queries.ts only) | Critical |
| `React.memo` usage | **0** components | Critical |
| `unoptimized` on Next.js Image | **84** instances across **65** files | High |
| `'use client'` pages | **210** files | High (missed SSR opportunity) |
| Virtualized lists | **1** component (mailbox, threshold 50 items) | High |
| Dynamic imports (maps) | **6+** components | Good |
| Map lazy loading | `dynamic(() => import(...), { ssr: false })` | Good |

### Impact Matrix

| Issue | Severity | User-Visible Symptom | Screens Affected |
|-------|----------|---------------------|-----------------|
| React Query not used | **Critical** | Loading spinners on every navigation, no instant back | All |
| Zero React.memo | **Critical** | Slow list scrolling, frame drops | Feed, Chat, Gigs, Marketplace |
| No list virtualization | **High** | DOM bloat, slow scrolling with 100+ items | Feed, Chat conversations, Notifications |
| Image unoptimized flags | **High** | Images served at full resolution, no WebP | All screens with images |
| All pages client-rendered | **High** | Blank page until JS loads, no SEO for app pages | All app routes |
| AppShell 16 state vars | **Medium** | Cascading re-renders on sidebar/header changes | All authenticated screens |
| Socket token polling 1s | **Medium** | Battery drain, CPU overhead | Background |
| Badge interval stacking | **Medium** | Redundant API calls on reconnect flaps | Background |
| Chat O(n log n) per message | **Medium** | Frame drops with rapid messages | Chat rooms |

---

## 2. Data Fetching & Caching

### 2.1 Problem: React Query Is Configured But Unused

React Query v5.90.21 is installed and configured in `lib/query-provider.tsx` with sensible defaults:

```
staleTime: 30s, retry: 2 (skip 4xx), refetchOnWindowFocus: false
```

However, only **1 file** in the entire codebase actually uses it:

```
src/lib/mailbox-queries.ts  ← only file using useQuery/useMutation
```

Every other screen uses raw `useState` + `useEffect` + `useCallback`:

| Screen / Hook | Pattern | File |
|--------------|---------|------|
| Hub | `loadHub()` in useEffect, manual error/loading state | `hub/page.tsx:68-133` |
| Feed | `useFeedData()` hook — manual pagination with sentinel ref | `hooks/useFeedData.ts` |
| Chat list | `load()` in useEffect, manual conversation array | `chat/page.tsx:48-63` |
| Chat room | `useChatMessages()` — manual socket + fallback poll | `hooks/useChatMessages.ts` |
| Gigs | `useGigsData()` — manual filter state + page counter | `hooks/useGigsData.ts` |
| Gigs v2 detail | 4 parallel API calls in useEffect | `gigs-v2/[id]/page.tsx:496-533` |
| Marketplace | `fetchBrowse()` / `fetchDiscover()` with manual stale-response guard | `marketplace/page.tsx:248-345` |
| My Gigs | `loadGigs()` with limit=100, no pagination | `my-gigs-v2/page.tsx:46-70` |
| Notifications | `loadNotifications()` with offset pagination | `notifications/page.tsx:39-80` |
| Discover | Parallel search across 4 APIs | `discover/page.tsx` |
| Mailbox data | `useMailboxData()` — manual scope/filter state | `mailbox/_components/useMailboxData.ts` |

**Consequences:**
- Every page navigation triggers a full API re-fetch with loading spinner
- No instant "back" navigation — returning to a previously visited page shows a spinner
- No request deduplication — opening the same gig in two tabs fires two API calls
- No background refresh — stale data stays until manual refresh
- Each hook hand-rolls its own error retry, staleness tracking, and race condition handling

### 2.2 Problem: Hub Manual Staleness Tracking

**File:** `hub/page.tsx` (lines 68-133)

The hub implements manual data freshness with `useCallback` + try/catch:

```typescript
const loadHub = useCallback(async () => {
  const token = getAuthToken();
  if (!token) { router.replace('/login?redirectTo=...'); return; }
  const payload = await api.hub.getHub();
  // ... 40 lines of manual data reconciliation
  setData(mergedPayload);
}, [router, ctx.init]);

useEffect(() => {
  void loadToday({ showLoading: true, clearOnFailure: true });
  void loadHub();
}, [loadHub, loadToday]);
```

This is ~70 lines of code that React Query replaces with:

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['hub'],
  queryFn: () => api.hub.getHub(),
  staleTime: 2 * 60_000,  // 2 minutes
});
```

### 2.3 Problem: Gigs V2 — 11 Filter State Variables

**File:** `gigs-v2/page.tsx` (lines 95-111)

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');
const [selectedCategory, setSelectedCategory] = useState('All');
const [priceFilter, setPriceFilter] = useState<PriceOption>('all');
const [sortOption, setSortOption] = useState<SortOption>('newest');
const [engagementFilter, setEngagementFilter] = useState('all');
const [scheduleFilter, setScheduleFilter] = useState('all');
const [payTypeFilter, setPayTypeFilter] = useState('all');
const [gigs, setGigs] = useState<GigListItem[]>([]);
const [loading, setLoading] = useState(true);
const [fetchError, setFetchError] = useState<string | null>(null);
```

Each filter change triggers full refetch (dependency array includes all 8 filters). With React Query, filters become query key segments with automatic caching per combination:

```typescript
const { data: gigs } = useQuery({
  queryKey: ['gigs', { category, search: debouncedSearch, price, sort, ... }],
  queryFn: () => api.gigs.browse(filters),
});
```

### 2.4 Solution: Adopt React Query Across All Screens

**Migration approach** — convert incrementally, screen by screen:

```
Phase 1: Simple queries (hub, notifications, my-gigs)
  Replace useState/useEffect with useQuery
  Immediate benefit: caching + instant back navigation

Phase 2: Infinite scroll (feed, gigs, marketplace, chat conversations)
  Replace manual pagination with useInfiniteQuery
  Immediate benefit: cached pages + deduplication

Phase 3: Real-time hybrid (chat messages, gig detail)
  Use useQuery for initial load, socket for updates
  queryClient.setQueryData() to update cache on socket events

Phase 4: Mutations (like, save, bid, send message)
  Replace manual optimistic updates with useMutation + onMutate
  Automatic rollback on failure
```

**Query key factory** (centralized key management):

```typescript
export const queryKeys = {
  hub: () => ['hub'],
  hubToday: () => ['hub', 'today'],
  feed: (surface: string, filter: string) => ['feed', surface, filter],
  gigs: (filters: GigFilters) => ['gigs', filters],
  conversations: () => ['conversations'],
  chatMessages: (roomId: string) => ['chat', 'messages', roomId],
  notifications: () => ['notifications'],
  myGigs: (status?: string) => ['myGigs', status],
  marketplace: (mode: string, filters: object) => ['marketplace', mode, filters],
};
```

---

## 3. Component Memoization

### 3.1 Problem: Zero React.memo in the Entire Codebase

A grep for `React.memo` across all 696 `.ts`/`.tsx` files returns **0 results**. Every component re-renders whenever its parent re-renders, regardless of whether its props changed.

**High-impact unmemoized components:**

| Component | File | Lines | Props | Impact |
|-----------|------|-------|-------|--------|
| **PostCard** | `components/feed/PostCard.tsx` | 511 | 13+ | Re-renders on every feed state change |
| **ChatRoomView** | `components/chat/ChatRoomView.tsx` | 300+ | 10+ | Re-renders on badge/socket updates |
| **ChatMessageBubble** | `components/chat/ChatMessageBubble.tsx` | — | message + handlers | Re-renders on every new message |
| **TaskRow** | `components/gig-browse/TaskRow.tsx` | — | gig item | Re-renders on filter changes |
| **ListingCard** | `app/marketplace/ListingCard.tsx` | — | listing item | Re-renders on scroll/filter |
| **MailListItem** | `components/mailbox/` | — | mail item | Re-renders on drawer changes |
| **GigCardV2** | `gigs-v2/page.tsx` (inline) | — | gig item | Re-renders on any filter change |
| **NotificationRow** | `notifications/page.tsx` (inline) | — | notification | Re-renders on socket events |

### 3.2 Problem: Inline Callback Refs in List Renders

**File:** `feed/page.tsx` (lines 283-302):

```typescript
{feed.posts.map((post) => (
  <PostCard
    key={post.id}
    post={post}
    onLike={feed.handleLike}        // ✓ stable (useCallback in hook)
    onComment={handleOpenDetail}     // ✓ stable (useCallback)
    onReport={(postId) => setReportPostId(postId)}  // ✗ new function every render
    isLiking={feed.likingIds.has(post.id)}  // ✗ Set lookup is fine, but Set ref changes
    // ...
  />
))}
```

Even if callbacks are stable, without `React.memo` on PostCard, every post re-renders when any feed state changes.

### 3.3 Solution: Add React.memo to All List Item Components

```typescript
// Before
export default function PostCard({ post, onLike, ... }: PostCardProps) { ... }

// After
export default React.memo(function PostCard({ post, onLike, ... }: PostCardProps) { ... });
```

For components with many props, add a custom comparison:

```typescript
export default React.memo(PostCard, (prev, next) => {
  return prev.post.id === next.post.id
    && prev.post.updated_at === next.post.updated_at
    && prev.isLiking === next.isLiking
    && prev.currentUserId === next.currentUserId;
});
```

Stabilize inline callbacks:

```typescript
// Before
onReport={(postId) => setReportPostId(postId)}

// After
const handleReport = useCallback((postId: string) => setReportPostId(postId), []);
// Then: onReport={handleReport}
```

---

## 4. List Virtualization

### 4.1 Problem: Feed Posts Rendered Without Virtualization

**File:** `feed/page.tsx` (lines 283-302)

Posts are rendered with a simple `.map()` loop. With infinite scroll loading more posts, the DOM accumulates unlimited nodes:

```typescript
{feed.posts.map((post) => (
  <PostCard key={post.id} post={post} ... />
))}
<div ref={feed.sentinelRef} className="h-1" />  {/* infinite scroll sentinel */}
```

After scrolling through 200 posts, all 200 PostCard components remain in the DOM.

### 4.2 Problem: Chat Conversation List — No Virtualization, No Pagination

**File:** `chat/page.tsx` (lines ~338-422)

All conversations are fetched in one call and rendered via `.map()`. For users with 200+ conversations, this creates hundreds of DOM nodes.

### 4.3 Problem: Notification List — No Virtualization

**File:** `notifications/page.tsx` (lines ~290-340)

Notifications are rendered as grouped date buckets via `.map()`. With 30-item pagination loading more on scroll, DOM grows unbounded.

### 4.4 Problem: Mailbox Virtualization Threshold Too High

**File:** `components/mailbox/VirtualizedList.tsx` (lines 34-44)

```typescript
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => estimateSize,
  overscan: 10,
});

// Only virtualizes if items.length > 50
if (items.length <= 50) {
  return <div>{items.map(...)}</div>;  // No virtualization!
}
```

The threshold of 50 is too high. Lists with 30-50 items still render all nodes.

### 4.5 Solution: Add Virtualization to Key Lists

**For feed** — use TanStack React Virtual (already installed):

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: feed.posts.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 400, // estimated post height
  overscan: 5,
});

<div ref={parentRef} style={{ overflow: 'auto', height: '100vh' }}>
  <div style={{ height: virtualizer.getTotalSize() }}>
    {virtualizer.getVirtualItems().map((virtualRow) => {
      const post = feed.posts[virtualRow.index];
      return (
        <div key={post.id} style={{ transform: `translateY(${virtualRow.start}px)` }}>
          <PostCard post={post} ... />
        </div>
      );
    })}
  </div>
</div>
```

**For chat conversations** — add pagination + virtualization:
```typescript
// Step 1: Paginate API call (50 per page)
// Step 2: Virtualize rendered list
```

**Lower mailbox threshold** from 50 to 20.

---

## 5. Image Optimization

### 5.1 Problem: `unoptimized` Flag on 84 Image Instances

**84 instances** of `unoptimized` across **65 files** disable Next.js image optimization:

```typescript
<Image src={url} width={36} height={36} unoptimized ... />
```

With `unoptimized`, Next.js serves images as-is — no WebP conversion, no responsive sizing, no quality reduction, no CDN optimization.

**Top affected areas:**

| Area | Files | Impact |
|------|-------|--------|
| Chat (avatars, attachments) | 8 files | Every chat message loads full-res avatar |
| Feed (post media, avatars) | 7 files | Post images served unoptimized |
| Marketplace (listing images) | 7 files | Product images at full resolution |
| Gig detail (photos, avatars) | 5 files | Gig images at full resolution |
| Profile | 4 files | Profile pictures unoptimized |
| Components (shared) | 10+ files | Avatar, media gallery, file upload |
| Home (member avatars, vendor images) | 6 files | Member list images |
| Business (public profiles) | 3 files | Business page images |

### 5.2 Problem: Missing `sizes` Attribute

No Image component includes the `sizes` attribute, so Next.js cannot generate responsive `srcset` values. Every image is served at the specified `width` regardless of viewport.

### 5.3 Solution: Remove `unoptimized` and Add `sizes`

**Step 1: Configure remote image domains** in `next.config.js`:

```javascript
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '*.amazonaws.com' },     // S3
    { protocol: 'https', hostname: '*.cloudfront.net' },    // CDN
    { protocol: 'https', hostname: 'pantopus.com' },
  ],
},
```

**Step 2: Remove `unoptimized` and add `sizes`:**

```typescript
// Before
<Image src={url} width={48} height={48} unoptimized alt="" />

// After
<Image
  src={url}
  width={48}
  height={48}
  sizes="48px"        // Serves exactly 48px wide image
  quality={75}        // 25% size reduction
  alt=""
/>
```

For responsive images (e.g., post media):

```typescript
<Image
  src={url}
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  quality={80}
  alt=""
/>
```

**Expected savings:** 40-60% image payload reduction via WebP conversion + quality reduction.

---

## 6. Context & Re-Render Architecture

### 6.1 Problem: Socket Token Polling Every 1 Second

Same issue as mobile — `contexts/SocketContext.tsx` polls `getAuthToken()` every 1000ms.

**Solution:** On web, use `visibilitychange` + storage events:

```typescript
useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') syncToken();
  };
  const handleStorage = (e: StorageEvent) => {
    if (e.key?.includes('auth')) syncToken();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('storage', handleStorage);
  syncToken(); // initial
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('storage', handleStorage);
  };
}, []);
```

### 6.2 Problem: Badge Interval Stacking

Same issue as mobile — `contexts/BadgeContext.tsx` `startFallbackPolling()` can create multiple intervals if called rapidly during reconnect flaps.

**Solution:** Clear before setting:

```typescript
const startFallbackPolling = useCallback(() => {
  if (fallbackRef.current) clearInterval(fallbackRef.current);  // Prevent stacking
  pollBadges();
  fallbackRef.current = setInterval(pollBadges, FALLBACK_POLL_MS);
}, [pollBadges]);
```

### 6.3 Problem: BadgeContext Value Not Memoized

**File:** `contexts/BadgeContext.tsx` (lines 155-162)

The context value object is created inline without `useMemo`:

```typescript
<BadgeContext.Provider
  value={{ ...counts, connected, socket, setUnreadMessages, setTotalMessages }}
>
```

Every render creates a new object, forcing all `useBadges()` consumers to re-render.

**Solution:**

```typescript
const contextValue = useMemo(
  () => ({ ...counts, connected, socket, setUnreadMessages, setTotalMessages }),
  [counts, connected, socket, setUnreadMessages, setTotalMessages]
);
<BadgeContext.Provider value={contextValue}>
```

### 6.4 Problem: MailboxContext Travel Mode Polling

**File:** `contexts/MailboxContext.tsx`

Travel mode polls vacation hold status every 5 minutes. This is reasonable, but should stop when the user is not on a mailbox page.

---

## 7. Server Components & SSR

### 7.1 Problem: 210 Client Components, Minimal SSR

**210 files** include `'use client'`, including every page in the app. All authenticated pages render entirely on the client — the server sends an empty shell, then JS hydrates and fetches data.

**Missing SSR/SSG opportunities:**

| Page | SSR Potential | Benefit |
|------|-------------|---------|
| Public gig detail (`/gigs/[id]`) | `generateMetadata` exists, but page is client-rendered | SEO + faster initial render |
| Public listing (`/listing/[id]`) | `generateMetadata` exists, same issue | SEO + faster initial render |
| Public post (`/posts/[id]`) | `generateMetadata` exists, same issue | SEO + faster initial render |
| Public profile (`/[username]`) | Client-rendered | SEO for public profiles |
| Static pages (about, terms, privacy) | Could be fully static | Instant load |

### 7.2 Solution: SSR for Public Pages, RSC for Data-Heavy Components

**Phase 1: Static pages** — Remove `'use client'` from about, terms, privacy, contact, child-safety. These are read-only content with no interactivity.

**Phase 2: Public detail pages** — Fetch data server-side:

```typescript
// gigs/[id]/page.tsx — Server Component
export default async function GigDetailPage({ params }: { params: { id: string } }) {
  const gig = await api.gigs.getPublicGig(params.id);
  return <GigDetailClient gig={gig} />;  // Client component for interactivity
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const gig = await api.gigs.getPublicGig(params.id);
  return { title: gig.title, description: gig.description };
}
```

**Phase 3: Authenticated pages** — Keep as client components but consider RSC for data-heavy layouts:

```typescript
// Mailbox layout could fetch drawer metadata server-side
export default async function MailboxLayout({ children }) {
  const drawerMeta = await api.mailbox.getDrawerMeta();
  return <MailboxShell drawerMeta={drawerMeta}>{children}</MailboxShell>;
}
```

---

## 8. Chat Performance

### 8.1 Problem: Message Merging O(n log n) on Every Socket Event

Same `mergeMessages` + `sortAsc` pattern as mobile. Each incoming message creates a new Map, copies all messages, and sorts the entire array.

### 8.2 Problem: Socket Event Handler Subscription Churn

**File:** `hooks/useChatMessages.ts`

Some socket event handlers are declared inline with `useCallback`:

```typescript
useSocketEvent('message:deleted', useCallback((data) => {
  setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
}, []));
```

This is functionally correct, but the inline `useCallback` is recreated on every render (React doesn't hoist inline hooks). Should be extracted:

```typescript
const handleDeleted = useCallback((data) => { ... }, []);
useSocketEvent('message:deleted', handleDeleted);
```

### 8.3 Problem: Chat Conversation List — O(n) Prepend on Every Message

**File:** `chat/page.tsx` (lines ~142-167):

```typescript
setConversations(prev => {
  const updated = [...prev];
  const idx = updated.findIndex(conv => ...);
  updated.splice(idx, 1);      // O(n)
  updated.unshift(conv);        // O(n) — shift all elements
  return updated;
});
```

Each incoming message triggers `findIndex` + `splice` + `unshift` on the full conversation array.

### 8.4 Solutions

Same as mobile doc (Section 7): binary insert for single messages, extract inline handlers, batch rapid updates.

For conversation reordering, use a linked-list approach or accept the O(n) cost (conversation count is typically <200).

---

## 9. Screen-Level Findings

### Hub (`hub/page.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| Manual API calls in useEffect (lines 68-133) | Critical | Replace with `useQuery` |
| Sequential fallback fetch (homes) not parallelized (lines 84-106) | Medium | `Promise.all` |
| No caching — full refetch on every navigation | Critical | React Query `staleTime: 120s` |
| No memoization on `activeHome` computed value (line 135) | Low | `useMemo` |

### Feed (`feed/page.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| Posts rendered with `.map()`, no virtualization (line 283) | Critical | TanStack React Virtual |
| PostCard not memoized | Critical | `React.memo` |
| Inline `onReport` callback creates new function per render | Medium | Extract to `useCallback` |
| `useFeedData` hook — 300+ lines of manual state | High | Migrate to `useInfiniteQuery` |
| Sentinel-based infinite scroll (line 304) | OK | Good pattern, keep |

### Gigs V2 (`gigs-v2/page.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| 11 filter useState calls (lines 95-111) | High | `useReducer` or URL params |
| GigCardV2 not memoized (rendered in grid, line ~407) | High | `React.memo` |
| No virtualization on gig grid | Medium | Virtual grid or pagination limit |
| Full refetch on every filter change | High | React Query with filter-based keys |
| Stale response guard via `fetchIdRef` | OK | Good pattern |

### Marketplace (`marketplace/page.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| Manual `fetchBrowse`/`fetchDiscover` (lines 248-345) | High | `useInfiniteQuery` |
| Geolocation fallback to Portland coords (line ~324) | OK | Defensive default |
| Socket listener for `listing:new` with dedup | OK | Good pattern |
| No request cancellation on filter changes | Medium | `AbortController` or React Query |
| `marketplaceSnapshot` in `useMemo` (line ~167) | OK | Good |

### Chat List (`chat/page.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| All conversations loaded at once, no pagination | High | Cursor-based pagination |
| No virtualization for 200+ conversations | High | React Virtual |
| O(n) conversation reorder on every message | Medium | Accept or linked list |
| Badge sync debounced at 500ms | OK | Good pattern |
| Reload throttle at 10s minimum | OK | Good |

### Chat Room (`chat/[roomId]/page.tsx` + `ChatRoomView`)

| Finding | Severity | Fix |
|---------|----------|-----|
| Thin page wrapper — all logic in ChatRoomView | OK | — |
| ChatRoomView not memoized | High | `React.memo` |
| Parallel identity resolution with `Promise.all` (line ~84) | OK | Good |
| ChatMessageBubble not memoized | High | `React.memo` |
| Auto-scroll on `messages.length` change can cause jank | Medium | Use `scrollIntoView` selectively |

### Gig Detail V2 (`gigs-v2/[id]/page.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| 4 parallel API calls via `Promise.all` (lines 496-504) | OK | Good pattern |
| All socket events trigger full refetch (lines 516-521) | Medium | Targeted cache updates |
| Next Image with `unoptimized` (line ~145) | High | Remove flag |
| Dynamic Leaflet map import | OK | Good |

### Notifications (`notifications/page.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| No virtualization, grouped date rendering | Medium | React Virtual |
| 30-item offset pagination | OK | — |
| Socket `notification:new` with dedup | OK | Good |
| Client-side date bucket grouping re-runs every render | Low | `useMemo` |

### Mailbox (`mailbox/layout.tsx` + item pages)

| Finding | Severity | Fix |
|---------|----------|-----|
| Only feature using React Query (mailbox-queries.ts) | OK | Expand to other features |
| VirtualizedList threshold at 50 items | Medium | Lower to 20 |
| Auth check in layout before rendering (lines 39-51) | OK | — |
| Skeleton loading states | OK | Good |

### Discover (`discover/page.tsx`)

| Finding | Severity | Fix |
|---------|----------|-----|
| Parallel search across 4 APIs | OK | Good pattern |
| No request cancellation on rapid searches | Medium | `AbortController` |
| Dynamic map import | OK | Good |

---

## 10. AppShell & Layout

### 10.1 Problem: 16 useState Calls in AppShell

**File:** `components/AppShell.tsx` (lines 94-107)

```typescript
const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
const [mobileOpen, setMobileOpen] = useState(false);
const [hoverExpanded, setHoverExpanded] = useState(false);
const [user, setUser] = useState<User | null>(null);
const [discoverQuery, setDiscoverQuery] = useState('');
// ... 11 more state declarations
```

Any state change in AppShell triggers a re-render of the sidebar, header, and all children.

### 10.2 Problem: Dual Media Query Hooks

**File:** `components/AppShell.tsx` (lines 63-73)

```typescript
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    // ... listener setup
  }, [query]);
}
```

Called twice per render (for `isMdUp` and `isLgUp`), creating two event listeners.

### 10.3 Problem: Inline Style Objects

**File:** `components/AppShell.tsx` (line ~247):

```typescript
style={{ left: sidebarWidth }}  // New object on every render
```

### 10.4 Solutions

**Group related state:**

```typescript
// Before: 16 useState calls
// After: 2 groups
const [sidebarState, setSidebarState] = useReducer(sidebarReducer, {
  collapsed: readSidebarCollapsed(),
  mobileOpen: false,
  hoverExpanded: false,
});

const [appState, setAppState] = useReducer(appReducer, {
  user: null,
  discoverQuery: '',
  // ...
});
```

**Memoize inline styles:**

```typescript
const contentStyle = useMemo(() => ({ left: sidebarWidth }), [sidebarWidth]);
```

**Consolidate media queries:**

```typescript
const breakpoints = useBreakpoints(); // single hook, returns { isMdUp, isLgUp }
```

---

## 11. Bundle & Loading

### 11.1 Good: Dynamic Imports for Maps

The app correctly uses Next.js dynamic imports with `ssr: false` for all map components:

```typescript
const FeedMap = dynamic(() => import('./FeedMap'), { ssr: false });
const MarketplaceMap = dynamic(() => import('./MarketplaceMap'), { ssr: false });
const GigsMap = dynamic(() => import('./GigsMap'), { ssr: false });
```

This prevents Leaflet from being included in the server bundle and defers map loading until needed. **6+ components** follow this pattern.

### 11.2 Opportunity: Lazy Load Heavy Modals

Heavy modals (PostComposer at 799 lines, MagicTaskComposer at 12 files) are imported eagerly. These could use dynamic imports:

```typescript
const PostComposer = dynamic(() => import('@/components/feed/PostComposer'), {
  loading: () => <ModalSkeleton />,
});
```

### 11.3 Opportunity: Route-Level Code Splitting

Next.js App Router automatically code-splits per route. However, shared components imported by many routes (AppShell, PostCard, ChatRoomView) end up in the common bundle. Consider:

- Moving heavy sub-components (EmojiPicker, FileUpload, BlockEditor) to dynamic imports
- Using `React.lazy` for infrequently-accessed features (AI assistant, business page editor)

---

## 12. Optimization Roadmap

### Phase 1 — Critical Fixes (Week 1-2)

| # | Task | Files | Expected Impact |
|---|------|-------|----------------|
| 1.1 | Add `React.memo` to all list item components | `PostCard`, `TaskRow`, `ChatMessageBubble`, `ListingCard`, `NotificationRow`, `GigCardV2` | 25-50% fewer re-renders on list screens |
| 1.2 | Remove `unoptimized` from all Image components, configure remote domains | 65 files, `next.config.js` | 40-60% image payload reduction |
| 1.3 | Add virtualization to feed post list | `feed/page.tsx` | Constant DOM size regardless of scroll depth |
| 1.4 | Memoize BadgeContext value | `BadgeContext.tsx` | Eliminates cascading re-renders |
| 1.5 | Fix badge interval stacking | `BadgeContext.tsx` | Prevents accumulated polling on reconnect |

### Phase 2 — React Query Migration (Week 3-5)

| # | Task | Files | Expected Impact |
|---|------|-------|----------------|
| 2.1 | Migrate hub to `useQuery` | `hub/page.tsx` | Instant cached render on back navigation |
| 2.2 | Migrate feed to `useInfiniteQuery` | `hooks/useFeedData.ts`, `feed/page.tsx` | Cached pages, deduplication |
| 2.3 | Migrate gigs to `useInfiniteQuery` | `hooks/useGigsData.ts`, `gigs-v2/page.tsx` | Filter combinations cached |
| 2.4 | Migrate marketplace to `useInfiniteQuery` | `marketplace/page.tsx` | Cached browse/discover |
| 2.5 | Migrate notifications to `useInfiniteQuery` | `notifications/page.tsx` | Cached notification list |
| 2.6 | Migrate chat conversations to `useQuery` + pagination | `chat/page.tsx` | Paginated + cached |
| 2.7 | Migrate my-gigs, discover, connections | Various | Complete coverage |

### Phase 3 — Architecture Improvements (Week 6-7)

| # | Task | Files | Expected Impact |
|---|------|-------|----------------|
| 3.1 | Add virtualization to chat conversation list | `chat/page.tsx` | Handle 200+ conversations smoothly |
| 3.2 | Add virtualization to notifications | `notifications/page.tsx` | Handle deep notification history |
| 3.3 | Lower mailbox virtualization threshold to 20 | `components/mailbox/VirtualizedList.tsx` | Smoother mailbox scrolling |
| 3.4 | Replace socket token polling with events (web) | `SocketContext.tsx` | Eliminate 1/s polling overhead |
| 3.5 | Convert gig filter state to `useReducer` | `gigs-v2/page.tsx` | Atomic filter updates |
| 3.6 | Reduce AppShell state (group with `useReducer`) | `AppShell.tsx` | Fewer re-renders |
| 3.7 | Optimize chat message merging (binary insert) | `hooks/useChatMessages.ts` | Faster per-message processing |

### Phase 4 — SSR & Polish (Week 8-9)

| # | Task | Files | Expected Impact |
|---|------|-------|----------------|
| 4.1 | SSR for public gig/listing/post pages | `gigs/[id]`, `listing/[id]`, `posts/[id]` | SEO + faster initial render |
| 4.2 | Static generation for about/terms/privacy | Static pages | Instant load |
| 4.3 | Dynamic import heavy modals (PostComposer, MagicTask) | `AppShell.tsx`, modal triggers | Smaller initial bundle |
| 4.4 | Add `sizes` to all Image components | All Image usages | Responsive image serving |
| 4.5 | Add request cancellation to search/filter flows | Marketplace, Discover, Gigs | Cancel stale requests |
| 4.6 | Prefetch adjacent tab data on hover | Tab navigation | Instant tab switch |

### Expected Cumulative Impact

| Metric | Current (estimated) | After Phase 1-2 | After Phase 3-4 |
|--------|-------------------|----------------|----------------|
| Page navigation (cached) | 1-3s (spinner) | 50-200ms (instant) | 50-100ms (prefetched) |
| Page navigation (fresh) | 1-3s (spinner) | 500ms-1s (stale-while-revalidate) | 300-500ms (SSR) |
| Feed scroll performance | Degrades with depth | Constant (virtualized) | Constant |
| Image payload per page | Full-res (avg 2-5 MB) | Optimized (~0.8-2 MB) | Responsive (~0.5-1 MB) |
| Public page FCP | 2-3s (client render) | 2-3s | 500ms-1s (SSR) |
| Re-renders per state change | All visible components | Only affected components | Only affected components |
| Background CPU (polling) | High (1/s token sync) | Low (event-based) | Low |
