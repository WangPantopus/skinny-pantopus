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
    /// The business a letter was sent as (`Mail.sender_entity_id`); nil for a
    /// person's own letter and for letters stored before it was recorded.
    public let senderEntityId: String?
    public let senderBusinessName: String?
    public let senderAddress: String?
    /// Who it's from as printed on the item (`Mail.sender_display`). The
    /// server names the sender from it first (`resolveSenderDisplay`).
    public let senderDisplay: String?
    /// `Mail.sender_trust` — `verified_gov` / `verified_utility` /
    /// `verified_business` / `pantopus_user` / `unknown`
    /// (`backend/database/schema.sql:7207`).
    public let senderTrust: String?
    public let viewed: Bool
    public let viewedAt: String?
    /// `Mail.certified` — certified mail its named recipient signs for.
    public let certified: Bool
    /// When the web first opened it (the apps record `viewed_at`).
    public let openedAt: String?
    /// Certified mail: when the named recipient signed for it.
    public let acknowledgedAt: String?
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
    /// Facts read off the item (`Mail.key_facts`), such as "Amount due".
    public let keyFacts: [MailKeyFact]

    // Mail build contract v1 (2026-10-27). All optional: an older server
    // sends none of them, and a field of an unexpected shape reads as absent
    // rather than failing the whole list.

    /// What the piece is drawn as: `letter`, `bill`, `notice`, `postcard`,
    /// `booklet`, `parcel` or `bundle` (`MailPieceKind`; anything else draws as a letter).
    public let kind: String?
    /// When it went into the box (morning-round pieces: 7:00 a.m. in the mailbox's zone).
    public let deliveredAt: String?
    /// Arrived on its own, outside the morning round.
    public let specialDelivery: Bool
    /// Sent by Pantopus itself (welcome, home and residency letters).
    public let fromPantopus: Bool
    /// The postmark: the sender's town (or nil) and the day it was posted.
    public let postmark: MailPostmark?
    /// Due, or put on the counter, and not done yet.
    public let onCounter: Bool
    /// "Pantopus read this for you"; nil when there is no note.
    public let summary: MailSummary?
    /// The business invoice a bill came from, with its live status.
    public let invoice: MailInvoiceRef?
    /// A bundle's label ("Held while you were away") and how many pieces it holds.
    public let bundleLabel: String?
    public let bundleItemCount: Int?
    /// The bundle a piece came in, if any.
    public let bundleId: String?
    /// The files enclosed (detail answers only; `[]` elsewhere). Each opens
    /// through a short-lived link fetched when it's tapped.
    public let enclosures: [MailEnclosure]
    /// The Vault folder it's filed in, if any.
    public let vaultFolderId: String?
    /// When someone first opened it (opened is shared by the household).
    public let firstOpenedAt: String?
    /// The drawer it's in: `personal`, `home`, `business` (or `earn`).
    public let drawer: String?
    /// Where it is in its life: `delivered`, `opened`, `filed` (in the Vault) …
    public let lifecycle: String?
    /// A Christmas card (`holiday_cards`): its picture, caption and year, and
    /// whether it's still sealed until Christmas morning. Nil for anything else.
    public let card: MailCard?

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
        case senderEntityId = "sender_entity_id"
        case senderBusinessName = "sender_business_name"
        case senderAddress = "sender_address"
        case senderDisplay = "sender_display"
        case senderTrust = "sender_trust"
        case viewed
        case viewedAt = "viewed_at"
        case certified
        case openedAt = "opened_at"
        case acknowledgedAt = "acknowledged_at"
        case archived, starred
        case payoutAmount = "payout_amount"
        case payoutStatus = "payout_status"
        case category, tags, priority, attachments
        case expiresAt = "expires_at"
        case createdAt = "created_at"
        case keyFacts = "key_facts"
        case kind
        case deliveredAt = "delivered_at"
        case specialDelivery = "special_delivery"
        case fromPantopus = "from_pantopus"
        case postmark
        case onCounter = "on_counter"
        case summary
        case invoice
        case bundleLabel = "bundle_label"
        case bundleItemCount = "bundle_item_count"
        case bundleId = "bundle_id"
        case enclosures
        case vaultFolderId = "vault_folder_id"
        case firstOpenedAt = "first_opened_at"
        case drawer
        case lifecycle
        case card
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
        senderEntityId = try c.decodeIfPresent(String.self, forKey: .senderEntityId)
        senderBusinessName = try c.decodeIfPresent(String.self, forKey: .senderBusinessName)
        senderAddress = try c.decodeIfPresent(String.self, forKey: .senderAddress)
        senderDisplay = try c.decodeIfPresent(String.self, forKey: .senderDisplay)
        senderTrust = try c.decodeIfPresent(String.self, forKey: .senderTrust)
        viewed = try c.decodeIfPresent(Bool.self, forKey: .viewed) ?? false
        viewedAt = try c.decodeIfPresent(String.self, forKey: .viewedAt)
        certified = try c.decodeIfPresent(Bool.self, forKey: .certified) ?? false
        openedAt = try c.decodeIfPresent(String.self, forKey: .openedAt)
        acknowledgedAt = try c.decodeIfPresent(String.self, forKey: .acknowledgedAt)
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
        keyFacts = MailKeyFact.list(in: c, forKey: .keyFacts)
        kind = try? c.decodeIfPresent(String.self, forKey: .kind)
        deliveredAt = try? c.decodeIfPresent(String.self, forKey: .deliveredAt)
        specialDelivery = (try? c.decodeIfPresent(Bool.self, forKey: .specialDelivery)) ?? false
        fromPantopus = (try? c.decodeIfPresent(Bool.self, forKey: .fromPantopus)) ?? false
        postmark = try? c.decodeIfPresent(MailPostmark.self, forKey: .postmark)
        onCounter = (try? c.decodeIfPresent(Bool.self, forKey: .onCounter)) ?? false
        summary = try? c.decodeIfPresent(MailSummary.self, forKey: .summary)
        invoice = try? c.decodeIfPresent(MailInvoiceRef.self, forKey: .invoice)
        bundleLabel = try? c.decodeIfPresent(String.self, forKey: .bundleLabel)
        let count = try? c.decodeIfPresent(Int.self, forKey: .bundleItemCount)
        bundleItemCount = (count ?? 0) > 0 ? count : nil
        bundleId = try? c.decodeIfPresent(String.self, forKey: .bundleId)
        enclosures = (try? c.decodeIfPresent([MailEnclosure].self, forKey: .enclosures)) ?? []
        vaultFolderId = try? c.decodeIfPresent(String.self, forKey: .vaultFolderId)
        firstOpenedAt = try? c.decodeIfPresent(String.self, forKey: .firstOpenedAt)
        drawer = try? c.decodeIfPresent(String.self, forKey: .drawer)
        lifecycle = try? c.decodeIfPresent(String.self, forKey: .lifecycle)
        card = try? c.decodeIfPresent(MailCard.self, forKey: .card)
    }
}

