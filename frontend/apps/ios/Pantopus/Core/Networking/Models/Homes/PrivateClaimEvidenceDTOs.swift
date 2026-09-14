import Foundation

struct ClaimUploadSession: Decodable, Hashable {
    let actorId: String
    let sessionScope: String
    enum CodingKeys: String, CodingKey {
        case actorId = "actor_id", sessionScope = "session_scope"
    }

    var isValid: Bool {
        UUID(uuidString: actorId) != nil && HomeClaimReviewSnapshot.validToken(sessionScope)
    }
}

struct PrivateClaimEvidenceSession: Decodable, Hashable {
    let actorId: String
    let sessionScope: String
    let homeId: String
    let claimId: String
    enum CodingKeys: String, CodingKey {
        case actorId = "actor_id", sessionScope = "session_scope"
        case homeId = "home_id", claimId = "claim_id"
    }
}

struct PrivateClaimEvidenceDTO: Decodable, Hashable, Identifiable {
    let id: String
    let homeId: String
    let claimId: String
    let evidenceType: String
    let fileName: String
    let fileSize: Int
    let mimeType: String
    let status: String
    let state: String
    let available: Bool
    let eligibleForReview: Bool
    let cleanupPending: Bool?
    enum CodingKeys: String, CodingKey {
        case id, status, state, available
        case homeId = "home_id", claimId = "claim_id", evidenceType = "evidence_type"
        case fileName = "file_name", fileSize = "file_size", mimeType = "mime_type"
        case eligibleForReview = "eligible_for_review"
        case cleanupPending = "cleanup_pending"
    }

    func matches(home: String, claim: String, evidence: String? = nil) -> Bool {
        homeId == home && claimId == claim && UUID(uuidString: id) != nil
            && (evidence == nil || id == evidence) && fileSize > 0 && fileSize <= CLAIM_FILE_MAX_BYTES
            && ["reserved", "ready", "retired"].contains(state)
            && PrivateClaimEvidenceClient.allowedMIMEs.contains(mimeType)
    }
}

struct PrivateClaimEvidenceList: Decodable {
    let evidence: [PrivateClaimEvidenceDTO]
    let canVerify: Bool
    let reviewToken: String
    let claimSession: PrivateClaimEvidenceSession
    enum CodingKeys: String, CodingKey {
        case evidence, canVerify = "can_verify", reviewToken = "review_token", claimSession = "claim_session"
    }
}

struct PrivateClaimEvidenceEnvelope: Decodable {
    let evidence: PrivateClaimEvidenceDTO
}

struct PrivateClaimEvidenceVerification: Decodable {
    let ok: Bool
    let homeId: String
    let claimId: String
    let uploadId: String
    let action: String
    let reviewToken: String
    let record: PrivateClaimEvidenceDTO
    let replayed: Bool
    enum CodingKeys: String, CodingKey {
        case ok, action, record, replayed
        case homeId = "home_id", claimId = "claim_id", uploadId = "upload_id", reviewToken = "review_token"
    }
}
