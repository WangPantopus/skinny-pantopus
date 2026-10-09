//
//  HomeDashboardViewModel.swift
//  Pantopus
//
//  Fetches, concurrently:
//   - `GET /api/homes/:id` (detail, after current shared access),
//   - `GET /api/homes/:id/dashboard`   — hero stats + Overview sections,
//   - `GET /api/homes/:id/health-score`,
//   - `GET /api/homes/:id/seasonal-checklist`,
//   - `GET /api/homes/:id/property-value`,
//   - `GET /api/homes/:id/bill-trends`.
//
//  Each Home Intelligence card owns its own state so one failing read
//  can't blank the screen.
//
// swiftlint:disable file_length type_body_length

import Foundation
import Observation

/// Projection of the home header + stats + tab strip.
public struct HomeDashboardContent: Sendable {
    public let address: String
    /// True when the home has any verified owner; drives the header
    /// "Verified" badge and the summary status row. Distinct from
    /// `isVerifiedOwner` because the home can have a verified owner
    /// who isn't the signed-in user.
    public let verified: Bool
    /// True when the signed-in user is the verified owner of this home.
    /// Resolved from the current dashboard authority, never a pending claim.
    public let isVerifiedOwner: Bool
    public let stats: [HomeHeroStat]
    public let quickActions: [QuickActionTile]
    public let tabs: [GridTabsTab]
    public let overview: HomeDashboardOverviewContent
    public let attentionSummary: HomeDashboardAttentionSummary?
    /// Non-nil when the home is in a non-normal security state and the
    /// banner must render above the tabs. See `HomeSecurityBannerContent`.
    public let securityBanner: HomeSecurityBannerContent?

    public init(
        address: String,
        verified: Bool,
        isVerifiedOwner: Bool,
        stats: [HomeHeroStat],
        quickActions: [QuickActionTile],
        tabs: [GridTabsTab],
        overview: HomeDashboardOverviewContent,
        attentionSummary: HomeDashboardAttentionSummary? = nil,
        securityBanner: HomeSecurityBannerContent? = nil
    ) {
        self.address = address
        self.verified = verified
        self.isVerifiedOwner = isVerifiedOwner
        self.stats = stats
        self.quickActions = quickActions
        self.tabs = tabs
        self.overview = overview
        self.attentionSummary = attentionSummary
        self.securityBanner = securityBanner
    }
}

/// Projection of the home's `security_state` guard rail onto the
/// dashboard banner. Mirrors RN `src/components/HomeStatusBanner.tsx`
/// (copy from `src/constants/ownershipCopy.ts`), which renders nothing
/// for `normal` / `frozen_silent`.
public struct HomeSecurityBannerContent: Sendable, Equatable {
    /// Which action the CTA performs, or `.noAction` when the state has
    /// no destination we can route to.
    public enum Action: Sendable, Equatable {
        case inviteCoOwner
        case openSecuritySettings
        case noAction
    }

    public let state: HomeSecurityState
    public let icon: PantopusIcon
    public let title: String
    public let body: String
    public let ctaLabel: String?
    public let action: Action

    public init(
        state: HomeSecurityState,
        icon: PantopusIcon,
        title: String,
        body: String,
        ctaLabel: String?,
        action: Action
    ) {
        self.state = state
        self.icon = icon
        self.title = title
        self.body = body
        self.ctaLabel = ctaLabel
        self.action = action
    }
}

public struct HomeDashboardOverviewContent: Sendable {
    public let upcoming: [HomeDashboardTimelineItem]
    public let activity: [HomeDashboardActivityItem]
    public let emergency: HomeDashboardEmergencyInfo
}

public struct HomeDashboardTimelineItem: Sendable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let tone: QuickActionTone
    public let title: String
    public let subtitle: String
    public let trailing: String?
}

public struct HomeDashboardActivityItem: Sendable, Identifiable {
    public let id: String
    public let initials: String
    public let tone: QuickActionTone
    public let title: String
    public let detail: String
    public let time: String
}

public struct HomeDashboardEmergencyInfo: Sendable {
    public let title: String
    public let body: String
    public let isConfigured: Bool
}

public struct HomeDashboardAttentionSummary: Sendable {
    public let message: String
    public let chips: [HomeDashboardQuickJump]
}

public struct HomeDashboardQuickJump: Sendable, Identifiable {
    public let id: String
    public let label: String
    public let icon: PantopusIcon
    public let actionId: String
}

public struct HomeDashboardBrandNewContent: Sendable {
    public let content: HomeDashboardContent
    public let onboardingSteps: [HomeDashboardOnboardingStep]
}

public struct HomeDashboardOnboardingStep: Sendable, Identifiable {
    public let id: String
    public let title: String
    public let body: String
    public let cta: String
    public let icon: PantopusIcon
    public let tone: QuickActionTone
    public let actionId: String
}

