import CryptoKit
import Foundation

/// Claim reads and decisions remain bound to the account that opened the screen.
@MainActor
final class HomeClaimSessionScope {
    private let identity: () -> String?
    private let openingIdentity: String?

    init(api: APIClient, identity: (() -> String?)? = nil) {
        let resolve = identity ?? {
            let auth = api.authProvider ?? AuthManager.shared
            guard case let .signedIn(user) = auth.state else { return nil }
            let session: String
            if let sessionId = auth.sessionId {
                session = sessionId
            } else if let token = auth.accessToken {
                session = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
            } else {
                return nil
            }
            return "\(api.apiBaseURL.absoluteString)|\(user.id)|\(session)"
        }
        self.identity = resolve
        openingIdentity = resolve()
    }

    var isCurrent: Bool {
        openingIdentity != nil && identity() == openingIdentity
    }

    func requireCurrent() throws {
        guard isCurrent else { throw HomeClaimReviewError.sessionChanged }
    }
}

enum HomeClaimReviewError: LocalizedError {
    case sessionChanged
    case snapshotChanged
    case pendingDecision
    case disputeReview

    var errorDescription: String? {
        switch self {
        case .sessionChanged: "Your session changed. Reopen the claim to continue."
        case .snapshotChanged: "The claim changed. Reopen it and review the current evidence."
        case .disputeReview: "This disputed claim needs the dedicated dispute review flow."
        case .pendingDecision: "Retry the previous decision or reload the claim before choosing another action."
        }
    }

    static func isFinalClientFailure(_ error: any Error) -> Bool {
        guard let error = error as? APIError else { return false }
        switch error {
        case .unauthorized, .forbidden, .notFound: return true
        case .clientError: return true
        case let .server(status, _): return (400...499).contains(status)
        default: return false
        }
    }

    static func message(for error: any Error) -> String {
        if case let APIError.clientError(status, body) = error, status == 409 {
            if APIError.code(in: body) == "CLAIM_CHALLENGE_REVIEW_REQUIRED" {
                return "This disputed claim needs the dedicated dispute review flow."
            }
            if APIError.code(in: body) == "CLAIM_REVIEW_CHANGED" { return snapshotChanged.localizedDescription }
            return error.localizedDescription
        }
        return error.localizedDescription
    }
}

struct HomeClaimReviewSnapshot: Equatable, Identifiable {
    let homeId: String
    let claimId: String
    let claimantId: String
    let reviewToken: String
    let claimType: String
    let eligibleEvidenceCount: Int
    let evidenceCount: Int
    var id: String {
        "\(claimId):\(reviewToken)"
    }

    var summary: String {
        "Claim type: \(claimType). \(eligibleEvidenceCount) of \(evidenceCount) evidence items are eligible for review."
    }

    static func validToken(_ token: String?) -> Bool {
        guard let token, token.count == 64 else { return false }
        return token.allSatisfy { "0123456789abcdef".contains($0) }
    }
}

/// The server returns this exact durable decision, including replay recovery.
public struct HomeClaimDecisionReceipt: Decodable, Sendable, Hashable {
    public let ok: Bool
    public let homeId: String
    public let claimId: String
    public let claimantId: String
    public let action: String
    public let state: String
    public let replayed: Bool
    public let occupancy: Occupancy?

    public struct Occupancy: Decodable, Sendable, Hashable {
        public let id: String
        public let homeId: String
        public let userId: String
        private enum CodingKeys: String, CodingKey {
            case id
            case homeId = "home_id"
            case userId = "user_id"
        }
    }

    func matches(homeId: String, claimId: String, claimantId: String, action: String) -> Bool {
        guard ok, self.homeId == homeId, self.claimId == claimId,
              self.claimantId == claimantId, self.action == action else { return false }
        let expected = ["approve": "approved", "reject": "rejected", "flag": "pending_review", "request_more_info": "needs_more_info"]
        guard state == expected[action] else { return false }
        return action != "approve" || (occupancy?.homeId == homeId && occupancy?.userId == claimantId && occupancy?.id.isEmpty == false)
    }
}
