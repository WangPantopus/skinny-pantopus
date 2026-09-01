//
//  OwnershipClaimDTO.swift
//  Pantopus
//
//  DTOs for `GET /api/homes/my-ownership-claims` — route
//  `backend/routes/homeOwnership.js:217`. Backend masks the internal
//  `state` to a "generic status" string for the opaque-handshake
//  contract; the row still carries `home_id`, `claim_type`, `method`,
//  and timestamps.
//

import Foundation

/// One row from `GET /api/homes/my-ownership-claims`.
public struct OwnershipClaimDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let claimType: String
    public let method: String
    public let status: String
    public let createdAt: String
    public let updatedAt: String

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case claimType = "claim_type"
        case method, status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Envelope for `GET /api/homes/my-ownership-claims`.
public struct MyOwnershipClaimsResponse: Decodable, Sendable, Hashable {
    public let claims: [OwnershipClaimDTO]
}