/// A file enclosed with a piece (Mail build contract, SRV-4).
public struct MailEnclosure: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let mimeType: String?
    public let sizeBytes: Int?

    private enum CodingKeys: String, CodingKey {
        case id, name
        case mimeType = "mime_type"
        case sizeBytes = "size_bytes"
    }
}

/// `GET /api/mailbox/:id/enclosures/:enclosure_id`: a link signed for a few
/// minutes (nil `expiresAt` for an older piece's public attachment).
public struct MailEnclosureLink: Decodable, Sendable, Hashable {
    public let url: String
    public let expiresAt: String?

    private enum CodingKeys: String, CodingKey {
        case url
        case expiresAt = "expires_at"
    }
}

/// A piece's postmark (Mail build contract): the town of the sender's post
/// office, when known, and the day it was posted (`YYYY-MM-DD`).
public struct MailPostmark: Decodable, Sendable, Hashable {
    public let town: String?
    public let date: String?
}

/// "Pantopus read this for you": a few plain sentences and the key facts.
public struct MailSummary: Decodable, Sendable, Hashable {
    public let text: String
    public let keyFacts: [Fact]

    public struct Fact: Decodable, Sendable, Hashable {
        public let label: String
        public let value: String
    }

    private enum CodingKeys: String, CodingKey {
        case text
        case keyFacts = "key_facts"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        text = try c.decode(String.self, forKey: .text)
        keyFacts = (try? c.decodeIfPresent([Fact].self, forKey: .keyFacts)) ?? []
    }
}

/// The business invoice behind a bill; `status` is read live from the invoice
/// (`sent`, `viewed`, `paid`, `void`, `overdue`).
public struct MailInvoiceRef: Decodable, Sendable, Hashable {
    public let id: String
    public let status: String?
    public let totalCents: Int?
    public let currency: String?
    public let dueDate: String?
    public let businessName: String?

    private enum CodingKeys: String, CodingKey {
        case id, status, currency
        case totalCents = "total_cents"
        case dueDate = "due_date"
        case businessName = "business_name"
    }
}

/// One fact read off a mail item: an entry of `Mail.key_facts`.
public struct MailKeyFact: Decodable, Sendable, Hashable {
    public let field: String
    public let value: String

    private enum CodingKeys: String, CodingKey {
        case field, value
    }

    public init(field: String, value: String) {
        self.field = field
        self.value = value
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        field = try c.decode(String.self, forKey: .field)
        if let text = try? c.decode(String.self, forKey: .value) {
            value = text
        } else {
            value = try String(describing: c.decode(Double.self, forKey: .value))
        }
    }

