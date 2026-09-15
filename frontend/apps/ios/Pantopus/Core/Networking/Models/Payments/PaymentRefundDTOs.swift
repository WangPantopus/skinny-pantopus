import Foundation

enum PaymentRefundReason: String, Codable, CaseIterable {
    case requestedByCustomer = "requested_by_customer"
    case workNotCompleted = "work_not_completed"
    case duplicate, fraudulent, other

    var label: String {
        switch self {
        case .requestedByCustomer: "Requested by customer"
        case .workNotCompleted: "Work not completed"
        case .duplicate: "Duplicate payment"
        case .fraudulent: "Unauthorized payment"
        case .other: "Other"
        }
    }
}

struct PaymentRefundAttempt: Codable, Equatable {
    let requestId: String
    let requestedAmountCents: Int?
    let reason: PaymentRefundReason
    let description: String?

    var isValid: Bool {
        UUID(uuidString: requestId) != nil
            && (requestedAmountCents.map { $0 > 0 } ?? true)
            && (description?.count ?? 0) <= 500
    }
}

struct PaymentRefundRequestDTO: Decodable, Identifiable {
    let requestId: String
    let paymentId: String
    let operation: String
    let amountCents: Int
    let currency: String
    let status: String
    let canRetry: Bool
    let requestedAmountCents: Int?
    let reason: PaymentRefundReason
    let description: String?

    var id: String {
        requestId
    }

    var isPending: Bool {
        ["pending", "requires_action"].contains(status)
    }

    var attempt: PaymentRefundAttempt {
        PaymentRefundAttempt(
            requestId: requestId,
            requestedAmountCents: requestedAmountCents,
            reason: reason,
            description: description
        )
    }

    func isValid(paymentId: String, total: Int) -> Bool {
        attempt.isValid && self.paymentId == paymentId
            && ["refund", "release"].contains(operation)
            && ["pending", "requires_action", "succeeded", "failed", "canceled"].contains(status)
            && currency.lowercased() == "usd" && amountCents > 0 && amountCents <= total
            && (requestedAmountCents ?? 0) <= total
    }

    var message: String {
        let amount = Self.money(amountCents)
        if operation == "release" {
            if status == "succeeded" { return "\(amount) authorization hold released. No captured charge was refunded." }
            if isPending { return "\(amount) authorization hold release is pending." }
            return "The authorization hold release did not complete."
        }
        if status == "succeeded" { return "\(amount) refund completed. Your bank may take additional time to show it." }
        if status == "requires_action" { return "\(amount) refund needs additional action. Check status or contact support." }
        if isPending { return "\(amount) refund is pending." }
        return "\(amount) refund did not complete."
    }

    static func money(_ cents: Int) -> String {
        String(format: "$%.2f", Double(cents) / 100)
    }
}

public struct PaymentWalletSettlementDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let paymentId: String
    public let status: String
    public let amountCents: Int
    public let currency: String
    public let refundBasisCents: Int
    public let createdAt: String
}

struct RefundPaymentSummary: Decodable {
    let id: String
    let paymentStatus: String
    let amountTotal: Int
    let refundedAmount: Int?
    let currency: String
    let capturedAt: String?
    let payeeReleaseStatus: String?
    let walletSettlement: PaymentWalletSettlementDTO?

    enum CodingKeys: String, CodingKey {
        case id, currency
        case paymentStatus = "payment_status", amountTotal = "amount_total"
        case refundedAmount = "refunded_amount", capturedAt = "captured_at"
        case payeeReleaseStatus = "payee_release_status", walletSettlement = "wallet_settlement"
    }

    var remaining: Int {
        amountTotal - (refundedAmount ?? 0)
    }

    var isRelease: Bool {
        paymentStatus == "authorized" && capturedAt == nil
    }

    var mayRequest: Bool {
        ["authorized", "captured_hold", "transfer_scheduled", "refunded_partial"].contains(paymentStatus)
            && payeeReleaseStatus == "held" && remaining > 0
    }

    func isValid(paymentId: String, total: Int) -> Bool {
        guard id == paymentId, amountTotal == total, total >= 50, currency.lowercased() == "usd",
              (refundedAmount ?? 0) >= 0, (refundedAmount ?? 0) <= total,
              ["held", "wallet_credited", "no_earnings", "external_transfer", "unknown"]
              .contains(payeeReleaseStatus ?? "unknown")
        else { return false }
        guard let receipt = walletSettlement else {
            return payeeReleaseStatus != "no_earnings" || refundedAmount == total
        }
        let date = ISO8601DateFormatter()
        date.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let validDate = date.date(from: receipt.createdAt) != nil || ISO8601DateFormatter().date(from: receipt.createdAt) != nil
        return UUID(uuidString: receipt.id) != nil && receipt.paymentId == id && receipt.currency.lowercased() == "usd"
            && receipt.amountCents >= 0 && receipt.amountCents <= total && receipt.refundBasisCents >= 0
            && receipt.refundBasisCents <= (refundedAmount ?? 0) && validDate
            && ((payeeReleaseStatus == "wallet_credited" && receipt.status == "credited" && receipt.amountCents > 0)
                || (payeeReleaseStatus == "no_earnings" && receipt.status == "no_earnings" && receipt.amountCents == 0))
    }

    var releaseMessage: String? {
        switch payeeReleaseStatus {
        case "held": nil
        case "wallet_credited": "Earnings have been credited to the worker’s wallet. Contact support to request another refund."
        case "external_transfer": "Earnings have been sent to the worker. Contact support to request another refund."
        case "no_earnings": "No worker earnings remain after refunds."
        default: "Worker payment status needs verification. Check status before requesting a refund."
        }
    }
}

struct PaymentRefundHistoryDTO: Decodable {
    let requests: [PaymentRefundRequestDTO]
    let payment: RefundPaymentSummary
}

struct PaymentRefundResultDTO: Decodable {
    let refundRequest: PaymentRefundRequestDTO
    let payment: RefundPaymentSummary
}

struct PaymentRefundBody: Encodable {
    let requestId: String
    let amount: Int?
    let reason: PaymentRefundReason
    let description: String?
}
