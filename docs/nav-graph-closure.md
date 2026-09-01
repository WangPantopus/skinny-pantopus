# Navigation-graph closure — iOS & Android (post-Wave-D)

> **Method.** Walked both signed-in navigation graphs from their roots:
> iOS `Features/Root/RootTabView.swift` → the four `…TabRoot.swift` stacks
> (`HubRoute` / `YouRoute` / `InboxRoute` / `NearbyRoute`); Android
> `ui/screens/root/RootTabScreen.kt` (`PantopusRoute` tabs + the flat
> `ChildRoutes` NavHost). Every route case was classified by what its
> `destination(for:)` / `composable{}` body renders, and inbound references
> were counted by grepping the actual navigation verbs (`push(.x)` /
> `path.append(.x)` / `return .x` on iOS; multiline-aware
> `navigate(ChildRoutes.x)` on Android) across the whole app tree.
>
> **Generated:** 2026-05-26. Supersedes the 2026-05-18 pre-wave audit (which
> predated the Wave B mailbox rework and the Wave A `…Detail`/map screens —
> e.g. the old `.mailboxDrawers` / `.mailbox` / `.drawerDetail` routes are
> gone, replaced by `.mailboxRoot`).
>
> **Post-rewire update (2026-05-26):** the 16 stale call sites called out in
> the original Section 5 Group A — plus the iOS `Snap & sell` / `Gig detail`
> equivalents on Android and the two `Share business` / `Share membership`
> placeholders that should have always been system share sheets — have been
> rewired. Placeholder labels dropped **iOS 40 → 23**, **Android 33 → 24**
> (both clear the `<25` sanity bar). Counts and tables below reflect the
> post-rewire state.
>
> **Reachability tokens (grep-able):** `REAL_VIEW` · `NOT_YET_AVAILABLE` ·
> `PLACEHOLDER` · `NO_ROUTE`.
> - `REAL_VIEW` — case renders a concrete feature view (e.g.
>   `TodayDetailView()`, `MembershipDetailScreen(...)`).
> - `NOT_YET_AVAILABLE` — renders `NotYetAvailableView(tabName:)`.
> - `PLACEHOLDER` — the route case/constant is itself the generic
>   `.placeholder(label:)` / `ChildRoutes.PLACEHOLDER` funnel (it renders
>   `NOT_YET_AVAILABLE`). Listed once per platform; the labels pushed into it
>   are catalogued in **Section 5**.
> - **inbound = N** — number of distinct navigation call sites that reach the
>   case. `inbound = 0` ⇒ orphan (**Section 3**).

## Closure summary

| Platform | Route cases | `REAL_VIEW` | `NOT_YET_AVAILABLE` funnel | Orphans (inbound 0) | Dead screens |
|---|---:|---:|---:|---:|---:|
| iOS | 176 (Hub 84 · You 84 · Inbox 3 · Nearby 5) | 173 | 3 (`.placeholder` ×3 tabs) | 9 | 2 |
| Android | 121 composables (4 tab + 117 child) | 120 | 1 (`PLACEHOLDER`) | 3 | 4 |

- **No route on either platform is reachable only through a
  `NOT_YET_AVAILABLE` body** except the dedicated placeholder funnels — every
  other case renders a real view.
- **Placeholder labels still wired:** **23 distinct (iOS) / 24 (Android)** —
  both under the `<25` sanity bar after the stale-rewire pass. Every
  remaining label is an intentional `DEFER` (payments, membership/broadcast
  management, moderation, business management, identity sub-details — none
  of which are screens in the 8 design packs). **`BUILD` = 0**: every
  designed pack screen is shipped, consistent with
  `docs/screen-parity-inventory.md`.

---

## Section 1 — iOS routes per tab

Legend: **T** = destination type (`R`=`REAL_VIEW`, `N`=`NOT_YET_AVAILABLE`),
**In** = inbound count. Root screen = the tab body (not a route case).

### Hub tab — root `HubView` · `HubRoute` (84 cases)

