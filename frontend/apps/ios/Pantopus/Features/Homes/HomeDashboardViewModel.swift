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
    private var billReadID = UUID()
    /// Checklist item ids with an in-flight PATCH — the row disables while
    /// its mutation is awaiting the server's returned item state.
    private(set) var pendingChecklistItemIds: Set<String> = []

    private let homeId: String
    private let api: APIClient
    private let authority: HomeDashboardAccess
    private var generation = 0
    private var visible = false
    private var accessFingerprint: Data?
    private(set) var canCreateTask = false

    var activationRevision: Int {
        generation
    }

    var isCurrent: Bool {
        authority.isCurrent
    }

    var canEditChecklist: Bool {
        visible && isCurrent && access?.can("home.edit") == true
    }

    func can(_ permission: String) -> Bool {
        visible && isCurrent && access?.can(permission) == true
    }

    func canPerform(_ action: String) -> Bool {
        guard visible, isCurrent else { return false }
        if action == "add_task" { return canCreateTask }
        let permissions = [
            "track_bill": "finance.manage", "track_package": "packages.edit", "log_package": "packages.edit",
            "add_pet": "home.edit", "create_poll": "home.edit", "send_mail": "mailbox.view",
            "add_member": "members.view", "view_bills": "finance.view", "view_polls": "home.view",
            "view_maintenance": "maintenance.view", "pets": "home.view", "calendar": "calendar.view",
            "view_docs": "docs.view", "view_emergency": "sensitive.view", "view_packages": "packages.view",
            "view_tasks": "tasks.view", "view_claims": "ownership.view"
        ]
        if action == "access_codes" { return can("access.view_wifi") || can("access.view_codes") }
        return permissions[action].map(can) ?? false
    }

    func suspend() {
        generation += 1
        visible = false
        clearPrivateData()
    }

    func retireSession() {
        suspend()
        state = .error(message: "Your session changed. Reopen this Home to continue.")
    }

    private func clearPrivateData() {
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
        state = .loading
    }

    private func current(_ revision: Int) -> Bool {
        visible && revision == generation && isCurrent && !Task.isCancelled
    }

    private func requireCurrent(_ revision: Int) throws {
        guard current(revision) else { throw CancellationError() }
    }

    private func retireAccess(_ revision: Int) {
        guard visible, generation == revision else { return }
        generation += 1
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
        clearPrivateData()
        guard isCurrent else {
            state = .error(message: "Your session changed. Reopen this Home to continue.")
            return
        }
        do {
            let opening = try await authority.read()
            try requireCurrent(revision)
            guard let currentAccess = opening.access, currentAccess.can("home.view") else {
                // Only the exact task collection can admit private first use or
                // a separately granted task route. No inferred owner capability.
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
                return
            }
            var detail: HomeDetail?
            var dashboard: HomeDashboardResponse?
            // Typed task groups preserve the prior iOS runtime-crash repair.
            try await withThrowingTaskGroup(of: CoreReadResult.self) { group in
                group.addTask { [self] in
                    let result: HomeDetailResponse = try await api.request(HomesEndpoints.detail(homeId: homeId))
                    return .detail(result.home)
                }
                group.addTask { [self] in
                    let result: HomeDashboardResponse = try await api.request(HomeDashboardEndpoints.dashboard(homeId: homeId))
                    return .dashboard(result)
                }
                for try await result in group {
                    switch result {
                    case let .detail(value): detail = value
                    case let .dashboard(value): dashboard = value
                    }
                }
            }
            try requireCurrent(revision)
            guard let detail, let dashboard, detail.base.id == homeId, dashboard.home?.id == homeId,
                  Set(dashboard.myAccess?.permissions ?? []) == Set(currentAccess.permissions),
                  dashboard.myAccess?.isOwner == currentAccess.isOwner else { throw APIError.invalidResponse }
            let collection = currentAccess.can("tasks.view") ? try? await HomeTaskAccess(homeId: homeId, api: api).list() : nil
            try requireCurrent(revision)
            let final = try await authority.read()
            try requireCurrent(revision)
            guard final.fingerprint == opening.fingerprint else { throw APIError.invalidResponse }
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
        } catch {
            guard visible, revision == generation else { return }
            clearPrivateData()
            state = .error(message: "Current Home information could not be confirmed. Reload to try again.")
        }
    }

    private enum CoreReadResult {
        case detail(HomeDetail)
        case dashboard(HomeDashboardResponse)
    }

    private func authorize(_ revision: Int) async throws {
        try requireCurrent(revision)
        guard let accessFingerprint else { throw APIError.forbidden }
        let snapshot = try await authority.read()
        try requireCurrent(revision)
        guard snapshot.access?.can("home.view") == true, snapshot.fingerprint == accessFingerprint else {
            throw APIError.forbidden
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
                let value = try await self.api.request(
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
            let value = try await self.api.request(
                HomeDashboardEndpoints.seasonalChecklist(homeId: self.homeId),
                as: SeasonalChecklistDTO.self
            )
            guard HomeIntelligenceValidation.checklist(value, homeId: self.homeId) else { throw APIError.invalidResponse }
            return value
        }) else { return }
        checklist = result
    }

    private func loadPropertyValue() async {
        guard let result = await authorizedCard(permissions: ["home.view"], {
            let value = try await self.api.request(
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
    func generateChecklist() async {
        checklist = .loading
        await loadChecklist()
    }

    /// Re-reads only the health score (used after a checklist mutation and
    /// on card-level Retry).
    func refreshHealthScore() async {
        healthScore = .loading
        await loadHealthScore()
    }

    func retryPropertyValue() async {
        propertyValue = .loading
        await loadPropertyValue()
    }

    func retryBillTrends() async {
        billTrends = .loading
        await loadBillTrends()
    }

    func selectBillCurrency(_ currency: String) async {
        guard currency != billCurrency, billCurrencies.contains(currency) else { return }
        billCurrency = currency
        billTrends = .loading
        await loadBillTrends()
    }

    private func updateChecklistItem(_ itemId: String, status: String) async {
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
                    claimWindowEndsAt: detailData.claimWindowEndsAt
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
        let counts = dashboardData?.counts
        return HomeDashboardContent(
            address: address,
            verified: verified,
            isVerifiedOwner: isVerifiedOwner,
            stats: HomeDashboardProjection.stats(counts: counts).filter {
                let permission = ["packages": "packages.view", "bills": "finance.view", "tasks": "tasks.view"][$0.id]
                return permission.map(can) ?? false
            },
            quickActions: HomeDashboardProjection.quickActions(counts: counts, access: access),
            tabs: HomeDashboardProjection.gatedTabs(access: access),
            overview: HomeDashboardProjection.overview(
                dashboard: dashboardData,
                health: healthScore.value
            ),
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
    static func securityBanner(
        state: HomeSecurityState,
        claimWindowEndsAt: String?
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
                ctaLabel: "Invite Co-Owner",
                action: .inviteCoOwner
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
