//
//  MeViewModel.swift
//  Pantopus
//
//  Fetches the three identity bundles in parallel and projects them
//  onto `MeIdentityContent`. The Personal identity reads
//  `GET /api/users/profile` + `GET /api/users/:id/stats`. The Home
//  identity reads `GET /api/homes/my-homes` and uses the primary home
//  (or surfaces an `isUnbound` empty state when no home exists). The
//  Business identity binds to the first managed business from My businesses.
//

// The first-launch scope helpers (`launchScoped`) pushed this past 500 lines.
// swiftlint:disable file_length

import Foundation
import Logging
import Observation

/// Top-level Me view-model.
@Observable
@MainActor
public final class MeViewModel {
    /// Current render state.
    public private(set) var state: MeState = .loading

    /// Currently selected identity.
    public private(set) var activeIdentity: MeIdentity = .personal

    public private(set) var showBusiness = false

    /// Transient toast surface.
    public var toastMessage: String?

    /// Monthly Receipt for the completed month (`GET /api/users/me/monthly-receipt`).
    /// Nil hides the card — RN does the same when the fetch fails.
    public private(set) var monthlyReceipt: MonthlyReceiptDTO?

    /// Invite / referral progress (`GET /api/users/me/invite-progress`).
    public private(set) var inviteProgress: InviteProgressDTO?

    /// The user's stable invite code (`GET /api/users/me/invite-code`),
    /// used to build the share link.
    public private(set) var inviteCode: String?

    /// Set when the profile was opened from the `monthly_receipt` push —
    /// the receipt card renders expanded.
    public var expandMonthlyReceipt: Bool

    /// When the shown content was fetched.
    private var loadedAt: Date?
    /// The You screen's fresh window (Instant Screens contract §4): opening
    /// it again within it sends no request.
    static let freshFor: TimeInterval = 10 * 60

    private let api: APIClient
    /// The screen store (Instant Screens), shared with every other screen.
    private let store: ScreenStore
    private let now: @Sendable () -> Date
    private let logger = Logger(label: "app.pantopus.ios.Me")

    init(
        api: APIClient = .shared,
        expandMonthlyReceipt: Bool = false,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.api = api
        store = ScreenStore.store(for: api)
        self.expandMonthlyReceipt = expandMonthlyReceipt
        self.now = now
    }

    /// Share text for the receipt card — RN `handleShareReceipt`.
    public var receiptShareMessage: String? {
        monthlyReceipt.map(MonthlyReceiptCard.shareMessage)
    }

    /// Share text for the invite CTA — RN `handleShareInvite`. Nil until a
    /// real invite code has loaded: a made-up code would share a dead link.
    public var inviteShareMessage: String? {
        guard let code = inviteCode, !code.isEmpty else { return nil }
        return "Join me on Pantopus! Use my invite code to get started: "
            + "https://pantopus.com/join/\(code)"
    }

    /// The month the receipt covers: the previous calendar month, 1-based —
    /// mirrors RN `fetchReceipt` (`(tabs)/profile.tsx:102`).
    static func receiptPeriod(now: Date, calendar: Calendar = .current) -> (year: Int, month: Int) {
        let components = calendar.dateComponents([.year, .month], from: now)
        var year = components.year ?? 1970
        // `month` is 1-based, so subtracting one gives the previous month.
        var month = (components.month ?? 1) - 1
        if month == 0 {
            month = 12
            year -= 1
        }
        return (year, month)
    }

    /// Opening the screen. The host keeps this model across openings, so
    /// content shows at once; it is fetched again quietly once older than
    /// `freshFor`. The reads go through the screen store, which other screens
    /// share (My Homes, the profile, Settings).
    public func load() async {
        if case .loaded = state, let loadedAt, now().timeIntervalSince(loadedAt) < Self.freshFor { return }
        await fetch(force: false)
    }

    /// Pull-to-refresh / retry / a saved profile edit: always asks the server.
    public func refresh() async {
        await fetch(force: true)
    }

    /// Switch identity pill — pure UI rebind, no refetch needed.
    public func selectIdentity(_ identity: MeIdentity) {
        guard identity != activeIdentity else { return }
        activeIdentity = identity
    }

    // MARK: - Fetch

