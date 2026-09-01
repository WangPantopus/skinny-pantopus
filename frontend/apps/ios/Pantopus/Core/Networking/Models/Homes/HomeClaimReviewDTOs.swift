//
//  HomeClaimReviewDTOs.swift
//  Pantopus
//
//  H6 — DTOs for the **per-home owner** claim-review surface (distinct
//  from the platform-admin `/api/admin/claims*` queue backing
//  `Features/ReviewClaims/*`). Two different claim collections live
//  behind this screen and must not be conflated:
//
//  1. **Ownership claims** — table `HomeOwnershipClaim`, served by
//     `backend/routes/homeOwnership.js` under `/api/homes/:id/ownership-claims`.
//  2. **Residency claims** — table `HomeResidencyClaim`, served by
//     `backend/routes/home.js` under `/api/homes/:id/claims`.
//

import Foundation

// MARK: - Ownership claims (HomeOwnershipClaim)

/// One row of `GET /api/homes/:id/ownership-claims`
/// (`backend/routes/homeOwnership.js:490`). The handler masks the
/// claimant — `claimant.masked == true` and only `account_age_days` /
/// `method` / `risk_score` survive, so this list alone can never render
/// a claimant name. The comparison payload is the only owner-visible
/// source of identified claimants.
public struct HomeOwnershipClaimDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String?
    public let claimType: String?
    public let state: String
    public let claimPhaseV2: String?
    public let claimStrength: String?
    public let routingClassification: String?
    public let challengeState: String?
    public let identityStatus: String?
    public let method: String?
    public let riskScore: Double?
    public let createdAt: String?
    public let updatedAt: String?
    public let claimant: HomeOwnershipClaimMaskedClaimantDTO?
    public let evidence: [HomeClaimEvidenceDTO]?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case claimType = "claim_type"
        case state
        case claimPhaseV2 = "claim_phase_v2"
        case claimStrength = "claim_strength"
        case routingClassification = "routing_classification"
        case challengeState = "challenge_state"
        case identityStatus = "identity_status"
        case method
        case riskScore = "risk_score"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case claimant, evidence
    }
}

/// Masked claimant projection built at `homeOwnership.js:513-523`.
public struct HomeOwnershipClaimMaskedClaimantDTO: Decodable, Sendable, Hashable {
    public let masked: Bool?
    public let accountAgeDays: Int?
    public let method: String?
    public let riskScore: Double?

    private enum CodingKeys: String, CodingKey {
        case masked
        case accountAgeDays = "account_age_days"
        case method
        case riskScore = "risk_score"
    }
}

/// Envelope for `GET /api/homes/:id/ownership-claims`.
public struct HomeOwnershipClaimsResponse: Decodable, Sendable, Hashable {
    public let claims: [HomeOwnershipClaimDTO]
}

/// Evidence row joined onto a claim. Selected at
/// `homeOwnership.js:505` (list) and `homeClaimComparisonService.js:69`
/// (compare) — the compare variant carries the extra columns.
public struct HomeClaimEvidenceDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let claimId: String?
    public let evidenceType: String?
    public let provider: String?
    public let status: String?
    public let confidenceLevel: String?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case claimId = "claim_id"
        case evidenceType = "evidence_type"
        case provider, status
        case confidenceLevel = "confidence_level"
        case createdAt = "created_at"
    }
}

// MARK: - Comparison (side-by-side)

/// `GET /api/homes/:id/ownership-claims/compare`
/// (`backend/routes/homeOwnership.js:536`) → payload assembled by
/// `backend/services/homeClaimComparisonService.js:113`.
///
/// The route 404s when the `adminCompare` flag is off — callers treat a
/// failure as "no comparison available" and fall back to the plain
/// ownership-claims list.
public struct HomeClaimComparisonDTO: Decodable, Sendable, Hashable {
    public let homeId: String
    public let home: HomeClaimComparisonHomeDTO?
    public let householdResolutionState: String?
    public let incumbent: HomeClaimComparisonIncumbentDTO?
    public let claims: [HomeClaimComparisonClaimDTO]

    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id"
        case home
        case householdResolutionState = "household_resolution_state"
        case incumbent, claims
    }
}

/// Home block of the comparison payload
/// (`homeClaimComparisonService.js:115-125`).
public struct HomeClaimComparisonHomeDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let name: String?
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let securityState: String?
    public let householdResolutionState: String?

    private enum CodingKeys: String, CodingKey {
        case id, name, address, city, state, zipcode
        case securityState = "security_state"
        case householdResolutionState = "household_resolution_state"
    }
}

/// Incumbent block (`homeClaimComparisonService.js:127-133`) — the
/// verified owners of record that the challengers are compared against.
public struct HomeClaimComparisonIncumbentDTO: Decodable, Sendable, Hashable {
    public let owners: [HomeClaimComparisonOwnerDTO]
    public let hasVerifiedOwner: Bool
    public let challengeState: String?

    private enum CodingKeys: String, CodingKey {
        case owners
        case hasVerifiedOwner = "has_verified_owner"
        case challengeState = "challenge_state"
    }
}

/// One verified `HomeOwner` row plus its hydrated user.
public struct HomeClaimComparisonOwnerDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let subjectId: String?
    public let ownerStatus: String?
    public let isPrimaryOwner: Bool?
    public let verificationTier: String?
    public let addedVia: String?
    public let createdAt: String?
    public let user: HomeClaimUserDTO?

    private enum CodingKeys: String, CodingKey {
        case id
        case subjectId = "subject_id"
        case ownerStatus = "owner_status"
        case isPrimaryOwner = "is_primary_owner"
        case verificationTier = "verification_tier"
        case addedVia = "added_via"
        case createdAt = "created_at"
        case user
    }
}

