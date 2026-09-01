//
//  HomeDashboardDTOs.swift
//  Pantopus
//
//  DTOs for the Home dashboard aggregate and the Home Intelligence
//  endpoints under `backend/routes/home.js`:
//   - GET   /api/homes/:id/dashboard                     (line 6224)
//   - GET   /api/homes/:id/health-score                  (line 7482)
//   - GET   /api/homes/:id/seasonal-checklist            (line 7504)
//   - PATCH /api/homes/:id/seasonal-checklist/:itemId    (line 7577)
//   - GET   /api/homes/:id/bill-trends                   (line 7599)
//   - GET   /api/homes/:id/property-value                (line 7752)
//
//  The dashboard's sub-lists reuse the same column sets as the
//  standalone list endpoints (`backend/utils/columns.js`
//  `HOME_TASK_LIST` / `HOME_BILL_LIST` / `HOME_EVENT_LIST`), so this
//  file re-uses `HomeTaskDTO`, `BillDTO` and `CalendarEventDTO` rather
//  than redeclaring them.
//
// swiftlint:disable file_length

import Foundation

// MARK: - Dashboard aggregate

/// Response of `GET /api/homes/:id/dashboard`.
public struct HomeDashboardResponse: Decodable, Sendable, Hashable {
    public let home: HomeDashboardHomeDTO?
    public let myAccess: HomeDashboardAccessDTO?
    public let today: HomeDashboardTodayDTO
    public let counts: HomeDashboardCountsDTO
    public let members: [HomeDashboardMemberDTO]
    public let recentActivity: [HomeAuditLogEntryDTO]
    /// Only present when the caller passed `?include_health_score=true`.
    public let healthScore: HomeHealthScoreDTO?

    private enum CodingKeys: String, CodingKey {
        case home
        case myAccess
        case today
        case counts
        case members
        case recentActivity = "recent_activity"
        case healthScore = "health_score"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        home = try container.decodeIfPresent(HomeDashboardHomeDTO.self, forKey: .home)
        myAccess = try container.decodeIfPresent(HomeDashboardAccessDTO.self, forKey: .myAccess)
        today = try container.decodeIfPresent(HomeDashboardTodayDTO.self, forKey: .today)
            ?? HomeDashboardTodayDTO()
        counts = try container.decodeIfPresent(HomeDashboardCountsDTO.self, forKey: .counts)
            ?? HomeDashboardCountsDTO()
        members = try container.decodeIfPresent([HomeDashboardMemberDTO].self, forKey: .members) ?? []
        recentActivity = try container.decodeIfPresent(
            [HomeAuditLogEntryDTO].self,
            forKey: .recentActivity
        ) ?? []
        healthScore = try container.decodeIfPresent(HomeHealthScoreDTO.self, forKey: .healthScore)
    }
}

/// The subset of the `Home` record the dashboard header needs. The
/// backend returns `select('*')` — every other column is ignored.
public struct HomeDashboardHomeDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let name: String?
    public let address: String?
    public let city: String?
    public let state: String?
    public let homeType: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case address
        case city
        case state
        case homeType = "home_type"
    }
}

/// `myAccess` — the caller's permission bag for this home.
public struct HomeDashboardAccessDTO: Decodable, Sendable, Hashable {
    public let permissions: [String]?
    public let roleBase: String?
    public let isOwner: Bool?

    private enum CodingKeys: String, CodingKey {
        case permissions
        case roleBase = "role_base"
        case isOwner
    }

    /// Mirrors the backend's `canFinance` gate (`home.js:6238`).
    public var canViewFinance: Bool {
        if isOwner == true { return true }
        let perms = Set(permissions ?? [])
        return perms.contains("finance.view") || perms.contains("finance.manage")
    }
}

/// `today` block — the "what's happening now" slice.
public struct HomeDashboardTodayDTO: Decodable, Sendable, Hashable {
    public let nextEvents: [CalendarEventDTO]
    public let tasksDue: [HomeTaskDTO]
    public let nextBill: BillDTO?
    public let unreadMailCount: Int
    public let activeGuestPasses: Int
    public let deliveriesArriving: Int

