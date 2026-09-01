//
//  ProfileInsightsDTOs.swift
//  Pantopus
//
//  Monthly Receipt + Invite / referral progress. Shapes are the literal
//  return values of `backend/services/monthlyReceiptService.js:232` and
//  `backend/services/inviteRewardService.js:94`.
//

import Foundation

// MARK: - Monthly receipt

/// `GET /api/users/me/monthly-receipt` — route `backend/routes/users.js:2921`.
public struct MonthlyReceiptDTO: Decodable, Sendable, Hashable {
    public let period: Period
    public let earnings: Earnings
    public let spending: Spending
    public let marketplace: Marketplace
    public let community: Community
    public let reputation: Reputation
    public let highlight: String?

    public struct Period: Decodable, Sendable, Hashable {
        public let year: Int
        public let month: Int
        /// Pre-rendered "May 2026".
        public let label: String
    }

    public struct Earnings: Decodable, Sendable, Hashable {
        /// Cents — never re-derive, only format.
        public let totalCents: Int
        public let gigCount: Int
        public let topCategory: String?

        private enum CodingKeys: String, CodingKey {
            case totalCents = "total_cents"
            case gigCount = "gig_count"
            case topCategory = "top_category"
        }
    }

    public struct Spending: Decodable, Sendable, Hashable {
        public let totalCents: Int
        public let gigCount: Int

        private enum CodingKeys: String, CodingKey {
            case totalCents = "total_cents"
            case gigCount = "gig_count"
        }
    }

    public struct Marketplace: Decodable, Sendable, Hashable {
        public let listingsSold: Int
        public let listingsBought: Int
        public let freeItemsClaimed: Int

        private enum CodingKeys: String, CodingKey {
            case listingsSold = "listings_sold"
            case listingsBought = "listings_bought"
            case freeItemsClaimed = "free_items_claimed"
        }
    }

    public struct Community: Decodable, Sendable, Hashable {
        public let postsCreated: Int
        public let connectionsMade: Int
        public let neighborsHelped: Int

        private enum CodingKeys: String, CodingKey {
            case postsCreated = "posts_created"
            case connectionsMade = "connections_made"
            case neighborsHelped = "neighbors_helped"
        }
    }

    public struct Reputation: Decodable, Sendable, Hashable {
        public let currentRating: Double?
        public let reviewsReceived: Int
        public let ratingChange: Double?

        private enum CodingKeys: String, CodingKey {
            case currentRating = "current_rating"
            case reviewsReceived = "reviews_received"
            case ratingChange = "rating_change"
        }
    }
}

// MARK: - Invite / referral progress

/// `GET /api/users/me/invite-progress` — route `backend/routes/users.js:2835`.
public struct InviteProgressDTO: Decodable, Sendable, Hashable {
    public let totalInvited: Int
    public let totalConverted: Int
    public let unlockedFeatures: [String]
    public let nextUnlock: NextUnlock?

    private enum CodingKeys: String, CodingKey {
        case totalInvited = "total_invited"
        case totalConverted = "total_converted"
        case unlockedFeatures = "unlocked_features"
        case nextUnlock = "next_unlock"
    }

    public struct NextUnlock: Decodable, Sendable, Hashable {
        public let feature: String
        public let label: String?
        public let invitesNeeded: Int
        public let invitesRemaining: Int

        private enum CodingKeys: String, CodingKey {
            case feature, label
            case invitesNeeded = "invites_needed"
            case invitesRemaining = "invites_remaining"
        }
    }
}

/// `GET /api/users/me/invite-code` — route `backend/routes/users.js:2850`.
public struct InviteCodeDTO: Decodable, Sendable, Hashable {
    public let inviteCode: String
    public let inviteUrl: String?

    private enum CodingKeys: String, CodingKey {
        case inviteCode = "invite_code"
        case inviteUrl = "invite_url"
    }
}