    private func fetch(force: Bool) async {
        // Every read starts at once; only the stats (by profile id) and the
        // primary Home's dashboard wait for the profile and the Homes list.
        async let profileTask: ProfileResponse? = optional { try await self.you(UsersEndpoints.profile(), force: force) }
        async let homesTask: MyHomesResponse? = optional {
            try await HomesStoreReads.myHomes(store: self.store, force: force).value
        }
        async let businessesTask: MyBusinessesResponse? = optional {
            try await self.you(BusinessesEndpoints.myBusinesses(), force: force)
        }
        async let insights: Void = fetchInsights(force: force)
        // Personal profile is the only hard requirement. Home and stats
        // failures degrade their own surface instead of failing the whole
        // screen. A failed refresh keeps what's on screen.
        guard let profile = await profileTask else {
            if case .loaded = state {} else { state = .error(message: "Couldn't load your profile.") }
            return
        }

        let homes = await homesTask
        let userId = profile.user.id
        async let statsTask: UserStatsDTO? = optional { try await self.you(UsersEndpoints.stats(userId: userId), force: force) }
        // The Home card's counts come from the primary Home's dashboard.
        let primary = Self.primaryHome(in: homes?.sharedHomes ?? [])
        async let dashboardTask = dashboard(homeId: primary?.home.id, household: primary?.showsCopyBeforeRecheck ?? false, force: force)
        let (stats, dashboard, businesses) = await (statsTask, dashboardTask, businessesTask)

        let personal = Self.buildPersonal(profile: profile.user, stats: stats)
        // `homes == nil` is a failed read; it must not read as "No shared Home".
        let home = Self.buildHome(
            homes: homes?.sharedHomes ?? [],
            profileLocality: Self.localityString(profile.user),
            homesFailed: homes == nil,
            dashboard: dashboard
        )
        showBusiness = businesses == nil || !(businesses?.businesses.isEmpty ?? true)
        if !showBusiness, activeIdentity == .business { activeIdentity = .personal }
        let business = Self.buildBusiness(membership: businesses?.businesses.first, failed: businesses == nil)
        state = .loaded(
            personal: Self.launchScoped(personal),
            home: Self.launchScoped(home),
            business: Self.launchScoped(business)
        )
        loadedAt = now()
        await insights
    }

    /// The primary Home's dashboard (household data: shown before the
    /// re-check only for owners and household roles).
    private func dashboard(homeId: String?, household: Bool, force: Bool) async -> HomeDashboardResponse? {
        guard let homeId else { return nil }
        let gate: @Sendable (HomeDashboardResponse) -> Bool = { _ in household }
        return await optional {
            try await self.store.load(
                HomeDashboardEndpoints.dashboard(homeId: homeId),
                as: HomeDashboardResponse.self,
                kind: .homes,
                topics: [ScreenTopic.home(homeId)],
                force: force,
                showsBeforeRecheck: gate
            ).value
        }
    }

    /// Own profile and settings reads (contract section 4, You: 10 minutes).
    private func you<Value: Decodable & Sendable>(_ endpoint: Endpoint, force: Bool) async throws -> Value {
        try await store.load(endpoint, as: Value.self, kind: .you, topics: [ScreenTopic.profileMe], force: force).value
    }

    /// Monthly Receipt + invite progress + invite code, read at once. All
    /// three degrade to a hidden card rather than failing the tab, matching
    /// RN's `Promise.allSettled` handling in `(tabs)/profile.tsx:117`; a
    /// failed refresh keeps a card already shown.
    private func fetchInsights(force: Bool) async {
        let period = Self.receiptPeriod(now: now())
        async let receipt: MonthlyReceiptDTO? = optional {
            try await self.you(ProfileInsightsEndpoints.monthlyReceipt(year: period.year, month: period.month), force: force)
        }
        async let progress: InviteProgressDTO? = optional {
            try await self.you(ProfileInsightsEndpoints.inviteProgress(), force: force)
        }
        async let code: InviteCodeDTO? = optional {
            try await self.you(ProfileInsightsEndpoints.inviteCode(), force: force)
        }
        let (newReceipt, newProgress, newCode) = await (receipt, progress, code)
        monthlyReceipt = newReceipt ?? monthlyReceipt
        inviteProgress = newProgress ?? inviteProgress
        inviteCode = newCode?.inviteCode ?? inviteCode
    }

    private func optional<T: Sendable>(_ operation: @Sendable () async throws -> T) async -> T? {
        do {
            return try await operation()
        } catch {
            logger.warning("Me identity fetch failed: \(error)")
            return nil
        }
    }
}

private extension MeViewModel {
    // MARK: - Projections

