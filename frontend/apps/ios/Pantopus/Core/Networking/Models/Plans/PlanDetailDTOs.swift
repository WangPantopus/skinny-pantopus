//
//  PlanDetailDTOs.swift
//  Pantopus
//
//  Nearby Plans: `PlanDetail`, the private half of a plan (brief section 5).
//  Only the host and the people who are in receive it: the exact place, the
//  host's note, the people going, the chat and the viewer's own request.
//  Always read with the `sensitive` store kind (never saved, always
//  re-checked), so a removed guest never sees an address from a copy.
//

import Foundation

// MARK: - Plan detail

/// The exact place, for the host and people who are in only.
public struct PlanPlaceDTO: Codable, Sendable, Hashable {
    public let name: String?
    public let address: String?
    public let latitude: Double
    public let longitude: Double
    /// The host's note for people who are in.
    public let note: String?
}

/// Someone going, as the host and other people who are in see them.
public struct PlanPersonDTO: Codable, Sendable, Hashable, Identifiable {
    public let userId: String
    public let displayName: String
    public let avatarUrl: String?
    public let partySize: Int
    public let verifiedAddress: Bool
    public let isHost: Bool
    public let onMyWay: Bool
    /// Host only: the person's request, for "Remove from plan".
    public let requestId: String?
    /// Host only: how far they live, as a band.
    public let distanceBand: PlanDistanceBand?
    /// Host only: the host had them at a plan before.
    public let hostedBefore: Bool
    /// Host only: plans they joined before.
    public let plansJoined: Int?
    /// Host only: an account under 30 days old.
    public let newToPantopus: Bool
    /// Host only: asked "Still coming?" and hasn't answered.
    public let reconfirmNeeded: Bool
    /// Host only, playdates: how many kids come and their age bands (never names).
    public let kidsCount: Int?
    public let kidsAgeBands: [PlanKidsAgeBand]?

    public var id: String {
        userId
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case partySize = "party_size"
        case verifiedAddress = "verified_address"
        case isHost = "is_host"
        case onMyWay = "on_my_way"
        case requestId = "request_id"
        case distanceBand = "distance_band"
        case hostedBefore = "hosted_before"
        case plansJoined = "plans_joined"
        case newToPantopus = "new_to_pantopus"
        case reconfirmNeeded = "reconfirm_needed"
        case kidsCount = "kids_count"
        case kidsAgeBands = "kids_age_bands"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        userId = try container.decode(String.self, forKey: .userId)
        displayName = try container.decode(String.self, forKey: .displayName)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        partySize = try container.decodeIfPresent(Int.self, forKey: .partySize) ?? 1
        verifiedAddress = try container.decodeIfPresent(Bool.self, forKey: .verifiedAddress) ?? false
        isHost = try container.decodeIfPresent(Bool.self, forKey: .isHost) ?? false
        onMyWay = try container.decodeIfPresent(Bool.self, forKey: .onMyWay) ?? false
        requestId = try container.decodeIfPresent(String.self, forKey: .requestId)
        distanceBand = try? container.decodeIfPresent(PlanDistanceBand.self, forKey: .distanceBand)
        hostedBefore = try container.decodeIfPresent(Bool.self, forKey: .hostedBefore) ?? false
        plansJoined = try container.decodeIfPresent(Int.self, forKey: .plansJoined)
        newToPantopus = try container.decodeIfPresent(Bool.self, forKey: .newToPantopus) ?? false
        reconfirmNeeded = try container.decodeIfPresent(Bool.self, forKey: .reconfirmNeeded) ?? false
        kidsCount = try container.decodeIfPresent(Int.self, forKey: .kidsCount)
        kidsAgeBands = try? container.decodeIfPresent([PlanKidsAgeBand].self, forKey: .kidsAgeBands)
    }
}

/// `GET /api/plans/:id`: a `PlanDetail` for the host and people who are in,
/// a `PlanCard` for everyone else allowed to see it. The private fields are
/// nil for a card. Always read with the `sensitive` store kind.
public struct PlanDetailDTO: Decodable, Sendable, Hashable, Identifiable {
    public let card: PlanCardDTO
    public let place: PlanPlaceDTO?
    public let people: [PlanPersonDTO]?
    public let chatRoomId: String?
    /// False once the chat is read-only or the plan was cancelled.
    public let chatOpen: Bool?
    /// The host's note when they cancelled.
    public let cancelNote: String?

    public var id: String {
        card.id
    }

