# Pantopus UX inventory — unfinished actions and weak states (U05 / U03)

## Disposition correction — 2026-09-23T22:12:47Z

This is the existing 155-item UX inventory, not a whole-app E2E coverage measure. Recounting the final handoff's explicit IDs gives29 unpublished and62 not-started items (its summary said31/about60). PR389 is now merged, moving S1-21 from open to fixed/merged. Current planning disposition: **63 fixed/merged,30 in flight (29 unpublished + C-15/#356),62 not started;92 unfinished**. The fixed/merged category preserves prior accepted evidence and does not assert a fresh all-platform pass. Newly discovered work such as geo392 is recorded in the hub without silently changing this inventory denominator. Original findings below remain historical until their owners reconcile each item with accepted evidence.


**Date:** 2026-09-23 · **Code:** `origin/master` **4f2983c5d** (Merge #281). Collection began on 27d45c027; every item was re-checked against 4f2983c5d after #231, #245, #256, #259, #260, #263, #265, #267–#277, #281 and #284 merged, and items those PRs fixed were dropped.
**Scope:** web (`frontend/apps/web`), iOS (`frontend/apps/ios`), Android (`frontend/apps/android`), with backend routes where a control depends on them. Read-only code audit: nothing was run on a device, simulator, emulator or browser.

**Path legend** (every `file:line` below is on 4f2983c5d, and every one was checked to exist and be in range):
- `A/` = `frontend/apps/android/app/src/main/java/app/pantopus/android/` · `RTS` = `A/ui/screens/root/RootTabScreen.kt`
- `I/` = `frontend/apps/ios/Pantopus/`
- `W/` = `frontend/apps/web/src/` · `P/` = `frontend/packages/api/src/`
- `B/` = `backend/`

**Severity:** *dead end* — a reachable control leads to a placeholder, a no-op, a 404 or a state with no way forward. *misleading* — the UI says something false (success on failure, "empty" when the load failed, a live-looking control that does nothing, a wrong destination). *weak* — it works, but a state is poorly handled (no error state, raw text, no next step, double submit, no confirm, no feedback). *cosmetic* — copy or minor.

**Reachability:** every item was traced from a normal entry point (tab, menu, list row, notification, deep link) to the control in code. Conditions are stated in the item (for example "only when the user has no shared Home", or a web flag that is off in production builds). Code that no user can reach is listed at the end, not counted.

## Totals

**155 items: 48 dead ends, 60 misleading, 37 weak, 10 cosmetic.**

| Owner | Dead end | Misleading | Weak | Cosmetic | Total |
|---|---:|---:|---:|---:|---:|
| Stream 1 | 5 | 13 | 5 | 2 | 25 |
| Stream 2 | 6 | 10 | 7 | 1 | 24 |
| Stream 3 | 27 | 26 | 12 | 4 | 69 |
| Coordinator | 10 | 11 | 13 | 3 | 37 |
| **All** | **48** | **60** | **37** | **10** | **155** |

Per client (an item that spans clients counts once for each; 57 items span two or three clients): **Web 70**, **iOS 79**, **Android 70**.

The native placeholder screen ("<label> isn't here yet / We're still designing this tab. Check back soon.") is reachable from 28 of Android's 54 placeholder call sites and 36 of iOS's 82 (C-22); the other sites are unreachable (see the dead-code list).

## The 15 highest-impact items

Ranked by how many users hit it, how badly it fails, and whether trust, money or privacy is involved.

| # | Item | Owner | Clients | Severity | Why it ranks here |
|---:|---|---|---|---|---|
| 1 | **C-01** The profile (You) screen has no way back into the app | Coordinator | iOS | dead end | Every iOS user who taps their avatar is stuck in the profile until they log out or force-quit; pushes that arrive meanwhile open hidden. |
| 2 | **S1-06** Every bid failure says "Couldn't submit. Try again in a moment." — including "set up payouts first" | Stream 1 | iOS, Android | misleading | Every new helper without payouts set up is blocked from bidding on paid tasks on iOS and Android and is told to "try again"; web already shows the reason and a payout button. |
| 3 | **S1-01** "Make offer" on a listing never creates an offer | Stream 1 | iOS, Android | dead end | The core buyer action on native marketplace silently creates an inquiry the seller can never see. |
| 4 | **S3-01** Creating a business always fails at step 2 | Stream 3 | Web | dead end | Nobody can create a business on web: every type chip is rejected by the API. |
| 5 | **S2-07** Mail action buttons announce success for actions that only log a click ("Payment started", "Reminder set", "Forwarded"…) | Stream 2 | iOS, Android | misleading | Native mail says "Payment started", "Reminder set", "Forwarded" when nothing happened — users may believe a bill is paid. |
| 6 | **S3-29** Most Privacy controls don't save; the screen shows sample addresses and a fake "Last updated" date | Stream 3 | iOS, Android | misleading | Native privacy controls look saved but reset; sample addresses and a fake "Last updated" date on a privacy screen. |
| 7 | **S3-28** If Settings or Advanced Privacy fail to load, the forms show defaults and Save overwrites the real settings | Stream 3 | Web | misleading | One failed load on web Settings or Advanced Privacy, then Save, silently makes a private profile public. |
| 8 | **S3-02** Booking notifications for Home- or Business-owned bookings now open nothing (regression from #245) | Stream 3 | iOS, Android | dead end | Merged today (#245): hosts of Home- and Business-owned bookings can no longer open any booking notification on iOS or Android. |
| 9 | **S1-07** Every listing's seller is shown as "Seller" with a verified badge | Stream 1 | iOS, Android | misleading | Every native listing shows a verified "Seller" — a trust signal that is simply false. |
| 10 | **S1-02** A seller can't see or act on offers from their listing | Stream 1 | Web | dead end | Web sellers can't reach the offers on their own listing; the button opens the buyer form. |
| 11 | **C-02** Hub status pills ("N notifications", "$X ready · Tap to withdraw") open a placeholder | Coordinator | iOS, Android | dead end | Anyone with unread notifications or a wallet balance taps a Hub pill and lands on "isn't here yet" (iOS and Android). |
| 12 | **C-04** You → Home rows open placeholders when the user has no shared Home (the founder's example) | Coordinator | iOS, Android | dead end | New users without a shared Home (including everyone still in verification) hit "isn't here yet" from every You → Home row; the add/claim flow already exists in My homes. |
| 13 | **S2-09** Home dashboard tabs (Tasks, Bills, Packages, Members, Ownership) never show their content | Stream 2 | iOS, Android | misleading | Every Home member's dashboard tabs (Tasks, Bills, Packages, Members, Ownership) show a placeholder or a false "Nothing in … yet" on native. |
| 14 | **S3-30** The Messages list stops updating after you open any conversation | Stream 3 | iOS | misleading | iOS Messages stops updating after the first conversation is opened: stale unread state and missing new messages on a top-traffic screen. |
| 15 | **S1-19** "Confirm completion" releases the payment in one tap, with no confirm | Stream 1 | iOS, Android | weak | Releasing held payment is one tap with no confirm on iOS and Android (web has a review step). |

**Correction to the founder's example:** on Android (and iOS), the You → Home *tiles* do not open a placeholder when there's no shared Home — they are greyed out and ignore taps. The placeholders come from the Home identity's *rows*. The fix is the one suggested: route them to My homes, which already has "Add a home", Find, and the verification steps (C-04).


## Stream 1 — gigs, payments, wallet, tips, change orders, disputes, marketplace (25: 5 dead end, 13 misleading, 5 weak, 2 cosmetic)

### Stream 1 · dead end (5)

#### S1-01 · "Make offer" on a listing never creates an offer
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Nearby → Marketplace → a listing → "Make offer" → Send.
- **Where:** `I/Features/ContentDetail/ListingDetailViewModel.swift:64-79`; `I/Core/Networking/Endpoints/ListingsEndpoints.swift:153-156`; `I/Features/ContentDetail/ListingDetailView.swift:89-121`; `A/ui/screens/contentdetail/ListingDetailViewModel.kt:76-89`; `A/ui/screens/contentdetail/ListingDetailScreen.kt:103-105`; `A/ui/screens/contentdetail/ListingDetailScreen.kt:144-157`
- **What the user sees:** On success the sheet just closes (it promises "Pickup details get worked out in chat.", but no chat is created). On failure nothing happens; Send stays tappable while sending. The seller never sees the offer in "View offers" and gets no notification; a second try is refused ("You already have a pending inquiry on this listing"). iOS also drops amounts typed as "25,50".
- **Evidence:** Both call `POST /api/listings/:id/message`, which stores a `ListingMessage` inquiry (`B/routes/listings.js:1686-1749`). The seller's "View offers" reads `GET /api/listings/:id/offers` (`B/routes/listingOffers.js:78`). No native client reads `/messages`.
- **Fix (reuse):** Call the existing `POST /api/listings/:listingId/offers` (`B/routes/listingOffers.js:58`) from `ListingOffersEndpoints` / `A/data/api/services/ListingOffersApi.kt`, with an in-flight state, inline error and an "Offer sent" toast (pattern: `A/ui/screens/my_bids/EditBidSheet.kt:95-194`); parse amounts locale-aware on iOS.
- **Backend change:** none
- **Other clients / notes:** Web is correct: `W/app/(app)/app/marketplace/[id]/_components/OfferModal.tsx:46-58` calls `createOffer` and toasts "Offer sent!".

#### S1-02 · A seller can't see or act on offers from their listing
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Notification "New offer on {title}" (link `/listing/<id>` → `/app/marketplace/<id>`, `W/lib/notificationRoutes.ts:40-44`) or My listings → a listing → owner's "View Offers (N)".
- **Where:** `W/app/(app)/app/marketplace/[id]/_components/ListingActions.tsx:78-83`; `W/app/(app)/app/marketplace/[id]/page.tsx:138`; `W/app/(app)/app/marketplace/[id]/page.tsx:201-208`
- **What the user sees:** The buyer form "Make an Offer" / "Send Offer"; submitting returns "You cannot make an offer on your own listing".
- **Evidence:** The owner's button calls `onMakeOffer` → `setShowOfferModal(true)` → OfferModal. `existingOffer` only matches the viewer as buyer (`W/app/(app)/app/marketplace/[id]/_components/useListingDetail.ts:89-96`). The seller page `W/app/(app)/app/listing-offers/page.tsx` (accept, decline, counter) has no inbound link anywhere in web.
- **Fix (reuse):** For the owner, route "View Offers" to `/app/listing-offers?listingId=<id>&title=<title>`.
- **Backend change:** none
- **Other clients / notes:** iOS sends the owner to ListingOffersView (`I/Features/Root/MarketplaceTabRoot.swift:114`); Android to its offers route (RTS:4518-4520).

#### S1-03 · Marketplace map "+" (New Listing) button does nothing
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Nearby → Marketplace (opens in map view by default, `W/app/(app)/app/marketplace/page.tsx:109`) → round "+" at the map's bottom right.
- **Where:** `W/app/(app)/app/marketplace/page.tsx:777`; `W/app/(app)/app/marketplace/MarketplaceMap.tsx:414-423`
- **What the user sees:** Nothing happens.
- **Evidence:** The page wires `onOpenCreateModal={() => setShowCreateModal(false)}`.
- **Fix (reuse):** Pass `() => setShowCreateModal(true)`, as the header "+ Post" does (`page.tsx:734`).
- **Backend change:** none

#### S1-04 · Listing offers "View transaction" goes nowhere
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Your listing → "View offers" → an accepted or completed offer → "View transaction" (the row's main button).
- **Where:** `I/Features/Root/YouTabRoot.swift:1332`; `I/Features/Root/HubTabRoot.swift:2281`; `I/Features/Root/TasksTabRoot.swift:364-366`; `I/Features/Root/MarketplaceTabRoot.swift:151`; `RTS:4547`
- **What the user sees:** "Transaction detail isn't here yet" (iOS You, Hub and Tasks stacks; Android). In the iOS Marketplace sheet the tap does nothing (`onOpenTransaction: { _ in }`).
- **Evidence:** `I/Features/ListingOffers/ListingOffersViewModel.swift:570-572, 1084-1099`; `A/ui/screens/listing_offers/ListingOffersViewModel.kt:366-367, 418, 430`.
- **Fix (reuse):** No client has a transaction screen and there is no per-offer GET. Replace the button with existing actions: message the buyer through the listing-topic chat (as RTS:4500-4516 does) or open the buyer's profile; keep "Leave a review".
- **Backend change:** none
- **Other clients / notes:** Web shows only a status label (`W/app/(app)/app/listing-offers/page.tsx:150-151`).

#### S1-05 · Listing detail: a sold listing's "Find similar" opens the offer sheet; "Alert me · Set", Share and Bookmark do nothing
- **Clients:** Android · **Severity:** dead end
- **How the user gets there:** Marketplace → a listing (sold, or any listing for the icons).
- **Where:** `A/ui/screens/contentdetail/ListingDetailScreen.kt:82-89`; `A/ui/screens/contentdetail/ListingDetailViewModel.kt:143-163`; `A/ui/screens/contentdetail/ContentDetailShell.kt:317-340`; `A/ui/screens/contentdetail/ContentDetailShell.kt:1390-1400`
- **What the user sees:** "Find similar" opens "Make an offer"; sending then fails silently ("Listing is no longer active"). The "Set" button and the cover Share/Bookmark icons have no click handler.
- **Evidence:** The main button opens the offer sheet for any non-owner; the icons are drawn without handlers.
- **Fix (reuse):** Make "Find similar" a marketplace search (or hide it); Share → `Context.shareText`; Bookmark → the existing `POST api/listings/{id}/save` (`A/data/api/services/ListingsApi.kt:122`); hide "Set".
- **Backend change:** none

### Stream 1 · misleading (13)

#### S1-06 · Every bid failure says "Couldn't submit. Try again in a moment." — including "set up payouts first"
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** Nearby → Tasks → a paid task → Place bid → Submit, as a helper without a Stripe payout account (every new helper), or on a closed task, a duplicate bid or during the re-bid cooldown.
- **Where:** `I/Features/ContentDetail/GigDetailViewModel.swift:1394-1411`; `I/Features/MyBids/EditBidSheetView.swift:278-281`; `A/ui/screens/contentdetail/GigDetailViewModel.kt:1497-1524`; `A/ui/screens/my_bids/EditBidSheet.kt:192`
- **What the user sees:** "Couldn't submit. Try again in a moment." Retrying never helps, so a new helper can't bid on any paid task and isn't told why.
- **Evidence:** iOS `catch { return false }`; Android `onResult(false)`. The server says "You need to set up payout onboarding before bidding on paid gigs. Go to your Wallet to complete Stripe setup." with `code: 'payout_onboarding_required'` (`B/routes/gigs.js:3946-3952`), "This gig is no longer accepting bids" (`:3924`), "You already have an active bid on this gig" (`:3972`), and a 429 cooldown (`:3983`).
- **Fix (reuse):** Show the server's message (both apps already carry user-readable 4xx text); on `payout_onboarding_required` add a button to payout setup (Android `ChildRoutes.SETTINGS_PAYMENTS`; iOS `.paymentsSettings`). iOS delivery proof has the same catch-all ("Couldn't send your proof…", `I/Features/ContentDetail/DeliveryProofSheet.swift:485`).
- **Backend change:** none
- **Other clients / notes:** Web handles all of this, including the payout CTA (`W/components/gig-detail/BidPanel.tsx:94-112`). PR #264 fixes seven other Android gig sheets, not the bid sheet.

#### S1-07 · Every listing's seller is shown as "Seller" with a verified badge
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** Marketplace → any listing → seller row.
- **Where:** `I/Features/ContentDetail/ListingDetailViewModel.swift:156-166`; `A/ui/screens/contentdetail/ListingDetailViewModel.kt:111-119`
- **What the user sees:** "Seller", initials "S", verified check — for every seller. On iOS, "Message" opens a chat whose person header is the listing title ("Blue IKEA couch") (`I/Features/Root/MarketplaceTabRoot.swift:101-105`, `TasksTabRoot.swift:309-313`).
- **Evidence:** Hard-coded `displayName: "Seller", initials: "S", verified: true`. The backend already returns `creator` (`B/routes/listings.js:1382`, `SAFE_CREATOR_SELECT`), but `ListingDTO` / `ListingDto` don't decode it.
- **Fix (reuse):** Decode `creator` and build the card like `GigDetailViewModel.posterCounterparty` (`I/Features/ContentDetail/GigDetailViewModel.swift:2303-2318`); use the seller's name for the chat header.
- **Backend change:** none
- **Other clients / notes:** Web shows the real seller.

#### S1-08 · Business dashboard "Payments" tab shows the owner's personal payout account as the "Business Payout Account"
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** `/app/businesses/<id>/dashboard` → sidebar "Payments" (`W/components/AppShell.tsx:840`) → `<PaymentsTab />` rendered without a business id (`W/app/(app)/app/businesses/[id]/dashboard/page.tsx:226`).
- **Where:** `W/components/business/tabs/PaymentsTab.tsx:13`; `W/components/business/tabs/PaymentsTab.tsx:23`; `W/components/business/tabs/PaymentsTab.tsx:34`; `W/components/business/tabs/PaymentsTab.tsx:45`
- **What the user sees:** "Business Payout Account — Set up Stripe to receive payments for business gigs and services" with the user's personal Stripe status; Connect / Continue / Dashboard act on the personal account. A failed load reads as "not connected"; failures only `console.error`.
- **Evidence:** `api.payments.getStripeAccount()` is `GET /api/payments/connect/account` (`P/endpoints/payments.ts:51-55`). Business-scoped functions exist but have no web caller (`P/endpoints/businesses.ts:1232-1242` → `B/routes/businesses.js:4460, 4514, 4541, 4568`).
- **Fix (reuse):** Pass the business id and use `getBusinessStripeAccount` / `connectBusinessStripe` / `refreshBusinessStripeLink` / `getBusinessStripeDashboardLink`; toast failures. Money surface: confirm with main before changing.
- **Backend change:** none
- **Other clients / notes:** Android `BusinessPaymentsScreen` uses the business routes (`A/data/api/services/BusinessFinanceApi.kt:53-87`, RTS:5785-5789); so does iOS (`I/Core/Networking/Endpoints/BusinessFinanceEndpoints.swift:28`). Owner note: business surface is Stream 3.

#### S1-09 · The poster's bids/offers panel says "No bids yet" when loading bids failed
- **Clients:** iOS, Android, Web · **Severity:** misleading
- **How the user gets there:** A task you posted → bids panel.
- **Where:** `I/Features/ContentDetail/GigDetailViewModel.swift:467-470`; `I/Features/ContentDetail/GigDetailViewModel.swift:489-491`; `A/ui/screens/contentdetail/GigDetailViewModel.kt:881`; `W/components/gig-detail/OffersPanel.tsx:73-77`; `W/components/gig-detail/OffersPanel.tsx:159-166`
- **What the user sees:** iOS "Bids (0) / No bids yet / Neighbors usually bid within the first few hours." (`I/Features/ContentDetail/GigLifecycleSections.swift:39-61`); Android "No bids yet" while the status pill says "Open · 3 bids" (`A/ui/screens/contentdetail/GigLifecyclePanels.kt:337`); web "Failed to load offers" followed by "No offers yet."
- **Evidence:** Failures become empty lists (`try?` on iOS; failure → `emptyList()` on Android).
- **Fix (reuse):** Keep a failed state and show an error with Retry inside the panel (shared ErrorState); on web hide the empty text while `offersError` is set (the Refresh button already exists, `OffersPanel.tsx:150-157`).
- **Backend change:** none

#### S1-10 · A failed marketplace load looks like an empty area
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Nearby → Marketplace while the browse call fails.
- **Where:** `W/app/(app)/app/marketplace/page.tsx:282-307`; `W/app/(app)/app/marketplace/page.tsx:766-781`; `W/app/(app)/app/marketplace/page.tsx:916-923`; `W/components/marketplace-browse/MarketplaceDiscoveryFeed.tsx:269`
- **What the user sees:** Grid: "No listings found / Be the first to list something in your area!"; map (the default): an empty map with no message; "near" tab: blank.
- **Evidence:** `browseQuery` / `discoverQuery` errors are never read.
- **Fix (reuse):** Branch on `isError` and render `ErrorState` with `refetch`.
- **Backend change:** none

#### S1-11 · A failed task list shows the error and "No tasks match your filters" together; a failed load-more is silent
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Nearby → Tasks with filters/search, or without a location.
- **Where:** `W/app/(app)/app/gigs/page.tsx:727-729`; `W/app/(app)/app/gigs/page.tsx:766-790`; `W/app/(app)/app/gigs/page.tsx:315`
- **What the user sees:** "Something went wrong / Failed to load tasks. Please try again. [Try Again]" directly above "No tasks match your filters / Try expanding your search or check back later. [Post a Task]".
- **Evidence:** The empty branch doesn't check `fetchError`; load-more failures skip the banner (`if (!append)`).
- **Fix (reuse):** Guard the empty branch with `!fetchError` and reuse the inline banner (`:730-742`) for load-more failures.
- **Backend change:** none

#### S1-12 · Gig and listing detail pages show "not found" for any failure, with no retry
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Any gig or listing link (including notifications) while the API fails.
- **Where:** `W/app/(app)/app/gigs/[id]/page.tsx:195-202`; `W/app/(app)/app/gigs/[id]/page.tsx:419-432`; `W/app/(app)/app/marketplace/[id]/_components/useListingDetail.ts:57-65`; `W/app/(app)/app/marketplace/[id]/page.tsx:81-94`
- **What the user sees:** "Gig not found / This gig may have been removed or doesn't exist." / "Listing not found". Also, if only `getMyProfile` fails (`gigs/[id]/page.tsx:184-192`) the owner sees the bid form on their own task (`W/components/gig-detail/BidPanel.tsx:197`).
- **Evidence:** Every catch renders not-found.
- **Fix (reuse):** Show not-found only for `statusCode === 404`; otherwise `ErrorState` (`W/components/ui/ErrorState.tsx`) with a reload.
- **Backend change:** none

#### S1-13 · "Make Offer" shows on reserved listings, which always refuse offers
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** A reserved listing → "Make Offer".
- **Where:** `W/app/(app)/app/marketplace/[id]/_components/ListingActions.tsx:70`; `B/services/marketplace/listingOfferService.js:67-68`
- **What the user sees:** The user fills in the form and gets "Listing is not accepting offers".
- **Evidence:** The button shows for `active` or `reserved`; the service accepts only `active`.
- **Fix (reuse):** Show "Make Offer" only for `active`; keep "View Offer" for an existing offer.
- **Backend change:** none

#### S1-14 · "Similar Items Nearby" heart animates but saves nothing
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Any listing detail → Similar Items Nearby → heart.
- **Where:** `W/app/(app)/app/marketplace/[id]/_components/SimilarListings.tsx:58`
- **What the user sees:** The heart bounces; nothing is saved.
- **Evidence:** `onSave={() => {}}`.
- **Fix (reuse):** Call `api.listings.toggleSave` (`P/endpoints/listings.ts:346` → `B/routes/listings.js:1611`) with optimistic state, as `W/app/(app)/app/marketplace/page.tsx:544-576` does.
- **Backend change:** none

#### S1-15 · Task category chips let you pick several, but only the first filters
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Nearby → Tasks → category chips.
- **Where:** `W/components/gig-browse/FilterChipBar.tsx:187-193`; `W/app/(app)/app/gigs/page.tsx:59-65`
- **What the user sees:** Several chips selected; results for one category.
- **Evidence:** The request sends only the first category; the backend takes one.
- **Fix (reuse):** Make the chips single-select.
- **Backend change:** none

#### S1-16 · gigs-v2 "Chat" lands on the Mailbox, not the chat
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** `/app/gigs` "Post a task" (`W/app/(app)/app/gigs/page.tsx:479`) → `/app/gigs-v2/new` → auto-redirect to `/app/gigs-v2/<id>` → once assigned, "Chat".
- **Where:** `W/app/(app)/app/gigs-v2/[id]/page.tsx:567-573`
- **What the user sees:** The Mailbox; nothing reads `?roomId=`. Errors are swallowed.
- **Evidence:** The handler pushes `/app/mailbox?roomId=…`.
- **Fix (reuse):** Push `/app/chat/<roomId>` and toast on failure, as `W/app/(app)/app/gigs/[id]/page.tsx:357-362` does.
- **Backend change:** none
- **Other clients / notes:** Native opens the room directly.

#### S1-17 · Marketplace searches around New York when no location is cached
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** Nearby → Marketplace before location is granted or cached.
- **Where:** `I/Features/Marketplace/MarketplaceViewModel.swift:120-121`; `I/Features/Marketplace/MarketplaceViewModel.swift:147-148`
- **What the user sees:** "Nothing for sale nearby yet / Be the first to post…" computed at the Empire State Building.
- **Evidence:** `cachedCoordinate() ?? UserCoordinate(latitude: 40.7484, longitude: -73.9857, …)`; the same fallback is in `I/Features/Nearby/NearbyMapViewModel.swift:163` and `I/Features/Explore/ExploreMapViewModel.swift:195`.
- **Fix (reuse):** Follow Pulse (`I/Features/Feed/PulseFeedViewModel.swift:663-681`: cached, then a short fresh request, then nothing); without a location, ask the user to turn it on.
- **Backend change:** none
- **Other clients / notes:** Web falls back to Portland coordinates (`W/app/(app)/app/marketplace/page.tsx:401-406`); whether it labels the area is unverified.

#### S1-18 · Every task poster shows "Member since 2026"
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Any task detail → poster card.
- **Where:** `W/app/(app)/app/gigs/[id]/page.tsx:757`
- **What the user sees:** "Member since 2026" for everyone.
- **Evidence:** Literal text; the poster summary has no join date (`:84-100`).
- **Fix (reuse):** Remove the line, or render it once the summary carries a join date (backend).
- **Backend change:** none for removal

### Stream 1 · weak (5)

#### S1-19 · "Confirm completion" releases the payment in one tap, with no confirm
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** A task you posted, after the helper marks it done → "Confirm completion".
- **Where:** `A/ui/screens/contentdetail/GigLifecyclePanels.kt:186`; `A/ui/screens/contentdetail/GigLifecyclePanels.kt:856-863`; `I/Features/ContentDetail/GigLifecycleSections.swift:493-499`; `I/Features/ContentDetail/GigDetailView.swift:319-327`
- **What the user sees:** One tap captures the held payment. Android's in-flight flag (`A/ui/screens/contentdetail/GigDetailViewModel.kt:1965-2005`) isn't shown on the button.
- **Evidence:** The button calls the capture path directly; the backend captures via `stripeService.capturePayment` (`B/routes/gigs.js:5697`).
- **Fix (reuse):** Add a confirm ("Release $X to <helper>?") and show progress while in flight.
- **Backend change:** none
- **Other clients / notes:** Web routes through a review step ("Review & Confirm", `W/components/gig-detail/CompletionActionCards.tsx:126-131`).

#### S1-20 · Seller offer actions fail silently; Decline has no confirm; Android's "Withdraw counter" declines the whole offer
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** Your listing → View offers → Accept / Decline / Counter (iOS); Counter / Accept / "Withdraw counter" (Android).
- **Where:** `I/Features/ListingOffers/ListingOffersViewModel.swift:591-635`; `I/Features/ListingOffers/ListingOffersViewModel.swift:727-748`; `A/ui/screens/listing_offers/ListingOffersViewModel.kt:376-403`; `A/ui/screens/listing_offers/ListingOffersViewModel.kt:899-909`
- **What the user sees:** On failure the row quietly flips back (including the 409 "only pending offers can be countered"). Decline is one tap. Android pending offers have no Decline, and "Withdraw counter" permanently declines the buyer's offer, with no confirm.
- **Evidence:** Error paths only restore the previous rows; Android's withdraw calls decline (`B/services/marketplace/listingOfferService.js:345-366` sets `declined`).
- **Fix (reuse):** Toast errors; confirm before Decline (pattern: "Reject this bid?", `I/Features/ContentDetail/GigDetailView.swift:171-183`); on Android relabel to "Decline offer" with a confirm and add Decline to pending offers.
- **Backend change:** none (a true "withdraw counter" would need a route)

#### S1-21 · Offer and completion errors can show raw database text
- **Clients:** Web, iOS · **Severity:** weak
- **How the user gets there:** Make/counter/accept/decline/withdraw an offer, or confirm completion, when the database write fails.
- **Where:** `B/routes/listingOffers.js:69`; `B/routes/gigs.js:5754`; `B/routes/gigs.js:5771`; `W/app/(app)/app/marketplace/[id]/_components/OfferModal.tsx:57-58`; `W/components/gig-detail/CompletionFlow.tsx:368`
- **What the user sees:** The PostgREST error text, verbatim, in a toast.
- **Evidence:** `listingOfferService.js:109-111` rethrows the insert error; `listingOffers.js:69, 155, 172, 189, 206, 223` return `err.message` with 500; confirm completion returns `err.message || …` (`gigs.js:5754, 5771`). Since #277, web shows it via `getErrorMessage`; iOS shows 4xx text from these routes (`I/Features/ContentDetail/GigDetailViewModel.swift:2041`).
- **Fix (reuse):** Backend: return fixed copy when the error has no status, as `gigs.js:5633` does (`err.statusCode ? err.message : 'Failed to mark gig completed'`).
- **Backend change:** yes (copy only)

#### S1-22 · Counter-offers use browser prompts; gigs-v2 "Decline" has no confirm
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Your task → Offers panel → Counter; gigs-v2 detail → Decline (right after posting, S1-16).
- **Where:** `W/components/gig-detail/OffersPanel.tsx:110-121`; `W/app/(app)/app/gigs-v2/[id]/page.tsx:190-196`; `W/app/(app)/app/gigs-v2/[id]/page.tsx:577-585`
- **What the user sees:** Native `prompt()` dialogs; an invalid amount is silently ignored; no success feedback or in-flight guard. gigs-v2 Decline is one click and swallows errors. Change-order decline reasons also use `prompt()` (`W/components/gig-detail/ChangeOrdersSection.tsx:100`).
- **Fix (reuse):** An inline amount field (as the `/app/listing-offers` counter flow has), the existing confirm dialog, and toasts.
- **Backend change:** none

#### S1-23 · Marking a listing Sold or Archived is one click, with no confirm or success message
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Your listing → status actions.
- **Where:** `W/app/(app)/app/marketplace/[id]/_components/ListingActions.tsx:108-122`; `W/app/(app)/app/marketplace/[id]/_components/useListingDetail.ts:211-218`
- **What the user sees:** The status changes silently.
- **Fix (reuse):** `confirmStore` for sold/archived, then `toast.success`.
- **Backend change:** none

### Stream 1 · cosmetic (2)

#### S1-24 · Seller "View Profile" is disabled with no reason
- **Clients:** Web · **Severity:** cosmetic
- **How the user gets there:** A listing whose seller has no public profile.
- **Where:** `W/app/(app)/app/marketplace/[id]/_components/SellerSection.tsx:47-54`
- **What the user sees:** A greyed button.
- **Fix (reuse):** Hide it or add a one-line reason.
- **Backend change:** none

#### S1-25 · Listing compose: the camera "Auto" button does nothing; "Local delivery · Up to 3 mi · $40 fee" is hard-coded
- **Clients:** Android · **Severity:** cosmetic
- **How the user gets there:** Post a listing → photos step / delivery option.
- **Where:** `A/ui/screens/compose/listing/ListingComposeWizardScreen.kt:441-446`; `A/ui/screens/compose/listing/ListingComposeWizardScreen.kt:1515`
- **What the user sees:** A dead flash toggle; a fee the form never asks for.
- **Fix (reuse):** Hide the toggle; drop the fee text.
- **Backend change:** none

## Stream 2 — Home, household, mailbox, residency, bills, packages, records, landlord, calendar (24: 6 dead end, 10 misleading, 7 weak, 1 cosmetic)

### Stream 2 · dead end (6)

#### S2-01 · "Invite your landlord" opens a 404
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Place verify sheet (`W/components/place/VerifyPromptSheet.tsx:77`) or the waiting room (`W/app/(app)/app/homes/[id]/waiting-room/page.tsx:131`) → `/app/homes/<id>/verify-landlord` → "No landlord on file" (the common case) → "Invite your landlord".
- **Where:** `W/components/home/LandlordVerificationFlow.tsx:188`; `W/components/home/LandlordVerificationFlow.tsx:431-446`
- **What the user sees:** Next's 404 page.
- **Evidence:** `router.push(`/app/homes/${homeId}/invite-landlord`)`: there is no such page and no tenant→landlord invite route (`B/routes/landlordTenant.js` has the landlord-side `/landlord/lease/invite` at :309 and tenant `preview-invite` at :624).
- **Fix (reuse):** Hide this option and keep "Verify with a mailed code" and "Upload lease" (`LandlordVerificationFlow.tsx:189-190`). A real invite needs a new backend route.
- **Backend change:** none to hide; new route to build
- **Other clients / notes:** Natives don't offer it; Android falls back to mail verification when there is no landlord (`A/ui/screens/homes/verify_landlord/VerifyLandlordWizardViewModel.kt:80-91`).

#### S2-02 · Records "Add photo" fails silently (its backend route never existed)
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Mailbox nav "Records" (`W/components/mailbox/MailboxNav.tsx:45`) → an asset → "📷 Add photo".
- **Where:** `W/app/(app)/app/mailbox/records/[asset_id]/page.tsx:222-230`; `W/lib/mailbox-queries.ts:584-599`; `W/lib/mailbox-api.ts:604-615`
- **What the user sees:** "Uploading..." then back to "Add photo"; no photo, no message. Picking the same file again does nothing (the input isn't reset).
- **Evidence:** `POST /api/mailbox/v2/p3/records/asset/:id/photos` has no route (route scan on 4f2983c5d); no backend code writes `AssetPhoto` (only read, `B/routes/mailboxV2Phase3.js:226, 302`). `useAddAssetPhoto` has no `onError`.
- **Fix (reuse):** Hide "Add photo" until a write route exists; at minimum show `addPhoto.error`.
- **Backend change:** yes, to make it real (a write route for `AssetPhoto`)
- **Other clients / notes:** Native Records screens are read-only. Coordinator's route scan item #3; not in Stream 2's in-progress list (#4–#9).

#### S2-03 · Earn dashboard: help, refer, offer a service and "See all" open placeholders; figures are static samples
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Mail tab → "Earn" chip → empty state "Open Earn dashboard" (`A/ui/screens/mailbox/mailbox_root/MailboxRootViewModel.kt:393-399` → RTS:2434; `I/Features/Mailbox/MailboxRoot/MailboxRootViewModel.swift:569-575`), or `pantopus://earn`.
- **Where:** `RTS:5735`; `RTS:5738-5742`; `I/Features/Root/HubTabRoot.swift:2943-2951`
- **What the user sees:** "Earn help isn't here yet", "Refer a neighbor isn't here yet", "Offer a service isn't here yet", "All earnings isn't here yet". Every user sees "28 near you · up to $140 today" and "+$10 when they finish a task".
- **Evidence:** The figures come from sample data (`A/ui/screens/mailbox/earn/EarnSampleData.kt:28, 34`; iOS `EarnSampleData.waysToEarn`); no backend source was found.
- **Fix (reuse):** Help → Help center (Android SETTINGS_HELP RTS:1025; iOS `.helpCenter`); Refer → the invite share (`A/ui/screens/you/me/MeViewModel.kt:77` + `shareText`); Offer a service → PROFESSIONAL_PROFILE (RTS:1731) or hide; See all → drop it (history already loads, `B/routes/mailbox.js` earn history) or open payments settings; replace the static figures with neutral copy.
- **Backend change:** none
- **Other clients / notes:** Web has no Earn dashboard (`/app/mailbox/earn/wallet` redirects to `/app/settings/payments`).

#### S2-04 · Mail translation: "Reply" opens a placeholder; "Archived" and other chips toast success for nothing
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Mail → a letter → ⋯ → Translate → Confirm translation → "Reply to <name>", chips Share / Archive / Edit / Language, top-bar share.
- **Where:** `RTS:5687`; `A/ui/screens/mailbox/translation/MailTranslationScreen.kt:131`; `A/ui/screens/mailbox/translation/MailTranslationScreen.kt:245-259`; `I/Features/Root/HubTabRoot.swift:2913`; `I/Features/Mailbox/Translation/MailTranslationView.swift:141-163`
- **What the user sees:** "Reply in English isn't here yet"; toasts "Archived" (nothing is archived), "Sharing translation…", "Edit translation…", "Change language…".
- **Evidence:** The chips only set toasts.
- **Fix (reuse):** Archive → `PATCH /api/mailbox/:id/archive` (`B/routes/mailbox.js:2770`), toast only on success (natives need the call; web uses `archiveMail`, `P/endpoints/mailbox.ts:444`); Share → system share of the translated text; Reply → the existing letter composer, or hide; hide Edit and Language.
- **Backend change:** none
- **Other clients / notes:** Web's translation page has none of these actions.

#### S2-05 · Visit setup "Link an access code ›" does nothing
- **Clients:** iOS, Android, Web · **Severity:** dead end
- **How the user gets there:** Home → Scheduling → Create → "Schedule a visit" (web `W/components/scheduling/home/HomeAgenda.tsx:486-492`).
- **Where:** `W/components/scheduling/home/resources/VisitSetup.tsx:284-294`; `I/Features/Scheduling/Home/Resources/ScheduleVisitView.swift:171-201`; `A/ui/screens/scheduling/visits/VisitSetupScreen.kt:359`
- **What the user sees:** A chevron row that does nothing.
- **Evidence:** No handler on any client. Access codes exist (`/app/homes/[id]/access`; `B/routes/home.js:3857`), but a visit can't carry one (`visitSchema`, `B/routes/scheduling.js:1030`).
- **Fix (reuse):** Link the row to the existing access-codes screen (web `/app/homes/[id]/access`; natives' access-codes routes), or remove it. Attaching a code to a visit needs a backend field.
- **Backend change:** only to attach codes to visits
- **Other clients / notes:** Web reachability: the Home "Scheduling" sidebar entry needs the web scheduling flag (default off in production builds, `W/lib/featureFlags.ts:32-34`; `W/components/AppShell.tsx:759`).

#### S2-06 · Landlord "tenant_request" notifications open nothing; there is no native landlord requests screen
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** A landlord taps the tenant request notification (link `/app/landlord/properties/<homeId>?tab=requests`, `B/services/addressValidation/landlordAuthorityService.js:402-405`).
- **Where:** `I/Core/Routing/DeepLinkRouter.swift:566-567`; `A/core/routing/DeepLinkRouter.kt:751`
- **What the user sees:** The notification is marked read and nothing opens.
- **Evidence:** Neither router has a landlord case; natives only have tenant-side lease endpoints.
- **Fix (reuse):** Product decision: at minimum open the Home (or Notifications) so the tap isn't dropped; a landlord requests screen needs design approval.
- **Backend change:** none
- **Other clients / notes:** Web has `/app/landlord/properties/[homeId]?tab=requests`.

### Stream 2 · misleading (10)

#### S2-07 · Mail action buttons announce success for actions that only log a click ("Payment started", "Reminder set", "Forwarded"…)
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** Mail tab → Mailbox → a letter → action buttons (a bill gets Pay / Remind / File / Forward / Dispute, `I/Features/Mailbox/MailDetail/Variants/GenericMailDetailLayout.swift:141, 516-560`).
- **Where:** `I/Features/Mailbox/MailDetail/MailCategoryActions.swift:106-121`; `I/Features/Mailbox/MailDetail/MailDetailViewModel.swift:492-508`; `A/ui/screens/mailbox/mail_detail/MailCategoryActions.kt:42-68`; `A/ui/screens/mailbox/mail_detail/MailDetailViewModel.kt:423-445`
- **What the user sees:** Toasts "Payment started", "Signature requested", "Reminder set", "Forwarded", "Dispute logged", "Shared with your household", "Task created". Nothing is paid, signed, reminded, forwarded (there is no recipient), disputed, shared or created.
- **Evidence:** Both call `POST /api/mailbox/v2/item/:id/action`, which sets `lifecycle` for file/shred/forward and otherwise only logs `mail_action_clicked` (`B/routes/mailboxV2.js:463-490`).
- **Fix (reuse):** Keep File and Dismiss. Route "Create Task" to the existing task-from-mail flow (iOS `onCreateTask`, `I/Features/Mailbox/MailDetail/MailDetailView.swift:353`; Android RTS:4061-4065 → `POST /api/mailbox/v2/p3/tasks/from-mail`). Hide Pay / Sign / Remind / Forward / Dispute / Share, or change their toast to something true ("Noted"), until they do something.
- **Backend change:** none for the minimal fix; real Pay/Remind/Forward need backend work
- **Other clients / notes:** Web doesn't render these actions. PR #280 fixes the task-from-mail route itself, not these toasts.

#### S2-08 · Mail detail overflow menus are full of items that do nothing
- **Clients:** iOS, Android, Web · **Severity:** misleading
- **How the user gets there:** Mail → any letter → ⋯ (and some in-body buttons).
- **Where:** `A/ui/screens/mailbox/mail_detail/variants/GenericMailDetailLayout.kt:129-132`; `I/Features/Mailbox/MailDetail/Variants/GenericMailDetailLayout.swift:145-150`; `W/app/(app)/app/mailbox/[drawer]/[item_id]/page.tsx:380-389`
- **What the user sees:** The menu closes and nothing happens (Archive, Share, Mark unread, Download/Open PDF, Forward, Report, Track map, Hand-off, Add to wallet, Add to calendar, Mute, red "Delete" on iOS coupons and certified mail, gig-mail "Counter"/"Decline"). Web's header ⋮ has no `onClick`.
- **Evidence:** Empty `{}` handlers across the variants: Android Records `:119, 123-128`, Certified `:207-210`, Package `:198-201`, Booklet `:129, 132`, Coupon `:143-146`, Gig `:131-134, 486, 496`, Community `:151-156`, Party `:127-130`, Memory `:121-124` (all under `A/ui/screens/mailbox/mail_detail/variants/`); iOS Coupon `:78-84`, Certified `:111-117`, Booklet `:76-84`, Community `:97-109`, Gig `:77-82, 423-434, 475`, Memory `:64-69`, Package `:110-115`, Party `:78-81`, Records `:77-84` (under `I/Features/Mailbox/MailDetail/Variants/`).
- **Fix (reuse):** Archive → `PATCH /api/mailbox/:id/archive` (`B/routes/mailbox.js:2770`); Delete → `DELETE /api/mailbox/:id` (`:2893`) — web already calls both (`W/app/(app)/app/mailbox/_components/useMailboxData.ts:217, 228`); Share → system share; gig-mail Counter/Decline → the existing gig bid endpoints (`I/Core/Networking/Endpoints/GigsEndpoints.swift:374, 382`) or open the task. Hide everything else.
- **Backend change:** none

#### S2-09 · Home dashboard tabs (Tasks, Bills, Packages, Members, Ownership) never show their content
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** Place → "Home tools" (`A/ui/screens/place/PlaceDashboardScreen.kt:185-191`) or My homes → a home → tab strip. Hub "Bill due…"/"Task due…" pills land on `?tab=bills|tasks` and the tab is dropped.
- **Where:** `A/ui/screens/shared/content_detail/Bodies.kt:147-157`; `A/ui/screens/homes/HomeDashboardScreen.kt:519-525`; `I/Features/Shared/ContentDetail/Bodies.swift:206-233`; `I/Features/Homes/HomeDashboardView.swift:287`
- **What the user sees:** Android: "Tasks isn't here yet / We're still designing this section." iOS: "Nothing in Bills yet — When there's something to show in bills, it'll appear here.", even when the hero shows counts.
- **Evidence:** `GridTabsBody` renders real content only for the first tab; the tabs are real, permission-gated sections (`A/ui/screens/homes/HomeDashboardProjection.kt:36-66`; `I/Features/Homes/HomeDashboardProjection.swift:17-23`).
- **Fix (reuse):** Make a non-Overview tab open the screens the dashboard already has callbacks for: Android `onOpenTasks` / `onOpenBills` / `onOpenPackages` / `onOpenMembers` / `onOpenClaimsList` (bound at RTS:2736-2770); iOS `.homeTasks` / `.homeBills` / `.homePackages` / `.homeMembers` / `.homeOwners`. The strip looks the same.
- **Backend change:** none
- **Other clients / notes:** Web's dashboard renders real cards.

#### S2-10 · "A residency request is ready for review" opens the Home dashboard, not the review
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** Owner taps the `residency_claim` notification (link `/homes/<id>/owners/review-claim`, live from `B/services/homeResidencyLegacyService.js:42`).
- **Where:** `I/Core/Routing/DeepLinkRouter.swift:628-641`; `A/core/routing/DeepLinkRouter.kt:587-597`
- **What the user sees:** The dashboard; the review is two taps away (Members → Review).
- **Evidence:** `owners/review-claim` isn't matched and falls back to the Home detail.
- **Fix (reuse):** Route it to the existing claim review: iOS `HomeClaimReviewView(homeId:initialTab: .residency)` (`I/Features/Homes/ClaimReview/HomeClaimReviewView.swift:36`, add a Place-stack route); Android `ChildRoutes.homeClaimReview(homeId, residency = true)` (RTS:840-843).
- **Backend change:** none

#### S2-11 · Dismissed mail stays in the Mailbox list
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** Mail → a promo letter → Dismiss → confirm.
- **Where:** `I/Features/Mailbox/MailDetail/MailDetailViewModel.swift:492-508`; `I/Features/Mailbox/MailboxRoot/MailboxRootViewModel.swift:403`
- **What the user sees:** A "Dismissed" toast; the letter stays open, and going back shows it still listed — though the confirm said "It moves out of your mailbox and stops showing up in this drawer." (`I/Features/Mailbox/MailDetail/MailDetailView.swift:137`).
- **Evidence:** Success neither closes the detail nor refreshes the list; the list's `load()` exits early.
- **Fix (reuse):** Close the detail on success and refresh the list when it reappears.
- **Backend change:** none

#### S2-12 · A failed mailbox load says "Mailbox is empty" (or shows the previous scope's mail), with no retry
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Mail tab → `/app/mailbox?scope=personal`, or switching Personal / Home / All.
- **Where:** `W/app/(app)/app/mailbox/_components/useMailboxData.ts:56-71`; `W/app/(app)/app/mailbox/page.tsx:75-77`; `W/app/(app)/app/mailbox/page.tsx:159-167`
- **What the user sees:** The red banner "Failed to load mailbox for this scope." plus "Mailbox is empty / No mail yet…"; after a failed switch, the previous scope's mail under the new header.
- **Evidence:** The list isn't cleared on error and no retry is rendered.
- **Fix (reuse):** Clear `mail` on error and render `ErrorState` with `onRetry={loadMail}` in place of the empty card.
- **Backend change:** none

#### S2-13 · Mail star, archive and delete failures: the star stays toggled, archive and delete are silent
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Mailbox list or detail → star / archive / delete.
- **Where:** `W/app/(app)/app/mailbox/_components/useMailboxData.ts:209-211`; `W/app/(app)/app/mailbox/_components/useMailboxData.ts:220`; `W/app/(app)/app/mailbox/_components/useMailboxData.ts:231`; `W/app/(app)/app/mailbox/_components/MailDetail.tsx:33-53`
- **What the user sees:** A star that didn't save; archive/delete that do nothing and say nothing; no in-flight guards.
- **Evidence:** The catch toggles the star again; archive/delete catches are empty.
- **Fix (reuse):** Revert on error and `toast.error` with plain copy (`W/components/ui/toast-store.ts`).
- **Backend change:** none

#### S2-14 · Today tab tells residents to "Claim your address" when the homes call fails
- **Clients:** Android · **Severity:** misleading
- **How the user gets there:** Today tab while offline or during a server error.
- **Where:** `A/ui/screens/place/today/TodayTabViewModel.kt:52-54`; `A/ui/screens/place/today/TodayTabViewModel.kt:71`; `A/ui/screens/place/today/TodayTabScreen.kt:61`
- **What the user sees:** "Today starts at your address … Claim your address to start." with a "Claim your address" button.
- **Evidence:** A failure returns null and shows the no-place card.
- **Fix (reuse):** Add an error state with `ErrorState(onRetry = refresh)`.
- **Backend change:** none
- **Other clients / notes:** iOS tells the two apart (`I/Features/Place/Detail/AddressTodayTabView.swift:122-139`).

#### S2-15 · Home dashboard "Property details" does nothing when opened from You
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** You → My homes → a home → Overview → "Property details".
- **Where:** `I/Features/Root/YouTabRoot.swift:2211-2272`; `I/Features/Homes/HomeDashboardComponents.swift:327`
- **What the user sees:** Nothing.
- **Evidence:** The You host omits `onOpenPropertyDetails`.
- **Fix (reuse):** Wire the existing property-details route (the Hub stack has `.propertyDetails`, `I/Features/Root/HubTabRoot.swift:1313, 2713`).
- **Backend change:** none
- **Other clients / notes:** Android wires it (RTS:2773); web has `/app/homes/[id]/property-details`.

#### S2-16 · Unboxing and ceremonial-letter icons that do nothing
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** Mail → scan/unbox an item; open a ceremonial letter → Share.
- **Where:** `I/Features/Mailbox/Unboxing/UnboxingView.swift:411-412`; `I/Features/Mailbox/Unboxing/UnboxingView.swift:512-515`; `I/Features/CeremonialMailOpen/CeremonialMailOpenView.swift:622`; `A/ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt:843-850`
- **What the user sees:** iOS top-bar "Photo library" and "More actions", filed-state chips "Open record" / "Share" / "Reminders" / "Archive", and the letter "Share" do nothing; Android's letter "Share" chip does nothing.
- **Fix (reuse):** Wire Share to the system share sheet; hide the rest.
- **Backend change:** none

### Stream 2 · weak (7)

#### S2-17 · Home notification links land one level up or on the wrong tab
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** Notifications: `/homes/<id>/members` (challenge_window_opened, member_moved_out), home_access_request and member_challenged (`members?tab=requests`), home_invite_accepted (`dashboard?tab=members`), `/homes/<id>/owners` (claim_window_expiring), claim-owner evidence links with `claimId`.
- **Where:** `I/Core/Routing/DeepLinkRouter.swift:625-630`; `A/core/routing/DeepLinkRouter.kt:581-597`
- **What the user sees:** The Home dashboard, or Members on its default tab; the requester and `claimId` are dropped.
- **Evidence:** `members` only matches with `tab=requests`; `owners` only matches `/transfer`; tabs aren't passed to the destination.
- **Fix (reuse):** Drop the `tab == requests` condition and pass the tab (iOS `MembersTab.requests`, `I/Features/Homes/Members/MembersListViewModel.swift:23, 125`; Android `MembersTab.REQUESTS`, `A/ui/screens/homes/members/MembersListViewModel.kt:71, 156`); `/owners` → Owners (Android `ChildRoutes.homeOwners` RTS:832; iOS OwnersListView needs a Place-stack route); claim evidence → iOS `.claimStatus(claimId:)` (`I/Features/Root/HubTabRoot.swift:1258-1259`), Android MY_CLAIMS (RTS:6080-6088).
- **Backend change:** none

#### S2-18 · Opening a letter posts an invalid action, so the list and unread counts stay stale
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Mailbox → open any letter.
- **Where:** `W/lib/mailbox-api.ts:203-207`; `W/app/(app)/app/mailbox/[drawer]/layout.tsx:143`; `W/app/(app)/app/mailbox/[drawer]/[item_id]/page.tsx:49`; `W/lib/mailbox-queries.ts:182-197`
- **What the user sees:** The row and unread counts don't update until a later refetch (expected from code; not seen on a device).
- **Evidence:** `markItemOpened` posts `{ action: 'open' }`; the backend's allow-list has no `open` and returns 400 (`B/routes/mailboxV2.js:469-472`); the hook invalidates queries only on success. The GET for the letter already marks it opened (`mailboxV2.js:405-409`).
- **Fix (reuse):** Drop the POST and invalidate the list and counter after the detail loads.
- **Backend change:** none

#### S2-19 · "File to Vault" and Translate fail silently; an empty vault menu has no way forward
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Mailbox → a letter → File to Vault / Translate.
- **Where:** `W/app/(app)/app/mailbox/[drawer]/[item_id]/page.tsx:103-111`; `W/app/(app)/app/mailbox/[drawer]/[item_id]/page.tsx:145-149`; `W/lib/mailbox-queries.ts:199-214`
- **What the user sees:** The dropdown stays open and nothing is filed; the empty menu reads "No vault folders yet" with no action.
- **Evidence:** Only `onSuccess` handlers.
- **Fix (reuse):** `onError` → `toast.error`; `toast.success` on filing; link the empty menu to `/app/mailbox/vault`.
- **Backend change:** none

#### S2-20 · Home Issue, Bill and Package panels accept attachments that are never uploaded
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Home dashboard → add an issue, bill or package → attach files → save.
- **Where:** `W/components/home/IssueSlidePanel.tsx:171-180`; `W/components/home/BillSlidePanel.tsx:208-217`; `W/components/home/PackageSlidePanel.tsx:182-190`; `W/app/(app)/app/homes/[id]/dashboard/page.tsx:81`
- **What the user sees:** After saving: "Bill saved, but 2 files not uploaded: attachments for bills are not available yet."
- **Evidence:** No upload route for these files, though the issue route accepts `photos` (`B/routes/home.js:2583`).
- **Fix (reuse):** Hide the pickers until an upload route exists.
- **Backend change:** none to hide
- **Other clients / notes:** Native report forms have no picker.

#### S2-21 · Place dashboard has no pull-to-refresh and stays stale after verification flows
- **Clients:** Android · **Severity:** weak
- **How the user gets there:** Place dashboard → finish postcard/document/landlord verification → back.
- **Where:** `A/ui/screens/place/PlaceDashboardViewModel.kt:38-42`; `A/ui/screens/place/PlaceDashboardScreen.kt:88-115`
- **What the user sees:** The old state (e.g. the verify prompt) until restart.
- **Evidence:** `load()` skips once loaded; no refresh gesture.
- **Fix (reuse):** Add pull-to-refresh calling `viewModel.refresh()` and refresh on return from a flow.
- **Backend change:** none
- **Other clients / notes:** iOS has pull-to-refresh (`I/Features/Place/PlaceDashboardView.swift:68`).

#### S2-22 · Mail list: a failed "load more" replaces the whole list; empty drawers show a raw "→" and no next step
- **Clients:** Android · **Severity:** weak
- **How the user gets there:** Mail tab → scroll to load more; open an empty drawer.
- **Where:** `A/ui/screens/mailbox/mailbox_root/MailboxRootViewModel.kt:207-210`; `A/ui/screens/mailbox/mailbox_root/MailboxRootViewModel.kt:294`; `A/ui/screens/mailbox/mailbox_root/MailboxRootViewModel.kt:416`
- **What the user sees:** "Couldn't load the list" replaces the rows; "No mail in Personal → Incoming yet / When something lands here, it shows up in this view."
- **Fix (reuse):** Keep rows and toast a failed page; give the empty state an action (e.g. "Scan an item" → unboxing) and plain copy.
- **Backend change:** none

#### S2-23 · Waiting room "Request help" only flashes an email address
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** "Residency rejected" notification → waiting room → Request help.
- **Where:** `W/app/(app)/app/homes/[id]/waiting-room/page.tsx:145`
- **What the user sees:** Toast "Contact support at help@pantopus.com".
- **Fix (reuse):** Open the mailto link already used at `W/components/home/VerificationCenter.tsx:233`.
- **Backend change:** none
- **Other clients / notes:** Natives open the Help Center.

### Stream 2 · cosmetic (1)

#### S2-24 · "Property insights coming soon" when there is simply no valuation
- **Clients:** Web · **Severity:** cosmetic
- **How the user gets there:** Home dashboard → property value card, for a Home without valuation data.
- **Where:** `W/components/home/PropertyValueCard.tsx:81-97`
- **What the user sees:** "Property insights coming soon".
- **Fix (reuse):** Use the native copy "No estimate available" (`I/Features/Homes/HomeIntelligenceComponents.swift:545-549`).
- **Backend change:** none

## Stream 3 — auth, accounts, profile, identity, settings/privacy, blocks, chat, connections, businesses, scheduling, invoices, notifications and deep links (69: 27 dead end, 26 misleading, 12 weak, 4 cosmetic)

### Stream 3 · dead end (27)

#### S3-01 · Creating a business always fails at step 2
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Identity switcher "Create business" (`W/components/ProfileToggle.tsx:373-374`, in the sidebar at `W/components/AppShell.tsx:452, 504`) or Hub Jump back in "Create Business" (`W/components/hub/JumpBackIn.tsx:16-17`) → `/app/businesses/new` → redirect → `/app/business/new` → pick a type → Basic info → Next.
- **Where:** `W/app/(app)/app/business/new/page.tsx:10`; `W/app/(app)/app/business/new/page.tsx:31`; `W/app/(app)/app/business/new/page.tsx:82`; `W/app/(app)/app/business/new/page.tsx:96`
- **What the user sees:** "Failed to create business"; the wizard never reaches Location.
- **Evidence:** The chips send `business_type` from `['restaurant','service','retail','professional','creative','wellness','other']` (default `'service'`). `POST /api/businesses` validates it against `ENTITY_TYPES` (`B/routes/businesses.js:117, 401`; `B/utils/businessConstants.js:17-26`: for_profit, home_service, nonprofit_501c3, …) and returns 400; the real reason is hidden by C-23.
- **Fix (reuse):** Map the chips to entity types as native does (`I/Features/Businesses/CreateBusiness/CreateBusinessSteps.swift:140-141`; `A/ui/screens/businesses/create_business/CreateBusinessSteps.kt:50-73`), or omit the field (the backend defaults to `for_profit`, `businesses.js:475`).
- **Backend change:** none
- **Other clients / notes:** iOS and Android create businesses through `/create-full` with valid types.

#### S3-02 · Booking notifications for Home- or Business-owned bookings now open nothing (regression from #245)
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** The host of a Home/Business-owned booking taps a booking_request, confirmed, rescheduled, cancelled, declined, reminder or nudge notification (in-app list or push).
- **Where:** `B/services/scheduling/bookingNotifyService.js:112-115`; `B/services/scheduling/bookingNotifyService.js:198`; `B/services/scheduling/bookingNotifyService.js:321`; `I/Core/Routing/DeepLinkRouter.swift:520-527`; `A/core/routing/DeepLinkRouter.kt:531`
- **What the user sees:** The notification is marked read and nothing opens.
- **Evidence:** `hostBookingLink` adds `?ot=home|business&oid=` for those bookings, and since #245 (merged in 06ac336a8) every host lifecycle notification uses it. Both routers deliberately drop owner-scoped links (`queryValue("ot", …) == nil` / `Paths.queryParam(queryPart, "ot") == null` → Unknown). Before #245 these links were `/app/profile/schedule/bookings/:id`, which both routers open (`I/Core/Routing/DeepLinkRouter.swift:514-516`; Android `:521`).
- **Fix (reuse):** iOS: read `ot`/`oid` into `SchedulingOwner.home(homeId:)` / `.business(id:)` and pass it where BookingDetailView is built (`I/Features/Root/HubTabRoot.swift:1028-1030`; the route already takes an owner). Android: drop the `ot == null` check and open `SchedulingRoutes.bookingDetail` (`A/ui/screens/scheduling/_shared/SchedulingRoutes.kt:179`) with the owner.
- **Backend change:** none
- **Other clients / notes:** Web handles `?ot=&oid=` on `/app/scheduling/bookings/:id`.

#### S3-03 · Support Train notifications open nothing on any client
- **Clients:** iOS, Android, Web · **Severity:** dead end
- **How the user gets there:** Tap any of support_train_updates, _reminders, _slot_changes, _donations, _open_slots.
- **Where:** `B/services/supportTrainNotifications.js:18`; `I/Core/Routing/DeepLinkRouter.swift:566-567`; `A/core/routing/DeepLinkRouter.kt:751`
- **What the user sees:** Nothing opens (the tap only marks the notification read).
- **Evidence:** The link is `pantopus://activities/support-trains/<id>`: the native routers fall to Unknown on `activities`; the web resolver rejects the `pantopus:` scheme.
- **Fix (reuse):** Change the prefix to `/app/support-trains` — both routers already route `support-trains/:id` (`I/Core/Routing/DeepLinkRouter.swift:440-446`; `A/core/routing/DeepLinkRouter.kt:540-548`) and web has `/app/support-trains/[id]` — and add an `activities` alias in both routers for stored rows.
- **Backend change:** yes (one constant)

#### S3-04 · More notification types open nothing: neighborhood open (`/app/nearby`), connection accepted, address revealed, persona DMs and follows
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Tap density_milestone, connection_accepted, address_revealed (`/marketplace/<id>`), persona_dm_received_creator (`/app/audience/inbox/<id>`), persona_dm_reply_fan (`/app/audience/membership/<id>/inbox`), persona_follow / persona_follow_request (`/app/persona?tab=followers`).
- **Where:** `I/Core/Routing/DeepLinkRouter.swift:491-495`; `I/Core/Routing/DeepLinkRouter.swift:566-581`; `A/core/routing/DeepLinkRouter.kt:651-654`; `A/core/routing/DeepLinkRouter.kt:751-769`
- **What the user sees:** Nothing opens.
- **Evidence:** No `nearby`, `marketplace` or `audience` cases; `persona` needs a handle; the `/<username>` rewrite only applies to `new_follower`.
- **Fix (reuse):** Add: `nearby` → the Nearby tab; `connection_accepted` → the username rewrite; `/marketplace/<uuid>` → listing detail (a Stream 1 screen); creator inbox (iOS `.creatorInbox`, `I/Features/Root/YouTabRoot.swift:173`; Android `ChildRoutes.CREATOR_INBOX`, RTS:1089); fan inbox (iOS `.fanInbox`, `:180`; Android `ChildRoutes.fanInbox`, RTS:1728); your audience (iOS `.creatorAudienceMembers`, `:148`; Android CREATOR_AUDIENCE_MEMBERS, RTS:1076). On iOS the persona screens live inside the profile cover, so present it with a starting screen (the `.monthlyReceipt` pattern, `I/Features/Root/RootTabView.swift:202-207`).
- **Backend change:** none
- **Other clients / notes:** Most of this is already written on the unpushed local branch `claude/stream3-native-notification-routes-n01` (commit 31668384e, 2026-09-22 22:17 PDT); it needs a rebase over #257 and #279.

#### S3-05 · Booking notifications sent to attendees open a booking they aren't allowed to load (from code)
- **Clients:** iOS, Android, Web · **Severity:** dead end
- **How the user gets there:** A required attendee (or a host who doesn't own the booking page) taps a booking lifecycle notification.
- **Where:** `B/services/scheduling/bookingNotifyService.js:192-198`; `B/services/scheduling/bookingNotifyService.js:255-260`; `B/routes/scheduling.js:705-714`
- **What the user sees:** "Couldn't load this booking." (`I/Features/Scheduling/Bookings/Core/BookingDetailViewModel.swift:188-190`; same on Android).
- **Evidence:** Attendees get the host link; `loadOwnedBooking` returns 403 unless the viewer manages the owner.
- **Fix (reuse):** Backend product call: let attendees read that booking, or send them `/app/scheduling/my-bookings`.
- **Backend change:** yes

#### S3-06 · Identity Center rows and cards open placeholders (or nothing)
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Android: drawer "Profile & Privacy" (RTS:6205), drawer header (RTS:2271), You → Identity Center (RTS:2540), Settings → Visibility preferences. iOS: You → Identity Center; Settings → Visibility preferences; drawer identity pill.
- **Where:** `A/ui/screens/identity_center/IdentityCenterScreen.kt:97-101`; `RTS:5205-5215`; `I/Features/Root/YouTabRoot.swift:1643`; `I/Features/Root/YouTabRoot.swift:1655`; `I/Features/Settings/SettingsView.swift:98-106`; `I/Features/Root/HubTabRoot.swift:685-690`
- **What the user sees:** Android: "Blocked accounts isn't here yet", "Blocked followers…", "Homes…", "Business Profiles…", "Data export…", "Local profile isn't here yet", "Personal isn't here yet"; the identity switcher only closes (`IdentityCenterScreen.kt:112-121`). iOS You stack: "Identity isn't here yet" and the row labels, even under "Set up" / "Create" / "Activate" CTAs. iOS Settings host: only the Public card works. iOS drawer sheet: nothing works.
- **Evidence:** Only `privacyPreview` has a real destination; the rest call `onOpenPlaceholder(row.label)` / push `.placeholder`.
- **Fix (reuse):** Blocked accounts → blocked users (Android SETTINGS_BLOCKED_USERS RTS:1013; iOS `.blockedUsers`); Homes → My homes (RTS:442; `.myHomes`); Business Profiles → My businesses (RTS:1299; `.myBusinesses`); Data export → data export (RTS:1624; `.dataExport`); Local card → edit profile; Personal → settings. Hide "Blocked followers" (no native list). Wire the iOS Settings and drawer hosts too.
- **Backend change:** none
- **Other clients / notes:** Web links all of these (`W/app/(app)/app/identity/page.tsx:313-428`).

#### S3-07 · Business profile "Report" opens a placeholder; "Book" opens a placeholder or does nothing
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Hub Discover business card, "Find businesses", a map spot, search, or a post's "Nearby providers" → business profile → dock "Book" (shown for every open, established business) or ⋯ → "Report".
- **Where:** `RTS:4129`; `RTS:4131`; `A/ui/screens/business_profile/BusinessProfileMapper.kt:487-489`; `I/Features/Root/HubTabRoot.swift:1930`; `I/Features/Root/YouTabRoot.swift:2423`; `I/Features/Root/YouTabRoot.swift:2427`; `I/Features/BusinessProfile/BusinessProfileView.swift:45`
- **What the user sees:** "Report business isn't here yet"; "Book isn't here yet" (Android; iOS You stack) or nothing (iOS Hub stack, where `onBook` isn't passed and defaults to `{}`). Android's "Call" dock does nothing when the business has no phone (`A/ui/screens/business_profile/BusinessProfileScreen.kt:171`).
- **Evidence:** RTS:4174/4176 and `HubTabRoot.swift:1946` repeat this for `pantopus://b/:username/:slug`.
- **Fix (reuse):** Report → the existing report sheet (`A/ui/screens/profile/ReportUserSheet.kt:55`; `I/Features/Profile/ReportUserSheet.swift`) → `POST /api/users/:userId/report` (`B/routes/users.js:4961`; businesses are User rows) — check the copy suits a business. Book → needs a booking slug in the business payload (backend), then `SchedulingRoutes.publicBooking(slug)` / `.scheduling(.inviteeLanding(slug:))`; until then show Message/Call instead, and hide Call without a phone.
- **Backend change:** only for Book (expose the booking slug)
- **Other clients / notes:** Web's public business page has neither action.

#### S3-08 · Business owner dashboard "Insights" and "Settings" open placeholders
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** My businesses → a business → owner dashboard → top-bar Insights / Settings, or "This week · Insights".
- **Where:** `RTS:5754-5755`; `A/ui/screens/businesses/owner_dashboard/components/OwnerHeader.kt:101-102`; `I/Features/Root/YouTabRoot.swift:2559-2560`; `I/Features/Root/HubTabRoot.swift:2958-2959`
- **What the user sees:** "Insights isn't here yet" / "Business settings isn't here yet".
- **Evidence:** Tiles and header icons call placeholder closures (`A/ui/screens/businesses/owner_dashboard/components/InsightTiles.kt:77-83`; `I/Features/Businesses/OwnerDashboard/Components/OwnerHeader.swift:47-48`).
- **Fix (reuse):** Settings → the existing owner screens (edit business page RTS:910, locations RTS:1844, legal RTS:1839; iOS `.editBusinessPage`, `.businessLegal`). Insights → hide the entry until a native screen exists (the tiles already show the numbers; backend `GET /api/businesses/:businessId/insights`, `B/routes/businesses.js:4063`).
- **Backend change:** none
- **Other clients / notes:** Web has `/app/business/[id]/insights` and `/settings/profile|legal`.

#### S3-09 · Privacy "Download your data" and "What we collect" do nothing
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** iOS You → Privacy; Android Settings → Visibility preferences → Identity Center → Privacy Preview → Manage privacy (RTS:5812).
- **Where:** `I/Features/Settings/Privacy/PrivacyViewModel.swift:156-170`; `I/Features/Settings/Privacy/PrivacyViewModel.swift:532-547`; `A/ui/screens/settings/SettingsViewModels.kt:507-515`
- **What the user sees:** Chevron rows "Download your data — ZIP of profile, tasks, messages — emailed to you" and "What we collect"; tapping does nothing.
- **Evidence:** The tap handlers fall through (`default: break`; Android only handles `deleteAccount`).
- **Fix (reuse):** "Download your data" → the existing Data export screen (iOS SettingsView `.dataExport`; Android SETTINGS_DATA_EXPORT RTS:1624) and make the subtext honest (export is by request); "What we collect" → Legal › Privacy (iOS `LegalContentView(.privacy)`; Android SETTINGS_LEGAL RTS:1028).
- **Backend change:** none
- **Other clients / notes:** Web links the policy (`W/app/privacy/page.tsx`).

#### S3-10 · Privacy screen load failure says "Pull to refresh", but the screen can't be pulled; taps are ignored
- **Clients:** Android · **Severity:** dead end
- **How the user gets there:** Privacy screen while `GET /api/privacy/settings` fails.
- **Where:** `A/ui/screens/settings/SettingsViewModels.kt:434`; `A/ui/screens/settings/SettingsViewModels.kt:530`; `A/ui/screens/settings/SettingsViewModels.kt:563`; `A/ui/screens/settings/SettingsViewModels.kt:746`
- **What the user sees:** "Search privacy could not load. Pull to refresh before changing this setting."; the radios and the "Find me by real name" toggle ignore taps.
- **Evidence:** `A/ui/screens/shared/grouped_list/GroupedListScreen.kt` has no pull-to-refresh.
- **Fix (reuse):** Add a "Try again" row calling `viewModel.load()`, or pull-to-refresh on `GroupedListScreen`.
- **Backend change:** none

#### S3-11 · Creator inbox "Settings" (and the empty-state prompts) open a placeholder
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** You → "Creator inbox" → "Settings"; the empty state's "Unlock fan DMs" and "Enable tip-with-message" (shown to every user without a Beacon or threads).
- **Where:** `RTS:5167`; `A/ui/screens/creator_inbox/CreatorInboxScreen.kt:320-324`; `I/Features/Root/YouTabRoot.swift:1821`; `I/Features/CreatorInbox/CreatorInboxView.swift:390-400`
- **What the user sees:** "Inbox settings isn't here yet".
- **Fix (reuse):** For users without a Beacon, send both prompts to the audience profile (as "Send a broadcast" does, RTS:5166). For creators, hide "Settings" until a tier/DM-policy editor exists (web has `/app/audience/manage/tiers` on `PATCH /api/personas/:id/tiers/:tierId`, `B/routes/personaTiers.js:133`).
- **Backend change:** none

#### S3-12 · Audience follower rows open a placeholder
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** You → Audience profile → Followers tab → a follower.
- **Where:** `RTS:5105-5107`; `I/Features/Root/YouTabRoot.swift:1664`
- **What the user sees:** "Follower · <name> isn't here yet" (Android) / "Follower isn't here yet" (iOS).
- **Evidence:** Followers are membership pseudonyms with no profile to open.
- **Fix (reuse):** Open "Your audience" (Android CREATOR_AUDIENCE_MEMBERS RTS:5141; iOS `.creatorAudienceMembers`), which has per-member actions, or make the rows non-tappable.
- **Backend change:** none
- **Other clients / notes:** Web lists followers inline with actions (`W/app/(app)/app/persona/page.tsx:1641-1715`).

#### S3-13 · Beacon Updates and Following open placeholders from the You and Settings stacks
- **Clients:** iOS · **Severity:** dead end
- **How the user gets there:** You → Audience profile → Beacon Updates → a post, "Find Beacons", empty-state "Discover beacons"; Following → empty "Discover Beacons"; the same from Settings → Visibility preferences → Public profile.
- **Where:** `I/Features/Root/YouTabRoot.swift:1705`; `I/Features/Root/YouTabRoot.swift:1711`; `I/Features/Root/YouTabRoot.swift:1720`; `I/Features/Settings/SettingsView.swift:111-113`
- **What the user sees:** "Post isn't here yet" / "Discover beacons isn't here yet".
- **Evidence:** The Hub stack wires these (`I/Features/Root/HubTabRoot.swift:2060-2071`); the You and Settings hosts don't.
- **Fix (reuse):** Reuse the Hub wiring: `.pulsePost` (exists in You, `YouTabRoot.swift:1386`) and `.beaconSearch` → `UniversalSearchView(initialTab: .beacons)`.
- **Backend change:** none
- **Other clients / notes:** Android works (RTS:4472-4484); web has `/app/beacons`.

#### S3-14 · A direct-message draft is silently discarded when the chat can't be created
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Public profile → Message, or `/app/chat/conversation/<userId>`, when `POST /api/chats/direct` fails (the other person blocked you: 403 "Unable to message this user"; the 40-per-minute limiter; a 503).
- **Where:** `W/hooks/useChatMessages.ts:296-308`; `W/hooks/useChatMessages.ts:603-606`; `W/components/chat/ChatInput.tsx:36-53`; `W/components/chat/ConversationView.tsx:427-432`
- **What the user sees:** Type, press Send: the text vanishes, nothing is sent, no error.
- **Evidence:** The create catch only clears the peer; `sendMessage` returns silently when there's no room id; ChatInput clears the text before sending and restores it only if `onSend` throws.
- **Fix (reuse):** Set `chat.setError(...)` in the catch and disable the input with a reason, as `W/components/chat/ChatRoomView.tsx:347, 434-439` does.
- **Backend change:** none

#### S3-15 · A failed chat message shows "Failed to send" with no Retry
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Any chat room or conversation → a send fails.
- **Where:** `W/components/chat/ChatMessageList.tsx:116`; `W/components/chat/ChatMessageBubble.tsx:244-255`; `W/hooks/useChatMessages.ts:617`
- **What the user sees:** "Failed to send" under the bubble, no Retry; in rooms the text isn't restored, so the user retypes.
- **Evidence:** `retryMessage` is implemented but never passed; `ChatRoomView.tsx:147-163` swallows the error.
- **Fix (reuse):** Pass `onRetry={chat.retryMessage}` through `ChatMessageList` into `ChatMessageBubble`.
- **Backend change:** none
- **Other clients / notes:** #256 (merged) made the banner copy plain; the missing Retry remains.

#### S3-16 · Sharing a task or listing card into chat fails silently
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Chat → attach → Task or Listing → pick one.
- **Where:** `W/components/chat/ChatRoomView.tsx:186`; `W/components/chat/ChatRoomView.tsx:207`; `W/components/chat/ConversationView.tsx:229-265`
- **What the user sees:** The picker closes and nothing appears.
- **Evidence:** `onError: () => {}` and `if (!chat.resolvedRoomId) return;`.
- **Fix (reuse):** `chat.setError(...)` or `toast.error` with plain copy.
- **Backend change:** none

#### S3-17 · Public profile "Message" does nothing on failure
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** `/<username>` → Message (desktop and mobile bar).
- **Where:** `W/app/[username]/PublicProfileClient.tsx:339-353`
- **What the user sees:** Nothing on 403 "Unable to message this user", 429 or 503; no in-flight guard.
- **Evidence:** The catch only `console.error`s.
- **Fix (reuse):** Route to `/app/chat/conversation/<id>` and let that screen explain (after S3-14), or toast the reason.
- **Backend change:** none

#### S3-18 · Host booking detail: Rebook, Follow up, Message and Send rebook link do nothing
- **Clients:** Web, Android, iOS · **Severity:** dead end
- **How the user gets there:** Web: Scheduling → Bookings → a past, no-show or cancelled booking (also booking notifications). Android and iOS: You → Scheduling → Bookings → a booking (also push).
- **Where:** `W/app/(app)/app/scheduling/bookings/[id]/page.tsx:375-409`; `A/ui/screens/scheduling/bookings/BookingDetailScreen.kt:1024-1062`; `I/Features/Scheduling/Bookings/Core/BookingDetailViewModel.swift:214-238`
- **What the user sees:** Live-looking dock buttons that do nothing (web `onClick={() => {}}`, Android `onClick = {}`, iOS intentional no-ops "deferredBackend").
- **Evidence:** Completed bookings are common: a job marks every past confirmed booking completed (`B/jobs/bookingReminders.js:38-48`). Android also has an unwired follow-up screen: `PostMeetingFollowupScreen` is registered (RTS:3195-3203) but `SchedulingRoutes.postMeetingFollowup()` has no caller (`A/ui/screens/scheduling/_shared/SchedulingRoutes.kt:196`).
- **Fix (reuse):** Follow up → the existing follow-up (web `W/components/scheduling/bookings-extras/FollowUpSheet.tsx`, used at `W/app/(app)/app/scheduling/bookings/search/page.tsx:320`; Android `postMeetingFollowup`); Send rebook link → `createOneOffLink` (`P/endpoints/scheduling.ts:151`); Message → the invitee chat when `invitee_user_id` exists, else the mailto web already uses (`page.tsx:154-156`); Rebook → the manual booking page or hide.
- **Backend change:** none
- **Other clients / notes:** Web reachability: the Scheduling sidebar needs `NEXT_PUBLIC_SCHEDULING_ENABLED` (default off in production builds, `W/lib/featureFlags.ts:32-34`); booking notifications and emails still link into `/app/scheduling/bookings/:id`.

#### S3-19 · Business scheduling settings rows open 404s
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Scheduling → Business → Minimum notice / Booking horizon / Buffers / Approval window (owners and admins).
- **Where:** `W/components/scheduling/business/BusinessSettings.tsx:297`; `W/components/scheduling/business/BusinessSettings.tsx:312-326`
- **What the user sees:** 404: there are no pages under `/app/scheduling/business/settings/`.
- **Fix (reuse):** Link to `/app/scheduling/event-types`, as native does (`I/Features/Scheduling/Business/Settings/BusinessSchedulingSettingsViewModel.swift:217-219`; `A/ui/screens/scheduling/business/BusinessSchedulingSettingsScreen.kt:128-157`).
- **Backend change:** none
- **Other clients / notes:** Web reachability: the Scheduling sidebar needs `NEXT_PUBLIC_SCHEDULING_ENABLED` (default off in production builds, `W/lib/featureFlags.ts:32-34`); booking notifications and emails still link into `/app/scheduling/bookings/:id`.

#### S3-20 · Public booking "Get notified when times open" does nothing
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** `/book/<slug>/<eventType>` (public, not flag-gated) → a month with no open times.
- **Where:** `W/components/scheduling/SlotPicker.tsx:703-709`
- **What the user sees:** A button with no handler (also in host flows that reuse SlotPicker).
- **Evidence:** A working path exists but is unused: `joinWaitlistPublic` (`P/endpoints/publicBooking.ts:159` → `B/routes/schedulingPublic.js:521`) and `WaitlistJoinSheet.tsx` (mounted only in preview).
- **Fix (reuse):** Render the button only when an `onNotifyMe` handler is passed; in PublicSlotPicker pass one that opens WaitlistJoinSheet.
- **Backend change:** none
- **Other clients / notes:** iOS shows it only with a handler (`I/Features/Scheduling/SharedUI/SlotPicker.swift:345`).

#### S3-21 · Group-event roster "Add or invite attendee" and onboarding "Invite teammate" open 404s
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Scheduling → Search → View roster (group event) → "Add or invite attendee"; business first run → onboarding team step → "Invite teammate".
- **Where:** `W/app/(app)/app/scheduling/bookings/[id]/roster/page.tsx:228-236`; `W/components/scheduling/hub/OnboardingWizard.tsx:336-354`; `W/components/scheduling/hub/OnboardingWizard.tsx:940`
- **What the user sees:** 404s: `/app/scheduling/manual?et=…` (the real page is `/app/scheduling/bookings/manual`) and `/app/businesses/<id>` (no such page).
- **Fix (reuse):** Use `/app/scheduling/bookings/manual` (preselecting the event type needs a small ManualBooking prop) and `/app/business/<id>/team/invite`.
- **Backend change:** none
- **Other clients / notes:** Web reachability: the Scheduling sidebar needs `NEXT_PUBLIC_SCHEDULING_ENABLED` (default off in production builds, `W/lib/featureFlags.ts:32-34`); booking notifications and emails still link into `/app/scheduling/bookings/:id`.

#### S3-22 · Business page CTA buttons don't perform their chosen action
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** An owner adds hero or CTA buttons (Message, Call, Directions, Link, Book) in the page editor → visitors at `/b/<username>`.
- **Where:** `W/components/business/PublicBlockRenderer.tsx:85-99`; `W/components/business/PublicBlockRenderer.tsx:297-313`
- **What the user sees:** Hero buttons do nothing; CTA-block buttons always open the inquiry chat, whatever the action.
- **Evidence:** No `onClick` on hero CTAs; `PublicCta` uses `b.url` or `onContact` (`W/components/business/BusinessPublicProfile.tsx:224`), and the editor never sets a URL.
- **Fix (reuse):** Implement the actions: `tel:` for Call, the maps link already built at `BusinessPublicProfile.tsx:341-345` for Directions, a URL field for Link.
- **Backend change:** none

#### S3-23 · Business verification asks the owner to type a raw "file ID"
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Business dashboard → Settings → Legal → Document verification; nonprofits: Legal tab → "Upload EIN Letter" / "Upload 501(c)(3) Letter".
- **Where:** `W/app/(app)/app/business/[id]/settings/legal/page.tsx:355-366`; `W/components/business/tabs/LegalTab.tsx:70-87`
- **What the user sees:** "Upload your document via the file manager, then paste the file ID here" (there's no file manager) / a browser prompt "Enter the file ID of your uploaded document".
- **Fix (reuse):** Pick a file → `POST /api/files/upload` (`B/routes/files.js:784`) → pass the returned id to `uploadVerificationEvidence` (`B/routes/businessVerification.js:170`), as iOS and Android already do (`I/Features/Businesses/Legal/BusinessLegalViewModel.swift:342-361`; `A/ui/screens/businesses/legal/BusinessLegalViewModel.kt:344`).
- **Backend change:** none

#### S3-24 · Settings → Email "Change" is a placeholder
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Sidebar Settings → Account → Email → "Change".
- **Where:** `W/app/(app)/app/profile/settings/page.tsx:286-291`
- **What the user sees:** Toast "Change email feature coming soon".
- **Evidence:** There is no email-change route in `B/routes/users.js`.
- **Fix (reuse):** Replace with plain text ("Contact support to change your email", linking `/contact`) or remove the button.
- **Backend change:** only to support the action
- **Other clients / notes:** Natives don't offer it.

#### S3-25 · A temporary profile load failure sends the user to /login (then bounced to Place)
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Avatar → `/app/profile` or Edit profile while `GET /api/users/profile` fails (network or 5xx).
- **Where:** `W/app/(app)/app/profile/page.tsx:122-124`; `W/hooks/useProfileForm.ts:161-163`
- **What the user sees:** `router.push('/login')`; the middleware sends signed-in users from /login to `/app/place` (`W/middleware.ts:117-120`), so they land on Place with no explanation.
- **Fix (reuse):** Redirect only on 401 (`statusCode`); otherwise show `ErrorState` with a retry.
- **Backend change:** none

#### S3-26 · Assistant mail-summary chips (Pay, Remind, File, Create task…) do nothing
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Chat list → "Pantopus Assistant" → a mail summary.
- **Where:** `W/components/ai-assistant/AIDraftCard.tsx:307-319`
- **What the user sees:** Hover-styled chips with no handler.
- **Evidence:** The summary carries no mail id (`frontend/packages/types/src/ai.ts:75-91`).
- **Fix (reuse):** Render them as plain text; making them work needs the mail id in the tool output (backend) plus S2-07's caveats.
- **Backend change:** only to make them work

#### S3-27 · Identity "Read full policy" and persona "What does this mean?" open 404s
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** `/app/identity` → "What Pantopus knows" → "Read full policy"; public persona page Follow → `/app/persona/<handle>/follow` → "What does this mean? →".
- **Where:** `W/app/(app)/app/identity/_components/WhatPantopusKnowsCard.tsx:35`; `W/app/(app)/app/persona/[handle]/follow/page.tsx:294-295`
- **What the user sees:** 404 for `/legal/privacy` (the page is `/privacy`) and `/help/audience-firewall` (web has no /help pages).
- **Evidence:** Found by scanning static web links against the page list.
- **Fix (reuse):** Link `/privacy`; point the firewall link at `/privacy` or the Identity page's explainer, or drop it.
- **Backend change:** none
- **Other clients / notes:** Web reachability: the Identity nav needs `webFeatureFlags.identityFirewall` (default off in production builds, `W/components/AppShell.tsx:274`).

### Stream 3 · misleading (26)

#### S3-28 · If Settings or Advanced Privacy fail to load, the forms show defaults and Save overwrites the real settings
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Sidebar Settings (`W/components/AppShell.tsx:465`) → `/app/profile/settings`; → Advanced Privacy `/app/profile/settings/privacy`.
- **Where:** `W/app/(app)/app/profile/settings/page.tsx:21-25`; `W/app/(app)/app/profile/settings/page.tsx:53-55`; `W/app/(app)/app/profile/settings/page.tsx:64-78`; `W/app/(app)/app/profile/settings/privacy/page.tsx:25-31`; `W/app/(app)/app/profile/settings/privacy/page.tsx:49-52`; `W/app/(app)/app/profile/settings/privacy/page.tsx:73-92`
- **What the user sees:** Settings: no error; visibility "Public", show email/phone off; "Save Settings" → "Settings saved successfully" while writing those defaults (a Private profile becomes Public). Privacy: toast "Failed to load privacy settings", but the form stays editable at the most public defaults (search "everyone", findable by email and phone, profile "public") and Save writes them.
- **Evidence:** The load catch only logs (settings) or toasts (privacy); Save always sends every field; Settings' Save has no in-flight guard (`:360-366`).
- **Fix (reuse):** On load failure render `ErrorState` with retry and no form; disable Save until loaded and while saving.
- **Backend change:** none

#### S3-29 · Most Privacy controls don't save; the screen shows sample addresses and a fake "Last updated" date
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** iOS You → Privacy; Android Settings → Visibility preferences → Identity Center → Privacy Preview → Manage privacy (RTS:5812).
- **Where:** `I/Features/Settings/Privacy/PrivacyViewModel.swift:23-28`; `I/Features/Settings/Privacy/PrivacyViewModel.swift:49`; `I/Features/Settings/Privacy/PrivacyViewModel.swift:634-639`; `A/ui/screens/settings/SettingsViewModels.kt:350-355`; `A/ui/screens/settings/SettingsViewModels.kt:373`; `A/ui/screens/settings/SettingsViewModels.kt:983-985`
- **What the user sees:** "Profile visibility" preselected (iOS "Verified neighbors only"); "Address on profile" options "14 Elm Park Lane, Brooklyn NY" / "Park Slope, Brooklyn"; the location-fuzz slider and Activity toggles change and then reset on reopen; footer "Last updated · Mar 12, 2024". Only search visibility and "Find me by real name" persist.
- **Evidence:** The code's own comment: these cards "stay local until the backend grows the fields".
- **Fix (reuse):** Hide these cards or mark them clearly as not saved; bind "Profile visibility" to the real `profile_visibility` field (edited in Edit profile, `I/Features/Profile/EditProfileView+Fields.swift:341`); remove the hard-coded footer.
- **Backend change:** none for the minimal fix

#### S3-30 · The Messages list stops updating after you open any conversation
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** Mail → Messages → open a conversation → Back.
- **Where:** `I/Features/Chat/ChatListView.swift:48-49`; `I/Features/Chat/ChatListViewModel.swift:77-81`; `I/Features/Chat/ChatListViewModel.swift:96-102`
- **What the user sees:** The conversation you just read still shows unread (and the Unread count stays); new messages in other conversations don't appear until pull-to-refresh.
- **Evidence:** Pushing a thread fires `.onDisappear { viewModel.teardown() }`, cancelling the socket tasks; on return `load()` exits early (`if case .loaded = state { return }`) before `subscribeToSockets()`.
- **Fix (reuse):** Re-subscribe even when already loaded, and merge-refresh when the list reappears.
- **Backend change:** none

#### S3-31 · Messages filters with no matches say "No conversations yet"; the Pantopus AI row disappears
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** Mail → Messages → Unread / Gigs / Market with nothing in it.
- **Where:** `I/Features/Chat/ChatListViewModel.swift:206-207`; `A/ui/screens/inbox/chat/ChatListViewModel.kt:179-181`
- **What the user sees:** "No conversations yet / Message someone you've verified nearby." for users who have conversations.
- **Evidence:** Any empty filter sets the whole-list empty state.
- **Fix (reuse):** Per-filter empty lines (e.g. "No unread messages" + "View all") and keep the AI row (per-tab copy pattern: `I/Features/Notifications/NotificationsViewModel.swift:632-664`).
- **Backend change:** none

#### S3-32 · Help says "Go to Settings → Privacy → Delete account." but Settings has no Privacy row
- **Clients:** Android · **Severity:** misleading
- **How the user gets there:** Settings → Help.
- **Where:** `A/ui/screens/settings/help/HelpCenterScreen.kt:180`; `A/ui/screens/settings/SettingsViewModels.kt:145`
- **What the user sees:** Instructions that lead nowhere; the only path to Delete account is Visibility preferences → Identity Center → Privacy Preview → Manage privacy.
- **Evidence:** The Visibility row opens Identity Center (`"visibility" -> SettingsRoute.IdentityCenter`); the only link to Privacy is RTS:5812.
- **Fix (reuse):** Route the Visibility row to `SettingsRoute.Privacy` (handled at RTS:4940) or fix the copy.
- **Backend change:** none
- **Other clients / notes:** iOS maps Visibility to Identity Center by design ("Profiles & Privacy is the unified destination", `I/Features/Settings/SettingsView.swift:184`) and reaches Privacy from You.

#### S3-33 · "Your audience" actions end in "coming soon" toasts
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** You → Audience profile → "Your audience" → empty-state "Share your Beacon", or a member → Message / Change tier.
- **Where:** `A/ui/screens/creator_audience/YourAudienceViewModel.kt:405-420`; `I/Features/CreatorAudience/YourAudienceViewModel.swift:350-361`; `I/Features/CreatorAudience/YourAudienceView.swift:539-541`
- **What the user sees:** "Sharing your Beacon is coming soon.", "Messaging <name> is coming soon.", "Changing tiers… is coming soon."
- **Evidence:** Only fans can start DMs (`B/routes/personaDms.js:135-140`); owner actions are approve/decline/remove/mute/unmute.
- **Fix (reuse):** Share → system share of `https://pantopus.com/@<handle>` (built at `I/Features/BeaconProfile/BeaconProfileViewModel.swift:438`); remove Message and Change tier.
- **Backend change:** none
- **Other clients / notes:** Web shares the link (`W/app/(app)/app/persona/page.tsx:979-987`).

#### S3-34 · Audience profile opened from Settings: almost every control does nothing
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** Settings → Visibility preferences → Public profile card → Audience profile.
- **Where:** `I/Features/Settings/SettingsView.swift:107-108`; `I/Features/AudienceProfile/AudienceProfileView.swift:45-57`
- **What the user sees:** "Edit persona", "Set up payments", "Tell people you're here", "Compose broadcast", broadcast cards, "Your audience", "View all messages", thread and follower rows do nothing; "Following" is hidden.
- **Evidence:** The init defaults are all `{}` and the Settings host passes none.
- **Fix (reuse):** Pass the You host's callbacks (`I/Features/Root/YouTabRoot.swift:1660-1700`) or push `.audienceProfile` on the host stack.
- **Backend change:** none

#### S3-35 · "Set up payments" on the audience profile opens your own follow handshake
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** You → Audience profile without a Beacon → "Set up payments".
- **Where:** `I/Features/Root/YouTabRoot.swift:1678-1680`; `RTS:5115-5117`
- **What the user sees:** The Privacy Handshake wizard for your own username (a screen meant for visitors following you).
- **Fix (reuse):** Start persona Stripe onboarding (`POST /api/personas/:id/payments/onboard`, `B/routes/personaPayments.js:56`) and open the returned URL, as web does (`W/app/(app)/app/audience/setup/page.tsx:345`); natives need the endpoint.
- **Backend change:** none

#### S3-36 · "Claim an existing page" opens the Create wizard (You stack)
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** You → My businesses (empty) → "Already listed? Claim an existing page".
- **Where:** `I/Features/Root/YouTabRoot.swift:2186-2190`
- **What the user sees:** The create-business wizard.
- **Evidence:** The code falls back to create.
- **Fix (reuse):** Open DiscoverBusinessesView as the Hub does (`I/Features/Root/HubTabRoot.swift:1246, 2508`).
- **Backend change:** none
- **Other clients / notes:** Android opens DISCOVER_BUSINESSES (RTS:2596).

#### S3-37 · Business page editor: banner, logo and gallery controls are decoration; any banner shows a stock café picture
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** You → My businesses → a business → edit page.
- **Where:** `I/Features/Businesses/PageEditor/Components/BannerLogoEditor.swift:80-160`; `I/Features/Businesses/PageEditor/Components/GalleryEditor.swift:240-290`
- **What the user sees:** "Change banner", "Change logo", "Add banner", gallery "Add" and "Add cover photo" look like controls but do nothing; an existing banner is drawn as `CafeGoldenHourBanner` (`EditBusinessPageMapper.swift:44`).
- **Fix (reuse):** Upload with `POST /api/upload/business-media/:businessId?type=logo|banner` (`B/routes/upload.js:1388`; iOS already has the call, `I/Core/Networking/MultipartUploader.swift:579-595`); render the real image; hide the gallery controls (no gallery backend).
- **Backend change:** none

#### S3-38 · Settings "Upgrade" to business says "coming soon" although business creation exists
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Sidebar Settings → Account type → "Upgrade".
- **Where:** `W/app/(app)/app/profile/settings/page.tsx:310-315`
- **What the user sees:** Toast "Upgrade to business feature coming soon".
- **Evidence:** Business creation exists at `/app/business/new` (broken today, S3-01).
- **Fix (reuse):** Route to `/app/business/new` once S3-01 is fixed.
- **Backend change:** none

#### S3-39 · Business address step: "Request access (recommended)" and "I'm in a new building" are placeholders; a failed verify spins forever
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Create business → address step (reachable only after S3-01 is fixed).
- **Where:** `W/components/business/BusinessAddressFlow.tsx:502-512`; `W/components/business/BusinessAddressFlow.tsx:546-553`; `W/components/business/BusinessAddressFlow.tsx:115-117`
- **What the user sees:** "Ownership request coming soon. Please use a different address for now." on the option marked recommended; "Manual review coming soon. Please try a different format."; a failed validation leaves the spinner up with Verify hidden (`:100, :350`).
- **Evidence:** No backend route for either option.
- **Fix (reuse):** Drop the recommended badge and hide both options; set the error state in the catch as `:259-262` does.
- **Backend change:** none

#### S3-40 · Chat history that failed to load shows "No messages yet. Say hello!"; the Messages list says "No messages yet" under its own error
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Open a chat while the messages call fails; Messages list while conversations fail.
- **Where:** `W/hooks/useChatMessages.ts:223-225`; `W/components/chat/ChatMessageList.tsx:65-70`; `W/app/(app)/app/chat/page.tsx:68-70`; `W/app/(app)/app/chat/page.tsx:324-352`
- **What the user sees:** An empty conversation (the user may start over in a thread that has history); the list shows the error banner plus "No messages yet" and "0 conversations".
- **Evidence:** `fetchMessages` catch returns `[]`, so the error branch (`useChatMessages.ts:327-328`) never fires.
- **Fix (reuse):** Rethrow on initial and refresh loads and render `ErrorState` with Retry; skip the empty card and count when `conversationsQuery.isError`.
- **Backend change:** none

#### S3-41 · Public profile and business pages show "not found" for any failure
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** `/<username>` or `/b/<username>` while the API fails.
- **Where:** `W/app/[username]/PublicProfileClient.tsx:171-187`; `W/app/[username]/PublicProfileClient.tsx:458-472`; `W/components/business/BusinessPublicProfile.tsx:75-77`; `W/components/business/BusinessPublicProfile.tsx:149-163`
- **What the user sees:** "Profile not found / This user doesn't exist or has been removed." / "Business not found".
- **Fix (reuse):** Not-found only on 404; otherwise `ErrorState` with retry.
- **Backend change:** none

#### S3-42 · Profile stats show 0 and "$0.00" when their calls fail; "Earnings" links to My bids
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Avatar → `/app/profile`.
- **Where:** `W/app/(app)/app/profile/page.tsx:50-81`; `W/app/(app)/app/profile/page.tsx:298`
- **What the user sees:** Zeros that look real; the Earnings card opens `/app/my-bids`.
- **Evidence:** Each stat's catch falls back to 0.
- **Fix (reuse):** Show "—" with a retry for failed stats; link Earnings to `/app/wallet`.
- **Backend change:** none

#### S3-43 · Advanced Privacy "Blocked Users" never lists people blocked on web
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Settings → Advanced Privacy → Blocked Users.
- **Where:** `W/app/(app)/app/profile/settings/privacy/page.tsx:57-65`; `W/app/(app)/app/profile/settings/privacy/page.tsx:241-249`
- **What the user sees:** "No blocked users" next to "You can block someone from their profile page."
- **Evidence:** Web's profile Block writes `UserBlock` (`W/app/[username]/PublicProfileClient.tsx:383` → `B/routes/blocks.js:14-23`); this list reads `UserProfileBlock` (`B/routes/privacy.js:154-159`); a failed load also reads empty.
- **Fix (reuse):** Link to the working `/app/profile/settings/blocked` and have it also merge `api.privacy.getBlocks()`, as iOS merges both (`I/Features/Settings/Blocks/BlockedUsersViewModel.swift:11-17`).
- **Backend change:** none

#### S3-44 · Post-meeting follow-up promises a rebook link it never sends; its push switch and private note are ignored
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Scheduling → Search → an ended booking → "Post-meeting follow-up".
- **Where:** `W/components/scheduling/bookings-extras/FollowUpSheet.tsx:221-234`; `W/components/scheduling/bookings-extras/FollowUpSheet.tsx:236-279`
- **What the user sees:** "Send rebook link" appends "Here's a link to grab another time." with no link; "Send via push + message" is never read; "Private note / Only you can see this" is never stored.
- **Fix (reuse):** Create a real link with `createOneOffLink(event_type_id)` and append its URL (iOS pattern `I/Features/Scheduling/Bookings/Extras/FollowUp/BookingFollowUpViewModel.swift:125-145`); hide the switch and the note.
- **Backend change:** none
- **Other clients / notes:** Web reachability: the Scheduling sidebar needs `NEXT_PUBLIC_SCHEDULING_ENABLED` (default off in production builds, `W/lib/featureFlags.ts:32-34`); booking notifications and emails still link into `/app/scheduling/bookings/:id`.

#### S3-45 · Manage-booking page says the link "expired" on any error; "Request a new link" goes to the app home
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Email "manage" link → `/booking/<token>` (signed-out).
- **Where:** `W/components/scheduling/public/confirm/ManageBookingPanel.tsx:276-297`; `W/components/scheduling/public/confirm/ManageBookingPanel.tsx:319-336`
- **What the user sees:** "This link has expired … we'll email it to you" for network errors too; the button just links home; "Contact host" is always disabled (host email passed as null).
- **Evidence:** There is no request-new-link route.
- **Fix (reuse):** Show an error with Retry for non-expiry errors (the decoded kind is at `:321`), relabel the button to what it does, hide Contact host.
- **Backend change:** only for a real new-link request

#### S3-46 · Paid follow says "Stripe Checkout is coming in the next release"; Audience "Inbox — Coming soon" though the inbox exists
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Persona follow with a paid tier; `/app/audience` Inbox tab.
- **Where:** `W/app/(app)/app/persona/[handle]/follow/page.tsx:168-179`; `W/app/(app)/app/audience/page.tsx:213-219`
- **What the user sees:** "Stripe Checkout is coming in the next release. Your handshake is saved." (nothing is saved; checkout exists and returned no URL because it failed); "Inbox — Coming soon" while `/app/audience/inbox` works.
- **Evidence:** `B/routes/personas.js:1523-1563`; `W/app/(app)/app/audience/inbox/page.tsx:22-55`.
- **Fix (reuse):** Show a retryable error for the checkout; link the tab to the inbox.
- **Backend change:** none
- **Other clients / notes:** Behind flags: paid memberships off by default (`W/lib/featureFlags.ts:26`); the Audience nav needs the `audience_profile` flag.

#### S3-47 · Event type editor always shows "Reminders — 1 day, 1 hour before" and "Booking limits — Off"
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Scheduling → Event types → edit.
- **Where:** `W/components/scheduling/event-types/EventTypeForm.tsx:573-584`
- **What the user sees:** Static rows; real reminder timing is the booking page's `reminder_minutes`, edited at `/app/scheduling/reminders`.
- **Fix (reuse):** Read the real value (`getBookingPage`) and link the row to the reminders page; hide "Booking limits".
- **Backend change:** none
- **Other clients / notes:** Web reachability: the Scheduling sidebar needs `NEXT_PUBLIC_SCHEDULING_ENABLED` (default off in production builds, `W/lib/featureFlags.ts:32-34`); booking notifications and emails still link into `/app/scheduling/bookings/:id`.

#### S3-48 · Notifications: switching All/Unread during a load shows the wrong rows; a failed "load more" spins forever
- **Clients:** Android · **Severity:** misleading
- **How the user gets there:** Notifications → switch tabs or pull while a page is loading.
- **Where:** `A/ui/screens/notifications/NotificationsViewModel.kt:494-506`; `A/ui/screens/notifications/NotificationsViewModel.kt:541-547`
- **What the user sees:** Read rows under "Unread"; an endless spinner that pull-to-refresh can't restart.
- **Evidence:** The reload is dropped while a request runs; the Unread flag is read at request start; a failed load-more leaves the screen Loading.
- **Fix (reuse):** Cancel the running request on reload (same fix as C-17).
- **Backend change:** none

#### S3-49 · New message search failure says "No matches"
- **Clients:** Android · **Severity:** misleading
- **How the user gets there:** Messages → New message → search while the request fails.
- **Where:** `A/ui/screens/inbox/newmessage/NewMessageViewModel.kt:183-186`; `A/ui/screens/inbox/newmessage/NewMessageScreen.kt:502`
- **What the user sees:** "No matches / Try a different name or neighborhood."
- **Fix (reuse):** A separate error row with Retry.
- **Backend change:** none

#### S3-50 · Public profile shows "Connect" or "Quiet for now" after failed loads
- **Clients:** iOS · **Severity:** misleading · **Open PR:** #199 touches this view model ("keep personal block state on Local profile reopen"); overlap judged by title only
- **How the user gets there:** Any author → public profile, when the relationship or posts call fails.
- **Where:** `I/Features/Profile/PublicProfileViewModel.swift:649-651`; `I/Features/Profile/PublicProfileViewModel.swift:702-713`
- **What the user sees:** "Connect" shown to existing connections; "Quiet for now" instead of a failed posts list.
- **Evidence:** The relationship error is only logged; posts errors return an empty list.
- **Fix (reuse):** Hide the Connect/Follow row until the relationship loads; show a retry row for posts.
- **Backend change:** none

#### S3-51 · Scheduling entries land on "Payments are coming soon" (paid scheduling is off by default); "Send test to me" says tests are coming soon
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** You → Scheduling → Bookings → "Share your booking link" → "Connect Stripe to take paid bookings"; Insights → No-shows → "Set a policy"; Settings → Message templates → Preview → "Send test to me".
- **Where:** `I/Features/Scheduling/BookingPage/BookingPageManagementView.swift:120-124`; `I/Features/Scheduling/Insights/NoShowReportView.swift:186`; `I/Features/Scheduling/Business/Payments/PaymentsKit.swift:83-120`; `I/Features/Scheduling/Automations/Templates/MessagePreviewViewModel.swift:127-135`
- **What the user sees:** "Payments are coming soon"; "Test sends are coming soon. Save your message to use it."
- **Evidence:** `SchedulingFeatureFlags.paidEnabled` defaults off (`I/Features/Scheduling/Foundation/SchedulingFeatureFlags.swift:20-35`) but these entries aren't gated; there is no test-send route.
- **Fix (reuse):** Gate the entries on the flag, as `SchedulingSettingsScreen.swift:67` and `EventTypeEditorViewModel.swift:122` already do; hide "Send test".
- **Backend change:** none

#### S3-52 · Customer "My bookings": rows look tappable and "Book again" / "Pay" do nothing
- **Clients:** iOS, Web · **Severity:** misleading
- **How the user gets there:** A booking notification (`/app/scheduling/my-bookings`) → My bookings.
- **Where:** `I/Features/Scheduling/Invitee/Edge/MyBookingsView.swift:158`; `I/Features/Scheduling/Invitee/Edge/MyBookingsView.swift:171-173`; `I/Features/Scheduling/Invitee/Edge/MyBookingsView.swift:202-204`; `W/components/scheduling/public/edge/MyBookingsList.tsx:205-212`
- **What the user sees:** Chevrons on rows that can't be opened; dead "Book again" and "Pay"; iOS search does nothing (`:29`).
- **Evidence:** The my-bookings payload lacks slug, token and amount (`B/routes/scheduling.js:1377`).
- **Fix (reuse):** Remove the chevrons and dead buttons until the payload carries what they need.
- **Backend change:** yes, to make them work

#### S3-53 · Chat header "Call" and the assistant's "New chat" look like buttons but do nothing
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** Mail → Messages → a person DM (phone icon); the Pantopus assistant (new-chat icon).
- **Where:** `I/Features/Chat/Conversation/ChatConversationView.swift:1577-1582`; `I/Features/Chat/Conversation/ChatConversationView.swift:1596-1601`; `A/ui/screens/inbox/conversation/ChatConversationScreen.kt:858-871`; `A/ui/screens/inbox/conversation/ChatConversationScreen.kt:1487-1491`
- **What the user sees:** iOS: tappable buttons with empty actions. Android: decorative icons (`HeaderIcon` has no click or content description) that look like buttons.
- **Fix (reuse):** Remove them until calling and assistant reset exist.
- **Backend change:** none

### Stream 3 · weak (12)

#### S3-54 · Deleting a single chat message has no confirm; delete, edit and react failures are silent
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** A chat thread → long-press your message → Delete / Edit / react.
- **Where:** `I/Features/Chat/Conversation/ChatConversationView.swift:1118`; `I/Features/Chat/Conversation/ChatConversationView.swift:2396`; `A/ui/screens/inbox/conversation/ChatConversationScreen.kt:568-570`; `A/ui/screens/inbox/conversation/ChatConversationViewModel.kt:1052`
- **What the user sees:** The message is deleted for everyone at once; failures show nothing (a failed edit silently puts the text back).
- **Evidence:** Bulk delete does confirm ("Deleted messages are removed for everyone…", iOS `:283-297`; Android `ChatConversationScreen.kt:663-680`). Failures only log (iOS VM `:619-633, 922-931`; Android VM `:741, 1014, 1052, 1189`).
- **Fix (reuse):** Reuse the bulk-delete confirm for single deletes; send failures to the existing toast/snackbar (Android `ChatConversationScreen.kt:689-696`).
- **Backend change:** none
- **Other clients / notes:** #231 (merged) added block/report failure alerts on Android, not these.

#### S3-55 · Any reaction reloads the whole thread to a spinner and drops older pages
- **Clients:** Android · **Severity:** weak
- **How the user gets there:** An open thread when anyone reacts to a message.
- **Where:** `A/ui/screens/inbox/conversation/ChatConversationViewModel.kt:1694-1695`; `A/ui/screens/inbox/conversation/ChatConversationViewModel.kt:1257-1259`
- **What the user sees:** The thread flips to loading, older pages are dropped, and a failed reload becomes a full-screen error.
- **Evidence:** The reaction event triggers `fetch(initial = true)`, which sets Loading and clears messages.
- **Fix (reuse):** Refresh without the Loading state (or patch reaction counts) and keep rows on failure.
- **Backend change:** none

#### S3-56 · Messages list has no pull-to-refresh
- **Clients:** Android · **Severity:** weak
- **How the user gets there:** Mail → Messages.
- **Where:** `A/ui/screens/inbox/chat/ChatListScreen.kt:70-97`; `A/ui/screens/inbox/chat/ChatListViewModel.kt:72`
- **What the user sees:** The list only reloads from the error screen's "Try again"; it goes stale if the live connection drops.
- **Fix (reuse):** Add pull-to-refresh calling `viewModel.refresh()`.
- **Backend change:** none
- **Other clients / notes:** iOS has it (`I/Features/Chat/ChatListView.swift:140`).

#### S3-57 · Notification delete / "Mark all read" and Unblock failures roll back with no message
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** Notifications → delete a row or Mark all read; Settings → Blocked users → Unblock.
- **Where:** `I/Features/Notifications/NotificationsViewModel.swift:427-443`; `I/Features/Notifications/NotificationsViewModel.swift:471-487`; `I/Features/Settings/Blocks/BlockedUsersViewModel.swift:221-228`; `A/ui/screens/notifications/NotificationsViewModel.kt:417-421`; `A/ui/screens/notifications/NotificationsViewModel.kt:469-473`; `A/ui/screens/settings/blocks/BlockedUsersViewModel.kt:225-227`
- **What the user sees:** Rows reappear or turn unread again with no explanation; no success feedback for unblock.
- **Fix (reuse):** Toast on rollback (and on unblock success).
- **Backend change:** none

#### S3-58 · Blocking from a public profile has no confirm
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** A person's profile → ⋯ → "Block this user".
- **Where:** `A/ui/screens/profile/PublicProfileScreen.kt:204-207`; `I/Features/Profile/PublicProfileView.swift:90-92`
- **What the user sees:** Immediate block, then "User blocked".
- **Evidence:** Blocking from a chat thread confirms ("They won't be able to message you anymore…", `A/ui/screens/inbox/conversation/ChatConversationScreen.kt:608-633`).
- **Fix (reuse):** Reuse the chat block confirm.
- **Backend change:** none

#### S3-59 · A failed reply to a business review disappears along with the text
- **Clients:** iOS · **Severity:** weak
- **How the user gets there:** My businesses → a business → a review → Reply.
- **Where:** `I/Features/Businesses/OwnerDashboard/BusinessOwnerViewModel.swift:110-116`
- **What the user sees:** The reply appears, then vanishes; the draft is lost.
- **Evidence:** The error is only logged.
- **Fix (reuse):** Use the screen's existing toast (`:148-158`) and keep the draft.
- **Backend change:** none

#### S3-60 · Swiping down on Edit profile discards unsaved edits without asking
- **Clients:** iOS · **Severity:** weak
- **How the user gets there:** Avatar → Edit profile → change something → swipe down.
- **Where:** `I/Features/Root/YouTabRoot.swift:477-479`; `I/Features/Root/HubTabRoot.swift:2672`
- **What the user sees:** Edits lost (the X button asks "Discard changes?", `I/Features/Shared/Form/FormShell.swift:160-182`).
- **Fix (reuse):** Block swipe-to-dismiss while dirty, as `I/Features/Settings/Privacy/PrivacyView.swift:38` does.
- **Backend change:** none

#### S3-61 · Saving the profile hides which field is wrong
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Edit profile → Save with an invalid phone, or a phone already in use.
- **Where:** `W/hooks/useProfileForm.ts:218-226`
- **What the user sees:** "Failed to update profile. Please try again." instead of "Phone number must be in international format…" or "Phone number already in use"; if the profile saves but the skills call fails, it still reports failure.
- **Fix (reuse):** `extractApiError` for the message and `extractFieldErrors` (`frontend/packages/ui-utils/src/auth-form.ts:48, 74`) for per-field errors.
- **Backend change:** none

#### S3-62 · Endorse silently undoes itself when refused
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** A business page → Endorse, for a user without a verified Home.
- **Where:** `W/components/endorsement/EndorsementButton.tsx:117-120`
- **What the user sees:** The endorsement toggles back with no reason (the backend's 403 reasons, `B/routes/businessDiscovery.js:1087, 1094, 1103`, are dropped).
- **Fix (reuse):** Toast the rejection's message.
- **Backend change:** none

#### S3-63 · A connection request notification opens Connections on "All", not Requests
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** Tap connection_request (`/app/connections?tab=requests`).
- **Where:** `I/Features/Connections/ConnectionsViewModel.swift:54`; `I/Features/Connections/ConnectionsViewModel.swift:155`; `A/ui/screens/connections/ConnectionsViewModel.kt:62`; `A/ui/screens/connections/ConnectionsViewModel.kt:165`
- **What the user sees:** The All tab.
- **Evidence:** The `tab` query is dropped.
- **Fix (reuse):** Open on the pending tab (`ConnectionsTab.pending` / `ConnectionsTab.PENDING`).
- **Backend change:** none

#### S3-64 · Scheduling notification channels: web has a manager; iOS has one that nothing opens; Android has none
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** Web: Scheduling → Channels (`W/app/(app)/app/scheduling/layout.tsx:111`).
- **Where:** `I/Features/Scheduling/Polish/H15/NotificationChannelManagerView.swift:22`
- **What the user sees:** No way to manage channels on native.
- **Evidence:** The iOS view is only instantiated in its own preview (`:473`); Android only has the permission prompt (RTS:3496).
- **Fix (reuse):** Wire the iOS view into scheduling settings; Android would need a new screen (low priority).
- **Backend change:** none

#### S3-65 · Business "Unpublish" is one click, with no confirm
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Business dashboard → Settings → Unpublish.
- **Where:** `W/components/business/tabs/SettingsTab.tsx:16-32`
- **What the user sees:** The page goes offline immediately.
- **Fix (reuse):** Use `confirmStore` with a destructive variant.
- **Backend change:** none

### Stream 3 · cosmetic (4)

#### S3-66 · Sharing a business shares only the app download link
- **Clients:** iOS · **Severity:** cosmetic
- **How the user gets there:** Business profile → Share.
- **Where:** `I/Features/Root/HubTabRoot.swift:1927`; `I/Features/Root/HubTabRoot.swift:1943`; `I/Features/Root/YouTabRoot.swift:2419`
- **What the user sees:** "Check out this business on Pantopus — <app link>" with no business name or link.
- **Fix (reuse):** Share the business's own link, which the app already opens (`I/Core/Routing/DeepLinkRouter.swift:461-468`).
- **Backend change:** none

#### S3-67 · Small controls that do nothing: Legal "Share", broadcast "⋯", business "Hire to review", and a footer that looks like links
- **Clients:** iOS, Android · **Severity:** cosmetic
- **How the user gets there:** Settings → Legal → a document; a broadcast; a business profile.
- **Where:** `I/Features/Settings/Legal/LegalContentView.swift:100`; `A/ui/screens/settings/legal/LegalScreens.kt:314-322`; `I/Features/AudienceProfile/BroadcastDetail/BroadcastDetailView.swift:69`; `I/Features/BusinessProfile/BusinessProfileView.swift:421`; `I/Features/BusinessProfile/BusinessProfileView.swift:428-446`; `A/ui/screens/business_profile/BusinessProfileScreen.kt:454-456`
- **What the user sees:** Taps do nothing; iOS footer "Report · Share" is plain text styled like links.
- **Fix (reuse):** Share the public `/terms` / `/privacy` URLs; hide the broadcast ⋯; route "Hire to review" to the Contact action or remove it.
- **Backend change:** none

#### S3-68 · Creator inbox "Send a broadcast · Compose" opens the audience profile, not the composer
- **Clients:** iOS · **Severity:** cosmetic
- **How the user gets there:** You → Creator inbox → "Send a broadcast".
- **Where:** `I/Features/CreatorInbox/CreatorInboxView.swift:372-381`; `I/Features/Root/YouTabRoot.swift:1817-1819`
- **What the user sees:** The audience profile.
- **Fix (reuse):** Push `.composeBroadcast`.
- **Backend change:** none

#### S3-69 · Invoice "Download PDF": disabled with a hover-only reason on web; live-looking but dead on iOS
- **Clients:** Web, iOS · **Severity:** cosmetic
- **How the user gets there:** A paid invoice.
- **Where:** `W/components/scheduling/packages/InvoiceDetail.tsx:192-203`; `I/Features/Scheduling/Business/Invoices/SchedulingInvoiceDetailViewModel.swift:211-223`
- **What the user sees:** Web: a disabled primary button; iOS: "Download PDF", "Mark paid" and the overflow do nothing.
- **Evidence:** There is no PDF route.
- **Fix (reuse):** Hide the PDF action (and iOS's dead buttons) until a route exists.
- **Backend change:** none

## Coordinator — navigation shells, You/Settings index, shared components, and unowned features (Pulse/feed, support trains) (37: 10 dead end, 11 misleading, 13 weak, 3 cosmetic)

### Coordinator · dead end (10)

#### C-01 · The profile (You) screen has no way back into the app
- **Clients:** iOS · **Severity:** dead end
- **How the user gets there:** Place tab → Hub avatar (`I/Features/Root/HubTabRoot.swift:1077` `.openProfile`) or the Mail tab avatar (`I/Features/Root/RootTabView.swift:117`); the `monthly_receipt` push opens it too (`RootTabView.swift:202-207`).
- **Where:** `I/Features/Root/RootTabView.swift:137-139`; `I/Features/Root/YouTabRoot.swift:454-461`
- **What the user sees:** The Me screen fills the screen with the tab bar hidden and no Close or Back. The only exits are Log out or force-quit. A push or deep link that arrives while it is open switches the tab underneath, so the destination stays hidden.
- **Evidence:** `.fullScreenCover(isPresented: $showProfile) { YouTabRoot(...) }`; `showProfile` is only ever set to true (`RootTabView.swift:105, 117, 206`). The stack root is `MeView(...).toolbar(.hidden, for: .navigationBar)`; `MeView`'s only buttons are Retry (`I/Features/Me/MeView.swift:172`), tiles (`:358`), rows (`:411`) and the Log out / switch-identity card (`:457`). A full-screen cover can't be swiped away.
- **Fix (reuse):** Pass an `onClose` into `YouTabRoot`/`MeView` and add a close button to the Me header with the Settings top bar's icon treatment (`I/Features/Settings/SettingsTopBar.swift`). Set `showProfile = false` when a deep link switches tabs (every destination except `.monthlyReceipt`), the way `NeighborhoodTabRoot.swift:51-57` dismisses its sheets.
- **Backend change:** none
- **Other clients / notes:** Android pushes You as a normal route (RTS:2488-2497), so Back and the bottom bar work. Web has no equivalent screen.

#### C-02 · Hub status pills ("N notifications", "$X ready · Tap to withdraw") open a placeholder
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Place tab → Hub (users without a primary Home land here; owners reach it as the Place stack root) → status strip pill. (Jump back in uses the same resolver, but the rail keeps only the first two server items, "Post a Task" and "Messages", which are mapped.)
- **Where:** `I/Features/Root/HubTabRoot.swift:1089-1102`; `I/Features/Root/HubTabRoot.swift:1166-1185`; `RTS:2388-2403`; `RTS:6321-6329`
- **What the user sees:** "3 notifications isn't here yet" / "$12.50 ready isn't here yet" + "We're still designing this tab. Check back soon."
- **Evidence:** The backend sends `route: '/app/notifications'` and `'/app/settings/payments'` (`B/routes/hub.js:371-387`), plus `/app/businesses/:id/dashboard` and `/app/map` (`hub.js:513-516`). `route(forJumpBackIn:)` / `routeForJumpBackIn` only map `/app/mailbox`, `/app/homes/`, `/app/chat` and `/gigs`; everything else becomes a placeholder labelled with the pill title.
- **Fix (reuse):** Send unmatched routes through the existing deep-link resolver, as the Notifications list already does: iOS `DeepLinkRouter.shared.handle(path:)` (resolves notifications and payments settings, `I/Core/Routing/DeepLinkRouter.swift:438, 558-563`; caller pattern `I/Features/Notifications/NotificationsViewModel.swift:680-682`), Android `DeepLinkRouter.handle(route)` (pattern `A/ui/screens/notifications/NotificationsViewModel.kt:698-703`). Or map directly: `/app/notifications` → iOS `.notifications`, Android `ChildRoutes.NOTIFICATIONS` (RTS:951); `/app/settings/payments` → iOS `.paymentsSettings`, Android `ChildRoutes.WALLET` (RTS:1618); `/app/map` → the explore route.
- **Backend change:** none
- **Other clients / notes:** Web works (`W/components/hub/StatusStrip.tsx:77` pushes the route).

#### C-03 · Recent activity rows whose link isn't a gig, listing, post, mail item or Home open a placeholder
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Place → Hub → Recent activity "See all" → a row for a connection request, new follower, persona DM, invoice, neighbor message, chat, or any notification without a link.
- **Where:** `I/Features/RecentActivity/RecentActivityViewModel.swift:161-185`; `I/Features/Root/HubTabRoot.swift:2312`; `A/ui/screens/recent_activity/RecentActivityViewModel.kt:97-111`; `RTS:4783-4784`
- **What the user sees:** "<notification title> isn't here yet".
- **Evidence:** Activity rows are built from notification links (`B/routes/hub.js:521-541`; a linkless notification falls back to `/app/notifications`). The matchers only know gig, listing, `/app/mailbox/item/`, post and Home paths (iOS placeholder at `RecentActivityViewModel.swift:184`).
- **Fix (reuse):** Fall back to the same `DeepLinkRouter` resolver the Notifications list uses (see C-02).
- **Backend change:** none
- **Other clients / notes:** Web works (`W/components/hub/ActivityLog.tsx:46`).

#### C-04 · You → Home rows open placeholders when the user has no shared Home (the founder's example)
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Hub avatar → You → "Home" pill → Members / Owners / Access codes / Bills / Maintenance / Household tasks / Packages / Emergency info.
- **Where:** `A/ui/screens/you/YouScreen.kt:192-247`; `I/Features/Root/YouTabRoot.swift:868`
- **What the user sees:** Header "Your Homes · No shared Home · Open My homes for private tasks, invitations and verification progress." The 7 tiles are greyed and ignore taps (they do not open a placeholder, which corrects the example); every row opens "Members isn't here yet", "Bills isn't here yet", and so on.
- **Evidence:** The Home identity is unbound when `sharedHomes` is empty: no Homes, only Homes still in verification (`access_kind` `verification`, `B/services/homeListService.js:95-108`), or a failed my-homes call (Android `.orEmpty()` at `A/ui/screens/you/me/MeViewModel.kt:112-113`; iOS `optional{}` at `I/Features/Me/MeViewModel.swift:119-126`, so a failure also reads "No shared Home"). Unbound rows carry no `homeId` (`MeViewModel.kt:280-297`; `MeViewModel.swift:283-298, 385-405`), so `YouScreen.kt:201-234` / `YouTabRoot.swift:762-812` fall through to the placeholder. Tiles are inert (`A/ui/screens/you/me/MeView.kt:440-445`; `I/Features/Me/MeView.swift:389`).
- **Fix (reuse):** When `homeId` is empty, send the rows (and tiles) to the existing My homes: Android `onOpenMyHomes()` (`YouScreen.kt:108` → RTS:2562 → MY_HOMES RTS:2569), iOS `.myHomes` (`YouTabRoot.swift:2145-2165`). My homes already offers "Add a home" (Android "No saved Homes yet" state `A/ui/screens/homes/MyHomesListViewModel.kt:277-279` → ADD_HOME `AddHomeWizardScreen` RTS:5927-5955; iOS `.addHome`, `YouTabRoot.swift:1115`), Find (RTS:2574; iOS `.findHome`, `:1131`) and the evidence/residency steps for Homes in verification (RTS:2576-2581). When the homes call failed, show an error with Retry instead of "No shared Home".
- **Backend change:** none
- **Other clients / notes:** Web has `/app/homes` and `/app/homes/new`.

#### C-05 · You → Home "Documents", "Emergency info", "Privacy" and every identity's "Help" / "Terms" / "Privacy" open placeholders even with a bound Home
- **Clients:** Android · **Severity:** dead end · **Open PR:** #251 wires Help, Terms, Privacy and `me.home.privacy` (diff read); Documents and Emergency info remain
- **How the user gets there:** You → Home pill (with a shared Home) → tile "Documents", rows "Emergency info" and "Privacy"; any identity → "Help", "Terms", "Privacy".
- **Where:** `A/ui/screens/you/YouScreen.kt:181`; `A/ui/screens/you/YouScreen.kt:247`
- **What the user sees:** "Documents isn't here yet", "Emergency info isn't here yet", "Privacy isn't here yet", "Help isn't here yet", "Terms isn't here yet".
- **Evidence:** The keys `me.docs` (`A/ui/screens/you/me/MeViewModel.kt:414`), `me.emergency` (`:469`), `me.home.privacy` (`:493`), `me.help` / `me.legal` / `me.privacy` (`:259-266, 389-391, 486-487`) have no case in the tile or row handlers.
- **Fix (reuse):** `me.docs` → `ChildRoutes.homeDocs(homeId)` (RTS:647); `me.emergency` → `homeEmergency(homeId)` (RTS:612); `me.home.privacy` → `homeSettings(homeId)` (RTS:855) or SETTINGS_PRIVACY; Help → SETTINGS_HELP (RTS:1025); Terms → SETTINGS_LEGAL (RTS:1028); Privacy → SETTINGS_PRIVACY (RTS:1010).
- **Backend change:** none
- **Other clients / notes:** iOS routes all of these (`I/Features/Root/YouTabRoot.swift:652-663, 753-775`).

#### C-06 · Hub Discover "People" and "Businesses" items open a 404
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** Logo → `/app/hub` → Discover → People or Businesses → tap an item.
- **Where:** `W/components/hub/HubDiscovery.tsx:60-61`; `B/routes/hub.js:924`; `B/routes/hub.js:989`
- **What the user sees:** Next's default "404 | This page could not be found." outside the app shell. Tasks and Posts open the public share pages rather than the in-app detail.
- **Evidence:** `router.push(item.route)` with backend routes `/user/${u.id}` and `/businesses/${b.id}`; web has no `/user/*` or `/businesses/*` page and no custom not-found page.
- **Fix (reuse):** Map routes on the web side the way `W/lib/notificationRoutes.ts` does: `/user/<uuid>` → `/<uuid>` (the public profile accepts UUIDs, `W/app/[username]/PublicProfileClient.tsx:158-160`), `/gigs/<id>` → `/app/gigs/<id>`, `/posts/<id>` → `/app/feed/post/<id>`. Businesses need a username: add `username` to the item (already selected at `hub.js:963`) and route to `/b/<username>`.
- **Backend change:** additive `username` on business Discover items (optional)
- **Other clients / notes:** Native maps Discover kinds to native screens (RTS:6178-6185; `I/Features/Root/HubTabRoot.swift:1150-1158`).

#### C-07 · Support train host actions open placeholders; organizers never see "Manage"
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Nearby → Tasks, or You → "Support trains" → a train → "⋯" or the "Hosted by…" row (Message host); a fully covered train's dock (Send a card / Join as backup); your own slot → "Edit".
- **Where:** `A/ui/screens/support_trains/detail/SupportTrainDetailScreen.kt:76`; `A/ui/screens/support_trains/detail/SupportTrainDetailScreen.kt:366`; `RTS:5272`; `RTS:5296-5307`; `I/Features/SupportTrains/Detail/SupportTrainDetailView.swift:441-456`; `I/Features/Root/HubTabRoot.swift:2382`; `I/Features/Root/HubTabRoot.swift:2404-2423`
- **What the user sees:** "Message host isn't here yet" (also for the organizer), "Send a card isn't here yet", "Join as backup isn't here yet", "Edit your slot isn't here yet". In the iOS You and Tasks stacks the same taps do nothing (no callbacks passed, `YouTabRoot.swift:1554-1556`, `TasksTabRoot.swift:189-198`). "Report this train" is empty in every iOS host.
- **Evidence:** The ⋯ button runs `if (isOrganizer) onOpenManage() else onMessageHost()`; `isOrganizer` defaults to false and no host passes it (Android `:76` and RTS:5272; iOS `:441` and `HubTabRoot.swift:2382`), so Manage Train is only reachable through the `support-trains/:id/manage` deep link.
- **Fix (reuse):** Pass `isOrganizer = content.viewerRole.isOrganizer` (Android `SupportTrainDetailContent.kt:152, 202`). Message host → load organizers (`GET /api/activities/support-trains/:id/organizers`, `B/routes/supportTrains.js:1128`) and open the existing chat (Android `ChildRoutes.chatConversationFromPicker`, RTS:1509; iOS `.chatConversation`). Hide Send a card, Join as backup and Report (no backend routes). Drop "Edit" on a slot (Leave / Mark delivered already work).
- **Backend change:** none (organizers route exists)
- **Other clients / notes:** Web shows Manage to organizers (`W/app/(app)/app/support-trains/[id]/page.tsx:666`) and has none of the dead actions. Owner note: support trains have no stream owner; the nearest is Stream 1 (they live under Tasks).

#### C-08 · Manage train rows "Edit dates & slots", "Invite more helpers", "Analytics" open placeholders (deep link only)
- **Clients:** iOS, Android · **Severity:** dead end
- **How the user gets there:** Only via `pantopus://support-trains/:id/manage` (no in-app entry; see C-07) → Organize.
- **Where:** `RTS:5359-5368`; `I/Features/Root/HubTabRoot.swift:2466-2474`
- **What the user sees:** "Edit dates · <train UUID> isn't here yet", and the same pattern for the other two.
- **Evidence:** `ManageTrainScreen.kt:397-402` / `I/Features/SupportTrains/Manage/ManageTrainView.swift:229-236` call host closures that push placeholders.
- **Fix (reuse):** Invite → the existing share action, or `POST /api/support-trains/:id/invites` (`B/routes/supportTrains.js:2067`). Hide Analytics (no backend). Edit dates has backend slot routes (`supportTrains.js:921, 971`) but no native editor: hide it.
- **Backend change:** none
- **Other clients / notes:** Web has an invite form (`W/app/(app)/app/support-trains/[id]/manage/page.tsx:91-103`).

#### C-09 · Support train Review signups → "Message" opens a placeholder
- **Clients:** iOS · **Severity:** dead end
- **How the user gets there:** You → "Support trains" → a train → Review signups → a confirmed row → "Message".
- **Where:** `I/Features/Root/YouTabRoot.swift:1605`; `I/Features/ReviewSignups/ReviewSignupsViewModel.swift:329-337`
- **What the user sees:** "Message helper isn't here yet".
- **Evidence:** The closure only passes the reservation id.
- **Fix (reuse):** Pass the reservation and push `.chatConversation(... .person(otherUserId: reservation.userId))` (`userId` is on the DTO, `I/Core/Networking/Models/SupportTrains/SupportTrainsDTOs.swift:151`); hide the button for guest signups.
- **Backend change:** none
- **Other clients / notes:** On Android the equivalent route has no caller (dead code).

#### C-10 · Feed post "Matched Businesses" rows open a 404
- **Clients:** Web · **Severity:** dead end
- **How the user gets there:** `/app/feed/post/<id>` for ask_local, recommendation, service_offer or lost_found posts → "Matched Businesses" row.
- **Where:** `W/app/(app)/app/feed/post/[id]/page.tsx:699-703`
- **What the user sees:** 404: rows link to `/app/profile/${biz.username}`; there is no `/app/profile/[username]` page.
- **Evidence:** Matched businesses load for those post types (`page.tsx:93-105`).
- **Fix (reuse):** Link to `/b/${biz.username}`, as `W/components/feed/NearbyProvidersCard.tsx:37` and `W/components/discover/BusinessResultCard.tsx:168` do.
- **Backend change:** none
- **Other clients / notes:** Owner note: the feed is unassigned; the destination is a Stream 3 business page.

### Coordinator · misleading (11)

#### C-11 · You → "Business" identity says business is web-only; "Edit business profile" opens a placeholder
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** You → "Business" pill (every user, including business owners).
- **Where:** `A/ui/screens/you/me/MeViewModel.kt:337-397`; `A/ui/screens/you/YouScreen.kt:247`; `I/Features/Me/MeViewModel.swift:336-368`; `I/Features/Root/YouTabRoot.swift:868`
- **What the user sees:** "Add a business · No business yet · Business identity is set up in the web app today; mobile read APIs land later." The tiles are inert; "Edit business profile" → "Edit business profile isn't here yet".
- **Evidence:** The Business identity never reads the user's businesses and is always unbound (tagline `MeViewModel.kt:344` / `MeViewModel.swift:341`). Both apps already load businesses in My Businesses (`A/ui/screens/businesses/MyBusinessesViewModel.kt:67`; iOS `BusinessesEndpoints.myBusinesses()`) and have create and owner screens.
- **Fix (reuse):** Route the row and tiles to the existing My Businesses (Android `onOpenMyBusinesses()`, `YouScreen.kt:110` → RTS:2564; iOS `.myBusinesses`, `YouTabRoot.swift:2177`), which offers Create and "Already listed? Claim an existing page". Replace the tagline with true copy.
- **Backend change:** none
- **Other clients / notes:** Web has `/app/businesses`.

#### C-12 · Hub Discover rail says "Nothing nearby yet" when the request failed
- **Clients:** iOS, Android, Web · **Severity:** misleading
- **How the user gets there:** Place → Hub → Discover rail, on load or after switching its filter tab.
- **Where:** `I/Features/Hub/HubViewModel.swift:101-109`; `I/Features/Hub/Sections/HubSections.swift:635-648`; `A/ui/screens/hub/HubViewModel.kt:97-103`; `A/ui/screens/hub/sections/HubSections.kt:696`; `W/components/hub/HubDiscovery.tsx:47-49`
- **What the user sees:** "Nothing nearby yet" with no retry.
- **Evidence:** iOS swallows the error (`HubViewModel.swift:163-165, 190-194, 206`); Android maps failure to an empty list (`HubViewModel.kt:190-197`); web's catch sets `[]` (`HubDiscovery.tsx:47-49` → `:104`).
- **Fix (reuse):** Track a failed state and show an inline "Couldn't load · Retry" row using the shared ErrorState (`I/Core/Design/Components/ErrorState.swift:30`, `A/ui/components/ErrorState.kt`, `W/components/ui/ErrorState.tsx`).
- **Backend change:** none

#### C-13 · Today tab shows "No briefing available right now." when the load failed
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Sidebar or mobile tab "Today" (`W/components/AppShell.tsx:702`) → `/app/today` (re-exports the hub Today page).
- **Where:** `W/app/(app)/app/hub/today/page.tsx:116`; `W/app/(app)/app/hub/today/page.tsx:161-181`
- **What the user sees:** "No briefing available right now." with no error and no Retry.
- **Evidence:** `const error = query.error instanceof Error ? query.error.message : ''` is always empty because the shared client rejects plain objects (`P/client.ts:803-817`), so the existing amber error block with Retry (`:161-173`) never renders.
- **Fix (reuse):** Branch on `query.isError`; take the message from `getErrorMessage(query.error, …)` (`frontend/packages/utils/src/index.ts`, reads plain objects since #277).
- **Backend change:** none

#### C-14 · Hub Action queue shows false to-dos and never shows the owner's task items
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** Logo → `/app/hub` → Action queue card.
- **Where:** `W/components/dashboard/ActionQueueCard.tsx:66-69`; `W/components/dashboard/ActionQueueCard.tsx:86-89`; `W/components/dashboard/ActionQueueCard.tsx:101-139`
- **What the user sees:** A failed profile load shows "Add profile photo"; a failed Stripe status shows "Set up payouts". "N deadlines within 24h" and "N tasks with no offers" can never appear, so "You are caught up" can be wrong.
- **Evidence:** Failures only log. `GET /api/gigs` without `user_id` excludes the viewer's own tasks (`B/routes/gigs.js:2309, 2384-2386`).
- **Fix (reuse):** Use `api.gigs.getMyGigs` (already used at `W/app/(app)/app/profile/page.tsx:50`) and skip items whose source call failed.
- **Backend change:** none

#### C-15 · Shared error text shows HTTP codes and raw response bodies
- **Clients:** iOS, Android · **Severity:** misleading · **Open PR:** #286 "plain wording for a server failure on Android and iOS" edits both files
- **How the user gets there:** Any failed load or action that uses the shared error copy (Hub, Pulse, Tasks, Mailbox, Marketplace, task detail, Notifications, chat…).
- **Where:** `I/Core/Networking/APIError.swift:38-94`; `A/data/api/net/NetworkResult.kt:40`; `A/data/api/net/NetworkResult.kt:55-64`
- **What the user sees:** "Server error 502. Please try again."; "Received an unexpected response."; a non-JSON 4xx body verbatim (`APIError.swift:84-86`); a JSON body without a message as raw JSON (`:93`).
- **Evidence:** Shown through `errorDescription` / `displayMessage` on most screens (e.g. `I/Features/Hub/HubViewModel.swift:156`, `PulseFeedViewModel.swift:574`, `MailboxRootViewModel.swift:483`).
- **Fix (reuse):** Plain-language copy for 5xx, decoding and invalid responses, and a fallback when a 4xx body isn't JSON; fold per-screen `friendlyMessage(for:)` helpers into one.
- **Backend change:** none

#### C-16 · Support train "Sign up for a slot" pushes a "Claim a slot" placeholder over the real sign-up sheet
- **Clients:** Android · **Severity:** misleading
- **How the user gets there:** A train with open dates → dock "Sign up for a slot", or tap a calendar date.
- **Where:** `A/ui/screens/support_trains/detail/SupportTrainDetailScreen.kt:95-100`; `RTS:5288-5295`
- **What the user sees:** "Claim a slot isn't here yet". Back reveals the real ReserveSlotSheet, already open. It is pushed even when "There are no open dates left on this train." (`SupportTrainDetailViewModel.kt:129-137`).
- **Evidence:** The host's `onSignUp` navigates to a placeholder while the screen also opens the sheet.
- **Fix (reuse):** Make the host's `onSignUp` a no-op, as iOS does (`I/Features/Root/HubTabRoot.swift:2399-2403`).
- **Backend change:** none

#### C-17 · Pulse and Tasks filter taps made during a load are ignored
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** Nearby → Pulse or Tasks → tap a chip, category, sort or filter while the first page is loading.
- **Where:** `I/Features/Feed/PulseFeedViewModel.swift:241-245`; `I/Features/Feed/PulseFeedViewModel.swift:549-552`; `I/Features/Gigs/GigsFeedViewModel.swift:340`; `A/ui/screens/feed/pulse/PulseFeedViewModel.kt:787`; `A/ui/screens/gigs/GigsFeedViewModel.kt:575`
- **What the user sees:** The new chip shows as selected but the list keeps the old results; no refetch happens.
- **Evidence:** The filter is saved but the reload is skipped because a load is already running (Android `if (loading) return`).
- **Fix (reuse):** Cancel and restart the request on a filter change, as Marketplace does (`I/Features/Marketplace/MarketplaceViewModel.swift:117-128`; Android Marketplace uses a generation counter).
- **Backend change:** none
- **Other clients / notes:** Owner note: Tasks is Stream 1; Pulse is unassigned.

#### C-18 · A post deleted from its detail screen stays in the feed
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** Nearby → Pulse → your post → ⋯ → Delete post → confirm.
- **Where:** `I/Features/Posts/PulsePostDetailViewModel.swift:294-305`; `I/Features/Feed/PulseFeedViewModel.swift:214-217`
- **What the user sees:** Back returns to a feed that still lists the post; tapping it shows "We couldn't find this post." My posts is stale too.
- **Evidence:** Only the composer posts `PulsePostsRefresh.notifyPostsDidChange()` (`PulseComposeViewModel.swift:768, 776`); the feed listens (`FeedView.swift:171-173`) but `load()` exits early once loaded.
- **Fix (reuse):** Post the notification after delete and after comment add/delete, and let the feed reload.
- **Backend change:** none

#### C-19 · Post detail shows "Post not found" for any failure, with no retry
- **Clients:** Web · **Severity:** misleading
- **How the user gets there:** A post link from the feed or a notification (`W/lib/notificationRoutes.ts` maps `/posts/<id>` to `/app/feed/post/<id>`).
- **Where:** `W/app/(app)/app/feed/post/[id]/page.tsx:74-90`; `W/app/(app)/app/feed/post/[id]/page.tsx:342-356`
- **What the user sees:** "Post not found" even when only the comments call failed.
- **Evidence:** Post and comments load in one `Promise.all`; any rejection renders not-found.
- **Fix (reuse):** Use `Promise.allSettled`; show not-found only for a 404 and `ErrorState` with retry otherwise.
- **Backend change:** none

#### C-20 · Drawer "My Listings" opens everyone's marketplace
- **Clients:** iOS · **Severity:** misleading
- **How the user gets there:** Hub ☰ menu → "My Listings".
- **Where:** `I/Features/Root/HubTabRoot.swift:781`
- **What the user sees:** The Marketplace browse grid, not the user's listings.
- **Evidence:** `case .myListings: return .marketplace`.
- **Fix (reuse):** Add a Hub route to the existing `MyListingsView` (already used by the You stack, `I/Features/Root/YouTabRoot.swift:2166`).
- **Backend change:** none
- **Other clients / notes:** Android is correct (RTS:6210 → MY_LISTINGS); web has `/app/my-listings`.

#### C-21 · "Share invite" can share a fake code when the invite-code call fails
- **Clients:** iOS, Android · **Severity:** misleading
- **How the user gets there:** You → Personal → Share invite.
- **Where:** `I/Features/Me/MeViewModel.swift:67`; `A/ui/screens/you/me/MeViewModel.kt:78`
- **What the user sees:** A link to `https://pantopus.com/join/INVITE`.
- **Evidence:** Both fall back to the literal code `INVITE`.
- **Fix (reuse):** Hide or disable the share action until a real code has loaded.
- **Backend change:** none

### Coordinator · weak (13)

#### C-22 · The placeholder screen itself: "this tab" copy, no way forward, raw ids in the headline
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** Every reachable placeholder push (C-02..C-05, C-07..C-09 and items in each stream).
- **Where:** `A/ui/screens/root/NotYetAvailableView.kt:36-41`; `RTS:5395-5407`; `I/Features/Root/NotYetAvailableView.swift:36-44`
- **What the user sees:** "<label> isn't here yet / We're still designing this tab. Check back soon." with no button. Android has no top bar or in-screen Back (system Back only). iOS inside Settings renders `path.last` with no back inside Settings (`I/Features/Settings/SettingsView.swift:75-80`). Headlines leak data: "Train analytics · <uuid>", "Edit dates · <uuid>", "$12.50 ready".
- **Evidence:** Android: 54 `ChildRoutes.placeholder(` call sites, 28 reachable (8 in normal flows, 20 conditional). iOS: 82 `.placeholder(label:)` sites, 36 reachable (4 only by deep link).
- **Fix (reuse):** Remove the reachable call sites (the items that reference this one). As a stopgap, wrap the Android placeholder in the shared back top bar and stop putting ids in labels.
- **Backend change:** none

#### C-23 · Backend reasons are hidden behind generic copy (systemic)
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Any web handler written as `err instanceof Error ? err.message : '<fallback>'`.
- **Where:** `P/client.ts:803-817`; `W/hooks/useFeedData.ts:344`; `W/app/(app)/app/chat/page.tsx:261`
- **What the user sees:** "Failed to post" instead of "Business posting limit reached…" (`B/routes/posts.js:1079`); "Unable to start chat" instead of "Unable to message this user"; "Failed to create business" (S3-01).
- **Evidence:** The client rejects plain objects, so `instanceof Error` is false. 260 such sites remain in 143 web files on 4f2983c5d (#277 fixed the gig-detail ones).
- **Fix (reuse):** Use `getErrorMessage(err, fallback)` from `@pantopus/utils` (reads plain objects since #277) or `extractApiError` (`frontend/packages/ui-utils/src/auth-form.ts:48`). Pair with the backend raw-message cleanup (`/private/tmp/pantopus-coord-schema/raw-error-message-sites.txt`), because showing API text more widely also shows raw ones (S1-21).
- **Backend change:** none (backend cleanup tracked separately)

#### C-24 · 4xx errors are retried twice before any error state
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Every react-query load that fails with 403, 404 or 429.
- **Where:** `W/lib/query-provider.tsx:13-17`; `P/client.ts:806`
- **What the user sees:** About 3 s of extra skeleton and 3 requests per failure.
- **Evidence:** The retry guard reads `error.status`; the client rejects with `statusCode`.
- **Fix (reuse):** Read `statusCode ?? status`.
- **Backend change:** none

#### C-25 · No offline state on the main screens
- **Clients:** Web, Android · **Severity:** weak
- **How the user gets there:** Any main screen while offline.
- **Where:** `W/components/map/BaseMap.tsx:11`; `W/components/map/BaseMap.tsx:164`; `A/ui/components/OfflineBanner.kt:109`
- **What the user sees:** Web: skeletons spin (react-query pauses offline queries) or screens fall into the misleading empty states listed elsewhere. Android: a full-screen "Can't reach Pantopus. Check your connection." or silently stale data.
- **Evidence:** Web's `useOnlineStatus`/`OfflineIndicator` are mounted only in the map. Android's `OfflineBannerHost` is used by 10 low-traffic screens (e.g. `A/ui/screens/mailbox/community/CommunityMailScreen.kt:96`); the Hub, Place, Today, Pulse, Tasks, Mail, Messages, thread, Notifications and business profile have none.
- **Fix (reuse):** Mount the existing indicator in `W/components/AppShell.tsx`; wrap the Android screens in `OfflineBannerHost(isOffline = !networkMonitor.isOnline)`.
- **Backend change:** none
- **Other clients / notes:** iOS puts `.offlineBanner` on 143 views.

#### C-26 · A failed refresh wipes content that was already on screen
- **Clients:** iOS · **Severity:** weak
- **How the user gets there:** Pull-to-refresh, or return to a screen, while offline or during a server error.
- **Where:** `I/Features/Hub/HubViewModel.swift:153-157`; `I/Features/Place/PlaceDashboardViewModel.swift:99-103`; `I/Features/Feed/PulseFeedViewModel.swift:573-576`; `I/Features/Chat/ChatListViewModel.swift:133-135`; `I/Features/Mailbox/MailboxRoot/MailboxRootViewModel.swift:421-425`
- **What the user sees:** A full-screen "Couldn't load…" under the offline banner "You're offline. Showing last known data." (now untrue). After a successful bid or comment, a failed reload shows the error screen behind the success toast (`GigDetailViewModel.swift:353-357, 1407`; `PulsePostDetailViewModel.swift:286, 400, 418-424`). Marketplace does this on every return (`MarketplaceView.swift:58-61`).
- **Evidence:** Refresh failures replace the loaded state with `.error`.
- **Fix (reuse):** Keep loaded content and toast the failure, as the chat thread does (`I/Features/Chat/Conversation/ChatConversationViewModel.swift:577-589, 1444-1450`).
- **Backend change:** none

#### C-27 · Settings → "Log out" signs out without asking
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** Hub ☰ menu → Settings → Log out.
- **Where:** `I/Features/Settings/SettingsViewModels.swift:250-252`; `A/ui/screens/settings/SettingsViewModels.kt:153-158`
- **What the user sees:** Immediate sign-out.
- **Evidence:** The row passes the tap straight through; the You screen asks "Sign out of Pantopus?" first.
- **Fix (reuse):** Reuse the You screen's confirmation (`I/Features/Root/YouTabRoot.swift:465-476`; `A/ui/screens/you/YouScreen.kt:253-272`).
- **Backend change:** none

#### C-28 · After one failed lookup the Place tab lands on the Hub for the rest of the session
- **Clients:** iOS, Android · **Severity:** weak
- **How the user gets there:** A resident opens the app offline or on a bad connection → Place tab.
- **Where:** `I/Features/Root/HubTabRoot.swift:673-677`; `I/Features/Root/HubTabRoot.swift:3120-3126`; `A/ui/screens/place/HomeTabHostViewModel.kt:36-38`; `A/ui/screens/place/HomeTabHostViewModel.kt:57`
- **What the user sees:** The Hub (the no-home screen) instead of their Place dashboard until restart.
- **Evidence:** The failure is swallowed and the one-shot resolve is marked done anyway (Android resolves only at startup).
- **Fix (reuse):** Only mark it done on success; show an error with Retry. iOS Today already retries correctly (`I/Features/Place/Detail/AddressTodayTabView.swift:122-140`).
- **Backend change:** none
- **Other clients / notes:** Owner note: the destination is Stream 2's Place dashboard.

#### C-29 · Switching Mail between Mailbox and Messages throws away the open screen and any unsent reply
- **Clients:** iOS · **Severity:** weak
- **How the user gets there:** Mail → Messages → a conversation (type a reply) → Mailbox → Messages.
- **Where:** `I/Features/Root/RootTabView.swift:310-328`
- **What the user sees:** Back on the conversation list; the conversation and draft are gone. The Mailbox/Messages switch stays visible above every pushed screen.
- **Evidence:** Switching segments swaps one navigation stack for the other.
- **Fix (reuse):** Keep both stacks alive (or store their paths in `MailTabStore`) and hide the switch below the root.
- **Backend change:** none

#### C-30 · Nearby's Pulse, Tasks and Marketplace sheets have no close button
- **Clients:** iOS · **Severity:** weak
- **How the user gets there:** Nearby → Pulse, Tasks or Marketplace.
- **Where:** `I/Features/Root/NeighborhoodTabRoot.swift:45-47`; `I/Features/Feed/FeedView.swift:261-268`
- **What the user sees:** A full-height sheet with no close button or grab handle; swiping down is the only way out.
- **Evidence:** `PulseTabRoot.swift:42`, `TasksTabRoot.swift:68` and `MarketplaceTabRoot.swift:50` pass `onBack: nil`.
- **Fix (reuse):** Pass `onBack: { presentedSurface = nil }` to each, or show the grab handle.
- **Backend change:** none

#### C-31 · Comments and post actions: delete has no confirm, Cmd/Ctrl+Enter can post twice, several actions give no feedback
- **Clients:** Web · **Severity:** weak
- **How the user gets there:** Feed or post detail → comment thread; post card menu.
- **Where:** `W/components/feed/CommentThread.tsx:95-113`; `W/components/feed/CommentThread.tsx:268-275`; `W/components/feed/PostCard.tsx:461-463`; `W/components/feed/PostCard.tsx:473-500`
- **What the user sees:** Comment delete is one click; a second shortcut press posts a duplicate (only the button checks `isPosting`, `:436`); desktop Share copies silently; "Mark Solved" and "Not helpful" swallow failures; a failed like silently reverts (`W/hooks/useFeedData.ts:367-369`).
- **Evidence:** No confirm or guard in the handlers.
- **Fix (reuse):** `confirmStore.open({ variant: 'destructive' })` as `PostCard.tsx:224` does for posts; `if (isPosting) return;` in `handleSubmit`; toasts for the rest.
- **Backend change:** none

#### C-32 · Opening a deleted post: error screen with no top bar, and success toasts shown in red
- **Clients:** Android · **Severity:** weak
- **How the user gets there:** A notification or link to a deleted post.
- **Where:** `A/ui/screens/posts/PulsePostDetailScreen.kt:126`; `A/ui/screens/posts/PulsePostDetailScreen.kt:443-453`; `A/ui/screens/posts/PulsePostDetailScreen.kt:170`
- **What the user sees:** "Couldn't load this post / We couldn't find this post." with only "Try again" (which keeps failing) and no Back; "Report submitted" appears in error red (`PulsePostDetailViewModel.kt:330`).
- **Evidence:** The loading state has a top bar (`:421`), the error state doesn't; the toast host uses one colour.
- **Fix (reuse):** Wrap the error in `ContentDetailTopBar`, offer Back for not-found, tint toasts by kind.
- **Backend change:** none

#### C-33 · Pull-to-refresh probably does nothing on empty lists built on the shared list screen (verify on a device)
- **Clients:** Android · **Severity:** weak
- **How the user gets there:** Mail drawers, Notifications "All caught up", Blocked users — when empty.
- **Where:** `A/ui/screens/shared/list_of_rows/ListOfRowsScreen.kt:229-241`; `A/ui/components/EmptyState.kt:55-62`
- **What the user sees:** Pulling down likely does nothing.
- **Evidence:** Pull-to-refresh wraps a non-scrollable `EmptyState`; Compose only refreshes when a scrollable child passes the scroll. Inferred from code.
- **Fix (reuse):** Make the empty and error states scrollable inside `ListOfRowsScreen`.
- **Backend change:** none

#### C-34 · The first-run Hub reloads to a skeleton on every return
- **Clients:** iOS · **Severity:** weak
- **How the user gets there:** A user with no Home → Hub → open anything → Back (or switch tabs and return).
- **Where:** `I/Features/Hub/HubViewModel.swift:59-62`; `I/Features/Hub/HubView.swift:42`
- **What the user sees:** A skeleton and five requests every time.
- **Evidence:** `load()` skips reloads only for the populated Hub.
- **Fix (reuse):** Skip the reload for the first-run Hub too.
- **Backend change:** none

### Coordinator · cosmetic (3)

#### C-35 · Jump back in labels ("In progress · Post a Task", "Draft · Messages") are assigned by position
- **Clients:** iOS, Android · **Severity:** cosmetic
- **How the user gets there:** Place → Hub → Jump back in.
- **Where:** `I/Features/Hub/HubViewModel+StatusStrip.swift:132-136`; `A/ui/screens/hub/HubViewModel.kt:362`
- **What the user sees:** Status labels unrelated to the item.
- **Evidence:** `kicker: index == 0 ? "In progress" : "Draft"` (the code comment says the backend carries no kicker).
- **Fix (reuse):** Drop the kicker (web shows none).
- **Backend change:** none

#### C-36 · Hub "Scan mail" chip opens the mailbox list, not the scanner
- **Clients:** Android · **Severity:** cosmetic
- **How the user gets there:** Place → Hub → "Scan mail".
- **Where:** `RTS:2353-2354`
- **What the user sees:** The mailbox root.
- **Evidence:** It navigates to `ChildRoutes.MAILBOX_ROOT`.
- **Fix (reuse):** Navigate to `ChildRoutes.unboxing()` (RTS:1791), which the mailbox's own "Scan an item" menu uses.
- **Backend change:** none

#### C-37 · Settings "Stripe connected" badge can never appear
- **Clients:** iOS · **Severity:** cosmetic
- **How the user gets there:** Hub ☰ → Settings → payments row.
- **Where:** `I/Features/Settings/SettingsViewModels.swift:177-181`
- **What the user sees:** No badge, even when connected.
- **Evidence:** `stripeConnected` (`:39`) is never set in `load()` (`:62-86`).
- **Fix (reuse):** Set it from the payments status or remove the badge.
- **Backend change:** none


## Backend routes that never existed (route-drift status on 4f2983c5d)

I re-ran the coordinator's scanner (`node /private/tmp/pantopus-coord-schema/routes-scan.cjs <snapshot> <out>`) on 4f2983c5d: 1230 routes, 2732 client calls (web 1058, iOS 794, Android 880), **26 missing, 6 method mismatches, 1 shadowed** (was 30 / 7 / 1 on 370751774).
- **Fixed since the coordinator's scan:** `GET /api/mailbox/v2/counter` (now per-drawer `tab=counter`), records create-asset (now `POST /api/homes/:id/assets`, `B/routes/home.js:4045`), Mail Day dismiss, `POST /api/hub/context` and `GET /api/homes/:id/gigs` (#260, #284).
- **Still missing and reachable from UI:** records asset photos (**S2-02**). Stream 2 already owns the others with UI: package condition photo (`W/app/(app)/app/mailbox/[drawer]/[item_id]/page.tsx:160`), map pin → calendar (`W/lib/mailbox-api.ts:636`), landlord notices/settings/staff (`P/endpoints/landlord.ts:208-242`). Not re-listed here.
- **No UI caller (dead client functions, safe to delete later):** `P/endpoints/chat.ts:139-364` (leave, search, mute, pin, archive, unarchive, archived rooms); `P/endpoints/files.ts:149-176` (metadata, `getFile` GET vs DELETE, portfolio reorder); `P/endpoints/users.ts:132` (`updateLocation` PUT); `P/endpoints/magicTask.ts:95` (PUT vs PATCH); `P/endpoints/mailbox.ts:300-393` (ad campaigns; `GET /api/mailbox/campaigns` is shadowed by `GET /api/mailbox/:id`, `B/routes/mailbox.js:1534`); `P/endpoints/homes.ts:323` and `:335`; native listing `unsave` (`I/Core/Networking/Endpoints/ListingsEndpoints.swift:166-167`, `A/data/api/services/ListingsApi.kt:128`) — the backend toggles with POST. The web chat UI shows only Block and Report, no mute/pin/archive/leave/search.
- **False positive:** `POST /api/homes/:id/claim/:claimId/{approve|reject}` (dynamic action segment).
- **Flags:** 147 calls hit routes mounted only behind `IDENTITY_FIREWALL_ENABLED` / `PERSONA_ENABLED` / `PERSONA_BROADCAST_ENABLED`, which default **on** (`B/utils/featureFlags.js:3-7`). On web the Identity, persona and Scheduling navigation default **off in production builds** (`W/lib/featureFlags.ts:13-34`), so web items behind those flags say so.

## Cross-platform parity gaps (one client works, another already has the screen but it's broken or unreachable)

| Feature | Works on | Broken on | Item |
|---|---|---|---|
| Hub status pills and Recent activity links | Web | iOS, Android | C-02, C-03 |
| Listing "Make offer" creates a real offer | Web | iOS, Android | S1-01 |
| Seller reaches offers from their listing | iOS, Android | Web | S1-02 |
| Bid errors explain themselves (payout CTA) | Web | iOS, Android | S1-06 |
| Completion capture has a review/confirm step | Web | iOS, Android | S1-19 |
| Business payouts use the business's Stripe account | iOS, Android | Web | S1-08 |
| Create a business | iOS, Android | Web | S3-01 |
| Business verification document upload | iOS, Android | Web | S3-23 |
| Business scheduling settings rows | iOS, Android | Web | S3-19 |
| Identity Center rows link to their screens | Web | iOS, Android | S3-06 |
| Business Insights / Settings screens | Web | iOS, Android (placeholders) | S3-08 |
| You → Home Documents / Emergency / Privacy / Help / Terms | iOS | Android | C-05 |
| Beacon Updates / Following from You and Settings | Android, iOS Hub stack | iOS You/Settings stacks | S3-13 |
| Blocked-users list merges personal and profile blocks | iOS | Web | S3-43 |
| Today tab separates "failed" from "no home" | iOS | Android | S2-14 |
| Pull-to-refresh on Place dashboard and Messages | iOS | Android | S2-21, S3-56 |
| Offline banner on main screens | iOS | Android, Web | C-25 |
| Drawer "My Listings" | Android | iOS | C-20 |
| Home dashboard "Property details" | Android, iOS Hub stack | iOS You stack | S2-15 |
| Support train "Manage" for organizers | Web | iOS, Android | C-07 |
| Scheduling notification channel manager | Web | iOS (screen exists, not wired), Android (none) | S3-64 |

Web-only features with no native screen at all (not gaps by the definition above, noted for planning): Home **Vendors** (web sidebar `W/components/AppShell.tsx:777` → `W/components/home/VendorsTab.tsx`; backend `B/routes/home.js:3320-3393`); business Catalog / Reviews / Chat / Settings pages. Their native drawer rows exist but can't be reached (see below).

## Already covered by open PRs (not counted as separate items)

- **#251** Android You Help/Terms/Privacy (part of C-05). **#286** native plain server-error copy (C-15). **#257** native notification links for letters, the Mail tab and neighbor messages. **#279** native invoice notification links. **#264** keeps seven other Android gig sheets' errors visible (it does not touch the bid sheet in S1-06). **#280** makes the task-from-mail route work (it does not change the toasts in S2-07). **#199** may overlap S3-50.
- **Merged since 27d45c027 and re-checked as fixed:** #256 (web transport-error copy), #260 (Mail Day dismiss, hub context, homes gigs), #267 (compose modal errors), #272 (Owners/Emergency load failure), #277 (gig-detail error handlers), #284 (Home help card), #231 (Android DM block/report alerts). **#245 merged and caused S3-02.**
- **Unpublished work:** local branch `claude/stream3-native-notification-routes-n01` (commit 31668384e) already routes most of S3-04.

## Honest deferrals (acceptable as they are; not counted)

Calendar sync "coming soon" on the backend's 501 (`B/routes/scheduling.js:1484`; web `W/components/scheduling/event-types/ConnectComingSoon.tsx`, iOS `I/Features/Scheduling/EventTypes/ConnectedCalendars/ConnectedCalendarsViewModel.swift:125`); SMS "coming soon"; data export by email (`I/Features/Settings/DataExport/DataExportView.swift:37`); "Ship nationwide · Coming soon" shown disabled (`I/Features/Compose/ListingCompose/SuggestionsBanner.swift:545`); "Per-member access is coming soon" (`I/Features/Scheduling/Home/Resources/ResourceEditorView.swift:140`); Place detail post-v1 "Coming soon" rows (`W/components/place/detail/TodayDetail.tsx:605`); Home settings "Export … Coming soon" (`W/components/home/settings/HomeSettingsTab.tsx:437-444`); "Government Verified — Coming soon" (`W/app/(app)/app/business/[id]/settings/legal/page.tsx:275`); web `PaidFeatureGate`.

## Dead code and unreachable UI (not user-facing; brief)

- **Android placeholder sites that can't be reached (26):** RTS:2744, RTS:3603, RTS:5332, RTS:5434, RTS:5743, RTS:5869, RTS:5872, RTS:6184, RTS:6325, and all 17 drawer placeholders in RTS:6231-6293 ("Coming soon", "Vendors", business Catalog/Chat/Reviews/Settings): the drawer is always built with `NavigationDrawerContext.Personal` (RTS:2260-2269); Home and Business contexts exist only in previews. Also `A/ui/screens/you/YouScreen.kt:147-181` tile fallbacks (tiles are inert when unbound), `A/ui/screens/shared/content_detail/Bodies.kt:227-253`, `A/ui/screens/shared/content_detail/Headers.kt:113-139`, `A/ui/screens/mailbox/item_detail/bodies/CategoryBodies.kt:25-42`.
- **Android screens with no caller** (their routes render a different composable): `InviteOwnerWizardScreen` (`A/ui/screens/homes/invite_owner/InviteOwnerFormScreen.kt:126`), `MailboxItemDetailScreen` (`A/ui/screens/mailbox/item_detail/MailboxItemDetailScreen.kt:68`; RTS:4036-4044 renders `MailDetailScreen`), `NearbyMapScreen` (`A/ui/screens/nearby/map/NearbyMapScreen.kt:97`), `PostcardVerificationScreen` (`A/ui/screens/homes/verify_landlord/postcard/PostcardVerificationScreen.kt:79`; RTS:6060-6066 renders `HomePostalScreen`), `SlotTakenScreen` (`A/ui/screens/scheduling/invitee/edge/SlotTakenScreen.kt:62`).
- **iOS placeholder sites that can't be reached (46):** You tiles (`I/Features/Root/YouTabRoot.swift:638-709`), `:1216-1222`, `:1623-1629`, `:1708`, `:2000`, `:2228`, `:2514`, `:2522`, `:2544-2552`; Hub drawer mapping (`I/Features/Root/HubTabRoot.swift:800-818`; the drawer is always `.personal`, `:742-747`), `:1158`, `:1176`, `:1284`, `:1609`, `:2449`, `:2861`, `:2951`; `I/Features/Root/TasksTabRoot.swift:365`, `:404-406`; `I/Features/Settings/SettingsView.swift:112`. Views never shown outside previews: `PostcardVerificationView` (`I/Features/Homes/VerifyLandlord/Postcard/PostcardVerificationView.swift:21`), `NotificationChannelManagerView` (S3-64), the `Mailbox/ItemDetail` stack. Latent bug: `I/Features/Root/YouTabRoot.swift:727-728` (`me.connections`) lacks a `return`, but no row uses that key.
- **Web:** "Chat thread not available yet for this gig." (`W/app/(app)/app/gigs/[id]/page.tsx:352-356`) can't show (the backend returns a room or a 500); "Reject bid / Cancel bid endpoint not implemented yet" fallbacks (`W/components/gig-detail/OffersPanel.tsx:101`, `W/components/gig-detail/BidPanel.tsx:147`) can't show (`B/routes/gigs.js:4701`, `:5096` exist); always-false scaffolds (`W/components/scheduling/bookings/ApproveDeclineSheet.tsx:69-71`, the booking-detail conflict "View" at `W/app/(app)/app/scheduling/bookings/[id]/page.tsx:288-308`); pages with no inbound link: `/app/address-verify` (test fixture with fake states), `/app/chat/new` (same `?roomId=` bug as S1-16), `/app/homes/find` (its results link to a missing `/app/homes/<id>/claim-owner`, `W/app/(app)/app/homes/find/page.tsx:82`), `/app/scheduling/business/team-availability`; booklet "Share" (`W/app/(app)/app/mailbox/[drawer]/[item_id]/page.tsx:464`) needs seed-only data.

## Method and limits

- **How:** seven read-only sub-audits (Android, iOS and web placeholders; weak states on each client; native notification routing across all 44 backend link templates), then merged, de-duplicated across clients and routed by owner. Plus my own scans on the snapshot: the route-drift scanner above; a static web link check against the 307 web pages (found S2-01, C-10, S3-27); an orphan-screen scan on both native apps.
- **Verified by reading the code myself:** every top-15 item, and roughly 40 others (for example the business-creation types, the booking link regression, the Hub pill routes, the privacy-overwrite path, the chat send paths, the Home tab strip, the mail action route). All other items come from single-pass code reads by the sub-audits; their `file:line` references were machine-checked on 4f2983c5d, and any claim the auditor couldn't confirm from code says "(from code)" or "(verify on a device)".
- **Not verified:** runtime behaviour on real devices, push delivery, production flag values, and anything that depends on live data. Line numbers can drift as PRs merge after 4f2983c5d.
- **Not audited, by instruction:** free-text search filters.
