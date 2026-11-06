//
//  GeoEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/geo.js`.
//

import Foundation

public enum GeoEndpoints {
    /// `GET /api/geo/autocomplete?q=[&lat=&lng=][&kind=address]` — route
    /// `backend/routes/geo.js:65`. Address typeahead (Mapbox-backed).
    /// Suggestions carry a center lat/lng; resolve one via
    /// `resolve(suggestionId:)`. `near` favors suggestions close to a point
    /// (sent rounded to about a kilometer); `streetOnly` keeps street
    /// addresses only.
    public static func autocomplete(
        query: String,
        near: (latitude: Double, longitude: Double)? = nil,
        streetOnly: Bool = false
    ) -> Endpoint {
        var params = ["q": query]
        if let near {
            params["lat"] = String(format: "%.2f", near.latitude)
            params["lng"] = String(format: "%.2f", near.longitude)
        }
        if streetOnly { params["kind"] = "address" }
        return Endpoint(
            method: .get,
            path: "/api/geo/autocomplete",
            query: params
        )
    }

    /// `POST /api/geo/resolve` — route `backend/routes/geo.js:120`.
    /// Resolve a suggestion to a normalized address.
    public static func resolve(suggestionId: String) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/geo/resolve",
            body: GeoResolveRequest(suggestionId: suggestionId)
        )
    }

    /// `GET /api/geo/reverse?lat=&lon=` — route `backend/routes/geo.js:185`.
    public static func reverse(latitude: Double, longitude: Double) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/geo/reverse",
            query: [
                "lat": String(latitude),
                "lon": String(longitude)
            ]
        )
    }

    /// `GET /api/geo/places/nearby?lat=&lng=` — route `backend/routes/geo.js:254`.
    /// Nearby named POIs plus the enclosing locality for the place-tag picker.
    public static func nearbyPlaces(latitude: Double, longitude: Double) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/geo/places/nearby",
            query: [
                "lat": String(latitude),
                "lng": String(longitude)
            ]
        )
    }

    /// `GET /api/geo/places/search?q=&lat=&lng=` — route `backend/routes/geo.js:323`.
    /// Place typeahead; `lat`/`lng` bias results toward the device when
    /// available.
    public static func searchPlaces(
        query: String,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) -> Endpoint {
        var params = ["q": query]
        if let latitude { params["lat"] = String(latitude) }
        if let longitude { params["lng"] = String(longitude) }
        return Endpoint(
            method: .get,
            path: "/api/geo/places/search",
            query: params
        )
    }
}
