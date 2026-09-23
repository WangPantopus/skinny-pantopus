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
    /// `fee`: the owner's late cancel charges only the policy fee from the hold.
    case none, release, refund, review, fee
    var completedStatus: String {
        switch self {
        case .none: "none"
        case .release: "released"
        case .refund: "refunded"
        case .review: "needs_review"
        case .fee: "fee_charged"
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
    let reasonNoteHash: String?

    init(
        requestId: String,
        gigId: String,
        actorId: String,
        action: GigStopAction,
        terms: GigStopTerms,
        reason: GigStopReason?,
        rollbackMode: String?,
        financialAction: GigStopFinancialAction,
        reasonNoteHash: String? = nil
    ) {
        self.requestId = requestId
        self.gigId = gigId
        self.actorId = actorId
        self.action = action
        self.terms = terms
        self.reason = reason
        self.rollbackMode = rollbackMode
        self.financialAction = financialAction
        self.reasonNoteHash = reasonNoteHash
    }

    func isValid(gig: String) -> Bool {
        UUID(uuidString: requestId) != nil && UUID(uuidString: actorId) != nil && gigId == gig
            && terms.isValid(gig: gig) && financialAction != .review
            &&
            (reasonNoteHash == nil ||
                (reason == .other && reasonNoteHash?.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil))
            && (rollbackMode == nil || (rollbackMode == "payment_setup_aborted" && action == .reopenBidding))
            && (financialAction != .fee || (action == .cancel && terms.policyFeeCents > 0))
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
            && (!eligible || (financialAction != .review && (financialAction == .fee) == (terms.policyFeeCents > 0)))
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
    /// Fee requests only: the charged fee and the released rest of the hold.
    var feeStatus: String?
    var feeCents: Int?
    var releasedCents: Int?

    func matches(_ request: GigStopRequest) -> Bool {
        requestId == request.requestId && gigId == request.gigId && paymentId == request.terms.paymentId
            && ownerId == request.terms.ownerId && workerId == request.terms.workerId
            && amountCents == request.terms.amountCents && currency == "usd" && action == request.action
            && gigStatus == request.action.resultingStatus && financialStatus == Self.completedStatus(self, request)
    }

    /// A fee request completes with the charged fee, or released with nothing
    /// charged when the hold was no longer capturable.
    static func completedStatus(_ receipt: GigStopReceipt, _ request: GigStopRequest) -> String {
        guard request.financialAction == .fee else { return request.financialAction.completedStatus }
        let fee = request.terms.policyFeeCents
        if receipt.financialStatus == "fee_charged", receipt.feeStatus == "charged", receipt.feeCents == fee,
           receipt.releasedCents == request.terms.amountCents - fee { return "fee_charged" }
        if receipt.financialStatus == "released", receipt.feeStatus == "not_charged", receipt.feeCents == 0 { return "released" }
        return "needs_review"
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
              ["none", "release_pending", "released", "refund_pending", "refunded", "fee_pending", "fee_charged", "needs_review"]
              .contains(financialStatus),
              !canRetry || request.actorId == actor else { return false }
        if status != "completed" { return receipt == nil }
        guard let receipt else { return false }
        return !canRetry && receipt.matches(request) && financialStatus == GigStopReceipt.completedStatus(receipt, request)
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
        case "fee_charged":
            guard let fee = receipt?.feeCents, let released = receipt?.releasedCents else { return result }
            return result + String(format: " Cancellation fee $%.2f charged · $%.2f released.", Double(fee) / 100, Double(released) / 100)
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
    let reasonNoteHash: String?

    init(request: GigStopRequest, session: String) {
        requestId = request.requestId
        action = request.action
        expectedActorId = request.actorId
        expectedSessionScope = session
        expectedTerms = request.terms
        reason = request.reason
        rollbackMode = request.rollbackMode
        reasonNoteHash = request.reasonNoteHash
    }
}