/// Observed state for the Home Dashboard screen.
public enum HomeDashboardState: Sendable {
    case loading
    case loaded(HomeDashboardContent)
    case empty(HomeDashboardBrandNewContent)
    case needsAttention(HomeDashboardContent)
    case error(message: String)
    case limited(HomeDashboardLimitedContent)
}

/// Per-card state for the Home Intelligence stack. Each card renders its
/// own loading / loaded / absent / error surface so a failure in one read
/// never blanks the dashboard.
public enum HomeIntelligenceCardState<Value: Sendable>: Sendable {
    case loading
    case loaded(Value)
    /// The signed-in member isn't permitted to see this card (HTTP 403).
    case forbidden
    case failed(message: String)

    public var value: Value? {
        if case let .loaded(value) = self { return value }
        return nil
    }

    public var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }
}

/// Backs [`HomeDashboardView`].
@Observable
@MainActor
final class HomeDashboardViewModel {
    /// Currently displayed state.
    private(set) var state: HomeDashboardState = .loading
    /// Currently selected grid tab.
    private(set) var selectedTab: String = "overview"

    func selectTab(_ id: String) {
        guard HomeDashboardProjection.gatedTabs(access: access).contains(where: { $0.id == id }) else { return }
        selectedTab = id
    }

    // MARK: - Home Intelligence (independent per-card state)

    private(set) var healthScore: HomeIntelligenceCardState<HomeHealthScoreDTO> = .loading
    private(set) var checklist: HomeIntelligenceCardState<SeasonalChecklistDTO> = .loading
    private(set) var propertyValue: HomeIntelligenceCardState<HomePropertyValueDTO> = .loading
    private(set) var billTrends: HomeIntelligenceCardState<HomeBillTrendsDTO> = .loading
    private(set) var billCurrency = "USD"
    private(set) var billCurrencies = ["USD"]
    private(set) var isSavingBillSharing = false
    private(set) var billSharingFailed = false
    private var billReadID = UUID()
    /// Checklist item ids with an in-flight PATCH — the row disables while
    /// its mutation is awaiting the server's returned item state.
    private(set) var pendingChecklistItemIds: Set<String> = []
    /// The checklist's error came from a change, not the read: the card
    /// had loaded, so its headline names the change instead.
    private(set) var checklistChangeFailed = false

    private let homeId: String
    private let api: APIClient
    private let authority: HomeDashboardAccess
    /// The screen store (Instant Screens). Owners and household roles keep a
    /// copy of this dashboard there (decision 3); nobody else does.
    private let store: ScreenStore
    /// The screen shows the last copy while the access is re-checked; writes
    /// here wait for that re-check.
    private(set) var showingCopy = false
    /// The re-check couldn't reach the server: the copy stays, its sensitive
    /// parts say they couldn't load.
    private(set) var copyCheckFailed = false
    /// "Couldn't refresh. Showing 3:42 PM." once a copy that couldn't be
    /// re-checked is older than a day (contract section 3).
    private(set) var staleNotice: String?
    private var copyFetchedAt: Date?
    /// A tap that has to wait for the access re-check says so.
    var refreshFailureMessage: String?
    private var generation = 0
    private var visible = false
    private var accessFingerprint: Data?
    private var accessExpiresAt: Date?
    private var expiryTask: Task<Void, Never>?
    private(set) var canCreateTask = false

    private var accessUnexpired: Bool {
        accessExpiresAt.map { Date() < $0 } ?? true
    }

    var activationRevision: Int {
        generation
    }

    var isCurrent: Bool {
        authority.isCurrent
    }

    var canEditChecklist: Bool {
        visible && isCurrent && accessUnexpired && accessFingerprint != nil && access?.can("home.edit") == true
    }

    /// Whether the checklist shows as editable: an owner's stays so while the
    /// access is re-checked (the tap itself waits for the re-check).
    var checklistEditable: Bool {
        shows("home.edit")
    }

    func can(_ permission: String) -> Bool {
        visible && isCurrent && accessUnexpired && access?.can(permission) == true
    }

    /// What the screen shows follows the access on screen (the copy's until
    /// the re-check answers), including in the first frame before it's visible.
    func shows(_ permission: String) -> Bool {
        isCurrent && accessUnexpired && access?.can(permission) == true
    }

    /// Launch cut #7 (Household extras): the dashboard actions that open bills,
    /// packages, pets, polls or the home calendar.
    private static let householdExtrasActions: Set<String> = [
        "track_bill", "track_package", "log_package", "add_pet", "create_poll", "view_bills", "view_polls", "pets",
        "calendar", "view_packages"
    ]

