//
//  GigSavedSearchesEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/gigSavedSearches.js` (P6a) —
//  save the filter set you're browsing with, list / rename / mute /
//  delete saved searches. Alert delivery is ordinary notifications
//  (`gig_saved_search_match`), so no client routing lives here.
//

import Foundation

/// Endpoints under `/api/gigs/saved-searches`.
public enum GigSavedSearchesEndpoints {
    /// `GET /api/gigs/saved-searches` — the caller's saved searches,
    /// newest first. Route `backend/routes/gigSavedSearches.js:44`.
    public static func list() -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/saved-searches")
    }

    /// `POST /api/gigs/saved-searches` — save the current filter set.
    /// `201 {search}` on create; duplicate criteria upsert onto the
    /// existing row and return `200 {search, deduped: true}`
    /// (re-enabling its alerts). Capped at 20 per user. Route
    /// `backend/routes/gigSavedSearches.js:64`.
    public static func create(_ body: CreateGigSavedSearchBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/saved-searches", body: body)
    }

    /// `PATCH /api/gigs/saved-searches/:id` — rename / toggle notify /
    /// adjust radius (≥ one field). Returns `{search}`. Route
    /// `backend/routes/gigSavedSearches.js:143`.
    public static func update(id: String, body: UpdateGigSavedSearchBody) -> Endpoint {
        Endpoint(method: .patch, path: "/api/gigs/saved-searches/\(id)", body: body)
    }

    /// `DELETE /api/gigs/saved-searches/:id` — returns `{message}`.
    /// Route `backend/routes/gigSavedSearches.js:163`.
    public static func delete(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/gigs/saved-searches/\(id)")
    }
}

/// Body for `POST /api/gigs/saved-searches`. `latitude`/`longitude`
/// are the only required criteria; every other field is omitted when
/// the matching filter dimension is inactive. `schedule_type` must be
/// one of `asap | today | scheduled | flexible`; `pay_type` one of
/// `fixed | hourly | offers`.
public struct CreateGigSavedSearchBody: Encodable, Sendable, Equatable {
    public let name: String?
    public let category: String?
    public let search: String?
    public let minPrice: Double?
    public let maxPrice: Double?
    public let scheduleType: String?
    public let payType: String?
    public let latitude: Double
    public let longitude: Double
    public let radiusMiles: Double
    public let notify: Bool

    public init(
        name: String? = nil,
        category: String? = nil,
        search: String? = nil,
        minPrice: Double? = nil,
        maxPrice: Double? = nil,
        scheduleType: String? = nil,
        payType: String? = nil,
        latitude: Double,
        longitude: Double,
        radiusMiles: Double = 5,
        notify: Bool = true
    ) {
        self.name = name
        self.category = category
        self.search = search
        self.minPrice = minPrice
        self.maxPrice = maxPrice
        self.scheduleType = scheduleType
        self.payType = payType
        self.latitude = latitude
        self.longitude = longitude
        self.radiusMiles = radiusMiles
        self.notify = notify
    }

    enum CodingKeys: String, CodingKey {
        case name, category, search, latitude, longitude, notify
        case minPrice = "min_price"
        case maxPrice = "max_price"
        case scheduleType = "schedule_type"
        case payType = "pay_type"
        case radiusMiles = "radius_miles"
    }
}

/// Body for `PATCH /api/gigs/saved-searches/:id`. The backend requires
/// at least one field; synthesized encoding omits `nil` keys so a
/// single-field patch sends exactly that field.
public struct UpdateGigSavedSearchBody: Encodable, Sendable {
    public let name: String?
    public let notify: Bool?
    public let radiusMiles: Double?

    public init(name: String? = nil, notify: Bool? = nil, radiusMiles: Double? = nil) {
        self.name = name
        self.notify = notify
        self.radiusMiles = radiusMiles
    }

    enum CodingKeys: String, CodingKey {
        case name, notify
        case radiusMiles = "radius_miles"
    }
}
