//
//  OffersDTOs.swift
//  Pantopus
//
//  Decoder shapes for `/api/gigs/my-bids` and `/api/gigs/received-offers`.
//  The two responses are similar but not identical — the received-offers
//  payload also inlines the bidder user, and the my-bids payload exposes
//  the counter-offer + withdrawal fields we need to derive the row's
//  status chip.
//

import Foundation

// MARK: - Top-level responses

public struct MyBidsResponse: Decodable, Sendable {
    public let bids: [BidDTO]
    public let total: Int?

    enum CodingKeys: String, CodingKey {
        case bids, total
    }
}

public struct ReceivedOffersResponse: Decodable, Sendable {
    public let offers: [BidDTO]
    public let total: Int?

    enum CodingKeys: String, CodingKey {
        case offers, total
    }
}

// MARK: - Bid (shared shape across both endpoints)

/// One bid as returned by `/api/gigs/my-bids` and `/api/gigs/received-offers`.
/// The Sent endpoint omits `bidder` (the current user is the bidder); the
/// Received endpoint inlines the bidder's identity card. Counter / expiry
/// fields are present on the Sent payload only, but kept optional here so
/// the same DTO works for both tabs.
public struct BidDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let gigId: String?
    public let userId: String?
    public let bidAmount: Double?
    public let message: String?
    public let proposedTime: String?
    public let status: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let expiresAt: String?
    public let counterAmount: Double?
    public let counterStatus: String?
    public let counteredAt: String?
    public let withdrawnAt: String?
    public let withdrawalReason: String?
    public let gig: BidGigDTO?
    public let bidder: BidderUserDTO?

    // MARK: - P3 backend-prep fields (see docs/mobile/pantopus-t5-notes.md §1.10).

    // Optional decoders for the competition signals the buildout plan
    // promised. While the backend prep PR is still pending these come
    // back as `nil`, the row mapper falls back to the neutral "Pending"
    // chip. When the backend ships `shortlisted`, `your_rank`, and
    // `top_price`, the row mapper will start emitting the "Shortlisted",
    // "Top bid", and "Outbid" chips automatically — no code change.

    /// True when the gig poster has shortlisted this bid. Backend-driven
    /// signal; cannot be derived client-side from `my-bids` alone.
    public let shortlisted: Bool?
    /// 1-indexed rank of this bid against its peer bids on the same gig.
    /// `1` = highest bid (or by whatever ranking the buyer's perspective
    /// uses); `> 1` = outbid. Requires backend enrichment.
    public let yourRank: Int?
    /// Highest peer bid amount on the same gig. Combined with
    /// `your_rank`, surfaces the "Outbid" chip.
    public let topPrice: Double?

    public init(
        id: String,
        gigId: String? = nil,
        userId: String? = nil,
        bidAmount: Double? = nil,
        message: String? = nil,
        proposedTime: String? = nil,
        status: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        expiresAt: String? = nil,
        counterAmount: Double? = nil,
        counterStatus: String? = nil,
        counteredAt: String? = nil,
        withdrawnAt: String? = nil,
        withdrawalReason: String? = nil,
        gig: BidGigDTO? = nil,
        bidder: BidderUserDTO? = nil,
        shortlisted: Bool? = nil,
        yourRank: Int? = nil,
        topPrice: Double? = nil
    ) {
        self.id = id
        self.gigId = gigId
        self.userId = userId
        self.bidAmount = bidAmount
        self.message = message
        self.proposedTime = proposedTime
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.expiresAt = expiresAt
        self.counterAmount = counterAmount
        self.counterStatus = counterStatus
        self.counteredAt = counteredAt
        self.withdrawnAt = withdrawnAt
        self.withdrawalReason = withdrawalReason
        self.gig = gig
        self.bidder = bidder
        self.shortlisted = shortlisted
        self.yourRank = yourRank
        self.topPrice = topPrice
    }

    enum CodingKeys: String, CodingKey {
        case id, message, status, gig, bidder, shortlisted
        case gigId = "gig_id"
        case userId = "user_id"
        case bidAmount = "bid_amount"
        case proposedTime = "proposed_time"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case expiresAt = "expires_at"
        case counterAmount = "counter_amount"
        case counterStatus = "counter_status"
        case counteredAt = "countered_at"
        case withdrawnAt = "withdrawn_at"
        case withdrawalReason = "withdrawal_reason"
        case yourRank = "your_rank"
        case topPrice = "top_price"
    }
}

/// Inlined gig summary on each bid. Mirrors the `Gig` columns the
/// backend selects (`id, title, description, price, category, status,
/// user_id`).
public struct BidGigDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String?
    public let description: String?
    public let price: Double?
    public let category: String?
    public let status: String?
    public let userId: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, price, category, status
        case userId = "user_id"
    }
}

/// Inlined bidder identity on Received-offers rows. Mirrors the `User`
/// columns the backend selects (`id, username, name, first_name,
/// profile_picture_url, city, state`).
public struct BidderUserDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let firstName: String?
    public let profilePictureUrl: String?
    public let city: String?
    public let state: String?

    enum CodingKeys: String, CodingKey {
        case id, username, name, city, state
        case firstName = "first_name"
        case profilePictureUrl = "profile_picture_url"
    }
}
