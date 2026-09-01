//
//  HomeEmergencyDTOs.swift
//  Pantopus
//
//  DTOs for the Home Emergency info endpoints under
//  `backend/routes/home.js`:
//   - GET  /api/homes/:id/emergencies   (line 5406)
//   - POST /api/homes/:id/emergencies   (line 5442)
//
//  Backend `HomeEmergency.type` is one of nine constants:
//    shutoff_water · shutoff_gas · shutoff_electric · breaker_map ·
//    extinguisher · first_aid · evac_plan · emergency_contacts · other
//  The server adds `info_type` (== `type`) and `location_in_home`
//  (== `location`) on the GET response for older frontend builds; we
//  decode the canonical fields and ignore the aliases.
//

import Foundation

/// One row from `GET /api/homes/:id/emergencies`.
public struct HomeEmergencyDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    /// Canonical type enum — drives the category-grouping bucket.
    public let type: String
    /// User-supplied label (e.g. "Main water shutoff", "911").
    public let label: String
    /// Optional location hint (e.g. "Basement utility closet").
    public let location: String?
    /// Free-form payload — the design uses `phone`, `address`, and
    /// `notes` keys but no key is required by the backend.
    public let details: [String: String]
    public let createdAt: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case type
        case label
        case location
        case details
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        homeId = try container.decode(String.self, forKey: .homeId)
        type = try container.decode(String.self, forKey: .type)
        label = try container.decode(String.self, forKey: .label)
        location = try container.decodeIfPresent(String.self, forKey: .location)
        details = (try? container.decode([String: String].self, forKey: .details)) ?? [:]
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
    }

    public init(
        id: String,
        homeId: String,
        type: String,
        label: String,
        location: String?,
        details: [String: String] = [:],
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.type = type
        self.label = label
        self.location = location
        self.details = details
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Wrapper for the list response — backend returns
/// `{ "emergencies": [HomeEmergencyDTO, …] }`.
public struct GetHomeEmergenciesResponse: Decodable, Sendable {
    public let emergencies: [HomeEmergencyDTO]
}

/// Wrapper for the create response — backend returns
/// `{ "emergency": HomeEmergencyDTO }` (`backend/routes/home.js:5682`).
public struct CreateEmergencyResponse: Decodable, Sendable {
    public let emergency: HomeEmergencyDTO
}

/// Request body for `POST /api/homes/:id/emergencies`. Backend rejects
/// the call without `type` + `label`.
public struct CreateEmergencyRequest: Encodable, Sendable {
    public let type: String
    public let label: String
    public let location: String?
    public let details: [String: String]?

    public init(
        type: String,
        label: String,
        location: String? = nil,
        details: [String: String]? = nil
    ) {
        self.type = type
        self.label = label
        self.location = location
        self.details = details
    }
}
