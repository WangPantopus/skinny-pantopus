//
//  YouTabRoot.swift
//  Pantopus
//
//  The "You" tab — the user's identity command center. Hosts the
//  navigation stack + the sign-out confirmation + the DEBUG deep-link
//  affordances. The actual screen body is `MeView` (T1.3): one chrome
//  with three identity bindings (Personal / Home / Business).
//

// swiftlint:disable cyclomatic_complexity file_length function_body_length type_body_length

import SwiftUI
import UIKit

// swiftlint:disable multiple_closures_with_trailing_closure

/// Typed routes within the You tab's NavigationStack.
public enum YouRoute: Hashable {
    case signOutConfirm
    /// B.1 — unified Mailbox root (drawer chips × tabs). Entry point for
    /// mailbox navigation from the You tab.
    case mailboxRoot
    /// A.x — Mailbox map (physical postal venues), reached from the root.
    case mailboxMap
    /// A13.16 — My Mail Day editor (mid-afternoon triage + empty hero).
    /// Pushed from the Mailbox root header CTA + the
    /// `pantopus://mailbox/mailday` deep link.
    case mailDay(variant: MailDayVariant)
    case mailItemDetail(mailId: String)
    /// P4.2 — Mailbox search. Client-side filter over the user's mailbox.
    case mailboxSearch
    /// A14.8 — Vacation hold (scheduling + active variants). Reached
    /// from the Mailbox root top-bar settings menu.
    case vacationHold
    case settings
    /// A14.6 — Settings → Payments (payments-out · Stripe setup).
    case paymentsSettings
    case placeholder(label: String)
    case helpCenter
    case privacySettings
    case legal
    case legalContent(LegalDocument)
    case addHome
    /// A12.1 — "Find or Add Home" discovery. Mirrors RN
    /// `src/app/homes/find.tsx`.
    case findHome
    case myClaims
    case claimStatus(claimId: String)
    case claimOwnership(homeId: String)
    /// Residency-verification variant of the evidence flow. Sends
    /// `claim_type: 'resident'` and offers the lease / utility-bill /
    /// tax-bill document set (RN
    /// `homes/[id]/claim-owner/evidence.tsx?verificationType=residency`).
    case verifyResidency(homeId: String)
    /// T5.2.4 — cross-listing Offers (incoming + outgoing).
    case offers
    /// T5.3.1 — My bids. The "me.bids" action tile pushes here.
    case myBids
    /// T5.3.2 — My tasks V2. The "me.gigs" action tile pushes here.
    case myTasks
    /// Browse available neighbour gigs.
    case gigsFeed
    /// Search available neighbour gigs.
    case gigSearch
    /// Map/list browse for available neighbour gigs.
    case tasksMap(categoryKey: String)
    /// Explore map, optionally focused on a saved place coordinate.
    case explore(focus: ExploreMapFocus?)
    /// P2.2 — Post-a-Task wizard. Pushed from the My tasks FAB / empty
    /// CTA. Routes to the new gig's detail on success.
    case composeTask
    /// A13.8 Phase 4 — edit an open gig with the V1 single-screen
    /// composer (prefill + `PATCH /api/gigs/:id`). Pushed from the My
    /// tasks per-row "Edit" action; routes to the gig's detail on save.
    case editGig(gigId: String)
    /// T5.3.3 — My posts. The "me.posts" Activity-section row pushes here.
    case myPosts
    /// Compose a Pulse post from the You tab's My posts surface.
    case composePost(intent: String)
    /// P3.5 — Edit an existing Pulse post. Pushed from the per-row Edit
    /// CTA on My posts; re-uses the compose flow in edit mode.
    case editPost(postId: String)
    case pulsePost(postId: String)
    /// T5.2.3 — Connections. The "me.connections" Personal action tile pushes here.
    case connections
    /// T6.6c (P26.5) — Support Trains. The "me.supportTrains" Personal
    /// action tile pushes here. Personal pillar (mutual-aid surface).
    case supportTrains
    /// P2.6 — Start-a-Support-Train wizard (organizer compose flow).
    /// Pushed when the Support Trains FAB / empty-state CTA fires.
    case startSupportTrain
    /// A nearby Support Train tapped in the Tasks feed's merged
    /// "All" / "Support Trains" scope.
    case supportTrainDetail(supportTrainId: String)
    /// T6.6c (P26.5) — Review signups (organizer-only) for one Support
    /// Train. Pushed from a Support Trains row tap.
    case reviewSignups(supportTrainId: String)
    /// P4.6 — Support Trains search. Pushed from the Support Trains list
    /// top-bar search action; reuses the shared `SearchListShell`.
    case searchSupportTrains
    /// P3.7 — Edit Signup form (organizer-side mutation of a helper
    /// reservation). Pushed from the Review-signups per-row Edit
    /// action with the seed DTO baked in so the form can prefill
    /// without a re-fetch.
    case editSignup(reservation: SupportTrainReservationDTO)
    /// A13.13 / P4.3 — Manage train (organizer surface). Pushed from
    /// the A10.9 detail dock overflow when the viewer is the organizer
    /// and from the `pantopus://support-trains/:id/manage` deep link.
    case manageTrain(trainId: String)
    /// T6.3f / P14 — My homes (avatar-first roster). The "me.homes"
    /// Activity-section row pushes here; tapping a row drills into the
    /// home dashboard via `homeDashboard(homeId:)`.
    case myHomes
    /// T6.3f / P14 — My listings (Active / Sold / Drafts tabs). The
    /// "me.listings" Personal action tile pushes here.
    case myListings
    /// T6.3f / P14 — My businesses (avatar-first roster). The
    /// "me.businesses" Activity-section row pushes here.
    case myBusinesses
    /// Public business profile reached from My businesses.
    case businessProfile(businessId: String)
    /// P4.2 — A13.10 Edit Business Page (owner-only). Pushed from the
    /// `BusinessProfileView` overflow when the viewer owns the business
    /// and from the `pantopus://businesses/:id/page-editor` deep link.
    case editBusinessPage(businessId: String)
    /// C4 — the custom Pages CMS index for a business.
    case businessPages(businessId: String)
    /// C4 — the block builder for one custom page.
    case businessPageBlocks(businessId: String, pageId: String, pageTitle: String)
    /// Legacy waitlist route — forwards to the Create Business wizard.
    case businessWaitlist
    /// A12.10 — Create Business wizard. Reached from the My Businesses
    /// FAB / empty-state CTA in the You tab (and deep link / waitlist).
    case createBusiness
    /// T6.3f / P14 — Home dashboard for a specific home, reached from
    /// the My homes row tap inside the You stack.
    case homeDashboard(homeId: String)
    /// T3.2 — Identity Center. The "me.identityCenter" Personal section row pushes here.
    case identityCenter
    /// T3.3 — Audience profile. The "me.audience" Personal section row pushes here.
    case audienceProfile
    /// A22.2 — "Your audience" creator member management (pending requests +
    /// tier-grouped active members). Pushed from the Audience Profile
    /// Followers tab "Your audience" entry row.
    case creatorAudienceMembers
    /// A03.2 — Beacon Updates feed (`surface=personas`), reached from the
    /// Audience Profile "Beacon Updates" entry row.
    case beaconsFeed
    /// A21.1 — another user's public Beacon profile by handle (visitor
    /// role). Reached from the Following list row tap.
    case beaconProfile(handle: String)
    /// §1A① — "Following": the Beacons the signed-in user follows, reached
    /// from the Audience Profile "Following" entry row.
    case following
    /// BLOCK 2E — "Saved places": the places the user has bookmarked from
    /// Explore. Reached from the Me profile "Saved places" Activity row.
    case savedPlaces
    case privacyHandshake(personaHandle: String)
    /// P1.3 — Broadcast detail full-screen takeover, pushed when the
    /// creator taps an update card on the Audience Profile. The
    /// `card` payload seeds the hero + delivered/read counters so the
    /// detail can render without a second fetch, and `tierSegments`
    /// carries the persona's tier ladder so the read-share bar paints
    /// per-tier widths immediately.
    case broadcastDetail(broadcastId: String, card: UpdateCardContent, tierSegments: [TierBreakdownContent.TierSegment])
    /// P1.2 — Creator Inbox (standalone DM thread list for creators).
    /// The "me.creatorInbox" Personal section row pushes here, and the
    /// Audience Profile Threads tab "View all messages" CTA also lands
    /// here.
    case creatorInbox
    /// C5 — Persona DM thread push from a Creator Inbox row tap. Persona
    /// DMs are a distinct surface from generic chat: addressed by thread
    /// id, with no counterparty user id on the wire.
    case creatorInboxConversation(CreatorInboxThreadDestination)
    /// C5 — Fan-side persona inbox for one persona (A15.5). Reached from
    /// the membership screen's "Open inbox" CTA.
    case fanInbox(personaId: String)
    /// T5.2.2 — Bills. The home-context "me.bills" action tile + Activity
    /// row push here with the primary home id resolved by the VM.
    case homeBills(homeId: String)
    /// Bill detail (read-mostly summary with mark-paid / remove).
    case billDetail(homeId: String, billId: String)
    /// Add / edit Bill wizard. `billId == nil` creates a new bill.
    case addBill(homeId: String, billId: String? = nil)
    /// T5.2.1 — Pets. The home-context "me.pets" action tile pushes here.
    case homePets(homeId: String)
    /// T6.4c (P18) — Home calendar. The home-context "me.calendar"
    /// action tile + Home Dashboard "calendar" quick-action push here
    /// with the primary home id resolved by the VM.
    case homeCalendar(homeId: String)
    /// P2.7 — Add / edit calendar event. `eventId` non-nil = edit.
    case addCalendarEvent(homeId: String, eventId: String?, prefilledCategory: String?)
    /// P2.7 — Calendar event detail with Edit + Delete actions.
    case calendarEventDetail(homeId: String, eventId: String)
    /// T6.4b — Emergency info. The home-context "me.emergency" Activity
    /// row pushes here with the primary home id resolved by the VM.
    case homeEmergency(homeId: String)
    /// P2.8 — Add Emergency Info form.
    case addEmergencyInfo(homeId: String)
    /// P2.8 — Emergency item detail.
    case emergencyItem(homeId: String, emergencyId: String)
    /// T6.4b — Documents. The home-context "me.docs" action tile pushes
    /// here with the primary home id resolved by the VM.
    case homeDocs(homeId: String)
    /// P2.10 — Upload document form for a home.
    case uploadDocument(homeId: String)
    /// P2.10 — Document detail (preview + metadata + footer actions).
    case documentDetail(homeId: String, documentId: String)
    /// P4.5 — Document Search surface (search across title / tags /
    /// category) for a home's vault.
    case documentSearch(homeId: String)
    /// T6.3d — Packages. The home-context "me.packages" Activity row +
    /// the Home Dashboard "view_packages" quick action push here.
    case homePackages(homeId: String)
    /// T6.3d — Package detail. Pushed from a row tap on the Packages list.
    case packageDetail(homeId: String, packageId: String)
    /// T6.3d — Log a package sheet target. Presented modally from the
    /// Packages list FAB and the empty-state CTA.
    case logPackage(homeId: String)
    /// T6.3e — Polls. The home-context "me.polls" action tile pushes here.
    case homePolls(homeId: String)
    /// T6.3e — Poll detail. Pushed from a Polls list row.
    case pollDetail(homeId: String, pollId: String)
    /// P2.5 — Start-a-poll composer. Pushed from the Polls list FAB +
    /// empty-state CTA.
    case startPoll(homeId: String)
    /// T6.4a — Access codes. Per-home roster of Wi-Fi / Alarm / Gate /
    /// Lockbox / Garage / Smart lock codes. The "me.access" Household-
    /// section row pushes here with the primary home id resolved by
    /// the VM; the Home Dashboard quick-action shares the same screen.
    /// `homeName` is an optional pre-resolved subtitle ("412 Birch Ln")
    /// rendered under the title while the underlying home payload is
    /// in flight or unavailable.
    case accessCodes(homeId: String, homeName: String?)
    /// P3.1 — Add (no secretId) / Edit (with secretId) access code.
    /// `category` is set when the user lands here from the empty-state
    /// quick-start chips so the form pre-selects the matching tile.
    case editAccessCode(homeId: String, secretId: String?, categoryRaw: String?)
    /// P4.6 — Access codes search. Pushed from the Access codes list
    /// top-bar search action; `homeId` scopes the corpus to one home.
    case searchAccessCodes(homeId: String)
    /// T6.3c / P11 — Household tasks (per-home chore list). The
    /// "me.tasks" Activity-section row pushes here with the primary
    /// home id resolved by the Me VM. Distinct from `.myTasks` which is
    /// the posted-to-neighbours gig list.
    case homeTasks(homeId: String)
    /// P2.4 — Add a new household task. Reached from the household
    /// tasks list FAB.
    case addHouseholdTask(homeId: String)
    /// P2.4 / P3.6 — Edit an existing household task. Reached from the
    /// "Edit recurring" overflow action on a Recurring row. Re-uses the
    /// `AddHouseholdTaskFormView` shell in Edit mode.
    case editHouseholdTask(homeId: String, taskId: String)
    /// T6.3b / P10 — Maintenance. The home-context "me.maintenance"
    /// action tile pushes here.
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
    /// P15 / T6.3g — Owners (legal-title roster). The "me.owners"
    /// Household-section row pushes here with the primary home id
    /// resolved by `MeViewModel.homeSections(...)`.
    case homeOwners(homeId: String)
    /// H5 — Transfer Ownership form. Pushed from the sticky
    /// "Transfer Ownership" action on the Owners list (RN parity:
    /// `src/app/homes/[id]/owners/index.tsx:116-123`).
    case transferOwnership(homeId: String)
    /// H6 — per-home **owner** claim review (ownership + residency
    /// claims on this home). Pushed from the Owners list top-bar gavel.
    /// Distinct from the admin `reviewClaims` queue in `HubRoute`.
    case homeClaimReview(homeId: String)
    /// T6.3a / P9 — Members. The home-context "me.members" action tile +
    /// "Household" section row both push here with the resolved home id.
    case homeMembers(homeId: String)
    /// T5.3.4 — per-listing offers panel. Pushed from a listing detail
    /// "View offers" affordance (visible when the current user owns the
    /// listing). The optional `title` is a hint rendered as the
    /// subtitle while the listing payload is in flight.
    case listingOffers(listingId: String, title: String?)
    /// Gig detail destination for an offer-row tap. Reuses the existing
    /// Transactional Detail shell.
    case gigDetail(gigId: String)
    /// Marketplace browse surface reached from Offers.
    case marketplace
    /// Listing detail destination reached from the listing-offers buyer
    /// row tap so the seller can drill back into the canonical view.
    case listingDetail(listingId: String)
    /// Snap & sell composer reached from My listings / Marketplace.
    case composeListing
    /// Push the chat conversation for a given counterparty. Payload
    /// mirrors the Inbox tab's `InboxConversationDestination` so the same
    /// `ChatConversationView` can host the thread inside the You stack.
    case chatConversation(InboxConversationDestination)
    case publicProfile(userId: String)
    /// P3.3 — Edit an existing listing. Reached from the listing-detail
    /// overflow ("Edit listing") for the owner, or from the listing-
    /// offers panel's "Edit price" affordance.
    case editListing(listingId: String, jumpToStep: ListingComposeStep?)
    /// A.x — Membership detail for a persona.
    case membershipDetail(personaId: String)
    /// A.5 — Professional profile.
    case professionalProfile
    /// A.6 — Edit persona.
    case editPersona(personaId: String)
    /// A.7 — Compose broadcast from a persona.
    case composeBroadcast(personaId: String)

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
    /// A18.5 — "View as" identity preview. `pantopus://identity/preview`.
    case viewAs
    /// A18.4 — Persistent "waiting for approval" room.
    /// `pantopus://homes/:id/waiting-room`.
    case waitingRoom(homeId: String)
    /// Cancel ownership claim from waiting room / home settings.
    case cancelClaim(homeId: String)
    /// A12 — Landlord-verification wizard. Reached from the waiting
    /// room's Verification Center action cards.
    case verifyLandlord(homeId: String)
    /// A12.7 — Postcard verification / code entry. Reached from the
    /// waiting room's Verification Center action cards.
    case postcardVerification(homeId: String)
    /// "This isn't my home" — the Leave home confirm, which owns
    /// `POST /api/homes/:id/move-out`.
    case leaveHome(homeId: String)
    /// Four-moment Ceremonial Mail compose wizard. Production entry point
    /// is the Mailbox root's compose FAB.
    case ceremonialMail
    /// Ceremonial open experience for a letter carrying a stationery
    /// theme. Reached by redirect from the generic mail detail.
    case ceremonialMailOpen(mailId: String)
    /// Disambiguation queue behind the Mailbox root's
    /// "N items need routing" banner.
    case mailRoutingQueue
    /// Family Mail Party — household co-opening (discover / join / start /
    /// react / hand off). Reached from the Mailbox root overflow menu.
    case mailParty
    /// Calendarly scheduling sub-routes (Foundation I0b).
    case scheduling(SchedulingRoute)
    #if DEBUG
    case statusWaiting
    #endif
}

