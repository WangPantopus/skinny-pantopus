//
//  PlansEndpoints.swift
//  Pantopus
//
//  Nearby Plans: every `/api/plans` route, the `plans` layer of the map
//  route and the two feature flags (Plans build brief, section 5; the
//  contract and its changes live in the Plans coordination folder's
//  CONTRACT.md). Every Plans route is signed in and answers 404 while the
//  `plans` flag is off for the viewer. Errors are
//  `{ error: <code>, message: <sentence for people> }`.
//
//  Route: backend/routes/plans.js (mounted at `/api/plans`), and the
//  `plans` layer of `GET /api/posts/map` in backend/routes/posts.js.
//

import Foundation

/// The time windows the map and the list filter by.
public enum PlansWindow: String, Sendable, CaseIterable {
    case now, today, week, weekend
}

/// A device fix under 5 minutes old: it counts as a location for asking
/// (`can_ask`); homes and saved places always count.
public struct PlansGPS: Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double
    public let timestamp: Date

    public init(latitude: Double, longitude: Double, timestamp: Date) {
        self.latitude = latitude
        self.longitude = longitude
        self.timestamp = timestamp
    }

    /// Rounded to the minute so store keys stay stable between reads.
    var query: [String: String] {
        let minute = Date(timeIntervalSince1970: (timestamp.timeIntervalSince1970 / 60).rounded(.down) * 60)
        return [
            "gps_latitude": String(latitude),
            "gps_longitude": String(longitude),
            "gps_timestamp": PlanTime.string(minute)
        ]
    }
}

/// The map's visible box, for the pins read.
public struct PlansViewport: Sendable, Hashable {
    public let south: Double
    public let west: Double
    public let north: Double
    public let east: Double

    public init(south: Double, west: Double, north: Double, east: Double) {
        self.south = south
        self.west = west
        self.north = north
        self.east = east
    }
}

public enum PlansEndpoints {
    static let base = "/api/plans"

    // MARK: - Flags

    /// `GET /api/feature-flags/:flagName` — `{ flagName, enabled }`. Honors
    /// `enabled_for_internal_team` and `beta_user_ids` for the viewer.
    /// Route `backend/routes/featureFlags.js:30`.
    public static func flag(_ name: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/feature-flags/\(name)")
    }

    // MARK: - Reading

    /// `GET /api/posts/map?layers=plans` — the pins. The area point for
    /// everyone, the exact point for the host and people who are in;
    /// playdates only for verified viewers with `plans_playdates` on.
    /// Route `backend/routes/posts.js` (`/map`, `plans` layer).
    public static func pins(_ viewport: PlansViewport, kinds: [PlanKind] = [], window: PlansWindow = .week) -> Endpoint {
        var query: [String: String] = [
            "south": String(viewport.south),
            "west": String(viewport.west),
            "north": String(viewport.north),
            "east": String(viewport.east),
            "layers": "plans",
            "window": window.rawValue
        ]
        if !kinds.isEmpty { query["kinds"] = kinds.map(\.rawValue).joined(separator: ",") }
        return Endpoint(method: .get, path: "/api/posts/map", query: query)
    }

    /// `GET /api/plans?latitude&longitude&window&kinds&cursor` — the list
    /// under the map, `{ items: [PlanCard], next_cursor }`, soonest first.
    /// Route `backend/routes/plans.js` (`GET /`).
    public static func list(
        latitude: Double,
        longitude: Double,
        window: PlansWindow = .week,
        kinds: [PlanKind] = [],
        gps: PlansGPS? = nil,
        cursor: String? = nil
    ) -> Endpoint {
        var query: [String: String] = [
            "latitude": String(latitude),
            "longitude": String(longitude),
            "window": window.rawValue
        ]
        if let gps { query.merge(gps.query) { $1 } }
        if !kinds.isEmpty { query["kinds"] = kinds.map(\.rawValue).joined(separator: ",") }
        if let cursor, !cursor.isEmpty { query["cursor"] = cursor }
        return Endpoint(method: .get, path: base, query: query)
    }

    /// `GET /api/plans/mine` — `{ hosting, going, asked, waitlisted }` of
    /// PlanCards, for "Your plans" and Today. Route `backend/routes/plans.js`.
    public static func mine() -> Endpoint {
        Endpoint(method: .get, path: "\(base)/mine")
    }

    /// `GET /api/plans/:id` — a PlanDetail for the host and people who are
    /// in, a PlanCard for everyone else allowed to see it, 404 otherwise.
    /// Read it with the `sensitive` store kind. Route `backend/routes/plans.js`.
    public static func detail(id: String, from center: UserCoordinate? = nil, gps: PlansGPS? = nil) -> Endpoint {
        var query: [String: String] = [:]
        if let center {
            query["latitude"] = String(center.latitude)
            query["longitude"] = String(center.longitude)
        }
        if let gps { query.merge(gps.query) { $1 } }
        return Endpoint(method: .get, path: "\(base)/\(id)", query: query)
    }

