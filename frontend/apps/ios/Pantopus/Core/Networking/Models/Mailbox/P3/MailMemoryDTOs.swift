//
//  MailMemoryDTOs.swift
//  Pantopus
//
//  Wire DTOs for the Mail Memory routes in
//  `backend/routes/mailboxV2Phase3.js` ("On This Day" + "Year In Mail").
//  Mirrors `data/api/models/mailbox/p3/MailMemoryDtos.kt` on Android.
//

import Foundation

/// One mail row referenced by a memory card
/// (`backend/routes/mailboxV2Phase3.js:1334`).
public struct MailMemoryItemMailDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let subject: String?
    public let senderName: String?
    public let category: String?
    public let deliveredAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case subject
        case senderName = "sender_name"
        case category
        case deliveredAt = "delivered_at"
    }
}

/// One "On This Day" card. `id` is a synthesised key
/// (`otd-<year>-<month>-<day>`), not a UUID.
public struct MailMemoryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let memoryType: String?
    public let referenceDate: String?
    public let headline: String?
    public let body: String?
    public let mailItems: [MailMemoryItemMailDTO]?
    public let dismissed: Bool?

    private enum CodingKeys: String, CodingKey {
        case id
        case memoryType = "memory_type"
        case referenceDate = "reference_date"
        case headline
        case body
        case mailItems = "mail_items"
        case dismissed
    }
}

/// `GET /api/mailbox/v2/p3/memory/on-this-day` — `{ memories }`.
public struct MailMemoriesResponse: Decodable, Sendable, Hashable {
    public let memories: [MailMemoryDTO]
}

/// One row of the Year-In-Mail top-sender leaderboard.
public struct YearInMailSenderDTO: Decodable, Sendable, Hashable {
    public let senderDisplay: String?
    public let senderTrust: String?
    public let itemCount: Int?
    public let category: String?

    private enum CodingKeys: String, CodingKey {
        case senderDisplay = "sender_display"
        case senderTrust = "sender_trust"
        case itemCount = "item_count"
        case category
    }
}

/// `GET /api/mailbox/v2/p3/memory/year/:year`.
public struct YearInMailResponse: Decodable, Sendable, Hashable {
    public let year: Int
    public let totalItems: Int
    public let byDrawer: [String: Int]
    public let byType: [String: Int]
    public let topSenders: [YearInMailSenderDTO]
    public let totalPackages: Int
    public let firstMailDate: String?
    public let mostActiveMonth: String?
    public let shareCardUrl: String?

    private enum CodingKeys: String, CodingKey {
        case year
        case totalItems = "total_items"
        case byDrawer = "by_drawer"
        case byType = "by_type"
        case topSenders = "top_senders"
        case totalPackages = "total_packages"
        case firstMailDate = "first_mail_date"
        case mostActiveMonth = "most_active_month"
        case shareCardUrl = "share_card_url"
    }
}

/// `POST /api/mailbox/v2/p3/memory/dismiss` — `{ message }`.
public struct DismissMailMemoryResponse: Decodable, Sendable, Hashable {
    public let message: String?
}

/// `POST /api/mailbox/v2/p3/memory/year/:year/share` — `{ shareCardUrl }`.
/// Already camelCase on the wire (a JS literal, not a Postgres column).
public struct ShareYearInMailResponse: Decodable, Sendable, Hashable {
    public let shareCardUrl: String?
}
