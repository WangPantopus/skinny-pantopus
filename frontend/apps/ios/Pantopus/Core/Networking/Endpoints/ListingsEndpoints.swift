//
//  ListingsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/listings.js`. T2.4 wired
//  `in-bounds` for the Nearby map; T2.5 adds `browse`, `nearby`,
//  `categories`, and `save` for the Marketplace tab.
//

import Foundation

/// Endpoints under `/api/listings/*`.
public enum ListingsEndpoints {
    /// `GET /api/listings/browse` — paginated browse with filter +
    /// sort + bbox. Route `backend/routes/listings.js:631`.
    public static func browse(
        south: Double,
        west: Double,
        north: Double,
        east: Double,
        category: String? = nil,
        layer: String? = nil,
        isFree: Bool? = nil,
        minPrice: Double? = nil,
        maxPrice: Double? = nil,
        condition: String? = nil,
        search: String? = nil,
        sort: String = "newest",
        cursor: String? = nil,
        limit: Int = 30,
        refLat: Double? = nil,
        refLng: Double? = nil
    ) -> Endpoint {
        var query: [String: String] = [
            "south": String(south),
            "west": String(west),
            "north": String(north),
            "east": String(east),
            "sort": sort,
            "limit": String(limit)
        ]
        if let category, category != "all" { query["category"] = category }
        if let layer { query["layer"] = layer }
        if let isFree { query["is_free"] = isFree ? "true" : "false" }
        if let minPrice { query["min_price"] = String(minPrice) }
        if let maxPrice { query["max_price"] = String(maxPrice) }
        if let condition { query["condition"] = condition }
        if let search, !search.isEmpty { query["search"] = search }
        if let cursor { query["cursor"] = cursor }
        if let refLat { query["ref_lat"] = String(refLat) }
        if let refLng { query["ref_lng"] = String(refLng) }
        return Endpoint(method: .get, path: "/api/listings/browse", query: query)
    }

    /// `GET /api/listings/nearby` — radius search around lat/lng with
    /// filter set. Route `backend/routes/listings.js:796`.
    public static func nearby(
        latitude: Double,
        longitude: Double,
        radiusMiles: Double? = nil,
        radiusMeters: Int? = nil,
        category: String? = nil,
        layer: String? = nil,
        isFree: Bool? = nil,
        condition: String? = nil,
        minPrice: Double? = nil,
        maxPrice: Double? = nil,
        search: String? = nil,
        sort: String = "newest",
        limit: Int = 30,
        offset: Int = 0
    ) -> Endpoint {
        var query: [String: String] = [
            "latitude": String(latitude),
            "longitude": String(longitude),
            "sort": sort,
            "limit": String(limit),
            "offset": String(offset)
        ]
        if let radiusMiles { query["radiusMiles"] = String(radiusMiles) }
        if let radiusMeters { query["radius"] = String(radiusMeters) }
        if let category, category != "all" { query["category"] = category }
        if let layer { query["layer"] = layer }
        if let isFree { query["isFree"] = isFree ? "true" : "false" }
        if let condition { query["condition"] = condition }
        if let minPrice { query["minPrice"] = String(minPrice) }
        if let maxPrice { query["maxPrice"] = String(maxPrice) }
        if let search, !search.isEmpty { query["search"] = search }
        return Endpoint(method: .get, path: "/api/listings/nearby", query: query)
    }

    /// `GET /api/listings/in-bounds` — map-viewport pins for T2.4
    /// Map+List Hybrid. Note: this route uses `south/west/north/east`,
    /// distinct from `min_lat/min_lon/…` on the gigs side.
    public static func inBounds(
        south: Double,
        west: Double,
        north: Double,
        east: Double,
        category: String? = nil,
        layer: String? = nil,
        limit: Int = 100
    ) -> Endpoint {
        var query: [String: String] = [
            "south": String(south),
            "west": String(west),
            "north": String(north),
            "east": String(east),
            "limit": String(limit)
        ]
        if let category, category != "all" { query["category"] = category }
        if let layer { query["layer"] = layer }
        return Endpoint(method: .get, path: "/api/listings/in-bounds", query: query)
    }

    /// `GET /api/listings/me` — the current user's own listings,
    /// optionally filtered by `status`. Route
    /// `backend/routes/listings.js:1058`.
    public static func myListings(
        status: String? = nil,
        limit: Int = 50,
        offset: Int = 0
    ) -> Endpoint {
        var query: [String: String] = [
            "limit": String(limit),
            "offset": String(offset)
        ]
        if let status, !status.isEmpty, status != "all" { query["status"] = status }
        return Endpoint(method: .get, path: "/api/listings/me", query: query)
    }

    /// `GET /api/listings/categories` — backend's canonical categories
    /// + conditions enums. Route `backend/routes/listings.js:1176`.
    public static let categories = Endpoint(method: .get, path: "/api/listings/categories")

    /// `POST /api/listings` — create a new marketplace listing.
    /// Route `backend/routes/listings.js:426`.
    public static func create(_ request: CreateListingRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/listings", body: request)
    }

    /// `PATCH /api/listings/:id` — owner-only update of a listing.
    /// Route `backend/routes/listings.js:1479`.
    public static func update(id: String, body: UpdateListingRequest) -> Endpoint {
        Endpoint(method: .patch, path: "/api/listings/\(id)", body: body)
    }

    /// `GET /api/listings/:id` — single-listing detail wrapper.
    public static func detail(id: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/listings/\(id)")
    }

    /// `POST /api/listings/:id/message` — send the seller a message /
    /// offer. Route `backend/routes/listings.js:1686`.
    public static func messageListing(id: String, body: MessageListingBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/listings/\(id)/message", body: body)
    }

    /// `POST /api/listings/:id/save` — bookmark. Route
    /// `backend/routes/listings.js:1611`.
    public static func save(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/listings/\(id)/save")
    }

    /// `DELETE /api/listings/:id/save` — un-bookmark.
    public static func unsave(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/listings/\(id)/save")
    }
}

/// Body for `POST /api/listings/:id/message`. Either field can be nil
/// but at least one should be provided to match the backend's
/// validator.
public struct MessageListingBody: Encodable, Sendable {
    public let message: String?
    public let offerAmount: Double?

    public init(message: String?, offerAmount: Double? = nil) {
        self.message = message
        self.offerAmount = offerAmount
    }
}
