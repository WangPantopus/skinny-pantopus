//
//  MailComposeDTOs.swift
//  Pantopus
//
//  Decoder shapes for the T3.7 Ceremonial Mail Compose flow.
//

import Foundation

/// Envelope from `GET /api/mailbox/compose/recipients`.
public struct MailComposeRecipientsResponse: Decodable, Sendable {
    public let recipients: [MailRecipientDTO]
}

public struct MailRecipientDTO: Decodable, Sendable, Hashable, Identifiable {
    public let userId: String
    public let name: String?
    public let username: String?
    public let homeId: String?
    public let homeAddress: String?
    public let isVerified: Bool?
    public let homeMediaUrl: String?
    public let isOnPantopus: Bool?

    public var id: String {
        userId
    }
}

/// Envelope from `GET /api/mailbox/compose/home-context/:homeId`.
public struct MailHomeContextResponse: Decodable, Sendable {
    public let homeId: String?
    public let addressDisplay: String?
    public let memberCount: Int?
    public let homeMediaUrl: String?
    public let privateDeliveryAvailable: Bool?
    public let members: [MailHomeMemberDTO]?
}

public struct MailHomeMemberDTO: Decodable, Sendable, Hashable {
    public let userId: String
    public let name: String?
    public let role: String?
}

/// Response from `POST /api/mailbox/send`. We only need the new
/// mail id (in `mail.id`) plus the optional success message.
public struct SendMailResponse: Decodable, Sendable {
    public let message: String?
    public let mail: SentMailDTO?
}

public struct SentMailDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let subject: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, subject
        case createdAt = "created_at"
    }
}