    func canPerform(_ action: String) -> Bool {
        guard visible, isCurrent, accessUnexpired else { return false }
        // Launch cuts #7 (Household extras) / #8 (Mail extras) / #10 (Mailbox):
        // bills, packages, pets, polls and the calendar; "Send Mail" writes a letter.
        if Self.householdExtrasActions.contains(action), !LaunchFeatures.householdExtras { return false }
        if action == "send_mail", !(LaunchFeatures.mailExtras && LaunchFeatures.mailbox) { return false }
        if action == "add_task" { return canCreateTask }
        let permissions = [
            "track_bill": "finance.manage", "track_package": "packages.edit", "log_package": "packages.edit",
            "add_pet": "home.edit", "create_poll": "home.edit", "send_mail": "mailbox.view",
            "add_member": "members.view", "view_bills": "finance.view", "view_polls": "home.view",
            "view_maintenance": "maintenance.view", "view_issues": "maintenance.view", "pets": "home.view",
            "calendar": "calendar.view",
            "view_docs": "docs.view", "view_emergency": "sensitive.view", "view_packages": "packages.view",
            "view_tasks": "tasks.view", "view_claims": "ownership.view"
        ]
        if action == "access_codes" { return can("access.view_wifi") || can("access.view_codes") }
        return permissions[action].map(can) ?? false
    }

    /// Leaving the screen. With `keepingCopy` (a sub-screen opened on top),
    /// an owner's or household member's dashboard stays as it was, scroll
    /// and tab included, and is re-checked on return (decision 3); its
    /// sensitive parts and writes wait for that re-check. Everyone else, and
    /// the app leaving the foreground, starts blank again.
    func suspend(keepingCopy: Bool = false) {
        generation += 1
        visible = false
        guard keepingCopy, let access, Self.isHousehold(access, expiresAt: accessExpiresAt), detailData != nil else {
            clearPrivateData()
            return
        }
        expiryTask?.cancel()
        expiryTask = nil
        accessFingerprint = nil
        showingCopy = true
        billReadID = UUID()
        billTrends = .loading
        pendingChecklistItemIds = []
        rebuild()
    }

    func retireSession() {
        suspend()
        dropCopy()
        state = .error(message: "Your session changed. Reopen this Home to continue.")
    }

    private func clearPrivateData() {
        showingCopy = false
        copyCheckFailed = false
        staleNotice = nil
        copyFetchedAt = nil
        expiryTask?.cancel()
        expiryTask = nil
        accessExpiresAt = nil
        detailData = nil
        dashboardData = nil
        access = nil
        accessFingerprint = nil
        canCreateTask = false
        selectedTab = "overview"
        healthScore = .loading
        checklist = .loading
        propertyValue = .loading
        billReadID = UUID()
        billTrends = .loading
        pendingChecklistItemIds = []
        checklistChangeFailed = false
        state = .loading
    }

    private func current(_ revision: Int) -> Bool {
        visible && revision == generation && isCurrent && accessUnexpired && !Task.isCancelled
    }

    private func watchExpiry(_ expiry: Date?, revision: Int) {
        accessExpiresAt = expiry
        guard let expiry else { return }
        expiryTask = Task { [weak self] in
            while Date() < expiry {
                do {
                    try await Task.sleep(for: .seconds(max(0.001, expiry.timeIntervalSinceNow)))
                } catch { return }
            }
            guard !Task.isCancelled else { return }
            self?.retireAccess(revision)
        }
    }

    private func requireCurrent(_ revision: Int) throws {
        guard current(revision) else { throw CancellationError() }
    }

    private func retireAccess(_ revision: Int) {
        guard visible, generation == revision else { return }
        generation += 1
        dropCopy()
        clearPrivateData()
        state = .error(message: "Home access changed or could not be confirmed. Reload to check current access.")
    }

    // Raw responses; `rebuild()` composes the rendered content from them.
    private var detailData: HomeDetail?
    private var dashboardData: HomeDashboardResponse?
    /// The viewer's own per-home access record. Gates the quick-action
    /// tiles + tab strip exactly as RN gates its dashboard cards.
    /// Required for shared content; denial or suspension clears private state.
    private(set) var access: HomeAccessDTO?

    init(homeId: String, api: APIClient = .shared, identity: (() -> String?)? = nil) {
        self.homeId = homeId
        self.api = api
        authority = HomeDashboardAccess(homeId: homeId, api: api, identity: identity)
        store = ScreenStore.store(for: api)
        // Reopening a Home: an owner's or household member's last copy is the
        // first frame; the access re-check runs when the screen activates.
        if HomeDashboardSampleData.state(for: homeId) == nil { showCopy() }
    }

    func activate(ifCurrent revision: Int) async {
        guard revision == generation, !Task.isCancelled else { return }
        visible = true
        await refresh()
    }

    func load() async {
        await activate(ifCurrent: generation)
    }

