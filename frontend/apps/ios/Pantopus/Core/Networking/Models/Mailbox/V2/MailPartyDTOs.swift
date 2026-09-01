//
//  MailPartyDTOs.swift
//  Pantopus
//
//  Wire DTOs for the Family Mail Party (co-opening) routes in
//  `backend/routes/mailboxV2Phase2.js` (mounted at `/api/mailbox/v2/p2`).
//  Mirrors `data/api/models/mailbox/v2/MailPartyDtos.kt` on Android.
//

import Foundation

/// One `MailPartySession` row. `GET /party/active` embeds the joined
/// `Mail` row under the literal `Mail` key
/// (`select('*, Mail!inner(id, sender_display, subject, sender_trust)')`,
/// `backend/routes/mailboxV2Phase2.js:931`).
public struct MailPartySessionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let mailId: String
    public let homeId: String?
    public let initiatedBy: String?
    /// `pending` / `active` / `completed` / `expired`.
    public let status: String?
    public let createdAt: String?
    public let openedAt: String?
    public let completedAt: String?
    public let mail: MailPartyMailDTO?

    private enum CodingKeys: String, CodingKey {
        case id
        case mailId = "mail_id"
        case homeId = "home_id"
        case initiatedBy = "initiated_by"
        case status
        case createdAt = "created_at"
        case openedAt = "opened_at"
        case completedAt = "completed_at"
        case mail = "Mail"
    }
}

/// The four `Mail` columns `/party/active` projects.
public struct MailPartyMailDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let senderDisplay: String?
    public let subject: String?
    public let senderTrust: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case senderDisplay = "sender_display"
        case subject
        case senderTrust = "sender_trust"
    }
}

/// `GET /api/mailbox/v2/p2/party/active` — `{ sessions }`.
public struct MailPartyActiveResponse: Decodable, Sendable, Hashable {
    public let sessions: [MailPartySessionDTO]
}

/// `POST /api/mailbox/v2/p2/party/create` — `{ session, expiresIn }`.
/// `expiresIn` is already camelCase on the wire (a JS literal, not a
/// Postgres column).
public struct MailPartyCreateResponse: Decodable, Sendable, Hashable {
    public let session: MailPartySessionDTO
    public let expiresIn: Int?
}

/// `POST /api/mailbox/v2/p2/party/join` — `{ session }`.
public struct MailPartyJoinResponse: Decodable, Sendable, Hashable {
    public let session: MailPartySessionDTO
}

/// `POST /api/mailbox/v2/p2/party/decline` — `{ message }`.
public struct MailPartyDeclineResponse: Decodable, Sendable, Hashable {
    public let message: String?
}

/// `POST /api/mailbox/v2/p2/party/reaction` — `{ reaction, ttl }`.
public struct MailPartyReactionResponse: Decodable, Sendable, Hashable {
    public let reaction: String?
    public let ttl: Int?
}

/// `POST /api/mailbox/v2/p2/party/assign` — `{ message, assignedTo }`.
public struct MailPartyAssignResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let assignedTo: String?
}
