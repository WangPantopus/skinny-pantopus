//
//  SupportTrainsEndpoints.swift
//  Pantopus
//
//  T6.6c (P26.5) — Support trains read endpoints. The full Support
//  Trains backend exposes 39 routes under `backend/routes/supportTrains.js`;
//  this file wires the two list-feed endpoints powering the My-trains
//  and Nearby tabs, plus the helper-reservations feed driving the
//  Review-signups screen. The write half lives in
//  `SupportTrainActionsEndpoints.swift`.
//
//  S1 PREFIX FIX: these paths used to target `/api/support-trains/…`.
//  `backend/app.js:404` mounts the router at
//  `/api/activities/support-trains` and the backend carries no alias for
//  the shorter prefix (`grep -rn "api/support-trains" backend` → no
//  hits), so every one of these calls 404'd. They now compose the real
//  mount, matching the RN client (`packages/api/src/endpoints/
//  supportTrains.ts:30`).
//

import Foundation

public enum SupportTrainsEndpoints {
    /// User-side feed of Support Trains the caller participates in
    /// (organizer or helper).
    ///
    /// Route: `backend/routes/supportTrains.js:445` —
    /// `GET /api/activities/support-trains/me/support-trains`.
    public static func mine(
        role: SupportTrainRoleFilter? = nil,
        status: String? = nil,
        limit: Int = 20,
        offset: Int = 0
    ) -> Endpoint {
        var query: [String: String] = [
            "limit": String(limit),
            "offset": String(offset)
        ]
        if let role { query["role"] = role.rawValue }
        if let status { query["status"] = status }
        return Endpoint(
            method: .get,
            path: "/api/activities/support-trains/me/support-trains",
            query: query
        )
    }

    /// Nearby Support Trains feed (radius defaults to 25 mi on the
    /// backend; pass an explicit `radiusMeters` to override).
    ///
    /// Route: `backend/routes/supportTrains.js:570` —
    /// `GET /api/activities/support-trains/nearby`.
    public static func nearby(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double? = nil,
        limit: Int = 40
    ) -> Endpoint {
        var query: [String: String] = [
            "latitude": String(latitude),
            "longitude": String(longitude),
            "limit": String(limit)
        ]
        if let radiusMeters {
            query["radius_meters"] = String(radiusMeters)
        }
        return Endpoint(
            method: .get,
            path: "/api/activities/support-trains/nearby",
            query: query
        )
    }

    /// Organizer-only feed of pending / confirmed helper reservations for
    /// one Support Train. Powers the Review-signups screen.
    ///
    /// Route: `backend/routes/supportTrains.js:3306` —
    /// `GET /api/activities/support-trains/:id/reservations`.
    public static func reservations(supportTrainId: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/activities/support-trains/\(supportTrainId)/reservations"
        )
    }

    /// Create a new Support Train (status `draft`). P2.6 — the
    /// Start-a-Support-Train wizard fires this on launch, then
    /// `addSlot` for each generated slot, then `publish`.
    ///
    /// Route: `backend/routes/supportTrains.js:639` —
    /// `POST /api/activities/support-trains/`.
    public static func create(body: CreateSupportTrainBody) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/activities/support-trains",
            body: body
        )
    }

    /// Append one custom slot to a Support Train. The wizard calls
    /// this once per generated slot so the user can edit dates in
    /// step 2 and see the preview rebuild before launch.
    ///
    /// Route: `backend/routes/supportTrains.js:921` —
    /// `POST /api/activities/support-trains/:id/slots`.
    public static func addSlot(
        supportTrainId: String,
        body: AddSupportTrainSlotBody
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/activities/support-trains/\(supportTrainId)/slots",
            body: body
        )
    }

    /// Flip the draft to `published` so neighbors / connections can
    /// sign up. Fires last in the wizard's launch sequence.
    ///
    /// Route: `backend/routes/supportTrains.js:1236` —
    /// `POST /api/activities/support-trains/:id/publish`.
    public static func publish(supportTrainId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/activities/support-trains/\(supportTrainId)/publish"
        )
    }

    /// Participant-facing Support Train detail (A10.9 Detail screen).
    /// Privacy-gated — slots, my-reservations, updates and organizers come
    /// back scoped to the viewer's role.
    ///
    /// Route: `backend/routes/supportTrains.js:3444` — `GET /:id`.
    ///
    /// PREFIX NOTE (resolved in S1): the family used to target
    /// `/api/support-trains/…`; the router is mounted at
    /// `/api/activities/support-trains` (`backend/app.js:404`) and no
    /// alias exists, so every helper in this file now composes the real
    /// mount.
    public static func detail(supportTrainId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/activities/support-trains/\(supportTrainId)")
    }

    /// Broadcast an update to the train's helpers / followers (A13.13
    /// Manage → Send update). Body validated by `createUpdateSchema`
    /// (`body` 1–5000 chars, optional `media_urls`).
    ///
    /// Route: `backend/routes/supportTrains.js:1581` — `POST /:id/updates`.
    public static func postUpdate(supportTrainId: String, body: SupportTrainUpdateBody) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/activities/support-trains/\(supportTrainId)/updates",
            body: body
        )
    }

    /// Mark the train completed (A13.13 Manage → Close train). Primary
    /// organizer only; valid from `published` / `active` / `paused`.
    ///
    /// Route: `backend/routes/supportTrains.js:1508` — `POST /:id/complete`.
    public static func complete(supportTrainId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/activities/support-trains/\(supportTrainId)/complete"
        )
    }
}

/// Role filter for the `me/support-trains` feed.
public enum SupportTrainRoleFilter: String, Sendable {
    case organizer
    case helper
}