    func refresh() async {
        guard visible else { return }
        if let sampleState = HomeDashboardSampleData.state(for: homeId) {
            state = sampleState
            return
        }
        generation += 1
        let revision = generation
        // Owners and household roles see the last copy while their access is
        // re-checked below (decision 3); everyone else starts blank.
        if !showingCopy {
            clearPrivateData()
            showCopy()
        } else if copyCheckFailed {
            // Trying again: the sensitive parts are being checked again.
            copyCheckFailed = false
            billTrends = .loading
            rebuild()
        }
        guard isCurrent else {
            dropCopy()
            clearPrivateData()
            state = .error(message: "Your session changed. Reopen this Home to continue.")
            return
        }
        do {
            try await recheck(revision)
        } catch {
            guard visible, revision == generation else { return }
            // No answer (offline, timed out, server busy): an owner's or household
            // member's copy stays, quietly; its sensitive parts say they couldn't
            // load and its writes still wait. Anything else clears.
            if showingCopy, Self.isUnreachable(error) {
                showCopyCheckFailed()
                return
            }
            dropCopy()
            clearPrivateData()
            state = .error(message: "Current Home information could not be confirmed. Reload to try again.")
        }
    }

    /// The access check, then the Home and its dashboard read with it, then
    /// the access checked again; only then does the screen take them.
    private func recheck(_ revision: Int) async throws {
        let opening = try await authority.read()
        try requireCurrent(revision)
        guard let currentAccess = opening.access, currentAccess.can("home.view") else {
            // Refused: nothing of the copy stays.
            dropCopy()
            clearPrivateData()
            try await showLimited(opening, revision: revision)
            return
        }
        // Only an owner's or household member's open-ended access keeps a
        // copy; anyone else's dashboard is read fresh every time.
        let household = Self.isHousehold(currentAccess, expiresAt: opening.expiresAt)
        if !household, showingCopy || store.peek(HomeDashboardAccess.endpoint(homeId: homeId), as: HomeAccessDTO.self) != nil {
            dropCopy()
            clearPrivateData()
        }
        watchExpiry(opening.expiresAt, revision: revision)
        try requireCurrent(revision)
        let (detail, dashboard) = try await readCore(household: household)
        try requireCurrent(revision)
        guard let detail, let dashboard, detail.base.id == homeId, dashboard.home?.id == homeId,
              Set(dashboard.myAccess?.permissions ?? []) == Set(currentAccess.permissions),
              dashboard.myAccess?.isOwner == currentAccess.isOwner else { throw APIError.invalidResponse }
        let collection = currentAccess.can("tasks.view") ? try? await HomeTaskAccess(homeId: homeId, api: api).list() : nil
        try requireCurrent(revision)
        let final = try await authority.read()
        try requireCurrent(revision)
        guard final.fingerprint == opening.fingerprint else { throw APIError.invalidResponse }
        if household {
            store.put(
                HomeDashboardAccess.endpoint(homeId: homeId),
                data: final.body,
                kind: .homes,
                topics: [ScreenTopic.home(homeId)],
                showsBeforeRecheck: true
            )
        }
        showingCopy = false
        copyCheckFailed = false
        staleNotice = nil
        accessFingerprint = final.fingerprint
        access = currentAccess
        detailData = detail
        dashboardData = dashboard
        canCreateTask = collection?.collectionCapabilities?.canCreate == true
        rebuild()
        await withTaskGroup(of: Void.self) { group in
            group.addTask { [self] in await loadHealthScore() }
            group.addTask { [self] in await loadChecklist() }
            group.addTask { [self] in await loadPropertyValue() }
            group.addTask { [self] in await loadBillTrends() }
        }
    }

    /// No shared access: only the exact task collection can admit private
    /// first use or a separately granted task route. No inferred owner capability.
    private func showLimited(_ opening: HomeDashboardAuthoritySnapshot, revision: Int) async throws {
        let collection = try? await HomeTaskAccess(homeId: homeId, api: api).list()
        try requireCurrent(revision)
        let final = try await authority.read()
        try requireCurrent(revision)
        guard final.fingerprint == opening.fingerprint else { throw APIError.invalidResponse }
        canCreateTask = collection?.collectionCapabilities?.canCreate == true
        state = .limited(HomeDashboardLimitedContent(
            verificationKind: opening.verificationKind,
            verificationStatus: opening.verificationStatus,
            canOpenTasks: collection != nil
        ))
    }

    /// The Home and its dashboard, read at once (typed task groups preserve
    /// the prior iOS runtime-crash repair). An owner's or household member's
    /// replies stay in the screen store as the copy.
    private func readCore(household: Bool) async throws -> (HomeDetail?, HomeDashboardResponse?) {
        let detailGate: @Sendable (HomeDetailResponse) -> Bool = { _ in household }
        let dashboardGate: @Sendable (HomeDashboardResponse) -> Bool = { _ in household }
        var detail: HomeDetail?
        var dashboard: HomeDashboardResponse?
        try await withThrowingTaskGroup(of: CoreReadResult.self) { group in
            group.addTask { [self] in
                let result = try await store.load(
                    HomesEndpoints.detail(homeId: homeId),
                    as: HomeDetailResponse.self,
                    kind: .homes,
                    topics: [ScreenTopic.home(homeId)],
                    force: true,
                    showsBeforeRecheck: detailGate
                ).value
                return .detail(result.home)
            }
            group.addTask { [self] in
                let result = try await store.load(
                    HomeDashboardEndpoints.dashboard(homeId: homeId),
                    as: HomeDashboardResponse.self,
                    kind: .homes,
                    topics: [ScreenTopic.home(homeId)],
                    force: true,
                    showsBeforeRecheck: dashboardGate
                ).value
                return .dashboard(result)
            }
            for try await result in group {
                switch result {
                case let .detail(value): detail = value
                case let .dashboard(value): dashboard = value
                }
            }
        }
        return (detail, dashboard)
    }

