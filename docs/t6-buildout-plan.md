# Tier 6 — Buildout Plan of Record

Plan-of-record for the Tier 6 batch of mobile screens. Tier 5 landed 12 list
screens on the shared `ListOfRows` archetype + its additive extension
(`docs/t5-prs/T5-summary.md`). T6 catches up **2 design-drift re-skins**
(Bills, My tasks V2), ships **46 net-new screens** across the 6 sub-tiers
in §1.5 of the brief, sweeps every remaining `NotYetAvailableView`
placeholder, and stands up **two brand-new shared shells** (Mailbox-A17 +
MapListHybrid). Total scope: **58 design files** in the main A08 folder
(46 new + 12 T5-original re-issued; 5 utility files excluded).

This doc is the single source of truth that every later T6 session reads
first.

> **Design source.** Designs cached at `/tmp/t6-designs/A08 — per-screen batch 1/`
> (extracted from the upload in this session). The `Pantopus-MORE-design/`
> subfolder is the T1–T5 archetype gallery — informational only, do not
> diff against it for T5-shipped screens (the T5-shipped designs were
> per-screen frames in the prior batch, not the gallery in MORE).

---

## A. Goal

Close the gap between the 46 new T6 designs and the live iOS / Android /
web apps, and re-skin the 2 T5-original screens whose new designs have
materially drifted (Bills picks up 8 utility-tinted category tiles + 6
status chips + a split-stack avatar row; My tasks V2 picks up the
Magic Task lavender archetype tile + archetype overline + engagement-mode
badge + a 60pt sparkles+plus FAB). Ship iOS + Android in lockstep on the
existing shared shells where possible, extend the shells additively where
required, and stand up the two new shells (Mailbox-A17, MapListHybrid)
where the new designs introduce geometry that the shipped shells cannot
express. Acceptance is `mobile-screen-definition-of-done.md` × two
platforms, plus web parity for every screen with a live web route.

---

## B. Screen inventory (all 58 files)

iOS path under `frontend/apps/ios/Pantopus/Features/`. Android path under
`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/`.
Web path under `frontend/apps/web/src/app/`. Designer target path comes
from each design file's header comment.

