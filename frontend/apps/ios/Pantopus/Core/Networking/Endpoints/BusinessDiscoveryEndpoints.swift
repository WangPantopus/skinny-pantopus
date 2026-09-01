//
//  BusinessDiscoveryEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/businessDiscovery.js`.
//  Mounted at `/api/businesses` (see backend `app.js:339`).
//

import Foundation

/// Endpoint builders for business discovery search.
public enum BusinessDiscoveryEndpoints {
    /// `GET /api/businesses/search` — route
    /// `backend/routes/businessDiscovery.js:436`.
    ///
    /// Used by Discover businesses (T5.4.2 / P12). The composite-ranked
    /// search supports text query (`q`), per-category filter
    /// (comma-separated `categories`), pagination, and an optional
    /// explicit centre point (otherwise the backend uses the viewer's
    /// resolved home).
    public static func search(
        q: String? = nil,
        categories: [String]? = nil,
        sort: String? = nil,
        page: Int = 1,
        pageSize: Int = 20,
        radiusMiles: Double? = nil,
        openNow: Bool? = nil,
        ratingMin: Double? = nil,
        lat: Double? = nil,
        lng: Double? = nil
    ) -> Endpoint {
        var query: [String: String] = [
            "page": String(page),
            "page_size": String(pageSize)
        ]
        if let q, !q.isEmpty { query["q"] = q }
        if let categories, !categories.isEmpty {
            query["categories"] = categories.joined(separator: ",")
        }
        if let sort { query["sort"] = sort }
        if let radiusMiles { query["radius_miles"] = String(radiusMiles) }
        if let openNow, openNow { query["open_now"] = "true" }
        if let ratingMin { query["rating_min"] = String(ratingMin) }
        if let lat { query["lat"] = String(lat) }
        if let lng { query["lon"] = String(lng) }
        return Endpoint(method: .get, path: "/api/businesses/search", query: query)
    }
}