    // MARK: - The copy (Instant Screens decision 3)

    /// Owners and household roles (owner, admin, manager, lease resident,
    /// member, restricted member) whose access doesn't end. Guests, service
    /// providers and expiring access never get a copy.
    static func isHousehold(_ access: HomeAccessDTO, expiresAt: Date?) -> Bool {
        guard expiresAt == nil, access.hasAccess else { return false }
        let household: Set = ["owner", "admin", "manager", "lease_resident", "member", "restricted_member"]
        return access.isOwner || household.contains((access.roleBase ?? "").lowercased())
    }

    private static func isUnreachable(_ error: any Error) -> Bool {
        switch error as? APIError {
        case .transport, .server, .retriesExhausted: true
        default: error is URLError
        }
    }

    /// Shows the last copy, if this account kept one for this Home: the
    /// access, the Home, its dashboard and the cards read beside them. Bill
    /// trends are never kept; document and bill counts and emergency info
    /// aren't shown from it (`rebuild`).
    @discardableResult
    private func showCopy() -> Bool {
        guard let copyAccess = store.peek(HomeDashboardAccess.endpoint(homeId: homeId), as: HomeAccessDTO.self)?.value,
              copyAccess.can("home.view"), Self.isHousehold(copyAccess, expiresAt: nil),
              let detail = store.peek(HomesEndpoints.detail(homeId: homeId), as: HomeDetailResponse.self)?.value.home,
              let copy = store.peek(HomeDashboardEndpoints.dashboard(homeId: homeId), as: HomeDashboardResponse.self),
              detail.base.id == homeId, copy.value.home?.id == homeId,
              Set(copy.value.myAccess?.permissions ?? []) == Set(copyAccess.permissions)
        else { return false }
        let dashboard = copy.value
        copyFetchedAt = copy.fetchedAt
        access = copyAccess
        detailData = detail
        dashboardData = dashboard
        showingCopy = true
        healthScore = copyCard(HomeDashboardEndpoints.healthScore(homeId: homeId, force: true))
        checklist = copyCard(HomeDashboardEndpoints.seasonalChecklist(homeId: homeId))
        propertyValue = copyCard(HomeDashboardEndpoints.propertyValue(homeId: homeId))
        rebuild()
        return true
    }

    /// The re-check couldn't reach the server (decision 3, offline): the copy
    /// stays; bill trends and emergency info say they couldn't load, and past
    /// a day the quiet "Couldn't refresh" line shows.
    private func showCopyCheckFailed() {
        copyCheckFailed = true
        billTrends = .failed(message: "Couldn't load this card. Check your connection and try again.")
        if let copyFetchedAt, Date().timeIntervalSince(copyFetchedAt) > ScreenDataKind.homes.maxShownAge {
            let shown = copyFetchedAt.formatted(.dateTime.month(.abbreviated).day().hour().minute())
            staleNotice = "Couldn't refresh. Showing \(shown)."
        }
        rebuild()
    }

    /// A card's Retry or a checklist action while the copy is on screen: the
    /// access is re-checked first (the cards then read with it).
    private func recheckFirst() async -> Bool {
        guard showingCopy, accessFingerprint == nil else { return false }
        await refresh()
        return true
    }

    private func copyCard<Value: Decodable & Sendable>(_ endpoint: Endpoint) -> HomeIntelligenceCardState<Value> {
        store.peek(endpoint, as: Value.self).map { .loaded($0.value) } ?? .loading
    }

    /// The access was refused, changed or couldn't be confirmed: the copy goes.
    private func dropCopy() {
        showingCopy = false
        for endpoint in [
            HomeDashboardAccess.endpoint(homeId: homeId),
            HomesEndpoints.detail(homeId: homeId),
            HomeDashboardEndpoints.dashboard(homeId: homeId),
            HomeDashboardEndpoints.healthScore(homeId: homeId, force: true),
            HomeDashboardEndpoints.seasonalChecklist(homeId: homeId),
            HomeDashboardEndpoints.propertyValue(homeId: homeId)
        ] {
            store.remove(endpoint)
        }
    }

    /// The cards' reads keep their copy beside the dashboard's, under the same rule.
    private func cardRead<Value: Decodable & Sendable>(_ endpoint: Endpoint, as _: Value.Type) async throws -> Value {
        let household = access.map { Self.isHousehold($0, expiresAt: accessExpiresAt) } ?? false
        let gate: @Sendable (Value) -> Bool = { _ in household }
        return try await store.load(
            endpoint,
            as: Value.self,
            kind: .homes,
            topics: [ScreenTopic.home(homeId)],
            force: true,
            showsBeforeRecheck: gate
        ).value
    }