| Route case | T | In | Notes |
|---|---|---:|---|
| `myHomes` | R | 0 | **ORPHAN** — duplicated in You tab; dead in Hub |
| `myClaims` | R | 2 | |
| `mailItemDetail(mailId:)` | R | 4 | |
| `mailboxVault` | R | 0 | **ORPHAN** — vestigial after Wave B mailbox rework |
| `addHome` | R | 5 | |
| `claimOwnership(homeId:)` | R | 1 | |
| `homeDashboard(homeId:)` | R | 4 | |
| `homePets(homeId:)` | R | 1 | |
| `homeEmergency(homeId:)` | R | 1 | |
| `addEmergencyInfo(homeId:)` | R | 1 | |
| `emergencyItem(homeId:,emergencyId:)` | R | 1 | |
| `homeDocs(homeId:)` | R | 1 | |
| `uploadDocument(homeId:)` | R | 2 | |
| `documentDetail(homeId:,documentId:)` | R | 4 | |
| `documentSearch(homeId:)` | R | 1 | |
| `homePackages(homeId:)` | R | 1 | |
| `packageDetail(homeId:,packageId:)` | R | 2 | |
| `logPackage(homeId:)` | R | 1 | |
| `homeTasks(homeId:)` | R | 1 | |
| `addHouseholdTask(homeId:)` | R | 1 | |
| `editHouseholdTask(homeId:,taskId:)` | R | 1 | |
| `homeMaintenance(homeId:)` | R | 1 | |
| `logMaintenance(homeId:)` | R | 1 | |
| `maintenanceDetail(homeId:,taskId:)` | R | 2 | |
| `editMaintenance(homeId:,taskId:)` | R | 1 | |
| `homeMembers(homeId:)` | R | 1 | |
| `publicProfile(userId:)` | R | 4 | |
| `businessProfile(businessId:)` | R | 3 | |
| `pulsePost(postId:)` | R | 4 | |
| `homeBills(homeId:)` | R | 1 | |
| `homeCalendar(homeId:)` | R | 1 | |
| `addCalendarEvent(homeId:,eventId:,…)` | R | 2 | |
| `calendarEventDetail(homeId:,eventId:)` | R | 3 | |
| `billDetail(homeId:,billId:)` | R | 2 | |
| `addBill(homeId:,billId:)` | R | 2 | |
| `homePolls(homeId:)` | R | 1 | |
| `pollDetail(homeId:,pollId:)` | R | 2 | |
| `startPoll(homeId:)` | R | 2 | |
| `pulseFeed` | R | 2 | |
| `composePost(intent:)` | R | 1 | |
| `editPost(postId:)` | R | 1 | |
| `gigsFeed` | R | 4 | |
| `gigSearch` | R | 1 | |
| `gigDetail(gigId:)` | R | 10 | |
| `nearbyMapForGigs(categoryKey:)` | R | 0 | **ORPHAN** — superseded by `tasksMap` (A11.1) |
| `composeGig(category:)` | R | 3 | |
| `quickPostGig(category:)` | R | 1 | |
| `marketplace` | R | 2 | |
| `listingDetail(listingId:)` | R | 6 | |
| `composeListing` | R | 2 | |
| `editListing(listingId:,jumpToStep:)` | R | 2 | |
| `invoiceDetail(invoiceId:)` | R | 0 | **ORPHAN** — deferred (wallet/payments not shipped) |
| `notifications` | R | 1 | |
| `connections` | R | 2 | also deep-link `pantopus://connections` |
| `supportTrains` | R | 1 | also deep-link `support-trains` |
| `startSupportTrain` | R | 1 | |
| `reviewSignups(supportTrainId:)` | R | 4 | |
| `searchSupportTrains` | R | 1 | |
| `editSignup(reservation:)` | R | 1 | |
| `reviewClaims` | R | 1 | |
| `reviewClaimDetail(claimId:)` | R | 1 | |
| `myBids` | R | 0 | **ORPHAN** — duplicated in You tab; dead in Hub |
| `listingOffers(listingId:,title:)` | R | 1 | |
| `discoverHub` | R | 2 | also deep-link `discover-hub` |
| `discoverBusinesses` | R | 1 | |
| `chatConversation(dest)` | R | 5 | |
| `recentActivity` | R | 1 | |
| `menu` | R | 1 | → `SettingsView` |
| `editProfile` | R | 1 | |
| `mailboxSearch` | R | 1 | |
| `placeholder(label:)` | **N** | 12 | generic funnel → `NotYetAvailableView`; labels in §5 |
| `todayDetail` | R | 1 | |
| `propertyDetails(homeId:)` | R | 1 | |
| `addGuest(homeId:)` | R | 1 | full-screen modal |
| `tasksMap(categoryKey:)` | R | 1 | |
| `explore` | R | 1 | |
| `mailboxRoot` | R | 3 | |
| `mailboxMap` | R | 1 | |
| `accessCodes(homeId:,homeName:)` | R | 1 | added in rewire (mirror of `YouRoute.accessCodes`) |
| `editAccessCode(homeId:,secretId:,…)` | R | 3 | added in rewire |
| `searchAccessCodes(homeId:)` | R | 1 | added in rewire |
| `tokenGallery` | R | 1 | DEBUG (5-tap) |
| `iconGallery` | R | 0 | DEBUG · **ORPHAN** (no trigger wired) |
| `componentGallery` | R | 0 | DEBUG · **ORPHAN** (no trigger wired) |

### You tab — root `MeView` · `YouRoute` (84 cases)