/// One claim in the comparison payload
/// (`homeClaimComparisonService.js:91-111`). Unlike the masked list
/// endpoint this one carries the hydrated claimant.
public struct HomeClaimComparisonClaimDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String?
    public let claimantUserId: String?
    public let claimant: HomeClaimUserDTO?
    public let claimType: String?
    public let state: String?
    public let claimPhaseV2: String?
    public let terminalReason: String?
    public let challengeState: String?
    public let claimStrength: String?
    public let routingClassification: String?
    public let identityStatus: String?
    public let mergedIntoClaimId: String?
    public let expiresAt: String?
    public let method: String?
    public let riskScore: Double?
    public let createdAt: String?
    public let updatedAt: String?
    public let evidence: [HomeClaimEvidenceDTO]?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case claimantUserId = "claimant_user_id"
        case claimant
        case claimType = "claim_type"
        case state
        case claimPhaseV2 = "claim_phase_v2"
        case terminalReason = "terminal_reason"
        case challengeState = "challenge_state"
        case claimStrength = "claim_strength"
        case routingClassification = "routing_classification"
        case identityStatus = "identity_status"
        case mergedIntoClaimId = "merged_into_claim_id"
        case expiresAt = "expires_at"
        case method
        case riskScore = "risk_score"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case evidence
    }
}

/// Shared hydrated-user shape used by the comparison payload.
public struct HomeClaimUserDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let email: String?
    public let profilePictureUrl: String?
    public let createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, username, name, email
        case profilePictureUrl = "profile_picture_url"
        case createdAt = "created_at"
    }
}

// MARK: - Ownership-claim mutations

/// Body for `POST /api/homes/:id/ownership-claims/:claimId/review`.
/// Validated by `reviewClaimSchema` (`homeOwnership.js:39`) —
/// `action` ∈ approve | reject | flag, optional `note` ≤ 1000 chars.
public struct HomeOwnershipClaimReviewRequest: Encodable, Sendable, Hashable {
    public let action: String
    public let note: String?

    public init(action: String, note: String? = nil) {
        self.action = action
        self.note = note
    }
}

/// Body for `POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship`.
/// Validated by `resolveRelationshipSchema` (`homeOwnership.js:54`) —
/// `action` ∈ invite_to_household | decline_relationship |
/// flag_unknown_person, optional `note` ≤ 1000 chars.
public struct HomeClaimRelationshipResolveRequest: Encodable, Sendable, Hashable {
    public let action: String
    public let note: String?

    public init(action: String, note: String? = nil) {
        self.action = action
        self.note = note
    }
}

/// Response envelope shared by the review + resolve-relationship
/// handlers. Both return a human-readable `message`; review additionally
/// returns `claim`, resolve returns `claim` + optional `invitation`.
public struct HomeOwnershipClaimActionResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let action: String?
}

// MARK: - Residency claims (HomeResidencyClaim)

/// One row of `GET /api/homes/:id/claims`
/// (`backend/routes/home.js:6716`). Unlike ownership claims these are
/// **not** masked — the handler joins the claimant user directly.
public struct HomeResidencyClaimDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String?
    public let userId: String?
    public let status: String
    public let claimedRole: String?
    public let claimedAddress: String?
    public let createdAt: String?
    public let claimant: HomeResidencyClaimantDTO?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case userId = "user_id"
        case status
        case claimedRole = "claimed_role"
        case claimedAddress = "claimed_address"
        case createdAt = "created_at"
        case claimant
    }
}

/// Claimant join selected at `backend/routes/home.js:6731`.
public struct HomeResidencyClaimantDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let firstName: String?
    public let lastName: String?
    public let profilePictureUrl: String?
    public let city: String?
    public let state: String?

    private enum CodingKeys: String, CodingKey {
        case id, username, name
        case firstName = "first_name"
        case lastName = "last_name"
        case profilePictureUrl = "profile_picture_url"
        case city, state
    }
}

/// Envelope for `GET /api/homes/:id/claims`.
public struct HomeResidencyClaimsResponse: Decodable, Sendable, Hashable {
    public let claims: [HomeResidencyClaimDTO]
}

/// Body for `POST /api/homes/:id/claim/:claimId/approve`
/// (`backend/routes/home.js:6756` reads `proposed_role`). Omitted the
/// role falls back to the claimant's own `claimed_role`.
public struct HomeResidencyClaimApproveRequest: Encodable, Sendable, Hashable {
    public let proposedRole: String?

    public init(proposedRole: String? = nil) {
        self.proposedRole = proposedRole
    }

    private enum CodingKeys: String, CodingKey {
        case proposedRole = "proposed_role"
    }
}

/// Body for `POST /api/homes/:id/claim/:claimId/reject`
/// (`backend/routes/home.js:6842` reads `reason`).
public struct HomeResidencyClaimRejectRequest: Encodable, Sendable, Hashable {
    public let reason: String?

    public init(reason: String? = nil) {
        self.reason = reason
    }
}

/// Response envelope for both residency-claim mutations —
/// `{ message, occupancy? }` (`home.js:6828` / `home.js:6893`).
public struct HomeResidencyClaimActionResponse: Decodable, Sendable, Hashable {
    public let message: String?
}
