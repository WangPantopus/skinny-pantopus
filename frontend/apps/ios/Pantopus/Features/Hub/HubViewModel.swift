//
//  HubViewModel.swift
//  Pantopus
//
//  Fetches `/api/hub`, `/api/hub/today`, and `/api/hub/discovery` in
//  parallel and projects them to the `HubState` consumed by `HubView`.
//

// swiftlint:disable type_body_length

import Foundation
import Observation

/// ViewModel backing the designed hub screen.
@Observable
@MainActor
final class HubViewModel {
    /// Current state observed by `HubView`.
    private(set) var state: HubState = .skeleton

    /// `private(set)` confines the setter to this file, so extensions in
    /// sibling files (`HubViewModel+StatusStrip.swift`) mutate state through
    /// here rather than by widening the property's access level.
    func applyState(_ next: HubState) {
        state = next
    }

    /// Active Discover filter tab. Drives the `filter` query param on
    /// `GET /api/hub/discovery` — RN `(tabs)/index.tsx:138`.
    private(set) var discoveryFilter: HubDiscoveryFilter = .gigs

    /// True while a filter-tab refetch is in flight (rail shows its
    /// skeleton instead of stale rows).
    private(set) var discoveryLoading = false

    /// Status-strip pills the viewer dismissed this session. RN keeps the
    /// same session-scoped `Set<string>` — nothing is persisted server
    /// side (`(tabs)/index.tsx:319-321`). Module-internal so the
    /// status-strip extension in `HubViewModel+StatusStrip.swift` can
    /// mutate it.
    var dismissedStatusIds: Set<String> = []

    let api: APIClient
    /// Home the density milestone dismissal is recorded against, and the
    /// raw density count used to resolve which milestone was crossed.
    var densityHomeId: String?
    var densityCount = 0
    private let bannerDismissedKey = "hub.setupBanner.dismissed"
    private var bannerDismissed: Bool {
        get { UserDefaults.standard.bool(forKey: bannerDismissedKey) }
        set { UserDefaults.standard.set(newValue, forKey: bannerDismissedKey) }
    }

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Initial load — no-op when we already have populated content.
    func load() async {
        if case .populated = state { return }
        state = .skeleton
        await fetch()
    }

    /// Pull-to-refresh / retry.
    func refresh() async {
        await fetch()
    }

    /// Dismiss the amber setup banner; persists across launches.
    func dismissSetupBanner() {
        bannerDismissed = true
        if case var .populated(content) = state {
            content = HubState.PopulatedContent(
                topBar: content.topBar,
                actionChips: content.actionChips,
                statusItems: content.statusItems,
                neighborDensity: content.neighborDensity,
                setupBanner: nil,
                today: content.today,
                pillars: content.pillars,
                discovery: content.discovery,
                jumpBackIn: content.jumpBackIn,
                activity: content.activity
            )
            state = .populated(content)
        }
    }

    /// Discover filter-tab tap. Refetches only
    /// `GET /api/hub/discovery?filter=…` and swaps the rail's rows in
    /// place — the rest of the hub stays put (RN keeps the hub query and
    /// the discovery query separate, `(tabs)/index.tsx:332`).
    func selectDiscoveryFilter(_ filter: HubDiscoveryFilter) async {
        guard filter != discoveryFilter else { return }
        discoveryFilter = filter
        await refreshDiscovery()
    }

    /// Re-request the Discover rail for the active filter.
    func refreshDiscovery() async {
        discoveryLoading = true
        defer { discoveryLoading = false }
        let filter = discoveryFilter.queryValue
        let response: HubDiscoveryResponse? = await optional {
            try await self.api.request(HubEndpoints.discovery(filter: filter, limit: 10))
        }
        applyDiscovery(response?.items.prefix(10).map(Self.projectDiscovery(_:)) ?? [])
    }

