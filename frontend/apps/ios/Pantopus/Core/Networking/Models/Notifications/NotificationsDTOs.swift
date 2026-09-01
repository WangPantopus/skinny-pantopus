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

    enum CodingKeys: String, CodingKey {
        case id, type, title, body, icon, link, context
        case userId = "user_id"
        case isRead = "is_read"
        case createdAt = "created_at"
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
}

public struct NotificationActionEcho: Decodable, Sendable {
    public let ok: Bool?
    public let count: Int?
}
