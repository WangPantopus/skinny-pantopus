//
//  SavedPlacesDTOs.swift
//  Pantopus
//
//  BLOCK 2E — "Saved places" (the places you bookmark from Explore). Decodes
//  the `{ savedPlaces: [...] }` / `{ savedPlace: {...} }` envelopes from
//  `backend/routes/savedPlaces.js`. The route `select('*')`s the `SavedPlace`
//  table, so the row keys arrive snake_case and need explicit `CodingKeys`.
//  The POST body, by contrast, is read camelCase on the server
//  (`req.body.placeType`, …) so `SavePlaceBody` ships its property names as-is.
//

import Foundation

/// `GET /api/saved-places` envelope. Route `backend/routes/savedPlaces.js:8`.
public struct SavedPlacesListResponse: Decodable, Sendable, Hashable {
    public let savedPlaces: [SavedPlaceDTO]
}

/// `POST /api/saved-places` echo (the upserted row).
/// Route `backend/routes/savedPlaces.js:25`.
public struct SavedPlaceResponse: Decodable, Sendable, Hashable {
    public let savedPlace: SavedPlaceDTO
}

/// One saved place. The serializer is a raw table `select('*')`, so the wire
/// keys are snake_case; only the fields the list + save affordance read are
/// modelled (the geocode-provenance columns are ignored).
public struct SavedPlaceDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    /// `home | work | searched | saved`.
    public let placeType: String
    public let latitude: Double
    public let longitude: Double
    public let city: String?
    public let state: String?
    public let sourceId: String?
    public let geocodePlaceId: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case latitude
        case longitude
        case city
        case state
        case placeType = "place_type"
        case sourceId = "source_id"
        case geocodePlaceId = "geocode_place_id"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        label: String,
        placeType: String,
        latitude: Double,
        longitude: Double,
        city: String?,
        state: String?,
        sourceId: String?,
        geocodePlaceId: String?,
        createdAt: String?
    ) {
        self.id = id
        self.label = label
        self.placeType = placeType
        self.latitude = latitude
        self.longitude = longitude
        self.city = city
        self.state = state
        self.sourceId = sourceId
        self.geocodePlaceId = geocodePlaceId
        self.createdAt = createdAt
    }
}

/// Body for `POST /api/saved-places`. The backend reads camelCase keys, so no
/// `CodingKeys` remapping is required — the property names match the wire.
/// `label`, `latitude`, `longitude` are required server-side; the rest are
/// optional (`placeType` defaults to `searched`). The upsert keys on
/// `(user, latitude, longitude)`, so re-posting the same coordinate replaces
/// the row rather than duplicating it.
public struct SavePlaceBody: Encodable, Sendable {
    public let label: String
    public let placeType: String
    public let latitude: Double
    public let longitude: Double
    public let city: String?
    public let state: String?
    public let geocodePlaceId: String?
    public let sourceId: String?

    public init(
        label: String,
        placeType: String,
        latitude: Double,
        longitude: Double,
        city: String? = nil,
        state: String? = nil,
        geocodePlaceId: String? = nil,
        sourceId: String? = nil
    ) {
        self.label = label
        self.placeType = placeType
        self.latitude = latitude
        self.longitude = longitude
        self.city = city
        self.state = state
        self.geocodePlaceId = geocodePlaceId
        self.sourceId = sourceId
    }

    /// Rebuild a save body from an existing row — used by the Undo path to
    /// re-POST a just-removed place.
    public init(from dto: SavedPlaceDTO) {
        self.init(
            label: dto.label,
            placeType: dto.placeType,
            latitude: dto.latitude,
            longitude: dto.longitude,
            city: dto.city,
            state: dto.state,
            geocodePlaceId: dto.geocodePlaceId,
            sourceId: dto.sourceId
        )
    }
}
