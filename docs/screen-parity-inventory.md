# Screen parity inventory — all 8 design packs

> **Source of truth:** every `.html` file across the **eight** design packs at
> the repo root. Each row pairs a designed screen with its iOS and Android
> implementation file, marks whether the navigation stack reaches a real
> `View` / `@Composable` (not `NotYetAvailableView` / `placeholder(...)`), and
> lists which designed frames the current code does not render.
>
> **Generated:** 2026-05-26 (P8.1 closeout re-run). Produced by parsing each
> pack's HTML (`<title>`, `<b>Archetype</b>`, `label-num` /
> `data-screen-label` / `DCArtboard label=` frame markers) and auditing every
> implementation file against the iOS tab-root route enums
> (`Root/HubTabRoot.swift`, `Root/YouTabRoot.swift`, `Root/InboxTabRoot.swift`,
> `Root/NearbyTabRoot.swift`, `RootTabView.swift`, `AuthRouter.swift`) and the
> Android `RootTabScreen.kt` / `MailboxDrawersScreen.kt` / `AuthRoute.kt`
> wiring. **Every non-`MISSING` path in this document was confirmed to exist
> on disk.**
>
> **Path roots (table cells are relative to these):**
> - iOS — `frontend/apps/ios/Pantopus/Features/`
> - Android — `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/`
>
> **Reachability tokens (grep-able):** `REAL_VIEW` · `NOT_YET_AVAILABLE` ·
> `PLACEHOLDER` · `NO_ROUTE` · `MISSING`.

---

## Summary

**Total screens designed: 94** (in-scope `.html` files across the 8 packs).

Out of scope, excluded from the 94: the 54-file `A08 — per-screen batch
1/uploads/.../Pantopus Design System (1)/` component kit (foundations /
buttons / cards / colours / iconography galleries + hashed & print
duplicates — design tokens, not app screens), and `Map List Hybrid-print.html`
(a print variant of `Map List Hybrid.html`).

### Per pack

| # | Pack | Screens |
|---|------|--------:|
| 1 | A08 — per-screen batch 1 | 55 |
| 2 | A10 — Detail: Content | 6 |
| 3 | A13 — Form (single screen) | 7 |
| 4 | Chat conversation (A15) | 5 |
| 5 | Creator Audience hub (A22) | 2 |
| 6 | Full-bleed map + sheet (A11) | 4 |
| 7 | Wizard (multi-step form) (A12) | 6 |
| 8 | mobile Mailbox root archetype (A17) | 9 |
| | **Total** | **94** |

A08 breaks down as **30** per-screen "list of rows" screens + **25**
archetype-root demos.

### Build status per platform

| Status | iOS | Android |
|---|---:|---:|
| **Built** — `REAL_VIEW`, all designed frames render | 84 | 84 |
| **Partial** — `REAL_VIEW`, ≥1 designed frame missing | 3 | 3 |
| **Missing** — no implementation file | 0 | 0 |
| **Archetype shell** — `NO_ROUTE`, shared shell (n/a) | 7 | 7 |
| **Total** | **94** | **94** |

> **P8.1 closeout delta vs. the prior 2026-05-26 inventory:** two rows
> previously marked partial — **A10.4 Post (Empty)** and **A17.2 Booklet
> (Grid view)** — were re-verified against the current source and confirmed
> to render their designed states. The prior rows were over-strict in those
> two cases (they treated absence of a separate `.empty` enum case as
> missing, even though the empty UI rendered correctly inside `.loaded`).
> The other three previously-partial rows (Identity Center, Public Beacon
> Profile, A15.4 Creator thread) have been independently re-walked against
> design and still genuinely miss the cited frames — see "Closeout
> re-verification" below for the precise rendering gaps.

### Routes reaching real views vs placeholders

| Reachability | iOS | Android |
|---|---:|---:|
| `REAL_VIEW` | 87 | 87 |
| `NOT_YET_AVAILABLE` | 0 | 0 |
| `PLACEHOLDER` | 0 | 0 |
| `NO_ROUTE` (archetype shells) | 7 | 7 |

Every concrete designed screen is wired to its real view on both platforms —
there are **no** screens reachable only through `NotYetAvailableView` /
`placeholder(...)`. The 7 `NO_ROUTE` rows are the generic shared-shell
archetype demonstrations (Content Detail, Form, List of Rows, Mailbox Item
Detail, Map List Hybrid, Transactional Detail, Wizard); the shells exist and
are reused by concrete routed screens, but the archetype demo itself is not a
navigable destination.

### The 3 partial screens (state-coverage gaps — symmetric on both platforms)

