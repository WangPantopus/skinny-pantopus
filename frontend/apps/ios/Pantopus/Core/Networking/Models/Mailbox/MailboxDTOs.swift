//
//  MailboxDTOs.swift
//  Pantopus
//
//  DTOs for the V1 mailbox endpoints in `backend/routes/mailbox.js`.
//

import Foundation

/// Core mail row — shared shape between list, detail, and V2 envelopes.
/// Route citations: `backend/routes/mailbox.js:1306` (list),
/// `backend/routes/mailbox.js:1466` (detail).
public struct MailItem: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let recipientUserId: String?
    public let recipientHomeId: String?
    public let deliveryTargetType: String?
    public let deliveryTargetId: String?
    public let addressHomeId: String?
    public let attnUserId: String?
    public let attnLabel: String?
    public let deliveryVisibility: String?
    public let mailType: String?
    public let displayTitle: String?
    public let previewText: String?
    public let primaryAction: String?
    public let actionRequired: Bool?
    public let ackRequired: Bool?
    public let ackStatus: String?
    public let type: String
    public let subject: String?
    public let content: String?
    public let senderUserId: String?
    public let senderBusinessName: String?
    public let senderAddress: String?
    /// `Mail.sender_trust` — `verified_gov` / `verified_utility` /
    /// `verified_business` / `pantopus_user` / `unknown`
    /// (`backend/database/schema.sql:7207`).
    public let senderTrust: String?
    public let viewed: Bool
    public let viewedAt: String?
    public let archived: Bool
    public let starred: Bool
    public let payoutAmount: Double?
    public let payoutStatus: String?
    public let category: String?
    public let tags: [String]
    public let priority: String
    public let attachments: [String]?
    public let expiresAt: String?
    public let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id
        case recipientUserId = "recipient_user_id"
        case recipientHomeId = "recipient_home_id"
        case deliveryTargetType = "delivery_target_type"
        case deliveryTargetId = "delivery_target_id"
        case addressHomeId = "address_home_id"
        case attnUserId = "attn_user_id"
        case attnLabel = "attn_label"
        case deliveryVisibility = "delivery_visibility"
        case mailType = "mail_type"
        case displayTitle = "display_title"
        case previewText = "preview_text"
        case primaryAction = "primary_action"
        case actionRequired = "action_required"
        case ackRequired = "ack_required"
        case ackStatus = "ack_status"
        case type, subject, content
        case senderUserId = "sender_user_id"
        case senderBusinessName = "sender_business_name"
        case senderAddress = "sender_address"
        case senderTrust = "sender_trust"
        case viewed
        case viewedAt = "viewed_at"
        case archived, starred
        case payoutAmount = "payout_amount"
        case payoutStatus = "payout_status"
        case category, tags, priority, attachments
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        recipientUserId = try c.decodeIfPresent(String.self, forKey: .recipientUserId)
        recipientHomeId = try c.decodeIfPresent(String.self, forKey: .recipientHomeId)
        deliveryTargetType = try c.decodeIfPresent(String.self, forKey: .deliveryTargetType)
        deliveryTargetId = try c.decodeIfPresent(String.self, forKey: .deliveryTargetId)
        addressHomeId = try c.decodeIfPresent(String.self, forKey: .addressHomeId)
        attnUserId = try c.decodeIfPresent(String.self, forKey: .attnUserId)
        attnLabel = try c.decodeIfPresent(String.self, forKey: .attnLabel)
        deliveryVisibility = try c.decodeIfPresent(String.self, forKey: .deliveryVisibility)
        mailType = try c.decodeIfPresent(String.self, forKey: .mailType)
        displayTitle = try c.decodeIfPresent(String.self, forKey: .displayTitle)
        previewText = try c.decodeIfPresent(String.self, forKey: .previewText)
        primaryAction = try c.decodeIfPresent(String.self, forKey: .primaryAction)
        actionRequired = try c.decodeIfPresent(Bool.self, forKey: .actionRequired)
        ackRequired = try c.decodeIfPresent(Bool.self, forKey: .ackRequired)
        ackStatus = try c.decodeIfPresent(String.self, forKey: .ackStatus)
        type = try c.decode(String.self, forKey: .type)
        subject = try c.decodeIfPresent(String.self, forKey: .subject)
        content = try c.decodeIfPresent(String.self, forKey: .content)
        senderUserId = try c.decodeIfPresent(String.self, forKey: .senderUserId)
        senderBusinessName = try c.decodeIfPresent(String.self, forKey: .senderBusinessName)
        senderAddress = try c.decodeIfPresent(String.self, forKey: .senderAddress)
        senderTrust = try c.decodeIfPresent(String.self, forKey: .senderTrust)
        viewed = try c.decodeIfPresent(Bool.self, forKey: .viewed) ?? false
        viewedAt = try c.decodeIfPresent(String.self, forKey: .viewedAt)
        archived = try c.decodeIfPresent(Bool.self, forKey: .archived) ?? false
        starred = try c.decodeIfPresent(Bool.self, forKey: .starred) ?? false
        payoutAmount = try c.decodeIfPresent(Double.self, forKey: .payoutAmount)
        payoutStatus = try c.decodeIfPresent(String.self, forKey: .payoutStatus)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        tags = try c.decodeIfPresent([String].self, forKey: .tags) ?? []
        priority = try c.decodeIfPresent(String.self, forKey: .priority) ?? "normal"
        attachments = try c.decodeIfPresent([String].self, forKey: .attachments)
        expiresAt = try c.decodeIfPresent(String.self, forKey: .expiresAt)
        createdAt = try c.decode(String.self, forKey: .createdAt)
    }
}