    private enum CoreReadResult {
        case detail(HomeDetail)
        case dashboard(HomeDashboardResponse)
    }

    private func authorize(_ revision: Int) async throws {
        try requireCurrent(revision)
        guard let accessFingerprint else { throw APIError.forbidden() }
        let snapshot = try await authority.read()
        try requireCurrent(revision)
        guard snapshot.access?.can("home.view") == true, snapshot.fingerprint == accessFingerprint else {
            throw APIError.forbidden()
        }
    }

    private func authorizedCard<Value: Sendable>(
        permissions: [String], _ work: () async throws -> Value
    ) async -> HomeIntelligenceCardState<Value>? {
        let revision = generation
        guard current(revision), accessFingerprint != nil else { return nil }
        guard permissions.allSatisfy({ access?.can($0) == true }) else { return .forbidden }
        do {
            try await authorize(revision)
            let result = await fetchCard(work)
            try await authorize(revision)
            if case .forbidden = result { retireAccess(revision)
                return nil
            }
            return result
        } catch {
            retireAccess(revision)
            return nil
        }
    }

    // MARK: - Home Intelligence reads

    /// Mirrors RN's `useHomeIntelligence`, which always forces a server
    /// recompute so a stale zero-score can't mask a populated home.
    private func loadHealthScore() async {
        guard let result = await authorizedCard(
            permissions: ["home.view", "maintenance.view", "finance.view", "members.view", "docs.view", "sensitive.view"],
            {
                let value = try await self.cardRead(
                    HomeDashboardEndpoints.healthScore(homeId: self.homeId, force: true),
                    as: HomeHealthScoreDTO.self
                )
                guard HomeIntelligenceValidation.health(value, homeId: self.homeId) else { throw APIError.invalidResponse }
                return value
            }
        ) else { return }
        healthScore = result
        // The Overview's emergency row reads the health breakdown.
        rebuild()
    }

    private func loadChecklist() async {
        guard let result = await authorizedCard(permissions: ["home.view"], {
            let value = try await self.cardRead(
                HomeDashboardEndpoints.seasonalChecklist(homeId: self.homeId),
                as: SeasonalChecklistDTO.self
            )
            guard HomeIntelligenceValidation.checklist(value, homeId: self.homeId) else { throw APIError.invalidResponse }
            return value
        }) else { return }
        checklistChangeFailed = false
        checklist = result
    }

    private func loadPropertyValue() async {
        guard let result = await authorizedCard(permissions: ["home.view"], {
            let value = try await self.cardRead(
                HomeDashboardEndpoints.propertyValue(homeId: self.homeId),
                as: HomePropertyValueDTO.self
            )
            guard HomeIntelligenceValidation.property(value) else { throw APIError.invalidResponse }
            return value
        }) else { return }
        propertyValue = result
    }

    private func loadBillTrends() async {
        let readID = UUID()
        billReadID = readID
        let currency = billCurrency
        guard let result = await authorizedCard(permissions: ["finance.view"], {
            try await self.api.request(
                HomeDashboardEndpoints.billTrends(homeId: self.homeId, currency: currency),
                as: HomeBillTrendsDTO.self
            )
        }) else { return }
        guard readID == billReadID, currency == billCurrency else { return }
        if let data = result.value, HomeBillPresentation.isCurrent(data, currency: currency) {
            billCurrencies = Array(Set(data.availableCurrencies + ["USD", currency])).sorted()
        }
        billTrends = result
    }

    private func fetchCard<Value: Sendable>(
        _ work: () async throws -> Value
    ) async -> HomeIntelligenceCardState<Value> {
        do {
            let value = try await work()
            return .loaded(value)
        } catch APIError.forbidden {
            return .forbidden
        } catch APIError.invalidResponse {
            return .failed(message: "Current Home information is unavailable. Reload this card.")
        } catch APIError.decoding {
            return .failed(message: "Current Home information is unavailable. Reload this card.")
        } catch APIError.server {
            return .failed(message: "This Home information couldn't be loaded. Please retry.")
        } catch {
            return .failed(
                message: (error as? APIError)?.errorDescription ?? "Couldn't load this card."
            )
        }
    }

    // MARK: - Seasonal checklist actions

    /// `PATCH …/seasonal-checklist/:itemId { status: "completed" }`.
    func completeChecklistItem(_ itemId: String) async {
        await updateChecklistItem(itemId, status: "completed")
    }

    /// `PATCH …/seasonal-checklist/:itemId { status: "skipped" }`.
    func skipChecklistItem(_ itemId: String) async {
        await updateChecklistItem(itemId, status: "skipped")
    }