| Screen | Pack | Missing designed state(s) |
|---|---|---|
| Identity Center | A08 | **First-run chrome elements** — the four identity cards render with the designed `setupNeeded` badges, but the designed first-run frame also calls for a disabled "Profile links" placeholder card ("Nothing to link yet. Create a Persona or Professional profile to choose how it appears next to your Local profile.") *and* a primary-tinted "Two more profiles to go" info card at the bottom. Neither element is rendered on iOS (`IdentityCenterView.swift:108-119`) or Android (`IdentityCenterScreen.kt:231-240`) — the bridges section is conditionally hidden when empty, and there is no trailing info card. |
| Public Beacon Profile | A08 | **Persona·owner** — no owner-vs-visitor role branching anywhere in `PublicProfileView.swift:104-188` or `PublicProfileScreen.kt`. The design's owner chrome (analytics `bar-chart-3` icon button + `Edit` pencil button + `AnalyticsStrip` + `FloatingBack right="settings"`) is not rendered for any persona profile — the personaLayout always emits visitor chrome (`Follow` CTA, `share` action). **Empty** — ✅ **Resolved (P8.6):** `PublicProfilePostsFeed` now renders the full empty card on both platforms (72×72 `primary50` disc + `radio-tower` icon + headline + body + primary CTA wired to `follow()`). Shipped copy follows the in-scope `docs/designs/A21/a21-1-persona-frames.jsx` frame — **"No broadcasts yet" + a "Follow" CTA (`plus` icon)** — which supersedes the older "Quiet for now" / "Notify when live" / `bell-plus` wording (from `beacon-frames.jsx`). P8.6 also adopted `BeaconBanner` + a bespoke `BeaconIdentityBlock` (avatar-overlap + in-header actions + StatCell row). Persona·owner chrome remains the only open A21 gap (deferred). |
| A15.4 Creator thread | Chat | **Secondary (quota-exhausted lock)** — quota meter fills proportionally but never switches into the designed `maxed` state (error-red fill, "5 of 5" count) at `quota.used ≥ quota.total`; no system pill announcing the cap is rendered; the inline upgrade-fan upsell card is missing; and the composer is never locked (dashed input + italic "Out of replies until Monday" placeholder + lock icon + disabled send + alert-triangle "Bronze cap reached." lock-row). Confirmed missing in iOS (`ChatConversationView.swift:65-103, 1071-1117`) and Android (`ChatConversationScreen.kt:107-209`); no `maxed` / `quotaExhausted` / `composerLocked` references on either platform. |

### Caveats / quality notes (not counted as missing frames)

- **Android `Me`** lives at `you/me/MeView.kt` (not `MeScreen.kt`); the
  composable is `MeScreen` and is wired `REAL_VIEW`. Naming-convention nit.
- **A13.11 Professional profile** — `.pending` is modelled as a
  dirty/unsaved-edits state. If the design's "Pending verification" frame is
  meant to be an *admin-review-in-progress* state (already submitted, awaiting
  approval), that distinct state is not represented. Ambiguous — flag for
  design.
- **Mailbox A17 has two parallel detail hosts**: `MailboxItemDetailView`
  (dispatches all category bodies under `ItemDetail/Bodies/`) and
  `MailDetailView` (dispatches `Variants/` for booklet/certified/community,
  else a generic layout). Rows below cite the most specific body/variant file
  per category. Consolidating onto one host is a future cleanup.

> The prior 2026-05-26 caveat about iOS `EditProfileView` using
> `ProgressView("Loading profile…")` was resolved by P7.6a — the view now
> renders a `Shimmer` skeleton (`EditProfileView.swift:87-90`) with
> `accessibilityLabel("Loading profile")` (no visible spinner text).

---

## 1. A08 — per-screen batch 1

### 1a. List-of-rows per-screen batch (30)

