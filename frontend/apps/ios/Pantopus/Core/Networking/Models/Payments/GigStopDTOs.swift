import Foundation

enum GigStopAction: String, Codable {
    case cancel, close
    case reopenBidding = "reopen_bidding"
    case workerRelease = "worker_release"

    var label: String {
        switch self {
        case .cancel: "Cancel task"
        case .close: "Close task"
        case .reopenBidding: "Reopen bidding"
        case .workerRelease: "Leave assignment"
        }
    }

    var resultingStatus: String {
        self == .reopenBidding || self == .workerRelease ? "open" : "cancelled"
    }
}

enum GigStopReason: String, Codable, CaseIterable {
    case changedPlans = "changed_plans"
    case foundSomeoneElse = "found_someone_else"
    case tooExpensive = "too_expensive"
    case emergency, other
    case scheduleConflict = "schedule_conflict"
    case unableToComplete = "unable_to_complete"
    case safetyConcern = "safety_concern"

    var label: String {
        switch self {
        case .changedPlans: "Plans changed"
        case .foundSomeoneElse: "Found someone else"
        case .tooExpensive: "Too expensive"
        case .emergency: "Emergency"
        case .other: "Other"
        case .scheduleConflict: "Schedule conflict"
        case .unableToComplete: "Unable to complete"
        case .safetyConcern: "Safety concern"
        }
    }
}

enum GigStopFinancialAction: String, Codable {
    case none, release, refund, review
    var completedStatus: String {
        switch self {
        case .none: "none"
        case .release: "released"
        case .refund: "refunded"
        case .review: "needs_review"
        }
    }
}

struct GigStopTerms: Codable, Equatable {
    let gigId: String
    let ownerId: String
    let workerId: String?
    let paymentId: String?
    let amountCents: Int
    let currency: String
    let gigStatus: String
    let acceptedAt: String?
    let acceptedBidId: String?
    let policy: String
    let policyFeeCents: Int

    func isValid(gig: String) -> Bool {
        gigId == gig && UUID(uuidString: gig) != nil && UUID(uuidString: ownerId) != nil
            && [workerId, paymentId, acceptedBidId].allSatisfy { $0 == nil || UUID(uuidString: $0 ?? "") != nil }
            && amountCents >= 0 && policyFeeCents >= 0 && currency == "usd"
            && !gigStatus.isEmpty && !policy.isEmpty
            && (acceptedAt == nil || GigAssignedAuthorizationProgress.date(acceptedAt ?? "") != nil)
    }

    enum CodingKeys: String, CodingKey {
        case gigId, ownerId, workerId, paymentId, amountCents, currency, gigStatus, acceptedAt, acceptedBidId, policy, policyFeeCents
    }

    /// Null fields are part of the server's exact displayed-term snapshot.
    func encode(to encoder: any Encoder) throws {
        var fields = encoder.container(keyedBy: CodingKeys.self)
        try fields.encode(gigId, forKey: .gigId)
        try fields.encode(ownerId, forKey: .ownerId)
        try fields.encode(workerId, forKey: .workerId)
        try fields.encode(paymentId, forKey: .paymentId)
        try fields.encode(amountCents, forKey: .amountCents)
        try fields.encode(currency, forKey: .currency)
        try fields.encode(gigStatus, forKey: .gigStatus)
        try fields.encode(acceptedAt, forKey: .acceptedAt)
        try fields.encode(acceptedBidId, forKey: .acceptedBidId)
        try fields.encode(policy, forKey: .policy)
        try fields.encode(policyFeeCents, forKey: .policyFeeCents)
    }
}

/// Only nonsecret original command data is persisted. Session proof stays in memory.
struct GigStopRequest: Codable, Equatable {
    let requestId: String
    let gigId: String
    let actorId: String
    let action: GigStopAction
    let terms: GigStopTerms
    let reason: GigStopReason?
    let rollbackMode: String?
    let financialAction: GigStopFinancialAction

    func isValid(gig: String) -> Bool {
        UUID(uuidString: requestId) != nil && UUID(uuidString: actorId) != nil && gigId == gig
            && terms.isValid(gig: gig) && financialAction != .review
            && (rollbackMode == nil || (rollbackMode == "payment_setup_aborted" && action == .reopenBidding))
    }
}

struct GigStopPreview: Decodable {
    let actorId: String
    let sessionScope: String
    let action: GigStopAction
    let terms: GigStopTerms
    let eligible: Bool
    let unavailableReason: String?
    let financialAction: GigStopFinancialAction
    let activeRequestId: String?

    func isValid(gig: String, action: GigStopAction) -> Bool {
        self.action == action && terms.isValid(gig: gig)
            && (activeRequestId == nil || UUID(uuidString: activeRequestId ?? "") != nil)
            && (!eligible || (financialAction != .review && terms.policyFeeCents == 0))
    }
}

struct GigStopReceipt: Decodable {
    let requestId: String
    let gigId: String
    let paymentId: String?
    let ownerId: String
    let workerId: String?
    let amountCents: Int
    let currency: String
    let action: GigStopAction
    let gigStatus: String
    let financialStatus: String

    func matches(_ request: GigStopRequest) -> Bool {
        requestId == request.requestId && gigId == request.gigId && paymentId == request.terms.paymentId
            && ownerId == request.terms.ownerId && workerId == request.terms.workerId
            && amountCents == request.terms.amountCents && currency == "usd" && action == request.action
            && gigStatus == request.action.resultingStatus && financialStatus == request.financialAction.completedStatus
    }
}

struct GigStopProgress: Decodable {
    let actorId: String
    let sessionScope: String
    let requestId: String
    let action: GigStopAction
    let status: String
    let financialStatus: String
    let canRetry: Bool
    let request: GigStopRequest
    let receipt: GigStopReceipt?

    func isValid(gig: String, actor: String, requestId: String, expected: GigStopRequest?) -> Bool {
        guard request.isValid(gig: gig), self.requestId == requestId, request.requestId == requestId,
              action == request.action, expected == nil || expected == request,
              ["pending", "needs_review", "completed"].contains(status),
              ["none", "release_pending", "released", "refund_pending", "refunded", "needs_review"].contains(financialStatus),
              !canRetry || request.actorId == actor else { return false }
        if status != "completed" { return receipt == nil }
        return !canRetry && receipt?.matches(request) == true && financialStatus == request.financialAction.completedStatus
    }

    var message: String {
        if status == "needs_review" { return "This task action needs review. Check its status or contact support before continuing." }
        if status != "completed" {
            switch financialStatus {
            case "refund_pending": return "The refund is pending. The task action is not complete yet."
            case "release_pending": return "The payment hold release is pending. The task action is not complete yet."
            default: return "The task action is pending. Check its status before continuing."
            }
        }
        let result = request.action.resultingStatus == "open" ? "The task is open for bidding." : "The task is cancelled."
        switch financialStatus {
        case "released": return result + " The payment hold release is confirmed."
        case "refunded": return result + " The refund is confirmed; your bank may take additional time to show it."
        default: return result
        }
    }
}

struct GigStopCommand: Encodable {
    let requestId: String
    let action: GigStopAction
    let expectedActorId: String
    let expectedSessionScope: String
    let expectedTerms: GigStopTerms
    let reason: GigStopReason?
    let rollbackMode: String?

    init(request: GigStopRequest, session: String) {
        requestId = request.requestId
        action = request.action
        expectedActorId = request.actorId
        expectedSessionScope = session
        expectedTerms = request.terms
        reason = request.reason
        rollbackMode = request.rollbackMode
    }
}
