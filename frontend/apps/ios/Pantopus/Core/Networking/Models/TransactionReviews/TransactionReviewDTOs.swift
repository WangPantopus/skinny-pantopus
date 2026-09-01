//
//  TransactionReviewDTOs.swift
//  Pantopus
//
//  Decoder shapes for `GET /api/transaction-reviews/user/:userId`
//  (route `backend/routes/transactionReviews.js:168`). The handler returns
//  the received reviews plus the overall average + total count. The
//  per-criterion breakdown (communication / accuracy / punctuality) is
//  computed client-side from the individual rows — the backend doesn't
//  pre-aggregate it.
//

import Foundation

/// Envelope from `GET /api/transaction-reviews/user/:userId`.
public struct TransactionReviewsResponse: Decodable, Sendable {
    public let reviews: [TransactionReviewDTO]
    public let averageRating: Double
    public let total: Int

    public init(reviews: [TransactionReviewDTO], averageRating: Double, total: Int) {
        self.reviews = reviews
        self.averageRating = averageRating
        self.total = total
    }

    enum CodingKeys: String, CodingKey {
        case reviews
        case averageRating = "average_rating"
        case total
    }
}

/// One received transaction review. Carries the overall rating plus the
/// three optional sub-ratings and the inlined reviewer card.
public struct TransactionReviewDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let reviewerId: String?
    public let reviewedId: String?
    public let context: String?
    public let listingId: String?
    public let offerId: String?
    public let gigId: String?
    public let rating: Int
    public let comment: String?
    public let communicationRating: Int?
    public let accuracyRating: Int?
    public let punctualityRating: Int?
    public let isBuyer: Bool?
    public let createdAt: String?
    public let reviewer: TransactionReviewerDTO?

    public init(
        id: String,
        reviewerId: String? = nil,
        reviewedId: String? = nil,
        context: String? = nil,
        listingId: String? = nil,
        offerId: String? = nil,
        gigId: String? = nil,
        rating: Int,
        comment: String? = nil,
        communicationRating: Int? = nil,
        accuracyRating: Int? = nil,
        punctualityRating: Int? = nil,
        isBuyer: Bool? = nil,
        createdAt: String? = nil,
        reviewer: TransactionReviewerDTO? = nil
    ) {
        self.id = id
        self.reviewerId = reviewerId
        self.reviewedId = reviewedId
        self.context = context
        self.listingId = listingId
        self.offerId = offerId
        self.gigId = gigId
        self.rating = rating
        self.comment = comment
        self.communicationRating = communicationRating
        self.accuracyRating = accuracyRating
        self.punctualityRating = punctualityRating
        self.isBuyer = isBuyer
        self.createdAt = createdAt
        self.reviewer = reviewer
    }

    enum CodingKeys: String, CodingKey {
        case id, context, rating, comment, reviewer
        case reviewerId = "reviewer_id"
        case reviewedId = "reviewed_id"
        case listingId = "listing_id"
        case offerId = "offer_id"
        case gigId = "gig_id"
        case communicationRating = "communication_rating"
        case accuracyRating = "accuracy_rating"
        case punctualityRating = "punctuality_rating"
        case isBuyer = "is_buyer"
        case createdAt = "created_at"
    }
}

/// Inlined reviewer card on each received review — mirrors the columns the
/// backend enriches with (`first_name, last_name, username,
/// profile_picture_url`).
public struct TransactionReviewerDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let firstName: String?
    public let lastName: String?
    public let username: String?
    public let profilePictureUrl: String?

    public init(
        id: String,
        firstName: String? = nil,
        lastName: String? = nil,
        username: String? = nil,
        profilePictureUrl: String? = nil
    ) {
        self.id = id
        self.firstName = firstName
        self.lastName = lastName
        self.username = username
        self.profilePictureUrl = profilePictureUrl
    }

    enum CodingKeys: String, CodingKey {
        case id, username
        case firstName = "first_name"
        case lastName = "last_name"
        case profilePictureUrl = "profile_picture_url"
    }
}