| Pack | Screen | Archetype | Designed states | iOS path | iOS reachable | Android path | Android reachable | Missing states |
|---|---|---|---|---|---|---|---|---|
| A08 | Access codes | A08 List of Rows | Populated, Empty | `Homes/AccessCodes/AccessCodesView.swift` | REAL_VIEW | `homes/accesscodes/AccessCodesScreen.kt` | REAL_VIEW | none |
| A08 | Bills | A08 List of Rows | Populated, Empty | `Homes/Bills/BillsListView.swift` | REAL_VIEW | `homes/bills/BillsListScreen.kt` | REAL_VIEW | none |
| A08 | Connections | A08 List of Rows | Populated, Empty | `Connections/ConnectionsView.swift` | REAL_VIEW | `connections/ConnectionsScreen.kt` | REAL_VIEW | none |
| A08 | Creator inbox | A08 List of Rows | Populated, Empty | `CreatorInbox/CreatorInboxView.swift` | REAL_VIEW | `creator_inbox/CreatorInboxScreen.kt` | REAL_VIEW | none |
| A08 | Discover businesses | A08 List of Rows | Populated, Empty | `DiscoverBusinesses/DiscoverBusinessesView.swift` | REAL_VIEW | `discoverbusinesses/DiscoverBusinessesScreen.kt` | REAL_VIEW | none |
| A08 | Discover hub | A08 List of Rows | Populated, Empty | `DiscoverHub/DiscoverHubView.swift` | REAL_VIEW | `discoverhub/DiscoverHubScreen.kt` | REAL_VIEW | none |
| A08 | Documents | A08 List of Rows | Populated, Empty | `Homes/Documents/DocumentsView.swift` | REAL_VIEW | `homes/documents/DocumentsScreen.kt` | REAL_VIEW | none |
| A08 | Emergency info | A08 List of Rows | Populated, Empty | `Homes/Emergency/EmergencyInfoView.swift` | REAL_VIEW | `homes/emergency/EmergencyInfoScreen.kt` | REAL_VIEW | none |
| A08 | Home calendar | A08 List of Rows | Populated, Empty | `Homes/Calendar/HomeCalendarView.swift` | REAL_VIEW | `homes/calendar/HomeCalendarScreen.kt` | REAL_VIEW | none |
| A08 | Listing offers | A08 List of Rows | Populated, Empty | `ListingOffers/ListingOffersView.swift` | REAL_VIEW | `listing_offers/ListingOffersScreen.kt` | REAL_VIEW | none |
| A08 | Maintenance | A08 List of Rows | Populated, Empty | `Homes/Maintenance/MaintenanceListView.swift` | REAL_VIEW | `homes/maintenance/MaintenanceListScreen.kt` | REAL_VIEW | none |
| A08 | Members | A08 List of Rows | Populated, Empty | `Homes/Members/MembersListView.swift` | REAL_VIEW | `homes/members/MembersListScreen.kt` | REAL_VIEW | none |
| A08 | My bids | A08 List of Rows | Populated, Empty | `MyBids/MyBidsView.swift` | REAL_VIEW | `my_bids/MyBidsScreen.kt` | REAL_VIEW | none |
| A08 | My businesses | A08 List of Rows | Populated, Empty | `Businesses/MyBusinessesView.swift` | REAL_VIEW | `businesses/MyBusinessesScreen.kt` | REAL_VIEW | none |
| A08 | My homes | A08 List of Rows | Populated, Empty | `Homes/MyHomesListView.swift` | REAL_VIEW | `homes/MyHomesListScreen.kt` | REAL_VIEW | none |
| A08 | My listings | A08 List of Rows | Populated, Empty | `Listings/MyListingsView.swift` | REAL_VIEW | `listings/MyListingsScreen.kt` | REAL_VIEW | none |
| A08 | My posts | A08 List of Rows | Populated, Empty | `MyPosts/MyPostsView.swift` | REAL_VIEW | `my_posts/MyPostsScreen.kt` | REAL_VIEW | none |
| A08 | My tasks | A08 List of Rows | Populated, Empty | `MyTasks/MyTasksView.swift` | REAL_VIEW | `my_tasks/MyTasksScreen.kt` | REAL_VIEW | none |
| A08 | New message | A08 List of Rows | Populated, Empty | `Chat/NewMessage/NewMessageView.swift` | REAL_VIEW | `inbox/newmessage/NewMessageScreen.kt` | REAL_VIEW | none |
| A08 | Notifications | A08 List of Rows | Populated, Empty | `Notifications/NotificationsView.swift` | REAL_VIEW | `notifications/NotificationsScreen.kt` | REAL_VIEW | none |
| A08 | Offers | A08 List of Rows | Populated, Empty | `Offers/OffersView.swift` | REAL_VIEW | `offers/OffersScreen.kt` | REAL_VIEW | none |
| A08 | Owners | A08 List of Rows | Populated, Empty | `Homes/Owners/OwnersListView.swift` | REAL_VIEW | `homes/owners/OwnersListScreen.kt` | REAL_VIEW | none |
| A08 | Packages | A08 List of Rows | Populated, Empty | `Homes/Packages/PackagesListView.swift` | REAL_VIEW | `homes/packages/PackagesListScreen.kt` | REAL_VIEW | none |
| A08 | Pets | A08 List of Rows | Populated, Empty | `Homes/Pets/PetsListView.swift` | REAL_VIEW | `homes/pets/PetsListScreen.kt` | REAL_VIEW | none |
| A08 | Polls | A08 List of Rows | Populated, Empty | `Homes/Polls/PollsListView.swift` | REAL_VIEW | `homes/polls/PollsListScreen.kt` | REAL_VIEW | none |
| A08 | Review claims | A08 List of Rows | Populated, Empty | `ReviewClaims/ReviewClaimsView.swift` | REAL_VIEW | `review_claims/ReviewClaimsScreen.kt` | REAL_VIEW | none |
| A08 | Review signups | A08 List of Rows | Populated, Empty | `ReviewSignups/ReviewSignupsView.swift` | REAL_VIEW | `review_signups/ReviewSignupsScreen.kt` | REAL_VIEW | none |
| A08 | Support trains | A08 List of Rows | Populated, Empty | `SupportTrains/SupportTrainsView.swift` | REAL_VIEW | `support_trains/SupportTrainsScreen.kt` | REAL_VIEW | none |
| A08 | Tasks (household) | A08 List of Rows | Populated, Empty | `Homes/Tasks/HouseholdTasksListView.swift` | REAL_VIEW | `homes/tasks/HouseholdTasksListScreen.kt` | REAL_VIEW | none |
| A08 | Vault | A08 List of Rows | Populated, Empty | `Mailbox/Vault/VaultListView.swift` | REAL_VIEW | `mailbox/vault/VaultListScreen.kt` | REAL_VIEW | none |

### 1b. Archetype-root demos (25)