    /// Swap the discovery rows into whichever content state is showing.
    private func applyDiscovery(_ cards: [DiscoveryCardContent]) {
        switch state {
        case let .populated(content):
            state = .populated(HubState.PopulatedContent(
                topBar: content.topBar,
                actionChips: content.actionChips,
                statusItems: content.statusItems,
                neighborDensity: content.neighborDensity,
                setupBanner: content.setupBanner,
                today: content.today,
                pillars: content.pillars,
                discovery: cards,
                jumpBackIn: content.jumpBackIn,
                activity: content.activity
            ))
        case let .firstRun(content):
            state = .firstRun(HubState.FirstRunContent(
                greeting: content.greeting,
                name: content.name,
                avatarInitials: content.avatarInitials,
                identity: content.identity,
                ringProgress: content.ringProgress,
                profileCompleteness: content.profileCompleteness,
                stepsDone: content.stepsDone,
                stepsTotal: content.stepsTotal,
                steps: content.steps,
                pillars: content.pillars,
                discovery: cards
            ))
        case .skeleton, .error:
            break
        }
    }

    // MARK: - Fetch

    private func fetch() async {
        // Hub first; its failure aborts the screen. Companions run in
        // parallel *after* a successful hub response so a test sequence
        // can predict which stub each call consumes.
        let hub: HubResponse
        do {
            hub = try await api.request(HubEndpoints.overview())
        } catch {
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't load your hub.")
            return
        }
        async let todayTask: HubTodayResponse? = optional {
            try await self.api.request(HubEndpoints.today())
        }
        let filter = discoveryFilter.queryValue
        async let discoveryTask: HubDiscoveryResponse? = optional {
            try await self.api.request(HubEndpoints.discovery(filter: filter, limit: 10))
        }
        let today = await todayTask
        let discovery = await discoveryTask
        // S5 — per-firewall unread split powers the megaphone shortcut
        // into the Beacon notification zone. Sequenced (not raced) after
        // the companions so a stubbed test sequence stays predictable;
        // optional so its failure never blanks the hub.
        let unread: NotificationUnreadCountResponse? = await optional {
            try await self.api.request(NotificationsEndpoints.unreadCount)
        }
        // Rebookable helpers feed the "Jump back in" rail (RN
        // `(tabs)/index.tsx:344-358`). Optional so an empty / failing
        // gigs call never blanks the hub.
        let rebookable: RebookableGigsResponse? = await optional {
            try await self.api.request(GigExtrasEndpoints.rebookable())
        }
        applyResults(
            hub: hub,
            today: today,
            discovery: discovery,
            audienceUnread: unread?.byContext?.audience ?? 0,
            rebookable: rebookable?.rebookable ?? []
        )
    }

    /// Run a throwing async request and swallow its failure, returning nil.
    /// Used for the companion endpoints whose absence shouldn't block the hub.
    private func optional<T: Sendable>(_ operation: @Sendable () async throws -> T) async -> T? {
        try? await operation()
    }