    /// `GET /api/plans/:id/requests` (host only) — `{ pending, waitlisted }`.
    /// Never an address. Route `backend/routes/plans.js`.
    public static func requests(planId: String) -> Endpoint {
        Endpoint(method: .get, path: "\(base)/\(planId)/requests")
    }

    /// `GET /api/plans/games` — games in the next 14 days from the checked
    /// list kept in the backend. Route `backend/routes/plans.js`.
    public static func games() -> Endpoint {
        Endpoint(method: .get, path: "\(base)/games")
    }

    /// `GET /api/plans/places/nearby` — public places for H6, cached per
    /// area for 24 hours on the server. Route `backend/routes/plans.js`.
    public static func nearbyPlaces(latitude: Double, longitude: Double, query text: String? = nil) -> Endpoint {
        var query = ["latitude": String(latitude), "longitude": String(longitude)]
        // `q` filters the same public places by name (never a street address).
        if let text, !text.isEmpty { query["q"] = text }
        return Endpoint(method: .get, path: "\(base)/places/nearby", query: query)
    }

    // MARK: - Hosting

    /// `POST /api/plans` — returns PlanDetail (201). Errors: `not_near`
    /// (403), `needs_verified_address` (403), `too_many_plans` (429),
    /// validation (422). Route `backend/routes/plans.js`.
    public static func create(_ body: CreatePlanBody) -> Endpoint {
        Endpoint(method: .post, path: base, body: body)
    }

    /// `PATCH /api/plans/:id` — host edits. Route `backend/routes/plans.js`.
    public static func update(id: String, _ body: UpdatePlanBody) -> Endpoint {
        Endpoint(method: .patch, path: "\(base)/\(id)", body: body)
    }

    /// `POST /api/plans/:id/cancel` — tells everyone in and waiting, closes
    /// the chat, removes the pin. Route `backend/routes/plans.js`.
    public static func cancel(id: String, note: String?) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(id)/cancel", body: CancelPlanBody(note: note))
    }

    /// `POST /api/plans/:id/requests/:requestId/accept` — idempotent; 409
    /// `full` when full. At home the first accept needs
    /// `confirm_shares_address: true`. Route `backend/routes/plans.js`.
    public static func accept(planId: String, requestId: String, confirmSharesAddress: Bool? = nil) -> Endpoint {
        Endpoint(
            method: .post,
            path: "\(base)/\(planId)/requests/\(requestId)/accept",
            body: AcceptPlanRequestBody(confirmSharesAddress: confirmSharesAddress)
        )
    }

    /// `POST /api/plans/:id/requests/:requestId/decline` — idempotent.
    /// Route `backend/routes/plans.js`.
    public static func decline(planId: String, requestId: String) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(planId)/requests/\(requestId)/decline")
    }

    /// `POST /api/plans/:id/requests/:requestId/remove` — the guest loses the
    /// plan, the note and the chat. Route `backend/routes/plans.js`.
    public static func remove(planId: String, requestId: String) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(planId)/requests/\(requestId)/remove")
    }

    // MARK: - Joining

    /// `POST /api/plans/:id/requests` — ask to join. A matching rule accepts
    /// at once. Idempotent per person per plan. Route `backend/routes/plans.js`.
    public static func ask(planId: String, _ body: AskToJoinBody) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(planId)/requests", body: body)
    }

    /// `DELETE /api/plans/:id/requests/mine` — withdraw (pending or
    /// waitlisted) or leave (accepted). Route `backend/routes/plans.js`.
    public static func withdraw(planId: String) -> Endpoint {
        Endpoint(method: .delete, path: "\(base)/\(planId)/requests/mine")
    }

    /// `POST /api/plans/:id/on-my-way` — a line in the chat, no push.
    /// Route `backend/routes/plans.js`.
    public static func onMyWay(planId: String) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(planId)/on-my-way")
    }

    /// `POST /api/plans/:id/still-coming` — `false` leaves the plan.
    /// Route `backend/routes/plans.js`.
    public static func stillComing(planId: String, coming: Bool) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(planId)/still-coming", body: PlanStillComingBody(coming: coming))
    }

    /// `POST /api/plans/:id/report` — `{ reason, details? }` into the admin
    /// report queue (the generic post report can't see plan posts).
    /// Route `backend/routes/plans.js`.
    public static func report(planId: String, reason: String, details: String? = nil) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(planId)/report", body: PostReportRequest(reason: reason, details: details))
    }

    /// `POST /api/plans/:id/feedback` — `not_right` files a report in the
    /// admin queue. Route `backend/routes/plans.js`.
    public static func feedback(planId: String, _ body: PlanFeedbackBody) -> Endpoint {
        Endpoint(method: .post, path: "\(base)/\(planId)/feedback", body: body)
    }
}
