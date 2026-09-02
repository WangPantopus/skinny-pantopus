//
//  HubTabRoot.swift
//  Pantopus
//
//  Navigation stack for the Hub tab.
//
// swiftlint:disable cyclomatic_complexity function_body_length type_body_length file_length

import SwiftUI
import UIKit

/// Typed routes within the Hub tab's NavigationStack.
public enum HubRoute: Hashable {
    case myHomes
    case myClaims
    case claimStatus(claimId: String)
    case mailItemDetail(mailId: String)
    /// T6.5e (P19.5) Mailbox Vault — saved mail list. Personal pillar.
    case mailboxVault
    case addHome
    /// A12.1 — "Find or Add Home" discovery. Search public-preview
    /// homes, start a claim on one, add a missing address, or paste an
    /// invite code. Mirrors RN `src/app/homes/find.tsx`.
    case findHome
    case claimOwnership(homeId: String)
    /// Residency-verification variant of the evidence flow. Sends
    /// `claim_type: 'resident'` and offers the lease / utility-bill /
    /// tax-bill document set (RN
    /// `homes/[id]/claim-owner/evidence.tsx?verificationType=residency`).
    case verifyResidency(homeId: String)
    /// A12.5 / A12.6 — Verify landlord wizard. Pushed when the
    /// dashboard's ownership claim resolves to the "verify via
    /// landlord" branch (rental detected, owner-claim path not
    /// applicable) or from a `pantopus://homes/:id/verify-landlord`
    /// deep link.
    case verifyLandlord(homeId: String)
    /// A12.7 — Sibling postcard verification status screen. Pushed
    /// when the verify-landlord wizard's submit succeeds, or directly
    /// from `pantopus://homes/:id/verify-postcard` for users who want
    /// to track their postcard later.
    case postcardVerification(homeId: String)
    case homeDashboard(homeId: String)
    /// Pets sub-screen for a specific home (T5.2.1).
    case homePets(homeId: String)
    /// Emergency info sub-screen for a specific home (T6.4b / P17).
    case homeEmergency(homeId: String)
    /// Add Emergency Info form (P2.8) — single-page editor backed by
    /// `AddEmergencyInfoFormView`.
    case addEmergencyInfo(homeId: String)
    /// Emergency item detail (P2.8) — read-only summary backed by
    /// `EmergencyInfoDetailView`.
    case emergencyItem(homeId: String, emergencyId: String)
    /// Documents sub-screen for a specific home (T6.4b / P17).
    case homeDocs(homeId: String)
    /// P2.10 — Upload document form for a home.
    case uploadDocument(homeId: String)
    /// P2.10 — Document detail (preview + metadata + footer actions).
    case documentDetail(homeId: String, documentId: String)
    /// P4.5 — Document Search surface (search across title / tags /
    /// category) for a home's vault.
    case documentSearch(homeId: String)
    /// Packages list for a home (T6.3d / P14).
    case homePackages(homeId: String)
    /// Package detail (read-mostly summary with mark-picked-up).
    case packageDetail(homeId: String, packageId: String)
    /// Log-a-package sheet target.
    case logPackage(homeId: String)
    /// Household tasks (per-home chore list) for a specific home
    /// (T6.3c / P11). Distinct from `.myBids` / `.myTasks` (the gig
    /// surfaces in the You tab).
    case homeTasks(homeId: String)
    /// P2.4 — Add a new household task. Reached from the household
    /// tasks list FAB.
    case addHouseholdTask(homeId: String)
    /// P2.4 — Edit an existing household task. Reached from the
    /// "Edit recurring" overflow action on a Recurring row.
    case editHouseholdTask(homeId: String, taskId: String)
    /// Maintenance sub-screen for a specific home (T6.3b / P10).
    case homeMaintenance(homeId: String)
    /// Per-home **issue tracker** (`HomeIssue`). A different backend
    /// collection from `.homeMaintenance` (maintenance tasks) — this is
    /// the surface RN calls "Maintenance" (`homes/[id]/maintenance.tsx`).
    case homeIssues(homeId: String)
    /// P2.9 — Log a maintenance entry. Pushed from the Maintenance list
    /// FAB; on success the host pops back and refreshes the list.
    case logMaintenance(homeId: String)
    /// P2.9 — Maintenance detail for a specific task. Pushed from a
    /// per-row tap on the Maintenance list.
    case maintenanceDetail(homeId: String, taskId: String)
    /// P2.9 — Edit an existing maintenance entry. Re-uses the
    /// `LogMaintenanceFormView` shell in edit mode.
    case editMaintenance(homeId: String, taskId: String)
    /// Members sub-screen for a specific home (T6.3a / P9).
    case homeMembers(homeId: String)
    /// A14.1 (P5.1) — Per-home Settings index. Reached from the home
    /// dashboard's top-bar settings affordance.
    case homeSettings(homeId: String)
    /// A14.2 (P5.1) — Per-home Security toggles. Reached from the
    /// per-home Settings `Privacy` row.
    case homeSecurity(homeId: String)
    /// A14.2 (policy variant) — per-home ownership security policy
    /// (`GET/PATCH /api/homes/:id/security`). Reached from the per-home
    /// Settings `Ownership & Security` row.
    case homeOwnershipSecurity(homeId: String)
    /// Leave this home (`POST /api/homes/:id/move-out`).
    case leaveHome(homeId: String)
    /// Cancel ownership claim (`DELETE …/ownership-claims/:claimId`).
    case cancelClaim(homeId: String)
    /// A14.1 — Home photos empty state → documents vault.
    case homePhotos(homeId: String)
    /// A14.1 — Trusted neighbors list.
    case trustedNeighbors(homeId: String)
    /// A14.1 — Per-home notification toggles.
    case homeNotifications(homeId: String)
    /// A13 — Request property correction form.
    case propertyCorrection(homeId: String)
    case publicProfile(userId: String)
    /// P1.6 — Typed Business Profile screen. Pushed from DiscoverHub
    /// business cards, DiscoverBusinesses row taps, and any other
    /// surface that previously routed to a `Business: <name>`
    /// placeholder.
    case businessProfile(businessId: String)
    /// P4.2 — A13.10 Edit Business Page (owner-only). Pushed from
    /// `BusinessProfileView`'s overflow when the viewer owns the business
    /// and from the `pantopus://businesses/:id/page-editor` deep link.
    case editBusinessPage(businessId: String)
    /// C4 — the custom Pages CMS index (create / delete a page, revision
    /// history, restore). Distinct from `editBusinessPage`, which edits
    /// business *profile* fields.
    case businessPages(businessId: String)
    /// C4 — the block builder for one custom page.
    case businessPageBlocks(businessId: String, pageId: String, pageTitle: String)
    /// C4 — the public profile opened on a named custom page, reached from
    /// `pantopus://b/:username/:slug`.
    case businessProfilePage(businessId: String, pageSlug: String)
    /// A12.10 — Create Business wizard. Reached from the My Businesses
    /// FAB / empty-state CTA and from the `pantopus://businesses/new`
    /// deep link.
    case createBusiness
    /// A08 — My businesses index. Reached from the Hub nav-drawer's
    /// "My Businesses" row (previously fell back to the NotYetAvailable
    /// placeholder).
    case myBusinesses
    case pulsePost(postId: String)
    /// Bills list for a home (T5.2.2 / P13).
    case homeBills(homeId: String)
    /// Home calendar list (T6.4c / P18).
    case homeCalendar(homeId: String)
    /// Add / edit calendar event form (P2.7). `eventId` non-nil = edit;
    /// `prefilledCategory` seeds the chip selector when arriving from
    /// the empty-state quick-start tiles.
    case addCalendarEvent(homeId: String, eventId: String?, prefilledCategory: String?)
    /// Read-only event detail (P2.7). Edit + Delete actions live here.
    case calendarEventDetail(homeId: String, eventId: String)
    /// Bill detail (read-mostly summary with mark-paid / remove).
    case billDetail(homeId: String, billId: String)
    /// Add / Edit Bill wizard. When `billId` is non-nil the wizard
    /// loads the existing bill, seeds every step, and PUTs on submit.
    case addBill(homeId: String, billId: String? = nil)
    /// Polls list for a home (T6.3e / P13).
    case homePolls(homeId: String)
    /// Poll detail — read + cast vote (T6.3e / P13).
    case pollDetail(homeId: String, pollId: String)
    /// Start-a-poll composer (P2.5). Pushed from the Polls list FAB +
    /// empty-state CTA.
    case startPoll(homeId: String)
    /// T6.4a — Access codes. Per-home roster of Wi-Fi / Alarm / Gate /
    /// Lockbox / Garage / Smart lock codes.
    case accessCodes(homeId: String, homeName: String?)
    /// P3.1 — Add (no secretId) / Edit (with secretId) access code.
    case editAccessCode(homeId: String, secretId: String?, categoryRaw: String?)
    /// P4.6 — Access codes search scoped to one home.
    case searchAccessCodes(homeId: String)
    /// Pulse tab (T1.2). Reached from Hub → pillar(.pulse).
    case pulseFeed
    /// T5.3.3 — Author's own posts (My Pulse in the drawer).
    case myPosts
    /// A03.2 — Beacon Updates feed (`surface=personas`). Reached from the
    /// AudienceProfile entry and the `pantopus://beacons` deep link.
    case beaconsFeed
    /// A21.1 — "My Beacon": the signed-in user's own public Beacon profile
    /// (owner role). Reached from the navigation drawer.
    case myBeacon
    /// A21.1 — another user's public Beacon profile by handle (visitor
    /// role). Reached from the Following list + beacon deep links.
    case beaconProfile(handle: String)
    /// A13.12 — create / edit the persona behind a Beacon.
    case editPersona(personaId: String)
    /// A7 — broadcast composer for a persona's primary channel.
    case composeBroadcast(personaId: String)
    /// T3.3 — owner audience dashboard (insights / followers / DM threads).
    case beaconInsights
    /// Compose post target — placeholder until the compose flow ships.
    case composePost(intent: String)
    /// P3.5 — Edit an existing Pulse post. Re-uses the compose flow in
    /// edit mode (prefill + PATCH submit + locked intent picker).
    case editPost(postId: String)
    /// Gigs feed (T2.3). Reached from Hub → pillar(.gigs).
    case gigsFeed
    /// Gig Search (P4.4). Pushed from the Gigs feed search bar.
    case gigSearch
    /// S2 — Universal search (All / Tasks / People / Beacons /
    /// Businesses / Homes). Pushed from the navigation drawer's
    /// "Search" row; gig-only search stays reachable from its Tasks tab
    /// and from the Gigs feed search bar.
    case universalSearch
    /// Gig detail target — placeholder until the Transactional Detail (T2.6) ships.
    case gigDetail(gigId: String)
    /// Map+List Hybrid opened from the Gigs feed map-toggle. Carries the
    /// active category so the map renders the same filtered window.
    case nearbyMapForGigs(categoryKey: String)
    /// Compose gig target — placeholder until the compose flow ships.
    case composeGig(category: String)
    /// Quick-post V1 single-screen gig form. Reached from the Hub action chip;
    /// the Gigs feed FAB keeps the V2 wizard for power users.
    case quickPostGig(category: String)
    /// Marketplace tab (T2.5). Reached from Hub → pillar(.marketplace).
    case marketplace
    /// Listing detail (T2.6 TransactionalDetailShell · listing variant).
    case listingDetail(listingId: String)
    /// Snap & sell — placeholder until the marketplace compose flow ships.
    case composeListing
    /// P3.3 — Edit an existing listing. Reached from the listing-detail
    /// overflow ("Edit listing") for the owner, or from the listing-
    /// offers panel's "Edit price" affordance (which seeds
    /// `jumpToStep == .price`).
    case editListing(listingId: String, jumpToStep: ListingComposeStep?)
    /// Invoice detail (T2.6 TransactionalDetailShell · invoice variant).
    /// Reached from wallet / payments surfaces when those land.
    case invoiceDetail(invoiceId: String)
    /// Bell icon target. Replaced by the real notifications screen in T4.1.
    case notifications
    /// S5 — Notifications scoped to one identity-firewall zone. Pushed by
    /// the Hub megaphone with `context: "audience"` so the Beacon stream
    /// opens directly (RN `?context=audience`,
    /// `pantopus/frontend/apps/mobile/src/app/(tabs)/index.tsx:534`).
    /// Values must be a `NotificationsZone` raw value.
    case notificationsZone(context: String)
    /// Connections center (T5.2.3). Reached from the You / Me action grid
    /// or via the `pantopus://connections` deep link.
    case connections
    /// Support Trains list (T6.6c / P26.5) — mutual-aid rotations.
    /// Personal pillar. Reached from the You tab action grid or via
    /// the `pantopus://support-trains` deep link.
    case supportTrains
    /// P2.6 — Start-a-Support-Train wizard (organizer compose flow).
    /// Pushed when the Support Trains FAB / empty-state CTA fires.
    case startSupportTrain
    /// A10.9 (P3.1) — Participant-facing Support Train detail screen.
    /// Pushed from a Support Trains row tap and from the
    /// `pantopus://support-trains/:id` deep link. The organizer-only
    /// review queue lives behind the dock overflow on this screen
    /// (`reviewSignups`) for callers who own the train.
    case supportTrainDetail(supportTrainId: String)
    /// Review-signups (T6.6c / P26.5) — organizer-only review queue
    /// for one Support Train. Reached from the participant detail
    /// screen's dock-overflow `Manage signups` for organizers, or
    /// from the `pantopus://support-trains/:id/manage` deep link.
    case reviewSignups(supportTrainId: String)
    /// P4.6 — Support Trains search. Pushed from the Support Trains list
    /// top-bar search action; reuses the shared `SearchListShell`.
    case searchSupportTrains
    /// P3.7 — Edit Signup form (organizer-side mutation of a helper
    /// reservation). Pushed from the Review-signups per-row Edit
    /// action with the seed DTO baked into the route so the form can
    /// prefill without a re-fetch.
    case editSignup(reservation: SupportTrainReservationDTO)
    /// A13.13 / P4.3 — Manage train (organizer surface). Pushed from
    /// the A10.9 detail dock overflow when the viewer is the organizer
    /// and from the `pantopus://support-trains/:id/manage` deep link.
    case manageTrain(trainId: String)
    /// Admin home-ownership-claims review queue. Gated by
    /// `auth.user.isAdmin` and reached from the Settings menu's Admin
    /// group. Mirrors the web `/app/admin/review-claims` page.
    case reviewClaims
    /// Admin claim detail — pushed from a `reviewClaims` row tap.
    case reviewClaimDetail(claimId: String)
    /// My bids — outgoing bids on neighbour gigs (T5.3.1). Reached from
    /// the You / Me action grid or from Hub's marketplace pillar shelf.
    case myBids
    /// T5.2.4 — cross-listing Offers (incoming + outgoing).
    case offers
    /// My tasks — the poster's side of the gigs marketplace (T5.3.2 /
    /// V2 canonical). Reached from the navigation drawer's "My Tasks"
    /// item. Inverse of `.myBids`.
    case myTasks
    /// Edit an existing posted gig — flips the QuickPost composer into
    /// edit mode (`GET /api/gigs/:id` prefill → `PATCH`). Pushed from a
    /// My tasks row's "Edit" footer action.
    case editGig(gigId: String)
    /// T5.3.4 — per-listing offers panel reached from a listing detail
    /// "View offers" affordance (only the listing's owner sees it).
    case listingOffers(listingId: String, title: String?)
    /// Discover hub — typed-section discovery list (T5.4.1 / P11).
    /// Reached from the Hub Discovery rail's "See all" CTA or via the
    /// `pantopus://discover-hub` deep link.
    case discoverHub
    /// Discover businesses — full business search list (T5.4.2 / P12).
    /// Reached from the Hub Discovery rail's "See all Businesses" CTA,
    /// from the Marketplace tab, or via the Discover hub Businesses
    /// section's "See all" target.
    case discoverBusinesses
    /// Push the chat conversation for a given counterparty. Used by the
    /// Connections row's message-CTA — payload mirrors the Inbox tab's
    /// `InboxConversationDestination` so the same `ChatConversationView`
    /// can host the thread inside the Hub stack.
    case chatConversation(InboxConversationDestination)
    /// P1.5 — Recent activity log. Pushed when the Hub's
    /// `HubRecentActivity` "See all" CTA fires.
    case recentActivity
    /// Hub top-bar menu icon target. Replaced by Settings in T3.1.
    case menu
    /// Drawer Help & Support → existing Help center (parity with You tab /
    /// Settings → Help).
    case helpCenter
    /// A14.6 — Settings → Payments deep-link target.
    case paymentsSettings
    /// A14.7 — Privacy preferences. Pushed from the A18.5 "View as"
    /// preview's "Manage privacy" link when it lands in the Hub stack
    /// (via the `pantopus://identity/preview` deep link).
    case privacySettings
    /// Edit profile form — pushed by Settings → "Edit profile". P1.4.
    case editProfile
    /// Mailbox search target (P4.2). Client-side filter over the user's
    /// mailbox — sender / subject / body / category.
    case mailboxSearch
    /// Generic placeholder for any intent whose destination hasn't been
    /// built yet. The label is shown by `NotYetAvailableView`.
    case placeholder(label: String)
    /// A10.3 — Full "Today" briefing (weather, air, daylight, signals).
    /// Pushed when the Hub's Today card is tapped.
    ///
    /// `briefingDeliveryId` / `briefingKind` are non-nil only when the screen
    /// was opened from a Morning/Evening Briefing push, whose metadata carries
    /// `briefing_delivery_id` + `briefing_kind`. With an id the screen resolves
    /// that stored delivery (`GET /api/hub/briefings/:id`) instead of showing
    /// only the live `/api/hub/today` snapshot.
    case todayDetail(briefingDeliveryId: String?, briefingKind: String?)
    /// A.4 — Property details for a home.
    case propertyDetails(homeId: String)
    /// A.3 — Add a guest to a home.
    case addGuest(homeId: String)
    /// A13.6 — Guest-pass management for a home (Active / Past passes,
    /// revoke). Pushed from Home settings → "Invite link".
    case guestPasses(homeId: String)
    /// A13.4 — Transfer ownership form. Pushed from the Owners list
    /// "Transfer" action and from `pantopus://homes/:id/owners/transfer`
    /// deep links. The form owns its own Face ID bottom-sheet confirm so
    /// no extra modal is wired here.
    case transferOwnership(homeId: String)
    /// A11.1 — Tasks map. Gigs-only mode of the MapListHybrid archetype,
    /// opened from the Gigs feed's list/map toggle. Carries the active
    /// category so the map renders the same filtered window.
    case tasksMap(categoryKey: String)
    /// A.x — Explore (neighbourhood discovery surface).
    case explore
    /// BLOCK 2E — "Saved places". Reached from the Explore map header's
    /// "Saved" affordance.
    case savedPlaces
    /// W3 — the Place Intelligence dashboard (address-led home
    /// intelligence). The Home tab auto-lands here when the user has a
    /// primary home; the switcher re-pushes it for another home.
    case placeDashboard(homeId: String)
    /// W4 — a Place group-detail page (Today / Your home / Risk / Block /
    /// Money / Civic / Identity), tapped through from a dashboard card.
    case placeDetail(homeId: String, group: PlaceDetailGroup)
    /// W4 — the full Today's Pulse signal stream (from the dashboard hero).
    case placePulse(homeId: String)
    /// Wedge v2 §2 — the privacy mirror: this home as a neighbor sees it.
    case privacyMirror(homeId: String)
    /// W5 — the verify status screen (B2 pending → B3 success / B4 failed)
    /// after a method is chosen in the verify sheet.
    case placeVerifyStatus(homeId: String, method: PlaceVerifyMethod, address: String)
    /// W7 D1 — compose a template-only heads-up to a verified neighbor on
    /// your block. `recipient` is nil when opened without a chosen home
    /// (the "choose a neighbor" empty state).
    case neighborCompose(homeId: String, address: String, recipient: ComposeRecipient?)
    /// W7 — the verified-neighbor inbox list (received heads-ups).
    case neighborInbox
    /// W7 D2 — a single received verified-neighbor message.
    case neighborMessage(messageId: String)
    /// B.1 — unified Mailbox root (drawer chips × tabs). Entry point for
    /// all mailbox navigation; supersedes `.mailboxDrawers` and `.mailbox`.
    case mailboxRoot
    /// A.x — Mailbox map.
    case mailboxMap
    /// A14.8 — Vacation hold (scheduling + active variants). Reached
    /// from the Mailbox root top-bar settings menu.
    case vacationHold
    /// Four-moment Ceremonial Mail compose wizard — Mailbox root FAB.
    case ceremonialMail
    /// Ceremonial open experience for stationery-carrying letters.
    /// Reached by redirect from the generic mail detail.
    case ceremonialMailOpen(mailId: String)
    /// Disambiguation queue behind the Mailbox root's
    /// "N items need routing" banner.
    case mailRoutingQueue
    /// Family Mail Party — household co-opening (discover / join / start /
    /// react / hand off). Reached from the Mailbox root overflow menu.
    case mailParty
    /// A13.16 — My Mail Day editor (mid-afternoon triage + empty hero).
    /// Pushed from the Mailbox root header CTA + the
    /// `pantopus://mailbox/mailday` deep link.
    case mailDay(variant: MailDayVariant)
    /// A10.10 — Wallet (earnings-side surface). Reached from the
    /// Settings → "Payments & payouts" row and the
    /// `pantopus://wallet` deep link.
    case wallet
    /// WS5.1 — full transaction history (`GET /api/wallet/transactions`).
    case walletActivityList

