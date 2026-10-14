//
//  PulseEndpoints.swift
//  Pantopus
//
//  The Pulse routes under `/api/pulse` (`backend/routes/pulse.js`,
//  docs/product/pulse-build/02-contract.md). Requests are camelCase,
//  responses snake_case.
//

import Foundation

/// Endpoints of the Pulse build's own routes.
public enum PulseEndpoints {
    /// Route `backend/routes/pulse.js:18`: the primary home's open areas.
    public static func myAreas() -> Endpoint {
        Endpoint(method: .get, path: "/api/pulse/areas/mine")
    }

    /// Route `backend/routes/pulse.js:27`: open towns, without device coordinates.
    public static func searchAreas(query: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/pulse/areas/search", query: ["q": query])
    }

    /// `POST /api/pulse/posts/:postId/keep-open` — the asker keeps an open Ask
    /// open 7 more days, once (contract §2.12). Route `backend/routes/pulse.js:98`.
    public static func keepAskOpen(postId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/pulse/posts/\(postId)/keep-open")
    }

    /// `POST /api/pulse/posts/:postId/close` — the asker closes an open Ask:
    /// `closed`, or `closed_unanswered` when nobody else replied (contract
    /// §2.12). Route `backend/routes/pulse.js:142`.
    public static func closeAsk(postId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/pulse/posts/\(postId)/close")
    }

    /// `GET /api/pulse/feed` — the Pulse page (contract §2.3): `view`
    /// (`nearby` or `following`), an optional `topic` and `area_id`, and
    /// `earlier_before` for "Show earlier". PB's S6 route in
    /// `backend/routes/pulse.js` (not on `master` yet).
    public static func feed(
        view: String,
        topic: String? = nil,
        areaId: String? = nil,
        earlierBefore: String? = nil
    ) -> Endpoint {
        var query = ["view": view]
        if let topic { query["topic"] = topic }
        if let areaId { query["area_id"] = areaId }
        if let earlierBefore { query["earlier_before"] = earlierBefore }
        return Endpoint(method: .get, path: "/api/pulse/feed", query: query)
    }

    /// `GET /api/pulse/feed/new` — how many conversations arrived after
    /// `after`, for "↑ N new conversations" (contract §2.3). PB's S6 route.
    public static func feedNewCount(view: String, topic: String?, areaId: String? = nil, after: String) -> Endpoint {
        var query = ["view": view, "after": after]
        if let topic { query["topic"] = topic }
        if let areaId { query["area_id"] = areaId }
        return Endpoint(method: .get, path: "/api/pulse/feed/new", query: query)
    }

    /// `POST /api/pulse/feed/seen` — moves the last-seen marker once the end
    /// of the page has been on screen, never earlier (contract §2.3). PB's
    /// S6 route.
    public static func markFeedSeen(view: String, through: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/pulse/feed/seen",
            body: PulseFeedSeenRequest(view: view, through: through)
        )
    }
}
