//
//  HomeDashboardViewModel.swift
//  Pantopus
//
//  Fetches, concurrently:
//   - `GET /api/homes/:id` (detail, with a `/public-profile` fallback),
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
    /// Drives the claim-ownership banner gate: shown when this is false
    /// regardless of whether anyone else is a verified owner.
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
    var selectedTab: String = "overview"

    // MARK: - Home Intelligence (independent per-card state)

    private(set) var healthScore: HomeIntelligenceCardState<HomeHealthScoreDTO> = .loading
    private(set) var checklist: HomeIntelligenceCardState<SeasonalChecklistDTO> = .loading
    private(set) var propertyValue: HomeIntelligenceCardState<HomePropertyValueDTO> = .loading
    private(set) var billTrends: HomeIntelligenceCardState<HomeBillTrendsDTO> = .loading
    /// Checklist item ids with an in-flight PATCH — the row disables while
    /// its mutation is awaiting the server's returned item state.
    private(set) var pendingChecklistItemIds: Set<String> = []

    private let homeId: String
    private let api: APIClient

    // Raw responses; `rebuild()` composes the rendered content from them.
    private var detailData: HomeDetail?
    private var publicData: HomePublicProfileResponse.HomePublicProfile?
    private var dashboardData: HomeDashboardResponse?
    /// The viewer's own per-home access record. Gates the quick-action
    /// tiles + tab strip exactly as RN gates its dashboard cards.
    /// Best-effort: a 403 / offline read leaves this nil and the surface
    /// renders ungated rather than blank.
    private(set) var access: HomeAccessDTO?

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    /// Initial load; no-op when we already have content.
    func load() async {
        if isContentState { return }
        if let sampleState = HomeDashboardSampleData.state(for: homeId) {
            state = sampleState
            return
        }
        state = .loading
        await fetchAll()
    }

    /// Pull-to-refresh / retry.
    func refresh() async {
        if let sampleState = HomeDashboardSampleData.state(for: homeId) {
            state = sampleState
            return
        }
        await fetchAll()
    }

    private var isContentState: Bool {
        switch state {
        case .loaded, .empty, .needsAttention:
            true
        case .loading, .error:
            false
        }
    }

    // MARK: - Fetch

    private func fetchAll() async {
        async let core: Void = fetchCore()
        async let health: Void = loadHealthScore()
        async let seasonal: Void = loadChecklist()
        async let property: Void = loadPropertyValue()
        async let trends: Void = loadBillTrends()
        await core
        await health
        await seasonal
        await property
        await trends
    }

    /// Home detail (identity / ownership) + the dashboard aggregate +
    /// the viewer's access record.
    private func fetchCore() async {
        async let detailOutcome = loadDetail()
        async let dashboard = loadDashboard()
        async let myAccess = loadAccess()
        let outcome = await detailOutcome
        dashboardData = await dashboard
        access = await myAccess

        switch outcome {
        case let .detail(home):
            detailData = home
            publicData = nil
            rebuild()
        case .needsPublicProfile:
            await fetchPublicProfile()
        case let .failed(message):
            detailData = nil
            publicData = nil
            state = .error(message: message)
        }
    }

    private enum DetailOutcome {
        case detail(HomeDetail)
        case needsPublicProfile
        case failed(message: String)
    }

    private func loadDetail() async -> DetailOutcome {
        do {
            let response: HomeDetailResponse = try await api.request(HomesEndpoints.detail(homeId: homeId))
            return .detail(response.home)
        } catch APIError.forbidden, APIError.notFound {
            return .needsPublicProfile
        } catch {
            return .failed(message: (error as? APIError)?.errorDescription ?? "Couldn't load home.")
        }
    }

    private func loadDashboard() async -> HomeDashboardResponse? {
        try? await api.request(
            HomeDashboardEndpoints.dashboard(homeId: homeId),
            as: HomeDashboardResponse.self
        )
    }

    /// `GET /api/homes/:id/me` — route `backend/routes/homeIam.js:51`.
    /// Best-effort: a 403 here means "no access record", which must not
    /// fail the dashboard.
    private func loadAccess() async -> HomeAccessDTO? {
        let record = try? await api.request(
            HomeAdminEndpoints.myAccess(homeId: homeId),
            as: HomeAccessDTO.self
        )
        // The 403 body decodes into the same shape with hasAccess=false;
        // treat that as "unknown" so the surface stays ungated.
        guard let record, record.hasAccess else { return nil }
        return record
    }

    private func fetchPublicProfile() async {
        do {
            let response: HomePublicProfileResponse =
                try await api.request(HomesEndpoints.publicProfile(homeId: homeId))
            publicData = response.home
            detailData = nil
            rebuild()
        } catch {
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't load home.")
        }
    }

    // MARK: - Home Intelligence reads

    /// Mirrors RN's `useHomeIntelligence`, which always forces a server
    /// recompute so a stale zero-score can't mask a populated home.
    private func loadHealthScore() async {
        healthScore = await fetchCard {
            try await self.api.request(
                HomeDashboardEndpoints.healthScore(homeId: self.homeId, force: true),
                as: HomeHealthScoreDTO.self
            )
        }
        // The Overview's emergency row reads the health breakdown.
        rebuild()
    }

    private func loadChecklist() async {
        checklist = await fetchCard {
            try await self.api.request(
                HomeDashboardEndpoints.seasonalChecklist(homeId: self.homeId),
                as: SeasonalChecklistDTO.self
            )
        }
    }

    private func loadPropertyValue() async {
        propertyValue = await fetchCard {
            try await self.api.request(
                HomeDashboardEndpoints.propertyValue(homeId: self.homeId),
                as: HomePropertyValueDTO.self
            )
        }
    }

    private func loadBillTrends() async {
        billTrends = await fetchCard {
            try await self.api.request(
                HomeDashboardEndpoints.billTrends(homeId: self.homeId),
                as: HomeBillTrendsDTO.self
            )
        }
    }

    private func fetchCard<Value: Sendable>(
        _ work: () async throws -> Value
    ) async -> HomeIntelligenceCardState<Value> {
        do {
            let value = try await work()
            return .loaded(value)
        } catch APIError.forbidden {
            return .forbidden
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

    private func updateChecklistItem(_ itemId: String, status: String) async {
        guard !pendingChecklistItemIds.contains(itemId) else { return }
        pendingChecklistItemIds.insert(itemId)
        defer { pendingChecklistItemIds.remove(itemId) }

        do {
            let updated: SeasonalChecklistItemDTO = try await api.request(
                HomeDashboardEndpoints.updateSeasonalChecklistItem(
                    homeId: homeId,
                    itemId: itemId,
                    status: status
                )
            )
            // Reflect exactly what the server returned, then re-read the
            // score (seasonal progress is one of its six dimensions).
            applyChecklistItem(updated)
            await loadHealthScore()
        } catch {
            checklist = .failed(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't update that task. Try again."
            )
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
                verified: detailData.isOwner || detailData.owners.contains { $0.ownerStatus == "verified" },
                // Banner gate: I'm the verified owner only when isOwner is
                // true and there's no pending claim still in flight.
                isVerifiedOwner: detailData.isOwner && !detailData.isPendingOwner,
                securityBanner: Self.securityBanner(
                    state: detailData.securityState,
                    claimWindowEndsAt: detailData.claimWindowEndsAt
                )
            ))
        } else if let publicData {
            state = .loaded(content(
                address: publicData.address,
                verified: publicData.hasVerifiedOwner,
                // Public-profile path is hit when the user is NOT a verified
                // owner; the private detail call returned 403/404 first.
                isVerifiedOwner: false,
                // The public preview carries no security_state column.
                securityBanner: nil
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
            stats: HomeDashboardProjection.stats(counts: counts),
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
