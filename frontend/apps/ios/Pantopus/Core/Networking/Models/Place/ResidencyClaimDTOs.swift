//
//  ResidencyClaimDTOs.swift
//  Pantopus
//
//  The Residency Pass (Wave 1): scoped, expiring, revocable residency
//  claims. A claim attests ONE derived fact ("a verified resident of
//  Camas School District") behind an unguessable code; the public
//  check is LIVE and every view is logged for the issuer. Vocabulary
//  enums fall back to safe constants so a server-side addition cannot
//  break an older build.
//

import Foundation

/// The six scopes the backend derives statements for. `unknown` keeps
/// an older build rendering a claim list that contains a scope it has
/// never heard of.
public enum ResidencyClaimScope: String, Decodable, Sendable, Hashable, CaseIterable {
    case address
    case city
    case county
    case state
    case schoolDistrict = "school_district"
    case congressionalDistrict = "congressional_district"

    public static var pickerOrder: [ResidencyClaimScope] {
        [.city, .schoolDistrict, .county, .state, .congressionalDistrict, .address]
    }
}

public enum ResidencyClaimScopeOrUnknown: Decodable, Sendable, Hashable {
    case known(ResidencyClaimScope)
    case unknown(String)

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ResidencyClaimScope(rawValue: raw).map(Self.known) ?? .unknown(raw)
    }
}

/// `expired` is derived server-side from expires_at; an unrecognized
/// status renders inert (treated as expired), never as active.
public enum ResidencyClaimStatus: String, Decodable, Sendable, Hashable {
    case active
    case revoked
    case expired

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ResidencyClaimStatus(rawValue: raw) ?? .expired
    }
}

public struct ResidencyClaim: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let scope: ResidencyClaimScopeOrUnknown
    /// The exact sentence a verifier sees — frozen at issue.
    public let statement: String
    public let holderName: String
    public let status: ResidencyClaimStatus
    public let claimCode: String
    public let verifyUrl: String
    public let issuedAt: String
    public let expiresAt: String
    public let revokedAt: String?
    public let residencyVerifiedAt: String?
    public let viewCount: Int
    public let lastViewedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case scope
        case statement
        case holderName = "holder_name"
        case status
        case claimCode = "claim_code"
        case verifyUrl = "verify_url"
        case issuedAt = "issued_at"
        case expiresAt = "expires_at"
        case revokedAt = "revoked_at"
        case residencyVerifiedAt = "residency_verified_at"
        case viewCount = "view_count"
        case lastViewedAt = "last_viewed_at"
    }
}

public struct IssueResidencyClaimRequest: Encodable, Sendable {
    public let scope: String
    public let expiresInDays: Int

    public init(scope: ResidencyClaimScope, expiresInDays: Int) {
        self.scope = scope.rawValue
        self.expiresInDays = expiresInDays
    }

    private enum CodingKeys: String, CodingKey {
        case scope
        case expiresInDays = "expires_in_days"
    }
}

public struct ResidencyClaimResponse: Decodable, Sendable {
    public let claim: ResidencyClaim
}

public struct ResidencyClaimsResponse: Decodable, Sendable {
    public let claims: [ResidencyClaim]
}
