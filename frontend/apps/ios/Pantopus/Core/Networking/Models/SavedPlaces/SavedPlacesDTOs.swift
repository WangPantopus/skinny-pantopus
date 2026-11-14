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
    public let userId: String?
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
        case userId = "user_id"
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
        createdAt: String?,
        userId: String? = nil
    ) {
        self.userId = userId
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
    public let expectedUserId: String?
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
        sourceId: String? = nil,
        expectedUserId: String? = nil
    ) {
        self.expectedUserId = expectedUserId
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

/// `POST /api/saved-places/area/today` body (TABCARD section 4): the point
/// rounded to two decimal places. `Decimal` so the JSON carries exactly that
/// ("45.64"), never a longer binary expansion of it.
/// Route `backend/routes/savedPlaces.js:88`.
public struct AreaTodayBody: Encodable, Sendable, Hashable {
    public let latitude: Decimal
    public let longitude: Decimal

    public init(latitude: Double, longitude: Double) {
        self.latitude = Self.twoPlaces(latitude)
        self.longitude = Self.twoPlaces(longitude)
    }

    static func twoPlaces(_ value: Double) -> Decimal {
        Decimal(string: String(format: "%.2f", value), locale: Locale(identifier: "en_US_POSIX")) ?? 0
    }
}

/// `POST /api/saved-places/area/today` answer: the saved-address Today
/// (weather, air, alerts, sunrise and sunset; T1) for the city around the
/// point, plus `area`. Route `backend/routes/savedPlaces.js:88`.
public struct AreaTodayResponse: Decodable, Sendable, Hashable {
    public let today: PlaceIntelligence
    public let area: TodayAreaDTO

    private enum CodingKeys: String, CodingKey {
        case area
    }

    public init(from decoder: any Decoder) throws {
        today = try PlaceIntelligence(from: decoder)
        area = try decoder.container(keyedBy: CodingKeys.self).decode(TodayAreaDTO.self, forKey: .area)
    }
}

/// What the server calls the area: "Vancouver, WA"; the state's name with no
/// city; "Near you" with neither. The point comes back rounded again.
public struct TodayAreaDTO: Decodable, Sendable, Hashable {
    public let label: String
    public let city: String?
    public let state: String?
    public let latitude: Double
    public let longitude: Double
}
