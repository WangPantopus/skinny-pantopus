//
//  AdminClaimsDTOs.swift
//  Pantopus
//
//  DTOs for the admin Review-claims surface. Mirrors the web client's
//  `api.admin.*` shape (`frontend/packages/api/src/admin.ts`) — same
//  field names, decoded directly from `backend/routes/admin.js`'s
//  enriched `/claims` payload.
//
//  Routes:
//    GET  /api/admin/claims?bucket=         backend/routes/admin.js:156
//    GET  /api/admin/claims/counts          backend/routes/admin.js:230
//    GET  /api/admin/claims/:claimId        backend/routes/admin.js:260
//    POST /api/admin/claims/:claimId/review backend/routes/admin.js:342
//

import Foundation

/// Tab bucket on the admin Review-claims queue. The server uses the same
/// vocabulary to filter — `pending` collapses
/// `submitted | pending_review | needs_more_info | disputed` per
/// `BUCKET_STATES` in `backend/routes/admin.js`.
public enum AdminClaimBucket: String, Sendable, Hashable {
    case pending
    case approved
    case rejected
}

/// Action posted to `/api/admin/claims/:claimId/review`. The handler
/// rejects anything outside this set with a 400.
///
/// `.challenge` keeps the legacy `request_more_info` wire value — the
/// A13.3 reshape renamed the reviewer-facing verdict from "Request more
/// info" to "Challenge" (an inline composer with reason chips), but the
/// backend route still classifies it as `request_more_info` and flips the
/// ordinary claim into `needs_more_info`; dispute adjudication is separate.
public enum AdminClaimReviewAction: String, Codable, Sendable, Hashable {
    case approve
    case reject
    case challenge = "request_more_info"
}

/// Enriched home payload joined onto every admin claim row.
public struct AdminClaimHomeDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let address: String?
    public let city: String?
    public let state: String?
    public let zipcode: String?
    public let name: String?
    public let homeType: String?

    private enum CodingKeys: String, CodingKey {
        case id, address, city, state, zipcode, name
        case homeType = "home_type"
    }
}

/// Enriched claimant payload joined onto every admin claim row.
public struct AdminClaimUserDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let email: String?
    public let createdAt: String?
    public let profilePictureURL: String?

    private enum CodingKeys: String, CodingKey {
        case id, username, name, email
        case createdAt = "created_at"
        case profilePictureURL = "profile_picture_url"
    }
}

/// One row in the admin claims queue.
public struct AdminClaimDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let claimantUserId: String
    public let claimType: String?
    public let state: String
    public let method: String?
    public let riskScore: Int?
    public let createdAt: String
    public let updatedAt: String?
    public let evidenceCount: Int
    /// On a claim waiting on the claimant (Request info): documents they sent after the request.
    public var documentsSinceRequest: Int?
    public let home: AdminClaimHomeDTO?
    public let claimant: AdminClaimUserDTO?

    private enum CodingKeys: String, CodingKey {
        case id, state, method
        case homeId = "home_id"
        case claimantUserId = "claimant_user_id"
        case claimType = "claim_type"
        case riskScore = "risk_score"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case evidenceCount = "evidence_count"
        case documentsSinceRequest = "documents_since_request"
        case home, claimant
    }
}

/// Envelope returned by `GET /api/admin/claims`. `oldestAgeSeconds` is
/// only populated for the `pending` bucket and drives the queue banner's
/// "Oldest in queue: …" subtitle.
public struct AdminClaimsResponse: Decodable, Sendable, Hashable {
    public let claims: [AdminClaimDTO]
    public let total: Int
    public let oldestAgeSeconds: Int?

    private enum CodingKeys: String, CodingKey {
        case claims, total
        case oldestAgeSeconds = "oldest_age_seconds"
    }
}

/// Envelope returned by `GET /api/admin/claims/counts`. Drives the
/// per-bucket count badges on the tab strip.
public struct AdminClaimCountsResponse: Decodable, Sendable, Hashable {
    public let pending: Int
    public let approved: Int
    public let rejected: Int
}

/// Single evidence item attached to a claim. Mirrors the projection
/// built in `/api/admin/claims/:claimId`; legacy object references are withheld.
public struct AdminClaimEvidenceDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let evidenceType: String
    public let provider: String?
    public let status: String?
    public let storageRef: String?
    public let fileURL: String?
    public let fileName: String?
    public let fileSize: Int?
    public let mimeType: String?
    public let eligibleForReview: Bool?
    public let availabilityCode: String?
    public let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id, provider, status
        case evidenceType = "evidence_type"
        case storageRef = "storage_ref"
        case fileURL = "file_url"
        case fileName = "file_name"
        case fileSize = "file_size"
        case mimeType = "mime_type"
        case eligibleForReview = "eligible_for_review"
        case availabilityCode = "availability_code"
        case createdAt = "created_at"
    }
}