#if DEBUG
private struct DebugInviteHomeItem: Identifiable, Hashable {
    let id: String
}

private struct DebugDisambiguateItem: Identifiable, Hashable {
    let id: String
}
#endif

/// NavigationStack wrapper for the You tab.
public struct YouTabRoot: View {
    @Environment(AuthManager.self) private var auth
    @Environment(\.openURL) private var openURL
    @State private var path = RouteStack<YouRoute>()
    @State private var showsSignOutConfirm = false
    @State private var showsEditProfile = false
    /// P6.6 — share system sheet driven by "Share train".
    @State private var systemSheet: SystemSheetRequest?
    /// P6.6 — "Find people" → contacts picker → invite share.
    @State private var showFindPeople = false
    #if DEBUG
    @State private var debugProfileSheet = false
    @State private var debugPostSheet = false
    @State private var debugInviteHomeSheet = false
    @State private var debugDisambiguateSheet = false
    @State private var debugHandshakeSheet = false
    @State private var debugInviteTokenSheet = false
    @State private var debugProfileId = ""
    @State private var debugPostId = ""
    @State private var debugInviteHomeId = ""
    @State private var debugDisambiguateMailId = ""
    @State private var debugHandshakeHandle = ""
    @State private var debugInviteToken = ""
    @State private var debugCeremonialMailOpenSheet = false
    @State private var debugCeremonialMailOpenId = ""
    @State private var debugInviteFormHomeId: String?
    @State private var debugDisambiguateFormMailId: String?
    #endif

    private var currentUserId: String? {
        if case let .signedIn(user) = auth.state { return user.id }
        return nil
    }

    /// Current user's handle — used to open the public-profile setup
    /// (privacy handshake) for "Set up Public Profile".
    private var currentUserHandle: String {
        if case let .signedIn(user) = auth.state { return user.username }
        return ""
    }

    /// True when opened from the `monthly_receipt` push — the Monthly
    /// Receipt card renders expanded (RN `/(tabs)/profile?tab=receipt`).
    private let expandMonthlyReceipt: Bool

    public init(expandMonthlyReceipt: Bool = false) {
        self.expandMonthlyReceipt = expandMonthlyReceipt
    }

