//
//  HubEndpoints.swift
//  Pantopus
//

import Foundation

/// Endpoint builders for `backend/routes/hub.js`.
public enum HubEndpoints {
    /// `GET /api/hub` — route `backend/routes/hub.js:24`. Server sends
    /// `Cache-Control: no-store`, so we defensively disable client cache too.
    public static func overview() -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/hub",
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }

    /// `GET /api/hub/today` — route `backend/routes/hub.js:596`.
    public static func today() -> Endpoint {
        Endpoint(method: .get, path: "/api/hub/today")
    }

    /// `GET /api/hub/briefings/:id` — a stored Morning/Evening Briefing
    /// delivery, scoped to the signed-in user. The push notification for
    /// `morning_briefing` / `evening_briefing` carries the delivery id in
    /// `metadata.briefing_delivery_id`; opening it must resolve *that*
    /// briefing rather than refetching the live `/api/hub/today` snapshot.
    /// Route `backend/routes/hub.js:612`.
    public static func briefingDelivery(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/hub/briefings/\(id)")
    }

    /// `GET /api/hub/discovery` — route `backend/routes/hub.js:757`.
    ///
    /// T5.4.1 chip-strip filters (`since` / `verified` / `freeOrWanted`)
    /// are passed through as query params; the Discover hub VM
    /// re-fetches with the new shape per chip selection.
    public static func discovery(
        filter: String,
        lat: Double? = nil,
        lng: Double? = nil,
        limit: Int = 10,
        since: String? = nil,
        verified: Bool? = nil,
        freeOrWanted: Bool? = nil
    ) -> Endpoint {
        var query: [String: String] = ["filter": filter, "limit": String(limit)]
        if let lat { query["lat"] = String(lat) }
        if let lng { query["lng"] = String(lng) }
        if let since { query["since"] = since }
        if let verified { query["verified"] = String(verified) }
        if let freeOrWanted { query["freeOrWanted"] = String(freeOrWanted) }
        return Endpoint(method: .get, path: "/api/hub/discovery", query: query)
    }
}