    // MARK: - B1.6 batch-2 routing seam

    /// A17.11 — Stamps / postage wallet. `pantopus://mailbox/stamps`.
    case stamps
    /// A17.12 — Mail-derived task detail. `pantopus://mailbox/tasks/:id`.
    case mailTask(taskId: String)
    /// A17.12 (list) — every mail-linked task. When `mailId` is non-nil the
    /// screen opens in its create frame for that mail.
    case mailTaskList(mailId: String?, mailSubject: String?, mailSender: String?)
    /// A17.13 — Auto-translated mail view. `pantopus://mailbox/translation?id=`.
    case mailTranslation(mailId: String)
    /// A17.14 — Scan-first capture (unboxing) flow. `pantopus://mailbox/unboxing`.
    case unboxing(mailId: String?)
    /// A17.8 → "Ask a Neighbor" — package-help gig created from a mailbox
    /// package. `pantopus://mailbox/gig?id=&mode=pre|post`.
    case packageGig(mailId: String, isPreDelivery: Bool)
    /// A17.4 — Community mail feed (neighborhood / civic). Reached from
    /// the Mailbox root overflow menu.
    case communityMail
    /// Home Records — the linked-asset hub. Reached from the Mailbox
    /// root overflow menu.
    case homeRecords
    /// A10.11 — Earn dashboard (Wallet sibling). `pantopus://mailbox/earn`.
    case earn
    /// A10.7 — Business owner view. `pantopus://businesses/:id`.
    case businessOwner(businessId: String)
    /// B2C — Business team & roles management. `pantopus://businesses/:id/team`.
    case businessTeam(businessId: String)
    /// C3 — Business Stripe Connect payouts.
    /// `pantopus://businesses/:id/payments`.
    case businessPaymentsOwner(businessId: String)
    /// C3 — Business invoicing (list / create / void).
    /// `pantopus://businesses/:id/invoices`.
    case businessInvoicesOwner(businessId: String)
    /// C3 — Business legal record + verification.
    /// `pantopus://businesses/:id/legal`.
    case businessLegal(businessId: String)
    /// Locations & Hours list MVP. `pantopus://businesses/:id/locations`.
    case businessLocations(businessId: String)
    /// A18.5 — "View as" identity preview. `pantopus://identity/preview`.
    case viewAs
    /// A18.4 — Persistent "waiting for approval" room.
    /// `pantopus://homes/:id/waiting-room`.
    case waitingRoom(homeId: String)
    /// Calendarly scheduling sub-routes (Foundation I0b).
    case scheduling(SchedulingRoute)
    #if DEBUG
    case tokenGallery
    case iconGallery
    case componentGallery
    #endif
}

/// Which surface roots a `HubTabRoot` stack (wedge Phase 1 four-tab IA).
/// `.hub` is the Place tab (Hub root + Place auto-land, unchanged);
/// `.mailbox` roots the same stack — same `HubRoute` destination
/// universe — at the Mailbox, powering the Mail tab without duplicating
/// the mailbox cluster's wiring.
public enum HubStackMode: Sendable {
    case hub, mailbox
}

/// NavigationStack wrapper for the Hub tab.
public struct HubTabRoot: View {
    @Environment(AuthManager.self) private var auth
    @Environment(RootTabModel.self) private var rootTabs
    @State private var path = RouteStack<HubRoute>()
    @State private var router = DeepLinkRouter.shared
    /// W3 — guards the one-shot Place auto-land so it fires at most once.
    @State private var didAutoLandPlace = false
    /// P6.6 — share / mail system sheet driven by "Share listing",
    /// "Share train", and "Invite a business".
    @State private var systemSheet: SystemSheetRequest?
    /// Full-screen modal routes. A13.1 Add Guest uses this so the tab
    /// bar is not visible while the access-grant form is open.
    @State private var modalRoute: HubModalRoute?
    /// P6.6 — "Find people" → contacts picker → invite share.
    @State private var showFindPeople = false
    /// §1C-b — context-aware navigation drawer, opened from the Hub menu
    /// button (repurposed from "open Settings"). Settings now lives as a row
    /// inside the drawer.
    @State private var showNavDrawer = false
    @State private var savedPlaceMapFocus: ExploreMapFocus?
    /// Identity Center presented when the drawer's context pill is tapped
    /// (LAUNCHER / Option A switching path).
    @State private var navDrawerIdentityCenter = false
    #if DEBUG
    @State private var debugSheet: HubRoute?
    #endif

    private let onOpenProfile: @MainActor () -> Void
    private let mode: HubStackMode

    public init(
        mode: HubStackMode = .hub,
        onOpenProfile: @escaping @MainActor () -> Void = {}
    ) {
        self.mode = mode
        self.onOpenProfile = onOpenProfile
    }

    /// The root tab this instance serves — deep links are consumed only
    /// while that tab is selected, so the Place- and Mail-tab instances
    /// never race each other for the same pending destination.
    private var owningTab: RootTab {
        mode == .hub ? .place : .mail
    }

    private var currentUserId: String {
        if case let .signedIn(user) = auth.state { return user.id }
        return ""
    }

    private var currentUserName: String {
        if case let .signedIn(user) = auth.state { return user.displayName ?? "" }
        return ""
    }

    @MainActor
    private func pop() {
        if !path.isEmpty { path.removeLast() }
    }

    private func handleListingCreated(
        _ listingId: String,
        push: @escaping @MainActor @Sendable (HubRoute) -> Void
    ) {
        Task { @MainActor in
            pop()
            push(.listingDetail(listingId: listingId))
        }
    }

    private func listingCreatedHandler(
        push: @escaping @MainActor @Sendable (HubRoute) -> Void
    ) -> @Sendable (String) -> Void {
        { listingId in
            Task { @MainActor in
                handleListingCreated(listingId, push: push)
            }
        }
    }

    private func handleListingUpdated(_: String) {
        // Pop the wizard — the listing-detail (or offers) screen
        // underneath refreshes on next `.task`.
        Task { @MainActor in pop() }
    }

    @MainActor
    private func handleHomeSettingsRoute(_ route: HomeSettingsRoute, homeId: String) {
        switch route {
        case .address, .propertyDetails:
            path.append(.propertyDetails(homeId: homeId))
        case .photos:
            path.append(.homePhotos(homeId: homeId))
        case .documents:
            path.append(.homeDocs(homeId: homeId))
        case .accessCodes:
            path.append(.accessCodes(homeId: homeId, homeName: nil))
        case .trustedNeighbors:
            path.append(.trustedNeighbors(homeId: homeId))
        case .security:
            path.append(.homeSecurity(homeId: homeId))
        case .ownershipSecurity:
            path.append(.homeOwnershipSecurity(homeId: homeId))
        case .people:
            path.append(.homeMembers(homeId: homeId))
        case .inviteLink:
            // A13.6 — the guest-pass manager (Active / Past + revoke).
            // The Add Guest form is reachable from its FAB.
            path.append(.guestPasses(homeId: homeId))
        case .homeNotifications:
            path.append(.homeNotifications(homeId: homeId))
        case .leaveHome:
            path.append(.leaveHome(homeId: homeId))
        case .cancelClaim:
            path.append(.cancelClaim(homeId: homeId))
        }
    }

    @MainActor
    private func handleWaitingRoomNav(_ nav: WaitingRoomNav, homeId _: String) {
        switch nav {
        case .notifications:
            path.append(.notifications)
        case let .backToHome(id):
            path.removeAll { route in
                if case .waitingRoom = route { return true }
                return false
            }
            path.append(.homeDashboard(homeId: id))
        case .viewClaim:
            path.append(.myClaims)
        case let .updateEvidence(id, _):
            path.append(.claimOwnership(homeId: id))
        case let .cancelClaim(id):
            path.append(.cancelClaim(homeId: id))
        // Verification Center action cards.
        case let .verifyPostcard(id):
            path.append(.postcardVerification(homeId: id))
        case let .uploadProof(id):
            path.append(.verifyResidency(homeId: id))
        case let .landlordVerification(id):
            path.append(.verifyLandlord(homeId: id))
        case let .leaveHome(id):
            path.append(.leaveHome(homeId: id))
        case .requestHelp:
            path.append(.helpCenter)
        }
    }