    public var body: some View {
        NavigationStack(path: navigationPathBinding) {
            MeView(
                expandMonthlyReceipt: expandMonthlyReceipt,
                onAction: { tile in handleAction(tile) },
                onSection: { row in handleSection(row) },
                onLogOut: { showsSignOutConfirm = true }
            )
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: YouRoute.self) { route in
                destination(for: route)
            }
            .confirmationDialog(
                "Sign out of Pantopus?",
                isPresented: $showsSignOutConfirm,
                titleVisibility: .visible
            ) {
                Button("Sign out", role: .destructive) {
                    Task { await auth.signOut() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You'll need to sign in again to access your hub.")
            }
            .sheet(isPresented: $showsEditProfile) {
                EditProfileView()
            }
            .sheet(item: $systemSheet) { request in request.makeView() }
            .findPeopleSheet(isPresented: $showFindPeople)
            .overlay(alignment: .topLeading) { debugTapTarget }
            #if DEBUG
                .alert("Open profile", isPresented: $debugProfileSheet) {
                    TextField("User ID", text: $debugProfileId)
                    Button("Open") {
                        let id = debugProfileId.trimmingCharacters(in: .whitespaces)
                        if !id.isEmpty {
                            path.append(.publicProfile(userId: id))
                            debugProfileId = ""
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Paste a Pantopus user UUID")
                }
                .alert("Open post", isPresented: $debugPostSheet) {
                    TextField("Post ID", text: $debugPostId)
                    Button("Open") {
                        let id = debugPostId.trimmingCharacters(in: .whitespaces)
                        if !id.isEmpty {
                            path.append(.pulsePost(postId: id))
                            debugPostId = ""
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Paste a Pulse post UUID")
                }
                .alert("Invite owner", isPresented: $debugInviteHomeSheet) {
                    TextField("Home ID", text: $debugInviteHomeId)
                    Button("Open") {
                        let id = debugInviteHomeId.trimmingCharacters(in: .whitespaces)
                        if !id.isEmpty {
                            debugInviteFormHomeId = id
                            debugInviteHomeId = ""
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Paste a home UUID")
                }
                .alert("Disambiguate mail", isPresented: $debugDisambiguateSheet) {
                    TextField("Mail ID", text: $debugDisambiguateMailId)
                    Button("Open") {
                        let id = debugDisambiguateMailId.trimmingCharacters(in: .whitespaces)
                        if !id.isEmpty {
                            debugDisambiguateFormMailId = id
                            debugDisambiguateMailId = ""
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Paste a Mail UUID to route")
                }
                .alert("Open Privacy Handshake", isPresented: $debugHandshakeSheet) {
                    TextField("Persona handle", text: $debugHandshakeHandle)
                    Button("Open") {
                        let handle = debugHandshakeHandle.trimmingCharacters(in: .whitespaces)
                        if !handle.isEmpty {
                            path.append(.privacyHandshake(personaHandle: handle))
                            debugHandshakeHandle = ""
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Type a persona handle to open the handshake")
                }
                .alert("Open Ceremonial Mail", isPresented: $debugCeremonialMailOpenSheet) {
                    TextField("Mail ID", text: $debugCeremonialMailOpenId)
                    Button("Open") {
                        let id = debugCeremonialMailOpenId.trimmingCharacters(in: .whitespaces)
                        if !id.isEmpty {
                            path.append(.ceremonialMailOpen(mailId: id))
                            debugCeremonialMailOpenId = ""
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Paste a Mail UUID to open the ceremonial reader")
                }
                .alert("Open invite by token", isPresented: $debugInviteTokenSheet) {
                    TextField("Invite token", text: $debugInviteToken)
                    Button("Open") {
                        let token = debugInviteToken.trimmingCharacters(in: .whitespaces)
                        if !token.isEmpty, let url = URL(string: "pantopus://invite/\(token)") {
                            DeepLinkRouter.shared.handle(url: url)
                            debugInviteToken = ""
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Type a token to fire pantopus://invite/<token>")
                }
                .sheet(item: Binding<DebugInviteHomeItem?>(
                    get: { debugInviteFormHomeId.map { DebugInviteHomeItem(id: $0) } },
                    set: { debugInviteFormHomeId = $0?.id }
                )) { item in
                    let email: String = {
                        if case let .signedIn(user) = auth.state { return user.email }
                        return ""
                    }()
                    InviteOwnerFormView(
                        homeId: item.id,
                        currentUserEmail: email
                    ) { debugInviteFormHomeId = nil }
                }
                .sheet(item: Binding<DebugDisambiguateItem?>(
                    get: { debugDisambiguateFormMailId.map { DebugDisambiguateItem(id: $0) } },
                    set: { debugDisambiguateFormMailId = $0?.id }
                )) { item in
                    DisambiguateMailFormView(
                        mailId: item.id
                    ) { debugDisambiguateFormMailId = nil }
                }
            #endif
        }
    }

    private var navigationPathBinding: Binding<NavigationPath> {
        Binding(
            get: { path.navigationPath },
            set: { path.replaceNavigationPath($0) }
        )
    }

    /// Dispatch a tap on an action-grid tile to the matching route.
    /// Tiles whose dedicated screen doesn't exist yet land on the
    /// generic placeholder, labelled per the destination they will
    /// resolve to once their T6 sub-PR lands (see PR description for
    /// the full table — `me.members` → P9, `me.tasks` → P11, etc.).
    private func handleAction(_ tile: MeActionTile) {
        switch tile.routeKey {
        case "me.mail":
            path.append(.mailboxRoot)
        case "me.bids":
            path.append(.myBids)
        case "me.gigs":
            path.append(.myTasks)
        case "me.posts":
            path.append(.myPosts)
        case "me.offers":
            path.append(.offers)
        case "me.connections":
            path.append(.connections)
        case "me.supportTrains":
            path.append(.supportTrains)
        case "me.listings":
            path.append(.myListings)
        case "me.businesses":
            path.append(.myBusinesses)
        case "me.homes":
            path.append(.myHomes)
        case "me.bills":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeBills(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.pets":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homePets(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.calendar":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeCalendar(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.docs":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeDocs(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.emergency":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeEmergency(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.packages":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homePackages(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.polls":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homePolls(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.tasks":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeTasks(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.maintenance":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeMaintenance(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.members":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeMembers(homeId: homeId))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.scheduling":
            path.append(.scheduling(.hub(owner: .personal)))
        case "me.home.scheduling":
            if let homeId = tile.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.scheduling(.hub(owner: .home(homeId: homeId))))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        case "me.business.scheduling":
            if let businessId = tile.routeArgs["businessId"], !businessId.isEmpty {
                path.append(.scheduling(.hub(owner: .business(id: businessId))))
            } else {
                path.append(.placeholder(label: tile.label))
            }
        default:
            path.append(.placeholder(label: tile.label))
        }
    }

    private func handleSection(_ row: MeSectionRow) {
        switch row.routeKey {
        case "me.posts":
            path.append(.myPosts)
            return
        case "me.bids":
            path.append(.myBids)
            return
        case "me.gigs":
            path.append(.myTasks)
            return
        case "me.offers":
            path.append(.offers)
            return
        case "me.connections":
            path.append(.connections)
        case "me.supportTrains":
            path.append(.supportTrains)
            return
        case "me.homes":
            path.append(.myHomes)
            return
        case "me.listings":
            path.append(.myListings)
            return
        case "me.businesses":
            path.append(.myBusinesses)
            return
        case "me.identityCenter":
            path.append(.identityCenter)
            return
        case "me.audience":
            path.append(.audienceProfile)
            return
        case "me.savedPlaces":
            path.append(.savedPlaces)
            return
        case "me.creatorInbox":
            path.append(.creatorInbox)
            return
        case "me.help":
            path.append(.helpCenter)
            return
        case "me.legal":
            path.append(.legal)
            return
        case "me.privacy", "me.home.privacy":
            path.append(.privacySettings)
            return
        case "me.bills":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeBills(homeId: homeId))
                return
            }
        case "me.docs":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeDocs(homeId: homeId))
                return
            }
        case "me.emergency":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeEmergency(homeId: homeId))
                return
            }
        case "me.packages":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homePackages(homeId: homeId))
                return
            }
        case "me.polls":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homePolls(homeId: homeId))
                return
            }
        case "me.access":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                let homeName = row.routeArgs["homeName"]
                path.append(.accessCodes(homeId: homeId, homeName: homeName))
                return
            }
        case "me.tasks":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeTasks(homeId: homeId))
                return
            }
        case "me.maintenance":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeMaintenance(homeId: homeId))
                return
            }
        case "me.owners":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeOwners(homeId: homeId))
                return
            }
        case "me.members":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.homeMembers(homeId: homeId))
                return
            }
        case "me.editProfile":
            showsEditProfile = true
            return
        case "me.settings":
            path.append(.settings)
            return
        case "me.scheduling":
            path.append(.scheduling(.hub(owner: .personal)))
            return
        case "me.home.scheduling":
            if let homeId = row.routeArgs["homeId"], !homeId.isEmpty {
                path.append(.scheduling(.hub(owner: .home(homeId: homeId))))
                return
            }
        case "me.business.scheduling":
            if let businessId = row.routeArgs["businessId"], !businessId.isEmpty {
                path.append(.scheduling(.hub(owner: .business(id: businessId))))
                return
            }
        default:
            break
        }
        #if DEBUG
        switch row.routeKey {
        case "me.debug.openProfile":
            debugProfileSheet = true
            return
        case "me.debug.openPost":
            debugPostSheet = true
            return
        case "me.debug.inviteOwner":
            debugInviteHomeSheet = true
            return
        case "me.debug.disambiguate":
            debugDisambiguateSheet = true
            return
        case "me.debug.openHandshake":
            debugHandshakeSheet = true
            return
        case "me.debug.openInviteToken":
            debugInviteTokenSheet = true
            return
        case "me.debug.openStatusWaiting":
            path.append(.statusWaiting)
            return
        case "me.debug.openCeremonialMail":
            path.append(.ceremonialMail)
            return
        case "me.debug.openCeremonialMailOpen":
            debugCeremonialMailOpenSheet = true
            return
        default:
            break
        }
        #endif
        path.append(.placeholder(label: row.label))
    }

    private func popAfterListingUpdate(_: String) {
        Task { @MainActor in
            if !path.isEmpty { path.removeLast() }
        }
    }