| Pack | Screen | Archetype | Designed states | iOS path | iOS reachable | Android path | Android reachable | Missing states |
|---|---|---|---|---|---|---|---|---|
| A08 | Auth | Auth archetype | Log in, Create account, Forgot password, Reset password, Verify email, Input error | `Auth/LoginView.swift` | REAL_VIEW | `auth/LoginScreen.kt` | REAL_VIEW | none |
| A08 | Ceremonial Mail Compose | Ceremonial archetype | Porch call, Address it, Write it, Seal & send | `CeremonialMail/CeremonialMailWizardView.swift` | REAL_VIEW | `ceremonial_mail/CeremonialMailWizardScreen.kt` | REAL_VIEW | none |
| A08 | Ceremonial Mail Open | Ceremonial archetype | Porch arrival, Opening, Reading, Reply | `CeremonialMailOpen/CeremonialMailOpenView.swift` | REAL_VIEW | `ceremonial_mail_open/CeremonialMailOpenScreen.kt` | REAL_VIEW | none |
| A08 | Chat Conversation | A15 Chat conversation (archetype) | Populated DM, Empty, AI assistant | `Chat/Conversation/ChatConversationView.swift` | REAL_VIEW | `inbox/conversation/ChatConversationScreen.kt` | REAL_VIEW | none |
| A08 | Chat List | A08 List of Rows (Chat) | Populated, Empty, Loading | `Chat/ChatListView.swift` | REAL_VIEW | `inbox/chat/ChatListScreen.kt` | REAL_VIEW | none |
| A08 | Content Detail | A10 Detail: Content (archetype) | Post detail, Public profile, Home dashboard | `Shared/ContentDetail/ContentDetailShell.swift` | NO_ROUTE | `shared/content_detail/ContentDetailShell.kt` | NO_ROUTE | n/a (archetype shell) |
| A08 | Creator Audience | A22 Creator audience surface | Updates tab, Fans tab, Inbox tab, Broadcast detail | `AudienceProfile/AudienceProfileView.swift` | REAL_VIEW | `audience_profile/AudienceProfileScreen.kt` | REAL_VIEW | none |
| A08 | Form | A13 Form (archetype) | Simple, Multi-section, Field-heavy | `Shared/Form/FormShell.swift` | NO_ROUTE | `shared/form/FormShell.kt` | NO_ROUTE | n/a (archetype shell) |
| A08 | Gigs | A08 List of Rows (Gigs) | Populated, Empty, Loading | `Gigs/GigsFeedView.swift` | REAL_VIEW | `gigs/GigsFeedScreen.kt` | REAL_VIEW | none |
| A08 | Hub | A02 Hub tab | Populated, First-run, Skeleton | `Hub/HubView.swift` | REAL_VIEW | `hub/HubScreen.kt` | REAL_VIEW | none |
| A08 | Identity Center | Identity archetype | Populated, First run, Switcher | `IdentityCenter/IdentityCenterView.swift` | REAL_VIEW | `identity_center/IdentityCenterScreen.kt` | REAL_VIEW | First run |
| A08 | Legal Static | Legal / Static | Long-form legal doc | `Settings/Legal/LegalContentView.swift` | REAL_VIEW | `settings/legal/LegalScreens.kt` | REAL_VIEW | none |
| A08 | List of Rows | A08 List of Rows (archetype) | Primary, Variant, Variant, State | `Shared/ListOfRows/ListOfRowsView.swift` | NO_ROUTE | `shared/list_of_rows/ListOfRowsScreen.kt` | NO_ROUTE | n/a (archetype shell) |
| A08 | Mailbox Item Detail | A17 Mail item detail (archetype) | Package, Coupon, Booklet, Certified | `Shared/MailItemDetail/MailItemDetailShell.swift` | NO_ROUTE | `shared/mail_item_detail/MailItemDetailShell.kt` | NO_ROUTE | n/a (archetype shell) |
| A08 | Map List Hybrid | A11 Full-bleed Map + Sheet (archetype) | Default (40%), Collapsed (20%), Expanded (70%) | `Shared/MapListHybrid/MapListHybridShell.swift` | NO_ROUTE | `shared/map_list_hybrid/MapListHybridShell.kt` | NO_ROUTE | n/a (archetype shell) |
| A08 | Marketplace | A08 List of Rows (Marketplace) | Populated, Empty, Loading | `Marketplace/MarketplaceView.swift` | REAL_VIEW | `marketplace/MarketplaceScreen.kt` | REAL_VIEW | none |
| A08 | Me | Me tab | Personal, Home | `Me/MeView.swift` | REAL_VIEW | `you/me/MeView.kt` | REAL_VIEW | none |
| A08 | Privacy Handshake | Privacy archetype | Choose handle, Tier select, Stripe handoff, Already following | `PrivacyHandshake/PrivacyHandshakeWizardView.swift` | REAL_VIEW | `handshake/PrivacyHandshakeScreen.kt` | REAL_VIEW | none |
| A08 | Public Beacon Profile | A10 Public profile | Persona·visitor, Persona·owner, Local·visitor, Empty | `Profile/PublicProfileView.swift` | REAL_VIEW | `profile/PublicProfileScreen.kt` | REAL_VIEW | Persona·owner _(Empty state ✅ P8.6)_ |
| A08 | Pulse | A08 List of Rows (Pulse) | Populated, Empty, Loading | `Feed/FeedView.swift` | REAL_VIEW | `feed/FeedScreen.kt` | REAL_VIEW | none |
| A08 | Settings | Settings archetype | Main index, Toggles, Mixed | `Settings/SettingsView.swift` | REAL_VIEW | `settings/SettingsScreens.kt` | REAL_VIEW | none |
| A08 | Status Waiting | Status / Waiting | Post-submit, Persistent waiting, Verify email | `Status/StatusWaitingView.swift` | REAL_VIEW | `status/StatusWaitingScreen.kt` | REAL_VIEW | none |
| A08 | Token Accept | Token / Accept | Home invite, Business seat, Guest pass | `TokenAccept/TokenAcceptView.swift` | REAL_VIEW | `token_accept/TokenAcceptScreen.kt` | REAL_VIEW | none |
| A08 | Transactional Detail | A10 Transactional Detail (archetype) | Gig detail, Listing detail, Invoice detail | `ContentDetail/TransactionalDetailShell.swift` | NO_ROUTE | `contentdetail/ContentDetailShell.kt` | NO_ROUTE | n/a (archetype shell) |
| A08 | Wizard | A12 Wizard (archetype) | Step 1 of 3, Step 2 of 3, Success | `Shared/Wizard/WizardShell.swift` | NO_ROUTE | `shared/wizard/WizardShell.kt` | NO_ROUTE | n/a (archetype shell) |