    public var body: some View {
        NavigationStack(path: navigationPathBinding) {
            stackRoot
                .navigationDestination(for: HubRoute.self) { route in
                    destination(for: route) { path.append($0) }
                }
            #if DEBUG
                .sheet(item: $debugSheet) { route in
                    destination(for: route) { _ in }
                }
            #endif
        }
        .onChange(of: router.pending) { _, pending in
            consumeDeepLinkIfNeeded(pending: pending)
        }
        .onChange(of: rootTabs.selected) { _, _ in
            // Cross-tab dispatch may select this tab *after* the pending
            // destination landed — re-attempt once ownership arrives.
            consumeDeepLinkIfNeeded(pending: router.pending)
        }
        .onAppear {
            consumeDeepLinkIfNeeded(pending: router.pending)
        }
        .task {
            consumeDeepLinkIfNeeded(pending: router.pending)
        }
        .task {
            // W3 — land the Place tab on the Place dashboard when the user
            // has a primary home. One-shot at an empty stack so we never
            // fight the user's navigation or an inbound deep link; Hub
            // stays the stack root (reachable via back-swipe) and the
            // no-home fallback. Hub-mode only — the Mail tab's instance
            // roots at the mailbox and must not auto-land.
            guard mode == .hub else { return }
            guard path.isEmpty, router.pending == nil, !didAutoLandPlace else { return }
            // W6 — save the place a stranger looked up before signing up
            // (one-shot), then land on it.
            await Self.savePendingPlaceIfNeeded()
            if let homeId = await Self.primaryHomeId() {
                didAutoLandPlace = true
                path.append(.placeDashboard(homeId: homeId))
            }
        }
        .fullScreenCover(item: $modalRoute) { item in
            destination(for: item.route) { path.append($0) }
        }
        .sheet(item: $systemSheet) { request in request.makeView() }
        .findPeopleSheet(isPresented: $showFindPeople)
        .overlay { navigationDrawerOverlay }
        .sheet(isPresented: $navDrawerIdentityCenter) {
            // `onBack` is not the trailing parameter of `IdentityCenterView`,
            // so the argument label must stay explicit here.
            // swiftlint:disable:next trailing_closure
            IdentityCenterView(onBack: { navDrawerIdentityCenter = false })
        }
    }

    /// The Mailbox root wired into this stack's route universe. Shared by
    /// the `.mailboxRoot` destination (pushed, Place tab) and the Mail
    /// tab's stack root, so the mailbox cluster is wired exactly once.
    private func makeMailboxRoot(
        push: @escaping @MainActor @Sendable (HubRoute) -> Void
    ) -> some View {
        MailboxRootView(
            viewModel: MailboxRootViewModel(
                onOpenMail: { mailId in
                    Task { @MainActor in push(.mailItemDetail(mailId: mailId)) }
                },
                onOpenSearch: { push(.mailboxSearch) },
                onOpenMap: { push(.mailboxMap) },
                onOpenMailDay: { push(.mailDay(variant: .populated)) },
                onOpenEarn: { push(.earn) },
                onOpenVacationHold: { push(.vacationHold) },
                onOpenStamps: { push(.stamps) },
                onOpenUnboxing: { push(.unboxing(mailId: nil)) },
                onOpenCompose: { push(.ceremonialMail) },
                onOpenRoutingQueue: { push(.mailRoutingQueue) },
                onOpenMailParty: { push(.mailParty) },
                onOpenCommunity: { push(.communityMail) },
                onOpenRecords: { push(.homeRecords) },
                onOpenMailTasks: {
                    push(.mailTaskList(mailId: nil, mailSubject: nil, mailSender: nil))
                }
            )
        )
    }

    /// The view rooting this instance's NavigationStack, by mode.
    @ViewBuilder
    private var stackRoot: some View {
        switch mode {
        case .hub:
            hub
                .navigationTitle("Hub")
                .toolbar(.hidden, for: .navigationBar)
        case .mailbox:
            // The Mail tab: same destination universe, mailbox at the root.
            makeMailboxRoot { path.append($0) }
        }
    }

    /// §1C-b — the context-aware navigation drawer. The Hub menu is always the
    /// personal context (home / business dashboards adopt the drawer with their
    /// own context); the pill opens the Identity Center and rows push existing
    /// routes via `route(forDrawer:)`.
    private var navigationDrawerOverlay: some View {
        NavigationDrawerView(
            viewModel: NavigationDrawerViewModel(context: .personal(name: currentUserName)),
            isPresented: $showNavDrawer,
            onSelect: { destination in
                if let route = Self.route(forDrawer: destination, context: .personal(name: "")) {
                    path.append(route)
                }
            },
            onOpenIdentityCenter: { navDrawerIdentityCenter = true },
            onBackToHub: { Task { @MainActor in path.removeAll { _ in true } } }
        )
    }

    /// Maps a drawer destination onto an existing `HubRoute`. Destinations with
    /// no shipped native route fall back to the `NotYetAvailable` placeholder.
    /// Home / Business destinations read the active id from `context`.
    static func route(
        forDrawer destination: NavigationDrawerDestination,
        context: NavigationDrawerContext
    ) -> HubRoute? {
        var homeId = ""
        if case let .home(id, _, _) = context {
            homeId = id
        }
        var businessId = ""
        if case let .business(id, _, _) = context {
            businessId = id
        }
        switch destination {
        // Personal
        case .myHomes: return .myHomes
        case .myBusinesses: return .myBusinesses
        case .connections: return .connections
        case .mailbox: return .mailboxRoot
        case .profileAndPrivacy: return .privacySettings
        case .beaconUpdates: return .beaconsFeed
        case .search: return .universalSearch
        case .discoverNeighbors: return .discoverHub
        case .myBeacon: return .myBeacon
        case .myListings: return .marketplace
        case .myPulse: return .myPosts
        case .myTasks: return .myTasks
        case .myBids: return .myBids
        case .offersAndBids: return .offers
        case .postTask: return .quickPostGig(category: GigsCategory.all.rawValue)
        case .walletAndPayments: return .wallet
        case .settings: return .menu
        case .helpSupport: return .helpCenter
        // Home
        case .homeProperty: return .propertyDetails(homeId: homeId)
        case .homeOverview: return .homeDashboard(homeId: homeId)
        case .homeTasks: return .homeTasks(homeId: homeId)
        case .homeIssues: return .homeIssues(homeId: homeId)
        case .homeBills: return .homeBills(homeId: homeId)
        case .homeMembers: return .homeMembers(homeId: homeId)
        case .homeMailbox: return .mailboxRoot
        case .homePackages: return .homePackages(homeId: homeId)
        case .homeDocuments: return .homeDocs(homeId: homeId)
        case .homeVendors: return .placeholder(label: "Vendors")
        case .homeEmergency: return .homeEmergency(homeId: homeId)
        case .homeSettings: return .homeSettings(homeId: homeId)
        // Business
        case .businessOverview: return .businessOwner(businessId: businessId)
        case .businessProfileRow: return .businessProfile(businessId: businessId)
        case .businessLocations: return .businessLocations(businessId: businessId)
        case .businessCatalog: return .placeholder(label: "Catalog")
        // C4 — the drawer's "Pages" row now opens the custom-pages CMS, not
        // the profile-field editor it used to alias.
        case .businessPages: return .businessPages(businessId: businessId)
        case .businessPostTask: return .quickPostGig(category: GigsCategory.all.rawValue)
        case .businessChat: return .placeholder(label: "Business Chat")
        case .businessTeam: return .businessTeam(businessId: businessId)
        case .businessReviews: return .placeholder(label: "Reviews")
        // C3 — the business drawer's Payments row belongs on the business's
        // own Stripe Connect surface, not on the personal payout settings.
        case .businessPayments: return .businessPaymentsOwner(businessId: businessId)
        case .businessSettings: return .placeholder(label: "Business Settings")
        }
    }

    /// S2 — maps a universal-search result onto the route that opens it.
    /// Mirrors Android `routeForUniversalSearch(...)` in
    /// `RootTabScreen.kt`.
    static func route(forUniversalSearch destination: UniversalSearchDestination) -> HubRoute {
        switch destination {
        case let .task(gigId): .gigDetail(gigId: gigId)
        case let .person(userId): .publicProfile(userId: userId)
        case let .beacon(handle): .beaconProfile(handle: handle)
        case let .business(businessId): .businessProfile(businessId: businessId)
        // Home rows come from `/api/homes/discover`, which only returns
        // `public_preview` homes the viewer may not belong to. The home
        // dashboard falls back to the public profile for non-members
        // (`HomeDashboardViewModel.fetchPublicProfile`), so it is the
        // correct landing surface for both cases.
        case let .home(homeId): .homeDashboard(homeId: homeId)
        }
    }

    private var navigationPathBinding: Binding<NavigationPath> {
        Binding(
            get: { path.navigationPath },
            set: { path.replaceNavigationPath($0) }
        )
    }

    /// Consume the subset of deep-link destinations that map onto a
    /// concrete push within this stack. Tab-level dispatch (selecting a
    /// root tab) stays in `RootTabView`; the ownership guard makes the
    /// Place- and Mail-tab instances consume only while their own tab is
    /// selected, so two mounted instances never race for one destination.
    private func consumeDeepLinkIfNeeded(pending: DeepLinkRouter.Destination?) {
        guard rootTabs.selected == owningTab else { return }
        guard let pending else { return }
        switch pending {
        case .feed:
            path.append(.pulseFeed)
            _ = router.consume()
        case let .post(id):
            path.append(.pulsePost(postId: id))
            _ = router.consume()
        case let .gig(id):
            path.append(.gigDetail(gigId: id))
            _ = router.consume()
        case let .listing(id):
            path.append(.listingDetail(listingId: id))
            _ = router.consume()
        case let .homeDetail(id), let .homeDashboard(id):
            path.append(.homeDashboard(homeId: id))
            _ = router.consume()
        case let .homeMemberRequests(id):
            path.append(.homeMembers(homeId: id))
            _ = router.consume()
        case let .homeOwnersTransfer(id):
            // Push the home's dashboard underneath so a back-tap from the
            // transfer form lands somewhere useful rather than at the
            // empty Hub root.
            path.append(.homeDashboard(homeId: id))
            path.append(.transferOwnership(homeId: id))
            _ = router.consume()
        case let .verifyLandlord(id):
            path.append(.verifyLandlord(homeId: id))
            _ = router.consume()
        case let .postcardVerification(id):
            path.append(.postcardVerification(homeId: id))
            _ = router.consume()
        case .notifications:
            path.append(.notifications)
            _ = router.consume()
        case let .user(id):
            path.append(.publicProfile(userId: id))
            _ = router.consume()
        case let .beaconProfile(handle):
            path.append(.beaconProfile(handle: handle))
            _ = router.consume()
        case .connections:
            path.append(.connections)
            _ = router.consume()
        case .beacons:
            path.append(.beaconsFeed)
            _ = router.consume()
        case .discoverHub:
            path.append(.discoverHub)
            _ = router.consume()
        case let .hubToday(briefingDeliveryId, kind):
            // Morning/Evening Briefing push → the stored delivery, not just
            // the live `/api/hub/today` snapshot.
            path.append(.todayDetail(briefingDeliveryId: briefingDeliveryId, briefingKind: kind))
            _ = router.consume()
        case .wallet:
            path.append(.wallet)
            _ = router.consume()
        case .paymentsSettings:
            path.append(.paymentsSettings)
            _ = router.consume()
        case .createBusiness:
            path.append(.createBusiness)
            _ = router.consume()
        case let .supportTrain(id):
            // A10.9 (P3.1) — pantopus://support-trains/:id deep links
            // now land on the participant detail. Organizers reach the
            // review queue via the dock overflow on the detail screen;
            // the explicit `support-trains/:id/manage` deep link is
            // their shortcut to the queue.
            path.append(.supportTrains)
            if !id.isEmpty {
                path.append(.supportTrainDetail(supportTrainId: id))
            }
            _ = router.consume()
        case let .supportTrainManage(id):
            // P4.3 / A13.13 — `pantopus://support-trains/:id/manage`
            // lands on the organizer Manage Train surface. Drop the
            // user on the Support Trains list first so a back-tap
            // pops to a known surface, then push manage.
            path.append(.supportTrains)
            if !id.isEmpty {
                path.append(.manageTrain(trainId: id))
            }
            _ = router.consume()
        case .vacationHold:
            // A14.8 — `pantopus://mailbox/vacation` lands users on the
            // Vacation hold screen via the Hub stack. We push through
            // the Mailbox root so Back goes to the mailbox, not the
            // hub home, matching the in-app entry point.
            path.append(.mailboxRoot)
            path.append(.vacationHold)
            _ = router.consume()
        case let .place(homeId, slug):
            // `pantopus://place` — the destination every Place-derived push
            // carries. Before this, Place had no deep link at all: the Home
            // tab auto-landed on it once per launch and there was no way
            // back after a swipe, while briefing pushes routed to `/hub`.
            //
            // Server-sent links carry the home id, so the common path pushes
            // the dashboard straight away. A bare link has to resolve the
            // primary home the same way the auto-land does — the `.task`
            // auto-land only fires on an empty stack, so it cannot be relied
            // on for a link arriving mid-session.
            _ = router.consume()
            if let homeId, !homeId.isEmpty {
                pushPlace(homeId: homeId, slug: slug)
            } else {
                Task {
                    if let resolved = await Self.primaryHomeId() {
                        pushPlace(homeId: resolved, slug: slug)
                    }
                }
            }
        case .mailDay:
            // pantopus://mailbox/mailday lands on the Mailbox root first
            // so Back walks back through the drawer view, then pushes
            // the day editor on top.
            path.append(.mailboxRoot)
            path.append(.mailDay(variant: .populated))
            _ = router.consume()
        case let .businessProfile(businessId):
            path.append(.businessProfile(businessId: businessId))
            _ = router.consume()
        case let .businessPage(businessId, pageSlug):
            // C4 — `pantopus://b/:username/:slug` keeps the slug so the named
            // custom page opens, matching RN's `?pageSlug=` redirect.
            path.append(.businessProfilePage(businessId: businessId, pageSlug: pageSlug))
            _ = router.consume()
        case let .editBusinessPage(businessId):
            path.append(.editBusinessPage(businessId: businessId))
            _ = router.consume()

        // MARK: - B1.6 batch-2 routing seam
        // The mailbox sub-screens push through `.mailboxRoot` first so Back
        // walks back through the mailbox, matching `.vacationHold` / `.mailDay`.
        case .stamps:
            path.append(.mailboxRoot)
            path.append(.stamps)
            _ = router.consume()
        case let .mailTask(taskId):
            path.append(.mailboxRoot)
            path.append(.mailTask(taskId: taskId))
            _ = router.consume()
        case let .mailTranslation(mailId):
            path.append(.mailboxRoot)
            path.append(.mailTranslation(mailId: mailId))
            _ = router.consume()
        case let .unboxing(mailId):
            path.append(.mailboxRoot)
            path.append(.unboxing(mailId: mailId))
            _ = router.consume()
        case let .packageGig(mailId, isPreDelivery):
            path.append(.mailboxRoot)
            path.append(.packageGig(mailId: mailId, isPreDelivery: isPreDelivery))
            _ = router.consume()
        case .earn:
            path.append(.mailboxRoot)
            path.append(.earn)
            _ = router.consume()
        case let .businessOwner(businessId):
            path.append(.businessOwner(businessId: businessId))
            _ = router.consume()
        case .viewAs:
            path.append(.viewAs)
            _ = router.consume()
        case let .waitingRoom(homeId):
            // Drop the home dashboard underneath so a back-tap from the
            // waiting room lands on the home, mirroring `.homeOwnersTransfer`.
            path.append(.homeDashboard(homeId: homeId))
            path.append(.waitingRoom(homeId: homeId))
            _ = router.consume()
        default:
            break
        }
    }

