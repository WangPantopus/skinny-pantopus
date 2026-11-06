//
//  GeoDTOs.swift
//  Pantopus
//
//  DTOs for `/api/geo/*`. Route: `backend/routes/geo.js`.
//

import Foundation

/// Normalized address from reverse geocode / resolve.
public struct NormalizedAddress: Decodable, Sendable, Hashable {
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let latitude: Double?
    public let longitude: Double?
    public let placeId: String?
    public let verified: Bool?
    public let source: String?

    private enum CodingKeys: String, CodingKey {
        case address, city, state, zipcode, latitude, longitude, verified, source
        case placeId = "place_id"
    }

    /// City, state label for compose summaries.
    public var localityLabel: String {
        [city, state].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }
}

/// `GET /api/geo/reverse` envelope.
public struct GeoReverseResponse: Decodable, Sendable, Hashable {
    public let normalized: NormalizedAddress
}

/// One address-typeahead suggestion from `GET /api/geo/autocomplete`.
///
/// NOTE the wire shape (verified against the live backend): `center`
/// is a GeoJSON-style `[lng, lat]` ARRAY, not a `{lat, lng}` object
/// (the web `GeoSuggestion` TS type claims an object — the wire wins).
public struct GeoSuggestion: Decodable, Sendable, Hashable, Identifiable {
    public let suggestionId: String
    public let placeId: String?
    public let primaryText: String
    public let secondaryText: String?
    public let label: String
    public let text: String?
    /// GeoJSON order: `[longitude, latitude]`.
    public let center: [Double]
    public let kind: String

    public var id: String {
        suggestionId
    }

    public var longitude: Double? {
        center.count >= 2 ? center[0] : nil
    }

    public var latitude: Double? {
        center.count >= 2 ? center[1] : nil
    }

    private enum CodingKeys: String, CodingKey {
        case label, center, kind, text
        case suggestionId = "suggestion_id"
        case placeId = "place_id"
        case primaryText = "primary_text"
        case secondaryText = "secondary_text"
    }
}

/// `GET /api/geo/autocomplete` envelope.
public struct GeoAutocompleteResponse: Decodable, Sendable, Hashable {
    public let suggestions: [GeoSuggestion]
}

/// `POST /api/geo/resolve` body.
public struct GeoResolveRequest: Encodable, Sendable, Hashable {
    public let suggestionId: String

    public init(suggestionId: String) {
        self.suggestionId = suggestionId
    }

    private enum CodingKeys: String, CodingKey {
        case suggestionId = "suggestion_id"
    }
}

/// `POST /api/geo/resolve` envelope.
public struct GeoResolveResponse: Decodable, Sendable, Hashable {
    public let normalized: NormalizedAddress
}

/// Coordinate on the place-tagging wire. Unlike the legacy autocomplete
/// `center` (a GeoJSON `[lng, lat]` array), the `/api/geo/places/*`
/// endpoints emit an object — do not confuse the two shapes.
public struct GeoPlaceCenter: Decodable, Sendable, Hashable {
    public let lat: Double
    public let lng: Double
}

/// One named place (venue / locality / address) from
/// `GET /api/geo/places/nearby` or `GET /api/geo/places/search` — the
/// Instagram-style place-tag picker's row model.
public struct GeoPlace: Decodable, Sendable, Hashable, Identifiable {
    /// OpenStreetMap venue id (`osm:node/123`) or Mapbox feature id
    /// (`place.123`, `address.456`). Nullable on the wire.
    public let placeId: String?
    public let name: String
    /// A venue's kind ("Barbecue restaurant", "Church"); Mapbox's
    /// category string for its rows; nil for localities.
    public let category: String?
    /// Icon key for a venue (`restaurant`, `cafe`, `school`, `worship`,
    /// `park`, `stadium`, …); nil for Mapbox rows (drawn as a pin).
    public let icon: String?
    /// Short address line ("123 Elm St").
    public let address: String?
    /// Full address line ("Joe's, 123 Elm St, Portland, OR…").
    public let fullAddress: String?
    public let center: GeoPlaceCenter
    /// `poi` / `place` / `address` / … (provider `featureKind`).
    public let kind: String
    /// Metres from the query point (to a venue's outline); nil when no
    /// query coords were sent.
    public let distanceM: Double?
    /// True when the query point is inside the venue's outline (the
    /// stadium the photo was taken in).
    public let contains: Bool?

    public var id: String {
        placeId ?? "\(name)|\(center.lat)|\(center.lng)"
    }

    private enum CodingKeys: String, CodingKey {
        case name, category, icon, address, center, kind, contains
        case placeId = "place_id"
        case fullAddress = "full_address"
        case distanceM = "distance_m"
    }
}

/// `GET /api/geo/places/nearby` envelope.
public struct GeoNearbyPlacesResponse: Decodable, Sendable, Hashable {
    public let places: [GeoPlace]
    public let locality: GeoPlace?
    /// True while a new area's venues are still being gathered — ask
    /// again shortly.
    public let loading: Bool?
    /// Data credit to show under venue rows ("© OpenStreetMap contributors").
    public let attribution: String?
}

/// `GET /api/geo/places/search` envelope.
public struct GeoPlaceSearchResponse: Decodable, Sendable, Hashable {
    public let places: [GeoPlace]
    /// Data credit to show under venue rows, when any are listed.
    public let attribution: String?
}
