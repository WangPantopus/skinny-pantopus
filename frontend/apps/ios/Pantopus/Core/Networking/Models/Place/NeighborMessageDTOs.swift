//
//  NeighborMessageDTOs.swift
//  Pantopus
//
//  DTOs for `/api/neighbor-messages/*` — verified-only, template-only
//  neighbor heads-ups. Route: `backend/routes/neighborMessages.js`.
//  Mirrors `frontend/packages/api/src/endpoints/neighborMessages.ts`.
//
//  Trust-and-safety model (baked into the API):
//  * the template catalog is the single source of truth — no free text;
//  * sending requires a verified resident (T4) and a recipient home on
//    the same block; the server enforces both;
//  * the recipient never learns the sender ("a verified neighbor
//    nearby"); reply is templated; report / not-helpful / block never
//    notify the sender.
//

import Foundation

/// An outbound, pre-written note. `icon` maps to a lucide icon name.
public struct NeighborMessageTemplate: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: String
    public let category: String
    public let body: String
}

/// A templated quick-reply (anonymous both ways).
public struct NeighborReplyTemplate: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let body: String
}

/// `GET /api/neighbor-messages/templates` response.
public struct NeighborMessageTemplates: Decodable, Sendable, Hashable {
    public let templates: [NeighborMessageTemplate]
    public let replies: [NeighborReplyTemplate]
}

/// The anonymized sender label — never an identity.
public struct NeighborMessageSender: Decodable, Sendable, Hashable {
    public let label: String
    public let blockLabel: String
    public let verified: Bool

    private enum CodingKeys: String, CodingKey {
        case label, verified
        case blockLabel = "block_label"
    }
}

public struct NeighborMessageReply: Decodable, Sendable, Hashable {
    public let templateId: String
    public let body: String
    public let repliedAt: String?

    private enum CodingKeys: String, CodingKey {
        case body
        case templateId = "template_id"
        case repliedAt = "replied_at"
    }
}

/// Recipient-facing view of a received message. No sender identity.
public struct ReceivedNeighborMessage: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let category: String
    public let body: String
    public let createdAt: String
    public let sender: NeighborMessageSender
    public let reply: NeighborMessageReply?
    public let canReply: Bool
    public let blockedByViewer: Bool?
    public let notHelpful: Bool
    public let reported: Bool
    public let readAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, category, body, sender, reply, reported
        case createdAt = "created_at"
        case canReply = "can_reply"
        case blockedByViewer = "blocked_by_viewer"
        case notHelpful = "not_helpful"
        case readAt = "read_at"
    }
}

/// `GET /api/neighbor-messages/received` envelope.
public struct ReceivedNeighborMessagesResponse: Decodable, Sendable, Hashable {
    public let messages: [ReceivedNeighborMessage]
}

public struct SentNeighborMessageRecipient: Decodable, Sendable, Hashable {
    public let label: String
    public let blockLabel: String

    private enum CodingKeys: String, CodingKey {
        case label
        case blockLabel = "block_label"
    }
}

/// Sender-facing confirmation after a successful send.
public struct SentNeighborMessage: Decodable, Sendable, Hashable {
    public let id: String?
    public let templateId: String
    public let category: String
    public let body: String
    public let createdAt: String
    /// Always "sent".
    public let status: String
    public let recipient: SentNeighborMessageRecipient

    private enum CodingKeys: String, CodingKey {
        case id, category, body, status, recipient
        case templateId = "template_id"
        case createdAt = "created_at"
    }
}

/// The address a note goes to: any address on the sender's block.
public struct NeighborRecipientAddress: Encodable, Sendable, Hashable {
    public let address: String
    public let unit: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?

    public init(address: String, unit: String?, city: String?, state: String?, zipcode: String?) {
        self.address = address
        self.unit = unit
        self.city = city
        self.state = state
        self.zipcode = zipcode
    }
}

/// `POST /api/neighbor-messages/address-check` body. Without a city, the
/// server looks the street up in the sender's town.
public struct NeighborAddressCheckRequest: Encodable, Sendable, Hashable {
    public let senderHomeId: String
    public let address: String
    public let city: String?
    public let state: String?
    public let zipcode: String?

    public init(senderHomeId: String, address: String, city: String?, state: String?, zipcode: String?) {
        self.senderHomeId = senderHomeId
        self.address = address
        self.city = city
        self.state = state
        self.zipcode = zipcode
    }

    private enum CodingKeys: String, CodingKey {
        case senderHomeId = "sender_home_id"
        case address, city, state, zipcode
    }
}

/// Whether an address can get a note. Nothing here says who lives there.
public struct NeighborAddressCheck: Decodable, Sendable, Hashable {
    /// "on_block", or "off_block", "not_found", "own_home" with a `message`.
    public let status: String
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let message: String?
}

/// `POST /api/neighbor-messages` body.
public struct SendNeighborMessageRequest: Encodable, Sendable, Hashable {
    public let senderHomeId: String
    public let recipientAddress: NeighborRecipientAddress
    public let templateId: String

    public init(senderHomeId: String, recipientAddress: NeighborRecipientAddress, templateId: String) {
        self.senderHomeId = senderHomeId
        self.recipientAddress = recipientAddress
        self.templateId = templateId
    }

    private enum CodingKeys: String, CodingKey {
        case senderHomeId = "sender_home_id"
        case recipientAddress = "recipient_address"
        case templateId = "template_id"
    }
}

/// `POST /api/neighbor-messages/:id/reply` body.
public struct ReplyNeighborMessageRequest: Encodable, Sendable, Hashable {
    public let replyTemplateId: String

    public init(replyTemplateId: String) {
        self.replyTemplateId = replyTemplateId
    }

    private enum CodingKeys: String, CodingKey {
        case replyTemplateId = "reply_template_id"
    }
}

/// `POST /api/neighbor-messages/:id/report` body.
public struct ReportNeighborMessageRequest: Encodable, Sendable, Hashable {
    public let reason: String?

    public init(reason: String?) {
        self.reason = reason
    }
}

/// `{ success: true }` acknowledgements (not-helpful / report / block).
public struct NeighborMessageAck: Decodable, Sendable, Hashable {
    public let success: Bool
}