    /// The GET is idempotent-generate: it creates the current season's
    /// items when the home has none, so "Generate checklist" is a re-read.
    /// The score counts the checklist, so it reloads once the items exist.
    func generateChecklist() async {
        if await recheckFirst() { return }
        checklist = .loading
        await loadChecklist()
        await loadHealthScore()
    }

    /// Re-reads only the health score (used after a checklist mutation and
    /// on card-level Retry).
    func refreshHealthScore() async {
        if await recheckFirst() { return }
        healthScore = .loading
        await loadHealthScore()
    }

    func retryPropertyValue() async {
        if await recheckFirst() { return }
        propertyValue = .loading
        await loadPropertyValue()
    }

    func retryBillTrends() async {
        if await recheckFirst() { return }
        billTrends = .loading
        await loadBillTrends()
    }

    var canChangeBillSharing: Bool {
        can("home.edit") && accessFingerprint != nil
    }

    /// The anonymous neighborhood comparison is opt-in per Home (as on the
    /// web). Reload the card so it shows what the server saved.
    func setBillBenchmarkOptIn(_ optedIn: Bool) async {
        guard canChangeBillSharing, !isSavingBillSharing else { return }
        let revision = generation
        isSavingBillSharing = true
        billSharingFailed = false
        defer { if revision == generation { isSavingBillSharing = false } }
        do {
            try await authorize(revision)
            let _: EmptyResponse = try await api.request(
                HomeSettingsEndpoints.setBillBenchmarkOptIn(homeId: homeId, optedIn: optedIn)
            )
            try await authorize(revision)
            await loadBillTrends()
        } catch APIError.forbidden {
            retireAccess(revision)
        } catch {
            guard current(revision) else { return }
            billSharingFailed = true
        }
    }

    func selectBillCurrency(_ currency: String) async {
        guard currency != billCurrency, billCurrencies.contains(currency) else { return }
        billCurrency = currency
        billTrends = .loading
        await loadBillTrends()
    }

    private func updateChecklistItem(_ itemId: String, status: String) async {
        if showingCopy, checklistEditable, accessFingerprint == nil {
            refreshFailureMessage = copyCheckFailed
                ? "Can't reach Pantopus right now. Try again when you're back online."
                : "Checking your access to this Home. Try again in a moment."
            return
        }
        guard canEditChecklist, !pendingChecklistItemIds.contains(itemId) else { return }
        let revision = generation
        pendingChecklistItemIds.insert(itemId)
        defer { if revision == generation { pendingChecklistItemIds.remove(itemId) } }

        do {
            try await authorize(revision)
            let updated: SeasonalChecklistItemDTO = try await api.request(
                HomeDashboardEndpoints.updateSeasonalChecklistItem(
                    homeId: homeId,
                    itemId: itemId,
                    status: status
                )
            )
            try await authorize(revision)
            guard HomeIntelligenceValidation.item(updated, homeId: homeId),
                  updated.id == itemId, updated.status == status else { throw APIError.invalidResponse }
            // Reflect exactly what the server returned, then re-read the
            // score (seasonal progress is one of its six dimensions).
            applyChecklistItem(updated)
            await loadHealthScore()
        } catch APIError.forbidden {
            retireAccess(revision)
        } catch {
            guard current(revision) else { return }
            let detail = (error as? APIError).flatMap { failure -> String? in
                if case .clientError = failure { return failure.errorDescription }
                return nil
            }
            checklistChangeFailed = true
            checklist = .failed(message: detail ?? "Couldn't confirm the checklist change. Reload to check its current state.")
        }
    }

    /// Splice the server's returned row back into the loaded checklist and
    /// recompute progress the same way the backend does (`home.js:7526`).
    private func applyChecklistItem(_ updated: SeasonalChecklistItemDTO) {
        guard let current = checklist.value else { return }
        let items = current.items.map { $0.id == updated.id ? updated : $0 }
        let carryover = current.carryover.map { block in
            SeasonalChecklistCarryoverDTO(
                season: block.season,
                items: block.items.map { $0.id == updated.id ? updated : $0 }
            )
        }
        let completed = items.filter(\.isResolved).count
        checklist = .loaded(
            SeasonalChecklistDTO(
                season: current.season,
                items: items,
                progress: SeasonalChecklistProgressDTO(
                    total: items.count,
                    completed: completed,
                    percentage: items.isEmpty ? 0 : Int((Double(completed) / Double(items.count) * 100).rounded())
                ),
                carryover: carryover
            )
        )
    }

    // MARK: - Projection

    private func rebuild() {
        if let detailData {
            state = .loaded(content(
                address: detailData.base.address ?? detailData.base.name ?? "Home",
                // Header badge / summary row: home has any verified owner.
                verified: detailData.ownershipStatus == "verified" || detailData.owners.contains { $0.ownerStatus == "verified" },
                isVerifiedOwner: detailData.ownershipStatus == "verified",
                securityBanner: Self.securityBanner(
                    state: detailData.securityState,
                    claimWindowEndsAt: detailData.claimWindowEndsAt,
                    canInviteCoOwner: shows("ownership.manage")
                )
            ))
        }
    }

