//
//  TransactionReviewsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/transactionReviews.js` — marketplace
//  transaction reviews tied to a completed listing sale / trade / gig.
//  Distinct from the gig-only review surface in `ReviewsEndpoints.swift`:
//  different table (`TransactionReview`), multi-criteria ratings, and a
//  per-context id (offer / trade / gig). Mounted at
//  `/api/transaction-reviews` (`backend/app.js:336`).
//

import Foundation

/// The `review_context` buckets the backend validates against.
public enum TransactionReviewContext: String, Sendable, Hashable {
    case listingSale = "listing_sale"
    case listingTrade = "listing_trade"
    case gig

    /// snake_case wire value sent in the POST body.
    public var wireValue: String {
        rawValue
    }

    /// Short label for the received-reviews row chip.
    public var shortLabel: String {
        switch self {
        case .listingSale: "Sale"
        case .listingTrade: "Trade"
        case .gig: "Gig"
        }
    }

    public static func fromRaw(_ raw: String?) -> TransactionReviewContext? {
        switch (raw ?? "").lowercased() {
        case "listing_sale": .listingSale
        case "listing_trade": .listingTrade
        case "gig": .gig
        default: nil
        }
    }
}

/// Endpoints under `/api/transaction-reviews/*`.
public enum TransactionReviewsEndpoints {
    /// `POST /api/transaction-reviews` — create a transaction review.
    /// Backend rules (`backend/routes/transactionReviews.js:43`): the
    /// transaction must be `completed`, the reviewer must be a party to it,
    /// and only one review per reviewer + offer/gig is allowed (the
    /// duplicate surfaces as a `409`).
    public static func create(body: CreateTransactionReviewBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/transaction-reviews", body: body)
    }

    /// `GET /api/transaction-reviews/user/:userId` — reviews received by a
    /// user (public). Route `backend/routes/transactionReviews.js:168`.
    public static func userReviews(userId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/transaction-reviews/user/\(userId)")
    }
}

/// Body for `POST /api/transaction-reviews`. Mirrors the backend's keys
/// (snake_case wire format). `offerId` is required for `listing_sale`; the
/// three sub-ratings are optional and omitted (sent as `null`) when unset.
public struct CreateTransactionReviewBody: Encodable, Sendable {
    public let reviewedId: String
    public let context: String
    public let listingId: String?
    public let offerId: String?
    public let tradeId: String?
    public let gigId: String?
    public let rating: Int
    public let comment: String?
    public let communicationRating: Int?
    public let accuracyRating: Int?
    public let punctualityRating: Int?

    public init(
        reviewedId: String,
        context: String,
        listingId: String? = nil,
        offerId: String? = nil,
        tradeId: String? = nil,
        gigId: String? = nil,
        rating: Int,
        comment: String? = nil,
        communicationRating: Int? = nil,
        accuracyRating: Int? = nil,
        punctualityRating: Int? = nil
    ) {
        self.reviewedId = reviewedId
        self.context = context
        self.listingId = listingId
        self.offerId = offerId
        self.tradeId = tradeId
        self.gigId = gigId
        self.rating = rating
        self.comment = comment
        self.communicationRating = communicationRating
        self.accuracyRating = accuracyRating
        self.punctualityRating = punctualityRating
    }

    enum CodingKeys: String, CodingKey {
        case reviewedId = "reviewed_id"
        case context
        case listingId = "listing_id"
        case offerId = "offer_id"
        case tradeId = "trade_id"
        case gigId = "gig_id"
        case rating
        case comment
        case communicationRating = "communication_rating"
        case accuracyRating = "accuracy_rating"
        case punctualityRating = "punctuality_rating"
    }
}
