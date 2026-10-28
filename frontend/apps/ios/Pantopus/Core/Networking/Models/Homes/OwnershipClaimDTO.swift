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
    /// Whether any documents are attached; nil when the server didn't say.
    public var hasEvidence: Bool?
    /// What a claim in review still needs before it can be approved; nil otherwise.
    public var approval: ClaimApprovalProgressDTO?

    /// The claimed Home's address lines.
    public struct ClaimedHome: Decodable, Sendable, Hashable {
        public let address: String?
        public let address2: String?
        public let city: String?
        public let state: String?

        /// "901 C Street Unit 4, Vancouver", or nil without a street.
        var label: String? {
            guard let street else { return nil }
            guard let city = city?.trimmingCharacters(in: .whitespaces), !city.isEmpty else { return street }
            return "\(street), \(city)"
        }

        /// "901 C Street Unit 4", or nil without a street.
        var street: String? {
            let street = [address, address2]
                .compactMap { $0?.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty }
                .joined(separator: " ")
            return street.isEmpty ? nil : street
        }

        /// "Vancouver, WA", or nil when neither is known.
        var locality: String? {
            let parts = [city, state].compactMap { $0?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            return parts.isEmpty ? nil : parts.joined(separator: ", ")
        }
    }

    /// Still in review: the server shows every open claim as `under_review`.
    var isInReview: Bool {
        status == "under_review"
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case claimType = "claim_type"
        case method, status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case home
        case hasEvidence = "has_evidence"
        case approval
    }
}

/// The claimant's approval checklist: approval needs a confirmed identity (a Stripe
/// Identity check) and a document a reviewer checked. Values mirror the web
/// `ClaimApprovalProgress` (`frontend/packages/api/src/endpoints/homeOwnership.ts`).
public struct ClaimApprovalProgressDTO: Decodable, Sendable, Hashable {
    /// `not_started` · `started` (opened, not submitted) · `processing` (Stripe is
    /// checking) · `requires_input` (the last attempt didn't pass) · `verified`.
    public let identity: String
    /// False while identity checks aren't set up; the claimant can't start one yet.
    public let identityCheckAvailable: Bool
    /// `missing` · `pending` (waiting for a reviewer) · `verified`.
    public let proof: String

    public init(identity: String, identityCheckAvailable: Bool, proof: String) {
        self.identity = identity
        self.identityCheckAvailable = identityCheckAvailable
        self.proof = proof
    }

    private enum CodingKeys: String, CodingKey {
        case identity
        case identityCheckAvailable = "identity_check_available"
        case proof
    }
}

/// Body for `POST …/identity-check`: the platform picks where Stripe sends them back.
public struct ClaimIdentityCheckRequest: Encodable, Sendable, Hashable {
    public let platform: String
}

/// Reply to `POST …/identity-check`. `verificationUrl` is Stripe's single-use page;
/// nil when the check is already with Stripe.
public struct ClaimIdentityCheckStartResponse: Decodable, Sendable, Hashable {
    public let verificationUrl: String?

    private enum CodingKeys: String, CodingKey {
        case verificationUrl = "verification_url"
    }
}

/// Reply to `GET …/identity-check`.
public struct ClaimIdentityCheckResponse: Decodable, Sendable, Hashable {
    public let approval: ClaimApprovalProgressDTO?
}

/// Envelope for `GET /api/homes/my-ownership-claims`.
public struct MyOwnershipClaimsResponse: Decodable, Sendable, Hashable {
    public let claims: [OwnershipClaimDTO]
    let uploadSession: ClaimUploadSession?
    enum CodingKeys: String, CodingKey { case claims, uploadSession = "upload_session" }
}