    private enum CodingKeys: String, CodingKey {
        case nextEvents = "next_events"
        case tasksDue = "tasks_due"
        case nextBill = "next_bill"
        case unreadMailCount = "unread_mail_count"
        case activeGuestPasses = "active_guest_passes"
        case deliveriesArriving = "deliveries_arriving"
    }

    public init(
        nextEvents: [CalendarEventDTO] = [],
        tasksDue: [HomeTaskDTO] = [],
        nextBill: BillDTO? = nil,
        unreadMailCount: Int = 0,
        activeGuestPasses: Int = 0,
        deliveriesArriving: Int = 0
    ) {
        self.nextEvents = nextEvents
        self.tasksDue = tasksDue
        self.nextBill = nextBill
        self.unreadMailCount = unreadMailCount
        self.activeGuestPasses = activeGuestPasses
        self.deliveriesArriving = deliveriesArriving
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        nextEvents = try container.decodeIfPresent([CalendarEventDTO].self, forKey: .nextEvents) ?? []
        tasksDue = try container.decodeIfPresent([HomeTaskDTO].self, forKey: .tasksDue) ?? []
        nextBill = try container.decodeIfPresent(BillDTO.self, forKey: .nextBill)
        unreadMailCount = try container.decodeIfPresent(Int.self, forKey: .unreadMailCount) ?? 0
        activeGuestPasses = try container.decodeIfPresent(Int.self, forKey: .activeGuestPasses) ?? 0
        deliveriesArriving = try container.decodeIfPresent(Int.self, forKey: .deliveriesArriving) ?? 0
    }
}

/// `counts` block — the hero-stat / quick-action badge source.
public struct HomeDashboardCountsDTO: Decodable, Sendable, Hashable {
    public let tasksOpen: Int
    public let issuesOpen: Int
    public let billsDue: Int
    public let packagesExpected: Int
    public let documents: Int
    public let eventsUpcoming: Int
    public let membersActive: Int
    public let pets: Int

    private enum CodingKeys: String, CodingKey {
        case tasksOpen = "tasks_open"
        case issuesOpen = "issues_open"
        case billsDue = "bills_due"
        case packagesExpected = "packages_expected"
        case documents
        case eventsUpcoming = "events_upcoming"
        case membersActive = "members_active"
        case pets
    }

    public init(
        tasksOpen: Int = 0,
        issuesOpen: Int = 0,
        billsDue: Int = 0,
        packagesExpected: Int = 0,
        documents: Int = 0,
        eventsUpcoming: Int = 0,
        membersActive: Int = 0,
        pets: Int = 0
    ) {
        self.tasksOpen = tasksOpen
        self.issuesOpen = issuesOpen
        self.billsDue = billsDue
        self.packagesExpected = packagesExpected
        self.documents = documents
        self.eventsUpcoming = eventsUpcoming
        self.membersActive = membersActive
        self.pets = pets
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        tasksOpen = try container.decodeIfPresent(Int.self, forKey: .tasksOpen) ?? 0
        issuesOpen = try container.decodeIfPresent(Int.self, forKey: .issuesOpen) ?? 0
        billsDue = try container.decodeIfPresent(Int.self, forKey: .billsDue) ?? 0
        packagesExpected = try container.decodeIfPresent(Int.self, forKey: .packagesExpected) ?? 0
        documents = try container.decodeIfPresent(Int.self, forKey: .documents) ?? 0
        eventsUpcoming = try container.decodeIfPresent(Int.self, forKey: .eventsUpcoming) ?? 0
        membersActive = try container.decodeIfPresent(Int.self, forKey: .membersActive) ?? 0
        pets = try container.decodeIfPresent(Int.self, forKey: .pets) ?? 0
    }
}

/// One entry of the dashboard `members` array (HomeOccupancy + user join,
/// enriched with the HomeOwner status).
public struct HomeDashboardMemberDTO: Decodable, Sendable, Hashable {
    public let userId: String?
    public let role: String?
    public let displayRole: String?
    public let user: HomeDashboardMemberUserDTO?

    private enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case role
        case displayRole = "display_role"
        case user
    }
}