| Route case | T | In | Notes |
|---|---|---:|---|
| `signOutConfirm` | R | 0 | **ORPHAN** — renders `EmptyView`; sign-out is a `confirmationDialog`. Vestigial |
| `mailboxRoot` | R | 1 | |
| `mailboxMap` | R | 1 | |
| `mailItemDetail(mailId:)` | R | 2 | |
| `mailboxSearch` | R | 1 | |
| `settings` | R | 1 | |
| `placeholder(label:)` | **N** | 31 | generic funnel → `NotYetAvailableView`; labels in §5 |
| `offers` | R | 2 | |
| `myBids` | R | 2 | |
| `myTasks` | R | 2 | |
| `composeTask` | R | 4 | |
| `myPosts` | R | 2 | |
| `editPost(postId:)` | R | 2 | MyPosts per-row edit + PulsePostDetail edit affordance |
| `connections` | R | 2 | |
| `supportTrains` | R | 2 | |
| `startSupportTrain` | R | 1 | |
| `reviewSignups(supportTrainId:)` | R | 3 | |
| `searchSupportTrains` | R | 1 | |
| `editSignup(reservation:)` | R | 1 | |
| `myHomes` | R | 2 | |
| `myListings` | R | 2 | |
| `myBusinesses` | R | 2 | |
| `businessWaitlist` | R | 1 | |
| `homeDashboard(homeId:)` | R | 1 | |
| `identityCenter` | R | 1 | |
| `audienceProfile` | R | 3 | |
| `broadcastDetail(broadcastId:,card:,…)` | R | 1 | |
| `creatorInbox` | R | 3 | |
| `creatorInboxConversation(dest)` | R | 1 | |
| `homeBills(homeId:)` | R | 3 | |
| `homePets(homeId:)` | R | 2 | |
| `homeCalendar(homeId:)` | R | 1 | |
| `addCalendarEvent(homeId:,eventId:,…)` | R | 2 | |
| `calendarEventDetail(homeId:,eventId:)` | R | 3 | |
| `homeEmergency(homeId:)` | R | 3 | |
| `addEmergencyInfo(homeId:)` | R | 1 | |
| `emergencyItem(homeId:,emergencyId:)` | R | 1 | |
| `homeDocs(homeId:)` | R | 3 | |
| `uploadDocument(homeId:)` | R | 2 | |
| `documentDetail(homeId:,documentId:)` | R | 3 | |
| `documentSearch(homeId:)` | R | 1 | |
| `homePackages(homeId:)` | R | 3 | |
| `packageDetail(homeId:,packageId:)` | R | 2 | |
| `logPackage(homeId:)` | R | 1 | |
| `homePolls(homeId:)` | R | 3 | |
| `pollDetail(homeId:,pollId:)` | R | 1 | |
| `startPoll(homeId:)` | R | 1 | |
| `accessCodes(homeId:,homeName:)` | R | 2 | |
| `editAccessCode(homeId:,secretId:,…)` | R | 3 | |
| `searchAccessCodes(homeId:)` | R | 1 | |
| `homeTasks(homeId:)` | R | 3 | |
| `addHouseholdTask(homeId:)` | R | 1 | |
| `editHouseholdTask(homeId:,taskId:)` | R | 1 | |
| `homeMaintenance(homeId:)` | R | 3 | |
| `logMaintenance(homeId:)` | R | 1 | |
| `maintenanceDetail(homeId:,taskId:)` | R | 2 | |
| `editMaintenance(homeId:,taskId:)` | R | 1 | |
| `homeOwners(homeId:)` | R | 1 | |
| `homeMembers(homeId:)` | R | 3 | |
| `listingOffers(listingId:,title:)` | R | 1 | |
| `gigDetail(gigId:)` | R | 9 | |
| `listingDetail(listingId:)` | R | 3 | |
| `chatConversation(dest)` | R | 4 | |
| `editListing(listingId:,jumpToStep:)` | R | 2 | |
| `membershipDetail(personaId:)` | R | 1 | |
| `professionalProfile` | R | 1 | |
| `editPersona(personaId:)` | R | 1 | |
| `composeBroadcast(personaId:)` | R | 1 | |
| `publicProfile(userId:)` | R | 3 | promoted from DEBUG in rewire |
| `pulsePost(postId:)` | R | 2 | promoted from DEBUG in rewire |
| `composePost(intent:)` | R | 1 | added in rewire |
| `billDetail(homeId:,billId:)` | R | 2 | added in rewire |
| `addBill(homeId:,billId:)` | R | 2 | added in rewire |
| `gigsFeed` | R | 2 | added in rewire (Browse tasks/gigs from You) |
| `marketplace` | R | 1 | added in rewire (Browse listings from You) |
| `composeListing` | R | 2 | added in rewire (List something) |
| `addHome` | R | 2 | added in rewire (Claim a home) |
| `claimOwnership(homeId:)` | R | 1 | added in rewire |
| `myClaims` | R | 2 | added in rewire |
| `businessProfile(businessId:)` | R | 0 | DEBUG · **ORPHAN** (declared, never pushed even in debug) |
| `privacyHandshake(personaHandle:)` | R | 2 | DEBUG |
| `statusWaiting` | R | 1 | DEBUG |
| `ceremonialMail` | R | 2 | DEBUG |
| `ceremonialMailOpen(mailId:)` | R | 1 | DEBUG |

### Inbox tab — root `ChatListView` · `InboxRoute` (3 cases)

| Route case | T | In | Notes |
|---|---|---:|---|
| `conversation(dest)` | R | 3 | from row tap, compose pick, search result |
| `compose` | R | 1 | → `NewMessageView` |
| `search` | R | 1 | → `ChatSearchView` |

### Nearby tab — root `NearbyMapView` · `NearbyRoute` (5 cases)

