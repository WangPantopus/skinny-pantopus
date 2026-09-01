//
//  GigsV2DTOs.swift
//  Pantopus
//
//  Wire shapes for the Gigs "v2" surfaces:
//
//  * `POST /api/gigs/:gigId/share-status`  (`backend/routes/gigsV2.js:244`)
//  * `GET  /api/v2/gigs/:gigId/offers`     (`backend/routes/offersV2.js:47`)
//  * `GET  /api/activities/support-trains/nearby`
//    (`backend/routes/supportTrains.js:570`) — the Tasks-feed scope
//    segmentation mixes nearby Support Trains into the gig feed, and that
//    handler answers straight from the `list_support_trains_nearby` RPC,
//    whose rows are keyed `support_train_id` (not `id`).
//

import Foundation

// MARK: - Share live status

/// `POST /api/gigs/:gigId/share-status` response. `share_url` is
/// `${APP_URL}/status/<token>`; `expires_at` is 24h out.
public struct GigShareStatusResponse: Decodable, Sendable, Hashable {
    public let shareUrl: String
    public let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case shareUrl = "share_url"
        case expiresAt = "expires_at"
    }

    public init(shareUrl: String, expiresAt: String? = nil) {
        self.shareUrl = shareUrl
        self.expiresAt = expiresAt
    }
}

// MARK: - Scored offers (v2)

/// `GET /api/v2/gigs/:gigId/offers` envelope.
public struct GigScoredOffersResponse: Decodable, Sendable {
    public let offers: [GigScoredOfferDTO]

    public init(offers: [GigScoredOfferDTO]) {
        self.offers = offers
    }
}

/// One ranked offer. The bid half mirrors `GigBidDTO`; the ranking half
/// (`match_score` / `match_rank` / `is_recommended`) plus the trust
/// capsule are what the v2 endpoint adds over `GET /:gigId/bids`.
public struct GigScoredOfferDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let gigId: String?
    public let userId: String?
    public let price: Double?
    public let amount: Double?
    public let message: String?
    public let availability: String?
    public let status: String?
    public let createdAt: String?
    public let bidder: GigCreator?
    /// 0–100 composite from `services/offerScoringService`.
    public let matchScore: Double?
    /// 1-based rank within the returned list.
    public let matchRank: Int?
    /// The server's single "best match" flag.
    public let isRecommended: Bool?
    public let trustCapsule: GigOfferTrustCapsuleDTO?

    enum CodingKeys: String, CodingKey {
        case id, price, amount, message, availability, status, bidder
        case gigId = "gig_id"
        case userId = "user_id"
        case createdAt = "created_at"
        case matchScore = "match_score"
        case matchRank = "match_rank"
        case isRecommended = "is_recommended"
        case trustCapsule = "trust_capsule"
    }

    public init(
        id: String,
        gigId: String? = nil,
        userId: String? = nil,
        price: Double? = nil,
        amount: Double? = nil,
        message: String? = nil,
        availability: String? = nil,
        status: String? = nil,
        createdAt: String? = nil,
        bidder: GigCreator? = nil,
        matchScore: Double? = nil,
        matchRank: Int? = nil,
        isRecommended: Bool? = nil,
        trustCapsule: GigOfferTrustCapsuleDTO? = nil
    ) {
        self.id = id
        self.gigId = gigId
        self.userId = userId
        self.price = price
        self.amount = amount
        self.message = message
        self.availability = availability
        self.status = status
        self.createdAt = createdAt
        self.bidder = bidder
        self.matchScore = matchScore
        self.matchRank = matchRank
        self.isRecommended = isRecommended
        self.trustCapsule = trustCapsule
    }

    /// The offer projected onto the shared bid shape the owner bids panel
    /// already renders, so the v2 path reuses accept / counter / reject
    /// unchanged.
    public var asBid: GigBidDTO {
        GigBidDTO(
            id: id,
            userId: userId,
            bidAmount: amount ?? price,
            amount: amount ?? price,
            status: status,
            message: message,
            createdAt: createdAt,
            bidder: bidder
        )
    }
}

/// Trust signals the v2 endpoint attaches to every offer.
public struct GigOfferTrustCapsuleDTO: Decodable, Sendable, Hashable {
    public let verified: Bool?
    public let firstName: String?
    public let averageRating: Double?
    public let reviewCount: Int?
    public let reliabilityScore: Double?
    public let gigsCompleted: Int?
    public let distanceMiles: Double?