| # | Design file | Designer target | Archetype | Frames | Tabs (verbatim) | FAB | Category | iOS today | Android today | Web today |
|---|---|---|---|---|---|---|---|---|---|---|
|  1 | `access-frames.jsx` | `src/app/homes/[id]/access.tsx` | ListOfRows · category-grouped | 2 | (chips) `All / Wi-Fi / Alarm / Gate / Lockbox / Garage` | canonicalCreate (plus, home-green) | T6-new | missing | missing | missing |
|  2 | `audience-frames.jsx` | `src/app/audience` (Creator hub) | Identity / hub composite | 4 | inner `Updates / Fans / Inbox`; root tab bar | none (broadcast via top-right) | T6-new (refresh) | `Features/AudienceProfile` (single profile only) | `ui/screens/audience_profile` (single profile only) | missing |
|  3 | `auth-frames.jsx` | `src/app/auth` (login/signup/recover) | Form (6-frame flow) | 6 (Log in · Create acct · Forgot pw · Reset pw · Verify email · Error) | none | none | T6-new (refresh) | `Features/Auth/LoginView.swift` (login only) | `ui/screens/auth/LoginScreen.kt` (login only) | `/auth` (login only) |
|  4 | `beacon-frames.jsx` | `src/app/beacon/[handle]` (Public Beacon) | ContentDetail (profile) | 4 (Persona visitor · Persona owner · Local visitor · Empty) | inner `Broadcasts / About / Tiers` | none (Follow / Edit in header) | T6-new | missing | missing | missing |
|  5 | `bills-frames.jsx` | `src/app/homes/[id]/bills.tsx` | ListOfRows · tabbed + status chips | 2 | `Open / Paid / All` | **canonicalCreate 60pt** (home-green plus) | **T6.0-reskin** (drift confirmed §C.1) | `Features/Homes/Bills/BillsListView` (T5 — single typeIcon, 4 chips, 52pt) | `ui/screens/homes/bills/BillsListScreen.kt` (T5) | `(app)/app/homes/[id]/bills` (T5) |
|  6 | `booklet.jsx` | `src/app/mailbox/[id]` (A17 Booklet variant) | **Mailbox-A17** Booklet | 1 (mode: page / thumbnail grid) | none | none | T6-new | `Features/Mailbox/ItemDetail/Bodies/CategoryBodies.swift` (fallback only) | `ui/screens/mailbox/item_detail/bodies/CategoryBodies.kt` (fallback) | `(app)/app/mailbox/[id]` (legacy generic) |
|  7 | `calendar-frames.jsx` | `src/app/homes/[id]/calendar.tsx` | ListOfRows · flat-list with month strip | 2 | none (month strip + date sections) | canonicalCreate (plus, home-green) | T6-new | missing | missing | missing |
|  8 | `ceremonial-compose-frames.jsx` | `src/app/mail/compose` (ceremonial) | Wizard (4-step) | 4 (Porch Call · Address It · Write It · Seal & Send) | none | none | T6-new (refresh) | `Features/CeremonialMail/` (T3) | `ui/screens/ceremonial_mail/` (T3) | missing |
|  9 | `ceremonial-mail-frames.jsx` | `src/app/mail/[id]/open` (ceremonial) | ContentDetail · ceremonial | 4 (Porch arrival · Opening · Reading · Reply handoff) | none | none | T6-new (refresh) | `Features/CeremonialMailOpen/` (T3) | `ui/screens/ceremonial_mail_open/` (T3) | missing |
| 10 | `certified.jsx` | `src/app/mailbox/[id]` (A17 Certified variant) | **Mailbox-A17** Certified | 1 (state: open / acknowledged) | none | none | T6-new | placeholder via `Features/Mailbox/ItemDetail` (certified flag, ack endpoint exists) | placeholder via `ui/screens/mailbox/item_detail` | missing |
| 11 | `chat-convo-frames.jsx` | `src/app/chat/[id]` (conversation) | ContentDetail · DM thread | 3 (Populated · Empty new · AI assistant) | none | none (pinned composer) | T6-new (refresh) | `Features/Chat/ChatConversationView` (T2.7) | `ui/screens/inbox/conversation` (T2.7) | `(app)/app/chat/[id]` |
| 12 | `chat-frames.jsx` | `src/app/chat` (list tab) | ListOfRows · tabbed | 3 (Populated · Empty · Loading) | `All / Unread (3) / Gigs / Market` | none (composer via top-right) | T6-new (refresh) | `Features/Chat/ChatListView` (T2.7 — no inner tabs today) | `ui/screens/inbox/list` (T2.7 — no inner tabs) | `(app)/app/chat` |
| 13 | `community.jsx` | `src/app/mailbox/[id]` (A17 Community variant) | **Mailbox-A17** Community | 1 (state: open / going) | none | none | T6-new | missing | missing | missing |
| 14 | `connections-frames.jsx` | `src/app/connections.tsx` | ListOfRows · avatar-first + search + tabs | 2 | `All (24) / Neighbors (18) / Pending (3)` | canonicalCreate (user-plus) | T5-original (re-issued, no drift) | `Features/Connections` (T5.2.3) | `ui/screens/connections` (T5.2.3) | `(app)/app/connections` |
| 15 | `content-detail-frames.jsx` | demo (`src/app/posts/[id]` / `u/[handle]` / `homes/[id]`) | ContentDetail (A10) | 3 (Post · Profile · Home dashboard) | inner Home: `Overview / Tasks / Bills / Packages / Members / Ownership` | UnifiedFAB (canonicalCreate) | T6-new (refresh / archetype demo) | `Features/Shared/ContentDetail/*` + concrete consumers | `ui/screens/shared/content_detail/*` | n/a (per-feature) |
| 16 | `creatorinbox-frames.jsx` | `src/app/audience/inbox/index.tsx` | ListOfRows · avatar-first + filter chips | 2 | chips `All / Unread / Paid / Free / Tier` | none (creators don't initiate fan DMs) | T6-new | missing | missing | missing |
| 17 | `discover-frames.jsx` | `src/app/discover-businesses.tsx` | ListOfRows · category-grouped + chip strip | 2 | chips `All / Handyman / Cleaning / Pet Care / Plumbing / Tutoring / Childcare / Moving / Lawn Care` | none | T5-original (re-issued, no drift) | `Features/DiscoverBusinesses` (T5.4.2) | `ui/screens/discoverbusinesses` (T5.4.2) | `(app)/app/discover` |
| 18 | `discoverhub-frames.jsx` | `src/app/discover-hub.tsx` | ListOfRows · category-grouped (sections = types) | 2 | chips `People / Businesses / Gigs / Listings` | none | T5-original (re-issued, no drift) | `Features/DiscoverHub` (T5.4.1) | `ui/screens/discoverhub` (T5.4.1) | `(app)/app/discover-hub` |
| 19 | `docs-frames.jsx` | `src/app/homes/[id]/docs.tsx` | ListOfRows · category-grouped + filter chips | 2 | chips `All · 12 / Recent / Expiring / Shared` | canonicalCreate (upload-cloud, home-green) | T6-new | missing | missing | missing |
| 20 | `emergency-frames.jsx` | `src/app/homes/[id]/emergency.tsx` | ListOfRows · category-grouped + Pinned section | 2 | none (category sections) | canonicalCreate (plus, home-green) | T6-new | missing | missing | missing |
| 21 | `form-frames.jsx` | `src/app/_form` (archetype demo) | Form | 3 (Simple Send invite · Multi-section Edit profile · Field-heavy Disambiguate) | none | none (sticky CTA) | T6-new (archetype demo) | `Features/Shared/Form/*` | `ui/screens/shared/form/*` | n/a |
| 22 | `gigs-frames.jsx` | `src/app/gigs` (browse tab) | ListOfRows · Gigs tab | 3 (Populated · Empty · Loading) | `All / Posted / Bidding / Booked` (root tabs) | canonicalCreate (plus) | T6-new (refresh) | `Features/Gigs/GigsFeedView` (T2.3) | `ui/screens/gigs/GigsFeedScreen.kt` (T2.3) | `(app)/app/gigs` |
| 23 | `handshake-frames.jsx` | `src/app/handshake` (Privacy Handshake) | Wizard (4-step) | 4 (Handle · Tier select · Stripe handoff · Already following) | none | none | T6-new (refresh) | `Features/PrivacyHandshake/` (T3.4) | `ui/screens/handshake/` (T3.4) | missing |
| 24 | `householdtasks-frames.jsx` | `src/app/homes/[id]/tasks.tsx` | ListOfRows · tabbed + status chips | 2 | `Active / Done / Recurring` | canonicalCreate (plus, home-green) | T6-new | missing | missing | missing |
| 25 | `hub-frames.jsx` | `src/app/(tabs)/index.tsx` (Hub) | Hub composite (action strip, pillar grid) | 3 (Populated · First-run · Skeleton) | root tab bar `Hub / Nearby / Inbox (3) / You` | none (UnifiedFAB hidden) | T6-new (Tier-1 refresh) | `Features/Hub/HubView` (T1.1) | `ui/screens/hub/HubScreen.kt` (T1.1) | `(app)/app/hub` |
| 26 | `identity-center-frames.jsx` | `src/app/identity` (Identity Center) | Identity composite | 3 (Personal · Home · Business) | inner identity switcher | none | T6-new (refresh) | `Features/IdentityCenter/` (T3.2) | `ui/screens/identity_center/` (T3.2) | missing |
| 27 | `legal-frames.jsx` | `src/app/legal/privacy` (or `/terms`) | Legal / static long-form | 1 (TOC + scroll + back-to-top) | none | none | T6-new (refresh) | missing / placeholder | missing / placeholder | missing |
| 28 | `listingoffers-frames.jsx` | `src/app/listing-offers.tsx` | ListOfRows · flat (no tabs) | 2 | none | none | T5-original (re-issued, no drift) | `Features/ListingOffers` (T5.3.4) | `ui/screens/listing_offers` (T5.3.4) | `(app)/app/listing-offers` |
| 29 | `mail-detail.jsx` | `src/app/mailbox/[id]` (A17 generic) | **Mailbox-A17** generic | 1 (state: open / acknowledged) | none | none | T6-new | `Features/Mailbox/ItemDetail/MailboxItemDetailView` (legacy generic) | `ui/screens/mailbox/item_detail/` (legacy) | `(app)/app/mailbox/[id]` (legacy) |
| 30 | `mailbox-frames.jsx` | `src/app/mailbox/[id]` (A17 archetype showcase) | **Mailbox-A17** showcase | 4 (Package · Coupon · Booklet · Certified) | none (variant gallery) | none (sticky bottom CTAs) | T6-new (archetype demo) | n/a (gallery) | n/a | n/a |
| 31 | `mailbox.jsx` | `src/app/mailbox` (root, A17 inbox) | **Mailbox-A17** root inbox | 1 (parameterised drawer × tab × mode) | drawer pills `Me (5) / Home (3) / Biz (12) / Earn (0)`; inner `Incoming (14) / Counter (3) / Vault` | **new magicCreate** (scan-line, primary-600 disc — magic ingest) | T6-new (Tier-1 refresh of Mailbox list) | `Features/Mailbox/MailboxListView` (T1.3 — single tabs `All / Unread / Starred`, no drawer pills) | `ui/screens/mailbox/MailboxListScreen.kt` (T1.3) | `(app)/app/mailbox` |
| 32 | `maintenance-frames.jsx` | `src/app/homes/[id]/maintenance.tsx` | ListOfRows · tabbed + status chips | 2 | `Scheduled / Completed / All` | canonicalCreate (plus, home-green) | T6-new | missing | missing | missing |
| 33 | `map-frames.jsx` | `src/app/(tabs)/nearby` (WorldMap+List) | **MapListHybrid** | 3 (sheet 40% default · 20% collapsed · 70% expanded) | inner category chips (overlay) | none (map controls float) | T6-new (Tier-2 refresh of Nearby map) | `Features/Nearby/NearbyMapView` (T2.4 — list+map split, no sheet detents) | `ui/screens/nearby/NearbyMapScreen.kt` (T2.4) | `(app)/app/map` |
| 34 | `marketplace-frames.jsx` | `src/app/marketplace` (Market tab) | ListOfRows / Feed hybrid | 3 (Populated · Empty · Loading) | root tabs; inner category row | secondaryCreate (camera, business violet — Snap-to-list) | T6-new (refresh) | `Features/Marketplace/MarketplaceView` (T2.5) | `ui/screens/marketplace/MarketplaceScreen.kt` (T2.5) | `(app)/app/marketplace` |
| 35 | `me-frames.jsx` | `src/app/me` (Me / self tab) | Identity (Me profile) | 2 (Personal identity · Home identity) | inner identity switcher | none (Edit profile via header) | T6-new (refresh) | `Features/Me/MeView` (T2.1) | `ui/screens/you/MeScreen` (T2.1) | `(app)/app/profile` (closest) |
| 36 | `members-frames.jsx` | `src/app/homes/[id]/members/index.tsx` | ListOfRows · tabbed + status chips | 2 | `Members / Guests / Pending` | canonicalCreate (plus, home-green) | T6-new | missing | missing | missing |
| 37 | `mybids-frames.jsx` | `src/app/my-bids.tsx` | ListOfRows · tabbed + status chips + footers | 2 | `Active / Accepted / Rejected / Completed` | extendedNav `Browse tasks` (48pt pill) | T5-original (re-issued, no drift) | `Features/MyBids` (T5.3.1) | `ui/screens/my_bids` (T5.3.1) | `(app)/app/my-bids` |
| 38 | `mybusinesses-frames.jsx` | `src/app/businesses/index.tsx` | ListOfRows · avatar-first (no tabs) | 2 | none | canonicalCreate (building-plus, business-violet) | T6-new | missing | missing | `(app)/app/businesses` (search/discovery only) |
| 39 | `myhomes-frames.jsx` | `src/app/homes/index.tsx` | ListOfRows · avatar-first (no tabs) | 2 | none | canonicalCreate (plus, home-green) | T6-new (refresh) | `Features/Homes/MyHomesListView` (T1.4 — simpler row) | `ui/screens/homes/MyHomesListScreen` (T1.4) | `(app)/app/homes` |
| 40 | `mylistings-frames.jsx` | `src/app/my-listings.tsx` | ListOfRows · tabbed + status chips | 2 | `Active / Sold / Drafts` | secondaryCreate `SNAP` (camera) | T6-new | missing | missing | `(app)/app/my-listings` |
| 41 | `myposts-frames.jsx` | `src/app/my-pulse.tsx` | ListOfRows · headerChips + engagement | 2 | `Active (4) / Archived (11)` | secondaryCreate (pen-line) | T5-original (re-issued, no drift) | `Features/MyPosts` (T5.3.3) | `ui/screens/my_posts` (T5.3.3) | `(app)/app/my-pulse` |
| 42 | `mytasks-frames.jsx` | `src/app/my-gigs-v2.tsx` (V2 canonical) | ListOfRows · tabbed + status chips + **Magic chrome** | 2 | `Open / In progress / Completed / Closed` (poster side) | **new magicCreate 60pt** (sparkles+plus, primary600→primary700 gradient) | **T6.0-reskin** (drift confirmed §C.2) | `Features/MyTasks` (T5.3.2 — no magic chrome) | `ui/screens/my_tasks` (T5.3.2) | `(app)/app/my-gigs` (T5.3.2) |
| 43 | `newmessage-frames.jsx` | `src/app/chat/new.tsx` | ListOfRows · category-grouped (sections = Connections / Recent / All verified) | 2 | none (search + sections) | none (pick-a-contact IS the primary action) | T6-new | placeholder via `InboxTabRoot` | placeholder via `RootTabScreen` | missing |
| 44 | `notifications-frames.jsx` | `src/app/notifications.tsx` | ListOfRows · tabbed | 2 | `All (12) / Unread (4)` | none | T5-original (re-issued, no drift) | `Features/Notifications` (T5.1) | `ui/screens/notifications` (T5.1) | `(app)/app/notifications` |
| 45 | `offers-frames.jsx` | `src/app/offers.tsx` | ListOfRows · tabbed + status chips | 2 | `Received (5) / Sent (3)` | none | T5-original (re-issued, no drift) | `Features/Offers` (T5.2.4) | `ui/screens/offers` (T5.2.4) | `(app)/app/offers` |
| 46 | `owners-frames.jsx` | `src/app/homes/[id]/owners/index.tsx` | ListOfRows · avatar-first (no tabs) | 2 | none | canonicalCreate (plus, home-green) | T6-new | partial (`Features/Homes/InviteOwner` form exists) | partial (`ui/screens/homes/invite_owner`) | missing |
| 47 | `packages-frames.jsx` | `src/app/homes/[id]/packages.tsx` | ListOfRows · tabbed + status chips | 2 | `Expected / Delivered / Archived` | canonicalCreate (plus, home-green) | T6-new | placeholder (Mailbox drawer route) | placeholder | missing |
| 48 | `pets-frames.jsx` | `src/app/homes/[id]/pets.tsx` | ListOfRows · avatar-first (no tabs) | 2 | none | secondaryCreate (plus) | T5-original (re-issued, no drift) | `Features/Homes/Pets` (T5.2.1) | `ui/screens/homes/pets` (T5.2.1) | `(app)/app/homes/[id]/pets` |
| 49 | `polls-frames.jsx` | `src/app/homes/[id]/polls.tsx` | ListOfRows · tabbed + status chips | 2 | `Active / Closed` | canonicalCreate (plus, home-green) | T6-new | missing | missing | missing |
| 50 | `pulse-frames.jsx` | `src/app/(tabs)/pulse` (Pulse feed) | Feed | 3 (Populated · Empty · Loading) | inner chip row (intent filter) | canonicalCreate (compose) | T6-new (refresh) | `Features/Feed/` + `Features/Posts/` (T1.2) | `ui/screens/feed/` + `ui/screens/posts/` (T1.2) | `(app)/app/feed` |
| 51 | `reviewclaims-frames.jsx` | `src/app/admin/review-claims.tsx` | ListOfRows · tabbed + status chips | 2 | `Pending (4) / Approved (38) / Rejected (3)` | none (admin queue) | T5-original (re-issued, no drift; **web only**) | n/a (no admin role on mobile per T5 §F9) | n/a | `(app)/app/admin/review-claims` (T5.4.3) |
| 52 | `reviewsignups-frames.jsx` | `src/app/support-trains/review.tsx` | ListOfRows · avatar-first + filter chips | 2 | chips `All / Pending review / Confirmed / Conflicts / Edited` | none (review actions inline) | T6-new | missing | missing | `(app)/app/support-trains/[id]/review` (partial — see web router) |
| 53 | `settings-frames.jsx` | `src/app/settings` (Settings list) | GroupedList | 3 (Main index · Notifications toggles · Privacy mixed controls) | none | none | T6-new (refresh) | `Features/Settings/` (T3.1 — 8 sub-routes placeholder) | `ui/screens/settings/` (T3.1) | `(app)/app/settings` |
| 54 | `status-frames.jsx` | `src/app/_status` (Status / Waiting) | other (Status / Waiting) | 3 (Submit confirmation · Persistent waiting · Verify email sent) | none | none | T6-new (refresh) | `Features/Status/` (T3.6) | `ui/screens/status/` (T3.6) | n/a |
| 55 | `supporttrains-frames.jsx` | `src/app/support-trains/list.tsx` | ListOfRows · tabbed + status chips | 2 | `My trains / Nearby / Invitations` | extendedNav `Start a train` (48pt pill) | T6-new | missing | missing | `(app)/app/support-trains` |
| 56 | `token-accept-frames.jsx` | `src/app/invite/[token]` (Token Accept) | Form (acceptance) | 3 (Home invite · Business seat invite · Guest pass) | none | none | T6-new (refresh) | `Features/TokenAccept/` (T3.5) | `ui/screens/token_accept/` (T3.5) | missing |
| 57 | `tx-frames.jsx` | `src/app/gigs/[id]` · `listings/[id]` · `invoices/[id]` (Transactional Detail) | ContentDetail (bespoke transactional) | 3 (Gig · Listing · Invoice detail) | none | none (sticky transact CTA) | T6-new (refresh — bespoke shell) | `Features/ContentDetail/` (T2.6) | `ui/screens/contentdetail/` (T2.6) | per-feature |
| 58 | `vault-frames.jsx` | `src/app/mailbox/vault.tsx` | ListOfRows · flat list + folders grid | 2 (list · folders grid) | none (search + folders) | secondaryCreate (folder-plus, primary sky) | T6-new | missing | missing | missing |

Utility files in main folder (excluded): `design-canvas.jsx`,
`design-canvas 2.jsx`, `frames.jsx`, `ios-frame.jsx`, `ios-frame 2.jsx`
(macOS Finder duplicates for the `2` files).

---

## C. T5-original drift analysis

10 of 12 T5-original re-issued designs match what shipped — no drift,
no re-skin PR needed. Only **Bills** and **My tasks V2** drifted, and
they drifted hard. Both warrant a dedicated T6.0 re-skin PR.

### C.1 Bills — drift confirmed (T6.0-reskin)

Shipped today (T5.2.2): single `typeIcon` (receipt) leading + 4 status
chips (`due / overdue / paid / scheduled`) + 52pt `secondaryCreate` FAB
(home-green plus). Source: `bills-frames.jsx:9` (T5-shipped state in
`docs/mobile-parity-audit.md` row "Bills list").

New design (T6.0): **8 utility-tinted category tiles** + **6 status chips**
(`due / dueSoon / overdue / scheduled / paid / cancelled`) + **SplitStack**
avatar row (re-using BidderStack vocabulary, 22pt overlapping avatars at
the right edge of the chip row for split-bill members) + **60pt FAB with
home-green gradient** (instead of 52pt solid).

The new utility tiles use these category tokens (from
`bills-frames.jsx:53-62`):

| Key | Icon | bg | fg |
|---|---|---|---|
| `electric` | zap | `#fef9c3` | `#a16207` |
| `gas` | flame | `#ffedd5` | `#c2410c` |
| `water` | droplet | `#dbeafe` | `#1d4ed8` |
| `internet` | wifi | `#ede9fe` | `#6d28d9` |
| `hoa` | building-2 | `#dcfce7` | `#15803d` |
| `insurance` | shield-check | `#ccfbf1` | `#0f766e` |
| `trash` | trash-2 | `#e2e8f0` | `#334155` |
| `phone` | smartphone | `#fee2e2` | `#b91c1c` |
| `generic` | receipt | `primary50` | `primary600` |

Backend status (`backend/database/schema.sql:6189`): the `HomeBill.bill_type`
enum already carries 7 of 8: `electric, gas, water, sewer, trash, internet,
cable, hoa, insurance, mortgage, rent, subscription, other`. Missing:
**`phone`**. Adding it is a one-line constraint migration. **No client-side
inference is needed** — `bill_type` IS the category field (no separate
`category` column, but the existing enum is the category).

Drift summary: chip-status enum (add `dueSoon`, `cancelled`),
`bill_type` → utility tile (8 categories), `SplitStack` (reuse
`BidderStack` from T5.0), `RowTrailing.amountWithChip` already covers the
amount + chip stack, FAB diameter 52→60.

### C.2 My tasks V2 — drift confirmed (T6.0-reskin) + iOS-zero Magic Task

Shipped today (T5.3.2): `categoryGradientIcon` 40pt leading + 9-status chip
+ inline `BidderStack` on chip line + per-status footer + 56pt
`canonicalCreate` FAB (solid sky primary600 plus). Source:
`docs/mobile-parity-audit.md` "My tasks V2".

New design (T6.0): **44pt `magicArchetypeTile`** (gradient + white glyph +
position-absolute 18pt white disc with lavender sparkles overlay at
`top:-3, right:-3`) + **archetype overline** (9.5pt lavender uppercase,
sits above the title) + **`ModeBadge`** rounded-square engagement-mode
chip (in_person / drop_off / remote / hybrid) inline after the status chip
+ **60pt `magicCreate` FAB** (gradient primary600→primary700 with 18pt
white disc + lavender sparkles at `top:8, right:8`).

Tokens introduced by the design: `magicBg = #ede9fe`, `magicBgSoft = #f5f3ff`,
`magic = #6d28d9`, `magicBorder = #ddd6fe`.

Magic Task today on iOS: **ZERO references** (per Agent 4 sweep). No
DTOs, no endpoints helper, no view-model, no composer. "Post a task"
FAB → `placeholder(label: "Post a task")` route (`YouTabRoot.swift:365`).
Backend is fully real: 11 routes in `backend/routes/magicTask.js`
(magic-draft, magic-post, basic-draft, undo, templates library, saved
templates CRUD, magic-settings). Backend `Gig` row carries
`task_archetype` (`magicTask.js:87-90`: 9 values — `quick_help,
delivery_errand, home_service, pro_service_quote, care_task, event_shift,
remote_task, recurring_service, general`) and `engagement_mode` —
**but the backend's `engagement_mode` enum is `instant_accept |
curated_offers | quotes`**, which is DIFFERENT from the design's
`in_person | drop_off | remote | hybrid`. Two different enums sharing a
name. See §H (open question H.13).

Drift summary: 4 new shell constructs needed, of which 3 are additive
extensions and 1 is a brand-new FAB variant. None can ship until iOS
Magic Task plumbing exists.

### C.3 Other 10 T5-originals — no drift

`connections-frames.jsx`, `discover-frames.jsx`, `discoverhub-frames.jsx`,
`listingoffers-frames.jsx`, `mybids-frames.jsx`, `myposts-frames.jsx`,
`notifications-frames.jsx`, `offers-frames.jsx`, `pets-frames.jsx`,
`reviewclaims-frames.jsx` — header comments, tab labels, FAB variants,
row anatomies all match the T5-shipped state on iOS / Android / web per
`docs/mobile-parity-audit.md` and `docs/t5-prs/T5-summary.md`. No re-skin
PRs required.

---

## D. T6-new sub-tier buckets

46 T6-new screens grouped into the 6 sub-tiers from the brief, plus a
seventh "P6.0 prereq" bucket for the shell extensions, Magic Task
plumbing, and backend prep. Sub-tier letters mirror the
prompt-sequence labels.

### Tier 6.0 — Prereq shell + backend (lands before any feature PR)

- **T6.0a** shell extensions (Mailbox-A17 shell, MapListHybrid shell,
  Bills utility leading + split-stack + 60pt FAB extension, My tasks V2
  magic chrome additions, settings GroupedList sub-route wiring,
  `magicCreate` FAB variant).
- **T6.0b** theme tokens (`magic` lavender quartet, `cat-*` utility
  category tokens, A17 accents).
- **T6.0c** backend prep — see §G (Maintenance routes, `phone` to
  `bill_type` enum, `ceremonial` to mail enum, `nextPillarEvent` /
  `outstandingMail` shape on `/api/hub`, Documents/Emergencies PATCH/DELETE).
- **T6.0d** iOS Magic Task plumbing (endpoints helper, DTOs, settings
  store, composer screen that the FAB actually opens; mirror on Android).

### Tier 6.P3–P5 — Auth (3 PRs)

- **P3** Auth — Login refresh + Create account form (auth-frames.jsx
  frames 1–2). Uses existing `Features/Auth/LoginView` as a starting
  point; expands to the 6-frame flow.
- **P4** Auth — Forgot password + Reset password (frames 3–4) +
  cross-cutting Error state (frame 6).
- **P5** Auth — Verify email frame 5 + Status/Waiting `Verify email
  sent` (status-frames.jsx frame 3). Wires `POST /api/users/verify-email`
  (real) + `POST /api/users/resend-verification` (real). See §H (H.4)
  for the soft-gate vs hard-gate decision.

### Tier 6.P6–P8 — Redesign refresh (3 PRs)

- **P6** Hub — new top-bar greeting + identity-ring avatar + today-card
  data source (see §H.5 for whether to add a thinner `/api/hub/today-card`
  endpoint vs read from `/api/hub`). Behind feature flag for staged
  rollout (recommended — see §H.12).
- **P7** Me — identity gradient header refresh + 2×3 action grid +
  identity-tinted stat tiles (per §H.6, structurally unchanged; this is
  a re-skin only).
- **P8** Settings — sub-route wiring (per §H.7 — recommendation: wire
  all 8 in this PR). 8 sub-routes today land on `.placeholder(label:)`;
  the design shows Notifications + Privacy as the canonical
  GroupedList examples and the other 6 (Blocked / Password /
  Verification / Data export / Payments & payouts / Help / Legal /
  About) follow the same pattern.

### Tier 6.P9–P15 — Home pillar (7 PRs)

All scoped to `src/app/homes/[id]/*`. Identity tone: home-green.

- **P9** Bills re-skin (per §C.1 — utility tiles, 6 chips, SplitStack,
  60pt FAB).
- **P10** Maintenance (new screen; requires backend prep — see §G.1).
- **P11** Calendar (new screen; uses existing `GET /api/homes/:id/events`).
- **P12** Household tasks (new screen; uses existing `home.js:4170` task
  routes).
- **P13** Documents (new screen; needs PATCH/DELETE backend follow-up —
  see §G.9).
- **P14** Packages (new screen; needs backend split — see §G.9).
- **P15** Polls (new screen; uses existing `home.js:6984` poll routes).

### Tier 6.P16–P18 — Category-grouped + Identity (3 PRs)

- **P16** MyHomes refresh (avatar-first row list re-skin per
  `myhomes-frames.jsx` — adds the 56px address tile + role chip + inline
  stats strip + Current affordance).
- **P17** MyBusinesses (new screen; uses existing
  `businesses.js:682`).
- **P18** MyListings (new screen; uses existing `listings.js:1058`).

### Tier 6.P19–P23 — Mailbox A17 (5 PRs)

- **P19** Mailbox-A17 root shell (`mailbox.jsx`) — replaces the
  `Features/Mailbox/MailboxListView` (T1.3) — drawer pills, Incoming /
  Counter / Vault tabs, magic-ingest FAB.
- **P20** Mailbox-A17 generic detail (`mail-detail.jsx`) — replaces
  `MailboxItemDetailView` (T1.3) with the 8-slot A17 shell.
- **P21** A17 Booklet variant (`booklet.jsx`) — uses existing
  `/api/mailbox/v2/p2/booklet/...` routes.
- **P22** A17 Certified variant (`certified.jsx`) — uses existing
  `/api/mailbox/v2/p2/certified/...` routes.
- **P23** A17 Community variant (`community.jsx`) — uses existing
  `/api/mailbox/v2/p3/community/...` routes. Backend gap:
  `ceremonial-mail` requires NEW backend support per §G.8.

### Tier 6.P24–P26 — Misc + chat + map (3 PRs)

- **P24** New Message (`newmessage-frames.jsx`) — replaces InboxTabRoot
  placeholder. Category-grouped section pattern.
- **P25** Chat refresh (`chat-frames.jsx` + `chat-convo-frames.jsx`) —
  inner tab strip (`All / Unread / Gigs / Market`) + AI assistant
  conversation state.
- **P26** MapListHybrid (`map-frames.jsx`) — replaces `Features/Nearby/NearbyMapView`
  (T2.4) with the 3-detent bottom-sheet pattern.

### Misc / cross-tier (don't fit neatly)

The brief lists 28 prompts; these screens don't fit neatly into the 6
sub-tiers and need explicit placement:

- **Vault** (`vault-frames.jsx`) — Mailbox vault folder list. Sits
  under Mailbox pillar (Personal) not Home. **Place in P19–P23
  (Mailbox A17 sub-tier) as P19.5 — adjacent to the inbox refresh.**
- **Access codes, Emergency info, Owners, Members** (4 home-pillar
  screens that are category-grouped, not tabbed) — **bundled into P9–P15
  (Home pillar) as a follow-on P15.5 sweep PR**, since they each have
  small surface area and consistent home-green styling.
- **Beacon** (`beacon-frames.jsx`) — Public Beacon profile (4-frame
  ContentDetail variant). Identity-adjacent. **Place in P16–P18 as
  P16.5** (sibling to MyBusinesses).
- **Audience refresh** (`audience-frames.jsx`) and **Creator Inbox**
  (`creatorinbox-frames.jsx`) — Creator-side Audience hub. **Place in
  P16–P18 as P17.5**.
- **Support trains** (`supporttrains-frames.jsx`) and **Review signups**
  (`reviewsignups-frames.jsx`) — neighborhood mutual aid, Personal tone.
  Backend at `supportTrains.js` is rich (39 routes). **Place in P24–P26
  as P26.5** (its own sub-tier).
- **Handshake**, **Token Accept**, **Status**, **Legal**, **Identity
  Center**, **Ceremonial Mail**, **Ceremonial Compose**, **Gigs**,
  **Marketplace**, **Pulse**, **Content Detail**, **Tx Detail**, **Form**,
  **Wizard** refresh — these are all light visual refreshes of screens
  that already exist on both platforms and are wired. **Bundle as
  P26.9 — "T6 refresh sweep" PR** unless any one of them drifts as hard
  as Bills/MyTasks (none do — confirmed by reading each header comment).

---

## E. New archetype scope

Two brand-new shared shells.

### E.1 Mailbox-A17 shell

Used by **5 designs**: `mailbox.jsx` (root inbox list), `mail-detail.jsx`
(generic detail), `booklet.jsx` (Booklet variant), `certified.jsx`
(Certified variant), `community.jsx` (Community variant). The 4 detail
variants share an **8-slot** shell where each slot is variant-typed and
can carry per-variant chrome:

| Slot | Role | iOS path (proposed) | Android path (proposed) |
|---|---|---|---|
| `nav` | back chevron + eyebrow (uppercase category) + bookmark / kebab | `Features/Shared/MailboxA17/MailboxA17Nav.swift` | `ui/screens/shared/mailbox_a17/MailboxA17Nav.kt` |
| `hero` | trust chip + category chip + sender + title + reference + acknowledged banner | `MailboxA17Hero.swift` | `MailboxA17Hero.kt` |
| `aiElfStrip` | sparkles + summary + bulleted key points (gradient sky background) | `MailboxA17AiElfStrip.swift` | `MailboxA17AiElfStrip.kt` |
| `keyFacts` | list of icon+label+value items, with optional tags (amount due, pay-by, property) | `MailboxA17KeyFacts.swift` | `MailboxA17KeyFacts.kt` |
| `body` | body card with paragraphs / formatted text | `MailboxA17Body.swift` | `MailboxA17Body.kt` |
| `attachments` | variant-specific (booklet: paginated page strip; certified: chain-of-custody timeline; community: event card + attendee strip; coupon: barcode) | `MailboxA17Attachments.swift` (sealed) | `MailboxA17Attachments.kt` (sealed) |
| `sender` | sender card (avatar + dept + verification kind + proof) | `MailboxA17Sender.swift` | `MailboxA17Sender.kt` |
| `actions` | bottom action button row (acknowledge / save / dismiss / RSVP) | `MailboxA17Actions.swift` | `MailboxA17Actions.kt` |

The shell is a single Swift `MailboxA17Shell<…>` (slots as `@ViewBuilder`
closures) and Kotlin `fun MailboxA17Shell(...)` (slots as `@Composable () -> Unit`)
— same pattern as the existing `ContentDetailShell`. The `attachments`
slot is variant-typed via a sealed `MailboxA17Attachment` enum so each
variant can carry its own payload type.

The shell is justified — none of the existing shells (ContentDetail,
Form, Wizard, GroupedList) can express the 8-slot composition with
variant-typed attachments and the AI elf strip is not a generic slot the
other shells need.

### E.2 MapListHybrid shell

Used by **1 design** today: `map-frames.jsx`. Could later be reused for
Marketplace (gig location) or Discover (business location) if those want
the same pattern. The shell wraps a full-bleed `WorldMap` view + a
bottom sheet with **3 detents**:

| Detent | Sheet height | Behaviour |
|---|---|---|
| Collapsed | 20% | sheet header visible, map fills the rest |
| Default | 40% | sheet shows sort selector + first 2-3 rows + horizontal `GigCard` carousel |
| Expanded | 70% | sheet shows full list, map peek visible at top |

iOS: SwiftUI `.presentationDetents([.height(160), .height(296), .height(518)])`
on a `.sheet`. Android: `BottomSheetScaffold` with three
`SheetValue.PartiallyExpanded` snap points (custom anchors via Material3's
`anchoredDraggableState`).

The shell exposes:
- `topPill` slot (floating back/title/filter pill at the top, blur background)
- `categoryChips` slot (overlay horizontal strip)
- `mapControls` slot (locate-fixed / layers — floating, right edge)
- `sheetHeader` slot (count + sort selector)
- `sheetBody` slot (rows + carousel)

Justified — no existing shell models a map + draggable bottom sheet.

---

## F. Magic Task scope

### F.1 Backend (real, 11 routes — `backend/routes/magicTask.js`)

| Method | Path | File:line | Purpose |
|---|---|---|---|
| GET | `/api/gigs/templates/library` | 324 | Static smart-template chips |
| POST | `/api/gigs/magic-draft` | 333 | **AI draft from free text** (the FAB needs this) |
| POST | `/api/gigs/basic-draft` | 376 | Deterministic-only fallback |
| POST | `/api/gigs/magic-post` | 395 | Create gig from draft (10s undo window) |
| POST | `/api/gigs/:gigId/undo` | 678 | Cancel post within window |
| GET | `/api/gigs/templates/saved` | 739 | User's saved templates |
| POST | `/api/gigs/templates/saved` | 766 | Save a template (max 20/user) |
| DELETE | `/api/gigs/templates/saved/:id` | 808 | Delete saved template |
| POST | `/api/gigs/templates/saved/:id/use` | 835 | Increment use_count |
| GET | `/api/gigs/magic-settings` | 877 | Read instant_post preference |
| PATCH | `/api/gigs/magic-settings` | 907 | Toggle preference |

### F.2 iOS today

Zero references. No `MagicTaskEndpoints.swift`, no DTOs, no view-model,
no composer view. "Post a task" FAB (`YouTabRoot.swift:365`,
`HubTabRoot.swift:481`) lands on `.placeholder(label: "Post a task")`.

### F.3 Design ask vs shipped tokens

| Design construct | Existing token | Verdict |
|---|---|---|
| 44pt sparkles-gradient leading tile | `RowLeading.categoryGradientIcon` (40pt, no clip-overflow) | **NEW** — `RowLeading.magicArchetypeTile(icon:, gradient:)` (44pt + 18pt sparkles disc clipped 3pt outside) |
| Archetype overline ("MOUNT & INSTALL") | `RowModel.headerChips` (renders pills, design wants no chrome) | **NEW field** — `RowModel.archetypeOverline: String?` (9.5pt lavender uppercase, optional sparkle icon prefix) |
| Engagement-mode badge | `RowChip.Tint.custom` (pill-9999 shape, design wants `borderRadius: 6`) | **NEW** — either `RowChip.Shape = .pill / .roundedSquare` OR `RowModel.engagementMode: EngagementMode?` enum field |
| 60pt sparkles+plus gradient FAB | `FabVariant.canonicalCreate` (56pt solid, no gradient, no overlay) | **NEW variant** — `FabVariant.magicCreate` (60pt, gradient primary600→primary700, plus + sparkles-disc overlay) |

The design's `engagement_mode` enum (`in_person | drop_off | remote | hybrid`)
is **different** from the backend's `engagement_mode` enum
(`instant_accept | curated_offers | quotes`). See open question H.13.

### F.4 Sequencing

Magic Task iOS plumbing PR **lands first** (T6.0d), then the My tasks V2
re-skin PR consumes it. Bundling them risks shipping a re-skinned row
with empty `archetypeOverline` + missing `engagementMode` for every gig
posted before Magic Task ships (and 100% of gigs until the iOS composer
lands).

---

## G. Backend endpoint inventory

Every endpoint each T6 screen will call, with `backend/routes/` file:line
where verified. **Missing** rows become backend prep tickets (rolled
into T6.0c).

### G.1 Maintenance — **all routes MISSING**

- `GET /api/homes/:id/maintenance` — MISSING
- `POST /api/homes/:id/maintenance` — MISSING
- `GET /api/homes/:id/maintenance/:id` — MISSING
- `PATCH /api/homes/:id/maintenance/:id` — MISSING

Schema is ready (`HomeMaintenanceLog` + `HomeMaintenanceTemplate` exist
at `backend/database/schema.sql:6402-6419`). Backend prep PR: add
4 routes under `backend/routes/home.js` mirroring the Bills handler shape.

Partial workaround: `GET /api/homes/:id/events?event_type=maintenance`
(home.js:4793) lists future maintenance events but not the full log.

### G.2 "My X" listing endpoints

- `GET /api/homes/my-homes` — home.js:1464 ✓
- `GET /api/businesses/my-businesses` — businesses.js:682 ✓
- `GET /api/listings/me` — listings.js:1058 ✓ (note path inconsistency:
  `/my-X` vs `/me`)

### G.3 Magic Task — 11 routes, all real (see §F.1)

### G.4 Hub today / discovery — `backend/routes/hub.js`

| Route | File:line |
|---|---|
| `GET /api/hub` | 25 (mega aggregator) |
| `GET /api/hub/today` | 597 (weather/AQI/alerts) |
| `GET /api/hub/briefings/:id` | 612 |
| `GET /api/hub/preferences` | 648 |
| `PUT /api/hub/preferences` | 716 |
| `GET /api/hub/discovery` | 763 |
| `POST /api/hub/dismiss-density-milestone` | 1024 |

The Today card data is **mostly in `GET /api/hub`** already:
- `nextPillarEvent` — derivable client-side from `statusItems[].pillar +
  type + dueAt` (no discrete field); **OR** add a top-level
  `nextPillarEvent` field server-side (small response-shape change).
- `outstandingMail` — `unreadPersonal` + `homeMail.count` (lines 350-411);
  same option as above.
- `openGigsNearby` — `gigsNearby` at line 429 ✓ (count of `Gig.status='open'`
  not owned by user, not radius-filtered).

**Recommendation**: response-shape change to `/api/hub`, not a new route
(see §H.5).

### G.5 Auth — `backend/routes/users.js`

| Route | File:line | Notes |
|---|---|---|
| `POST /api/users/register` | 1177 | Accepts `phoneNumber` (attribute), email is identity |
| `POST /api/users/login` | 1492 | **Email + password only** — no phone OTP |
| `POST /api/users/verify-email` | 3115 | Supabase OTP token-hash or code ✓ |
| `POST /api/users/resend-verification` | 3049 | App-SMTP resend ✓ |
| `POST /api/users/forgot-password` | 3197 | ✓ |
| `POST /api/users/reset-password` | 3247 | ✓ |
| **`POST /api/users/login-phone`** | MISSING | Phone OTP login not wired |
| **`POST /api/users/verify-phone`** | MISSING | Phone verification not wired |

`User.phone_number` column exists (E.164 validated, `users.js:713`) with
availability checks (`isPhoneAvailable`, `users.js:1137`) — schema
supports phone identity but no auth flow today.

### G.6 Bills category

`HomeBill.bill_type` is an enum at `schema.sql:6189`:
`rent, mortgage, electric, gas, water, sewer, trash, internet, cable,
hoa, insurance, subscription, other`.

Covers 7 of 8 utility categories. **Missing: `phone`** — add via DB
constraint migration. No separate `category` column needed.
**No client-side inference.**

### G.7 Support trains — `backend/routes/supportTrains.js`

39 routes, all real. Selected for T6 screens:
- `GET /api/activities/support-trains/me/support-trains` (line 445) — list
- `GET /api/activities/support-trains/nearby` (line 570) — Nearby tab
- `POST /api/activities/support-trains/` (line 639) — create
- `GET /api/activities/support-trains/:id` (line 3443) — detail
- `GET /api/activities/support-trains/:id/reservations` (line 3306) —
  Review Signups screen
- Full list in agent report; all 39 mounted at
  `/api/activities/support-trains` (app.js:398).

### G.8 Mail variants

`Mail.mail_object_type` enum (`schema.sql:7228` via constraint
`Mail_mail_object_type_check`): `envelope, postcard, package, booklet,
bundle`. Plus `Mail.certified` (boolean column).

Per design:
- **Booklet** — `mail_object_type='booklet'` ✓. Routes at
  `mailboxV2Phase2.js:403, 428, 447`.
- **Certified** — boolean column, NOT enum. Routes at
  `mailboxV2Phase2.js:597, 623, 674, 705`.
- **Community** — separate `CommunityMailItem` table
  (`schema.sql:5355`) with its own `community_type` enum
  (`civic_notice, neighborhood_event, local_business,
  building_announcement`). Routes at `mailboxV2Phase3.js:565, 625, 694,
  746, 790`.
- **Ceremonial** — **MISSING from schema entirely**. Needs (a) new
  `mail_object_type='ceremonial'` OR a `is_ceremonial` flag, (b) handlers
  similar to the booklet/certified pattern. **Backend prep PR**.

### G.9 Per-home pillar endpoints

| Entity | Route(s) | Status |
|---|---|---|
| Polls | `home.js:6984, 7058, 7100, 7159` | ✓ full CRUD |
| Documents | `home.js:4944, 4985` | partial — list + create only; **no PATCH/DELETE** (T6.0c) |
| Vault (mailbox) | `mailboxV2Phase2.js:952, 983, 1010, 1033, 1054, 1089, 1145` | ✓ |
| Calendar | `home.js:4793, 4827, 4874, 4912` | ✓ full CRUD |
| Members | `homeIam.js:51, 212, 395, 479, 512` + `home.js:3705 occupants` | ✓ |
| Owners | `homeOwnership.js:256, 290, 490, 536, 569, 603, 665, 925, 1014` | ✓ (claim lifecycle) |
| Access codes | `home.js:5487, 5527, 5586, 5624` | ✓ full CRUD |
| Emergency info | `home.js:5406, 5442` | partial — **no PATCH/DELETE** (T6.0c) |
| Household tasks | `home.js:4170, 4238, 4308, 4354` | ✓ full CRUD |
| Packages | `home.js:4673, 4706, 4746` | ✓ |

### Summary of backend prep work (folded into T6.0c)

1. **NEW**: Maintenance CRUD (4 routes) under `home.js`.
2. **NEW enum value**: add `phone` to `HomeBill.bill_type` constraint.
3. **NEW enum value or flag**: add `ceremonial` to `mail_object_type`
   (or `is_ceremonial` boolean) + variant handlers.
4. **EXTEND**: PATCH/DELETE for Documents at `home.js`.
5. **EXTEND**: PATCH/DELETE for Emergencies at `home.js`.
6. **EXTEND**: response-shape on `GET /api/hub` — add discrete
   `nextPillarEvent` + `outstandingMail` fields (or keep as
   client-derived; see H.5).
7. **NEW**: phone-OTP auth routes (`POST /login-phone`,
   `POST /verify-phone`) — gated on H.3 decision.

---

## H. Open product questions

The 12 from §1.4 of the brief, plus 5 I uncovered. Each gets a
recommendation; decisions block specific PRs.

### H.1 Magic Task on My tasks V2 — re-skin now or later

**Q**: Re-skin now in T6.0 or treat as a separate Magic Task integration
tier later?

**Recommendation**: **Both — sequenced**. T6.0d ships iOS Magic Task
plumbing (endpoints, DTOs, composer screen, settings store). The
My tasks V2 re-skin PR (P-bills sibling — call it P9.5) lands AFTER
T6.0d, consuming the new DTOs. Bundling risks empty `archetypeOverline`
+ missing `engagementMode` for every gig until the composer ships.

**Blocks**: My tasks V2 re-skin PR.

### H.2 Bills utility categories — backend or client-derived

**Q**: Backend Bill DTO may not return a category field today. Confirm
before P0 starts. If not, client-side inferred from payee string.

**Recommendation**: **Backend already has it.** `HomeBill.bill_type` is
an enum at `schema.sql:6189` covering 7 of 8 categories. Add **`phone`**
to the constraint (one-line migration) and use `bill_type` directly.
**No client-side inference needed.** Backend prep ticket — folded into
T6.0c.

**Blocks**: Bills re-skin PR.

### H.3 Auth — phone-OR-email

**Q**: `auth-frames.jsx` Login frame shows email; design system says
phone-OR-email. Pick one for v1.

**Recommendation**: **Email only for v1.** The rendered frame wins (per
T5 universal-convention rule "when designer comment contradicts rendered
frame, the visual frame wins"). The design's Login frame shows
`mail` leading icon and "Email" label (`auth-frames.jsx:113-156`).
Backend phone-OTP routes don't exist (`MISSING` per §G.5). Shipping
phone-OR-email v1 would block on `POST /api/users/login-phone` + Twilio
wiring + UX disambiguation between phone-OTP and password — a separate
tier. Document phone path as a future Tier-N item.

**Blocks**: P3 Auth.

### H.4 Auth — verify email gating

**Q**: Hard-gate (sign-up → verify → app) or soft-gate (signed in
immediately, banner until verified)?

**Recommendation**: **Soft-gate**. Hard-gate adds a critical-path delay
that boosts new-user drop-off (every new user has to leave the app,
open mail, click a link, return). Soft-gate signs the user in
immediately and surfaces a persistent banner ("Verify your email to
unlock posting") that links to `/verify-email`. The `Verify email`
frame in `auth-frames.jsx` doubles as a *page the user lands on from
the verification link in their email*, not a blocking screen. Backend
`POST /api/users/verify-email` already exists (users.js:3115).

**Blocks**: P5 Auth.

### H.5 Hub today-card data source

**Q**: Are `nextPillarEvent` + `outstandingMail` + `openGigsNearby`
aggregated by `GET /api/hub` already, or do we wire each separately?

**Recommendation**: **Reshape `GET /api/hub`**. Two of three are
already there as parts of the existing response (`statusItems[]`,
`unreadPersonal/homeMail.count`); the third (`gigsNearby`) is also
there. Adding three discrete top-level fields
(`nextPillarEvent: PillarEvent`, `outstandingMail: { personal, home }`,
`openGigsNearby: number`) computed server-side from existing fields is
~30 lines in `hub.js` and avoids fanning out 3 client requests for
data that already lives in one payload. Folded into T6.0c.

**Blocks**: P6 Hub.

### H.6 Me identity gradient header — structural same or re-skin

**Q**: Confirm the visual is unchanged at the structural level vs a
re-skin we should do.

**Recommendation**: **Re-skin only — structural same**. The shipped
`Features/Me/MeView` already has the 3-color gradient header + identity
switcher + stat tiles + action grid. The new design refines: 72pt
gradient avatar, 22pt verified badge, identity-tinted stat tile cards,
2×3 action grid. None of that changes the data flow or routing.
Re-skin PR is small.

**Blocks**: P7 Me.

### H.7 Settings sub-routes — all 8 or 3

**Q**: Wire all 8 in T6.2, or 3 (Blocked / Password / Legal) now and
defer the rest?

**Recommendation**: **Wire all 8 in P8**. Six of the 8 sub-routes
are GroupedList variants (Notifications, Privacy, Blocked users,
Password, Verification, Help, Legal, About) — same shell, same DTOs
mostly already wired (notifications + privacy preferences endpoints
exist at `users.js`). Two have non-trivial flows (Data export →
Wizard; Payments & payouts → existing wallet/Stripe surface). The
incremental cost of wiring 5 more GroupedList screens in the same PR
is small (each is ~80 LOC), and shipping a half-wired Settings page
where 5/8 rows still land on `.placeholder` is bad UX. Keep
Payments & payouts behind a `placeholder` if the wallet surface isn't
ready; ship the other 7 fully wired.

**Blocks**: P8 Settings.

### H.8 Mailbox A17 archetype — new shared shell

**Q**: Does this need a new shared shell like ListOfRows, or one-off
ContentDetail derivatives?

**Recommendation**: **New shared shell — `MailboxA17Shell`** with 8
slots (per §E.1). 5 design files consume the same 8-slot composition
with variant-typed attachments — one-off ContentDetail derivatives
would duplicate the nav + hero + AI elf strip + key facts + sender +
actions chrome 5 times. The shared shell isolates the variant logic to
the `attachments` slot.

**Blocks**: P19–P23 Mailbox A17.

### H.9 Map+list hybrid sheet — shared shell

**Q**: Confirm we lift the 3-detent (40 / 20 / 70%) bottom-sheet pattern
into a shared `MapListHybridShell` or keep per-screen.

**Recommendation**: **Shared `MapListHybridShell`** (per §E.2). Even
though only `map-frames.jsx` consumes it today, the iOS / Android sheet
detent setup is fragile enough (custom anchor math, gesture conflicts
with map pan) that codifying it once is cheaper than re-implementing
when Marketplace / Discover want the same pattern. Two screens of
demand isn't required when the abstraction cost is just
`fun MapListHybridShell(...)` taking the existing slots as composable
parameters.

**Blocks**: P26 MapListHybrid.

### H.10 Magic Task FAB — new variant or special-case

**Q**: Add a new `FABAction.Variant.magicCreate` case or special-case
in the My tasks feature only?

**Recommendation**: **New `FabVariant.magicCreate` variant.** Adding a
parameter to `canonicalCreate` (e.g. `accentDisc: PantopusIcon?`) would
force every existing call site to think about the sparkles disc.
Cleaner to add `case magicCreate` (60pt, gradient primary600→primary700,
plus + sparkles-disc overlay) so My tasks V2 sets
`variant: .magicCreate` and the 9 other screens using `.canonicalCreate`
keep their 56pt geometry untouched. If `mailbox.jsx` magic-ingest FAB
is also "magic-y" (scan-line icon, primary600 disc), the same variant
serves both consumers (or add a sibling `.magicIngest` if the icon
shape differs enough).

**Blocks**: T6.0a shell extensions, My tasks V2 re-skin, Mailbox A17
root.

### H.11 Support trains — identity tone

**Q**: Confirm the support-trains routes stay personal-tinted even
though some trains anchor on a home.

**Recommendation**: **Stay personal-tinted (sky blue).** Design
explicitly says "Personal blue — people-to-person mutual aid, not Home"
(`supporttrains-frames.jsx:9-12`). Anchoring on a home is a logistical
detail; the *trust unit* is between the recipient (a person, often
recovering from something) and the helpers (their network) — not the
household. The warm cream intro band on the "My trains" tab
(`#fff7ed`, `supporttrains-frames.jsx:40-43`) is the only deviation
and it's not a pillar swap — just a warmth signal. Backend
(`supportTrains.js`) doesn't carry an identity field; tone is purely a
client-side render concern.

**Blocks**: P26.5 Support trains.

### H.12 Hub redesign — flag or direct cutover

**Q**: Behind a feature flag for staged rollout, or direct cutover?

**Recommendation**: **Feature flag** — `t6_hub_redesign` — defaulting
off for v1.0 of the T6 release, on for v1.1 after a week of telemetry.
Hub is the first screen users see; a regression here cuts session
length for everyone. The flag-on / flag-off branches share the same
ViewModel + endpoints (the redesign is structural + visual, not a data
contract change per H.5), so the flag wraps just the view layer. Mobile
flag system: `RemoteConfigClient.boolFlag("t6_hub_redesign")` on both
platforms (or env-driven for dev).

**Blocks**: P6 Hub.

### H.13 (NEW) Magic Task — engagement_mode enum mismatch

The design's engagement mode (`in_person | drop_off | remote | hybrid`)
is DIFFERENT from the backend's existing engagement mode
(`instant_accept | curated_offers | quotes`). Two different things
sharing a name.

**Recommendation**: **Rename the design's concept to
`engagement_archetype` (or `task_format`)** and add it as a new
`task_format` column on `Gig`. The backend's
`engagement_mode = instant_accept|curated_offers|quotes` is the
**offer-acceptance mode** (Magic Task fast-path vs curated bidding) —
not the same axis. The design's `in_person | drop_off | remote | hybrid`
is the **helper-engagement format** (does the helper come on site, drop
off, work remotely, or mix). They're orthogonal. Storing both is the
right answer.

**Blocks**: My tasks V2 re-skin, T6.0c backend prep.

### H.14 (NEW) Mailbox-A17 root — replaces T1.3 shell?

`mailbox.jsx` introduces a new root mailbox shell with drawer pills
(`Me / Home / Biz / Earn`), inner tabs (`Incoming / Counter / Vault`),
and a magic-ingest FAB. Does this **replace** the shipped T1.3
`MailboxListView` (which has `All / Unread / Starred` tabs and no
drawer pills), or does the drawer concept layer on top?

**Recommendation**: **Replaces.** The drawer pill is a more meaningful
identity scope than the All/Unread/Starred filter (which is now an
inner row state). Migrate `MailboxListViewModel` to:
- top-level pillar selector (drawer pills) driven by user's identity
  list (`/api/users/me/identities` or equivalent)
- inner tabs `Incoming / Counter / Vault` replacing `All / Unread /
  Starred`
- `unread` becomes a per-row state filter inside Incoming, not a tab
Document the pre-T6 `All/Unread/Starred` tab IDs as deprecated in the
parity audit.

**Blocks**: P19 Mailbox-A17 root.

### H.15 (NEW) MyHomes refresh — replaces T1.4 row shape?

`myhomes-frames.jsx` introduces a richer row (56pt address tile +
verification check + role chip + inline stats strip + Current
affordance), vs the shipped T1.4 simpler row (40pt icon + title +
subtitle + chevron). Does this replace the T1.4 row shape entirely or
coexist as a "v2" variant?

**Recommendation**: **Replaces.** T1.4 row was a minimum-viable
landing-pad until the rich row design was ready. Same data shape — only
the rendering changes. Single row-shape per screen is the convention.

**Blocks**: P16 MyHomes refresh.

### H.16 (NEW) Beacon — backend route mapping

`beacon-frames.jsx` (Public Beacon profile) is a 4-frame ContentDetail
variant. Does it map to existing public-profile routes (`users.js`
`GET /api/users/id/:id`), or is it a separate "creator persona" route
(`personas.js`)?

**Recommendation**: **Map to `/api/personas/:handle`** — Beacon is the
creator-facing public profile, distinct from the regular `users` public
profile. Personas already exist (`backend/routes/`, used by Audience +
Handshake). Confirm the Beacon-specific tabs `Broadcasts / About /
Tiers` map to `/api/personas/:handle/posts` + `/tiers` (both exist).
If "Local visitor" frame requires a non-persona route, defer to a
follow-up.

**Blocks**: P16.5 Beacon.

### H.17 (NEW) Web parity scope for T6

T5 shipped iOS + Android + web for every screen. T6 spec doesn't
explicitly say whether the 46 new screens all need web companions
(some — Maintenance, Calendar, Documents, Polls, Members, Access,
Emergency, Packages, Vault, Owners — have no web route today).

**Recommendation**: **Web companion is required for every screen with
an existing web route**, optional for screens whose web route doesn't
exist today (the Home pillar deep-screens). Defer web for those to a
later web-only sweep. Mobile-first is the right cadence — the
web routes are mostly Admin/desktop power-user surfaces, less critical
than mobile completeness. Document the web-deferral in the parity
audit.

**Blocks**: All P9–P15 home pillar PRs (clarifies whether web is
in-scope).

---

## I. Proposed PR sequence (28 PRs)

P-numbers track the brief's labels; ordering can be re-negotiated once
H-questions resolve.

### Prereq (T6.0)

| PR | Title | Blocks |
|---|---|---|
| **T6.0a** | Shell extensions, additive (Mailbox-A17 shell, MapListHybrid shell, Bills utility leading + SplitStack, My tasks V2 magic chrome additions, `FabVariant.magicCreate`, GroupedList sub-route wiring) | every feature PR |
| **T6.0b** | Theme tokens (`magic` lavender quartet, `cat-*` utility category tokens, A17 accents) | T6.0a |
| **T6.0c** | Backend prep (Maintenance CRUD, `phone` to `bill_type`, `ceremonial` to mail enum, Documents/Emergencies PATCH/DELETE, optional Hub today-card reshape, `task_format` column on Gig) | Bills re-skin, Maintenance, Documents, Emergency, Mail Ceremonial, My tasks V2 |
| **T6.0d** | iOS + Android Magic Task plumbing (endpoints helpers, DTOs, composer screen + view-model, settings store) | My tasks V2 re-skin |

### Auth (P3–P5)

| PR | Screen | Depends on |
|---|---|---|
| **P3** | Auth — Login refresh + Create account (auth-frames.jsx frames 1–2) | T6.0a |
| **P4** | Auth — Forgot password + Reset password + Error (frames 3–4, 6) | T6.0a |
| **P5** | Auth — Verify email + Status / Waiting (frame 5 + status-frames frame 3) | T6.0a |

### Redesign refresh (P6–P8)

| PR | Screen | Depends on |
|---|---|---|
| **P6** | Hub redesign (`hub-frames.jsx`), behind `t6_hub_redesign` flag | T6.0a, T6.0c (Hub today reshape) |
| **P7** | Me redesign (`me-frames.jsx`) | T6.0a |
| **P8** | Settings sub-routes + Notifications + Privacy GroupedList variants | T6.0a |

### Home pillar (P9–P15)

| PR | Screen | Depends on |
|---|---|---|
| **P9** | Bills re-skin (utility tiles + 6 chips + SplitStack + 60pt FAB) | T6.0a, T6.0b, T6.0c (`phone` enum) |
| **P9.5** | My tasks V2 magic re-skin | T6.0a, T6.0c (`task_format`), **T6.0d** |
| **P10** | Maintenance | T6.0c (4 new routes) |
| **P11** | Calendar | T6.0a |
| **P12** | Household tasks | T6.0a |
| **P13** | Documents | T6.0c (PATCH/DELETE) |
| **P14** | Packages | T6.0a |
| **P15** | Polls | T6.0a |
| **P15.5** | Home pillar sweep — Access codes + Emergency + Owners + Members (4 small category-grouped screens) | T6.0a, T6.0c (Emergency PATCH/DELETE) |

### Category-grouped + Identity (P16–P18)

| PR | Screen | Depends on |
|---|---|---|
| **P16** | MyHomes refresh | T6.0a |
| **P16.5** | Beacon (Public Beacon profile) | T6.0a |
| **P17** | MyBusinesses | T6.0a |
| **P17.5** | Audience refresh + Creator Inbox | T6.0a |
| **P18** | MyListings | T6.0a |

### Mailbox A17 (P19–P23)

| PR | Screen | Depends on |
|---|---|---|
| **P19** | Mailbox-A17 root shell (`mailbox.jsx`) — replaces T1.3 MailboxList | T6.0a, T6.0b |
| **P19.5** | Vault (Mailbox folder list) | T6.0a |
| **P20** | A17 generic detail (`mail-detail.jsx`) — replaces T1.3 MailboxItemDetail | P19 |
| **P21** | A17 Booklet variant | P20 |
| **P22** | A17 Certified variant | P20 |
| **P23** | A17 Community variant | P20 |
| **P23.5** | Ceremonial Mail refresh — Open + Compose | P20, T6.0c (`ceremonial` enum) |

### Misc + chat + map (P24–P26)

| PR | Screen | Depends on |
|---|---|---|
| **P24** | New Message (`newmessage-frames.jsx`) | T6.0a |
| **P25** | Chat refresh (`chat-frames.jsx` + `chat-convo-frames.jsx`) | T6.0a |
| **P26** | MapListHybrid (`map-frames.jsx`) | T6.0a |
| **P26.5** | Support trains + Review signups | T6.0a |
| **P26.9** | T6 refresh sweep — Handshake / Token Accept / Status / Legal / Identity Center / Gigs / Marketplace / Pulse / Content Detail / Tx Detail / Form / Wizard / Mailbox-frames showcase | T6.0a |

### Per-PR acceptance gate

Each feature PR must clear, on top of
`mobile-screen-definition-of-done.md`:

- iOS + Android land in same commit
- Web parity check where the web route exists (see H.17)
- `docs/mobile-parity-audit.md` row added / updated
- VM unit tests for `load → loaded / empty / error` + every optimistic
  mutation rollback
- One Paparazzi snapshot per fixed visual state on Android, one SwiftUI
  snapshot on iOS

---

## J. Risks and dependencies

### J.1 Magic Task iOS-zero gap

iOS has no Magic Task code at all. T6.0d is a big PR: endpoints (11),
DTOs (draft, post, settings, templates), composer screen (the FAB
target), settings store. Risk: T6.0d delay blocks My tasks V2 re-skin.
**Mitigation**: scope T6.0d to "minimum viable Magic Task" — magic-draft
+ magic-post + undo + composer screen + settings on/off toggle. Defer
templates CRUD to a follow-up PR.

### J.2 Mailbox-A17 root replaces T1.3 (P19)

The new shell replaces a shipped screen. Deep-link, jumpBackIn route
mapping, deep notification routes that point at `/app/mailbox` all need
to keep working. Risk: silent regression on push-notification taps.
**Mitigation**: route-tap acceptance test (iOS UI test + Android
instrumentation test) that simulates each known push-notification
deep-link and asserts the destination view renders.

### J.3 Backend prep PR (T6.0c) holds up 6 feature PRs

`phone` enum, `ceremonial` enum, Documents PATCH/DELETE, Emergencies
PATCH/DELETE, Maintenance CRUD, `task_format` column, Hub today reshape —
all in T6.0c. Risk: this PR balloons. **Mitigation**: split T6.0c into
two parallel sub-PRs — T6.0c.1 (schema-affecting: enum additions, new
table for Maintenance, `task_format` column) and T6.0c.2 (handler-only:
PATCH/DELETE additions, Hub reshape). Land in parallel — they don't
overlap.

### J.4 Settings sub-routes — Data export + Payments breadth

H.7 recommends wiring all 8. But "Data export" implies a Wizard
(multi-step) and "Payments & payouts" hooks into the Stripe Connect
wallet surface. If either of those isn't ready by P8, the PR fragments.
**Mitigation**: scope P8 to the 6 GroupedList variants
(Blocked / Password / Verification / Help / Legal / About + the existing
Notifications / Privacy). Park Data export + Payments as P8.5 once
the dependencies are ready.

### J.5 Hub redesign behind a flag — flag debt

Once `t6_hub_redesign` flag ships, both code paths need maintenance
until the flag is killed. Risk: flag becomes permanent (we've seen
this in T4.1). **Mitigation**: explicit flag-kill PR scheduled in
the T6 closeout — a separate task with a calendar date (e.g. 4 weeks
post-T6 ship).

### J.6 `engagement_mode` enum name collision (H.13)

Two distinct concepts share a name in the design and backend. Risk: a
developer writes `engagement_mode: 'in_person'` to the backend's
`engagement_mode` column and corrupts data. **Mitigation**: rename
the design's concept to `task_format` (or `helper_format`) before
any code lands. Update the design file's header comment to reflect
the new name; never let `in_person` ever map to the backend
`engagement_mode` column.

### J.7 Snapshot baseline churn

Two re-skin PRs (Bills, My tasks V2) and 11 redesign-refresh PRs touch
existing screens. Every one will require Paparazzi (Android) +
SwiftUI snapshot (iOS) re-record. Risk: snapshot drift across PRs
silently breaks CI. **Mitigation**: re-record baselines locally on a
fresh checkout for each affected screen at PR-commit time, not at
review time. CI hex-grep guard already catches the token-discipline
side.

### J.8 No mobile admin role still — Review claims stays web-only

T5.4.3 punted Review claims to web-only. T6 doesn't add a mobile
admin role. Risk: zero — but if PMs want admin tooling on mobile in
T7, a separate infra PR (`me.is_admin` field, role guard middleware on
both platforms) lands first.

### J.9 Web parity scope ambiguity (H.17)

Some T6-new home-pillar screens (Maintenance, Calendar, Documents,
Polls, Members, Access, Emergency, Packages, Vault, Owners) have no
web route today. If product wants web companions, that doubles the
PR surface area for those 10 screens. **Mitigation**: explicit
decision before P9 starts — mobile-only for the home pillar deep
screens, web sweep is a separate T7 effort.

---

## Open-question summary (for next session)

Before T6.0a (shell extensions) starts, the following need a yes/no/edit
from the product owner:

- **H.1** Magic Task re-skin sequenced after T6.0d Magic Task plumbing
  — **approve sequencing?**
- **H.2** Bills `bill_type` enum already covers 7 of 8; add `phone` —
  **approve?**
- **H.3** Auth v1 = email only; phone deferred — **OK?**
- **H.4** Verify email = soft-gate (banner) not hard-gate — **OK?**
- **H.5** Hub today reshape `/api/hub` (add `nextPillarEvent`,
  `outstandingMail`, `openGigsNearby` discrete fields) — **OK?**
- **H.6** Me header = re-skin only, structurally same — **confirm?**
- **H.7** Settings wire 6 GroupedList sub-routes in P8 (defer Data
  export + Payments to P8.5) — **OK?**
- **H.8** Mailbox-A17 = new shared shell with 8 slots — **approve?**
- **H.9** MapListHybrid = new shared shell — **approve?**
- **H.10** New `FabVariant.magicCreate` — **approve?**
- **H.11** Support trains stays personal-tinted — **confirm?**
- **H.12** Hub redesign behind `t6_hub_redesign` flag — **OK?**
- **H.13** Rename design's `engagement_mode` → `task_format` to avoid
  enum collision with backend's existing `engagement_mode` — **OK?**
- **H.14** Mailbox-A17 root replaces T1.3 MailboxList (not coexists) —
  **OK?**
- **H.15** MyHomes refresh replaces T1.4 row shape — **OK?**
- **H.16** Beacon maps to `/api/personas/:handle` — **confirm?**
- **H.17** Web parity required for screens with existing web route,
  deferred for home-pillar deep screens with no web route today —
  **OK?**

The Plan PR (this doc) is unblocked. Every other PR waits on at least
one H-decision above.