---

## 2. A10 — Detail: Content

| Pack | Screen | Archetype | Designed states | iOS path | iOS reachable | Android path | Android reachable | Missing states |
|---|---|---|---|---|---|---|---|---|
| A10 | A10.1 Home | A10 Detail: Content | Populated, Empty | `Homes/HomeDashboardView.swift` | REAL_VIEW | `homes/HomeDashboardScreen.kt` | REAL_VIEW | none |
| A10 | A10.2 Home (alt) | A10 Detail: Content | Populated, Needs attention | `Homes/HomeDashboardView.swift` | REAL_VIEW | `homes/HomeDashboardScreen.kt` | REAL_VIEW | none |
| A10 | A10.3 Today | A10 Detail: Content | Populated, Advisory | `Hub/Today/TodayDetailView.swift` | REAL_VIEW | `hub/today/TodayDetailScreen.kt` | REAL_VIEW | none |
| A10 | A10.4 Post | A10 Detail: Content | Populated, Empty | `Posts/PulsePostDetailView.swift` | REAL_VIEW | `posts/PulsePostDetailScreen.kt` | REAL_VIEW | none |
| A10 | A10.5 User | A10 Detail: Content | Populated, Secondary·New neighbor | `Profile/PublicProfileView.swift` | REAL_VIEW | `profile/PublicProfileScreen.kt` | REAL_VIEW | none |
| A10 | A10.8 Membership | A10 Detail: Content | Populated, Secondary·SLA missed | `Membership/MembershipDetailView.swift` | REAL_VIEW | `membership/MembershipDetailScreen.kt` | REAL_VIEW | none |

> A10.2 is the same `HomeDashboardView`/`…Screen` as A10.1 — "Needs attention"
> is a `HomeDashboardState.needsAttention` case, not a separate file.

---

## 3. A13 — Form (single screen)

| Pack | Screen | Archetype | Designed states | iOS path | iOS reachable | Android path | Android reachable | Missing states |
|---|---|---|---|---|---|---|---|---|
| A13 | A13.1 Add guest | A13 Form (single screen) | Populated, Initial | `Homes/Guests/AddGuestFormView.swift` | REAL_VIEW | `homes/guests/AddGuestFormScreen.kt` | REAL_VIEW | none |
| A13 | A13.2 Invite owner | A13 Form (single screen) | Populated, Ownership conflict | `Homes/InviteOwner/InviteOwnerFormView.swift` | REAL_VIEW | `homes/invite_owner/InviteOwnerFormScreen.kt` | REAL_VIEW | none |
| A13 | A13.5 Property details | A13 Form (single screen) | Clean, Mismatch | `Homes/PropertyDetails/PropertyDetailsView.swift` | REAL_VIEW | `homes/property_details/PropertyDetailsScreen.kt` | REAL_VIEW | none |
| A13 | A13.8 Post gig (V1) | A13 Form (single screen) | Populated, Validation errors | `Gigs/QuickPost/PostGigV1View.swift` | REAL_VIEW | `gigs/quickpost/PostGigV1Screen.kt` | REAL_VIEW | none |
| A13 | A13.9 Edit profile | A13 Form (single screen) | Clean (last-saved), Dirty (unsaved edits) | `Profile/EditProfileView.swift` | REAL_VIEW | `profile/EditProfileScreen.kt` | REAL_VIEW | none |
| A13 | A13.11 Professional profile | A13 Form (single screen) | Verified (published), Pending verification | `Profile/Professional/ProfessionalProfileView.swift` | REAL_VIEW | `profile/professional/ProfessionalProfileScreen.kt` | REAL_VIEW | none |
| A13 | A13.12 Edit persona | A13 Form (single screen) | Live (published), Mid-setup (draft) | `AudienceProfile/EditPersona/EditPersonaView.swift` | REAL_VIEW | `audience_profile/edit_persona/EditPersonaScreen.kt` | REAL_VIEW | none |

---

## 4. Chat conversation (A15)

All five A15 variants are one `ChatConversationView`/`…Screen`, mode-switched
via `ChatConversationMode { .dm, .aiAssistant, .creatorThread, .fanThread }`.

| Pack | Screen | Archetype | Designed states | iOS path | iOS reachable | Android path | Android reachable | Missing states |
|---|---|---|---|---|---|---|---|---|
| Chat (A15) | A15 Chat conversation | A15 Chat conversation | Populated, Empty | `Chat/Conversation/ChatConversationView.swift` | REAL_VIEW | `inbox/conversation/ChatConversationScreen.kt` | REAL_VIEW | none |
| Chat (A15) | A15.2 Conversation | A15 Chat conversation | Populated, Empty | `Chat/Conversation/ChatConversationView.swift` | REAL_VIEW | `inbox/conversation/ChatConversationScreen.kt` | REAL_VIEW | none |
| Chat (A15) | A15.3 AI Assistant | A15 Chat conversation | Populated, Empty | `Chat/Conversation/ChatConversationView.swift` | REAL_VIEW | `inbox/conversation/ChatConversationScreen.kt` | REAL_VIEW | none |
| Chat (A15) | A15.4 Creator thread | A15 Chat conversation | Populated, Secondary (quota exhausted) | `Chat/Conversation/ChatConversationView.swift` | REAL_VIEW | `inbox/conversation/ChatConversationScreen.kt` | REAL_VIEW | Secondary (quota-exhausted lock) |
| Chat (A15) | A15.5 Fan thread | A15 Chat conversation | Populated, Empty | `Chat/Conversation/ChatConversationView.swift` | REAL_VIEW | `inbox/conversation/ChatConversationScreen.kt` | REAL_VIEW | none |