    @MainActor
    private func pop() {
        if !path.isEmpty { path.removeLast() }
    }

    @MainActor
    private func handleWaitingRoomNav(_ nav: WaitingRoomNav, homeId _: String) {
        switch nav {
        case .notifications:
            path.append(.settings)
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

    /// Called by `ListingComposeWizardView` on success. Pops the wizard and
    /// pushes the new listing's detail so Back returns to My Listings, not
    /// the success step. Defined as a method (not a closure literal at the
    /// call site) so SwiftLint's `trailing_closure` rule doesn't try to
    /// convert the call — the trailing-closure form would bind to
    /// `onListingUpdated` (the last function-typed init param) instead of
    /// `onOpenListingDetail`.
    private func handleListingCreated(_ listingId: String) {
        Task { @MainActor in
            pop()
            path.append(.listingDetail(listingId: listingId))
        }
    }

    /// No-op overlay slot — we previously routed debug affordances via
    /// a 5-tap gesture, but the designed DEBUG section in `MeView` now
    /// surfaces them directly.
    private var debugTapTarget: some View {
        EmptyView()
    }

    /// Two-letter initials derived from a display name. Falls back to
    /// `··` when the input has no alphanumeric content so the chat header's
    /// avatar still renders.
    fileprivate static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let joined = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return joined.isEmpty ? "··" : joined
    }

    /// Project an `InboxConversationDestination.Mode` onto the
    /// `ChatThreadMode` consumed by `ChatConversationViewModel`.
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

    @ViewBuilder
    private func destination(for route: YouRoute) -> some View {
        switch route {
        case .signOutConfirm:
            EmptyView()
        case .mailboxRoot:
            MailboxRootView(
                viewModel: MailboxRootViewModel(
                    onOpenMail: { mailId in
                        Task { @MainActor in path.append(.mailItemDetail(mailId: mailId)) }
                    },
                    onOpenSearch: { path.append(.mailboxSearch) },
                    onOpenMap: { path.append(.mailboxMap) },
                    onOpenMailDay: { path.append(.mailDay(variant: .populated)) },
                    onOpenEarn: { path.append(.earn) },
                    onOpenVacationHold: { path.append(.vacationHold) },
                    onOpenStamps: { path.append(.stamps) },
                    onOpenUnboxing: { path.append(.unboxing(mailId: nil)) },
                    onOpenCompose: { path.append(.ceremonialMail) },
                    onOpenRoutingQueue: { path.append(.mailRoutingQueue) },
                    onOpenMailParty: { path.append(.mailParty) },
                    onOpenCommunity: { path.append(.communityMail) },
                    onOpenRecords: { path.append(.homeRecords) },
                    onOpenMailTasks: {
                        path.append(.mailTaskList(mailId: nil, mailSubject: nil, mailSender: nil))
                    }
                )
            )
        case .communityMail:
            CommunityMailView(
                viewModel: CommunityMailViewModel { Task { @MainActor in pop() } }
            )
        case .homeRecords:
            HomeRecordsView(
                viewModel: HomeRecordsViewModel(
                    onBack: { Task { @MainActor in pop() } },
                    onOpenMail: { mailId in
                        Task { @MainActor in path.append(.mailItemDetail(mailId: mailId)) }
                    }
                )
            )
        case .mailboxMap:
            MailboxMapView { Task { @MainActor in pop() } }
        case let .mailDay(variant):
            MailDayView(viewModel: MailDayViewModel(variant: variant)) {
                Task { @MainActor in pop() }
            }
        case .mailboxSearch:
            MailboxSearchView(
                viewModel: MailboxSearchViewModel(
                    onOpenMail: { mailId in
                        Task { @MainActor in path.append(.mailItemDetail(mailId: mailId)) }
                    },
                    onCancel: {
                        Task { @MainActor in
                            if !path.isEmpty { path.removeLast() }
                        }
                    }
                )
            )
        case .vacationHold:
            VacationHoldView(
                viewModel: VacationHoldViewModel {
                    Task { @MainActor in pop() }
                }
            )
        case let .mailItemDetail(mailId):
            // T6.5b (P20) — Generic A17.1 mail detail. P21–P23 will
            // extend this with package / coupon / booklet / certified
            // variants that compose the same shell with their own slots.
            MailDetailView(
                mailId: mailId,
                onBack: { Task { @MainActor in pop() } },
                onOpenSenderProfile: { userId in
                    Task { @MainActor in path.append(.publicProfile(userId: userId)) }
                },
                onTranslate: {
                    Task { @MainActor in path.append(.mailTranslation(mailId: mailId)) }
                },
                onOpenExtractedTask: { sourceMailId in
                    // A17.12 — the certified-notice "view task" affordance
                    // opens the mail-derived task keyed by its source mail.
                    Task { @MainActor in path.append(.mailTask(taskId: sourceMailId)) }
                },
                onOpenCeremonialMail: { ceremonialId in
                    // Replace (not push) so Back returns to the Mailbox,
                    // matching RN's `router.replace`.
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                        path.append(.ceremonialMailOpen(mailId: ceremonialId))
                    }
                },
                onCreateTask: {
                    // A17.12 — RN's "Create Task" in the detail MORE row
                    // (`src/app/mailbox/detail.tsx:221-227`).
                    Task { @MainActor in
                        path.append(.mailTaskList(mailId: mailId, mailSubject: nil, mailSender: nil))
                    }
                },
                onOpenUnboxing: {
                    Task { @MainActor in path.append(.unboxing(mailId: mailId)) }
                },
                onAskNeighbor: { isPreDelivery in
                    // A17.8 → "Ask a Neighbor" (RN `mailbox/package.tsx:204`).
                    Task { @MainActor in
                        path.append(.packageGig(mailId: mailId, isPreDelivery: isPreDelivery))
                    }
                }
            )
        case .settings:
            SettingsView(
                onClose: { Task { @MainActor in pop() } },
                onEditProfile: { showsEditProfile = true },
                onSignedOut: { Task { @MainActor in pop() } }
            )
        case .paymentsSettings:
            SettingsView(
                initialRoute: .payments,
                onClose: { Task { @MainActor in pop() } },
                onEditProfile: { showsEditProfile = true },
                onSignedOut: { Task { @MainActor in pop() } }
            )
        case let .placeholder(label):
            NotYetAvailableView(tabName: label, icon: .info)
        case .helpCenter:
            HelpCenterView { Task { @MainActor in pop() } }
        case .privacySettings:
            // `PrivacyView` (not a bare `GroupedListView`) — it hosts the
            // account-delete confirm sheet the destructive row opens.
            PrivacyView(viewModel: PrivacySettingsViewModel()) { Task { @MainActor in pop() } }
        case .legal:
            LegalIndexView(
                onBack: { Task { @MainActor in pop() } },
                onSelect: { doc in path.append(.legalContent(doc)) }
            )
        case let .legalContent(doc):
            LegalContentView(document: doc) {
                if !path.isEmpty { path.removeLast() }
            }
        case .addHome:
            AddHomeWizardView(
                onOpenHomeDashboard: { homeId in
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
                onBack: { if !path.isEmpty { path.removeLast() } },
                onOpenClaimOwnership: { homeId in
                    Task { @MainActor in path.append(.claimOwnership(homeId: homeId)) }
                },
                onOpenAddHome: { Task { @MainActor in path.append(.addHome) } }
            )
        case .myClaims:
            MyClaimsListView(
                viewModel: MyClaimsListViewModel(
                    onStartNewClaim: {
                        Task { @MainActor in path.append(.addHome) }
                    },
                    onOpenClaim: { claimId in
                        Task { @MainActor in path.append(.claimStatus(claimId: claimId)) }
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
                onPrimary: { _ in
                    if !path.isEmpty { path.removeLast() }
                },
                onSecondary: { _ in
                    if !claimId.isEmpty, !path.isEmpty { path.removeLast() }
                }
            )
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
        // Wave A — pre-staged placeholder destinations. When an A.x screen
        // ships, swap its single line below for the real view.
        case let .membershipDetail(personaId):
            MembershipDetailView(
                viewModel: MembershipDetailViewModel(personaId: personaId),
                onBack: { Task { @MainActor in pop() } },
                onShare: {
                    systemSheet = .share(
                        items: ["Check out this membership on Pantopus — \(InviteLinks.downloadURLString)"]
                    )
                },
                onOpenPersona: {
                    Task { @MainActor in path.append(.placeholder(label: "Creator profile")) }
                },
                onUpdatePayment: {
                    Task { @MainActor in path.append(.placeholder(label: "Update payment")) }
                },
                onCancel: {
                    Task { @MainActor in path.append(.placeholder(label: "Membership cancelled")) }
                },
                // Change tier + refund request are real in-screen flows now
                // (tier picker sheet / refund sheet), not placeholder pushes.
                onOpenInbox: { resolvedPersonaId in
                    Task { @MainActor in
                        path.append(
                            .fanInbox(personaId: resolvedPersonaId.isEmpty ? personaId : resolvedPersonaId)
                        )
                    }
                }
            )
        case .professionalProfile:
            ProfessionalProfileView { Task { @MainActor in pop() } }
        case .editPersona:
            // The editor resolves the signed-in user's Beacon itself via
            // GET /api/personas/me, so the route payload is advisory only.
            EditPersonaView(
                onClose: { if !path.isEmpty { path.removeLast() } },
                onViewBeacon: { handle in Task { @MainActor in path.append(.beaconProfile(handle: handle)) } }
            )
        case let .composeBroadcast(personaId):
            ComposeBroadcastView(
                viewModel: .live(personaId: personaId) {
                    if !path.isEmpty { path.removeLast() }
                }
            ) {
                if !path.isEmpty { path.removeLast() }
            }
        case .offers:
            OffersView(
                viewModel: OffersViewModel(
                    onOpenOfferDetail: { dto in
                        guard let gigId = dto.gigId ?? dto.gig?.id else { return }
                        Task { @MainActor in path.append(.gigDetail(gigId: gigId)) }
                    },
                    onBrowseListings: {
                        Task { @MainActor in path.append(.marketplace) }
                    },
                    onPostTask: {
                        Task { @MainActor in path.append(.composeTask) }
                    }
                )
            )
        case let .gigDetail(gigId):
            GigDetailView(
                viewModel: GigDetailViewModel(gigId: gigId),
                onBack: { Task { @MainActor in pop() } },
                onOpenChat: { destination in
                    Task { @MainActor in
                        path.append(.chatConversation(destination))
                    }
                }
            )
        case .marketplace:
            MarketplaceView(
                onOpenListing: { listingId in
                    Task { @MainActor in path.append(.listingDetail(listingId: listingId)) }
                },
                onCompose: {
                    Task { @MainActor in path.append(.composeListing) }
                },
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
                        path.append(.chatConversation(InboxConversationDestination(
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
                        path.append(.listingOffers(listingId: dto.id, title: dto.title))
                    }
                },
                onEditListing: { dto in
                    Task { @MainActor in
                        path.append(.editListing(listingId: dto.id, jumpToStep: nil))
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
                        Task { @MainActor in
                            path.append(.publicProfile(userId: buyer.id))
                        }
                    },
                    onOpenTransaction: { _ in
                        Task { @MainActor in
                            path.append(.placeholder(label: "Transaction detail"))
                        }
                    },
                    onEditPrice: {
                        Task { @MainActor in
                            path.append(.editListing(listingId: listingId, jumpToStep: .price))
                        }
                    }
                )
            )
        case .composeListing:
            ListingComposeWizardView { listingId in
                path.removeAll { $0 == .composeListing }
                path.append(.listingDetail(listingId: listingId))
            }
        case let .editListing(listingId, jumpToStep):
            ListingComposeWizardView(
                mode: .edit(listingId: listingId, jumpToStep: jumpToStep),
                onListingUpdated: popAfterListingUpdate
            )
        case .myPosts:
            MyPostsView(
                viewModel: MyPostsViewModel(
                    onOpenPost: { dto in
                        Task { @MainActor in path.append(.pulsePost(postId: dto.id)) }
                    },
                    onCompose: {
                        Task { @MainActor in path.append(.composePost(intent: PulseComposeIntent.ask.rawValue)) }
                    },
                    onEditPost: { dto in
                        Task { @MainActor in path.append(.editPost(postId: dto.id)) }
                    }
                )
            )
        case let .composePost(intent):
            PulseComposeFlowView(
                prefillFeedIntent: PulseIntent(rawValue: intent),
                onCancel: {
                    if !path.isEmpty { path.removeLast() }
                },
                onPosted: { _ in
                    if !path.isEmpty { path.removeLast() }
                }
            )
        case let .editPost(postId):
            PulseComposeFlowView(
                editingPostId: postId,
                onCancel: {
                    if !path.isEmpty { path.removeLast() }
                },
                onPosted: { _ in
                    if !path.isEmpty { path.removeLast() }
                }
            )
        case let .pulsePost(postId):
            PulsePostDetailView(
                postId: postId,
                currentUserId: currentUserId,
                onBack: { Task { @MainActor in pop() } },
                onOpenProfile: { userId in
                    Task { @MainActor in path.append(.publicProfile(userId: userId)) }
                },
                onEdit: { id in
                    Task { @MainActor in path.append(.editPost(postId: id)) }
                },
                onOpenBusiness: { username in
                    // "Nearby Providers" row → `/business/:username`.
                    Task { @MainActor in path.append(.businessProfile(businessId: username)) }
                }
            )
        case .myBids:
            MyBidsView(
                viewModel: MyBidsViewModel(
                    onOpenBid: { dto in
                        Task { @MainActor in
                            if let gigId = dto.gigId {
                                path.append(.gigDetail(gigId: gigId))
                            }
                        }
                    },
                    onBrowseTasks: {
                        Task { @MainActor in path.append(.gigsFeed) }
                    },
                    onMessageClient: { dto in
                        Task { @MainActor in
                            guard let posterId = dto.gig?.userId else { return }
                            let name = dto.gig?.title ?? "Conversation"
                            path.append(.chatConversation(InboxConversationDestination(
                                mode: .person(otherUserId: posterId),
                                displayName: name,
                                initials: Self.initials(from: name),
                                identityKind: nil,
                                verified: false
                            )))
                        }
                    }
                    // Edit-bid + Leave-review are presented as sheets from
                    // inside the screen (P3.4) — no router wiring needed.
                )
            )
        case .gigsFeed:
            GigsFeedView(
                onOpenGig: { gigId in
                    Task { @MainActor in path.append(.gigDetail(gigId: gigId)) }
                },
                onCompose: { _ in
                    Task { @MainActor in path.append(.composeTask) }
                },
                onOpenMap: { category in
                    Task { @MainActor in path.append(.tasksMap(categoryKey: category.rawValue)) }
                },
                onOpenSearch: {
                    Task { @MainActor in path.append(.gigSearch) }
                },
                onBack: { Task { @MainActor in pop() } },
                onOpenSupportTrain: { trainId in
                    Task { @MainActor in path.append(.supportTrainDetail(supportTrainId: trainId)) }
                },
                onOpenMyTasks: { Task { @MainActor in path.append(.myTasks) } },
                onOpenMySupportTrains: { Task { @MainActor in path.append(.supportTrains) } }
            )
        case .gigSearch:
            GigSearchView(
                onOpenGig: { gigId in
                    Task { @MainActor in path.append(.gigDetail(gigId: gigId)) }
                },
                onBack: { Task { @MainActor in pop() } }
            )
        case let .tasksMap(categoryKey):
            TasksMapView(
                viewModel: TasksMapViewModel(
                    initialCategory: GigsCategory(rawValue: categoryKey) ?? .all
                ),
                onOpenTask: { taskId in
                    Task { @MainActor in path.append(.gigDetail(gigId: taskId)) }
                },
                onCompose: { _ in
                    Task { @MainActor in path.append(.composeTask) }
                },
                onBack: { Task { @MainActor in pop() } }
            )
        case .myTasks:
            MyTasksView(
                viewModel: MyTasksViewModel(
                    onOpenTask: { dto in
                        Task { @MainActor in path.append(.gigDetail(gigId: dto.id)) }
                    },
                    onOpenBids: { dto in
                        // Gig detail's "Manage bids" sheet renders the
                        // full bid list — the dedicated bids surface
                        // lands with T2.3.
                        Task { @MainActor in path.append(.gigDetail(gigId: dto.id)) }
                    },
                    onEditTask: { dto in
                        Task { @MainActor in path.append(.editGig(gigId: dto.id)) }
                    },
                    onMessageWorker: { dto in
                        Task { @MainActor in path.append(.gigDetail(gigId: dto.id)) }
                    },
                    onLeaveReview: { dto in
                        Task { @MainActor in path.append(.gigDetail(gigId: dto.id)) }
                    },
                    onPostTask: {
                        Task { @MainActor in path.append(.composeTask) }
                    },
                    onRepost: { _ in
                        Task { @MainActor in path.append(.composeTask) }
                    }
                )
            )
        case .composeTask:
            GigComposeWizardView(preselectedCategoryKey: nil) { gigId in
                // Replace the wizard with the gig's detail so Back goes
                // back to My tasks, not the success screen.
                path.removeAll { $0 == .composeTask }
                path.append(.gigDetail(gigId: gigId))
            }
        case let .editGig(gigId):
            PostGigV1View(
                viewModel: PostGigV1ViewModel(editGigId: gigId),
                onClose: { Task { @MainActor in pop() } }
            ) { savedGigId in
                // Replace the editor with the gig's detail so Back goes
                // back to My tasks, not the stale edit form.
                path.removeAll { route in
                    if case .editGig = route { return true }
                    return false
                }
                path.append(.gigDetail(gigId: savedGigId))
            }
        case .connections:
            ConnectionsView(
                viewModel: ConnectionsViewModel(
                    onMessage: { target in
                        Task { @MainActor in
                            path.append(.chatConversation(InboxConversationDestination(
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
                        Task { @MainActor in path.append(.startSupportTrain) }
                    },
                    onOpenTrain: { trainId in
                        Task { @MainActor in path.append(.reviewSignups(supportTrainId: trainId)) }
                    },
                    onSearch: {
                        Task { @MainActor in path.append(.searchSupportTrains) }
                    }
                )
            )
        case let .supportTrainDetail(supportTrainId):
            SupportTrainDetailView(
                viewModel: SupportTrainDetailViewModel(trainId: supportTrainId)
            ) { Task { @MainActor in pop() } }
        case .searchSupportTrains:
            SupportTrainsSearchView(
                viewModel: SupportTrainsSearchViewModel(
                    onOpenTrain: { trainId in
                        Task { @MainActor in path.append(.reviewSignups(supportTrainId: trainId)) }
                    },
                    onCancel: { Task { @MainActor in pop() } }
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
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                        path.append(.reviewSignups(supportTrainId: trainId))
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
                        // (`backend/routes/supportTrains.js:3214`), matching
                        // the same route in `HubTabRoot`.
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
                        Task { @MainActor in path.append(.placeholder(label: "Message helper")) }
                    },
                    onEdit: { reservation in
                        Task { @MainActor in
                            path.append(.editSignup(reservation: reservation))
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
                onClose: { Task { @MainActor in pop() } },
                onOpenAnalytics: { id in
                    Task { @MainActor in path.append(.placeholder(label: "Train analytics · \(id)")) }
                },
                onEditDates: { id in
                    Task { @MainActor in path.append(.placeholder(label: "Edit dates · \(id)")) }
                },
                onInviteHelpers: { id in
                    Task { @MainActor in path.append(.placeholder(label: "Invite helpers · \(id)")) }
                }
            )
        case .identityCenter:
            IdentityCenterView(
                onBack: { Task { @MainActor in pop() } },
                onOpenIdentity: { card in
                    Task { @MainActor in
                        switch card.kind {
                        case .professional:
                            // A.5 — "Edit professional profile" from the
                            // Professional identity card.
                            path.append(.professionalProfile)
                        case .local, .personal, .publicProfile:
                            path.append(.placeholder(label: "Identity"))
                        }
                    }
                },
                onOpenRow: { row in
                    Task { @MainActor in
                        // A18.5 — the "Privacy Preview" row opens the
                        // "View as" identity preview; other rows are
                        // pre-staged placeholders.
                        if row.id == "privacyPreview" {
                            path.append(.viewAs)
                        } else {
                            path.append(.placeholder(label: row.label))
                        }
                    }
                }
            )
        case .audienceProfile:
            AudienceProfileView(
                onBack: { Task { @MainActor in pop() } },
                onOpenFollower: { _ in
                    Task { @MainActor in path.append(.placeholder(label: "Follower")) }
                },
                onOpenThread: { _ in
                    Task { @MainActor in path.append(.creatorInbox) }
                },
                onOpenBroadcast: { card, tierSegments in
                    Task { @MainActor in
                        path.append(.broadcastDetail(
                            broadcastId: card.id,
                            card: card,
                            tierSegments: tierSegments
                        ))
                    }
                },
                onOpenSetup: {
                    Task { @MainActor in path.append(.privacyHandshake(personaHandle: currentUserHandle)) }
                },
                onOpenCreatorInbox: {
                    Task { @MainActor in path.append(.creatorInbox) }
                },
                onComposeBroadcast: { personaId in
                    Task { @MainActor in path.append(.composeBroadcast(personaId: personaId)) }
                },
                onOpenEditPersona: {
                    Task { @MainActor in path.append(.editPersona(personaId: "")) }
                },
                onOpenFollowing: {
                    Task { @MainActor in path.append(.following) }
                },
                onOpenMembers: {
                    Task { @MainActor in path.append(.creatorAudienceMembers) }
                },
                onOpenBeacons: {
                    Task { @MainActor in path.append(.beaconsFeed) }
                }
            )
        case .creatorAudienceMembers:
            YourAudienceView { Task { @MainActor in pop() } }
        case .beaconsFeed:
            BeaconsFeedView(
                onOpenPost: { _ in
                    Task { @MainActor in path.append(.placeholder(label: "Post")) }
                },
                onCompose: { _ in
                    Task { @MainActor in path.append(.placeholder(label: "Compose")) }
                },
                onDiscover: {
                    Task { @MainActor in path.append(.placeholder(label: "Discover beacons")) }
                },
                onBack: { Task { @MainActor in pop() } }
            )
        case .following:
            FollowingView(
                viewModel: FollowingViewModel(
                    onBack: { Task { @MainActor in pop() } },
                    onDiscover: {
                        Task { @MainActor in path.append(.placeholder(label: "Discover beacons")) }
                    },
                    onOpenPersona: { handle in
                        Task { @MainActor in path.append(.beaconProfile(handle: handle)) }
                    }
                )
            )
        case let .beaconProfile(handle):
            BeaconProfileView(
                mode: .visitor(handle: handle),
                onBack: { Task { @MainActor in pop() } },
                onEditPersona: { personaId in
                    Task { @MainActor in path.append(.editPersona(personaId: personaId)) }
                },
                onComposeBroadcast: { personaId in
                    Task { @MainActor in path.append(.composeBroadcast(personaId: personaId)) }
                },
                onOpenLink: { url in UIApplication.shared.open(url) }
            )
        case let .explore(focus):
            ExploreMapView(
                focus: focus,
                onOpenEntity: { entity in
                    Task { @MainActor in
                        switch entity.kind {
                        case .task: path.append(.gigDetail(gigId: entity.id))
                        case .item: path.append(.listingDetail(listingId: entity.id))
                        case .post: path.append(.pulsePost(postId: entity.id))
                        case .spot: path.append(.businessProfile(businessId: entity.id))
                        // `homes` markers are neighborhood addresses, not homes
                        // the viewer owns — the backend has no viewer-facing
                        // detail route for someone else's home, so the tap
                        // selects the pin and the rail card carries the
                        // address + locality. Mirrors HubTabRoot.swift:2499.
                        case .home: break
                        }
                    }
                },
                onBack: { Task { @MainActor in pop() } },
                onOpenSaved: { Task { @MainActor in path.append(.savedPlaces) } }
            )
        case .savedPlaces:
            SavedPlacesView(
                viewModel: SavedPlacesViewModel(
                    onBack: { Task { @MainActor in pop() } },
                    onExplore: {
                        Task { @MainActor in
                            if !path.isEmpty { path.removeLast() }
                            path.append(.explore(focus: nil))
                        }
                    },
                    onOpenMap: { latitude, longitude, label in
                        Task { @MainActor in
                            if !path.isEmpty { path.removeLast() }
                            path.append(.explore(focus: ExploreMapFocus(
                                latitude: latitude,
                                longitude: longitude,
                                label: label
                            )))
                        }
                    }
                )
            )
        case let .broadcastDetail(broadcastId, card, tierSegments):
            BroadcastDetailView(
                viewModel: BroadcastDetailViewModel(
                    broadcastId: broadcastId,
                    seed: card,
                    tierSegments: tierSegments
                ),
                onBack: { Task { @MainActor in pop() } },
                onOverflow: {},
                onReply: {
                    Task { @MainActor in path.append(.creatorInbox) }
                },
                onBoost: nil,
                onPin: nil
            )
        case .creatorInbox:
            CreatorInboxView(
                onBack: { Task { @MainActor in pop() } },
                onOpenThread: { row in
                    Task { @MainActor in
                        // The row id IS the PersonaDmThread id — persona DMs
                        // carry no counterparty user id to fall back to.
                        let dest = CreatorInboxThreadDestination(
                            personaId: row.personaId,
                            threadId: row.id,
                            displayName: row.displayName.isEmpty ? row.handle : row.displayName,
                            initials: row.initials,
                            verified: row.verifiedLocal,
                            tierName: row.tierName ?? "Free",
                            tierRank: row.tierRank
                        )
                        path.append(.creatorInboxConversation(dest))
                    }
                },
                onOpenBroadcast: {
                    Task { @MainActor in path.append(.audienceProfile) }
                },
                onOpenSettings: {
                    Task { @MainActor in path.append(.placeholder(label: "Inbox settings")) }
                }
            )
        case let .creatorInboxConversation(dest):
            PersonaDmThreadView(
                personaId: dest.personaId,
                threadId: dest.threadId
            ) { Task { @MainActor in pop() } }
        case let .fanInbox(personaId):
            FanInboxView(
                personaId: personaId,
                onBack: { Task { @MainActor in pop() } },
                onChangeTier: {
                    Task { @MainActor in
                        pop()
                    }
                }
            )
        case let .chatConversation(dest):
            ChatConversationView(
                viewModel: ChatConversationViewModel(
                    mode: Self.chatMode(for: dest.mode),
                    counterparty: Self.chatCounterparty(for: dest),
                    currentUserId: currentUserId ?? ""
                ),
                mode: dest.kind
            ) { Task { @MainActor in pop() } }
        case let .homeBills(homeId):
            BillsListView(
                viewModel: BillsListViewModel(
                    homeId: homeId,
                    onOpenBill: { billId in
                        Task { @MainActor in path.append(.billDetail(homeId: homeId, billId: billId)) }
                    },
                    onAddBill: {
                        Task { @MainActor in path.append(.addBill(homeId: homeId, billId: nil)) }
                    }
                )
            )
        case let .billDetail(homeId, billId):
            BillDetailView(
                homeId: homeId,
                billId: billId,
                onBack: { Task { @MainActor in pop() } },
                onEdit: {
                    Task { @MainActor in path.append(.addBill(homeId: homeId, billId: billId)) }
                }
            )
        case let .addBill(homeId, billId):
            AddBillWizardView(
                homeId: homeId,
                billId: billId,
                onClose: { Task { @MainActor in pop() } },
                onCreated: { newBillId in
                    path.removeAll { route in
                        if case .addBill = route { return true }
                        return false
                    }
                    path.append(.billDetail(homeId: homeId, billId: newBillId))
                },
                onUpdated: {
                    if !path.isEmpty { path.removeLast() }
                }
            )
        case let .homePets(homeId):
            PetsListView(homeId: homeId)
        case let .homeCalendar(homeId):
            HomeCalendarView(
                viewModel: HomeCalendarViewModel(
                    homeId: homeId,
                    onAddEvent: {
                        Task { @MainActor in
                            path.append(.addCalendarEvent(
                                homeId: homeId,
                                eventId: nil,
                                prefilledCategory: nil
                            ))
                        }
                    },
                    onOpenEvent: { eventId in
                        Task { @MainActor in
                            path.append(.calendarEventDetail(homeId: homeId, eventId: eventId))
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
                        path.append(.addCalendarEvent(
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
                            path.append(.emergencyItem(homeId: homeId, emergencyId: dto.id))
                        }
                    },
                    onAdd: {
                        Task { @MainActor in
                            path.append(.addEmergencyInfo(homeId: homeId))
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
                            path.append(.documentDetail(homeId: homeId, documentId: dto.id))
                        }
                    },
                    onUpload: {
                        Task { @MainActor in
                            path.append(.uploadDocument(homeId: homeId))
                        }
                    },
                    onSearch: {
                        Task { @MainActor in
                            path.append(.documentSearch(homeId: homeId))
                        }
                    },
                    onExport: {
                        Task { @MainActor in
                            path.append(.placeholder(label: "Export documents"))
                        }
                    },
                    onDocumentAction: { dto, _ in
                        Task { @MainActor in
                            path.append(.documentDetail(homeId: homeId, documentId: dto.id))
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
                        path.append(.uploadDocument(homeId: homeId))
                    }
                }
            )
        case let .documentSearch(homeId):
            DocumentSearchView(
                viewModel: DocumentSearchViewModel(
                    homeId: homeId,
                    onOpenDocument: { dto in
                        Task { @MainActor in
                            path.append(.documentDetail(homeId: homeId, documentId: dto.id))
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
                viewModel: PackagesListViewModel(
                    homeId: homeId,
                    currentUserId: currentUserId,
                    onOpenPackage: { packageId in
                        Task { @MainActor in
                            path.append(.packageDetail(homeId: homeId, packageId: packageId))
                        }
                    },
                    onLogPackage: {
                        Task { @MainActor in path.append(.logPackage(homeId: homeId)) }
                    }
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
                        // Replace the log-package destination with the
                        // new package's detail so Back returns to the
                        // Packages list, not the form.
                        path.removeAll { route in
                            if case .logPackage = route { return true }
                            return false
                        }
                        path.append(.packageDetail(homeId: homeId, packageId: packageId))
                    }
                }
            )
        case let .homePolls(homeId):
            PollsListView(
                viewModel: PollsListViewModel(
                    homeId: homeId,
                    onOpenPoll: { pollId in
                        Task { @MainActor in path.append(.pollDetail(homeId: homeId, pollId: pollId)) }
                    },
                    onStartPoll: {
                        Task { @MainActor in path.append(.startPoll(homeId: homeId)) }
                    }
                )
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
                            path.append(.editAccessCode(
                                homeId: targetHomeId,
                                secretId: nil,
                                categoryRaw: category?.rawValue
                            ))
                        case let .editCode(homeId: targetHomeId, secretId: secretId):
                            path.append(.editAccessCode(
                                homeId: targetHomeId,
                                secretId: secretId,
                                categoryRaw: nil
                            ))
                        case let .search(homeId: targetHomeId):
                            path.append(.searchAccessCodes(homeId: targetHomeId))
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
                            path.append(.editAccessCode(
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
        case .myHomes:
            MyHomesListView(
                viewModel: MyHomesListViewModel(
                    onOpenHome: { homeId in
                        Task { @MainActor in path.append(.homeDashboard(homeId: homeId)) }
                    },
                    onAddHome: {
                        Task { @MainActor in path.append(.addHome) }
                    },
                    onFindHome: {
                        Task { @MainActor in path.append(.findHome) }
                    },
                    onUploadOwnershipEvidence: { homeId in
                        Task { @MainActor in path.append(.claimOwnership(homeId: homeId)) }
                    },
                    onVerifyResidency: { homeId in
                        Task { @MainActor in path.append(.verifyResidency(homeId: homeId)) }
                    }
                )
            )
        case .myListings:
            MyListingsView(
                viewModel: MyListingsViewModel(
                    onOpenListing: { listingId in
                        Task { @MainActor in path.append(.listingDetail(listingId: listingId)) }
                    },
                    onCompose: {
                        Task { @MainActor in path.append(.composeListing) }
                    }
                )
            )
        case .myBusinesses:
            MyBusinessesView(
                viewModel: MyBusinessesViewModel(
                    onOpenBusiness: { businessId in
                        // B3.2 — an owned business opens its owner dashboard
                        // (A10.7), not the public profile.
                        Task { @MainActor in path.append(.businessOwner(businessId: businessId)) }
                    },
                    onRegister: {
                        Task { @MainActor in path.append(.createBusiness) }
                    },
                    onClaim: {
                        // The You tab has no Discover-businesses route; the
                        // claim affordance falls back to the create flow.
                        Task { @MainActor in path.append(.createBusiness) }
                    }
                )
            )
        case .businessWaitlist, .createBusiness:
            // Waitlist is retired — both routes open the create wizard.
            CreateBusinessWizardView(
                onClose: { Task { @MainActor in pop() } },
                onOpenBusiness: { businessId in
                    // Replace the wizard with the owner dashboard so Back
                    // returns to My Businesses, not the success step.
                    path.removeAll { route in
                        switch route {
                        case .createBusiness, .businessWaitlist: true
                        default: false
                        }
                    }
                    path.append(.businessOwner(businessId: businessId))
                }
            )
        case let .homeDashboard(homeId):
            HomeDashboardView(
                homeId: homeId,
                onBack: { Task { @MainActor in pop() } },
                onClaimOwnership: {
                    Task { @MainActor in path.append(.claimOwnership(homeId: homeId)) }
                },
                onOpenClaimsList: {
                    Task { @MainActor in path.append(.myClaims) }
                },
                onOpenBills: {
                    Task { @MainActor in path.append(.homeBills(homeId: homeId)) }
                },
                onOpenPolls: {
                    Task { @MainActor in path.append(.homePolls(homeId: homeId)) }
                },
                onOpenPlaceholder: { label in
                    Task { @MainActor in path.append(.placeholder(label: label)) }
                },
                onOpenPets: { petHomeId in
                    Task { @MainActor in path.append(.homePets(homeId: petHomeId)) }
                },
                onOpenDocs: { docsHomeId in
                    Task { @MainActor in path.append(.homeDocs(homeId: docsHomeId)) }
                },
                onOpenEmergency: { emergencyHomeId in
                    Task { @MainActor in path.append(.homeEmergency(homeId: emergencyHomeId)) }
                },
                onOpenPackages: { packagesHomeId in
                    Task { @MainActor in path.append(.homePackages(homeId: packagesHomeId)) }
                },
                onOpenAccessCodes: { accessHomeId, homeName in
                    Task { @MainActor in path.append(.accessCodes(homeId: accessHomeId, homeName: homeName)) }
                },
                onOpenTasks: { tasksHomeId in
                    Task { @MainActor in path.append(.homeTasks(homeId: tasksHomeId)) }
                },
                onOpenMaintenance: { maintenanceHomeId in
                    Task { @MainActor in path.append(.homeMaintenance(homeId: maintenanceHomeId)) }
                },
                onOpenMembers: { membersHomeId in
                    Task { @MainActor in path.append(.homeMembers(homeId: membersHomeId)) }
                },
                onHireHelp: { _ in
                    // H1 — "Hire" on a seasonal-checklist item opens the
                    // gig composer. The You-tab route carries no category
                    // preselection, so the wizard starts on category pick.
                    Task { @MainActor in path.append(.composeTask) }
                },
                onAddTask: { id in
                    Task { @MainActor in path.append(.addHouseholdTask(homeId: id)) }
                },
                onTrackBill: { id in
                    Task { @MainActor in path.append(.addBill(homeId: id)) }
                },
                onTrackPackage: { id in
                    Task { @MainActor in path.append(.logPackage(homeId: id)) }
                },
                onSendMail: { _ in
                    Task { @MainActor in path.append(.ceremonialMail) }
                }
            )
        case let .homeTasks(homeId):
            HouseholdTasksListView(
                viewModel: HouseholdTasksListViewModel(
                    homeId: homeId,
                    onOpenTask: { taskId in
                        Task { @MainActor in
                            path.append(.editHouseholdTask(homeId: homeId, taskId: taskId))
                        }
                    },
                    onAddTask: {
                        Task { @MainActor in path.append(.addHouseholdTask(homeId: homeId)) }
                    },
                    onEditRecurring: { taskId in
                        Task { @MainActor in
                            path.append(.editHouseholdTask(homeId: homeId, taskId: taskId))
                        }
                    }
                )
            )
        case let .addHouseholdTask(homeId):
            AddHouseholdTaskFormView(
                homeId: homeId,
                onClose: { Task { @MainActor in pop() } },
                onCreated: { _ in
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
        case let .homeMaintenance(homeId):
            MaintenanceListView(
                viewModel: MaintenanceListViewModel(
                    homeId: homeId,
                    onOpenTask: { taskId in
                        Task { @MainActor in
                            path.append(.maintenanceDetail(homeId: homeId, taskId: taskId))
                        }
                    },
                    onAddTask: {
                        Task { @MainActor in path.append(.logMaintenance(homeId: homeId)) }
                    },
                    onOpenIssues: {
                        Task { @MainActor in path.append(.homeIssues(homeId: homeId)) }
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
                        if !path.isEmpty { path.removeLast() }
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
                        path.append(.editMaintenance(homeId: homeId, taskId: taskId))
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
        case let .homeOwners(homeId):
            let currentUserId: String? = {
                if case let .signedIn(user) = auth.state { return user.id }
                return nil
            }()
            OwnersListView(
                homeId: homeId,
                currentUserId: currentUserId,
                onOpenClaimReview: {
                    Task { @MainActor in path.append(.homeClaimReview(homeId: homeId)) }
                },
                onOpenTransfer: {
                    Task { @MainActor in path.append(.transferOwnership(homeId: homeId)) }
                }
            )
        case let .transferOwnership(homeId):
            let signedInUser: UserDTO? = {
                if case let .signedIn(user) = auth.state { return user }
                return nil
            }()
            TransferOwnershipView(
                viewModel: TransferOwnershipViewModel(
                    homeId: homeId,
                    currentUserId: signedInUser?.id,
                    currentUserName: signedInUser?.displayName ?? signedInUser?.username
                )
            )
        case let .homeClaimReview(homeId):
            HomeClaimReviewView(
                homeId: homeId
            ) { Task { @MainActor in pop() } }
        case let .homeMembers(homeId):
            MembersListView(homeId: homeId)
        case let .publicProfile(userId):
            PublicProfileView(
                userId: userId,
                onBack: { Task { @MainActor in pop() } },
                onOpenMessages: { profile in
                    Task { @MainActor in
                        path.append(.chatConversation(InboxConversationDestination(
                            mode: .person(otherUserId: profile.id),
                            displayName: profile.displayName,
                            initials: Self.initials(from: profile.displayName),
                            identityKind: nil,
                            verified: profile.verified ?? false
                        )))
                    }
                },
                onOpenGig: { gigId in
                    Task { @MainActor in path.append(.gigDetail(gigId: gigId)) }
                },
                onOpenProfile: { reviewerId in
                    Task { @MainActor in path.append(.publicProfile(userId: reviewerId)) }
                }
            )
        case let .businessProfile(businessId):
            BusinessProfileView(
                businessId: businessId,
                onBack: { Task { @MainActor in pop() } },
                onOpenMessages: { destination in
                    Task { @MainActor in path.append(.chatConversation(destination)) }
                },
                onShare: {
                    systemSheet = .share(
                        items: ["Check out this business on Pantopus — \(InviteLinks.downloadURLString)"]
                    )
                },
                onOpenReport: {
                    Task { @MainActor in path.append(.placeholder(label: "Report business")) }
                },
                onOpenWebsite: { url in openURL(url) },
                onBook: {
                    Task { @MainActor in path.append(.placeholder(label: "Book")) }
                },
                onEdit: {
                    Task { @MainActor in path.append(.editBusinessPage(businessId: businessId)) }
                }
            )
        case let .editBusinessPage(businessId):
            EditBusinessPageView(
                businessId: businessId,
                onBack: { Task { @MainActor in pop() } },
                onPreview: {
                    // Bounce the owner to the live profile they're editing.
                    Task { @MainActor in
                        if !path.isEmpty { path.removeLast() }
                    }
                }
            )
        case let .businessPages(businessId):
            BusinessPagesView(
                businessId: businessId,
                onBack: { Task { @MainActor in pop() } },
                onOpenPage: { row in
                    Task { @MainActor in
                        path.append(.businessPageBlocks(
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
        case let .privacyHandshake(personaHandle):
            PrivacyHandshakeWizardView(
                viewModel: PrivacyHandshakeViewModel(
                    personaHandle: personaHandle
                ) { Task { @MainActor in pop() } }
            )

        // MARK: - B1.6 batch-2 routing seam
        // Placeholder destinations. Each screen prompt (B2–B5) swaps the one
        // line below for its real view without editing the route declarations.
        case .stamps:
            StampsView(viewModel: StampsViewModel { Task { @MainActor in pop() } })
        case let .mailTask(taskId):
            // A17.12 — Mail-derived task detail. Source-mail + next-up
            // taps push the originating mail item onto this same stack.
            MailTaskView(
                viewModel: MailTaskViewModel(
                    taskId: taskId,
                    onOpenMail: { mailId in
                        Task { @MainActor in path.append(.mailItemDetail(mailId: mailId)) }
                    },
                    onBack: { Task { @MainActor in pop() } }
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
                        Task { @MainActor in path.append(.mailTask(taskId: taskId)) }
                    },
                    onBack: { Task { @MainActor in pop() } },
                    onPostAsNeighborTask: { sourceMailId in
                        // A17.8 — RN's "Post as Neighbor Task Instead"
                        // (`mailbox/tasks.tsx:236`) always escalates in
                        // post-delivery mode.
                        Task { @MainActor in
                            path.append(.packageGig(mailId: sourceMailId, isPreDelivery: false))
                        }
                    }
                )
            )
        case let .mailTranslation(mailId):
            MailTranslationView(
                mailId: mailId,
                onBack: { if !path.isEmpty { path.removeLast() } },
                onReply: { _ in Task { @MainActor in path.append(.placeholder(label: "Reply in English")) } }
            )
        case let .unboxing(mailId):
            // A17.14 — the capture flow loads the real `MailPackage` row for
            // `mailId` and every action writes to `/api/mailbox/v2/p2`.
            // Without a mail id there is nothing to persist, and the screen
            // says so rather than projecting a fixture.
            let openDrawer: @MainActor () -> Void = {
                Task { @MainActor in path.append(.placeholder(label: "Home drawer")) }
            }
            UnboxingView(
                viewModel: UnboxingViewModel(mailId: mailId, onOpenDrawer: openDrawer)
            ) { Task { @MainActor in pop() } }
        case let .packageGig(mailId, isPreDelivery):
            // A17.8 → "Ask a Neighbor" — posts the package-help gig via
            // `POST /api/mailbox/v2/p2/package/:mailId/gig` and deep-links
            // into the created gig, matching RN `mailbox/gig.tsx`.
            PackageGigView(
                viewModel: PackageGigViewModel(
                    mailId: mailId,
                    isPreDelivery: isPreDelivery,
                    onBack: { Task { @MainActor in pop() } },
                    onOpenGig: { gigId in
                        Task { @MainActor in path.append(.gigDetail(gigId: gigId)) }
                    }
                )
            )
        case .earn:
            EarnView(
                onBack: { Task { @MainActor in pop() } },
                onHelp: { path.append(.placeholder(label: "Earn help")) },
                onCashOut: { path.append(.paymentsSettings) },
                onBrowseTasks: { path.append(.gigsFeed) },
                onReferNeighbor: { path.append(.placeholder(label: "Refer a neighbor")) },
                onOfferService: { path.append(.placeholder(label: "Offer a service")) },
                onManagePayout: { path.append(.paymentsSettings) },
                onAddBank: { path.append(.paymentsSettings) },
                onSeeAllEarnings: { path.append(.placeholder(label: "All earnings")) },
                onOpenTaxDocs: { path.append(.placeholder(label: "Tax documents")) }
            )
        case let .businessOwner(businessId):
            BusinessOwnerView(
                businessId: businessId,
                onBack: { Task { @MainActor in pop() } },
                onEditPage: { Task { @MainActor in path.append(.editBusinessPage(businessId: businessId)) } },
                onOpenInsights: { Task { @MainActor in path.append(.placeholder(label: "Insights")) } },
                onOpenSettings: { Task { @MainActor in path.append(.placeholder(label: "Business settings")) } },
                onOpenTeam: { Task { @MainActor in path.append(.businessTeam(businessId: businessId)) } },
                onOpenPages: { Task { @MainActor in path.append(.businessPages(businessId: businessId)) } },
                onOpenPayments: {
                    Task { @MainActor in path.append(.businessPaymentsOwner(businessId: businessId)) }
                },
                onOpenInvoices: {
                    Task { @MainActor in path.append(.businessInvoicesOwner(businessId: businessId)) }
                },
                onOpenLegal: {
                    Task { @MainActor in path.append(.businessLegal(businessId: businessId)) }
                },
                onOpenChatRoom: { roomId, name, _ in
                    Task { @MainActor in
                        path.append(.chatConversation(InboxConversationDestination(
                            mode: .room(id: roomId),
                            displayName: name,
                            initials: Self.initials(from: name),
                            identityKind: nil,
                            verified: false
                        )))
                    }
                },
                onOpenPost: { postId in
                    Task { @MainActor in path.append(.pulsePost(postId: postId)) }
                }
            )
        case let .businessTeam(businessId):
            BusinessTeamView(businessId: businessId)
        case let .businessPaymentsOwner(businessId):
            BusinessPaymentsView(businessId: businessId)
        case let .businessInvoicesOwner(businessId):
            BusinessInvoicesView(businessId: businessId)
        case let .businessLegal(businessId):
            BusinessLegalView(businessId: businessId)
        case .viewAs:
            ViewAsView(
                onBack: { Task { @MainActor in pop() } },
                onManagePrivacy: { Task { @MainActor in path.append(.privacySettings) } },
                onEdit: { showsEditProfile = true }
            )
        case let .waitingRoom(homeId):
            WaitingRoomView(
                viewModel: WaitingRoomViewModel(homeId: homeId, state: .active),
                onBack: { pop() },
                onNav: { nav in handleWaitingRoomNav(nav, homeId: homeId) }
            )
        case let .cancelClaim(homeId):
            CancelClaimView(
                viewModel: CancelClaimViewModel(homeId: homeId),
                onBack: { pop() },
                onCancelled: { pop() }
            )
        case let .verifyLandlord(homeId):
            VerifyLandlordWizardView(
                homeId: homeId,
                onClose: { if !path.isEmpty { path.removeLast() } },
                onOpenPostcardVerification: { resolvedHomeId in
                    // Replace the wizard with the postcard tracker so
                    // Back returns to the waiting room, not the wizard.
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
                    // Pop the tracker — the room refreshes its
                    // verification status on next appearance.
                    if !path.isEmpty { path.removeLast() }
                }
            )
        case let .leaveHome(homeId):
            LeaveHomeView(
                viewModel: LeaveHomeViewModel(homeId: homeId),
                onBack: { pop() },
                onLeft: {
                    // Move-out revokes membership, so the waiting room
                    // and dashboard for this home now 403 — drop both.
                    path.removeAll { route in
                        switch route {
                        case let .leaveHome(id) where id == homeId: true
                        case let .waitingRoom(id) where id == homeId: true
                        case let .homeDashboard(id) where id == homeId: true
                        default: false
                        }
                    }
                }
            )
        case .ceremonialMail:
            CeremonialMailWizardView(
                onDismiss: { Task { @MainActor in pop() } },
                onOpenMail: { _ in if !path.isEmpty { path.removeLast() } }
            )
        case let .ceremonialMailOpen(mailId):
            CeremonialMailOpenView(
                viewModel: CeremonialMailOpenViewModel(mailId: mailId),
                onBack: { Task { @MainActor in pop() } },
                onWriteBack: { _ in path.append(.ceremonialMail) }
            )
        case .mailRoutingQueue:
            MailRoutingQueueView { Task { @MainActor in pop() } }
        case .mailParty:
            MailPartyView(
                onOpenMail: { mailId in
                    Task { @MainActor in path.append(.mailItemDetail(mailId: mailId)) }
                },
                onClose: { Task { @MainActor in pop() } }
            )
        case let .scheduling(route):
            SchedulingRouter.destination(for: route, owner: .personal) { path.append(.scheduling($0)) }
        #if DEBUG
        case .statusWaiting:
            StatusWaitingView(
                content: .claimSubmitted(homeName: "412 Elm St"),
                onPrimary: { _ in if !path.isEmpty { path.removeLast() } },
                onSecondary: { _ in if !path.isEmpty { path.removeLast() } }
            )
        #endif
        }
    }
}

#Preview {
    YouTabRoot()
        .environment(AuthManager.previewSignedIn)
}