/// Nested `user` join on a dashboard member row.
public struct HomeDashboardMemberUserDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let username: String?
    public let name: String?
    public let profilePictureUrl: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case username
        case name
        case profilePictureUrl = "profile_picture_url"
    }
}

/// One `HomeAuditLog` row from `recent_activity`.
public struct HomeAuditLogEntryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let actorUserId: String?
    public let action: String
    public let targetType: String?
    public let targetId: String?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case actorUserId = "actor_user_id"
        case action
        case targetType = "target_type"
        case targetId = "target_id"
        case createdAt = "created_at"
    }
}

// MARK: - Health score

/// Response of `GET /api/homes/:id/health-score`
/// (`backend/services/homeHealthService.js:253`). Field names are already
/// camelCase on the wire — the service builds the object by hand.
public struct HomeHealthScoreDTO: Decodable, Sendable, Hashable {
    public let score: Int
    public let breakdown: [String: HomeHealthDimensionDTO]
    public let topIssue: String?
    public let topAction: HomeHealthActionDTO?

    /// Fixed dimension order used by the breakdown list, matching the
    /// weights declared in `homeHealthService.js:14`.
    public static let dimensionOrder = [
        "maintenance", "bills", "seasonal", "emergency", "household", "documents"
    ]

    /// True when the score is a "brand new home" zero — every dimension
    /// scored nothing. Drives the onboarding variant of the ring.
    public var isBrandNewHome: Bool {
        score == 0 && !breakdown.isEmpty && breakdown.values.allSatisfy { $0.score == 0 }
    }

    public init(
        score: Int,
        breakdown: [String: HomeHealthDimensionDTO],
        topIssue: String?,
        topAction: HomeHealthActionDTO?
    ) {
        self.score = score
        self.breakdown = breakdown
        self.topIssue = topIssue
        self.topAction = topAction
    }
}

/// One dimension of the health-score breakdown.
public struct HomeHealthDimensionDTO: Decodable, Sendable, Hashable {
    public let score: Int
    public let max: Int
    public let issues: [String]

    public init(score: Int, max: Int, issues: [String]) {
        self.score = score
        self.max = max
        self.issues = issues
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        score = try container.decodeIfPresent(Int.self, forKey: .score) ?? 0
        max = try container.decodeIfPresent(Int.self, forKey: .max) ?? 0
        issues = try container.decodeIfPresent([String].self, forKey: .issues) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case score
        case max
        case issues
    }
}

/// `topAction` — the single highest-leverage next step.
public struct HomeHealthActionDTO: Decodable, Sendable, Hashable {
    public let type: String
    public let label: String
    /// App route such as `/homes/<id>/maintenance`
    /// (`homeHealthService.js:129`).
    public let route: String

    public init(type: String, label: String, route: String) {
        self.type = type
        self.label = label
        self.route = route
    }
}

// MARK: - Seasonal checklist

/// Response of `GET /api/homes/:id/seasonal-checklist`.
public struct SeasonalChecklistDTO: Decodable, Sendable, Hashable {
    public let season: SeasonalChecklistSeasonDTO
    public let items: [SeasonalChecklistItemDTO]
    public let progress: SeasonalChecklistProgressDTO
    public let carryover: SeasonalChecklistCarryoverDTO?

    public init(
        season: SeasonalChecklistSeasonDTO,
        items: [SeasonalChecklistItemDTO],
        progress: SeasonalChecklistProgressDTO,
        carryover: SeasonalChecklistCarryoverDTO? = nil
    ) {
        self.season = season
        self.items = items
        self.progress = progress
        self.carryover = carryover
    }
}

public struct SeasonalChecklistSeasonDTO: Decodable, Sendable, Hashable {
    public let key: String
    public let label: String

    public init(key: String, label: String) {
        self.key = key
        self.label = label
    }
}

public struct SeasonalChecklistProgressDTO: Decodable, Sendable, Hashable {
    public let total: Int
    public let completed: Int
    public let percentage: Int

    public init(total: Int, completed: Int, percentage: Int) {
        self.total = total
        self.completed = completed
        self.percentage = percentage
    }
}