/// `GET /api/mailbox` envelope — route `backend/routes/mailbox.js:1306`.
public struct MailboxListResponse: Decodable, Sendable, Hashable {
    public let mail: [MailItem]
    public let count: Int
}

/// `GET /api/mailbox/:id` envelope — route `backend/routes/mailbox.js:1466`.
public struct MailDetailResponse: Decodable, Sendable, Hashable {
    public let mail: MailDetail

    public struct MailDetail: Decodable, Sendable, Hashable, Identifiable {
        public let item: MailItem
        public let sender: Sender?
        public let object: JSONValue?
        public let contentFormat: String?
        public let links: [JSONValue]
        /// `Mail.mail_extracted` (jsonb, `backend/database/schema.sql:7201`).
        /// Compose writes the ceremonial metadata here at send time —
        /// `stationeryTheme` / `inkSelection` / `voicePostscriptUri` /
        /// `outcomes` (`backend/routes/mailbox.js:586-603`, persisted at
        /// `:2017`). It is the V1 detail route's copy of the same values
        /// the V2 item route exposes under `object_payload`, and the
        /// backend itself falls back to it (`routes/mailCompose.js:556`).
        public let mailExtracted: JSONValue?

        public var id: String {
            item.id
        }

        /// Stationery theme when this mail came out of the Ceremonial Mail
        /// compose flow — the signal RN uses to redirect the generic
        /// detail into the ceremonial open experience
        /// (`src/app/mailbox/detail.tsx:43-49`). Nil for ordinary mail.
        public var stationeryTheme: String? {
            guard let theme = mailExtracted?.dictValue?["stationeryTheme"]?.stringValue else {
                return nil
            }
            return theme.isEmpty ? nil : theme
        }

        public init(from decoder: any Decoder) throws {
            item = try MailItem(from: decoder)
            let c = try decoder.container(keyedBy: Keys.self)
            sender = try c.decodeIfPresent(Sender.self, forKey: .sender)
            object = try c.decodeIfPresent(JSONValue.self, forKey: .object)
            contentFormat = try c.decodeIfPresent(String.self, forKey: .contentFormat)
            links = try c.decodeIfPresent([JSONValue].self, forKey: .links) ?? []
            mailExtracted = try c.decodeIfPresent(JSONValue.self, forKey: .mailExtracted)
        }

        public struct Sender: Decodable, Sendable, Hashable, Identifiable {
            public let id: String
            public let username: String
            public let name: String
        }

        private enum Keys: String, CodingKey {
            case sender, object
            case contentFormat = "content_format"
            case links
            case mailExtracted = "mail_extracted"
        }
    }
}

/// `PATCH /api/mailbox/:id/ack` response — route `backend/routes/mailbox.js:2702`.
public struct AckResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let ackStatus: String
}
