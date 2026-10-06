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
    /// Nullable in `HomeOwnershipClaim`: real submissions always set it, but
    /// older rows may not, and one such row must not fail the whole list.
    public let method: String?
    public let status: String
    public let createdAt: String
    public let updatedAt: String
    /// The address the person claimed (their own entry), when the server sends it.
    public var home: ClaimedHome?

    /// The claimed Home's address lines.
    public struct ClaimedHome: Decodable, Sendable, Hashable {
        public let address: String?
        public let address2: String?
        public let city: String?
        public let state: String?

        /// "901 C Street Unit 4, Vancouver", or nil without a street.
        var label: String? {
            let street = [address, address2]
                .compactMap { $0?.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
                .joined(separator: " ")
            guard !street.isEmpty else { return nil }
            guard let city = city?.trimmingCharacters(in: .whitespaces), !city.isEmpty else { return street }
            return "\(street), \(city)"
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case claimType = "claim_type"
        case method, status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case home
    }
}

/// Envelope for `GET /api/homes/my-ownership-claims`.
public struct MyOwnershipClaimsResponse: Decodable, Sendable, Hashable {
    public let claims: [OwnershipClaimDTO]
    let uploadSession: ClaimUploadSession?
    enum CodingKeys: String, CodingKey { case claims, uploadSession = "upload_session" }
}