| Route case | T | In | Notes |
|---|---|---:|---|
| `entityDetail(kind:,id:)` | R | 1 | → Gig/Listing detail by `MapEntityKind` |
| `placeholder(label:)` | **N** | 1 | generic funnel → `NotYetAvailableView`; labels in §5 |
| `listingOffers(listingId:,title:)` | R | 1 | |
| `editListing(listingId:,jumpToStep:)` | R | 2 | |
| `publicProfile(userId:)` | R | 1 | added in rewire (Buyer profile from `ListingOffersView`) |

---

## Section 2 — Android routes (per tab + flat child graph)

Android uses a **single flat `NavHost`** rooted in `RootTabScreen.kt`: the 4
`PantopusRoute` tabs plus all `ChildRoutes` destinations hang off one graph
(any child is reachable from whichever tab is active — there are no per-tab
back-stacks like iOS). All 121 `composable(...)` blocks below are `REAL_VIEW`
except the single `PLACEHOLDER` funnel.

### Tab roots (`PantopusRoute`, bottom bar)

| Composable route | Renders | T | In |
|---|---|---|---:|
| `Hub.path` (`root/hub`) | `HubScreen` | R | bar + 1 deep-link |
| `Nearby.path` (`root/nearby`) | `NearbyMapScreen` | R | bar |
| `Inbox.path` (`root/inbox`) | `InboxScreen` | R | bar + 1 deep-link |
| `You.path` (`root/you`) | `YouScreen` | R | bar |

### Child destinations (`ChildRoutes`, in NavHost source order)

