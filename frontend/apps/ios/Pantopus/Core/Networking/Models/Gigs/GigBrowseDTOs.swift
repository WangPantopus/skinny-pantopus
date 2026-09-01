//
//  GigBrowseDTOs.swift
//  Pantopus
//
//  Decoder shapes for `GET /api/gigs/browse` (backend/routes/gigs.js:3190).
//  Browse rows come straight off the `find_gigs_nearby_v2` RPC (snake_case,
//  `distance_meters`, no bid counts) enriched with `first_image`; clusters
//  come from `services/gig/clusterService.js`.
//

import Foundation

/// Top-level envelope from `GET /api/gigs/browse`.
public struct GigsBrowseResponse: Decodable, Sendable {
    public let sections: GigsBrowseSections
    public let totalActive: Int?
    public let radiusUsed: Int?

    enum CodingKeys: String, CodingKey {
        case sections
        case totalActive = "total_active"
        case radiusUsed = "radius_used"
    }

    public init(sections: GigsBrowseSections, totalActive: Int?, radiusUsed: Int?) {
        self.sections = sections
        self.totalActive = totalActive
        self.radiusUsed = radiusUsed
    }
}

/// The six browse sections. Every array may be empty — sections render
/// only when non-empty.
public struct GigsBrowseSections: Decodable, Sendable {
    public let bestMatches: [BrowseGigDTO]
    public let urgent: [BrowseGigDTO]
    public let clusters: [GigClusterDTO]
    public let highPaying: [BrowseGigDTO]
    public let newToday: [BrowseGigDTO]
    public let quickJobs: [BrowseGigDTO]

    enum CodingKeys: String, CodingKey {
        case bestMatches = "best_matches"
        case urgent
        case clusters
        case highPaying = "high_paying"
        case newToday = "new_today"
        case quickJobs = "quick_jobs"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        bestMatches = try c.decodeIfPresent([BrowseGigDTO].self, forKey: .bestMatches) ?? []
        urgent = try c.decodeIfPresent([BrowseGigDTO].self, forKey: .urgent) ?? []
        clusters = try c.decodeIfPresent([GigClusterDTO].self, forKey: .clusters) ?? []
        highPaying = try c.decodeIfPresent([BrowseGigDTO].self, forKey: .highPaying) ?? []
        newToday = try c.decodeIfPresent([BrowseGigDTO].self, forKey: .newToday) ?? []
        quickJobs = try c.decodeIfPresent([BrowseGigDTO].self, forKey: .quickJobs) ?? []
    }

    public init(
        bestMatches: [BrowseGigDTO] = [],
        urgent: [BrowseGigDTO] = [],
        clusters: [GigClusterDTO] = [],
        highPaying: [BrowseGigDTO] = [],
        newToday: [BrowseGigDTO] = [],
        quickJobs: [BrowseGigDTO] = []
    ) {
        self.bestMatches = bestMatches
        self.urgent = urgent
        self.clusters = clusters
        self.highPaying = highPaying
        self.newToday = newToday
        self.quickJobs = quickJobs
    }
}

/// One gig inside a browse section. Mirrors the RPC row shape — note
/// `distance_meters` (Int meters) rather than the list route's
/// `distance_miles`, and no bid count.
public struct BrowseGigDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let description: String?
    public let price: Double?
    public let category: String?
    public let deadline: String?
    public let userId: String?
    public let status: String?
    public let createdAt: String?
    public let distanceMeters: Double?
    public let isUrgent: Bool?
    public let tags: [String]?
    public let scheduledStart: String?
    /// First attachment URL the backend extracts for thumbnails — URL or null.
    public let firstImage: String?
    public let exactCity: String?
    public let exactState: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, price, category, deadline, status, tags
        case userId = "user_id"
        case createdAt = "created_at"
        case distanceMeters = "distance_meters"
        case isUrgent = "is_urgent"
        case scheduledStart = "scheduled_start"
        case firstImage = "first_image"
        case exactCity = "exact_city"
        case exactState = "exact_state"
    }

    public init(
        id: String,
        title: String,
        description: String? = nil,
        price: Double? = nil,
        category: String? = nil,
        deadline: String? = nil,
        userId: String? = nil,
        status: String? = nil,
        createdAt: String? = nil,
        distanceMeters: Double? = nil,
        isUrgent: Bool? = nil,
        tags: [String]? = nil,
        scheduledStart: String? = nil,
        firstImage: String? = nil,
        exactCity: String? = nil,
        exactState: String? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.price = price
        self.category = category
        self.deadline = deadline
        self.userId = userId
        self.status = status
        self.createdAt = createdAt
        self.distanceMeters = distanceMeters
        self.isUrgent = isUrgent
        self.tags = tags
        self.scheduledStart = scheduledStart
        self.firstImage = firstImage
        self.exactCity = exactCity
        self.exactState = exactState
    }
}