    /// Debug-only deep-link section appended to every identity in
    /// development builds. Preserves the legacy YouTabRoot debug
    /// affordances (open profile / post by ID, etc.) without
    /// re-introducing the List-of-buttons chrome.
    private static var debugSection: MeSection? {
        #if DEBUG
        MeSection(id: "debug", header: "Debug", rows: [
            MeSectionRow(id: "openProfile", icon: .search, label: "Open public profile by ID", routeKey: "me.debug.openProfile"),
            MeSectionRow(id: "openPost", icon: .search, label: "Open Pulse post by ID", routeKey: "me.debug.openPost"),
            MeSectionRow(
                id: "openHandshake",
                icon: .userPlus,
                label: "Open Privacy Handshake by persona handle",
                routeKey: "me.debug.openHandshake"
            ),
            MeSectionRow(id: "openInviteToken", icon: .mailbox, label: "Open invite by token", routeKey: "me.debug.openInviteToken"),
            MeSectionRow(
                id: "openStatusWaiting",
                icon: .checkCircle,
                label: "Open Status / Waiting",
                routeKey: "me.debug.openStatusWaiting"
            ),
            MeSectionRow(
                id: "openCeremonialMail",
                icon: .send,
                label: "Open Ceremonial Mail Compose",
                routeKey: "me.debug.openCeremonialMail"
            ),
            MeSectionRow(
                id: "openCeremonialMailOpen",
                icon: .mailbox,
                label: "Open Ceremonial Mail by ID",
                routeKey: "me.debug.openCeremonialMailOpen"
            ),
            MeSectionRow(id: "inviteOwner", icon: .userPlus, label: "Invite owner to home by ID", routeKey: "me.debug.inviteOwner"),
            MeSectionRow(id: "disambiguate", icon: .mailbox, label: "Disambiguate mail by ID", routeKey: "me.debug.disambiguate")
        ])
        #else
        nil
        #endif
    }

    private static func withDebug(_ sections: [MeSection]) -> [MeSection] {
        guard let debugSection else { return sections }
        return sections + [debugSection]
    }

    /// First-launch scope: false when a tile or row opens a feature hidden
    /// for the first launch. One serving two cut features needs both on.
    static func isAvailableAtLaunch(routeKey: String) -> Bool {
        switch routeKey {
        // Launch cut #1 (Beacon): the audience profile; the creator inbox
        // (persona DMs) is launch cut #2 (Personas) too.
        case "me.audience": LaunchFeatures.beacon
        case "me.creatorInbox", "me.debug.openHandshake": LaunchFeatures.beacon && LaunchFeatures.personas
        // Launch cut #2 (Personas): Identity Center. Privacy and blocking
        // stay reachable from the Privacy row and Settings.
        case "me.identityCenter": LaunchFeatures.personas
        // Launch cut #3 (Marketplace).
        case "me.listings": LaunchFeatures.marketplace
        // Launch cut #4 (Open gigs): bids and gig offers.
        case "me.bids", "me.offers": LaunchFeatures.openGigs
        // Launch cut #5 (Public scheduling).
        case "me.scheduling", "me.home.scheduling", "me.business.scheduling": LaunchFeatures.publicScheduling
        // Launch cut #7 (Household extras).
        case "me.bills", "me.pets", "me.polls", "me.calendar", "me.packages": LaunchFeatures.householdExtras
        // Launch cut #8 (Mail extras).
        case "me.debug.openCeremonialMail", "me.debug.openCeremonialMailOpen": LaunchFeatures.mailExtras
        default: true
        }
    }

    /// First-launch scope: drops the tiles, rows and counts of features
    /// hidden for the first launch, and any section left without rows.
    static func launchScoped(_ content: MeIdentityContent) -> MeIdentityContent {
        MeIdentityContent(
            identity: content.identity,
            displayName: content.displayName,
            initials: content.initials,
            handle: content.handle,
            locality: content.locality,
            tagline: content.tagline,
            verified: content.verified,
            // Launch cut #7 (Household extras): the "Bills due" count.
            stats: content.stats.filter { $0.id != "bills" || LaunchFeatures.householdExtras },
            actionTiles: content.actionTiles.filter { isAvailableAtLaunch(routeKey: $0.routeKey) },
            sections: content.sections.compactMap { section in
                let rows = section.rows.filter { isAvailableAtLaunch(routeKey: $0.routeKey) }
                return rows.isEmpty ? nil : MeSection(id: section.id, header: section.header, rows: rows)
            },
            isUnbound: content.isUnbound
        )
    }

