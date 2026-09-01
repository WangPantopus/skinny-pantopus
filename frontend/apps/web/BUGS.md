# Frontend Web — Bugs and issues

Comprehensive audit of `frontend/apps/web`: tests, TypeScript, error handling, and code-quality notes.

---

## 1. Test failures

### 1.1 VerificationCenter — "This isn't my home" move-out test fails

- **File:** `tests/components/VerificationCenter.test.tsx`
- **Test:** `button actions › "This isn't my home" calls move-out API`
- **Symptom:** `expect(mockPost).toHaveBeenCalledWith('/api/homes/test-home-123/move-out')` fails (0 calls).
- **Cause:** The component uses **`confirmStore.open()`** (custom async confirm modal) before calling `post()`. The test mocks **`window.confirm`** and clicks the button. Because `confirmStore` is not mocked, the confirm flow may not resolve as “yes,” so `post()` is never invoked.
- **Fix:** Mock `@/components/ui/confirm-store` so `confirmStore.open()` resolves with `true` in the test, then assert `mockPost` and `mockPush` as desired.

---

## 2. TypeScript errors (`npm run type-check`)

`tsc --noEmit` reports **100+ errors**. Summary by category:

### 2.1 Next.js layout — async params

- **File:** `src/app/(app)/app/mailbox/[drawer]/layout.tsx`
- **Issue:** Next 15 expects `params` to be a `Promise` in layouts; current typings use synchronous `params: { drawer: string }`. Type 'LayoutProps<"/app/mailbox/[drawer]">' is not assignable (params incompatible).
- **Also:** `.next/types/validator.ts` references this layout; fix the layout types to use `Promise<{ drawer: string }>` (or unwrap in the component).

### 2.2 Missing or wrong types from `@pantopus/api` / `@pantopus/types`

- **`BusinessPage`** — `businesses/[id]/pages/[pageId]/edit/_components/types.ts`: no exported member `BusinessPage` (suggests `businesses`).
- **`BusinessMembership`** — `businesses/page.tsx`: Cannot find name `BusinessMembership`.
- **`BusinessTeamMember`** — `business/[id]/team/page.tsx`: Cannot find name `BusinessTeamMember`.
- **`ChatRoomWithDetails`** — `business/[id]/inbox/page.tsx` and `businesses/[id]/chat/page.tsx`: missing or wrong type; properties like `other_participant_name`, `other_participant_username`, `last_message_preview`, `last_message_at` not on type.
- **`NeighborhoodPulse`** — `@pantopus/types` has no exported member (referenced from `packages/api` in type-check).

### 2.3 Type mismatches (wrong shape or null/undefined)

- **address-verify/page.tsx:** `NormalizedAddress` missing `lat`, `lng`; `AddressClaim` vs `Record<string, unknown>` callback.
- **business/[id]/activity/page.tsx:** `BusinessAuditEntry[]` used where `HomeAuditLogEntry[]` expected (e.g. missing `home_id`).
- **business/[id]/locations/.../hours/page.tsx:** `open_time`/`close_time` as `string | null` vs `string | undefined`; `BusinessHours` missing `id`, `location_id` on payload.
- **business/[id]/reviews/page.tsx:** `reviewer_username` does not exist on `BusinessReview` (suggests `reviewer_name`).
- **connections/page.tsx:** `RelationshipUser` missing `blocked_user`, `responded_at`, `created_at`.
- **discover/page.tsx:** `(marker: MapBusinessMarker) => void` vs `(marker: Record<string, unknown>) => void`.
- **gigs/GigsMap.tsx:** `GigsMapProps` not defined; `limit` not in API params type; `MapTaskListItem` vs `{ latitude, longitude, id? }` (e.g. `latitude: number | null`); `price` and cluster types.
- **gigs/[id]/review/page.tsx:** `GigWithDetails` vs `GigDetail`; `Review` missing `gig_id`, `updated_at`; `accepted_bid`, `owner`, `user` not on `GigDetail`.
- **gigs-v2/page.tsx:** `GigListItem` not assignable to `GigListItem & Record<string, unknown>`; `gig.tags` possibly undefined.
- **homes/[id]/dashboard/page.tsx:** Many: `unknown` vs `File[]`; `Record<string, unknown>` vs `TaskItem`, `MemberItem`, `HomeMember`, and specific payload types; `taskPanel.task` / `issuePanel.issue` / etc. possibly undefined; `null` vs non-null types.
- **homes/[id]/edit/page.tsx:** `coordinates` on `string | Record<...>`; `SetStateAction` with `{}` or `undefined`; various state setters.
- **useHomeData.ts:** `{}` vs `Record<string, unknown>[]` and missing properties (`id`, `permissions`, `role_base`, `isOwner`, etc.).
- **tests/components/useHomePermissions.test.tsx:** `HomeAccess.is_in_claim_window` `boolean | undefined` vs `boolean`.

