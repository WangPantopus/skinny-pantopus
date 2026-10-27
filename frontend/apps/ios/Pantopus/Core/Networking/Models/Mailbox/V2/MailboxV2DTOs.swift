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
    /// The Mail tab badge: unopened, delivered pieces in Me + Home + Biz that
    /// this person can read (Mail build contract v1). Absent from older servers.
    public let unreadTotal: Int?
    /// The morning round: the latest one that brought this person mail, its
    /// size, and the next one. Absent from older servers.
    public let delivery: MailDelivery?
    /// The Homes this person lives at, and whether their mail is open yet.
    public let homes: [MailboxHome]
    /// The vacation hold in effect, or the next one; nil when none (SRV-5).
    public let vacationHold: MailVacationHold?

    private enum CodingKeys: String, CodingKey {
        case drawers
        case unreadTotal = "unread_total"
        case delivery
        case homes
        case vacationHold = "vacation_hold"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        drawers = try c.decode([Drawer].self, forKey: .drawers)
        unreadTotal = try? c.decodeIfPresent(Int.self, forKey: .unreadTotal)
        delivery = try? c.decodeIfPresent(MailDelivery.self, forKey: .delivery)
        homes = (try? c.decodeIfPresent([MailboxHome].self, forKey: .homes)) ?? []
        vacationHold = try? c.decodeIfPresent(MailVacationHold.self, forKey: .vacationHold)
    }

    /// A vacation hold (Mail build contract, SRV-5): `scheduled` or `active`,
    /// its days (`YYYY-MM-DD`), the pieces it keeps now, and when they come.
    public struct MailVacationHold: Decodable, Sendable, Hashable {
        public let status: String?
        public let startDate: String?
        public let endDate: String?
        public let heldCount: Int
        public let releaseAt: String?

        private enum CodingKeys: String, CodingKey {
            case status
            case startDate = "start_date"
            case endDate = "end_date"
            case heldCount = "held_count"
            case releaseAt = "release_at"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            status = try? c.decodeIfPresent(String.self, forKey: .status)
            startDate = try? c.decodeIfPresent(String.self, forKey: .startDate)
            endDate = try? c.decodeIfPresent(String.self, forKey: .endDate)
            heldCount = (try? c.decodeIfPresent(Int.self, forKey: .heldCount)) ?? 0
            releaseAt = try? c.decodeIfPresent(String.self, forKey: .releaseAt)
        }

        public var isActive: Bool {
            status == "active"
        }
    }

    /// The person's mailbox round (Mail build contract, SRV-1).
    public struct MailDelivery: Decodable, Sendable, Hashable {
        /// The latest morning round that brought this person a piece, or nil (never).
        public let lastAt: String?
        /// Pieces that came in the 24 hours up to that round, and how many are still unopened.
        public let lastCount: Int
        public let lastUnopened: Int
        /// The next round of the person's own mailbox.
        public let nextAt: String?
        /// The person's own mailbox time zone (IANA).
        public let timeZone: String?

        private enum CodingKeys: String, CodingKey {
            case lastAt = "last_at"
            case lastCount = "last_count"
            case lastUnopened = "last_unopened"
            case nextAt = "next_at"
            case timeZone = "time_zone"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            lastAt = try? c.decodeIfPresent(String.self, forKey: .lastAt)
            lastCount = (try? c.decodeIfPresent(Int.self, forKey: .lastCount)) ?? 0
            lastUnopened = (try? c.decodeIfPresent(Int.self, forKey: .lastUnopened)) ?? 0
            nextAt = try? c.decodeIfPresent(String.self, forKey: .nextAt)
            timeZone = try? c.decodeIfPresent(String.self, forKey: .timeZone)
        }
    }

    /// A Home the person lives at (SRV-8): `mail_access` is `open`, or
    /// `needs_proof` until they prove the address.
    public struct MailboxHome: Decodable, Sendable, Hashable, Identifiable {
        public let homeId: String
        public let addressLine: String?
        public let name: String?
        public let mailAccess: String

        public var id: String {
            homeId
        }

        public var isOpen: Bool {
            mailAccess == "open"
        }

        private enum CodingKeys: String, CodingKey {
            case homeId = "home_id"
            case addressLine = "address_line"
            case name
            case mailAccess = "mail_access"
        }
    }

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
        /// `Mail.due_date`: the calendar day a bill or notice is due ("2026-10-20").
        public let dueDate: String?

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
            dueDate = try c.decodeIfPresent(String.self, forKey: .dueDate)
        }

        private enum Keys: String, CodingKey {
            case sender
            case senderDisplay = "sender_display"
            case senderTrust = "sender_trust"
            case package
            case dueDate = "due_date"
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
        /// A bundle's pieces this person may read, newest first (bundle only).
        public let pieces: [DrawerItemsResponse.DrawerMail]

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
            pieces = (try? c.decodeIfPresent([DrawerItemsResponse.DrawerMail].self, forKey: .pieces)) ?? []
        }

        private enum Keys: String, CodingKey {
            case sender
            case senderDisplay = "sender_display"
            case senderTrust = "sender_trust"
            case package
            case packageInfo // backend: column on Mail (rare); currently no override
            case packageTimeline = "timeline" // backend response key
            case objectPayload = "object_payload" // backend response key (P18 fix)
            case pieces
        }
    }
}

/// `POST /api/mailbox/v2/item/:id/action` request body. Route:
/// `backend/routes/mailboxV2.js:459`.
public struct MailboxItemActionRequest: Encodable, Sendable {
    /// One of: `pay`, `sign`, `forward`, `file`, `shred`, `remind`, `split`,
    /// `acknowledge`, `share_household`, `create_task`, `dispute`.
    public let action: String
    /// `file` and `done`: the Vault folder to file it in (the server picks one when nil).
    public let folderId: String?

    public init(action: String, folderId: String? = nil) {
        self.action = action
        self.folderId = folderId
    }

    private enum CodingKeys: String, CodingKey {
        case action
        case folderId = "folder_id"
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