    enum CodingKeys: String, CodingKey {
        case place, people
        case chatRoomId = "chat_room_id"
        case chatOpen = "chat_open"
        case cancelNote = "cancel_note"
    }

    public init(from decoder: any Decoder) throws {
        card = try PlanCardDTO(from: decoder)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        place = try? container.decodeIfPresent(PlanPlaceDTO.self, forKey: .place)
        people = (try? container.decodeIfPresent(LossyList<PlanPersonDTO>.self, forKey: .people))?.items
        chatRoomId = try container.decodeIfPresent(String.self, forKey: .chatRoomId)
        chatOpen = try container.decodeIfPresent(Bool.self, forKey: .chatOpen)
        cancelNote = try container.decodeIfPresent(String.self, forKey: .cancelNote)
    }

    /// The viewer's own request.
    public var myRequest: PlanMyRequestDTO? {
        card.myRequest
    }

    /// Host only: the plan's automatic rules.
    public var autoRules: [PlanAutoRule]? {
        card.autoRules
    }

    /// A card with nothing private yet: seeds the plan screen from a list row
    /// until the detail read answers.
    public init(card: PlanCardDTO) {
        self.card = card
        place = nil
        people = nil
        chatRoomId = nil
        chatOpen = nil
        cancelNote = nil
    }
}

// MARK: - The viewer's request

/// The viewer's own request, on every card and detail (their own data only).
/// What the host's change asked "Still coming?" about (the PLAN_CHANGED push's words).
public enum PlanReconfirmReason: String, Decodable, Sendable, Hashable {
    case time, place, both
}

public struct PlanMyRequestDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let status: PlanRequestStatus
    public let partySize: Int?
    public let note: String?
    public let kidsCount: Int?
    public let kidsAgeBands: [PlanKidsAgeBand]?
    public let reconfirmNeeded: Bool?
    /// Set while `reconfirmNeeded`; nil from servers before it was added.
    public let reconfirmReason: PlanReconfirmReason?
    public let onMyWay: Bool?
    public let waitlistPosition: Int?
    public let decidedBy: String?
    public let decidedAt: String?
    public let createdAt: String?
    public let asksLeft: Int?

    enum CodingKeys: String, CodingKey {
        case id, status, note
        case partySize = "party_size"
        case kidsCount = "kids_count"
        case kidsAgeBands = "kids_age_bands"
        case reconfirmNeeded = "reconfirm_needed"
        case reconfirmReason = "reconfirm_reason"
        case onMyWay = "on_my_way"
        case waitlistPosition = "waitlist_position"
        case decidedBy = "decided_by"
        case decidedAt = "decided_at"
        case createdAt = "created_at"
        case asksLeft = "asks_left"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        status = try container.decodeIfPresent(PlanRequestStatus.self, forKey: .status) ?? .pending
        partySize = try container.decodeIfPresent(Int.self, forKey: .partySize)
        note = try container.decodeIfPresent(String.self, forKey: .note)
        kidsCount = try container.decodeIfPresent(Int.self, forKey: .kidsCount)
        let bands = try? container.decodeIfPresent([String].self, forKey: .kidsAgeBands)
        kidsAgeBands = bands?.compactMap(PlanKidsAgeBand.init(rawValue:))
        reconfirmNeeded = try container.decodeIfPresent(Bool.self, forKey: .reconfirmNeeded)
        reconfirmReason = try? container.decodeIfPresent(PlanReconfirmReason.self, forKey: .reconfirmReason)
        onMyWay = try container.decodeIfPresent(Bool.self, forKey: .onMyWay)
        waitlistPosition = try container.decodeIfPresent(Int.self, forKey: .waitlistPosition)
        decidedBy = try container.decodeIfPresent(String.self, forKey: .decidedBy)
        decidedAt = try container.decodeIfPresent(String.self, forKey: .decidedAt)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        asksLeft = try container.decodeIfPresent(Int.self, forKey: .asksLeft)
    }
}

// MARK: - Your standing

/// `/mine`'s `viewer`: whether playdates are open to this person.
public struct MyPlansViewer: Decodable, Sendable, Hashable {
    /// A verified resident (postcard, document, landlord or admin).
    public let verifiedAddress: Bool
    /// Verified, with `plans_playdates` on.
    public let seesPlaydates: Bool

    enum CodingKeys: String, CodingKey {
        case verifiedAddress = "verified_address"
        case seesPlaydates = "sees_playdates"
    }
}