/// One category cluster from the browse `clusters` array
/// (`services/gig/clusterService.js getGigClusters`).
public struct GigClusterDTO: Decodable, Sendable, Hashable {
    public let category: String
    public let count: Int
    public let priceMin: Double?
    public let priceMax: Double?
    public let priceAvg: Double?
    /// Meters to the closest gig in the cluster.
    public let nearestDistance: Double?
    public let newestAt: String?
    public let representativeTitle: String?

    enum CodingKeys: String, CodingKey {
        case category, count
        case priceMin = "price_min"
        case priceMax = "price_max"
        case priceAvg = "price_avg"
        case nearestDistance = "nearest_distance"
        case newestAt = "newest_at"
        case representativeTitle = "representative_title"
    }

    public init(
        category: String,
        count: Int,
        priceMin: Double? = nil,
        priceMax: Double? = nil,
        priceAvg: Double? = nil,
        nearestDistance: Double? = nil,
        newestAt: String? = nil,
        representativeTitle: String? = nil
    ) {
        self.category = category
        self.count = count
        self.priceMin = priceMin
        self.priceMax = priceMax
        self.priceAvg = priceAvg
        self.nearestDistance = nearestDistance
        self.newestAt = newestAt
        self.representativeTitle = representativeTitle
    }
}

// MARK: - Price benchmark

/// Envelope from `GET /api/gigs/price-benchmark`. `benchmark` is null
/// when the category has no data and no regional default.
public struct GigPriceBenchmarkResponse: Decodable, Sendable {
    public let benchmark: GigPriceBenchmarkDTO?
}

/// Low/median/high benchmark for a category
/// (`services/gig/gigPricingService.js getGigPriceBenchmark`).
public struct GigPriceBenchmarkDTO: Decodable, Sendable, Hashable {
    public let low: Double
    public let median: Double
    public let high: Double
    /// Human-readable basis line, e.g. "Based on 42 completed handyman
    /// tasks" or "Estimated average for handyman".
    public let basis: String?
    public let comparableCount: Int?
    public let category: String?

    enum CodingKeys: String, CodingKey {
        case low, median, high, basis, category
        case comparableCount = "comparable_count"
    }

    public init(
        low: Double,
        median: Double,
        high: Double,
        basis: String? = nil,
        comparableCount: Int? = nil,
        category: String? = nil
    ) {
        self.low = low
        self.median = median
        self.high = high
        self.basis = basis
        self.comparableCount = comparableCount
        self.category = category
    }
}

// MARK: - Realtime

/// Socket payload for the global `gig:new` broadcast emitted on gig
/// creation (`backend/routes/gigs.js:1080`). Decoded by `SocketClient`,
/// which applies `convertFromSnakeCase` — no explicit CodingKeys.
public struct GigNewEvent: Decodable, Sendable, Hashable {
    public let id: String
    public let title: String?
    public let category: String?
    public let price: Double?
    public let createdAt: String?
    public let userId: String?

    public init(
        id: String,
        title: String? = nil,
        category: String? = nil,
        price: Double? = nil,
        createdAt: String? = nil,
        userId: String? = nil
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.price = price
        self.createdAt = createdAt
        self.userId = userId
    }
}