    private static func buildPersonal(profile: UserProfile, stats: UserStatsDTO?) -> MeIdentityContent {
        let fullName = profile.name ?? ""
        let name = fullName.isEmpty
            ? [profile.firstName, profile.lastName].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
            : fullName
        // No name yet (the one-time name sheet was skipped): no stand-in; the header offers "Add your name".
        let displayName = name
        let locality = localityString(profile)
        let tagline = (profile.tagline?.isEmpty == false ? profile.tagline : nil) ?? profile.bio
        let activityValue = "\(stats?.totalGigsCompleted ?? profile.gigsCompleted ?? 0)"
        let residencyVerified: Bool = if case let .object(values) = profile.residency ?? .null,
                                         case let .bool(value) = values["verified"] ?? .null {
            value
        } else {
            false
        }
        let trustValue = residencyVerified ? "Verified" : "Pending"
        let reputationValue = ratingString(stats?.averageRating ?? profile.averageRating ?? 0)
        return MeIdentityContent(
            identity: .personal,
            displayName: displayName,
            initials: displayName.isEmpty ? "" : initials(from: displayName),
            // A made-up username (user_…, or the pre-October-7 kind built from the email) is never shown.
            handle: profile.usernameIsGenerated == true ? "" : MadeUpUsername.handle(profile.username) ?? "",
            locality: locality,
            tagline: tagline,
            verified: residencyVerified,
            stats: [
                MeStat(id: "activity", value: activityValue, label: "Activity"),
                MeStat(id: "trust", value: trustValue, label: "Trust"),
                MeStat(id: "reputation", value: reputationValue, label: "Reputation")
            ],
            actionTiles: [
                MeActionTile(id: "posts", icon: .file, label: "My posts", routeKey: "me.posts"),
                MeActionTile(id: "bids", icon: .hammer, label: "My bids", routeKey: "me.bids"),
                MeActionTile(id: "gigs", icon: .clipboardList, label: "My tasks", routeKey: "me.gigs"),
                MeActionTile(id: "offers", icon: .handCoins, label: "Offers", routeKey: "me.offers"),
                MeActionTile(id: "listings", icon: .shoppingBag, label: "Listings", routeKey: "me.listings"),
                MeActionTile(id: "connections", icon: .userPlus, label: "Connections", routeKey: "me.connections"),
                MeActionTile(id: "supportTrains", icon: .handCoins, label: "Support trains", routeKey: "me.supportTrains"),
                MeActionTile(id: "scheduling", icon: .calendarClock, label: "Scheduling", routeKey: "me.scheduling")
            ],
            sections: withDebug([
                MeSection(id: "profile_privacy", header: "Profile & Privacy", rows: [
                    MeSectionRow(id: "edit", icon: .edit2, label: "Edit profile", routeKey: "me.editProfile"),
                    MeSectionRow(id: "identityCenter", icon: .shield, label: "Identity Center", routeKey: "me.identityCenter"),
                    MeSectionRow(id: "audience", icon: .megaphone, label: "Audience profile", routeKey: "me.audience"),
                    MeSectionRow(id: "creatorInbox", icon: .inbox, label: "Creator inbox", routeKey: "me.creatorInbox")
                ]),
                MeSection(id: "activity", header: "Activity", rows: [
                    MeSectionRow(id: "posts", icon: .file, label: "My posts", routeKey: "me.posts"),
                    MeSectionRow(id: "bids", icon: .hammer, label: "My bids", routeKey: "me.bids"),
                    MeSectionRow(id: "gigs", icon: .clipboardList, label: "My tasks", routeKey: "me.gigs"),
                    MeSectionRow(id: "offers", icon: .handCoins, label: "Offers", routeKey: "me.offers"),
                    MeSectionRow(
                        id: "savedPlaces",
                        icon: .bookmark,
                        label: "Saved places",
                        routeKey: "me.savedPlaces",
                        accessibilityID: "savedPlaces.entry.profile"
                    ),
                    MeSectionRow(id: "homes", icon: .home, label: "My homes", routeKey: "me.homes"),
                    MeSectionRow(id: "businesses", icon: .shoppingBag, label: "My businesses", routeKey: "me.businesses")
                ]),
                MeSection(id: "help_legal", header: "Help & Legal", rows: [
                    MeSectionRow(id: "help", icon: .helpCircle, label: "Help", routeKey: "me.help"),
                    MeSectionRow(id: "terms", icon: .file, label: "Terms", routeKey: "me.legal"),
                    MeSectionRow(
                        id: "privacy",
                        icon: .shield,
                        label: "Privacy",
                        value: privacyValue(profile.profileVisibility),
                        routeKey: "me.privacy"
                    )
                ])
            ])
        )
    }