---

## 5. Creator Audience hub (A22)

| Pack | Screen | Archetype | Designed states | iOS path | iOS reachable | Android path | Android reachable | Missing states |
|---|---|---|---|---|---|---|---|---|
| A22 | A22.1 Audience | A22 Creator audience surface | Populated, Empty | `AudienceProfile/AudienceProfileView.swift` | REAL_VIEW | `audience_profile/AudienceProfileScreen.kt` | REAL_VIEW | none |
| A22 | A22.2 Compose broadcast | A22 Creator audience surface | Populated, Empty | `AudienceProfile/ComposeBroadcast/ComposeBroadcastView.swift` | REAL_VIEW | `audience_profile/compose_broadcast/ComposeBroadcastScreen.kt` | REAL_VIEW | none |

---

## 6. Full-bleed map + sheet (A11)

| Pack | Screen | Archetype | Designed states | iOS path | iOS reachable | Android path | Android reachable | Missing states |
|---|---|---|---|---|---|---|---|---|
| A11 | A11.1 Tasks map | A11 Full-bleed Map + Sheet | Populated, Empty | `Gigs/TasksMap/TasksMapView.swift` | REAL_VIEW | `gigs/tasks_map/TasksMapScreen.kt` | REAL_VIEW | none |
| A11 | A11.2 Explore | A11 Full-bleed Map + Sheet | Populated, Empty | `Explore/ExploreMapView.swift` | REAL_VIEW | `explore/ExploreMapScreen.kt` | REAL_VIEW | none |
| A11 | A11.3 Discover | A11 Full-bleed Map + Sheet | Populated, Empty | `DiscoverHub/DiscoverHubView.swift` | REAL_VIEW | `discoverhub/DiscoverHubScreen.kt` | REAL_VIEW | none |
| A11 | A11.4 Mailbox map | A11 Full-bleed Map + Sheet | Populated, Pin detail | `Mailbox/MailboxMap/MailboxMapView.swift` | REAL_VIEW | `mailbox/mailbox_map/MailboxMapScreen.kt` | REAL_VIEW | none |

> A11.3 "Discover" is the `DiscoverHubView` magazine surface (compact map
> strip + rails), distinct from A11.2 `ExploreMapView` (full-bleed map).

---

## 7. Wizard (multi-step form) (A12)

| Pack | Screen | Archetype | Designed states | iOS path | iOS reachable | Android path | Android reachable | Missing states |
|---|---|---|---|---|---|---|---|---|
| A12 | A12.1 Find your home | A12 Wizard (multi-step form) | Populated, Secondary·Searching | `Homes/AddHome/AddHomeWizardView.swift` | REAL_VIEW | `homes/add_home/AddHomeWizardScreen.kt` | REAL_VIEW | none |
| A12 | A12.2 Add home | A12 Wizard (multi-step form) | Populated, Secondary·Needs review | `Homes/AddHome/AddHomeWizardView.swift` | REAL_VIEW | `homes/add_home/AddHomeWizardScreen.kt` | REAL_VIEW | none |
| A12 | A12.3 Claim ownership — Start | A12 Wizard (multi-step form) | Populated, Secondary·Contested | `Homes/ClaimOwnership/ClaimOwnershipWizardView.swift` | REAL_VIEW | `homes/claim_ownership/ClaimOwnershipWizardScreen.kt` | REAL_VIEW | none |
| A12 | A12.8 Post a task | A12 Wizard (multi-step form) | Populated, Secondary·Manual path | `Compose/GigCompose/GigComposeWizardView.swift` | REAL_VIEW | `compose/gig/GigComposeWizardScreen.kt` | REAL_VIEW | none |
| A12 | A12.9 List an item | A12 Wizard (multi-step form) | Populated, Secondary·Camera capture | `Compose/ListingCompose/ListingComposeWizardView.swift` | REAL_VIEW | `compose/listing/ListingComposeWizardScreen.kt` | REAL_VIEW | none |
| A12 | A12.11 Start a support train | A12 Wizard (multi-step form) | Populated, Secondary·Not on Pantopus | `SupportTrains/StartTrain/StartSupportTrainWizardView.swift` | REAL_VIEW | `support_trains/start_train/StartSupportTrainWizardScreen.kt` | REAL_VIEW | none |

> A12.1 "Find your home" is step 1 (`AddressStep`) of the Add Home wizard —
> the same file as A12.2, not a standalone screen.

---

## 8. mobile Mailbox root archetype (A17)