    private func applyResults(
        hub: HubResponse,
        today: HubTodayResponse?,
        discovery: HubDiscoveryResponse?,
        audienceUnread: Int = 0,
        rebookable: [RebookableGigDTO] = []
    ) {
        let todaySummary = Self.projectToday(today)
        let identity = Self.primaryIdentity(for: hub)
        let isFirstRun = Self.isFirstRun(hub: hub)
        let discoveryCards = discovery?.items.prefix(10).map(Self.projectDiscovery(_:)) ?? []
        if isFirstRun {
            let steps = hub.setup.steps.map {
                SetupStep(id: $0.key, title: Self.setupTitle($0.key), done: $0.done)
            }
            let doneCount = steps.filter(\.done).count
            state = .firstRun(
                HubState.FirstRunContent(
                    greeting: Self.greeting(),
                    name: hub.user.firstName ?? hub.user.name,
                    avatarInitials: Self.initials(from: hub.user.name),
                    identity: identity,
                    ringProgress: hub.setup.profileCompleteness.score,
                    profileCompleteness: hub.setup.profileCompleteness.score,
                    stepsDone: doneCount,
                    stepsTotal: steps.count,
                    steps: steps,
                    // Setup-mode pillars + discovery rail, per the design's
                    // first-run frame.
                    pillars: Self.pillars(from: hub, setupMode: true),
                    discovery: discoveryCards
                )
            )
            return
        }

        let banner: SetupBannerContent? =
            (!hub.setup.allDone && !bannerDismissed)
                ? SetupBannerContent()
                : nil

        let primaryHome = hub.homes.first(where: \.isPrimary) ?? hub.homes.first
        densityHomeId = primaryHome?.id
        densityCount = hub.neighborDensity?.count ?? 0
        // RN gates the block on "has a home AND (count > 0 OR a
        // milestone)" — `(tabs)/index.tsx:405-407`.
        let density: NeighborDensityContent? = {
            guard primaryHome != nil, let raw = hub.neighborDensity else { return nil }
            guard raw.count >= 1 || raw.milestone != nil else { return nil }
            return NeighborDensityContent(
                count: raw.count,
                radiusMiles: raw.radiusMiles,
                milestone: raw.milestone,
                homeId: primaryHome?.id
            )
        }()

        state = .populated(
            HubState.PopulatedContent(
                topBar: TopBarContent(
                    greeting: Self.greeting(),
                    name: hub.user.firstName ?? hub.user.name,
                    avatarInitials: Self.initials(from: hub.user.name),
                    identity: identity,
                    ringProgress: hub.setup.profileCompleteness.score,
                    unreadCount: hub.statusItems.count,
                    audienceUnreadCount: audienceUnread
                ),
                actionChips: Self.defaultActionChips(),
                statusItems: hub.statusItems
                    .filter { !dismissedStatusIds.contains($0.id) }
                    .map(Self.projectStatusItem(_:)),
                neighborDensity: density,
                setupBanner: banner,
                today: todaySummary,
                pillars: Self.pillars(from: hub, setupMode: false),
                discovery: discoveryCards,
                jumpBackIn: Self.jumpBackItems(hub: hub, rebookable: rebookable),
                activity: hub.activity.prefix(3).map {
                    ActivityEntry(
                        id: $0.id,
                        title: $0.title,
                        timeAgo: Self.relative(timestamp: $0.at),
                        icon: .bell,
                        tint: Self.pillarTint(for: $0.pillar)
                    )
                }
            )
        )
    }

    // MARK: - Projections

    private struct PillarProjection {
        let kind: PillarTile.Pillar
        let label: String
        let icon: PantopusIcon
        let tint: IdentityPillar
        let chip: String?
        let chipSetupState: Bool
        let populatedCaption: String
        let setupCaption: String
    }

    private static func isFirstRun(hub: HubResponse) -> Bool {
        !hub.setup.allDone
            && hub.setup.profileCompleteness.score < 0.5
            && hub.homes.isEmpty
    }

    private static func projectToday(_ response: HubTodayResponse?) -> TodaySummary? {
        guard let today = response?.today else { return nil }
        // Today is an opaque provider payload; best-effort extract common keys.
        let weather = today.dictValue?["weather"]?.dictValue
        let temperature = weather?["temperatureF"]?.numberValue.map { Int($0) }
        let conditions = weather?["conditions"]?.stringValue
        let aqiLabel = today.dictValue?["aqi"]?.dictValue?["label"]?.stringValue
        let commute = today.dictValue?["commute"]?.dictValue?["label"]?.stringValue
        if temperature == nil, conditions == nil, aqiLabel == nil, commute == nil { return nil }
        return TodaySummary(
            temperatureFahrenheit: temperature,
            conditions: conditions,
            aqiLabel: aqiLabel,
            commuteLabel: commute
        )
    }

    private static func projectDiscovery(_ item: HubDiscoveryResponse.Item) -> DiscoveryCardContent {
        let kind = DiscoveryKind(rawType: item.type)
        return DiscoveryCardContent(
            id: item.id,
            title: item.title,
            meta: item.meta,
            category: item.category ?? "",
            avatarInitials: initials(from: item.title),
            kind: kind,
            tint: tint(forDiscoveryKind: kind)
        )
    }

    private static func tint(forDiscoveryKind kind: DiscoveryKind) -> IdentityPillar {
        switch kind {
        case .business: .business
        case .person, .post, .gig, .unknown: .personal
        }
    }