    enum CodingKeys: String, CodingKey {
        case verified
        case firstName = "first_name"
        case averageRating = "average_rating"
        case reviewCount = "review_count"
        case reliabilityScore = "reliability_score"
        case gigsCompleted = "gigs_completed"
        case distanceMiles = "distance_miles"
    }

    public init(
        verified: Bool? = nil,
        firstName: String? = nil,
        averageRating: Double? = nil,
        reviewCount: Int? = nil,
        reliabilityScore: Double? = nil,
        gigsCompleted: Int? = nil,
        distanceMiles: Double? = nil
    ) {
        self.verified = verified
        self.firstName = firstName
        self.averageRating = averageRating
        self.reviewCount = reviewCount
        self.reliabilityScore = reliabilityScore
        self.gigsCompleted = gigsCompleted
        self.distanceMiles = distanceMiles
    }
}

/// Render-only ranking metadata for one offer, keyed by bid id on the
/// gig-detail view-model. Present only when the owner's list came from
/// the v2 endpoint; the `/bids` fallback leaves it empty.
public struct GigOfferRanking: Sendable, Hashable {
    public let matchScore: Double?
    public let matchRank: Int?
    public let isRecommended: Bool
    public let averageRating: Double?
    public let reviewCount: Int?
    public let gigsCompleted: Int?

    public init(
        matchScore: Double? = nil,
        matchRank: Int? = nil,
        isRecommended: Bool = false,
        averageRating: Double? = nil,
        reviewCount: Int? = nil,
        gigsCompleted: Int? = nil
    ) {
        self.matchScore = matchScore
        self.matchRank = matchRank
        self.isRecommended = isRecommended
        self.averageRating = averageRating
        self.reviewCount = reviewCount
        self.gigsCompleted = gigsCompleted
    }

    /// "4.9★ · 12 tasks" trust line; `nil` when nothing is known.
    public var trustLine: String? {
        var pieces: [String] = []
        if let averageRating {
            pieces.append(String(format: "%.1f★", averageRating))
        }
        if let reviewCount, reviewCount > 0 {
            pieces.append("\(reviewCount) review\(reviewCount == 1 ? "" : "s")")
        }
        if let gigsCompleted, gigsCompleted > 0 {
            pieces.append("\(gigsCompleted) task\(gigsCompleted == 1 ? "" : "s")")
        }
        return pieces.isEmpty ? nil : pieces.joined(separator: " · ")
    }
}

// MARK: - Nearby Support Trains (Tasks-feed scope segmentation)

/// `GET /api/activities/support-trains/nearby` envelope, decoded against
/// the **RPC** row shape the handler forwards verbatim
/// (`supabase/migrations/20260508000001_…sql:37` → `support_train_id`,
/// `activity_id`, `title`, `status`, `published_at`, `distance_meters`,
/// `open_slots_count`, `city`, `state`).
public struct GigsFeedNearbyTrainsResponse: Decodable, Sendable {
    public let supportTrains: [GigsFeedNearbyTrainDTO]

    enum CodingKeys: String, CodingKey {
        case supportTrains = "support_trains"
    }

    public init(supportTrains: [GigsFeedNearbyTrainDTO]) {
        self.supportTrains = supportTrains
    }
}

/// One nearby Support Train row for the Tasks feed.
public struct GigsFeedNearbyTrainDTO: Decodable, Sendable, Hashable, Identifiable {
    public let supportTrainId: String
    public let activityId: String?
    public let title: String?
    public let status: String?
    public let publishedAt: String?
    public let distanceMeters: Double?
    public let openSlotsCount: Int?
    public let city: String?
    public let state: String?

    public var id: String {
        supportTrainId
    }

    enum CodingKeys: String, CodingKey {
        case title, status, city, state
        case supportTrainId = "support_train_id"
        case activityId = "activity_id"
        case publishedAt = "published_at"
        case distanceMeters = "distance_meters"
        case openSlotsCount = "open_slots_count"
    }

    public init(
        supportTrainId: String,
        activityId: String? = nil,
        title: String? = nil,
        status: String? = nil,
        publishedAt: String? = nil,
        distanceMeters: Double? = nil,
        openSlotsCount: Int? = nil,
        city: String? = nil,
        state: String? = nil
    ) {
        self.supportTrainId = supportTrainId
        self.activityId = activityId
        self.title = title
        self.status = status
        self.publishedAt = publishedAt
        self.distanceMeters = distanceMeters
        self.openSlotsCount = openSlotsCount
        self.city = city
        self.state = state
    }
}