| Composable route | Renders | T | In | Notes |
|---|---|---|---:|---|
| `MY_HOMES` | `MyHomesListScreen` | R | 1 | |
| `MY_LISTINGS` | `MyListingsScreen` | R | 1 | |
| `MY_BUSINESSES` | `MyBusinessesScreen` | R | 1 | |
| `HOME_DASHBOARD` | `HomeDashboardScreen` | R | 5 | |
| `HOME_BILLS` | `BillsListScreen` | R | 2 | |
| `BILL_DETAIL` | `BillDetailScreen` | R | 2 | |
| `ADD_BILL` | `AddBillWizardScreen` | R | 1 | |
| `EDIT_BILL` | `AddBillWizardScreen` | R | 1 | |
| `HOME_PETS` | `PetsListScreen` | R | 2 | |
| `HOME_CALENDAR` | `HomeCalendarScreen` | R | 2 | |
| `ADD_CALENDAR_EVENT` | `AddEventFormScreen` | R | 2 | |
| `CALENDAR_EVENT_DETAIL` | `EventDetailScreen` | R | 3 | |
| `HOME_EMERGENCY` | `EmergencyInfoScreen` | R | 1 | |
| `ADD_EMERGENCY_INFO` | `AddEmergencyInfoFormScreen` | R | 1 | |
| `EDIT_EMERGENCY_INFO` | `AddEmergencyInfoFormScreen` | R | 1 | |
| `EMERGENCY_ITEM` | `EmergencyInfoDetailScreen` | R | 1 | |
| `HOME_PACKAGES` | `PackagesListScreen` | R | 2 | |
| `HOME_POLLS` | `PollsListScreen` | R | 2 | |
| `START_POLL` | `StartPollFormScreen` | R | 1 | |
| `HOME_DOCS` | `DocumentsScreen` | R | 1 | |
| `DOCUMENT_SEARCH` | `DocumentSearchScreen` | R | 1 | |
| `UPLOAD_DOCUMENT` | `UploadDocumentFormScreen` | R | 2 | |
| `DOCUMENT_DETAIL` | `DocumentDetailScreen` | R | 3 | |
| `POLL_DETAIL` | `PollDetailScreen` | R | 1 | |
| `ACCESS_CODES` | `AccessCodesScreen` | R | 2 | |
| `ACCESS_CODES_SEARCH` | `AccessCodesSearchScreen` | R | 1 | |
| `EDIT_ACCESS_CODE` | `EditAccessCodeFormScreen` | R | 3 | |
| `HOME_TASKS` | `HouseholdTasksListScreen` | R | 2 | |
| `ADD_HOUSEHOLD_TASK` | `AddHouseholdTaskFormScreen` | R | 1 | |
| `EDIT_HOUSEHOLD_TASK` | `AddHouseholdTaskFormScreen` | R | 1 | |
| `HOME_MAINTENANCE` | `MaintenanceListScreen` | R | 2 | |
| `LOG_MAINTENANCE` | `LogMaintenanceFormScreen` | R | 1 | |
| `EDIT_MAINTENANCE` | `LogMaintenanceFormScreen` | R | 1 | |
| `MAINTENANCE_DETAIL` | `MaintenanceDetailScreen` | R | 2 | |
| `HOME_OWNERS` | `OwnersListScreen` | R | 1 | |
| `PACKAGE_DETAIL` | `PackageDetailScreen` | R | 2 | |
| `LOG_PACKAGE` | `LogPackageScreen` | R | 1 | |
| `HOME_MEMBERS` | `MembersListScreen` | R | 2 | |
| `MAILBOX_ITEM_DETAIL` | `MailDetailScreen` | R | 5 | |
| `PUBLIC_PROFILE` | `PublicProfileScreen` | R | 5 | |
| `BUSINESS_PROFILE` | `BusinessProfileScreen` | R | 3 | |
| `PULSE_POST` | `PulsePostDetailScreen` | R | 6 | |
| `INVITE_OWNER` | `InviteOwnerFormScreen` | R | 3 | |
| `DISAMBIGUATE_MAIL` | `DisambiguateMailFormScreen` | R | 1 | |
| `MAILBOX_VAULT` | `VaultListScreen` | R | 0 | **ORPHAN** — vestigial after Wave B |
| `CHAT_CONVERSATION` | `ChatConversationHost` | R | 8 | row/picker/creator/search |
| `CHAT_SEARCH` | `ChatSearchScreen` | R | 1 | |
| `NEW_MESSAGE` | `NewMessageScreen` | R | 1 | |
| `PULSE_FEED` | `FeedScreen` | R | 3 | |
| `MARKETPLACE` | `MarketplaceScreen` | R | 2 | |
| `LISTING_DETAIL` | `ListingDetailScreen` | R | 9 | |
| `LISTING_OFFERS` | `ListingOffersScreen` | R | 1 | |
| `INVOICE_DETAIL` | `InvoiceDetailScreen` | R | 0 | **ORPHAN** — deferred (payments) |
| `COMPOSE_LISTING` | `ListingComposeWizardScreen` | R | 1 | |
| `EDIT_LISTING` | `ListingComposeWizardScreen` | R | 2 | |
| `GIGS_FEED` | `GigsFeedScreen` | R | 4 | |
| `GIG_SEARCH` | `GigSearchScreen` | R | 1 | |
| `GIG_DETAIL` | `GigDetailScreen` | R | 20 | |
| `NEARBY_MAP_FOR_GIGS` | `NearbyMapScreen` | R | 0 | **ORPHAN** — superseded by `TASKS_MAP` |
| `QUICK_POST_GIG` | `PostGigV1Screen` | R | 1 | |
| `COMPOSE_GIG` | `GigComposeWizardScreen` | R | 2 | |
| `COMPOSE_POST` | `PulseComposeScreen` | R | 1 | |
| `EDIT_POST` | `PulseComposeScreen` | R | 2 | |
| `NOTIFICATIONS` | `NotificationsScreen` | R | 2 | |
| `RECENT_ACTIVITY` | `RecentActivityScreen` | R | 1 | |
| `CONNECTIONS` | `ConnectionsScreen` | R | 3 | |
| `DISCOVER_HUB` | `DiscoverHubScreen` | R | 2 | |
| `DISCOVER_BUSINESSES` | `DiscoverBusinessesScreen` | R | 1 | |
| `OFFERS` | `OffersScreen` | R | 1 | |
| `MY_BIDS` | `MyBidsScreen` | R | 1 | |
| `MY_TASKS` | `MyTasksScreen` | R | 1 | |
| `COMPOSE_TASK` | `GigComposeWizardScreen` | R | 3 | |
| `MY_POSTS` | `MyPostsScreen` | R | 1 | |
| `MENU` | `SettingsIndexScreen` | R | 2 | |
| `EDIT_PROFILE` | `EditProfileScreen` | R | 2 | |
| `SETTINGS_NOTIFICATIONS` | `NotificationSettingsScreen` | R | 1 | |
| `SETTINGS_PRIVACY` | `PrivacySettingsScreen` | R | 1 | |
| `SETTINGS_BLOCKED_USERS` | `BlockedUsersScreen` | R | 1 | |
| `SETTINGS_PASSWORD` | `PasswordChangeScreen` | R | 1 | |
| `SETTINGS_VERIFICATION` | `VerificationCenterScreen` | R | 1 | |
| `SETTINGS_HELP` | `HelpCenterScreen` | R | 1 | |
| `SETTINGS_LEGAL` | `LegalIndexScreen` | R | 1 | |
| `SETTINGS_LEGAL_CONTENT` | `LegalContentScreen` | R | 1 | `NotYetAvailableView("Legal")` only as a defensive fallback for an unknown `doc` param |
| `SETTINGS_ABOUT` | `AboutScreen` | R | 1 | |
| `PRIVACY_HANDSHAKE` | `PrivacyHandshakeScreen` | R | 2 | |
| `TOKEN_ACCEPT` | `TokenAcceptScreen` | R | 2 | + invite deep-link |
| `CEREMONIAL_MAIL` | `CeremonialMailWizardScreen` | R | 2 | |
| `CEREMONIAL_MAIL_OPEN` | `CeremonialMailOpenScreen` | R | 1 | |
| `AUDIENCE_PROFILE` | `AudienceProfileScreen` | R | 5 | |
| `BROADCAST_DETAIL` | `BroadcastDetailScreen` | R | 1 | |
| `CREATOR_INBOX` | `CreatorInboxScreen` | R | 3 | |
| `IDENTITY_CENTER` | `IdentityCenterScreen` | R | 2 | |
| `MAILBOX_SEARCH` | `MailboxSearchScreen` | R | 1 | |
| `SUPPORT_TRAINS` | `SupportTrainsScreen` | R | 2 | |
| `SUPPORT_TRAINS_SEARCH` | `SupportTrainsSearchScreen` | R | 1 | |
| `START_SUPPORT_TRAIN` | `StartSupportTrainWizardScreen` | R | 1 | |
| `REVIEW_SIGNUPS` | `ReviewSignupsScreen` | R | 3 | |
| `EDIT_SIGNUP` | `EditSignupFormScreen` | R | 1 | |
| `REVIEW_CLAIMS` | `ReviewClaimsScreen` | R | 1 | |
| `REVIEW_CLAIM_DETAIL` | `ReviewClaimDetailScreen` | R | 1 | |
| `PLACEHOLDER` | `NotYetAvailableView(label)` | **N** | 36 | generic funnel; labels in §5 |
| `TODAY_DETAIL` | `TodayDetailScreen` | R | 1 | |
| `PROPERTY_DETAILS` | `PropertyDetailsScreen` | R | 1 | |
| `ADD_GUEST` | `AddGuestFormScreen` | R | 1 | |
| `TASKS_MAP` | `TasksMapScreen` | R | 1 | |
| `EXPLORE` | `ExploreMapScreen` | R | 1 | |
| `MAILBOX_ROOT` | `MailboxRootScreen` | R | 5 | |
| `MAILBOX_MAP` | `MailboxMapScreen` | R | 1 | |
| `MEMBERSHIP_DETAIL` | `MembershipDetailScreen` | R | 1 | |
| `PROFESSIONAL_PROFILE` | `ProfessionalProfileScreen` | R | 1 | |
| `EDIT_PERSONA` | `EditPersonaScreen` | R | 1 | |
| `COMPOSE_BROADCAST` | `ComposeBroadcastScreen` | R | 1 | |
| `ADD_HOME` | `AddHomeWizardScreen` | R | 5 | |
| `BUSINESS_WAITLIST` | `BusinessWaitlistScreen` | R | 1 | |
| `CLAIM_OWNERSHIP` | `ClaimOwnershipWizardScreen` | R | 1 | |
| `MY_CLAIMS` | `MyClaimsListScreen` | R | 2 | |
| `TOKEN_GALLERY` | `TokenGalleryScreen` | R | 1 | DEBUG (`BuildConfig.DEBUG`, 5-tap) |