    /// `key_facts` is a JSON array, but some rows hold that array as a JSON
    /// string; anything else reads as no facts.
    static func list<Key: CodingKey>(in container: KeyedDecodingContainer<Key>, forKey key: Key) -> [MailKeyFact] {
        if let facts = try? container.decodeIfPresent([MailKeyFact].self, forKey: key) {
            return facts
        }
        guard let text = try? container.decodeIfPresent(String.self, forKey: key),
              let data = text.data(using: .utf8),
              let facts = try? JSONDecoder().decode([MailKeyFact].self, from: data) else { return [] }
        return facts
    }
}

/// `GET /api/mailbox` envelope — route `backend/routes/mailbox.js:1306`.
public struct MailboxListResponse: Decodable, Sendable, Hashable {
    public let mail: [MailItem]
    /// `GET /api/mailbox` doesn't send `count` (its totals are in `pagination`);
    /// requiring it made every decode fail, so Mail search never had mail to search.
    public let count: Int?
}

/// `GET /api/mailbox/:id` envelope — route `backend/routes/mailbox.js:1466`.
public struct MailDetailResponse: Decodable, Sendable, Hashable {
    public let mail: MailDetail

    public struct MailDetail: Decodable, Sendable, Hashable, Identifiable {
        public let item: MailItem
        public let sender: Sender?
        public let object: JSONValue?
        public let contentFormat: String?
        public let contentText: String?
        public let links: [JSONValue]
        /// `Mail.mail_extracted` (jsonb, `backend/database/schema.sql:7201`).
        /// Compose writes the ceremonial metadata here at send time —
        /// `stationeryTheme` / `inkSelection` / `voicePostscriptUri` /
        /// `outcomes` (`backend/routes/mailbox.js:586-603`, persisted at
        /// `:2017`). It is the V1 detail route's copy of the same values
        /// the V2 item route exposes under `object_payload`, and the
        /// backend itself falls back to it (`routes/mailCompose.js:556`).
        public let mailExtracted: JSONValue?
        /// Set when the letter was deleted or dismissed for the household;
        /// members who could see it open it from the notice and restore it.
        public let removed: MailRemovedDTO?
        /// The same answer read as a list row (sender shown, trust, due day),
        /// so the letter page draws the envelope as the Mailbox does.
        public let piece: DrawerItemsResponse.DrawerMail?

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
            contentText = try c.decodeIfPresent(String.self, forKey: .contentText)
            links = try c.decodeIfPresent([JSONValue].self, forKey: .links) ?? []
            mailExtracted = try c.decodeIfPresent(JSONValue.self, forKey: .mailExtracted)
            removed = try c.decodeIfPresent(MailRemovedDTO.self, forKey: .removed)
            piece = try? DrawerItemsResponse.DrawerMail(from: decoder)
        }

        /// The person who sent it, or, for a letter sent as a business, the
        /// business (`backend/utils/mailSenderView.js`): its id (nil on letters
        /// stored before the business was recorded) and name, no username.
        public struct Sender: Decodable, Sendable, Hashable, Identifiable {
            public let id: String?
            public let username: String?
            /// Raw `users.name`; nil for slim sign-up accounts.
            public let name: String?
        }

        private enum Keys: String, CodingKey {
            case sender, object
            case contentFormat = "content_format"
            case contentText = "content_text"
            case links
            case mailExtracted = "mail_extracted"
            case removed
        }
    }
}

/// `removed` on `GET /api/mailbox/:id`: `deleted` (restorable until
/// `restorable_until`, 30 days) or `dismissed` for the household.
public struct MailRemovedDTO: Decodable, Sendable, Hashable {
    public let action: String
    public let byName: String?
    public let restorableUntil: String?

    public var isDeleted: Bool {
        action == "deleted"
    }

    private enum CodingKeys: String, CodingKey {
        case action
        case byName = "by_name"
        case restorableUntil = "restorable_until"
    }
}

/// `PATCH /api/mailbox/:id/ack` response — route `backend/routes/mailbox.js:2702`.
public struct AckResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let ackStatus: String
}

/// `PATCH /api/mailbox/:id/view` response — route `backend/routes/mailbox.js:2768`.
public struct MarkMailViewedResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let alreadyViewed: Bool
}

/// `PATCH /api/mailbox/:id/archive` body — route `backend/routes/mailbox.js:2860`.
public struct ArchiveMailBody: Encodable, Sendable {
    public let archived: Bool
}

/// `PATCH /api/mailbox/:id/archive` response.
public struct ArchiveMailResponse: Decodable, Sendable, Hashable {
    public let message: String
}

/// `POST /api/mailbox/:id/restore` response.
public struct RestoreMailResponse: Decodable, Sendable, Hashable {
    public let message: String
}