public struct SeasonalChecklistCarryoverDTO: Decodable, Sendable, Hashable {
    public let season: SeasonalChecklistSeasonDTO
    public let items: [SeasonalChecklistItemDTO]

    public init(season: SeasonalChecklistSeasonDTO, items: [SeasonalChecklistItemDTO]) {
        self.season = season
        self.items = items
    }
}

/// One `HomeSeasonalChecklistItem` row. Also the response body of
/// `PATCH /api/homes/:id/seasonal-checklist/:itemId`.
public struct SeasonalChecklistItemDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let seasonKey: String?
    public let year: Int?
    public let itemKey: String?
    public let title: String
    public let description: String?
    public let gigCategory: String?
    public let gigTitleSuggestion: String?
    /// `pending` / `completed` / `skipped` / `hired`.
    public let status: String
    public let completedAt: String?
    public let gigId: String?
    public let sortOrder: Int

    private enum CodingKeys: String, CodingKey {
        case id
        case seasonKey = "season_key"
        case year
        case itemKey = "item_key"
        case title
        case description
        case gigCategory = "gig_category"
        case gigTitleSuggestion = "gig_title_suggestion"
        case status
        case completedAt = "completed_at"
        case gigId = "gig_id"
        case sortOrder = "sort_order"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        seasonKey = try container.decodeIfPresent(String.self, forKey: .seasonKey)
        year = try container.decodeIfPresent(Int.self, forKey: .year)
        itemKey = try container.decodeIfPresent(String.self, forKey: .itemKey)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        description = try container.decodeIfPresent(String.self, forKey: .description)
        gigCategory = try container.decodeIfPresent(String.self, forKey: .gigCategory)
        gigTitleSuggestion = try container.decodeIfPresent(String.self, forKey: .gigTitleSuggestion)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "pending"
        completedAt = try container.decodeIfPresent(String.self, forKey: .completedAt)
        gigId = try container.decodeIfPresent(String.self, forKey: .gigId)
        sortOrder = try container.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0
    }

    public init(
        id: String,
        seasonKey: String? = nil,
        year: Int? = nil,
        itemKey: String? = nil,
        title: String,
        description: String? = nil,
        gigCategory: String? = nil,
        gigTitleSuggestion: String? = nil,
        status: String,
        completedAt: String? = nil,
        gigId: String? = nil,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.seasonKey = seasonKey
        self.year = year
        self.itemKey = itemKey
        self.title = title
        self.description = description
        self.gigCategory = gigCategory
        self.gigTitleSuggestion = gigTitleSuggestion
        self.status = status
        self.completedAt = completedAt
        self.gigId = gigId
        self.sortOrder = sortOrder
    }

    /// Items that are done in any sense — completed, skipped, or hired out.
    public var isResolved: Bool {
        status == "completed" || status == "skipped" || status == "hired"
    }
}

// MARK: - Property value

/// Response of `GET /api/homes/:id/property-value`.
public struct HomePropertyValueDTO: Decodable, Sendable, Hashable {
    public let estimatedValue: Double?
    public let valueRangeLow: Double?
    public let valueRangeHigh: Double?
    public let valueConfidence: Double?
    /// `up` / `down` / `flat` / nil.
    public let zipMedianSalePriceTrend: String?
    public let yearBuilt: Int?
    public let sqft: Int?
    public let lastUpdated: String?
    /// `cache` / `unavailable` / `error` / nil.
    public let source: String?

    private enum CodingKeys: String, CodingKey {
        case estimatedValue = "estimated_value"
        case valueRangeLow = "value_range_low"
        case valueRangeHigh = "value_range_high"
        case valueConfidence = "value_confidence"
        case zipMedianSalePriceTrend = "zip_median_sale_price_trend"
        case yearBuilt = "year_built"
        case sqft
        case lastUpdated = "last_updated"
        case source
    }