### 2.4 Implicit any and unsafe casts

- **gigs/page.tsx:** Parameter `id` implicitly has type `any`.
- **Multiple files:** Use of `as any` or `Record<string, unknown>` where proper types would remove the need (see section 4).

**Recommendation:** Fix in order: (1) layout `params` Promise typing, (2) shared API/types exports (`BusinessPage`, `ChatRoomWithDetails`, etc.), (3) page-level type alignment (business, gigs, homes, connections, discover).

---

## 3. Empty or silent catch blocks

Errors are swallowed with no logging or user feedback. Prefer at least logging and/or a generic toast.

| File | Notes |
|------|--------|
| `src/app/(app)/app/mailbox/[drawer]/[item_id]/page.tsx` | `recordUnboxing` skip |
| `src/components/chat/ConversationView.tsx` | 4×: user/otherUser/topics fetch |
| `src/components/chat/MiniChatView.tsx` | user, chat refresh |
| `src/components/chat/ChatRoomView.tsx` | user, room, mark read, refresh |
| `src/components/discover/TrustLensChips.tsx` | localStorage |
| `src/app/(app)/app/mailbox/_components/useMailboxData.ts` | 5×: select/view/close mail |
| `src/app/(app)/app/settings/payments/page.tsx` | earnings, spending, transactions |
| `src/components/business/tabs/OverviewTab.tsx` | localStorage read/write |
| `src/app/(app)/app/gigs/page.tsx` | view mode localStorage |
| `src/app/(app)/app/marketplace/[id]/_components/useListingDetail.ts` | profile, share, upvote/pin/delete question |
| `src/components/feed/PostCard.tsx` | dismiss, onSolved |
| `src/components/gig-detail/QASection.tsx` | loadQuestions (3×) |
| `src/app/(app)/app/chat/page.tsx` | me |
| `src/components/hub/useHubContext.ts` | localStorage (3×) |
| `src/components/NotificationBell.tsx` | mark read, delete |
| `src/app/(app)/app/offers/page.tsx` | sent offers |
| `src/app/(app)/app/feed/post/[id]/page.tsx` | user |
| `src/app/error.tsx` | localStorage/sessionStorage clear |
| `src/app/global-error.tsx` | same |
| `src/hooks/useFeedData.ts` | user |
| `src/app/(app)/app/notifications/page.tsx` | fetch, mark read, delete |
| `src/hooks/useChatMessages.ts` | 4×: room/messages/send |
| `src/components/discover/useDiscoverData.ts` | (1×) |
| `src/components/AppShell.tsx` | user, listings |
| Playwright specs | `postDataJSON()` try/catch (acceptable for tests) |

---

## 4. Use of `any` and type assertions

Explicit `any` or `as any` that can hide bugs or break at runtime:

- **MailItemCard.tsx:** `(item as any).certified`, `(item as any).payout_amount`
- **CachedTileLayer.tsx:** `CachedTileLayerClass as any`
- **MarketplaceDiscoveryFeed.tsx, marketplace/page.tsx:** `item as any`, `result as any`, `nearest_activity_center`
- **my-gigs-v2/page.tsx, gigs-v2/page.tsx:** `(gig as any).engagement_mode`
- **gigs/new/page.tsx:** `getGigById(...) as any`
- **BaseMap.tsx:** `(layer as any)._url`
- **useLinkPreviews.ts, useLegacyMailDetail.ts:** Multiple `as any` on API responses and arrays
- **mailbox layout, MailItemCard, AIElfStrip, mailbox [item_id]:** `item as any` or `err: any`
- **gigs-v2/[id]/page.tsx:** `offer: any`, `offers: any[]`, `gig: any`, `socket: any`, `data: any`, and response casts

Prefer proper types from `@pantopus/api` / `@pantopus/types` and narrow with type guards instead of `as any`.

---

## 5. Documented BUG / product references

- **BUG 5B:** `src/components/home/useHomePermissions.tsx` — Claim window context comment (backend alignment).

---

## 6. ESLint disables and dependency risks

### 6.1 `react-hooks/exhaustive-deps` disabled

Dependency arrays intentionally incomplete; can cause stale closures or missing updates:

- **my-listings, marketplace (4×), notifications, homes/[id]/page, BidsDrawer, gigs/[id] (5×), OfferCard, useDiscoverData, useFeedData, HouseholdCalendar (2×), gig-detail (PaymentSection, BidPanel, ChangeOrdersSection, QASection), PlaceBriefCard, hub/page, useAreaPicker, useCluster, DiscoverMap (3×), business settings/legal, invite pages, network, feed, useAnimatedPins (2×), mailbox map, businesses/[id]/chat, useChatMessages (2×)**

Consider adding short comments (e.g. “intentionally omit X”) and reviewing each for correctness.

### 6.2 `@typescript-eslint/no-explicit-any` disabled

- **useLegacyMailDetail.ts, useLinkPreviews.ts** (file-level)
- **mailbox layout (2×), MailItemCard (2×), mailbox [item_id], AIElfStrip (3×)**

Tighten types so these disables can be removed.

### 6.3 `@next/next/no-img-element` disabled

Used in mailbox and asset UI (OfferCard, PackageUnboxing, StampCard, BookletCard, etc.) for `<img>` instead of `next/image`. Acceptable where dimensions or external URLs make `next/image` impractical; ensure alt text and loading behavior are correct.

---

## 7. Security and best practices

### 7.1 `dangerouslySetInnerHTML`

- **MailItemDetail.tsx:** Used with **DOMPurify** (`sanitizeHtml(block.content)` / `sanitizeHtml(block.html)`). Comment notes sanitization is required. No change needed; keep DOMPurify on any new HTML injection.

### 7.2 localStorage / sessionStorage

- **error.tsx / global-error.tsx:** `localStorage.clear()` / `sessionStorage.clear()` in `catch {}`. In private/SSR contexts these can throw; catch is acceptable but consider a safe helper that ignores errors.

---

## 8. Summary counts

| Category | Count |
|----------|--------|
| Failing tests | 1 (VerificationCenter move-out) |
| TypeScript errors (tsc) | 100+ |
| Files with empty/silent catch | 25+ |
| Files with `as any` / explicit any | 20+ |
| react-hooks/exhaustive-deps disables | 40+ |
| BUG/TODO refs in code | 1 (BUG 5B) |

---

## 9. Recommended order of work

1. **Tests:** Fix VerificationCenter test by mocking `confirmStore` (or equivalent) so move-out is exercised.
2. **Types:** Resolve layout `params` Promise and shared API/types exports, then fix pages (business, gigs, homes, connections, discover).
3. **Error handling:** Add logging or user feedback in critical empty catches (chat, mailbox, payments, feed).
4. **Linting:** Replace `any` with proper types where possible; document intentional exhaustive-deps exceptions.

---

*Generated from frontend/apps/web audit. Re-run `npm test`, `npm run type-check`, and codebase scan to refresh.*
