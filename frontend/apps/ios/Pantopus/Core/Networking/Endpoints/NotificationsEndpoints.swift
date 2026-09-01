//
//  NotificationsEndpoints.swift
//  Pantopus
//
//  T4.1 Notifications center endpoints. Backed by
//  `backend/routes/notifications.js`.
//

import Foundation

public enum NotificationsEndpoints {
    /// `GET /api/notifications?limit=&offset=&unread=&context=` — route
    /// `backend/routes/notifications.js:85`.
    ///
    /// `context` is the P2.3 identity-firewall filter. The handler
    /// validates it against `['all', 'personal', 'audience', 'platform']`
    /// (`backend/routes/notifications.js:21-22, 97-104`) and 400s on a
    /// typo, so only pass a `NotificationContext` raw value.
    public static func list(
        limit: Int = 20,
        offset: Int = 0,
        unreadOnly: Bool = false,
        context: String? = nil
    ) -> Endpoint {
        var query: [String: String] = [
            "limit": String(limit),
            "offset": String(offset)
        ]
        if unreadOnly { query["unread"] = "true" }
        if let context, !context.isEmpty { query["context"] = context }
        return Endpoint(method: .get, path: "/api/notifications", query: query)
    }

    /// `GET /api/notifications/unread-count` — route
    /// `backend/routes/notifications.js:160`. Drives the bell badge.
    public static let unreadCount = Endpoint(method: .get, path: "/api/notifications/unread-count")

    /// `PATCH /api/notifications/:id/read` — route
    /// `backend/routes/notifications.js:381`. Mark one as read.
    public static func markRead(id: String) -> Endpoint {
        Endpoint(method: .patch, path: "/api/notifications/\(id)/read")
    }

    /// `POST /api/notifications/read-all` — route
    /// `backend/routes/notifications.js:412`. Mark every unread row
    /// as read for the current user.
    ///
    /// `contexts` scopes the sweep to the zone the user is looking at —
    /// the handler reads `req.body.contexts` through
    /// `parseFirewallFilter(req, { allowMultiple: true })`
    /// (`backend/routes/notifications.js:25-44, 420`). Passing `nil`
    /// (or `["all"]`) clears every zone, which is what the unscoped
    /// list wants.
    public static func markAllRead(contexts: [String]? = nil) -> Endpoint {
        guard let contexts, !contexts.isEmpty else {
            return Endpoint(method: .post, path: "/api/notifications/read-all")
        }
        return Endpoint(
            method: .post,
            path: "/api/notifications/read-all",
            body: MarkAllNotificationsReadBody(contexts: contexts)
        )
    }

    /// `DELETE /api/notifications/:id` — route
    /// `backend/routes/notifications.js:452`. Deletes a single
    /// notification owned by the current user.
    public static func delete(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/notifications/\(id)")
    }
}

/// `POST /api/notifications/read-all` body. The handler accepts
/// `context` / `contexts` / `firewall`; we always send the plural form
/// so the Personal zone (`personal` + `platform`) can be swept in one
/// call. See `backend/routes/notifications.js:26-29`.
public struct MarkAllNotificationsReadBody: Encodable, Sendable {
    public let contexts: [String]

    public init(contexts: [String]) {
        self.contexts = contexts
    }
}