/// Embedded claim payload inside the detail envelope. Carries the same
/// state machine fields the reviewer reads.
public struct AdminClaimRecordDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let claimantUserId: String
    public let claimType: String?
    public let state: String
    public let method: String?
    public let riskScore: Int?
    public let createdAt: String
    public let updatedAt: String?
    public let reviewedBy: String?
    public let reviewedAt: String?
    public let reviewNote: String?
    /// Claimant identity-verification state — `not_started | pending |
    /// verified | failed`. Drives the "Verified ID" trust chip on the
    /// A13.3 claimant card.
    public let identityStatus: String?
    public let reviewToken: String?
    public let claimPhaseV2: String?
    public let challengeState: String?
    public let routingClassification: String?

    var requiresDisputeReview: Bool {
        state == "disputed" || claimPhaseV2 == "challenged" || challengeState == "challenged"
            || routingClassification == "challenge_claim"
    }

    private enum CodingKeys: String, CodingKey {
        case id, state, method
        case homeId = "home_id"
        case claimantUserId = "claimant_user_id"
        case claimType = "claim_type"
        case riskScore = "risk_score"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case reviewedBy = "reviewed_by"
        case reviewedAt = "reviewed_at"
        case reviewNote = "review_note"
        case identityStatus = "identity_status"
        case reviewToken = "review_token"
        case claimPhaseV2 = "claim_phase_v2"
        case challengeState = "challenge_state"
        case routingClassification = "routing_classification"
    }
}

/// Full claim detail envelope returned by `GET /api/admin/claims/:claimId`.
public struct AdminClaimDetailResponse: Decodable, Sendable, Hashable {
    public let claim: AdminClaimRecordDTO
    public let home: AdminClaimHomeDTO?
    public let claimant: AdminClaimUserDTO?
    public let evidence: [AdminClaimEvidenceDTO]
    /// What approval needs, as the server tests it; nil when it couldn't be read.
    public let approval: ClaimReviewApprovalDTO?
}

/// The reviewer's approval panel (`approval` on the admin claim detail): a confirmed
/// identity (a Stripe Identity check, or a platform admin's attestation) and a checked
/// document. Mirrors the web `ClaimReviewApproval`.
public struct ClaimReviewApprovalDTO: Decodable, Sendable, Hashable {
    public let identityConfirmed: Bool
    /// `not_started` · `started` · `processing` · `requires_input` · `verified`.
    public let identity: String
    /// The name on the confirmed ID, to compare with the ownership document.
    public let identityName: String?
    /// False while identity checks aren't set up: the claimant can't do one, so the reviewer confirms identity.
    public let identityCheckAvailable: Bool
    /// `missing` · `pending` · `verified`.
    public let proof: String
    public let canApprove: Bool

    private enum CodingKeys: String, CodingKey {
        case identityConfirmed = "identity_confirmed"
        case identity
        case identityName = "identity_name"
        case identityCheckAvailable = "identity_check_available"
        case proof
        case canApprove = "can_approve"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        identityConfirmed = try container.decode(Bool.self, forKey: .identityConfirmed)
        identity = try container.decode(String.self, forKey: .identity)
        identityName = try container.decodeIfPresent(String.self, forKey: .identityName)
        identityCheckAvailable = try container.decodeIfPresent(Bool.self, forKey: .identityCheckAvailable) ?? true
        proof = try container.decode(String.self, forKey: .proof)
        canApprove = try container.decode(Bool.self, forKey: .canApprove)
    }
}

/// Household role a platform admin may approve a claim as (`approve_as`). Left out, the claim type decides:
/// owner → owner, admin → admin, resident → renter. Labels and hints match the web review page.
public enum AdminClaimApprovalRole: String, Codable, CaseIterable, Sendable, Hashable, Identifiable {
    case owner
    case admin
    case manager
    case member
    case leaseResident = "lease_resident"
    case restrictedMember = "restricted_member"
    case guest

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .owner: "Owner"
        case .admin: "Admin"
        case .manager: "Manager"
        case .member: "Member"
        case .leaseResident: "Resident"
        case .restrictedMember: "Restricted member"
        case .guest: "Guest"
        }
    }

    /// The role's default access.
    public var hint: String {
        switch self {
        case .owner: "Full control of the home, including ownership and security."
        case .admin: "Views the home and its ownership, and votes on household decisions."
        case .manager, .member: "Views the home and works on tasks."
        case .leaseResident: "Sees members, Wi-Fi, the calendar and packages, and works on tasks."
        case .restrictedMember, .guest: "Views the home only."
        }
    }

    /// The role an approval grants when the admin keeps what the person claimed.
    public static func claimed(by claimType: String?) -> Self {
        switch claimType {
        case "owner": .owner
        case "admin": .admin
        default: .leaseResident
        }
    }
}

/// Request body for `POST /api/admin/claims/:claimId/review`.
public struct AdminClaimReviewRequest: Encodable, Sendable, Hashable {
    public let action: AdminClaimReviewAction
    public let note: String?
    public let reviewToken: String
    /// Approve only: grant this role instead of the one the claim type gives.
    public let approveAs: AdminClaimApprovalRole?
    /// Approve only: the admin confirmed the claimant's identity themselves. Sent only when true.
    public let identityConfirmed: Bool?

    public init(
        action: AdminClaimReviewAction,
        reviewToken: String,
        note: String? = nil,
        approveAs: AdminClaimApprovalRole? = nil,
        identityConfirmed: Bool? = nil
    ) {
        self.action = action
        self.note = note
        self.reviewToken = reviewToken
        self.approveAs = approveAs
        self.identityConfirmed = identityConfirmed == true ? true : nil
    }

    private enum CodingKeys: String, CodingKey {
        case action, note
        case reviewToken = "review_token"
        case approveAs = "approve_as"
        case identityConfirmed = "identity_confirmed"
    }
}

public typealias AdminClaimReviewResponse = HomeClaimDecisionReceipt
