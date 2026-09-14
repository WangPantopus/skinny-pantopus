import Foundation

enum HomeRelationshipAction: String, Codable, CaseIterable {
    case decline = "decline_relationship"
    case flag = "flag_unknown_person"

    var label: String {
        self == .decline ? "Continue independent review" : "Flag unknown claimant"
    }

    var explanation: String {
        self == .decline
            ? "This records your household response. It does not approve, reject or remove the claim."
            : "This requests review of an unknown claimant. Only eligible evidence can establish a qualifying dispute."
    }
}

struct HomeRelationshipCommand: Codable, Equatable {
    let action: HomeRelationshipAction
    let note: String
    let requestId: String
    let reviewToken: String

    enum CodingKeys: String, CodingKey {
        case action, note
        case requestId = "request_id"
        case reviewToken = "review_token"
    }
}

struct HomeRelationshipReceipt: Codable, Equatable {
    let id: String
    let homeId: String
    let claimId: String
    let actorId: String
    let requestId: String
    let action: HomeRelationshipAction
    let legacyRequest: Bool
    let requestHash: String
    let reviewToken: String
    let createdAt: String
    let result: Result

    struct Result: Codable, Equatable {
        let state: String
        let claimPhaseV2: String?
        let routingClassification: String?
        let challengeState: String?
        let claimStrength: String?
        let qualifiesForDispute: Bool

        enum CodingKeys: String, CodingKey {
            case state
            case claimPhaseV2 = "claim_phase_v2"
            case routingClassification = "routing_classification"
            case challengeState = "challenge_state"
            case claimStrength = "claim_strength"
            case qualifiesForDispute = "qualifies_for_dispute"
        }
    }

    enum CodingKeys: String, CodingKey {
        case id, action, result
        case homeId = "home_id"
        case claimId = "claim_id"
        case actorId = "actor_id"
        case requestId = "request_id"
        case legacyRequest = "legacy_request"
        case requestHash = "request_hash"
        case reviewToken = "review_token"
        case createdAt = "created_at"
    }

    func matches(_ draft: HomeRelationshipDraft) -> Bool {
        UUID(uuidString: id) != nil && homeId == draft.homeId && claimId == draft.claimId && actorId == draft.actorId
            && requestId == draft.command.requestId && action == draft.command.action && !legacyRequest
            && reviewToken == draft.command.reviewToken && HomeClaimReviewSnapshot.validToken(requestHash)
            && HomeTaskRecurrenceDate.parse(createdAt) != nil && !result.state.isEmpty
    }
}

struct HomeRelationshipDraft: Codable, Equatable {
    let version: Int
    let origin: String
    let actorId: String
    let homeId: String
    let claimId: String
    let command: HomeRelationshipCommand
    var confirmed: HomeRelationshipReceipt?

    func matches(origin: String, actor: String, home: String) -> Bool {
        version == 1 && self.origin == origin && actorId == actor && homeId == home
            && [actorId, homeId, claimId, command.requestId].allSatisfy { UUID(uuidString: $0) != nil }
            && command.requestId == command.requestId.lowercased() && HomeClaimReviewSnapshot.validToken(command.reviewToken)
            && command.note.utf16.count <= 1000 && command.note == command.note.trimmingCharacters(in: .whitespacesAndNewlines)
            && (confirmed == nil || confirmed?.matches(self) == true)
    }
}

struct HomeRelationshipReview: Decodable {
    let claim: Claim
    let relationshipSession: Session

    struct Session: Decodable {
        let actorId: String
        let homeId: String
        let sessionScope: String
        enum CodingKeys: String, CodingKey {
            case actorId = "actor_id"
            case homeId = "home_id"
            case sessionScope = "session_scope"
        }
    }

    struct Claim: Decodable {
        let id: String
        let homeId: String
        let claimantUserId: String
        let claimType: String
        let state: String
        let claimPhaseV2: String?
        let challengeState: String?
        let terminalReason: String
        let mergedIntoClaimId: String?
        let expiresAt: String?
        let reviewToken: String
        let evidence: [Evidence]

        enum CodingKeys: String, CodingKey {
            case id, state, evidence
            case homeId = "home_id"
            case claimantUserId = "claimant_user_id"
            case claimType = "claim_type"
            case claimPhaseV2 = "claim_phase_v2"
            case challengeState = "challenge_state"
            case terminalReason = "terminal_reason"
            case mergedIntoClaimId = "merged_into_claim_id"
            case expiresAt = "expires_at"
            case reviewToken = "review_token"
        }

        func canDecide(actor: String) -> Bool {
            guard claimantUserId != actor, mergedIntoClaimId == nil, terminalReason == "none",
                  !["approved", "rejected", "revoked", "disputed"].contains(state), challengeState != "challenged" else { return false }
            if let expiresAt, (HomeTaskRecurrenceDate.parse(expiresAt) ?? .distantPast) <= .now { return false }
            if let claimPhaseV2 { return ["initiated", "evidence_submitted", "under_review"].contains(claimPhaseV2) }
            return ["draft", "submitted", "pending_review", "pending_challenge_window", "needs_more_info"].contains(state)
        }
    }

    struct Evidence: Decodable, Identifiable {
        let id: String
        let evidenceType: String
        let eligibleForReview: Bool
        enum CodingKeys: String, CodingKey {
            case id
            case evidenceType = "evidence_type"
            case eligibleForReview = "eligible_for_review"
        }
    }

    enum CodingKeys: String, CodingKey {
        case claim
        case relationshipSession = "relationship_session"
    }

    func matches(home: String, claimId: String, actor: String) -> Bool {
        relationshipSession.actorId == actor && relationshipSession.homeId == home
            && HomeClaimReviewSnapshot.validToken(relationshipSession.sessionScope)
            && claim.id == claimId && claim.homeId == home && UUID(uuidString: claim.claimantUserId) != nil
            && !claim.claimType.isEmpty && !claim.state.isEmpty && HomeClaimReviewSnapshot.validToken(claim.reviewToken)
            && claim.evidence.allSatisfy { UUID(uuidString: $0.id) != nil && !$0.evidenceType.isEmpty }
            && Set(claim.evidence.map(\.id)).count == claim.evidence.count
    }
}

struct HomeRelationshipResponse: Decodable {
    let ok: Bool
    let homeId: String
    let claimId: String
    let claimantId: String
    let action: HomeRelationshipAction
    let replayed: Bool
    let receipt: HomeRelationshipReceipt
    let claim: CurrentClaim

    struct CurrentClaim: Decodable {
        let id: String
        let state: String
    }

    func matches(_ draft: HomeRelationshipDraft, claimant: String) -> Bool {
        ok && homeId == draft.homeId && claimId == draft.claimId && claimantId == claimant && action == draft.command.action
            && claim.id == draft.claimId && !claim.state.isEmpty && receipt.matches(draft)
    }
}
