//
//  HomeAccessSecretDTOs.swift
//  Pantopus
//
//  DTOs for the home access-secrets endpoints in `backend/routes/home.js`.
//  Backs the T6.4a Access codes screen — per-home roster of Wi-Fi / Alarm /
//  Gate / Lockbox / Garage / Smart-lock codes with masked values, visibility
//  scopes, and rotation metadata.
//

import Foundation

/// One row from `GET /api/homes/:id/access`.
///
/// Route citation: `backend/routes/home.js:5487`.
public struct HomeAccessSecretDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let accessType: String
    public let label: String
    public let secretValue: String
    public let notes: String?
    public let visibility: String?
    public let createdBy: String?
    public let createdAt: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case accessType = "access_type"
        case label
        case secretValue = "secret_value"
        case notes
        case visibility
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        homeId: String,
        accessType: String,
        label: String,
        secretValue: String,
        notes: String? = nil,
        visibility: String? = nil,
        createdBy: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.accessType = accessType
        self.label = label
        self.secretValue = secretValue
        self.notes = notes
        self.visibility = visibility
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Envelope for the list endpoint.
public struct HomeAccessSecretsResponse: Decodable, Sendable, Hashable {
    public let secrets: [HomeAccessSecretDTO]

    public init(secrets: [HomeAccessSecretDTO]) {
        self.secrets = secrets
    }
}

/// Envelope for the single-secret POST / PUT endpoints. Backend returns
/// `{ "secret": HomeAccessSecret }` at `backend/routes/home.js:5773` and
/// `backend/routes/home.js:5824`.
public struct HomeAccessSecretResponse: Decodable, Sendable, Hashable {
    public let secret: HomeAccessSecretDTO

    public init(secret: HomeAccessSecretDTO) {
        self.secret = secret
    }
}
