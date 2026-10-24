//
//  PlanPlaceDTOs.swift
//  Pantopus
//
//  Board H6's public places (`GET /api/plans/places/nearby`) and its
//  "Suggest places" (`POST /api/plans/places/suggest`), both in
//  backend/routes/plans.js.
//

import Foundation

/// A public place for H6 (parks, playgrounds, libraries, courts, trails,
/// cafés, bars and restaurants). Accepts the geo service's `center` shape or
/// flat coordinates.
public struct PlanPlaceOptionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let placeId: String?
    public let name: String
    public let category: String?
    public let address: String?
    public let latitude: Double
    public let longitude: Double
    public let distanceMeters: Double?
    /// The kind of place, then the sports a court is marked for ("court", "pickleball").
    public let categories: [String]
    /// Whether it's open for the plan's time, when the picker sent one and the place has hours.
    public let hours: PlanPlaceHoursDTO?
    /// The line under the place: hours that need a look, or open hours and a fact or two.
    public let detail: PlanPlaceDetailLineDTO?
    /// "Suggest places": why it suits the plan.
    public let why: String?

    public var id: String {
        placeId ?? "\(name)@\(latitude),\(longitude)"
    }

    enum CodingKeys: String, CodingKey {
        case name, category, categories, address, latitude, longitude, center, hours, detail, why
        case placeId = "place_id"
        case distanceMeters = "distance_m"
    }

    private struct Center: Decodable {
        let lat: Double
        let lng: Double
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        placeId = try container.decodeIfPresent(String.self, forKey: .placeId)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        if let center = try container.decodeIfPresent(Center.self, forKey: .center) {
            latitude = center.lat
            longitude = center.lng
        } else {
            latitude = try container.decode(Double.self, forKey: .latitude)
            longitude = try container.decode(Double.self, forKey: .longitude)
        }
        distanceMeters = try container.decodeIfPresent(Double.self, forKey: .distanceMeters)
        categories = (try? container.decodeIfPresent([String].self, forKey: .categories)) ?? []
        hours = try? container.decodeIfPresent(PlanPlaceHoursDTO.self, forKey: .hours)
        detail = try? container.decodeIfPresent(PlanPlaceDetailLineDTO.self, forKey: .detail)
        why = try? container.decodeIfPresent(String.self, forKey: .why)
    }

    public init(placeId: String?, name: String, category: String?, address: String?, latitude: Double, longitude: Double) {
        self.placeId = placeId
        self.name = name
        self.category = category
        self.address = address
        self.latitude = latitude
        self.longitude = longitude
        distanceMeters = nil
        categories = []
        hours = nil
        detail = nil
        why = nil
    }
}

/// A place's hours for the plan's time (from its OpenStreetMap opening hours).
public struct PlanPlaceHoursDTO: Decodable, Sendable, Hashable {
    /// `open`, `closes_early`, `opens_late` or `closed`.
    public let status: String
    /// "Open until 11 PM", "Closes at 2 PM", "Closed on Sunday".
    public let text: String

    public var isClosed: Bool {
        status == "closed"
    }

    /// Open for part of the plan only.
    public var isPartial: Bool {
        status == "closes_early" || status == "opens_late"
    }
}

/// The ready-made line under a place in H6: "Open until 11 PM · Outdoor seating",
/// or "Closes at 2 PM" as a warning.
public struct PlanPlaceDetailLineDTO: Decodable, Sendable, Hashable {
    public let text: String
    /// `neutral` or `warning`.
    public let tone: String

    public var isWarning: Bool {
        tone == "warning"
    }
}

/// What the H6 list is for: the plan's kind (the places that suit it come
/// first), a pickup game's sport, and its time (each place says whether it's
/// open then).
public struct PlanPlaceQuery: Sendable, Hashable {
    public let kind: PlanKind
    public let sport: String?
    public let startsAt: Date
    public let endsAt: Date
}

/// `POST /api/plans/places/suggest`: H6's "Suggest places" for the draft.
public struct PlanPlaceSuggestBody: Encodable, Sendable {
    public let latitude: Double
    public let longitude: Double
    public let kind: PlanKind
    public let title: String?
    public let about: String?
    public let startsAt: String
    public let endsAt: String
    public let spots: Int
    public let details: PlanDetailsDTO
    /// What the host is looking for, typed in H6's search box ("big screens and food").
    public let ask: String?

    enum CodingKeys: String, CodingKey {
        case latitude, longitude, kind, title, about, spots, details, ask
        case startsAt = "starts_at"
        case endsAt = "ends_at"
    }

    public init(
        latitude: Double,
        longitude: Double,
        kind: PlanKind,
        title: String?,
        about: String?,
        startsAt: Date,
        endsAt: Date,
        spots: Int,
        details: PlanDetailsDTO,
        ask: String?
    ) {
        self.latitude = latitude
        self.longitude = longitude
        self.kind = kind
        self.title = title
        self.about = about
        self.startsAt = PlanTime.string(startsAt)
        self.endsAt = PlanTime.string(endsAt)
        self.spots = spots
        self.details = details
        self.ask = ask
    }
}

/// Up to three places for the plan, best first, each with `why`.
public struct PlanPlaceSuggestionsResponse: Decodable, Sendable, Hashable {
    public let picks: [PlanPlaceOptionDTO]
    /// The area's places are still on their way (202): ask again in a few seconds.
    public let loading: Bool
    /// `ai` when Pantopus chose them; `rules` when the list's own order did (the assistant was off or busy).
    public let source: String?

    enum CodingKeys: String, CodingKey {
        case picks, loading, source
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        picks = try container.decodeIfPresent(LossyList<PlanPlaceOptionDTO>.self, forKey: .picks)?.items ?? []
        loading = try container.decodeIfPresent(Bool.self, forKey: .loading) ?? false
        source = try container.decodeIfPresent(String.self, forKey: .source)
    }
}

/// `GET /api/plans/places/nearby` (and the geo search used by H6's box).
public struct PlanPlacesResponse: Decodable, Sendable, Hashable {
    public let places: [PlanPlaceOptionDTO]
    /// The area is asked for the first time and still loading (202): ask again in a few seconds.
    public let loading: Bool
    /// "© OpenStreetMap contributors": shown small under the list.
    public let attribution: String?

    enum CodingKeys: String, CodingKey {
        case places, loading, attribution
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        places = try container.decodeIfPresent(LossyList<PlanPlaceOptionDTO>.self, forKey: .places)?.items ?? []
        loading = try container.decodeIfPresent(Bool.self, forKey: .loading) ?? false
        attribution = try container.decodeIfPresent(String.self, forKey: .attribution)
    }
}