    private static func pillars(from hub: HubResponse, setupMode: Bool) -> [PillarTile] {
        let personal = hub.cards.personal
        let home = hub.cards.home
        let business = hub.cards.business

        func pillar(_ projection: PillarProjection) -> PillarTile {
            PillarTile(
                pillar: projection.kind,
                label: projection.label,
                icon: projection.icon,
                tint: projection.tint,
                chip: setupMode ? "Set up" : projection.chip,
                chipSetupState: setupMode ? true : projection.chipSetupState,
                caption: setupMode ? projection.setupCaption : projection.populatedCaption
            )
        }

        return [
            pillar(
                PillarProjection(
                    kind: .pulse,
                    label: "Pulse",
                    icon: .megaphone,
                    tint: .personal,
                    chip: personal.unreadChats > 0 ? "\(personal.unreadChats) new" : nil,
                    chipSetupState: false,
                    populatedCaption: personal.unreadChats > 0
                        ? "\(personal.unreadChats) new in your feed"
                        : "Neighborhood feed",
                    setupCaption: "Neighborhood feed"
                )
            ),
            pillar(
                PillarProjection(
                    kind: .marketplace,
                    label: "Marketplace",
                    icon: .shoppingBag,
                    tint: .business,
                    chip: business.flatMap { $0.newOrders > 0 ? "\($0.newOrders)" : nil },
                    chipSetupState: business == nil,
                    populatedCaption: business.map { "\($0.newOrders) new orders" } ?? "Local buy & sell",
                    setupCaption: "Local buy & sell"
                )
            ),
            pillar(
                PillarProjection(
                    kind: .gigs,
                    label: "Gigs",
                    icon: .hammer,
                    tint: .personal,
                    chip: personal.gigsNearby > 0 ? "\(personal.gigsNearby) matches" : nil,
                    chipSetupState: false,
                    populatedCaption: personal.gigsNearby > 0
                        ? "\(personal.gigsNearby) tasks near you"
                        : "Earn & post tasks",
                    setupCaption: "Earn & post tasks"
                )
            ),
            pillar(
                PillarProjection(
                    kind: .mail,
                    label: "Mail",
                    icon: .mailbox,
                    tint: .home,
                    chip: home.flatMap { $0.newMail > 0 ? "\($0.newMail)" : nil },
                    chipSetupState: home == nil,
                    populatedCaption: home.map { "\($0.newMail) need pickup" } ?? "Scan & forward",
                    setupCaption: "Scan & forward"
                )
            )
        ]
    }

    /// Maps a `/app/…` jump route to the pillar tint that owns it. Falls
    /// back to `.personal` for routes that don't carry a pillar (the
    /// design's default).
    static func tint(forRoute route: String) -> IdentityPillar {
        switch true {
        case route.contains("gigs"), route.contains("post"): .personal
        case route.contains("marketplace"), route.contains("listings"): .business
        case route.contains("mail"), route.contains("homes"): .home
        default: .personal
        }
    }

    /// Which identity tints the avatar ring + section accents. Default to
    /// `.home` if the user has any home claimed, else `.personal` (matches
    /// the design's most-common populated frame).
    private static func primaryIdentity(for hub: HubResponse) -> IdentityPillar {
        hub.homes.isEmpty ? .personal : .home
    }

    private static func defaultActionChips() -> [ActionChipContent] {
        [
            ActionChipContent(kind: .postTask, label: "Post task", icon: .plusCircle, active: true),
            ActionChipContent(kind: .snapAndSell, label: "Snap & sell", icon: .camera, active: false),
            ActionChipContent(kind: .scanMail, label: "Scan mail", icon: .scanLine, active: false),
            ActionChipContent(kind: .addHome, label: "Add home", icon: .home, active: false)
        ]
    }

    private static func pillarTint(for value: String) -> IdentityPillar {
        switch value {
        case "personal": .personal
        case "home": .home
        case "business": .business
        default: .personal
        }
    }

    static func icon(from raw: String) -> PantopusIcon {
        PantopusIcon.allCases.first { $0.rawValue == raw } ?? .arrowLeft
    }

    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }

    private static func setupTitle(_ key: String) -> String {
        key.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private static func greeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default: return "Hello"
        }
    }

    private static func relative(timestamp: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: timestamp) else { return timestamp }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// `JSONValue.dictValue` lives in `Core/Networking/Models/Common/JSONValue.swift`.