    static func primaryHome(in homes: [MyHome]) -> MyHome? {
        homes.first { $0.isPrimaryOwner == true } ?? homes.first
    }

    /// The Home card's counts from the primary Home's dashboard. A count the person may not
    /// see, or one that didn't load, stays "—".
    private static func homeStats(_ dashboard: HomeDashboardResponse?) -> [MeStat] {
        let permissions = Set(dashboard?.myAccess?.permissions ?? [])
        func value(_ count: Int?, _ permission: String) -> String {
            guard let count, permissions.contains(permission) else { return "—" }
            return "\(count)"
        }
        return [
            MeStat(id: "bills", value: value(dashboard?.counts.billsDue, "finance.view"), label: "Bills due"),
            MeStat(id: "tasks", value: value(dashboard?.counts.tasksOpen, "tasks.view"), label: "Open tasks"),
            MeStat(id: "members", value: value(dashboard?.counts.membersActive, "members.view"), label: "Members")
        ]
    }

    private static func buildHome(
        homes: [MyHome],
        profileLocality: String?,
        homesFailed: Bool = false,
        dashboard: HomeDashboardResponse? = nil
    ) -> MeIdentityContent {
        guard let primary = primaryHome(in: homes) else {
            return MeIdentityContent(
                identity: .home,
                displayName: "Your Homes",
                initials: "H",
                handle: homesFailed ? "Couldn't load your homes" : "No shared Home",
                locality: profileLocality,
                tagline: homesFailed
                    ? "Check your connection, then open My homes to try again."
                    : "Open My homes for private tasks, invitations and verification progress.",
                verified: false,
                stats: [
                    MeStat(id: "bills", value: "—", label: "Bills due"),
                    MeStat(id: "tasks", value: "—", label: "Open tasks"),
                    MeStat(id: "members", value: "—", label: "Members")
                ],
                actionTiles: homeActionTiles(homeId: nil),
                sections: withDebug(homeSections(homeId: nil, homeName: nil, privacyValue: nil)),
                isUnbound: true
            )
        }
        let home = primary.home
        let address = home.address ?? "Your home"
        let displayName = home.name?.isEmpty == false ? home.name ?? address : address
        let locality = [home.city, home.state].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
        // Only surface the address as a tagline when the display name is
        // a separate household name (e.g. "Cozy Hideout") — otherwise
        // the tagline would just repeat the title.
        let homeTagline: String? = (home.name?.isEmpty == false) ? home.address : nil
        return MeIdentityContent(
            identity: .home,
            displayName: displayName,
            initials: initials(from: displayName),
            handle: primary.ownershipStatus == "verified" ? "Ownership verified" : "Shared Home",
            locality: locality.isEmpty ? profileLocality : locality,
            tagline: homeTagline,
            verified: false,
            stats: homeStats(dashboard),
            actionTiles: homeActionTiles(homeId: home.id),
            sections: withDebug(homeSections(
                homeId: home.id,
                homeName: displayName,
                privacyValue: "Neighbors"
            ))
        )
    }

