//
//  ViewingLocationEndpoints.swift
//  Pantopus
//
//  The user's Viewing Location — the place the Nearby feed, Gigs and
//  Discover are scoped to. Backs the Pulse feed's context bar and the
//  radius-suggestion banner.
//

import Foundation

/// Routes under `/api/location` (`backend/app.js:387`).
public enum ViewingLocationEndpoints {
    /// `GET /api/location` — current viewing location plus the pickers'
    /// source lists (recents, homes, business locations).
    /// Route `backend/routes/location.js:89`.
    public static func current() -> Endpoint {
        Endpoint(method: .get, path: "/api/location")
    }

    /// `PUT /api/location` — upsert the viewing location. The handler also
    /// pushes the value onto the recents list (deduped, trimmed to 5).
    /// Route `backend/routes/location.js:149`.
    public static func set(_ body: SetViewingLocationRequest) -> Endpoint {
        Endpoint(method: .put, path: "/api/location", body: body)
    }

    /// `PUT /api/location/radius` — change only the radius of the current
    /// viewing location. 404s when no viewing location is set.
    /// Route `backend/routes/location.js:268`.
    public static func setRadius(miles: Double) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/location/radius",
            body: SetViewingRadiusRequest(radiusMiles: miles)
        )
    }
}

/// Body for `PUT /api/location` (`backend/routes/location.js:151`).
public struct SetViewingLocationRequest: Encodable, Sendable, Hashable {
    /// `gps | home | business | searched | recent`
    /// (`backend/routes/location.js` `setLocationSchema`).
    public let type: String
    public let label: String
    public let latitude: Double
    public let longitude: Double
    public let radiusMiles: Double
    public let isPinned: Bool
    public let sourceId: String?
    public let city: String?
    public let state: String?

    public init(
        type: String,
        label: String,
        latitude: Double,
        longitude: Double,
        radiusMiles: Double,
        isPinned: Bool = false,
        sourceId: String? = nil,
        city: String? = nil,
        state: String? = nil
    ) {
        self.type = type
        self.label = label
        self.latitude = latitude
        self.longitude = longitude
        self.radiusMiles = radiusMiles
        self.isPinned = isPinned
        self.sourceId = sourceId
        self.city = city
        self.state = state
    }
}

/// Body for `PUT /api/location/radius` (`backend/routes/location.js:270`).
public struct SetViewingRadiusRequest: Encodable, Sendable, Hashable {
    public let radiusMiles: Double

    public init(radiusMiles: Double) {
        self.radiusMiles = radiusMiles
    }
}