    private func content(
        address: String,
        verified: Bool,
        isVerifiedOwner: Bool,
        securityBanner: HomeSecurityBannerContent?
    ) -> HomeDashboardContent {
        // Document and bill counts and emergency info never show from a copy.
        let counts = showingCopy ? dashboardData?.counts.withoutSensitiveCounts : dashboardData?.counts
        var overview = HomeDashboardProjection.overview(dashboard: dashboardData, health: showingCopy ? nil : healthScore.value)
        if showingCopy { overview = overview.checkingEmergency(failed: copyCheckFailed) }
        return HomeDashboardContent(
            address: address,
            verified: verified,
            isVerifiedOwner: isVerifiedOwner,
            stats: HomeDashboardProjection.stats(counts: counts).filter {
                // Launch cut #7 (Household extras): the Packages and Bills stats are hidden.
                if $0.id != "tasks", !LaunchFeatures.householdExtras { return false }
                let permission = ["packages": "packages.view", "bills": "finance.view", "tasks": "tasks.view"][$0.id]
                return permission.map(shows) ?? false
            },
            quickActions: HomeDashboardProjection.quickActions(counts: counts, access: access),
            tabs: HomeDashboardProjection.gatedTabs(access: access),
            overview: overview,
            attentionSummary: nil,
            securityBanner: securityBanner
        )
    }

    // MARK: - Security-state banner (parity contract — mirrored in Android)

    /// Pure projection of `Home.security_state` onto the dashboard
    /// banner. Copy is lifted verbatim from RN's `ownershipCopy.ts`
    /// (`CLAIM_WINDOW` / `REVIEW_REQUIRED` / `DISPUTE` / `FROZEN`) and the
    /// render gate matches `HomeStatusBanner.tsx:33` — `normal` and
    /// `frozen_silent` render nothing.
    /// `canInviteCoOwner` drops the claim window's CTA for viewers who can't
    /// invite an owner (members, or a seller right after a transfer).
    static func securityBanner(
        state: HomeSecurityState,
        claimWindowEndsAt: String?,
        canInviteCoOwner: Bool = true
    ) -> HomeSecurityBannerContent? {
        switch state {
        case .normal, .frozenSilent:
            return nil
        case .claimWindow:
            let date = HomeOwnershipSecurityViewModel.formattedDate(claimWindowEndsAt)
            return HomeSecurityBannerContent(
                state: state,
                icon: .clock,
                title: "Claim Window Active",
                body: date.map { "Co-owners can verify ownership until \($0)." }
                    ?? "Co-owners can verify ownership while the window is open.",
                ctaLabel: canInviteCoOwner ? "Invite Co-Owner" : nil,
                action: canInviteCoOwner ? .inviteCoOwner : .noAction
            )
        case .reviewRequired:
            return HomeSecurityBannerContent(
                state: state,
                icon: .shield,
                title: "Review Required",
                body: "New owner claims require manual review.",
                ctaLabel: "Learn Why",
                action: .openSecuritySettings
            )
        case .disputed:
            return HomeSecurityBannerContent(
                state: state,
                icon: .alertTriangle,
                title: "Verification dispute active",
                body: "Some sensitive actions are temporarily restricted.",
                ctaLabel: "View Details",
                action: .openSecuritySettings
            )
        case .frozen:
            // RN renders a "Contact support" label with no handler
            // (`HomeStatusBanner.tsx:68-72`); we ship the copy without a
            // dead button rather than a control that does nothing.
            return HomeSecurityBannerContent(
                state: state,
                icon: .lock,
                title: "Home protections enabled",
                body: "Some actions require support.",
                ctaLabel: nil,
                action: .noAction
            )
        }
    }
}

// MARK: - The copy's sensitive parts

private extension HomeDashboardCountsDTO {
    /// Document and bill counts are sensitive: a copy shows them as zero
    /// until the re-check reads them again.
    var withoutSensitiveCounts: HomeDashboardCountsDTO {
        HomeDashboardCountsDTO(
            tasksOpen: tasksOpen,
            issuesOpen: issuesOpen,
            billsDue: 0,
            packagesExpected: packagesExpected,
            documents: 0,
            eventsUpcoming: eventsUpcoming,
            membersActive: membersActive,
            pets: pets
        )
    }
}

private extension HomeDashboardOverviewContent {
    /// Emergency info is sensitive: shown as being checked until the re-check,
    /// or as unavailable when the re-check couldn't reach the server.
    func checkingEmergency(failed: Bool) -> HomeDashboardOverviewContent {
        HomeDashboardOverviewContent(
            upcoming: upcoming,
            activity: activity,
            emergency: HomeDashboardEmergencyInfo(
                title: "Emergency info",
                body: failed ? "Couldn't check emergency info. Check your connection." : "Checking emergency info…",
                isConfigured: false
            )
        )
    }
}