    private var hub: some View {
        HubView { intent in
            switch intent {
            case .openNotifications: path.append(.notifications)
            case .openAudienceNotifications:
                path.append(.notificationsZone(context: NotificationsZone.audience.rawValue))
            case .openMenu: showNavDrawer = true
            case .startVerification: path.append(.addHome)
            case .action(.addHome): path.append(.addHome)
            case .action(.scanMail): path.append(.mailboxRoot)
            case .action(.postTask): path.append(.quickPostGig(category: GigsCategory.all.rawValue))
            case .action(.snapAndSell): path.append(.composeListing)
            case .pillar(.mail): rootTabs.selected = .mail
            case .pillar(.pulse):
                rootTabs.selected = .nearby
                NeighborhoodDoorStore.shared.pendingSurface = .pulse
            case .pillar(.gigs):
                rootTabs.selected = .nearby
                NeighborhoodDoorStore.shared.pendingSurface = .tasks
            case .pillar(.marketplace):
                rootTabs.selected = .nearby
                NeighborhoodDoorStore.shared.pendingSurface = .marketplace
            case .openProfile: onOpenProfile()
            case let .openDiscovery(item): path.append(Self.route(forDiscovery: item))
            case .openDiscoverHub: path.append(.discoverHub)
            case .openExploreMap: path.append(.explore)
            case .openFindBusinesses: path.append(.discoverBusinesses)
            case let .jumpBackIn(item):
                if item.route.hasPrefix("/app/chat") {
                    MailTabStore.shared.pendingSegment = .messages
                    rootTabs.selected = .mail
                } else {
                    path.append(Self.route(forJumpBackIn: item))
                }
            case let .statusItem(item):
                // `statusItems[].route` uses the same canonical web paths
                // as `jumpBackIn[].route`, so they share one resolver.
                if item.route.hasPrefix("/app/chat") {
                    MailTabStore.shared.pendingSegment = .messages
                    rootTabs.selected = .mail
                } else {
                    path.append(Self.route(
                        forJumpBackIn: JumpBackItem(
                            id: item.id,
                            title: item.title,
                            icon: item.icon,
                            route: item.route
                        )
                    ))
                }
            // `openToday` taps the weather/today card → full Today briefing
            // (A10.3 — weather, air, daylight, and neighbourhood signals).
            case .openToday: path.append(.todayDetail(briefingDeliveryId: nil, briefingKind: nil))
            case .openRecentActivity: path.append(.recentActivity)
            }
        }
        .overlay(alignment: .topLeading) { debugTapTarget }
    }

    /// Project an `InboxConversationDestination.Mode` onto the
    /// `ChatThreadMode` consumed by `ChatConversationViewModel`. Mirrors
    /// the helper of the same name on `InboxTabRoot` so the chat shell
    /// behaves identically when reached from Connections vs Inbox.
    private static func chatMode(
        for mode: InboxConversationDestination.Mode
    ) -> ChatThreadMode {
        switch mode {
        case .ai: .ai
        case let .room(id): .room(id: id)
        case let .person(otherUserId): .person(otherUserId: otherUserId)
        }
    }

    /// Project an `InboxConversationDestination` onto the
    /// `ChatCounterparty` consumed by `ChatConversationViewModel`.
    private static func chatCounterparty(
        for dest: InboxConversationDestination
    ) -> ChatCounterparty {
        switch dest.mode {
        case .ai:
            .ai(name: dest.displayName)
        case .room:
            .group(name: dest.displayName, memberCount: nil)
        case .person:
            .person(
                name: dest.displayName,
                initials: dest.initials,
                locality: nil,
                verified: dest.verified,
                online: false
            )
        }
    }

    /// Dispatch a discovery card tap to the matching detail route.
    private static func route(forDiscovery item: DiscoveryCardContent) -> HubRoute {
        switch item.kind {
        case .post: .pulsePost(postId: item.id)
        case .person: .publicProfile(userId: item.id)
        case .gig: .gigDetail(gigId: item.id)
        case .business: .businessProfile(businessId: item.id)
        case .unknown: .placeholder(label: item.title)
        }
    }

    /// Backend `jumpBackIn` items carry a canonical web route (e.g.
    /// `/app/mailbox?scope=home&homeId=…`, `/app/homes/<id>/dashboard`,
    /// `/app/chat`, `/gigs/new`). Map that onto a native destination;
    /// fall back to a labeled placeholder when nothing matches.
    private static func route(forJumpBackIn item: JumpBackItem) -> HubRoute {
        let path = item.route
        if path.hasPrefix("/app/mailbox") {
            return .mailboxRoot
        }
        if let homeId = Self.homeId(in: path) {
            return .homeDashboard(homeId: homeId)
        }
        if path.hasPrefix("/app/chat") {
            // Consumed in `hub` — switches to the Messages tab.
            return .placeholder(label: "Messages")
        }
        if path.hasPrefix("/gigs/new") {
            return .composeGig(category: GigsCategory.all.rawValue)
        }
        if path.hasPrefix("/gigs") {
            return .gigsFeed
        }
        return .placeholder(label: item.title)
    }