    private static func buildBusiness(membership: BusinessMembership?, failed: Bool) -> MeIdentityContent {
        let business = membership?.business
        let name = business?.name?.isEmpty == false ? business?.name ?? "Your Businesses" : "Your Businesses"
        let args = membership.map { ["businessId": $0.businessUserId] } ?? [:]
        var rows = [MeSectionRow(id: "businesses", icon: .shoppingBag, label: "My businesses", routeKey: "me.businesses")]
        if membership != nil {
            rows.append(MeSectionRow(
                id: "scheduling",
                icon: .calendarClock,
                label: "Scheduling",
                routeKey: "me.business.scheduling",
                routeArgs: args
            ))
        }
        rows.append(MeSectionRow(id: "settings", icon: .menu, label: "Settings", routeKey: "me.settings"))
        return MeIdentityContent(
            identity: .business,
            displayName: name,
            initials: initials(from: name),
            handle: failed ? "Couldn't load your businesses" : (business?.username.map { "@\($0)" } ?? "Business pages"),
            locality: [business?.city, business?.state].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", "),
            tagline: failed ? "Open My businesses to try again." : membership?.profile?.description,
            verified: false,
            stats: [],
            actionTiles: [],
            sections: withDebug([
                MeSection(id: "business", header: "Business", rows: rows),
                MeSection(id: "help_legal", header: "Help & Legal", rows: [
                    MeSectionRow(id: "help", icon: .helpCircle, label: "Help", routeKey: "me.help"),
                    MeSectionRow(id: "terms", icon: .file, label: "Terms", routeKey: "me.legal"),
                    MeSectionRow(id: "privacy", icon: .shield, label: "Privacy", routeKey: "me.privacy")
                ])
            ]),
            isUnbound: true
        )
    }

    private static func homeActionTiles(homeId: String?) -> [MeActionTile] {
        let args = homeId.map { ["homeId": $0] } ?? [:]
        return [
            MeActionTile(id: "bills", icon: .file, label: "Bills", routeKey: "me.bills", routeArgs: args),
            MeActionTile(id: "maintenance", icon: .hammer, label: "Maintenance", routeKey: "me.maintenance", routeArgs: args),
            MeActionTile(id: "pets", icon: .heart, label: "Pets", routeKey: "me.pets", routeArgs: args),
            MeActionTile(id: "members", icon: .userPlus, label: "Members", routeKey: "me.members", routeArgs: args),
            MeActionTile(id: "polls", icon: .checkCircle, label: "Polls", routeKey: "me.polls", routeArgs: args),
            MeActionTile(id: "calendar", icon: .calendar, label: "Calendar", routeKey: "me.calendar", routeArgs: args),
            MeActionTile(id: "docs", icon: .file, label: "Documents", routeKey: "me.docs", routeArgs: args),
            MeActionTile(id: "scheduling", icon: .calendarClock, label: "Scheduling", routeKey: "me.home.scheduling", routeArgs: args)
        ]
    }

    private static func homeSections(homeId: String?, homeName: String?, privacyValue: String?) -> [MeSection] {
        var args: [String: String] = [:]
        if let homeId, !homeId.isEmpty { args["homeId"] = homeId }
        // homeName carries the access-codes top-bar subtitle so the
        // designed "412 Birch Ln · Maria's household" line renders
        // without a second fetch.
        var accessArgs = args
        if let homeName, !homeName.isEmpty { accessArgs["homeName"] = homeName }
        return [
            MeSection(id: "household", header: "Household", rows: [
                MeSectionRow(id: "members", icon: .userPlus, label: "Members", routeKey: "me.members", routeArgs: args),
                MeSectionRow(id: "owners", icon: .shield, label: "Owners", routeKey: "me.owners", routeArgs: args),
                MeSectionRow(id: "access", icon: .lock, label: "Access codes", routeKey: "me.access", routeArgs: accessArgs)
            ]),
            MeSection(id: "activity", header: "Activity", rows: [
                MeSectionRow(id: "bills", icon: .file, label: "Bills", routeKey: "me.bills", routeArgs: args),
                MeSectionRow(id: "maintenance", icon: .hammer, label: "Maintenance", routeKey: "me.maintenance", routeArgs: args),
                MeSectionRow(id: "tasks", icon: .hammer, label: "Household tasks", routeKey: "me.tasks", routeArgs: args),
                MeSectionRow(id: "packages", icon: .mailbox, label: "Packages", routeKey: "me.packages", routeArgs: args),
                MeSectionRow(id: "emergency", icon: .shield, label: "Emergency info", routeKey: "me.emergency", routeArgs: args)
            ]),
            MeSection(id: "help_legal", header: "Help & Legal", rows: [
                MeSectionRow(id: "help", icon: .helpCircle, label: "Help", routeKey: "me.help"),
                MeSectionRow(id: "terms", icon: .file, label: "Terms", routeKey: "me.legal"),
                MeSectionRow(
                    id: "privacy",
                    icon: .shield,
                    label: "Privacy",
                    value: privacyValue,
                    routeKey: "me.home.privacy",
                    routeArgs: args
                )
            ])
        ]
    }

    // MARK: - Helpers

    private static func localityString(_ profile: UserProfile) -> String? {
        let parts = [profile.city, profile.state].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let result = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return result.isEmpty ? "?" : result
    }

    private static func ratingString(_ rating: Double) -> String {
        rating > 0 ? String(format: "%.1f", rating) : "—"
    }

    private static func privacyValue(_ visibility: String?) -> String? {
        switch visibility?.lowercased() {
        case "public": "Public"
        case "registered": "Neighbors"
        case "private": "Strict"
        default: nil
        }
    }
}
