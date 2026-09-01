//
//  FridgeCardDTOs.swift
//  Pantopus
//
//  The Fridge Card (Wave 1, #2): the 911-ready household card — the
//  server-derived verified address as the headline plus the facts only
//  the household knows. Content is frozen at issue; revocation pulls
//  it entirely. Section keys outside this build's vocabulary decode as
//  `.unknown` and still render (title-cased raw), so a server-side
//  addition cannot hide household safety data.
//

import Foundation

public enum FridgeCardSectionKey: String, Decodable, Sendable, Hashable, CaseIterable {
    case household
    case medical
    case pets
    case utilities
    case contacts
    case notes
}

public enum FridgeCardSectionKeyOrUnknown: Decodable, Sendable, Hashable {
    case known(FridgeCardSectionKey)
    case unknown(String)

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = FridgeCardSectionKey(rawValue: raw).map(Self.known) ?? .unknown(raw)
    }
}

public enum FridgeCardStatus: String, Decodable, Sendable, Hashable {
    case active
    case revoked

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = FridgeCardStatus(rawValue: raw) ?? .revoked
    }
}

public struct FridgeCardItem: Codable, Sendable, Hashable {
    public let label: String
    public let note: String

    public init(label: String, note: String) {
        self.label = label
        self.note = note
    }
}

public struct FridgeCardSection: Decodable, Sendable, Hashable {
    public let key: FridgeCardSectionKeyOrUnknown
    public let items: [FridgeCardItem]
}

public struct FridgeCardAddress: Decodable, Sendable, Hashable {
    public let line1: String
    public let cityStateZip: String

    private enum CodingKeys: String, CodingKey {
        case line1
        case cityStateZip = "city_state_zip"
    }
}

public struct FridgeCardContent: Decodable, Sendable, Hashable {
    /// Server-derived from the verified home — never client input.
    public let address: FridgeCardAddress
    public let sections: [FridgeCardSection]
}

public struct FridgeCard: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let label: String?
    public let status: FridgeCardStatus
    public let cardCode: String
    public let cardUrl: String
    public let content: FridgeCardContent
    public let issuedAt: String
    public let revokedAt: String?
    public let viewCount: Int
    public let lastViewedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case label
        case status
        case cardCode = "card_code"
        case cardUrl = "card_url"
        case content
        case issuedAt = "issued_at"
        case revokedAt = "revoked_at"
        case viewCount = "view_count"
        case lastViewedAt = "last_viewed_at"
    }
}

public struct IssueFridgeCardSection: Encodable, Sendable {
    public let key: String
    public let items: [FridgeCardItem]

    public init(key: FridgeCardSectionKey, items: [FridgeCardItem]) {
        self.key = key.rawValue
        self.items = items
    }
}

public struct IssueFridgeCardRequest: Encodable, Sendable {
    public let label: String?
    public let sections: [IssueFridgeCardSection]

    public init(label: String?, sections: [IssueFridgeCardSection]) {
        self.label = label
        self.sections = sections
    }
}

public struct FridgeCardResponse: Decodable, Sendable {
    public let card: FridgeCard
}

public struct FridgeCardsResponse: Decodable, Sendable {
    public let cards: [FridgeCard]
}
