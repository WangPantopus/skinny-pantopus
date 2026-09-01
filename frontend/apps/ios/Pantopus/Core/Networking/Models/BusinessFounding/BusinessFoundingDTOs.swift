//
//  BusinessFoundingDTOs.swift
//  Pantopus
//
//  Wire shapes for the first-50 Founding Business offer.
//  Status:  `backend/routes/businessFounding.js:80`.
//  Claim:   `backend/routes/businessFounding.js:218`.
//

import Foundation

/// Global slot availability plus the caller's already-claimed businesses.
public struct FoundingOfferStatusDTO: Decodable, Sendable, Hashable {
    public let totalSlots: Int?
    public let slotsClaimed: Int?
    public let slotsRemaining: Int?
    public let isOfferActive: Bool?
    public let userBusinesses: [FoundingSlotDTO]?

    enum CodingKeys: String, CodingKey {
        case totalSlots = "total_slots"
        case slotsClaimed = "slots_claimed"
        case slotsRemaining = "slots_remaining"
        case isOfferActive = "is_offer_active"
        case userBusinesses = "user_businesses"
    }
}

/// One already-claimed slot row (`FoundingBusinessSlot`).
public struct FoundingSlotDTO: Decodable, Sendable, Hashable {
    public let businessUserId: String?
    public let slotNumber: Int?
    public let claimedAt: String?
    public let status: String?

    enum CodingKeys: String, CodingKey {
        case status
        case businessUserId = "business_user_id"
        case slotNumber = "slot_number"
        case claimedAt = "claimed_at"
    }
}

/// 201 body from the claim route.
public struct FoundingSlotClaimDTO: Decodable, Sendable, Hashable {
    public let slotNumber: Int?
    public let claimedAt: String?
    public let status: String?
    public let foundingBadge: Bool?
    public let message: String?

    enum CodingKeys: String, CodingKey {
        case status, message
        case slotNumber = "slot_number"
        case claimedAt = "claimed_at"
        case foundingBadge = "founding_badge"
    }
}
