//
//  ListingOfferDTOs.swift
//  Pantopus
//
//  Decoder shapes for `/api/listings/:listingId/offers` and its child
//  mutation routes. The marketplace's structured listing-offer system
//  is distinct from the gig-bid plumbing in `OffersDTOs.swift` —
//  different table (`ListingOffer`), different fields (`amount` vs
//  `bid_amount`), different status lifecycle.
//

import Foundation

/// Envelope from `GET /api/listings/:listingId/offers`. Route
/// `backend/routes/listingOffers.js:78`.
public struct ListingOffersResponse: Decodable, Sendable {
    public let offers: [ListingOfferDTO]

    enum CodingKeys: String, CodingKey {
        case offers
    }
}

/// Envelope returned by every listing-offer mutation
/// (accept / decline / counter / withdraw / complete). The handler
/// returns `{ offer: {...} }`.
public struct ListingOfferResponse: Decodable, Sendable {
    public let offer: ListingOfferDTO
}

/// One offer from `/api/listings/:listingId/offers`. The handler
/// enriches each row with the buyer + seller user cards
/// (`backend/routes/listingOffers.js:113`).
public struct ListingOfferDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let listingId: String?
    public let buyerId: String?
    public let sellerId: String?
    public let amount: Double?
    public let message: String?
    public let status: String?
    public let counterAmount: Double?
    public let counterMessage: String?
    public let parentOfferId: String?
    public let expiresAt: String?
    public let respondedAt: String?
    public let completedAt: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let buyer: ListingOfferUserDTO?
    public let seller: ListingOfferUserDTO?

    public init(
        id: String,
        listingId: String? = nil,
        buyerId: String? = nil,
        sellerId: String? = nil,
        amount: Double? = nil,
        message: String? = nil,
        status: String? = nil,
        counterAmount: Double? = nil,
        counterMessage: String? = nil,
        parentOfferId: String? = nil,
        expiresAt: String? = nil,
        respondedAt: String? = nil,
        completedAt: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        buyer: ListingOfferUserDTO? = nil,
        seller: ListingOfferUserDTO? = nil
    ) {
        self.id = id
        self.listingId = listingId
        self.buyerId = buyerId
        self.sellerId = sellerId
        self.amount = amount
        self.message = message
        self.status = status
        self.counterAmount = counterAmount
        self.counterMessage = counterMessage
        self.parentOfferId = parentOfferId
        self.expiresAt = expiresAt
        self.respondedAt = respondedAt
        self.completedAt = completedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.buyer = buyer
        self.seller = seller
    }

    enum CodingKeys: String, CodingKey {
        case id, amount, message, status, buyer, seller
        case listingId = "listing_id"
        case buyerId = "buyer_id"
        case sellerId = "seller_id"
        case counterAmount = "counter_amount"
        case counterMessage = "counter_message"
        case parentOfferId = "parent_offer_id"
        case expiresAt = "expires_at"
        case respondedAt = "responded_at"
        case completedAt = "completed_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Inlined buyer / seller user card on each listing offer. Mirrors the
/// columns the backend enriches with (`first_name, last_name, username,
/// profile_picture_url`).
public struct ListingOfferUserDTO: Decodable, Sendable, Hashable, Identifiable {
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

/// Body for `POST /api/listings/:listingId/offers/:offerId/counter`.
public struct CounterListingOfferBody: Encodable, Sendable {
    public let counterAmount: Double
    public let counterMessage: String?

    public init(counterAmount: Double, counterMessage: String? = nil) {
        self.counterAmount = counterAmount
        self.counterMessage = counterMessage
    }

    enum CodingKeys: String, CodingKey {
        case counterAmount
        case counterMessage
    }
}
