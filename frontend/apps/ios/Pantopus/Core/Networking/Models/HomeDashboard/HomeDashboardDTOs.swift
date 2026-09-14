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
        home = try container.decode(HomeDashboardHomeDTO.self, forKey: .home)
        myAccess = try container.decode(HomeDashboardAccessDTO.self, forKey: .myAccess)
        today = try container.decode(HomeDashboardTodayDTO.self, forKey: .today)
        counts = try container.decode(HomeDashboardCountsDTO.self, forKey: .counts)
        members = try container.decode([HomeDashboardMemberDTO].self, forKey: .members)
        recentActivity = try container.decode([HomeAuditLogEntryDTO].self, forKey: .recentActivity)
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

    /// Only the effective view grant admits financial data.
    public var canViewFinance: Bool {
        permissions?.contains("finance.view") == true
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
        nextEvents = try container.decode([CalendarEventDTO].self, forKey: .nextEvents)
        tasksDue = try container.decode([HomeTaskDTO].self, forKey: .tasksDue)
        nextBill = try container.decodeIfPresent(BillDTO.self, forKey: .nextBill)
        unreadMailCount = try container.decode(Int.self, forKey: .unreadMailCount)
        activeGuestPasses = try container.decode(Int.self, forKey: .activeGuestPasses)
        deliveriesArriving = try container.decode(Int.self, forKey: .deliveriesArriving)
        guard [unreadMailCount, activeGuestPasses, deliveriesArriving].allSatisfy({ $0 >= 0 }) else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid Home counts"))
        }
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
        tasksOpen = try container.decode(Int.self, forKey: .tasksOpen)
        issuesOpen = try container.decode(Int.self, forKey: .issuesOpen)
        billsDue = try container.decode(Int.self, forKey: .billsDue)
        packagesExpected = try container.decode(Int.self, forKey: .packagesExpected)
        documents = try container.decode(Int.self, forKey: .documents)
        eventsUpcoming = try container.decode(Int.self, forKey: .eventsUpcoming)
        membersActive = try container.decode(Int.self, forKey: .membersActive)
        pets = try container.decode(Int.self, forKey: .pets)
        guard [tasksOpen, issuesOpen, billsDue, packagesExpected, documents, eventsUpcoming, membersActive, pets].allSatisfy({ $0 >= 0 })
        else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid Home counts"))
        }
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
    public let displayName: String?
    public let handle: String?
    public let avatarUrl: String?
    public let id: String?
    public let username: String?
    public let name: String?
    public let profilePictureUrl: String?

    private enum CodingKeys: String, CodingKey {
        case displayName, handle, avatarUrl
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
        score = try container.decode(Int.self, forKey: .score)
        max = try container.decode(Int.self, forKey: .max)
        issues = try container.decode([String].self, forKey: .issues)
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
    public let homeId: String?
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
        case homeId = "home_id"
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
        homeId = try container.decode(String.self, forKey: .homeId)
        seasonKey = try container.decodeIfPresent(String.self, forKey: .seasonKey)
        year = try container.decodeIfPresent(Int.self, forKey: .year)
        itemKey = try container.decodeIfPresent(String.self, forKey: .itemKey)
        title = try container.decode(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        gigCategory = try container.decodeIfPresent(String.self, forKey: .gigCategory)
        gigTitleSuggestion = try container.decodeIfPresent(String.self, forKey: .gigTitleSuggestion)
        status = try container.decode(String.self, forKey: .status)
        completedAt = try container.decodeIfPresent(String.self, forKey: .completedAt)
        gigId = try container.decodeIfPresent(String.self, forKey: .gigId)
        sortOrder = try container.decode(Int.self, forKey: .sortOrder)
    }

    public init(
        id: String,
        homeId: String? = nil,
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
        self.homeId = homeId
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
    public let currency: String?
    public let availableCurrencies: [String]
    public let formatVersion: Int?
    public let calculationVersion: Int?

    private enum CodingKeys: String, CodingKey {
        case billsByType = "bills_by_type"
        case benchmarks
        case currency
        case availableCurrencies = "available_currencies"
        case formatVersion = "format_version"
        case calculationVersion = "calculation_version"
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
        currency = try container.decodeIfPresent(String.self, forKey: .currency)
        availableCurrencies = try container.decodeIfPresent([String].self, forKey: .availableCurrencies) ?? []
        formatVersion = try container.decodeIfPresent(Int.self, forKey: .formatVersion)
        calculationVersion = try container.decodeIfPresent(Int.self, forKey: .calculationVersion)
    }

    public init(
        billsByType: [String: HomeBillTrendSeriesDTO],
        benchmarks: [String: HomeBillBenchmarkDTO],
        billBenchmarkOptIn: Bool,
        currency: String? = "USD",
        availableCurrencies: [String] = ["USD"],
        formatVersion: Int? = 2,
        calculationVersion: Int? = 2
    ) {
        self.billsByType = billsByType
        self.benchmarks = benchmarks
        self.billBenchmarkOptIn = billBenchmarkOptIn
        self.currency = currency
        self.availableCurrencies = availableCurrencies
        self.formatVersion = formatVersion
        self.calculationVersion = calculationVersion
    }
}

/// Format 2 uses unique chronological `YYYY-MM` keys and decimal major units.
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
    /// Format 2 neighbourhood average in decimal major units, in the response currency.
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
