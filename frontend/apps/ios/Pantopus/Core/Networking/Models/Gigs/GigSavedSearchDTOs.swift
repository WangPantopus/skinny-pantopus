//
//  GigSavedSearchDTOs.swift
//  Pantopus
//
//  Decoder shapes for `/api/gigs/saved-searches` (P6a) — the caller's
//  saved filter sets plus alert state. Mirrors the `GigSavedSearch`
//  row returned by `backend/routes/gigSavedSearches.js`.
//

import Foundation

/// One saved search from `GET /api/gigs/saved-searches`. Alerts arrive
/// as ordinary notifications (`gig_saved_search_match`) — this DTO only
/// backs the manage sheet.
public struct GigSavedSearchDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let userId: String?
    /// Stored display name. `nil`/empty rows derive one client-side.
    public let name: String?
    public let category: String?
    public let search: String?
    public let minPrice: Double?
    public let maxPrice: Double?
    /// One of `asap | today | scheduled | flexible`.
    public let scheduleType: String?
    /// One of `fixed | hourly | offers`.
    public let payType: String?
    public let latitude: Double?
    public let longitude: Double?
    public let radiusMiles: Double?
    public let notify: Bool?
    public let createdAt: String?
    public let lastNotifiedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, category, search, latitude, longitude, notify
        case userId = "user_id"
        case minPrice = "min_price"
        case maxPrice = "max_price"
        case scheduleType = "schedule_type"
        case payType = "pay_type"
        case radiusMiles = "radius_miles"
        case createdAt = "created_at"
        case lastNotifiedAt = "last_notified_at"
    }
}

/// `GET /api/gigs/saved-searches` envelope.
public struct GigSavedSearchListResponse: Decodable, Sendable {
    public let searches: [GigSavedSearchDTO]
}

/// `POST` / `PATCH /api/gigs/saved-searches` envelope. `deduped` is
/// `true` only when a duplicate-criteria POST upserted onto an existing
/// row (re-enabling its alerts) instead of creating a new one.
public struct GigSavedSearchSaveResponse: Decodable, Sendable {
    public let search: GigSavedSearchDTO
    public let deduped: Bool?
}
