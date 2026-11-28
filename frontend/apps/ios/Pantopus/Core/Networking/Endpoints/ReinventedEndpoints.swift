//
//  ReinventedEndpoints.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 1 (CONTRACT 6): the routes only the new Pulse tab reads, under `/api/reinvented/`, and
//  only while `pulse_reinvented` is on for the person. Today's screens never send them.
//

import Foundation

public enum ReinventedEndpoints {
    /// `GET /api/reinvented/list` (CONTRACT 6a): the Moments and posts by reach, chip and cursor, with the bands.
    /// Route `backend/routes/reinvented.js:50` (list).
    static func list(
        reach: String,
        miles: Int?,
        chip: String,
        at point: (latitude: Double, longitude: Double)?,
        cursor: String?,
        circle: String? = nil,
        filters: [String: String]? = nil
    ) -> Endpoint {
        var query = ["reach": reach, "limit": "20"]
        // The filters (CONTRACT 10a: kinds, when, from, state, since) instead of the chip; with none on, today's chip.
        if let filters { query.merge(filters) { _, new in new } } else { query["chip"] = chip }
        // One of the person's circles inside Close circle (CONTRACT 8d): only its people who are in.
        if let circle { query["circle"] = circle }
        if let miles { query["miles"] = String(miles) }
        if let point {
            query["latitude"] = String(format: "%.5f", point.latitude)
            query["longitude"] = String(format: "%.5f", point.longitude)
        }
        if let cursor { query["cursor"] = cursor }
        return Endpoint(method: .get, path: "/api/reinvented/list", query: query, cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `GET /api/reinvented/map` (CONTRACT 6b): rings, marks, tickets and kept Moments for a box and a time (`live`,
    /// `today`, `week`, `all`, `tonight`, `weekend`), with the filters (CONTRACT 10a: kinds, from, state, since) when any
    /// is on. Route `backend/routes/reinvented.js:71` (map).
    static func map(
        south: Double,
        west: Double,
        north: Double,
        east: Double,
        time: String,
        filters: [String: String]? = nil
    ) -> Endpoint {
        var query = [
            "south": String(format: "%.5f", south),
            "west": String(format: "%.5f", west),
            "north": String(format: "%.5f", north),
            "east": String(format: "%.5f", east),
            "time": time
        ]
        if let filters { query.merge(filters) { old, _ in old } }
        return Endpoint(method: .get, path: "/api/reinvented/map", query: query, cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `GET /api/reinvented/strip` (CONTRACT 6c): Alive right now. Route `backend/routes/reinvented.js:91` (strip).
    static func strip(at point: (latitude: Double, longitude: Double)?) -> Endpoint {
        var query: [String: String] = [:]
        if let point {
            query["latitude"] = String(format: "%.5f", point.latitude)
            query["longitude"] = String(format: "%.5f", point.longitude)
        }
        return Endpoint(method: .get, path: "/api/reinvented/strip", query: query, cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `GET /api/reinvented/explore` (CONTRACT 6f): "Today, elsewhere", then newest with variety. The point is the
    /// reader's own, to leave their town out. Route `backend/routes/reinvented.js:110` (explore).
    static func explore(at point: (latitude: Double, longitude: Double)?, cursor: String?) -> Endpoint {
        var query: [String: String] = [:]
        if let point {
            query["latitude"] = String(format: "%.5f", point.latitude)
            query["longitude"] = String(format: "%.5f", point.longitude)
        }
        if let cursor { query["cursor"] = cursor }
        return Endpoint(method: .get, path: "/api/reinvented/explore", query: query, cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `GET /api/reinvented/atlas` (CONTRACT 6e): My Atlas by date, newest first, 30 a page. Route
    /// `backend/routes/reinvented.js` (atlas).
    static func atlas(cursor: String?) -> Endpoint {
        var query = ["limit": "30"]
        if let cursor { query["cursor"] = cursor }
        return Endpoint(method: .get, path: "/api/reinvented/atlas", query: query, cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `GET /api/reinvented/atlas` with a box (CONTRACT 6e): every kept Moment in it, for the map.
    static func atlasBox(south: Double, west: Double, north: Double, east: Double) -> Endpoint {
        let query = [
            "south": String(format: "%.5f", south), "west": String(format: "%.5f", west),
            "north": String(format: "%.5f", north), "east": String(format: "%.5f", east)
        ]
        return Endpoint(method: .get, path: "/api/reinvented/atlas", query: query, cachePolicy: .reloadIgnoringLocalCacheData)
    }

    /// `DELETE /api/reinvented/atlas/:id` (CONTRACT 6e): Delete for good. `204`; `409 MOMENT_HELD` while under review.
    static func deleteForGood(id: String) -> Endpoint {
        let id = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        return Endpoint(method: .delete, path: "/api/reinvented/atlas/\(id)")
    }
}