    /// Two-letter initials derived from a display name. Falls back to
    /// `··` when the input has no alphanumeric content so the chat header's
    /// avatar still renders.
    fileprivate static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let joined = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return joined.isEmpty ? "··" : joined
    }

    /// Extracts `<id>` from `/app/homes/<id>/dashboard`. Returns `nil`
    /// when the prefix doesn't match.
    private static func homeId(in route: String) -> String? {
        let prefix = "/app/homes/"
        guard route.hasPrefix(prefix) else { return nil }
        let after = route.dropFirst(prefix.count)
        let segment = after.split(separator: "/").first.map(String.init)
        return segment?.isEmpty == false ? segment : nil
    }

    /// 44pt invisible 5-tap target in the top-leading safe area — the
    /// production hub hides its nav bar so there's no visible title to
    /// tap. Hidden from accessibility so VoiceOver users can't trip
    /// the debug menu by accident. No-op in release.
    @ViewBuilder
    private var debugTapTarget: some View {
        #if DEBUG
        Color.clear
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
            .onTapGesture(count: 5) { debugSheet = .tokenGallery }
            .accessibilityHidden(true)
        #else
        EmptyView()
        #endif
    }

    @ViewBuilder
    private func destination(
        for route: HubRoute,
        push: @escaping @MainActor @Sendable (HubRoute) -> Void
    ) -> some View {
        switch route {
        case .myHomes:
            MyHomesListView(
                viewModel: MyHomesListViewModel(
                    onOpenHome: { homeId in Task { @MainActor in push(.homeDashboard(homeId: homeId)) } },
                    onAddHome: { Task { @MainActor in push(.addHome) } },
                    onFindHome: { Task { @MainActor in push(.findHome) } },
                    onUploadOwnershipEvidence: { homeId in
                        Task { @MainActor in push(.claimOwnership(homeId: homeId)) }
                    },
                    onVerifyResidency: { homeId in
                        Task { @MainActor in push(.verifyResidency(homeId: homeId)) }
                    }
                )
            )
        case .myBusinesses:
            MyBusinessesView(
                viewModel: MyBusinessesViewModel(
                    onOpenBusiness: { businessId in
                        Task { @MainActor in push(.businessOwner(businessId: businessId)) }
                    },
                    onRegister: { Task { @MainActor in push(.createBusiness) } },
                    onClaim: { Task { @MainActor in push(.discoverBusinesses) } }
                )
            )
        case .myClaims:
            MyClaimsListView(
                viewModel: MyClaimsListViewModel(
                    onStartNewClaim: { Task { @MainActor in push(.addHome) } },
                    onOpenClaim: { claimId in
                        Task { @MainActor in push(.claimStatus(claimId: claimId)) }
                    }
                )
            )
        case let .claimStatus(claimId):
            StatusWaitingView(
                content: .underReview(homeName: nil),
                onAction: { card in
                    if card.id == "addEvidence", !path.isEmpty {
                        path.removeLast()
                    }
                },
                onPrimary: { _ in pop() },
                onSecondary: { _ in
                    if !claimId.isEmpty {
                        pop()
                    }
                }
            )
        case let .homeDashboard(homeId):
            HomeDashboardView(
                homeId: homeId,
                onClaimOwnership: {
                    // The ownership-claim flow branches on whether the
                    // resident is the owner or a renter. Until the
                    // backend wires that decision into the claim
                    // start endpoint, we key off the sample-data
                    // homeId pattern so QA can hit either path. Both
                    // branches start identically from the dashboard
                    // banner.
                    Task { @MainActor in
                        if homeId.localizedCaseInsensitiveContains("renter")
                            || homeId.localizedCaseInsensitiveContains("verify-landlord") {
                            push(.verifyLandlord(homeId: homeId))
                        } else {
                            push(.claimOwnership(homeId: homeId))
                        }
                    }
                },
                onOpenClaimsList: { Task { @MainActor in push(.myClaims) } },
                onOpenBills: { Task { @MainActor in push(.homeBills(homeId: homeId)) } },
                onOpenPolls: { Task { @MainActor in push(.homePolls(homeId: homeId)) } },
                onOpenPlaceholder: { label in
                    Task { @MainActor in push(.placeholder(label: label)) }
                },
                onOpenPets: { id in
                    Task { @MainActor in push(.homePets(homeId: id)) }
                },
                onOpenCalendar: { id in
                    Task { @MainActor in push(.homeCalendar(homeId: id)) }
                },
                onOpenDocs: { id in
                    Task { @MainActor in push(.homeDocs(homeId: id)) }
                },
                onOpenEmergency: { id in
                    Task { @MainActor in push(.homeEmergency(homeId: id)) }
                },
                onOpenPackages: { id in
                    Task { @MainActor in push(.homePackages(homeId: id)) }
                },
                onOpenAccessCodes: { accessHomeId, homeName in
                    Task { @MainActor in push(.accessCodes(homeId: accessHomeId, homeName: homeName)) }
                },
                onOpenTasks: { id in
                    Task { @MainActor in push(.homeTasks(homeId: id)) }
                },
                onOpenMaintenance: { id in
                    Task { @MainActor in push(.homeMaintenance(homeId: id)) }
                },
                onOpenMembers: { id in
                    Task { @MainActor in push(.homeMembers(homeId: id)) }
                },
                onOpenPropertyDetails: { id in
                    Task { @MainActor in push(.propertyDetails(homeId: id)) }
                },
                onOpenSettings: { id in
                    Task { @MainActor in push(.homeSettings(homeId: id)) }
                },
                onHireHelp: { categoryKey in
                    // H1 — "Hire" on a seasonal-checklist item opens the
                    // gig composer pre-filtered to the item's category.
                    Task { @MainActor in push(.composeGig(category: categoryKey)) }
                },
                onAddTask: { id in
                    Task { @MainActor in push(.addHouseholdTask(homeId: id)) }
                },
                onTrackBill: { id in
                    Task { @MainActor in push(.addBill(homeId: id)) }
                },
                onTrackPackage: { id in
                    Task { @MainActor in push(.logPackage(homeId: id)) }
                },
                onSendMail: { _ in
                    Task { @MainActor in push(.ceremonialMail) }
                }
            )
        case let .homeMaintenance(homeId):
            MaintenanceListView(
                viewModel: MaintenanceListViewModel(
                    homeId: homeId,
                    onOpenTask: { taskId in
                        Task { @MainActor in
                            push(.maintenanceDetail(homeId: homeId, taskId: taskId))
                        }
                    },
                    onAddTask: {
                        Task { @MainActor in push(.logMaintenance(homeId: homeId)) }
                    },
                    onOpenIssues: {
                        Task { @MainActor in push(.homeIssues(homeId: homeId)) }
                    }
                )
            )
        case let .homeIssues(homeId):
            HomeIssuesListView(homeId: homeId)
        case let .logMaintenance(homeId):
            LogMaintenanceFormView(
                viewModel: LogMaintenanceFormViewModel(homeId: homeId),
                onClose: { Task { @MainActor in pop() } },
                onSubmitted: { taskId in
                    Task { @MainActor in
                        path.removeAll { route in
                            if case .logMaintenance = route { return true }
                            return false
                        }
                        path.append(.maintenanceDetail(homeId: homeId, taskId: taskId))
                    }
                }
            )
        case let .maintenanceDetail(homeId, taskId):
            MaintenanceDetailView(
                homeId: homeId,
                taskId: taskId,
                onBack: { Task { @MainActor in pop() } },
                onEdit: {
                    Task { @MainActor in
                        push(.editMaintenance(homeId: homeId, taskId: taskId))
                    }
                }
            )
        case let .editMaintenance(homeId, taskId):
            LogMaintenanceFormView(
                viewModel: LogMaintenanceFormViewModel(
                    homeId: homeId,
                    mode: .edit(taskId: taskId)
                ),
                onClose: { Task { @MainActor in pop() } },
                onSubmitted: { _ in
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                    }
                }
            )
        case let .homeBills(homeId):
            BillsListView(
                viewModel: Self.billsListViewModel(homeId: homeId, push: push)
            )
        case let .billDetail(homeId, billId):
            BillDetailView(
                homeId: homeId,
                billId: billId,
                onBack: { Task { @MainActor in pop() } },
                onEdit: {
                    Task { @MainActor in
                        push(.addBill(homeId: homeId, billId: billId))
                    }
                }
            )
        case let .addBill(homeId, billId):
            AddBillWizardView(
                homeId: homeId,
                billId: billId,
                onClose: { Task { @MainActor in pop() } },
                onCreated: { newBillId in
                    // Replace the wizard with the new bill's detail so
                    // Back returns to the Bills list, not the success
                    // step.
                    path.removeAll { route in
                        if case .addBill = route { return true }
                        return false
                    }
                    path.append(.billDetail(homeId: homeId, billId: newBillId))
                },
                onUpdated: {
                    // Edit mode pops back to the bill detail in place
                    // — no new detail to push since the same bill is
                    // already on the stack underneath the wizard.
                    Task { @MainActor in pop() }
                }
            )
        case let .homePolls(homeId):
            PollsListView(
                viewModel: Self.pollsListViewModel(homeId: homeId, push: push)
            )
        case let .pollDetail(homeId, pollId):
            PollDetailView(
                homeId: homeId,
                pollId: pollId
            ) { Task { @MainActor in pop() } }
        case let .startPoll(homeId):
            StartPollFormView(homeId: homeId) { Task { @MainActor in pop() } }
        case let .accessCodes(homeId, homeName):
            AccessCodesView(
                viewModel: AccessCodesViewModel(
                    homeId: homeId,
                    homeName: homeName
                ) { target in
                    Task { @MainActor in
                        switch target {
                        case let .addCode(homeId: targetHomeId, category: category):
                            push(.editAccessCode(
                                homeId: targetHomeId,
                                secretId: nil,
                                categoryRaw: category?.rawValue
                            ))
                        case let .editCode(homeId: targetHomeId, secretId: secretId):
                            push(.editAccessCode(
                                homeId: targetHomeId,
                                secretId: secretId,
                                categoryRaw: nil
                            ))
                        case let .search(homeId: targetHomeId):
                            push(.searchAccessCodes(homeId: targetHomeId))
                        }
                    }
                }
            )
        case let .searchAccessCodes(homeId):
            AccessCodesSearchView(
                viewModel: AccessCodesSearchViewModel(
                    homeId: homeId,
                    onOpenCode: { secretId in
                        Task { @MainActor in
                            push(.editAccessCode(
                                homeId: homeId,
                                secretId: secretId,
                                categoryRaw: nil
                            ))
                        }
                    },
                    onCancel: { Task { @MainActor in pop() } }
                )
            )
        case let .editAccessCode(homeId, secretId, categoryRaw):
            EditAccessCodeFormView(
                homeId: homeId,
                secretId: secretId,
                initialCategory: categoryRaw.flatMap { AccessCategory(rawValue: $0) }
            ) {
                if !path.isEmpty { path.removeLast() }
            }
        case let .homePets(homeId):
            PetsListView(homeId: homeId)
        case let .homeCalendar(homeId):
            HomeCalendarView(
                viewModel: HomeCalendarViewModel(
                    homeId: homeId,
                    onAddEvent: {
                        Task { @MainActor in
                            push(.addCalendarEvent(
                                homeId: homeId,
                                eventId: nil,
                                prefilledCategory: nil
                            ))
                        }
                    },
                    onOpenEvent: { eventId in
                        Task { @MainActor in
                            push(.calendarEventDetail(homeId: homeId, eventId: eventId))
                        }
                    }
                )
            )
        case let .addCalendarEvent(homeId, eventId, prefilledCategory):
            CalendarEventFormRoute(
                homeId: homeId,
                eventId: eventId,
                prefilledCategory: prefilledCategory,
                onClose: { Task { @MainActor in pop() } },
                onCommitted: { event in
                    switch event {
                    case let .created(newId):
                        // Replace the form with the new event's detail so
                        // Back returns to the calendar list.
                        path.removeAll { route in
                            if case .addCalendarEvent = route { return true }
                            return false
                        }
                        path.append(.calendarEventDetail(homeId: homeId, eventId: newId))
                    case let .updated(updatedId):
                        // Pop both the form AND the stale detail, then
                        // push the detail again so it re-fetches.
                        path.removeAll { route in
                            if case .addCalendarEvent = route { return true }
                            if case .calendarEventDetail = route { return true }
                            return false
                        }
                        path.append(.calendarEventDetail(homeId: homeId, eventId: updatedId))
                    }
                }
            )
        case let .calendarEventDetail(homeId, eventId):
            EventDetailView(
                homeId: homeId,
                eventId: eventId,
                onBack: { Task { @MainActor in pop() } },
                onEdit: { event in
                    Task { @MainActor in
                        push(.addCalendarEvent(
                            homeId: homeId,
                            eventId: event.id,
                            prefilledCategory: event.eventType
                        ))
                    }
                }
            )
        case let .homeEmergency(homeId):
            EmergencyInfoView(
                viewModel: EmergencyInfoViewModel(
                    homeId: homeId,
                    onAction: { dto in
                        Task { @MainActor in
                            push(.emergencyItem(homeId: homeId, emergencyId: dto.id))
                        }
                    },
                    onAdd: {
                        Task { @MainActor in
                            push(.addEmergencyInfo(homeId: homeId))
                        }
                    }
                )
            )
        case let .addEmergencyInfo(homeId):
            AddEmergencyInfoFormView(
                viewModel: AddEmergencyInfoFormViewModel(homeId: homeId) { _ in
                    Task { @MainActor in pop() }
                }
            )
        case let .emergencyItem(homeId, emergencyId):
            EmergencyInfoDetailView(
                homeId: homeId,
                emergencyId: emergencyId
            ) {
                Task { @MainActor in
                    if !path.isEmpty { path.removeLast() }
                }
            }
        case let .homeDocs(homeId):
            DocumentsView(
                viewModel: DocumentsViewModel(
                    homeId: homeId,
                    onOpenDocument: { dto in
                        Task { @MainActor in
                            push(.documentDetail(homeId: homeId, documentId: dto.id))
                        }
                    },
                    onUpload: {
                        Task { @MainActor in
                            push(.uploadDocument(homeId: homeId))
                        }
                    },
                    onSearch: {
                        Task { @MainActor in
                            push(.documentSearch(homeId: homeId))
                        }
                    },
                    onExport: {
                        Task { @MainActor in
                            push(.placeholder(label: "Export documents"))
                        }
                    },
                    onDocumentAction: { dto, action in
                        Task { @MainActor in
                            switch action {
                            case .view:
                                push(.documentDetail(homeId: homeId, documentId: dto.id))
                            case .share, .download, .delete:
                                push(.documentDetail(homeId: homeId, documentId: dto.id))
                            }
                        }
                    }
                )
            )
        case let .uploadDocument(homeId):
            UploadDocumentFormView(
                homeId: homeId,
                onClose: { Task { @MainActor in pop() } },
                onUploaded: { _ in
                    Task { @MainActor in
                        path.removeAll { route in
                            if case .uploadDocument = route { return true }
                            return false
                        }
                    }
                }
            )
        case let .documentDetail(homeId, documentId):
            DocumentDetailView(
                homeId: homeId,
                documentId: documentId,
                onBack: { Task { @MainActor in pop() } },
                onReplace: {
                    Task { @MainActor in
                        push(.uploadDocument(homeId: homeId))
                    }
                }
            )
        case let .documentSearch(homeId):
            DocumentSearchView(
                viewModel: DocumentSearchViewModel(
                    homeId: homeId,
                    onOpenDocument: { dto in
                        Task { @MainActor in
                            push(.documentDetail(homeId: homeId, documentId: dto.id))
                        }
                    },
                    onCancel: {
                        Task { @MainActor in
                            if !path.isEmpty { path.removeLast() }
                        }
                    }
                )
            )
        case let .homePackages(homeId):
            PackagesListView(
                viewModel: Self.packagesListViewModel(
                    homeId: homeId,
                    currentUserId: currentUserId.isEmpty ? nil : currentUserId,
                    push: push
                )
            )
        case let .packageDetail(homeId, packageId):
            PackageDetailView(
                homeId: homeId,
                packageId: packageId
            ) { Task { @MainActor in pop() } }
        case let .logPackage(homeId):
            LogPackageSheetView(
                homeId: homeId,
                onClose: { Task { @MainActor in pop() } },
                onCreated: { packageId in
                    Task { @MainActor in
                        path.removeAll { route in
                            if case .logPackage = route { return true }
                            return false
                        }
                        path.append(.packageDetail(homeId: homeId, packageId: packageId))
                    }
                }
            )
        case let .homeTasks(homeId):
            HouseholdTasksListView(
                viewModel: HouseholdTasksListViewModel(
                    homeId: homeId,
                    onOpenTask: { taskId in
                        Task { @MainActor in
                            push(.editHouseholdTask(homeId: homeId, taskId: taskId))
                        }
                    },
                    onAddTask: {
                        Task { @MainActor in push(.addHouseholdTask(homeId: homeId)) }
                    },
                    onEditRecurring: { taskId in
                        Task { @MainActor in
                            push(.editHouseholdTask(homeId: homeId, taskId: taskId))
                        }
                    }
                )
            )
        case let .addHouseholdTask(homeId):
            AddHouseholdTaskFormView(
                homeId: homeId,
                onClose: { Task { @MainActor in pop() } },
                onCreated: { _ in
                    // Pop back to the tasks list; the list refreshes
                    // on `.refreshable` / next visit.
                    if !path.isEmpty { path.removeLast() }
                }
            )
        case let .editHouseholdTask(homeId, taskId):
            AddHouseholdTaskFormView(
                homeId: homeId,
                taskId: taskId
            ) {
                if !path.isEmpty { path.removeLast() }
            }
        case let .homeMembers(homeId):
            MembersListView(homeId: homeId) {
                modalRoute = HubModalRoute(route: .addGuest(homeId: homeId))
            }
        case let .homeSettings(homeId):
            HomeSettingsView(
                viewModel: HomeSettingsViewModel(homeId: homeId) { route in
                    handleHomeSettingsRoute(route, homeId: homeId)
                }
            ) {
                pop()
            }
        case let .homeSecurity(homeId):
            HomeSecurityView(viewModel: HomeSecurityViewModel(homeId: homeId)) {
                pop()
            }
        case let .homeOwnershipSecurity(homeId):
            HomeOwnershipSecurityView(
                viewModel: HomeOwnershipSecurityViewModel(homeId: homeId)
            ) {
                pop()
            }
        case let .leaveHome(homeId):
            LeaveHomeView(
                viewModel: LeaveHomeViewModel(homeId: homeId),
                onBack: { pop() },
                onLeft: {
                    // Move-out revokes membership, so the dashboard for this
                    // home now 403s — drop it along with the settings stack.
                    path.removeAll { route in
                        switch route {
                        case let .leaveHome(id) where id == homeId: true
                        case let .homeSettings(id) where id == homeId: true
                        case let .homeSecurity(id) where id == homeId: true
                        case let .homeOwnershipSecurity(id) where id == homeId: true
                        case let .homeDashboard(id) where id == homeId: true
                        default: false
                        }
                    }
                }
            )
        case let .cancelClaim(homeId):
            CancelClaimView(
                viewModel: CancelClaimViewModel(homeId: homeId),
                onBack: { pop() },
                onCancelled: { pop() }
            )
        case let .homePhotos(homeId):
            HomePhotosView(
                onBack: { pop() },
                onOpenDocuments: { push(.homeDocs(homeId: homeId)) }
            )
        case let .trustedNeighbors(homeId):
            TrustedNeighborsView { pop() }
        case let .homeNotifications(homeId):
            HomeNotificationsView(homeId: homeId) { pop() }
        case let .propertyCorrection(homeId):
            PropertyCorrectionView(homeId: homeId) { pop() }
        case let .claimOwnership(homeId):
            ClaimOwnershipWizardView(
                homeId: homeId,
                onClose: {
                    if !path.isEmpty { path.removeLast() }
                },
                onOpenClaimsList: {
                    path.removeAll { route in
                        if case .claimOwnership = route { return true }
                        return false
                    }
                    path.append(.myClaims)
                },
                onOpenFindHome: {
                    path.removeAll { route in
                        if case .claimOwnership = route { return true }
                        return false
                    }
                    path.append(.findHome)
                }
            )
        case let .verifyResidency(homeId):
            ClaimOwnershipWizardView(
                homeId: homeId,
                verificationType: .residency,
                onClose: {
                    if !path.isEmpty { path.removeLast() }
                },
                onOpenClaimsList: {
                    path.removeAll { route in
                        if case .verifyResidency = route { return true }
                        return false
                    }
                    path.append(.myClaims)
                },
                onOpenFindHome: {
                    path.removeAll { route in
                        if case .verifyResidency = route { return true }
                        return false
                    }
                    path.append(.findHome)
                }
            )
        case let .verifyLandlord(homeId):
            VerifyLandlordWizardView(
                homeId: homeId,
                onClose: {
                    if !path.isEmpty { path.removeLast() }
                },
                onOpenPostcardVerification: { resolvedHomeId in
                    // Replace the wizard with the postcard tracker so
                    // Back returns to the home dashboard, not the
                    // wizard.
                    path.removeAll { route in
                        if case .verifyLandlord = route { return true }
                        return false
                    }
                    path.append(.postcardVerification(homeId: resolvedHomeId))
                }
            )
        case let .postcardVerification(homeId):
            PostcardVerificationView(
                homeId: homeId,
                onClose: { if !path.isEmpty { path.removeLast() } },
                onVerified: { _ in
                    // Pop the tracker — the underlying home dashboard
                    // refreshes its verification status on next visit.
                    if !path.isEmpty { path.removeLast() }
                }
            )
        case let .mailItemDetail(mailId):
            // T6.5b (P20) — Generic A17.1 mail detail. P21–P23 will
            // extend this with package / coupon / booklet / certified
            // variants that compose the same shell with their own slots.
            MailDetailView(
                mailId: mailId,
                onBack: {
                    if !path.isEmpty { path.removeLast() }
                },
                onOpenSenderProfile: { userId in
                    Task { @MainActor in push(.publicProfile(userId: userId)) }
                },
                onTranslate: {
                    Task { @MainActor in push(.mailTranslation(mailId: mailId)) }
                },
                onOpenExtractedTask: { sourceMailId in
                    // A17.12 — the certified-notice "view task" affordance
                    // opens the mail-derived task keyed by its source mail.
                    Task { @MainActor in push(.mailTask(taskId: sourceMailId)) }
                },
                onOpenCeremonialMail: { ceremonialId in
                    // Replace (not push) so Back returns to the Mailbox,
                    // matching RN's `router.replace`.
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                        push(.ceremonialMailOpen(mailId: ceremonialId))
                    }
                },
                onCreateTask: {
                    // A17.12 — RN's "Create Task" in the detail MORE row
                    // (`src/app/mailbox/detail.tsx:221-227`).
                    Task { @MainActor in
                        push(.mailTaskList(mailId: mailId, mailSubject: nil, mailSender: nil))
                    }
                },
                onOpenUnboxing: {
                    Task { @MainActor in push(.unboxing(mailId: mailId)) }
                },
                onAskNeighbor: { isPreDelivery in
                    // A17.8 → "Ask a Neighbor" (RN `mailbox/package.tsx:204`).
                    Task { @MainActor in
                        push(.packageGig(mailId: mailId, isPreDelivery: isPreDelivery))
                    }
                }
            )
        case let .publicProfile(userId):
            PublicProfileView(
                userId: userId,
                onBack: { Task { @MainActor in pop() } },
                onOpenMessages: { profile in
                    Task { @MainActor in
                        push(.chatConversation(InboxConversationDestination(
                            mode: .person(otherUserId: profile.id),
                            displayName: profile.displayName,
                            initials: Self.initials(from: profile.displayName),
                            identityKind: nil,
                            verified: profile.verified ?? false
                        )))
                    }
                },
                onOpenGig: { gigId in
                    Task { @MainActor in push(.gigDetail(gigId: gigId)) }
                },
                onOpenProfile: { reviewerId in
                    Task { @MainActor in push(.publicProfile(userId: reviewerId)) }
                }
            )
        case let .businessProfile(businessId):
            BusinessProfileDestination(
                businessId: businessId,
                pageSlug: nil,
                onBack: { Task { @MainActor in pop() } },
                onOpenMessages: { destination in
                    Task { @MainActor in push(.chatConversation(destination)) }
                },
                onShare: {
                    systemSheet = .share(
                        items: ["Check out this business on Pantopus — \(InviteLinks.downloadURLString)"]
                    )
                },
                onOpenReport: { Task { @MainActor in push(.placeholder(label: "Report business")) } },
                onEdit: { Task { @MainActor in push(.editBusinessPage(businessId: businessId)) } }
            )
        case let .businessProfilePage(businessId, pageSlug):
            BusinessProfileDestination(
                businessId: businessId,
                pageSlug: pageSlug,
                onBack: { Task { @MainActor in pop() } },
                onOpenMessages: { destination in
                    Task { @MainActor in push(.chatConversation(destination)) }
                },
                onShare: {
                    systemSheet = .share(
                        items: ["Check out this business on Pantopus — \(InviteLinks.downloadURLString)"]
                    )
                },
                onOpenReport: { Task { @MainActor in push(.placeholder(label: "Report business")) } },
                onEdit: { Task { @MainActor in push(.editBusinessPage(businessId: businessId)) } }
            )
        case let .businessPages(businessId):
            BusinessPagesView(
                businessId: businessId,
                onBack: { Task { @MainActor in pop() } },
                onOpenPage: { row in
                    Task { @MainActor in
                        push(.businessPageBlocks(
                            businessId: businessId,
                            pageId: row.id,
                            pageTitle: row.title
                        ))
                    }
                }
            )
        case let .businessPageBlocks(businessId, pageId, pageTitle):
            BusinessPageBlocksView(
                businessId: businessId,
                pageId: pageId,
                pageTitle: pageTitle
            ) { Task { @MainActor in pop() } }
        case let .editBusinessPage(businessId):
            EditBusinessPageView(
                businessId: businessId,
                onBack: { Task { @MainActor in pop() } },
                onPreview: {
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                    }
                }
            )
        case .createBusiness:
            CreateBusinessWizardView(
                onClose: { Task { @MainActor in pop() } },
                onOpenBusiness: { businessId in
                    // Replace the wizard with the owner dashboard so Back
                    // returns to wherever the wizard was launched from.
                    path.removeAll { route in
                        if case .createBusiness = route { return true }
                        return false
                    }
                    path.append(.businessOwner(businessId: businessId))
                }
            )
        case let .pulsePost(postId):
            PulsePostDetailView(
                postId: postId,
                currentUserId: currentUserId.isEmpty ? nil : currentUserId,
                onBack: {
                    if !path.isEmpty { path.removeLast() }
                },
                onOpenProfile: { userId in
                    Task { @MainActor in push(.publicProfile(userId: userId)) }
                },
                onEdit: { id in
                    Task { @MainActor in push(.editPost(postId: id)) }
                },
                onOpenBusiness: { username in
                    // "Nearby Providers" row → `/business/:username`.
                    Task { @MainActor in push(.businessProfile(businessId: username)) }
                }
            )
        case .mailboxVault:
            // T6.5e (P19.5) — Mailbox Vault list. Personal-pillar
            // surface — both the FAB ("Save mail to vault") and the
            // empty-state CTA ("Open Mailbox") navigate to the inbox
            // list, popping to an existing instance if one is already
            // on the stack so we don't pile mailbox screens on top of
            // each other.
            let goToMailbox: @MainActor () -> Void = {
                if path.contains(.mailboxRoot) {
                    while let last = path.last, last != .mailboxRoot {
                        path.removeLast()
                    }
                } else {
                    push(.mailboxRoot)
                }
            }
            VaultListView(
                viewModel: VaultListViewModel(
                    onOpenItem: { mailId in
                        Task { @MainActor in push(.mailItemDetail(mailId: mailId)) }
                    },
                    onAddTapped: { Task { @MainActor in goToMailbox() } },
                    onOpenMailbox: { Task { @MainActor in goToMailbox() } }
                )
            )
        case .pulseFeed:
            FeedView(
                onOpenPost: { postId in
                    Task { @MainActor in push(.pulsePost(postId: postId)) }
                },
                onCompose: { intent in
                    Task { @MainActor in push(.composePost(intent: intent.rawValue)) }
                },
                onBack: { Task { @MainActor in pop() } }
            )
        case .myPosts:
            MyPostsView(
                viewModel: MyPostsViewModel(
                    onOpenPost: { dto in
                        Task { @MainActor in push(.pulsePost(postId: dto.id)) }
                    },
                    onCompose: {
                        Task { @MainActor in push(.composePost(intent: PulseComposeIntent.ask.rawValue)) }
                    },
                    onEditPost: { dto in
                        Task { @MainActor in push(.editPost(postId: dto.id)) }
                    }
                )
            )
        case .beaconsFeed:
            BeaconsFeedView(
                onOpenPost: { postId in
                    Task { @MainActor in push(.pulsePost(postId: postId)) }
                },
                onCompose: { intent in
                    Task { @MainActor in push(.composePost(intent: intent.rawValue)) }
                },
                onDiscover: { Task { @MainActor in push(.discoverHub) } },
                onBack: { Task { @MainActor in pop() } }
            )
        case .myBeacon:
            BeaconProfileView(
                mode: .owner,
                onBack: { Task { @MainActor in pop() } },
                onEditPersona: { personaId in
                    Task { @MainActor in push(.editPersona(personaId: personaId)) }
                },
                onComposeBroadcast: { personaId in
                    Task { @MainActor in push(.composeBroadcast(personaId: personaId)) }
                },
                onOpenInsights: { Task { @MainActor in push(.beaconInsights) } },
                onCreateBeacon: {
                    // Empty id = "create" — the editor resolves the real
                    // Beacon (or an empty create form) from GET /api/personas/me.
                    Task { @MainActor in push(.editPersona(personaId: "")) }
                },
                onOpenLink: { url in UIApplication.shared.open(url) }
            )
        case let .beaconProfile(handle):
            BeaconProfileView(
                mode: .visitor(handle: handle),
                onBack: { Task { @MainActor in pop() } },
                onOpenLink: { url in UIApplication.shared.open(url) }
            )
        case .editPersona:
            // The editor resolves the signed-in user's Beacon itself via
            // GET /api/personas/me, so the route payload is advisory only.
            EditPersonaView(
                onClose: { if !path.isEmpty { path.removeLast() } },
                onViewBeacon: { handle in Task { @MainActor in push(.beaconProfile(handle: handle)) } }
            )
        case let .composeBroadcast(personaId):
            ComposeBroadcastView(
                viewModel: .live(personaId: personaId) {
                    if !path.isEmpty { path.removeLast() }
                }
            ) {
                if !path.isEmpty { path.removeLast() }
            }
        case .beaconInsights:
            AudienceProfileView(
                onBack: { Task { @MainActor in pop() } },
                onComposeBroadcast: { personaId in
                    Task { @MainActor in push(.composeBroadcast(personaId: personaId)) }
                },
                onOpenEditPersona: {
                    Task { @MainActor in push(.editPersona(personaId: "")) }
                },
                onOpenBeacons: { Task { @MainActor in push(.beaconsFeed) } }
            )
        case let .composePost(intent):
            PulseComposeFlowView(
                prefillFeedIntent: PulseIntent(rawValue: intent),
                onCancel: { pop() },
                onPosted: { _ in pop() }
            )
        case let .editPost(postId):
            PulseComposeFlowView(
                editingPostId: postId,
                onCancel: { pop() },
                onPosted: { _ in pop() }
            )
        case .gigsFeed:
            GigsFeedView(
                onOpenGig: { gigId in
                    Task { @MainActor in push(.gigDetail(gigId: gigId)) }
                },
                onCompose: { category in
                    Task { @MainActor in push(.composeGig(category: category.rawValue)) }
                },
                onOpenMap: { category in
                    Task { @MainActor in push(.tasksMap(categoryKey: category.rawValue)) }
                },
                onOpenSearch: { Task { @MainActor in push(.gigSearch) } },
                onBack: pop,
                onOpenSupportTrain: { trainId in
                    Task { @MainActor in push(.supportTrainDetail(supportTrainId: trainId)) }
                },
                onOpenMyTasks: { Task { @MainActor in push(.myTasks) } },
                onOpenMySupportTrains: { Task { @MainActor in push(.supportTrains) } }
            )
        case .gigSearch:
            GigSearchView(
                onOpenGig: { gigId in
                    Task { @MainActor in push(.gigDetail(gigId: gigId)) }
                },
                onBack: pop
            )
        case .universalSearch:
            UniversalSearchView(
                onOpen: { destination in
                    Task { @MainActor in push(Self.route(forUniversalSearch: destination)) }
                },
                onBrowseNearbyBusinesses: { Task { @MainActor in push(.discoverBusinesses) } },
                onBack: pop
            )
        case let .gigDetail(gigId):
            GigDetailView(
                viewModel: GigDetailViewModel(gigId: gigId),
                onBack: { Task { @MainActor in pop() } },
                onOpenChat: { destination in
                    Task { @MainActor in
                        push(.chatConversation(destination))
                    }
                }
            )
        case let .composeGig(category):
            GigComposeWizardView(preselectedCategoryKey: category) { gigId in
                // Replace the wizard with the gig's detail so Back goes
                // to the Gigs feed, not the success screen.
                path.removeAll { route in
                    if case .composeGig = route { return true }
                    return false
                }
                path.append(.gigDetail(gigId: gigId))
            }
        case let .quickPostGig(category):
            PostGigV1View(
                viewModel: PostGigV1ViewModel(
                    initialState: PostGigV1State(
                        form: PostGigV1Form(
                            category: GigsCategory(rawValue: category) ?? .all
                        )
                    )
                ),
                onClose: pop
            ) { gigId in
                path.removeAll { route in
                    if case .quickPostGig = route { return true }
                    return false
                }
                path.append(.gigDetail(gigId: gigId))
            }
        case let .nearbyMapForGigs(categoryKey):
            TasksMapView(
                viewModel: TasksMapViewModel(
                    initialCategory: GigsCategory(rawValue: categoryKey) ?? .all
                ),
                onOpenTask: { taskId in
                    Task { @MainActor in push(.gigDetail(gigId: taskId)) }
                },
                onCompose: { category in
                    Task { @MainActor in push(.composeGig(category: category.rawValue)) }
                },
                onBack: { Task { @MainActor in pop() } }
            )
        case .marketplace:
            MarketplaceView(
                onOpenListing: { listingId in
                    Task { @MainActor in push(.listingDetail(listingId: listingId)) }
                },
                onCompose: { Task { @MainActor in push(.composeListing) } },
                onBack: { Task { @MainActor in pop() } }
            )
        case let .listingDetail(listingId):
            ListingDetailView(
                viewModel: ListingDetailViewModel(listingId: listingId),
                onBack: { Task { @MainActor in pop() } },
                onMessage: { listing in
                    Task { @MainActor in
                        guard let sellerId = listing.userId else { return }
                        let name = listing.title ?? "Seller"
                        push(.chatConversation(InboxConversationDestination(
                            mode: .person(otherUserId: sellerId),
                            displayName: name,
                            initials: Self.initials(from: name),
                            identityKind: nil,
                            verified: false
                        )))
                    }
                },
                onViewOffers: { dto in
                    Task { @MainActor in
                        push(.listingOffers(listingId: dto.id, title: dto.title))
                    }
                },
                onEditListing: { dto in
                    Task { @MainActor in
                        push(.editListing(listingId: dto.id, jumpToStep: nil))
                    }
                }
            )
        case let .listingOffers(listingId, titleHint):
            ListingOffersView(
                viewModel: ListingOffersViewModel(
                    listingId: listingId,
                    listingTitleHint: titleHint,
                    onShareListing: {
                        let name = titleHint ?? "this listing"
                        systemSheet = .share(
                            items: ["Check out \(name) on Pantopus — \(InviteLinks.downloadURLString)"]
                        )
                    },
                    onOpenBuyer: { buyer in
                        Task { @MainActor in push(.publicProfile(userId: buyer.id)) }
                    },
                    onOpenTransaction: { _ in
                        Task { @MainActor in push(.placeholder(label: "Transaction detail")) }
                    },
                    onEditPrice: {
                        Task { @MainActor in
                            push(.editListing(listingId: listingId, jumpToStep: .price))
                        }
                    }
                )
            )
        case .composeListing:
            ListingComposeWizardView(
                onOpenListingDetail: listingCreatedHandler(push: push)
            )
        case let .editListing(listingId, jumpToStep):
            ListingComposeWizardView(
                mode: .edit(listingId: listingId, jumpToStep: jumpToStep),
                onListingUpdated: handleListingUpdated
            )
        case let .invoiceDetail(invoiceId):
            InvoiceDetailView(
                viewModel: InvoiceDetailViewModel(invoiceId: invoiceId)
            ) { Task { @MainActor in pop() } }
        case .recentActivity:
            RecentActivityView(
                viewModel: RecentActivityViewModel { destination in
                    switch destination {
                    case let .gigDetail(id): push(.gigDetail(gigId: id))
                    case let .listingDetail(id): push(.listingDetail(listingId: id))
                    case let .mailItemDetail(id): push(.mailItemDetail(mailId: id))
                    case let .pulsePost(id): push(.pulsePost(postId: id))
                    case let .homeDashboard(id): push(.homeDashboard(homeId: id))
                    case let .placeholder(label): push(.placeholder(label: label))
                    }
                }
            )
        case .notifications:
            NotificationsView(
                viewModel: NotificationsViewModel()
            ) { Task { @MainActor in pop() } }
        case let .notificationsZone(context):
            NotificationsView(
                viewModel: NotificationsViewModel(initialContext: context)
            ) { Task { @MainActor in pop() } }
        case .connections:
            ConnectionsView(
                viewModel: ConnectionsViewModel(
                    onMessage: { target in
                        Task { @MainActor in
                            push(.chatConversation(InboxConversationDestination(
                                mode: .person(otherUserId: target.userId),
                                displayName: target.displayName,
                                initials: target.initials,
                                identityKind: nil,
                                verified: target.verified
                            )))
                        }
                    },
                    onFindPeople: { showFindPeople = true }
                )
            )
        case .supportTrains:
            SupportTrainsView(
                viewModel: SupportTrainsViewModel(
                    onStartTrain: {
                        Task { @MainActor in push(.startSupportTrain) }
                    },
                    onOpenTrain: { trainId in
                        Task { @MainActor in push(.supportTrainDetail(supportTrainId: trainId)) }
                    },
                    onSearch: {
                        Task { @MainActor in push(.searchSupportTrains) }
                    }
                )
            )
        case .searchSupportTrains:
            SupportTrainsSearchView(
                viewModel: SupportTrainsSearchViewModel(
                    onOpenTrain: { trainId in
                        Task { @MainActor in push(.supportTrainDetail(supportTrainId: trainId)) }
                    },
                    onCancel: { pop() }
                )
            )
        case .startSupportTrain:
            StartSupportTrainWizardView(
                onDismiss: {
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                    }
                },
                onOpenTrain: { trainId in
                    // After publish we land on the participant detail —
                    // the organizer who just launched the train can
                    // open the review queue from the dock overflow.
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                        path.append(.supportTrainDetail(supportTrainId: trainId))
                    }
                }
            )
        case let .supportTrainDetail(supportTrainId):
            SupportTrainDetailView(
                viewModel: SupportTrainDetailViewModel(trainId: supportTrainId),
                onBack: { Task { @MainActor in pop() } },
                onOpenManage: {
                    // P4.3 / A13.13 — the A10.9 dock-overflow lands on
                    // the organizer Manage Train surface (was wired to
                    // the review-signups queue as a stub before A13.13
                    // shipped).
                    Task { @MainActor in
                        push(.manageTrain(trainId: supportTrainId))
                    }
                },
                onShare: {
                    systemSheet = .share(
                        items: ["Join my support train on Pantopus — \(InviteLinks.downloadURLString)"]
                    )
                },
                onSignUp: {
                    // S1 — the reserve sheet is owned by the detail
                    // screen itself (`ReserveSlotSheet`), which posts
                    // `POST …/slots/:slotId/reserve`. Nothing to push.
                },
                onEditSlot: { _ in
                    Task { @MainActor in
                        push(.placeholder(label: "Edit your slot"))
                    }
                },
                onSendCard: {
                    Task { @MainActor in
                        push(.placeholder(label: "Send a card"))
                    }
                },
                onJoinAsBackup: {
                    Task { @MainActor in
                        push(.placeholder(label: "Join as backup"))
                    }
                },
                onMessageHost: {
                    Task { @MainActor in
                        push(.placeholder(label: "Message host"))
                    }
                }
            )
        case let .reviewSignups(supportTrainId):
            ReviewSignupsView(
                viewModel: ReviewSignupsViewModel(
                    supportTrainId: supportTrainId,
                    onShareTrain: {
                        systemSheet = .share(
                            items: ["Join my support train on Pantopus — \(InviteLinks.downloadURLString)"]
                        )
                    },
                    onConfirm: { reservationId in
                        // S1 — the optimistic row flip is paired with the
                        // real `POST …/reservations/:reservationId/confirm`
                        // (`backend/routes/supportTrains.js:3214`).
                        Task { @MainActor in
                            _ = try? await APIClient.shared.request(
                                SupportTrainActionsEndpoints.confirmDelivery(
                                    supportTrainId: supportTrainId,
                                    reservationId: reservationId
                                ),
                                as: EmptyResponse.self
                            )
                        }
                    },
                    onMessage: { _ in
                        Task { @MainActor in push(.placeholder(label: "Message helper")) }
                    },
                    onEdit: { reservation in
                        Task { @MainActor in
                            push(.editSignup(reservation: reservation))
                        }
                    }
                )
            )
        case let .editSignup(reservation):
            EditSignupFormView(reservation: reservation) {
                if !path.isEmpty { path.removeLast() }
            }
        case let .manageTrain(trainId):
            ManageTrainView(
                viewModel: ManageTrainViewModel(trainId: trainId),
                onClose: { Task { @MainActor in if !path.isEmpty { path.removeLast() } } },
                onOpenAnalytics: { id in
                    Task { @MainActor in push(.placeholder(label: "Train analytics · \(id)")) }
                },
                onEditDates: { id in
                    Task { @MainActor in push(.placeholder(label: "Edit dates · \(id)")) }
                },
                onInviteHelpers: { id in
                    Task { @MainActor in push(.placeholder(label: "Invite helpers · \(id)")) }
                }
            )
        case .discoverHub:
            DiscoverHubView(
                viewModel: DiscoverHubViewModel(
                    onSelect: { target in
                        Task { @MainActor in
                            switch target {
                            case let .person(userId, _):
                                push(.publicProfile(userId: userId))
                            case let .business(businessId, _):
                                push(.businessProfile(businessId: businessId))
                            case let .gig(gigId):
                                push(.gigDetail(gigId: gigId))
                            case let .listing(listingId):
                                push(.listingDetail(listingId: listingId))
                            case let .post(postId):
                                push(.pulsePost(postId: postId))
                            case .seeAllPeople:
                                push(.connections)
                            case .seeAllBusinesses:
                                push(.discoverBusinesses)
                            case .seeAllGigs:
                                push(.gigsFeed)
                            case .seeAllListings:
                                push(.marketplace)
                            case .seeAllPosts:
                                push(.pulseFeed)
                            }
                        }
                    },
                    onOpenMap: { Task { @MainActor in push(.explore) } }
                )
            )
        case .discoverBusinesses:
            DiscoverBusinessesView(
                viewModel: DiscoverBusinessesViewModel { target in
                    Task { @MainActor in
                        switch target {
                        case let .business(businessId, _):
                            push(.businessProfile(businessId: businessId))
                        case .setHomeAddress:
                            push(.addHome)
                        case .inviteBusiness:
                            let draft = MailDraft(
                                subject: "Join Pantopus",
                                body: "I'd love to see your business on Pantopus — neighbors near me are "
                                    + "looking for trusted local pros. \(InviteLinks.downloadURLString)"
                            )
                            if MailDraft.canSendMail {
                                systemSheet = .mail(draft)
                            } else if let url = draft.mailtoURL {
                                UIApplication.shared.open(url)
                            }
                        }
                    }
                }
            )
        case .myBids:
            MyBidsView(
                viewModel: MyBidsViewModel(
                    onOpenBid: { bid in
                        Task { @MainActor in
                            if let gigId = bid.gigId {
                                push(.gigDetail(gigId: gigId))
                            }
                        }
                    },
                    onBrowseTasks: {
                        Task { @MainActor in push(.gigsFeed) }
                    },
                    onMessageClient: { bid in
                        Task { @MainActor in
                            guard let posterId = bid.gig?.userId else { return }
                            push(.chatConversation(InboxConversationDestination(
                                mode: .person(otherUserId: posterId),
                                displayName: bid.gig?.title ?? "Conversation",
                                initials: "··",
                                identityKind: nil,
                                verified: false
                            )))
                        }
                    }
                    // Edit-bid + Leave-review are presented as sheets from
                    // inside the screen (P3.4) — no router wiring needed.
                )
            )
        case .offers:
            OffersView(
                viewModel: OffersViewModel(
                    onOpenOfferDetail: { dto in
                        guard let gigId = dto.gigId ?? dto.gig?.id else { return }
                        Task { @MainActor in push(.gigDetail(gigId: gigId)) }
                    },
                    onBrowseListings: { Task { @MainActor in push(.marketplace) } },
                    onPostTask: { Task { @MainActor in push(.quickPostGig(category: GigsCategory.all.rawValue)) } }
                )
            )
        case .myTasks:
            MyTasksView(
                viewModel: MyTasksViewModel(
                    onOpenTask: { dto in
                        Task { @MainActor in push(.gigDetail(gigId: dto.id)) }
                    },
                    onOpenBids: { dto in
                        // Bids live inside the owner's gig detail (the
                        // "Review bids" section). Android mirrors this.
                        Task { @MainActor in push(.gigDetail(gigId: dto.id)) }
                    },
                    onEditTask: { dto in
                        Task { @MainActor in push(.editGig(gigId: dto.id)) }
                    },
                    onMessageWorker: { dto in
                        Task { @MainActor in push(.gigDetail(gigId: dto.id)) }
                    },
                    onLeaveReview: { dto in
                        Task { @MainActor in push(.gigDetail(gigId: dto.id)) }
                    },
                    onPostTask: {
                        Task { @MainActor in push(.composeGig(category: GigsCategory.all.rawValue)) }
                    },
                    onRepost: { _ in
                        Task { @MainActor in push(.composeGig(category: GigsCategory.all.rawValue)) }
                    }
                )
            )
        case let .editGig(gigId):
            PostGigV1View(
                viewModel: PostGigV1ViewModel(editGigId: gigId),
                onClose: pop
            ) { savedGigId in
                // Replace the editor with the gig's detail so Back lands
                // on My tasks, not the editor we just left.
                path.removeAll { route in
                    if case .editGig = route { return true }
                    return false
                }
                path.append(.gigDetail(gigId: savedGigId))
            }
        case let .chatConversation(dest):
            ChatConversationView(
                viewModel: ChatConversationViewModel(
                    mode: Self.chatMode(for: dest.mode),
                    counterparty: Self.chatCounterparty(for: dest),
                    currentUserId: currentUserId
                ),
                mode: dest.kind
            ) { Task { @MainActor in pop() } }
        case .menu:
            SettingsView(
                onClose: { Task { @MainActor in pop() } },
                onEditProfile: { Task { @MainActor in push(.editProfile) } },
                onOpenReviewClaims: {
                    // Close the settings sheet/screen then push the admin
                    // queue at the Hub level so its top-bar back chevron
                    // returns to the Hub root, not back into Settings.
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                        push(.reviewClaims)
                    }
                },
                onOpenWallet: {
                    // Same close-then-push pattern as reviewClaims: the
                    // wallet is a top-level destination, not a sub-route
                    // of Settings, so back from it returns to the Hub.
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                        push(.wallet)
                    }
                },
                onSignedOut: { Task { @MainActor in pop() } }
            )
        case .helpCenter:
            HelpCenterView { Task { @MainActor in pop() } }
        case .paymentsSettings:
            SettingsView(
                initialRoute: .payments,
                onClose: { Task { @MainActor in pop() } },
                onEditProfile: { Task { @MainActor in push(.editProfile) } },
                onOpenReviewClaims: {
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                        push(.reviewClaims)
                    }
                },
                onOpenWallet: {
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                        push(.wallet)
                    }
                },
                onSignedOut: { Task { @MainActor in pop() } }
            )
        case .editProfile:
            // `EditProfileView` reads `@Environment(\.dismiss)` and uses
            // it for both Close and save-success pop. Inside a
            // NavigationStack push, `dismiss()` pops to the previous
            // route, so wiring an explicit `onClose` is unnecessary.
            EditProfileView()
        case .reviewClaims:
            ReviewClaimsView(
                viewModel: ReviewClaimsViewModel { claimId in
                    Task { @MainActor in push(.reviewClaimDetail(claimId: claimId)) }
                }
            )
        case let .reviewClaimDetail(claimId):
            ReviewClaimDetailView(
                viewModel: ReviewClaimDetailViewModel(claimId: claimId)
            ) { Task { @MainActor in pop() } }
        case .mailboxSearch:
            MailboxSearchView(
                viewModel: MailboxSearchViewModel(
                    onOpenMail: { mailId in
                        Task { @MainActor in push(.mailItemDetail(mailId: mailId)) }
                    },
                    onCancel: {
                        Task { @MainActor in
                            if !path.isEmpty { path.removeLast() }
                        }
                    }
                )
            )
        case let .placeholder(label):
            NotYetAvailableView(tabName: label, icon: .info)
        // Wave A — pre-staged placeholder destinations. When an A.x screen
        // ships, swap its single line below for the real view.
        case let .todayDetail(briefingDeliveryId, briefingKind):
            TodayDetailView(
                viewModel: TodayDetailViewModel(
                    briefingDeliveryId: briefingDeliveryId,
                    requestedKind: briefingKind
                ),
                onBack: pop,
                onShare: {
                    systemSheet = .share(items: ["Today's Pantopus briefing — \(InviteLinks.downloadURLString)"])
                },
                onMore: { push(.menu) },
                onManage: { push(.notifications) }
            )
        case let .propertyDetails(homeId):
            PropertyDetailsView(
                homeId: homeId,
                onBack: { Task { @MainActor in pop() } },
                onRequestCorrection: {
                    Task { @MainActor in push(.propertyCorrection(homeId: homeId)) }
                }
            )
        case let .addGuest(homeId):
            // A13.1 — Add Guest form. Normally presented via
            // `fullScreenCover` from the Members screen's Guests tab; this
            // route case remains concrete for debug/deep-link parity.
            AddGuestFormView(
                viewModel: AddGuestFormViewModel(homeId: homeId)
            )
        case let .guestPasses(homeId):
            // A13.6 — Guest-pass manager. The FAB pushes the Add Guest
            // form; popping back re-fetches so the new pass appears.
            GuestPassesListView(homeId: homeId) {
                Task { @MainActor in push(.addGuest(homeId: homeId)) }
            }
        case let .transferOwnership(homeId):
            let transferUser: UserDTO? = {
                if case let .signedIn(user) = auth.state { return user }
                return nil
            }()
            TransferOwnershipView(
                viewModel: TransferOwnershipViewModel(
                    homeId: homeId,
                    currentUserId: transferUser?.id,
                    currentUserName: transferUser?.displayName ?? transferUser?.username
                )
            )
        case let .tasksMap(categoryKey):
            TasksMapView(
                viewModel: TasksMapViewModel(
                    initialCategory: GigsCategory(rawValue: categoryKey) ?? .all
                ),
                onOpenTask: { taskId in
                    Task { @MainActor in push(.gigDetail(gigId: taskId)) }
                },
                onCompose: { category in
                    Task { @MainActor in push(.composeGig(category: category.rawValue)) }
                },
                onBack: pop
            )
        case .explore:
            ExploreMapView(
                focus: savedPlaceMapFocus,
                onOpenEntity: { entity in
                    Task { @MainActor in
                        switch entity.kind {
                        case .task: push(.gigDetail(gigId: entity.id))
                        case .item: push(.listingDetail(listingId: entity.id))
                        case .post: push(.pulsePost(postId: entity.id))
                        case .spot: push(.businessProfile(businessId: entity.id))
                        // `homes` markers are neighborhood addresses, not
                        // homes the viewer owns — the backend has no
                        // viewer-facing detail route for someone else's
                        // home, so the tap selects the pin and the rail
                        // card carries the address + locality.
                        case .home: break
                        }
                    }
                },
                onBack: { pop() },
                onOpenSaved: { Task { @MainActor in push(.savedPlaces) } }
            )
        case .savedPlaces:
            SavedPlacesView(
                viewModel: SavedPlacesViewModel(
                    onBack: { Task { @MainActor in pop() } },
                    onExplore: { Task { @MainActor in pop() } },
                    onOpenMap: { latitude, longitude, label in
                        Task { @MainActor in
                            savedPlaceMapFocus = ExploreMapFocus(latitude: latitude, longitude: longitude, label: label)
                            while let last = path.last, last != .explore {
                                path.removeLast()
                            }
                            if !path.contains(.explore) {
                                path.append(.explore)
                            }
                        }
                    }
                )
            )
        case .mailboxRoot:
            makeMailboxRoot(push: push)
        case .communityMail:
            CommunityMailView(viewModel: CommunityMailViewModel { pop() })
        case .homeRecords:
            HomeRecordsView(
                viewModel: HomeRecordsViewModel(
                    onBack: { pop() },
                    onOpenMail: { mailId in
                        Task { @MainActor in push(.mailItemDetail(mailId: mailId)) }
                    }
                )
            )
        case .ceremonialMail:
            CeremonialMailWizardView(
                onDismiss: { Task { @MainActor in pop() } },
                onOpenMail: { _ in Task { @MainActor in pop() } }
            )
        case let .ceremonialMailOpen(mailId):
            CeremonialMailOpenView(
                viewModel: CeremonialMailOpenViewModel(mailId: mailId),
                onBack: { Task { @MainActor in pop() } },
                onWriteBack: { _ in Task { @MainActor in push(.ceremonialMail) } }
            )
        case .mailRoutingQueue:
            MailRoutingQueueView { Task { @MainActor in pop() } }
        case .mailParty:
            MailPartyView(
                onOpenMail: { mailId in
                    Task { @MainActor in push(.mailItemDetail(mailId: mailId)) }
                },
                onClose: { Task { @MainActor in pop() } }
            )
        case .mailboxMap:
            MailboxMapView { pop() }
        case .vacationHold:
            VacationHoldView(
                viewModel: VacationHoldViewModel {
                    pop()
                }
            )
        case let .mailDay(variant):
            MailDayView(viewModel: MailDayViewModel(variant: variant)) {
                pop()
            }
        case .wallet:
            // Withdraw + payout setup (Block 3C) are handled inside WalletView
            // via the WalletViewModel (Stripe Connect onboarding / dashboard /
            // withdraw); only the navigation affordances stay as callbacks.
            WalletView(
                onBack: pop,
                onOpenHistory: { Task { @MainActor in push(.walletActivityList) } },
                onOpenTaxDocs: { Task { @MainActor in push(.placeholder(label: "Tax documents")) } },
                onSeeAllActivity: { Task { @MainActor in push(.walletActivityList) } }
            )
        case .walletActivityList:
            WalletActivityListView(
                viewModel: WalletActivityListViewModel(),
                onBack: pop
            )

        // MARK: - B1.6 batch-2 routing seam
        // Placeholder destinations. Each screen prompt (B2–B5) swaps the one
        // line below for its real view without editing the route declarations.
        case .stamps:
            StampsView(viewModel: StampsViewModel { pop() })
        case let .mailTask(taskId):
            // A17.12 — Mail-derived task detail. Source-mail + next-up
            // taps push the originating mail item onto this same stack.
            MailTaskView(
                viewModel: MailTaskViewModel(
                    taskId: taskId,
                    onOpenMail: { mailId in
                        Task { @MainActor in push(.mailItemDetail(mailId: mailId)) }
                    },
                    onBack: { if !path.isEmpty { path.removeLast() } }
                )
            )
        case let .mailTaskList(mailId, mailSubject, mailSender):
            // A17.12 (list) — every mail-linked task, plus the
            // create-from-mail form when the route carries a mail id.
            MailTaskListView(
                viewModel: MailTaskListViewModel(
                    mailId: mailId,
                    mailSubject: mailSubject,
                    mailSender: mailSender,
                    onOpenTask: { taskId in
                        Task { @MainActor in push(.mailTask(taskId: taskId)) }
                    },
                    onBack: { if !path.isEmpty { path.removeLast() } },
                    onPostAsNeighborTask: { sourceMailId in
                        // A17.8 — RN's "Post as Neighbor Task Instead"
                        // (`mailbox/tasks.tsx:236`) always escalates in
                        // post-delivery mode.
                        Task { @MainActor in
                            push(.packageGig(mailId: sourceMailId, isPreDelivery: false))
                        }
                    }
                )
            )
        case let .mailTranslation(mailId):
            MailTranslationView(
                mailId: mailId,
                onBack: { if !path.isEmpty { path.removeLast() } },
                onReply: { _ in Task { @MainActor in push(.placeholder(label: "Reply in English")) } }
            )
        case let .unboxing(mailId):
            // A17.14 — the capture flow loads the real `MailPackage` row for
            // `mailId` and every action writes to `/api/mailbox/v2/p2`.
            // Without a mail id there is nothing to persist, and the screen
            // says so rather than projecting a fixture.
            let openDrawer: @MainActor () -> Void = {
                Task { @MainActor in push(.mailboxVault) }
            }
            UnboxingView(
                viewModel: UnboxingViewModel(mailId: mailId, onOpenDrawer: openDrawer)
            ) { if !path.isEmpty { path.removeLast() } }
        case let .packageGig(mailId, isPreDelivery):
            // A17.8 → "Ask a Neighbor" — posts the package-help gig via
            // `POST /api/mailbox/v2/p2/package/:mailId/gig` and deep-links
            // into the created gig, matching RN `mailbox/gig.tsx`.
            PackageGigView(
                viewModel: PackageGigViewModel(
                    mailId: mailId,
                    isPreDelivery: isPreDelivery,
                    onBack: { if !path.isEmpty { path.removeLast() } },
                    onOpenGig: { gigId in
                        Task { @MainActor in push(.gigDetail(gigId: gigId)) }
                    }
                )
            )
        case .earn:
            EarnView(
                onBack: pop,
                onHelp: { Task { @MainActor in push(.placeholder(label: "Earn help")) } },
                onCashOut: { Task { @MainActor in push(.paymentsSettings) } },
                onBrowseTasks: { Task { @MainActor in push(.gigsFeed) } },
                onReferNeighbor: { Task { @MainActor in push(.placeholder(label: "Refer a neighbor")) } },
                onOfferService: { Task { @MainActor in push(.placeholder(label: "Offer a service")) } },
                onManagePayout: { Task { @MainActor in push(.paymentsSettings) } },
                onAddBank: { Task { @MainActor in push(.paymentsSettings) } },
                onSeeAllEarnings: { Task { @MainActor in push(.placeholder(label: "All earnings")) } },
                onOpenTaxDocs: { Task { @MainActor in push(.placeholder(label: "Tax documents")) } }
            )
        case let .businessOwner(businessId):
            BusinessOwnerView(
                businessId: businessId,
                onBack: { Task { @MainActor in pop() } },
                onEditPage: { Task { @MainActor in push(.editBusinessPage(businessId: businessId)) } },
                onOpenInsights: { Task { @MainActor in push(.placeholder(label: "Insights")) } },
                onOpenSettings: { Task { @MainActor in push(.placeholder(label: "Business settings")) } },
                onOpenTeam: { Task { @MainActor in push(.businessTeam(businessId: businessId)) } },
                onOpenPages: { Task { @MainActor in push(.businessPages(businessId: businessId)) } },
                onOpenPayments: { Task { @MainActor in push(.businessPaymentsOwner(businessId: businessId)) } },
                onOpenInvoices: { Task { @MainActor in push(.businessInvoicesOwner(businessId: businessId)) } },
                onOpenLegal: { Task { @MainActor in push(.businessLegal(businessId: businessId)) } },
                onOpenChatRoom: { roomId, name, _ in
                    Task { @MainActor in
                        push(.chatConversation(InboxConversationDestination(
                            mode: .room(id: roomId),
                            displayName: name,
                            initials: Self.initials(from: name),
                            identityKind: nil,
                            verified: false
                        )))
                    }
                },
                onOpenPost: { postId in Task { @MainActor in push(.pulsePost(postId: postId)) } }
            )
        case let .businessTeam(businessId):
            BusinessTeamView(businessId: businessId)
        case let .businessPaymentsOwner(businessId):
            BusinessPaymentsView(businessId: businessId)
        case let .businessInvoicesOwner(businessId):
            BusinessInvoicesView(businessId: businessId)
        case let .businessLegal(businessId):
            BusinessLegalView(businessId: businessId)
        case let .businessLocations(businessId):
            BusinessLocationsView(businessId: businessId)
        case .viewAs:
            ViewAsView(
                onBack: { Task { @MainActor in pop() } },
                onManagePrivacy: { Task { @MainActor in push(.privacySettings) } },
                onEdit: { Task { @MainActor in push(.editProfile) } }
            )
        case .privacySettings:
            PrivacyView(viewModel: PrivacySettingsViewModel()) { Task { @MainActor in pop() } }
        case let .waitingRoom(homeId):
            WaitingRoomView(
                viewModel: WaitingRoomViewModel(homeId: homeId, state: .active),
                onBack: { pop() },
                onNav: { nav in handleWaitingRoomNav(nav, homeId: homeId) }
            )
        case .addHome:
            AddHomeWizardView(
                onOpenHomeDashboard: { homeId in
                    // Replace the wizard with the dashboard so Back goes to
                    // MyHomes, not the success screen.
                    path.removeAll { $0 == .addHome }
                    path.append(.homeDashboard(homeId: homeId))
                },
                onOpenClaimOwnership: { homeId in
                    path.removeAll { $0 == .addHome }
                    path.append(.claimOwnership(homeId: homeId))
                },
                onOpenWaitingRoom: { homeId in
                    path.removeAll { $0 == .addHome }
                    path.append(.waitingRoom(homeId: homeId))
                }
            )
        case .findHome:
            FindHomeView(
                onBack: { pop() },
                onOpenClaimOwnership: { homeId in
                    Task { @MainActor in push(.claimOwnership(homeId: homeId)) }
                },
                onOpenAddHome: { Task { @MainActor in push(.addHome) } }
            )
        case let .placeDashboard(homeId):
            PlaceDashboardView(
                viewModel: PlaceDashboardViewModel(
                    homeId: homeId,
                    onOpenDetail: { group in push(.placeDetail(homeId: homeId, group: group)) },
                    onOpenPulse: { push(.placePulse(homeId: homeId)) },
                    onSelectHome: { id in push(.placeDashboard(homeId: id)) },
                    onAddPlace: { push(.addHome) },
                    // The sheet's doors open the REAL flows (Wedge Phase 2, D3);
                    // the simulated status screen stays only for previews.
                    onStartVerify: { method, _ in
                        switch method {
                        case .document: push(.verifyResidency(homeId: homeId))
                        case .mail: push(.postcardVerification(homeId: homeId))
                        case .landlord: push(.verifyLandlord(homeId: homeId))
                        }
                    },
                    onComposeMessage: { address in
                        push(.neighborCompose(homeId: homeId, address: address, recipient: nil))
                    },
                    onOpenInbox: { push(.neighborInbox) },
                    onOpenPrivacyMirror: { push(.privacyMirror(homeId: homeId)) },
                    onOpenHubHome: {}
                )
            )
        case let .placeDetail(homeId, group):
            PlaceDetailView(
                viewModel: PlaceDetailViewModel(homeId: homeId, group: group)
            ) { pop() }
        case let .placePulse(homeId):
            PlacePulseView(
                viewModel: PlacePulseViewModel(homeId: homeId)
            ) { pop() }
        case let .privacyMirror(homeId):
            PlacePrivacyMirrorView(viewModel: PlacePrivacyMirrorViewModel(homeId: homeId)) { pop() }
        case let .placeVerifyStatus(homeId, method, address):
            PlaceVerifyStatusView(
                address: address,
                method: method,
                onBack: { pop() },
                onDone: {
                    path.removeAll { route in
                        if case .placeVerifyStatus = route { return true }
                        return false
                    }
                }
            )
            .id(homeId)
        case let .neighborCompose(homeId, address, recipient):
            NeighborMessageComposeView(
                viewModel: NeighborMessageComposeViewModel(
                    senderHomeId: homeId,
                    address: address,
                    recipient: recipient
                ),
                onBack: { pop() },
                onChangeRecipient: { pop() },
                onDone: { pop() }
            )
        case .neighborInbox:
            NeighborMessageInboxView(
                viewModel: NeighborMessageInboxViewModel(),
                onBack: { pop() },
                onOpenMessage: { messageId in push(.neighborMessage(messageId: messageId)) }
            )
        case let .neighborMessage(messageId):
            NeighborMessageReceivedView(
                viewModel: NeighborMessageReceivedViewModel(messageId: messageId)
            ) { pop() }
        case let .scheduling(route):
            SchedulingRouter.destination(for: route, owner: .personal) { push(.scheduling($0)) }
        #if DEBUG
        case .tokenGallery: TokenGalleryView()
        case .iconGallery: IconGalleryView()
        case .componentGallery: ComponentGalleryView()
        #endif
        }
    }

    /// W6 — create the home a stranger looked up in the signed-out funnel
    /// (stashed in `PlacePendingStore`) once they have an account. Best
    /// effort: DPV validation may reject it; the resident can re-add it.
    private static func savePendingPlaceIfNeeded() async {
        guard let pending = PlacePendingStore.take(), !pending.street.isEmpty else { return }
        let request = CreateHomeRequest(
            address: pending.street,
            city: pending.city,
            state: pending.state,
            zipCode: pending.zip,
            latitude: pending.latitude,
            longitude: pending.longitude,
            homeType: "house"
        )
        _ = try? await APIClient.shared.request(HomesEndpoints.create(request)) as CreateHomeResponse
    }

    /// W3 — the primary home id used to auto-land the Home tab on Place.
    /// Prefers the verified primary owner, else the first home; nil when
    /// the user has no home (Hub stays the landing).
    /// Push the Place dashboard, and a group-detail page on top when the
    /// link named one. The dashboard always goes on first so Back lands
    /// there rather than leaving the stack — matching `.mailDay` above.
    /// An unrecognised slug degrades to the dashboard rather than a dead end.
    private func pushPlace(homeId: String, slug: String?) {
        path.append(.placeDashboard(homeId: homeId))
        if let slug, let group = PlaceDetailGroup(rawValue: slug) {
            path.append(.placeDetail(homeId: homeId, group: group))
        }
    }

    private static func primaryHomeId() async -> String? {
        guard let response: MyHomesResponse = try? await APIClient.shared.request(
            HomesEndpoints.myHomes()
        ) else { return nil }
        return response.homes.first { $0.isPrimaryOwner == true }?.id
            ?? response.homes.first?.id
    }

    private static func billsListViewModel(
        homeId: String,
        push: @escaping @MainActor @Sendable (HubRoute) -> Void
    ) -> BillsListViewModel {
        let openBill: @Sendable (String) -> Void = { billId in
            Task { @MainActor in push(.billDetail(homeId: homeId, billId: billId)) }
        }
        let addBill: @Sendable () -> Void = {
            Task { @MainActor in push(.addBill(homeId: homeId)) }
        }
        return BillsListViewModel(
            homeId: homeId,
            onOpenBill: openBill,
            onAddBill: addBill
        )
    }

    private static func packagesListViewModel(
        homeId: String,
        currentUserId: String?,
        push: @escaping @MainActor @Sendable (HubRoute) -> Void
    ) -> PackagesListViewModel {
        let openPackage: @Sendable (String) -> Void = { packageId in
            Task { @MainActor in push(.packageDetail(homeId: homeId, packageId: packageId)) }
        }
        let logPackage: @Sendable () -> Void = {
            Task { @MainActor in push(.logPackage(homeId: homeId)) }
        }
        return PackagesListViewModel(
            homeId: homeId,
            currentUserId: currentUserId,
            onOpenPackage: openPackage,
            onLogPackage: logPackage
        )
    }

    /// Construct the Polls list VM with navigation callbacks wired to
    /// `push(.pollDetail(…))` for row taps and `push(.startPoll(…))` for
    /// the FAB + empty-state CTA (P2.5 composer).
    private static func pollsListViewModel(
        homeId: String,
        push: @escaping @MainActor @Sendable (HubRoute) -> Void
    ) -> PollsListViewModel {
        let openPoll: @Sendable (String) -> Void = { pollId in
            Task { @MainActor in push(.pollDetail(homeId: homeId, pollId: pollId)) }
        }
        let startPoll: @Sendable () -> Void = {
            Task { @MainActor in push(.startPoll(homeId: homeId)) }
        }
        return PollsListViewModel(
            homeId: homeId,
            onOpenPoll: openPoll,
            onStartPoll: startPoll
        )
    }
}

