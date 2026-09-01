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
/// claim into the `challenged` phase. See `backend/routes/admin.js:399`.
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
/// built in `/api/admin/claims/:claimId` — file URL is presigned.
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
    public let createdAt: String

    private enum CodingKeys: String, CodingKey {
        case id, provider, status
        case evidenceType = "evidence_type"
        case storageRef = "storage_ref"
        case fileURL = "file_url"
        case fileName = "file_name"
        case fileSize = "file_size"
        case mimeType = "mime_type"
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
    }
}

/// Full claim detail envelope returned by `GET /api/admin/claims/:claimId`.
public struct AdminClaimDetailResponse: Decodable, Sendable, Hashable {
    public let claim: AdminClaimRecordDTO
    public let home: AdminClaimHomeDTO?
    public let claimant: AdminClaimUserDTO?
    public let evidence: [AdminClaimEvidenceDTO]
}

/// Request body for `POST /api/admin/claims/:claimId/review`.
public struct AdminClaimReviewRequest: Encodable, Sendable, Hashable {
    public let action: AdminClaimReviewAction
    public let note: String?

    public init(action: AdminClaimReviewAction, note: String? = nil) {
        self.action = action
        self.note = note
    }
}

/// Generic ack returned by the review endpoint — we ignore the body and
/// refetch the bucket / counts on success.
public struct AdminClaimReviewResponse: Decodable, Sendable, Hashable {
    public let action: String?
    public let newState: String?
    public let claimId: String?
    public let homeId: String?

    private enum CodingKeys: String, CodingKey {
        case action, newState, claimId, homeId
    }
}