| Pack | Screen | Archetype | Designed states | iOS path | iOS reachable | Android path | Android reachable | Missing states |
|---|---|---|---|---|---|---|---|---|
| A17 | A17.1 Mail item (generic) | A17 Mail item detail | Open, Acknowledged | `Mailbox/MailDetail/MailDetailView.swift` | REAL_VIEW | `mailbox/mail_detail/MailDetailScreen.kt` | REAL_VIEW | none |
| A17 | A17.2 Booklet | A17 Mail item detail | Page view, Grid view | `Mailbox/MailDetail/Variants/BookletDetailLayout.swift` | REAL_VIEW | `mailbox/mail_detail/variants/BookletDetailLayout.kt` | REAL_VIEW | none |
| A17 | A17.3 Certified mail | A17 Mail item detail | Open, Acknowledged | `Mailbox/MailDetail/Variants/CertifiedDetailLayout.swift` | REAL_VIEW | `mailbox/mail_detail/variants/CertifiedDetailLayout.kt` | REAL_VIEW | none |
| A17 | A17.4 Community mail | A17 Mail item detail | Open, Going | `Mailbox/MailDetail/Variants/CommunityDetailLayout.swift` | REAL_VIEW | `mailbox/mail_detail/variants/CommunityDetailLayout.kt` | REAL_VIEW | none |
| A17 | A17.5 Coupon | A17 Mail item detail | Open, Added | `Mailbox/ItemDetail/Bodies/CouponBody.swift` | REAL_VIEW | `mailbox/item_detail/bodies/CouponBody.kt` | REAL_VIEW | none |
| A17 | A17.6 Gig mail | A17 Mail item detail | Received, Accepted | `Mailbox/ItemDetail/Bodies/GigBody.swift` | REAL_VIEW | `mailbox/item_detail/bodies/GigBody.kt` | REAL_VIEW | none |
| A17 | A17.7 Memory | A17 Mail item detail | Fresh, Saved | `Mailbox/ItemDetail/Bodies/MemoryBody.swift` | REAL_VIEW | `mailbox/item_detail/bodies/MemoryBody.kt` | REAL_VIEW | none |
| A17 | A17.8 Package | A17 Mail item detail | Delivered, In transit | `Mailbox/ItemDetail/Bodies/CategoryBodies.swift` | REAL_VIEW | `mailbox/item_detail/bodies/CategoryBodies.kt` | REAL_VIEW | none |
| A17 | Mailbox Mobile | A17 Mailbox root (drawer-tabs) | Me incoming, Biz counter, Earn empty | `Mailbox/MailboxRoot/MailboxRootView.swift` | REAL_VIEW | `mailbox/mailbox_root/MailboxRootScreen.kt` | REAL_VIEW | none |

---

## Methodology & verification

- **Pack inventory** — all 8 packs confirmed present on disk; 94 in-scope
  `.html` files enumerated (excludes the design-system component kit + print
  duplicate, see Summary).
- **Frame states** — extracted from each HTML's `label-num` / `FRAME` markers,
  `data-screen-label`, and (A15/A17 packs) `DCArtboard label=` / `dataLabel=`
  / `state=` props.
- **Path existence** — every iOS path under `Features/` and Android path under
  `screens/` in this document was verified to exist with a filesystem check
  (`test -f`); **0 cited paths missing**.
- **Reachability** — derived from the concrete `View`/`@Composable`
  instantiations inside the iOS tab-root `destination(for:)` switches +
  `RootTabView`/`AuthRouter`, and the Android `composable(){ … }` blocks in
  `RootTabScreen.kt` / `MailboxDrawersScreen.kt` / `AuthRoute.kt`.
- **State coverage** — each implementation's state enum + view body was read
  and compared against the designed frames; only genuine non-rendered frames
  are listed under "Missing states". A state is "rendered" iff the loaded
  view body produces the designed empty / lock / alternate UI when the
  underlying model is in the matching condition, regardless of whether the
  state-enum is shaped `loading/loaded/error` or `loading/loaded/empty/error`.

---

## Closeout re-verification (P8.1)

The prior 2026-05-26 inventory listed five partial rows. Re-walking each
against current source confirms **two were over-strict** (the empty UI is
rendered correctly inside `.loaded`, just not gated on a separate `.empty`
enum case) and **three remain genuine gaps**:

### Re-classified as fully built (state IS rendered, just inside `.loaded`)

| Row | Prior gap | Re-verification |
|---|---|---|
| **A10.4 Post** — Empty | "No zero-content state" | `BodyReactionsBody.swift:193-201` and `BodyReactionsBody.kt:152-189` render `EmptyThreadState` (`PostThreadComponents.swift:164-208`) when `comments.isEmpty`: dashed-bordered card with 48×48 primary50 icon circle (`messageSquarePlus`), "Be the first to reply" headline, intent-specific subcopy, and quick-reply prompt chips. Matches the designed "Just posted — 0 comments" frame from `A10.4 Post.html`. |
| **A17.2 Booklet** — Grid view | "No thumbnail-grid toggle" | `BookletPager.swift:23-26, 47-57` and `BookletPager.kt:73, 114-126` ship `BookletPagerMode { Page, Grid }` with a "View all pages" toggle button (page-mode → grid-mode) and a 3-column `LazyVerticalGrid` of thumbnails (grid-mode → tap a thumbnail returns to page-mode at that page). |

### Remaining gaps (still partial — surfaced, not papered over)

These three screens still do not render their designed secondary frame, so
the "100% complete" acceptance line **cannot** be honestly claimed without a
follow-up implementation prompt:

1. **Identity Center — First-run chrome elements**
   - **Pack:** A08 (`uploads/Pantopus-design/Identity Center.html` FRAME 2 ·
     FIRST RUN; `identity-center-frames.jsx` → `FrameFirstRun`)
   - **Missing:**
     (a) the disabled "Profile links" placeholder card with `link-2-off` icon
     and copy "Nothing to link yet. Create a Persona or Professional profile
     to choose how it appears next to your Local profile.";
     (b) the primary-tinted "Two more profiles to go" info card at the bottom
     of the loaded frame.
   - **Why missing:** the iOS view only renders the bridges card when
     `!loaded.bridges.isEmpty` (`IdentityCenterView.swift:108-112`) — there
     is no rendered placeholder when bridges are empty. The trailing
     "Two more profiles to go" info card is not present on either platform
     (no string match for "profiles to go" or "Nothing to link" in
     `Features/IdentityCenter/` or `screens/identity_center/`).
   - **Prompt that should have addressed this:** P5.9 (the Identity Center
     follow-up) — or a dedicated `IdentityCenterFirstRunChrome` prompt.

2. **Public Beacon Profile — Persona·owner + Empty (Quiet for now)**
   - **Pack:** A08 (`uploads/Pantopus-design/Public Beacon Profile.html` +
     `beacon-frames.jsx` → `FramePersonaOwner` at L625, `FrameEmpty` at L734)
   - **(a) Persona·owner missing:** the JSX header switches on
     `role === 'owner'` (L260-265) to render owner chrome — a `bar-chart-3`
     ghost button and an `Edit` pencil ghost button instead of the visitor's
     `share` + `Follow` pair — plus the `AnalyticsStrip` and the
     `FloatingBack right="settings"` affordance. The current code branches
     only on `payload.kind == .local` (`PublicProfileView.swift:106` and
     `PublicProfileScreen.kt:102-115`); there is no second axis for
     viewer-role, no `isOwner` / `viewer.isOwner` field anywhere in
     `PublicProfileContent`, and `stickyFooter` always returns the visitor
     CTA for personas (`PublicProfileView.swift:174-188`). No "Edit"
     affordance in either overflow menu (`PublicProfileView.swift:55-67`).
   - **(b) Empty ("Quiet for now") missing:** `PublicProfilePostsFeed` on
     both platforms renders a single line "No broadcasts yet — check back
     soon." (`PublicProfileChrome.swift:396-402` and
     `PublicProfileChrome.kt:387-401`) — *not* the designed full empty card:
     72×72 primary50 circle with `radio-tower` icon (size 32, stroke 1.6) +
     "Quiet for now" headline (17pt bold) + body copy (max-width 240) +
     `bell-plus` "Notify when live" primary CTA. The plain-text fallback is
     functionally graceful but visually thin.
   - **Prompt that should have addressed this:** the originally-scoped Public
     Beacon Profile wave (Wave A coverage of A08 beacons). Recommend a
     dedicated `PublicProfileOwnerChromeAndEmpty` follow-up to add
     viewer-role branching, `OwnerHeaderControls` (analytics + edit),
     `AnalyticsStrip`, and a proper `PersonaEmptyBroadcastsCard`.

3. **A15.4 Creator thread — Secondary (quota-exhausted lock)**
   - **Pack:** Chat conversation (`A15.4 - Creator thread.html` → JSX
     `QuotaExhaustedThread`)
   - **Missing:**
     (a) quota meter's `maxed` state (error-red fill + "5 of 5" count
     coloured `var(--color-error)`);
     (b) the warning-tinted system pill "You've used your N weekly <tier>
     replies with <fan>";
     (c) the inline upgrade-fan upsell card ("Invite <fan> to Gold ·
     Unlimited replies · $15/mo · she keeps Bronze perks");
     (d) the locked composer (`composer-wrap.locked`): dashed input border,
     italic muted "Out of replies until Monday" placeholder, lock icon,
     disabled send, and the alert-triangle lock-row "<Tier> cap reached.
     Upgrade <fan> or wait for the reset.".
   - **Why missing:** the quota meter on iOS
     (`ChatConversationView.swift:1071-1117`) and Android
     (`ChatConversationScreen.kt` `CreatorQuotaMeter`) always renders the
     primary-blue fill — no branch on `quota.used ≥ quota.total`. The
     composer's `canSend` is only `!text.isEmpty && !isSending` on iOS
     (`ChatConversationViewModel.swift:86-88`) and identical on Android — no
     creator-quota lock check. No `maxed` / `quotaExhausted` /
     `composerLocked` / "cap reached" strings exist on either platform.
   - **Prompt that should have addressed this:** D2 (the Creator-thread
     wave-D prompt) — the populated state shipped but the secondary
     quota-exhausted lock state was not implemented. Recommend a dedicated
     `CreatorThreadQuotaExhaustedLock` follow-up.

### Heuristic note (why prior counts differ from these)

The prior 2026-05-26 inventory used a structural heuristic — "if the state
enum has only `.loading / .loaded / .error`, mark the empty state as
missing." That heuristic over-counts the A10.4 Post empty card, which is
emitted as an `if list.isEmpty { EmptyThreadState … } else { … }` branch
inside `.loaded` and matches the full design. P8.1's deeper read inspects
the rendered body rather than the enum shape, which is the more honest
"are the designed frames rendered" test. The remaining three gaps survive
both heuristics — Identity Center, Public Beacon Profile (both states),
and Creator-thread quota-exhausted are genuine missing chrome elements
that no current view body produces.
