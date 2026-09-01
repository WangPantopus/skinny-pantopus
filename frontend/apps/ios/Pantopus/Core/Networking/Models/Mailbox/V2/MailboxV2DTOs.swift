//
//  MailboxV2DTOs.swift
//  Pantopus
//
//  DTOs for the V2 mailbox endpoints in `backend/routes/mailboxV2.js`.
//

import Foundation

/// `GET /api/mailbox/v2/drawers` envelope — route `backend/routes/mailboxV2.js:214`.
public struct DrawerListResponse: Decodable, Sendable, Hashable {
    public let drawers: [Drawer]

    public struct Drawer: Decodable, Sendable, Hashable, Identifiable {
        public let drawer: String
        public let displayName: String
        public let icon: String
        public let unreadCount: Int
        public let urgentCount: Int
        public let lastItemAt: String?

        public var id: String {
            drawer
        }

        private enum CodingKeys: String, CodingKey {
            case drawer
            case displayName = "display_name"
            case icon
            case unreadCount = "unread_count"
            case urgentCount = "urgent_count"
            case lastItemAt = "last_item_at"
        }
    }
}

/// `GET /api/mailbox/v2/drawer/:drawer` envelope — route `backend/routes/mailboxV2.js:280`.
public struct DrawerItemsResponse: Decodable, Sendable, Hashable {
    public let mail: [DrawerMail]
    public let total: Int
    public let drawer: String

    public struct DrawerMail: Decodable, Sendable, Hashable, Identifiable {
        public let item: MailItem
        public let sender: SenderRef?
        public let senderDisplay: String
        public let senderTrust: String
        public let package: JSONValue?

        public var id: String {
            item.id
        }

        public init(from decoder: any Decoder) throws {
            item = try MailItem(from: decoder)
            let c = try decoder.container(keyedBy: Keys.self)
            sender = try c.decodeIfPresent(SenderRef.self, forKey: .sender)
            senderDisplay = try c.decode(String.self, forKey: .senderDisplay)
            senderTrust = try c.decode(String.self, forKey: .senderTrust)
            package = try c.decodeIfPresent(JSONValue.self, forKey: .package)
        }

        private enum Keys: String, CodingKey {
            case sender
            case senderDisplay = "sender_display"
            case senderTrust = "sender_trust"
            case package
        }

        public struct SenderRef: Decodable, Sendable, Hashable {
            public let name: String?
            public let username: String?
        }
    }
}

/// `GET /api/mailbox/v2/item/:id` envelope — route `backend/routes/mailboxV2.js:366`.
public struct MailboxV2ItemResponse: Decodable, Sendable, Hashable {
    public let mail: Item

    public struct Item: Decodable, Sendable, Hashable, Identifiable {
        public let base: MailItem
        public let sender: DrawerItemsResponse.DrawerMail.SenderRef?
        public let senderDisplay: String
        public let senderTrust: String
        public let package: JSONValue?
        public let packageInfo: JSONValue?
        public let packageTimeline: [JSONValue]
        public let objectPayload: JSONValue?

        public var id: String {
            base.id
        }

        public init(from decoder: any Decoder) throws {
            base = try MailItem(from: decoder)
            let c = try decoder.container(keyedBy: Keys.self)
            sender = try c.decodeIfPresent(DrawerItemsResponse.DrawerMail.SenderRef.self, forKey: .sender)
            senderDisplay = try c.decode(String.self, forKey: .senderDisplay)
            senderTrust = try c.decode(String.self, forKey: .senderTrust)
            package = try c.decodeIfPresent(JSONValue.self, forKey: .package)
            packageInfo = try c.decodeIfPresent(JSONValue.self, forKey: .packageInfo)
            packageTimeline = try c.decodeIfPresent([JSONValue].self, forKey: .packageTimeline) ?? []
            objectPayload = try c.decodeIfPresent(JSONValue.self, forKey: .objectPayload)
        }

        private enum Keys: String, CodingKey {
            case sender
            case senderDisplay = "sender_display"
            case senderTrust = "sender_trust"
            case package
            case packageInfo // backend: column on Mail (rare); currently no override
            case packageTimeline = "timeline" // backend response key
            case objectPayload = "object_payload" // backend response key (P18 fix)
        }
    }
}

/// `POST /api/mailbox/v2/item/:id/action` request body. Route:
/// `backend/routes/mailboxV2.js:459`.
public struct MailboxItemActionRequest: Encodable, Sendable {
    /// One of: `pay`, `sign`, `forward`, `file`, `shred`, `remind`, `split`,
    /// `acknowledge`, `share_household`, `create_task`, `dispute`.
    public let action: String

    public init(action: String) {
        self.action = action
    }
}

/// `POST /api/mailbox/v2/item/:id/action` response.
public struct MailboxItemActionResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let action: String
}

/// `GET /api/mailbox/v2/package/:mailId` envelope — route
/// `backend/routes/mailboxV2.js:634`. The `package` and `timeline` elements
/// are rich rows whose columns evolve; they're exposed as `JSONValue` to
/// avoid drift between the server schema and the mobile clients.
public struct PackageDetailResponse: Decodable, Sendable, Hashable {
    public let package: JSONValue
    public let timeline: [JSONValue]
    public let sender: Sender?

    public struct Sender: Decodable, Sendable, Hashable {
        public let display: String
        public let trust: String
    }
}

/// `PATCH /api/mailbox/v2/package/:mailId/status` request.
public struct PackageStatusUpdateRequest: Encodable, Sendable {
    /// One of: `pre_receipt`, `in_transit`, `out_for_delivery`,
    /// `delivered`, `exception`.
    public let status: String
    public let location: String?
    public let photoUrl: String?
    public let deliveryLocationNote: String?

    public init(
        status: String,
        location: String? = nil,
        photoUrl: String? = nil,
        deliveryLocationNote: String? = nil
    ) {
        self.status = status
        self.location = location
        self.photoUrl = photoUrl
        self.deliveryLocationNote = deliveryLocationNote
    }
}

/// `PATCH /api/mailbox/v2/package/:mailId/status` response.
public struct PackageStatusUpdateResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let status: String
    public let previousStatus: String
}