    public init(
        estimatedValue: Double?,
        valueRangeLow: Double? = nil,
        valueRangeHigh: Double? = nil,
        valueConfidence: Double? = nil,
        zipMedianSalePriceTrend: String? = nil,
        yearBuilt: Int? = nil,
        sqft: Int? = nil,
        lastUpdated: String? = nil,
        source: String? = nil
    ) {
        self.estimatedValue = estimatedValue
        self.valueRangeLow = valueRangeLow
        self.valueRangeHigh = valueRangeHigh
        self.valueConfidence = valueConfidence
        self.zipMedianSalePriceTrend = zipMedianSalePriceTrend
        self.yearBuilt = yearBuilt
        self.sqft = sqft
        self.lastUpdated = lastUpdated
        self.source = source
    }
}

// MARK: - Bill trends

/// Response of `GET /api/homes/:id/bill-trends`.
public struct HomeBillTrendsDTO: Decodable, Sendable, Hashable {
    /// `bill_type` → parallel `months` / `amounts` arrays.
    public let billsByType: [String: HomeBillTrendSeriesDTO]
    /// `bill_type` → neighbourhood benchmark (or an insufficient-data flag).
    public let benchmarks: [String: HomeBillBenchmarkDTO]
    public let billBenchmarkOptIn: Bool

    private enum CodingKeys: String, CodingKey {
        case billsByType = "bills_by_type"
        case benchmarks
        case billBenchmarkOptIn = "bill_benchmark_opt_in"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        billsByType = try container.decodeIfPresent(
            [String: HomeBillTrendSeriesDTO].self,
            forKey: .billsByType
        ) ?? [:]
        benchmarks = try container.decodeIfPresent(
            [String: HomeBillBenchmarkDTO].self,
            forKey: .benchmarks
        ) ?? [:]
        billBenchmarkOptIn = try container.decodeIfPresent(Bool.self, forKey: .billBenchmarkOptIn) ?? false
    }

    public init(
        billsByType: [String: HomeBillTrendSeriesDTO],
        benchmarks: [String: HomeBillBenchmarkDTO],
        billBenchmarkOptIn: Bool
    ) {
        self.billsByType = billsByType
        self.benchmarks = benchmarks
        self.billBenchmarkOptIn = billBenchmarkOptIn
    }
}

/// One `bills_by_type` series. `months` are `YYYY-MM` keys, newest first
/// (the query orders `period_start` descending).
public struct HomeBillTrendSeriesDTO: Decodable, Sendable, Hashable {
    public let months: [String]
    public let amounts: [Double]

    public init(months: [String], amounts: [Double]) {
        self.months = months
        self.amounts = amounts
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        months = try container.decodeIfPresent([String].self, forKey: .months) ?? []
        amounts = try container.decodeIfPresent([Double].self, forKey: .amounts) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case months
        case amounts
    }
}

/// One `benchmarks` entry. The backend emits two shapes on the same key:
/// a full benchmark (household_count >= 10) or an insufficient-data flag
/// (3..9 households) — see `home.js:7665`.
public struct HomeBillBenchmarkDTO: Decodable, Sendable, Hashable {
    public let months: [String]
    /// Neighbourhood average in **cents** (`BillBenchmark.avg_amount_cents`).
    public let avgAmounts: [Double]
    public let householdCount: Int?
    public let insufficientData: Bool
    public let needed: Int?
    public let message: String?

    private enum CodingKeys: String, CodingKey {
        case months
        case avgAmounts = "avg_amounts"
        case householdCount = "household_count"
        case insufficientData = "insufficient_data"
        case needed
        case message
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        months = try container.decodeIfPresent([String].self, forKey: .months) ?? []
        avgAmounts = try container.decodeIfPresent([Double].self, forKey: .avgAmounts) ?? []
        householdCount = try container.decodeIfPresent(Int.self, forKey: .householdCount)
        insufficientData = try container.decodeIfPresent(Bool.self, forKey: .insufficientData) ?? false
        needed = try container.decodeIfPresent(Int.self, forKey: .needed)
        message = try container.decodeIfPresent(String.self, forKey: .message)
    }

    public init(
        months: [String] = [],
        avgAmounts: [Double] = [],
        householdCount: Int? = nil,
        insufficientData: Bool = false,
        needed: Int? = nil,
        message: String? = nil
    ) {
        self.months = months
        self.avgAmounts = avgAmounts
        self.householdCount = householdCount
        self.insufficientData = insufficientData
        self.needed = needed
        self.message = message
    }
}