private struct HubModalRoute: Identifiable, Equatable {
    let route: HubRoute

    var id: HubRoute {
        route
    }
}

#if DEBUG
extension HubRoute: Identifiable {
    public var id: Self {
        self
    }
}
#endif

/// Small wrapper that injects the `openURL` environment action into the
/// Business Profile screen so the "Visit" button can punch out to Safari
/// without the navigation host having to depend on `UIApplication`.
@MainActor
private struct BusinessProfileDestination: View {
    let businessId: String
    /// C4 — non-nil when the `pantopus://b/:username/:slug` link named a
    /// custom page; the profile then loads that page's published blocks.
    var pageSlug: String?
    let onBack: @MainActor () -> Void
    let onOpenMessages: @MainActor (InboxConversationDestination) -> Void
    let onShare: @MainActor () -> Void
    let onOpenReport: @MainActor () -> Void
    let onEdit: @MainActor () -> Void

    @Environment(\.openURL) private var openURL

    var body: some View {
        BusinessProfileView(
            businessId: businessId,
            pageSlug: pageSlug,
            onBack: onBack,
            onOpenMessages: onOpenMessages,
            onShare: onShare,
            onOpenReport: onOpenReport,
            onOpenWebsite: { url in openURL(url) },
            onEdit: onEdit
        )
    }
}

#Preview {
    HubTabRoot()
}
