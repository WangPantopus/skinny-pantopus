//
//  NotificationsDTOs.swift
//  Pantopus
//
//  Decoder shapes for `/api/notifications/*`.
//

import Foundation

public struct NotificationsListResponse: Decodable, Sendable {
    public let notifications: [NotificationDTO]
    public let unreadCount: Int?
    public let hasMore: Bool?

    private enum CodingKeys: String, CodingKey {
        case notifications, unreadCount, hasMore
    }

    /// A notice this build can't read is left out; the rest show (Pulse S2).
    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        notifications = c.lossyList(NotificationDTO.self, forKey: .notifications)
        unreadCount = c.lenient(Int.self, forKey: .unreadCount)
        hasMore = c.lenient(Bool.self, forKey: .hasMore)
    }
}

public struct NotificationDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let userId: String?
    public let type: String?
    public let title: String?
    public let body: String?
    public let icon: String?
    /// Backend-emitted deep link path, e.g. `/post/abc-123`,
    /// `/homes/h_1/dashboard`. DeepLinkRouter parses this.
    public let link: String?
    public let isRead: Bool?
    public let createdAt: String?
    public let context: String?
    public var metadata: HomeTaskNotificationMetadata?

    enum CodingKeys: String, CodingKey {
        case id, type, title, body, icon, link, context, metadata
        case userId = "user_id"
        case isRead = "is_read"
        case createdAt = "created_at"
    }
}

public extension NotificationDTO {
    /// Tolerant (Pulse S2): only `id` is required; a field that is missing,
    /// null or of another shape reads as absent. An unknown `type` stays a
    /// string and lands in the general bucket. (In an extension, so the
    /// memberwise initializer stays.)
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        try self.init(
            id: c.decode(String.self, forKey: .id),
            userId: c.lenient(String.self, forKey: .userId),
            type: c.lenient(String.self, forKey: .type),
            title: c.lenient(String.self, forKey: .title),
            body: c.lenient(String.self, forKey: .body),
            icon: c.lenient(String.self, forKey: .icon),
            link: c.lenient(String.self, forKey: .link),
            isRead: c.lenient(Bool.self, forKey: .isRead),
            createdAt: c.lenient(String.self, forKey: .createdAt),
            context: c.lenient(String.self, forKey: .context),
            metadata: c.lenient(HomeTaskNotificationMetadata.self, forKey: .metadata)
        )
    }
}

/// Per-firewall unread breakdown returned by
/// `GET /api/notifications/unread-count`
/// (`backend/routes/notifications.js:187-193`).
public struct NotificationContextCounts: Decodable, Sendable, Hashable {
    public let personal: Int
    public let audience: Int
    public let platform: Int

    public init(personal: Int = 0, audience: Int = 0, platform: Int = 0) {
        self.personal = personal
        self.audience = audience
        self.platform = platform
    }
}

public struct NotificationUnreadCountResponse: Decodable, Sendable {
    public let count: Int
    /// P2.3 split — `nil` on older deployments that only returned `count`.
    public let byContext: NotificationContextCounts?

    public init(count: Int, byContext: NotificationContextCounts? = nil) {
        self.count = count
        self.byContext = byContext
    }

    /// What the hub bell's dot counts: unread personal + platform
    /// notifications, like the web personal-zone bell. Older deployments
    /// only return the total.
    public var personalBellCount: Int {
        guard let byContext else { return count }
        return byContext.personal + byContext.platform
    }
}

public struct NotificationActionEcho: Decodable, Sendable {
    public let ok: Bool?
    public let count: Int?
}
