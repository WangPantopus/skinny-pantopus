//
//  PostPlaceTag.swift
//  Pantopus
//
//  Instagram-style place tag picked in `PlacePickerSheet` and attached
//  to a Pulse post (`POST /api/posts`) or a Beacon broadcast
//  (`POST /api/broadcast/channels/:id/messages`). Carries just what
//  the create payloads need — venue name + coords + the Mapbox
//  provenance fields.
//

import Foundation

/// A named place the author explicitly tagged on a post.
public struct PostPlaceTag: Sendable, Hashable {
    public let name: String
    public let address: String?
    public let latitude: Double
    public let longitude: Double
    /// Mapbox feature id (e.g. `poi.123`) → wire `geocodePlaceId` / `place_id`.
    public let placeId: String?
    /// Provider feature kind (`poi` / `place` / …) → wire `geocodeAccuracy`.
    public let kind: String?

    public init(
        name: String,
        address: String? = nil,
        latitude: Double,
        longitude: Double,
        placeId: String? = nil,
        kind: String? = nil
    ) {
        self.name = name
        self.address = address
        self.latitude = latitude
        self.longitude = longitude
        self.placeId = placeId
        self.kind = kind
    }

    /// Build a tag from a picker row. Prefers the short address line;
    /// falls back to the full `place_name` (localities have no short line).
    public init(place: GeoPlace) {
        self.init(
            name: place.name,
            address: place.address ?? place.fullAddress,
            latitude: place.center.lat,
            longitude: place.center.lng,
            placeId: place.placeId,
            kind: place.kind
        )
    }
}