---

## Section 3 — Orphans (zero inbound)

### iOS

| Tab · case | Disposition |
|---|---|
| Hub · `mailboxVault` | **REMOVE** — vestigial after Wave B mailbox rework. The Vault is now a surface inside `MailboxRootView`; nothing pushes `.mailboxVault`. Removing it also orphans `VaultListView` (see §4). |
| Hub · `nearbyMapForGigs(categoryKey:)` | **REMOVE** — superseded by `tasksMap` (A11.1, Wave A). The Gigs-feed map toggle pushes `.tasksMap`; `.nearbyMapForGigs` is the pre-Wave-A path. |
| Hub · `invoiceDetail(invoiceId:)` | **KEEP (deferred)** — wallet/payments surfaces that would push it aren't shipped. Currently the only door to `InvoiceDetailView`. |
| Hub · `myHomes` | **REMOVE** — exact duplicate of `YouRoute.myHomes` (inbound 2). My Homes is reached from the You tab; the Hub copy is dead. |
| Hub · `myBids` | **REMOVE** — duplicate of `YouRoute.myBids` (inbound 2). The doc-comment claims a "Hub marketplace pillar shelf" entry that was never wired. |
| Hub · `iconGallery` (DEBUG) | **KEEP (debug)** — gallery handler exists but no trigger is wired (only `tokenGallery` is on the 5-tap). Wire-on-demand; harmless (DEBUG-gated). |
| Hub · `componentGallery` (DEBUG) | **KEEP (debug)** — same as `iconGallery`. |
| You · `signOutConfirm` | **REMOVE** — renders `EmptyView()`; the real sign-out is the `confirmationDialog` bound to `showsSignOutConfirm`. Pure vestige. |
| You · `businessProfile(businessId:)` (DEBUG) | **REMOVE** — declared "for debug parity" but no debug affordance pushes it. The live Business Profile entry points are on `HubRoute`. |

### Android

| Route | Disposition |
|---|---|
| `MAILBOX_VAULT` | **REMOVE** — vestigial after Wave B (mirrors iOS). No `navigate(MAILBOX_VAULT)` / `mailboxVault()` call site; removing it orphans `VaultListScreen` (see §4). |
| `NEARBY_MAP_FOR_GIGS` | **REMOVE** — superseded by `TASKS_MAP` (mirrors iOS). |
| `INVOICE_DETAIL` | **KEEP (deferred)** — payments not shipped (mirrors iOS). |

> The three cross-platform orphans (`mailboxVault`, `nearbyMapForGigs`,
> `invoiceDetail`) are consistent on both platforms. The extra iOS orphans
> (`myHomes`, `myBids`, `signOutConfirm`, debug `businessProfile`/galleries)
> are artifacts of iOS having **per-tab** route enums where Hub re-declares
> cases that live in You; Android's single flat graph declares each once.

