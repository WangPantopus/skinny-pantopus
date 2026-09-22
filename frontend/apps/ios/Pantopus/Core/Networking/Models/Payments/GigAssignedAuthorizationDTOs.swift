import Foundation

struct GigAssignedAuthorizationTerms: Hashable {
    let paymentId: String
    let payerId: String
    let payeeId: String
    let amount: Int

    init?(payment: GigPaymentDTO, gigId: String, payeeId: String) {
        guard let paymentId = payment.id, UUID(uuidString: paymentId) != nil,
              let payerId = payment.payerId, UUID(uuidString: payerId) != nil,
              UUID(uuidString: payeeId) != nil, payment.payeeId == payeeId,
              payment.gigId == gigId, payment.currency?.lowercased() == "usd",
              let total = payment.amountTotal, let amount = Int(exactly: total), amount >= 50
        else { return nil }
        self.paymentId = paymentId
        self.payerId = payerId
        self.payeeId = payeeId
        self.amount = amount
    }

    func body(actor: String, session: String) -> GigAssignedAuthorizationBody {
        GigAssignedAuthorizationBody(
            expectedActorId: actor,
            expectedSessionScope: session,
            expectedPaymentId: paymentId,
            expectedPayerId: payerId,
            expectedPayeeId: payeeId,
            expectedAmountCents: amount,
            currency: "usd"
        )
    }
}

struct GigAssignedAuthorizationBody: Encodable {
    let expectedActorId: String
    let expectedSessionScope: String
    let expectedPaymentId: String
    let expectedPayerId: String
    let expectedPayeeId: String
    let expectedAmountCents: Int
    let currency: String
}

struct GigAssignedAuthorizationProgress: Decodable, Hashable {
    enum RecoveryState: String, Decodable { case ready, actionRequired = "action_required", pending, needsReview = "needs_review" }
    let gigId: String
    let actorId: String
    let sessionScope: String
    let paymentId: String
    let payerId: String
    let payeeId: String
    let authorizationAttemptId: String
    let paymentIntentId: String?
    let amountCents: Int
    let currency: String
    let paymentStatus: String
    let providerStatus: String?
    let authorizationReady: Bool
    let alreadyAuthorized: Bool
    let cancellationPending: Bool
    let authorizationAvailableAt: String?
    let recoveryState: RecoveryState
    let canRetry: Bool
    let clientSecret: String?

    func matches(gig: String, actor: String, terms: GigAssignedAuthorizationTerms, session: String?) -> Bool {
        guard gigId == gig, actorId == actor, paymentId == terms.paymentId,
              payerId == terms.payerId, payeeId == terms.payeeId, amountCents == terms.amount, currency == "usd",
              UUID(uuidString: authorizationAttemptId) != nil,
              sessionScope.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              session == nil || session == sessionScope, authorizationReady == alreadyAuthorized,
              authorizationReady == (recoveryState == .ready)
        else { return false }
        if let paymentIntentId, paymentIntentId.range(of: "^pi_[a-zA-Z0-9]+$", options: .regularExpression) == nil { return false }
        if authorizationReady,
           providerStatus != "requires_capture" || paymentStatus != "authorized" || paymentIntentId == nil { return false }
        if cancellationPending || authorizationAvailableAt != nil {
            guard recoveryState == .pending, !canRetry, clientSecret == nil else { return false }
        }
        if let authorizationAvailableAt {
            guard Self.date(authorizationAvailableAt) != nil, paymentIntentId == nil else { return false }
        }
        if recoveryState == .actionRequired {
            guard canRetry, let paymentIntentId, let clientSecret,
                  ["requires_action", "requires_confirmation", "requires_payment_method"].contains(providerStatus ?? ""),
                  clientSecret.hasPrefix("\(paymentIntentId)_secret_") else { return false }
        } else if clientSecret != nil { return false }
        return true
    }

    static func date(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}
