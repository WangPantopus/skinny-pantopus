//
//  MailboxEndpoints.swift
//  Pantopus
//

import Foundation

/// Endpoint builders for the V1 mailbox routes in `backend/routes/mailbox.js`.
public enum MailboxEndpoints {
    /// `GET /api/mailbox` — route `backend/routes/mailbox.js:1306`.
    public static func list(
        type: String? = nil,
        viewed: Bool? = nil,
        archived: Bool = false,
        starred: Bool? = nil,
        limit: Int = 50,
        offset: Int = 0,
        scope: String = "personal",
        homeId: String? = nil
    ) -> Endpoint {
        var query: [String: String] = [
            "archived": String(archived),
            "limit": String(limit),
            "offset": String(offset),
            "scope": scope
        ]
        if let type { query["type"] = type }
        if let viewed { query["viewed"] = String(viewed) }
        if let starred { query["starred"] = String(starred) }
        if let homeId { query["homeId"] = homeId }
        return Endpoint(method: .get, path: "/api/mailbox", query: query)
    }

    /// `GET /api/mailbox/:id` — route `backend/routes/mailbox.js:1466`.
    public static func detail(mailId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/\(mailId)")
    }

    /// `PATCH /api/mailbox/:id/ack` — route `backend/routes/mailbox.js:2702`.
    public static func acknowledge(mailId: String) -> Endpoint {
        Endpoint(method: .patch, path: "/api/mailbox/\(mailId)/ack")
    }

    /// `GET /api/mailbox/earnings/summary` — route
    /// `backend/routes/mailbox.js:2899`. `{ pendingEarnings, totalEarned,
    /// currency }`. Backs the Earn dashboard's balance hero.
    public static func earningsSummary() -> Endpoint {
        Endpoint(method: .get, path: "/api/mailbox/earnings/summary")
    }

    /// `GET /api/mailbox/earnings/history` — route
    /// `backend/routes/mailbox.js:2935`. Paginated ad-view payout rows;
    /// backs the Earn dashboard's recent-earnings list.
    public static func earningsHistory(limit: Int = 50, offset: Int = 0) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/mailbox/earnings/history",
            query: ["limit": String(limit), "offset": String(offset)]
        )
    }
}