---

## Section 4 — Dead screens (no route reaches them)

### iOS (`*View.swift` instantiated by no route and consumed by no parent)

| Screen file | Disposition |
|---|---|
| `Homes/AddHome/AddHomeFindStepView.swift` | **REMOVE** — vestigial. The Add-Home flow is the consolidated `AddHomeWizardView` (routed via `.addHome`); the standalone find-step view is superseded (A12.1 "Find your home" is now step 1 inside the wizard). |
| `Mailbox/ItemDetail/MailboxItemDetailView.swift` | **REMOVE** — vestigial after Wave B. The routed mail-detail host is `MailDetailView` (`.mailItemDetail`); this parallel host is instantiated nowhere. (Its `ItemDetail/Bodies/*Body.swift` are still consumed by `MailDetailView`, so only this host file is dead.) |

Reachable **only via an orphan route** (transitively dead until §3 is
resolved): `VaultListView` (only `Hub.mailboxVault`) and `InvoiceDetailView`
(only `Hub.invoiceDetail`).

### Android (`fun *Screen(` defined but invoked by no `composable`/parent)

| Screen composable · file | Disposition |
|---|---|
| `InviteOwnerWizardScreen` · `homes/invite_owner/InviteOwnerFormScreen.kt` | **REMOVE** — the routed invite-owner destination is `InviteOwnerFormScreen` (single-page form); the wizard variant in the same file is never called. |
| `MailboxItemDetailScreen` · `mailbox/item_detail/MailboxItemDetailScreen.kt` | **REMOVE** — vestigial after Wave B (mirrors iOS `MailboxItemDetailView`); routed host is `MailDetailScreen`. |
| `MailboxDrawersScreen` · `mailbox/MailboxDrawersScreen.kt` | **REMOVE** — vestigial after Wave B; superseded by `MailboxRootScreen`. (Divergence: iOS keeps `MailboxDrawersView` as a live subcomponent of `MailboxRootView`; the Android composable is dead.) |
| `MailboxListScreen` · `mailbox/MailboxListScreen.kt` | **REMOVE** — vestigial after Wave B; superseded by `MailboxRootScreen`. (Same iOS/Android divergence as above.) |

Reachable **only via an orphan route**: `VaultListScreen` (only
`MAILBOX_VAULT`) and `InvoiceDetailScreen` (only `INVOICE_DETAIL`).

---

## Section 5 — Placeholder catalog

Both platforms funnel every not-yet-built destination through one generic
sink — iOS `case .placeholder(label:) → NotYetAvailableView(tabName: label)`
(present in Hub/You/Nearby), Android
`ChildRoutes.PLACEHOLDER → NotYetAvailableView(tabName = label)`. The
distinct **labels** pushed into that sink are the real catalog of missing
destinations.

**Post-rewire totals: 23 distinct (iOS) · 24 distinct (Android)** — both
under the `<25` sanity bar. **`BUILD` = 0**: every screen in the 8 design
packs is shipped (see `docs/screen-parity-inventory.md`). Every remaining
label is an intentional **`DEFER`** for a feature with no pack screen
(payments, membership/broadcast management, moderation, business management,
identity sub-details, etc.).

### Group A — STALE (RESOLVED in rewire pass)

All 16 originally-identified stale call sites have been rewired off
`.placeholder(...)` to the shipped screen. The structural ones (the You
stack lacking `addHome` / `claimOwnership` / `myClaims` / `marketplace` /
`gigsFeed` / `pulsePost` / `composePost` / `composeListing` / `billDetail` /
`addBill` / `publicProfile` cases) were fixed by adding the missing cases
to `YouRoute`; Hub gained `accessCodes` / `editAccessCode` /
`searchAccessCodes` to wire the home-dashboard tile; `Nearby` gained
`publicProfile` for the buyer row. `Snap & sell` and `Gig detail` were
rewired on Android too (they had the same stale pattern). The two
`Share business` / `Share membership` placeholders now invoke the system
share sheet (iOS `systemSheet = .share`, Android `appContext.shareText`).

