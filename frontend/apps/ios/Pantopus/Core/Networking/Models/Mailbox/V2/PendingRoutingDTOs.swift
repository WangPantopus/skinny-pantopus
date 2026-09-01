//
//  PendingRoutingDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/mailbox/v2/pending` — route
//  `backend/routes/mailboxV2.js:612`. The handler selects
//  `'*, Mail!inner(*)'` from `MailRoutingQueue` filtered to
//  `resolved = false`, so every row carries the queue columns plus the
//  full embedded `Mail` row under the `Mail` key.
//

import Foundation

/// Envelope for `GET /api/mailbox/v2/pending` (`mailboxV2.js:626`).
public struct PendingRoutingResponse: Decodable, Sendable, Hashable {
    public let pending: [PendingRoutingItem]

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pending = try c.decodeIfPresent([PendingRoutingItem].self, forKey: .pending) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case pending
    }
}

/// One unresolved `MailRoutingQueue` row plus its embedded `Mail`.
/// Columns written by `POST /api/mailbox/v2/route` (`mailboxV2.js:530`).
public struct PendingRoutingItem: Decodable, Sendable, Hashable, Identifiable {
    /// `MailRoutingQueue.mail_id` — the mail this row is asking about, and
    /// the `mailId` sent back to `POST /api/mailbox/v2/resolve`. Used as the
    /// identity because the queue is unique on `mail_id`
    /// (`upsert(..., { onConflict: 'mail_id' })`, `mailboxV2.js:538`).
    public let mailId: String
    public let homeId: String?
    /// The raw name the mail was addressed to — the string the user is
    /// being asked to disambiguate, and the alias candidate.
    public let recipientNameRaw: String?
    public let bestMatchUserId: String?
    public let bestMatchConfidence: Double?
    public let mail: PendingRoutingMail?

    public var id: String {
        mailId
    }

    private enum CodingKeys: String, CodingKey {
        case mailId = "mail_id"
        case homeId = "home_id"
        case recipientNameRaw = "recipient_name_raw"
        case bestMatchUserId = "best_match_user_id"
        case bestMatchConfidence = "best_match_confidence"
        case mail = "Mail"
    }
}

/// The subset of the embedded `Mail` row the queue card renders. The
/// backend returns every column; everything not listed here is ignored.
public struct PendingRoutingMail: Decodable, Sendable, Hashable {
    public let subject: String?
    public let content: String?
    public let previewText: String?
    public let senderDisplay: String?
    public let senderBusinessName: String?
    public let category: String?
    public let mailObjectType: String?

    private enum CodingKeys: String, CodingKey {
        case subject, content, category
        case previewText = "preview_text"
        case senderDisplay = "sender_display"
        case senderBusinessName = "sender_business_name"
        case mailObjectType = "mail_object_type"
    }
}