| Original stale label | Fix |
|---|---|
| `Access codes` (iOS Hub) | `HubRoute.accessCodes` (+ `editAccessCode`/`searchAccessCodes`) added; `HomeDashboardView.onOpenAccessCodes` rewired |
| `Bill detail`, `Add a bill` (iOS You) | `YouRoute.billDetail`/`.addBill` added; `BillsListView` callbacks rewired |
| `Gig detail` (iOS Hub, Android) | `route(forDiscovery: .gig)` / `DiscoveryKind.Gig` → real `gigDetail(id)` |
| `Buyer profile` (iOS Hub/You/Nearby, Android) | `ListingOffersView.onOpenBuyer` → `.publicProfile(userId: buyer.id)`; `NearbyRoute.publicProfile` and release `YouRoute.publicProfile` added |
| `Post detail` (iOS You, Android) | `MyPostsView.onOpenPost` → `.pulsePost(postId: dto.id)`; `YouRoute.pulsePost` promoted out of `#if DEBUG` |
| `Write a post` (iOS You, Android) | `MyPostsView.onCompose` → `.composePost(intent: "")`; `YouRoute.composePost` added |
| `Snap & sell` (iOS Hub, Android) | Hub `.snapAndSell` / `ActionChipContent.Kind.SnapAndSell` → `.composeListing` / `COMPOSE_LISTING` |
| `List something` (iOS You, Android) | `MyListingsView.onCompose` → `.composeListing` / `COMPOSE_LISTING`; `YouRoute.composeListing` added |
| `Post a task` (iOS You) | `OffersView.onPostTask` → `.composeTask` (existing case) |
| `Browse tasks` (iOS You) | `MyBidsView.onBrowseTasks` → `.gigsFeed`; `YouRoute.gigsFeed` added |
| `Browse listings` (iOS You, Android) | `OffersView.onBrowseListings` → `.marketplace` / `MARKETPLACE`; `YouRoute.marketplace` added |
| `Browse gigs` (iOS You) | `MailboxRootView.onBrowseGigs` (You) → `.gigsFeed` |
| `Claim a home` (iOS You) | `MyHomesListView.onAddHome` → `.addHome`; `YouRoute.addHome` added |
| `Claim ownership` (iOS You) | `HomeDashboardView.onClaimOwnership` → `.claimOwnership(homeId:)`; `YouRoute.claimOwnership` added |
| `My claims` (iOS You) | `HomeDashboardView.onOpenClaimsList` → `.myClaims`; `YouRoute.myClaims` added |
| `Share business` (iOS Hub, Android) | now invokes system share sheet (`systemSheet = .share` / `appContext.shareText`) |
| `Share membership` (Android) | now invokes `appContext.shareText` |

### Group B — DEFER (no pack screen; intentionally parked)

| Label(s) | Platform | Pushed from | Why deferred |
|---|---|---|---|
| `Payments & payouts` | iOS·Android | Settings / Me | Payments stack not built (canonical defer) |
| `Transaction detail` | iOS·Android | `ListingOffersView` | Payments |
| `Update payment`, `Change tier`, `Request refund`, `Membership cancelled` | iOS·Android | `MembershipDetailView` actions | Membership/billing management — payments |
| `Broadcast actions`, `Reply to broadcast`, `Boost broadcast`, `Pin broadcast` | iOS·Android | `BroadcastDetailView` actions | Creator broadcast management (action sheets, not screens) |
| `Business dashboard` | iOS·Android | `MyBusinessesView` row | Business management — Phase 9 (`businessWaitlist` is the live stub) |
| `Data export` | iOS·Android | Settings | GDPR export flow |
| `Export documents` | iOS·Android | `DocumentsView` export | Bulk export action |
| `Inbox settings` | iOS·Android | `CreatorInboxView` | Creator inbox preferences |
| `Request correction` | iOS·Android | `PropertyDetailsView` | Property-correction request flow |
| `Follower` (`Follower · …`) | iOS·Android | `AudienceProfileView` | Follower detail |
| `Creator profile` | iOS | `MembershipDetailView` open-persona | Persona public-profile entry (persona·owner state is a known parity gap) |
| `Identity` / `Local profile` / `Personal` | iOS·Android | `IdentityCenterView` non-professional cards | Identity sub-detail screens |
| `Task detail` | iOS·Android | `HouseholdTasksListView` row | No household-task detail screen designed (list + edit only) |
| `Claim status` | iOS·Android | `MyClaimsListView` row | No claim-status detail designed (`StatusWaitingView` covers submit) |
| `Messages` | iOS·Android | `BusinessProfileView`, `jumpBackIn /app/chat` | Business→DM not wired (chat shell exists) |
| `Message helper` (`Message helper · …`) | iOS·Android | `ReviewSignupsView` | Helper DM not wired (chat shell exists) |
| `Report business` | iOS·Android | `BusinessProfileView` | Moderation/report flow |
| `Share business` / `Share membership` | iOS·Android | `BusinessProfileView` / membership | Should route to the system share sheet, not a screen |
| `Member requests · …` | Android | home members | Member-requests screen (iOS `homeMemberRequests` deep-link also unresolved) |

### Group C — dynamic fall-through (defensive, not a missing screen)

`tile.label` / `row.label` (×~15, You/Me action grid), `item.title` (Hub
discovery unknown), and `label` pass-throughs render the placeholder only at
runtime when a home-context tile has no resolved primary `homeId` or a
discovery item is `.unknown`. **KEEP** — these are defensive fallbacks for
empty/edge states, not wiring gaps.

---

## Disposition rollup

| | iOS | Android |
|---|---:|---:|
| Orphan routes → REMOVE | 5 | 2 |
| Orphan routes → KEEP (deferred/debug) | 4 | 1 |
| Dead screens → REMOVE | 2 | 4 |
| Placeholder labels → REMOVE (stale, rewire) — *done* | 0 (was 16) | 0 (was ~14) |
| Placeholder labels → DEFER | 23 | 24 |
| Placeholder labels → BUILD | 0 | 0 |
