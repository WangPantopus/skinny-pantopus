import CryptoKit
import Foundation
import Observation

@Observable
@MainActor
final class GigRefundViewModel: Identifiable {
    struct Identity: Equatable {
        let account: String
        let session: String
        let origin: String
    }

    private var summary: RefundPaymentSummary?
    private var history: [PaymentRefundRequestDTO] = []
    private var attempt: PaymentRefundAttempt?
    private var ready = false
    private(set) var busy = false
    private(set) var error: String?
    private var invalidated = false
    private static var active = Set<String>()
    private let api: APIClient
    private let paymentId: String
    private let total: Int
    private let store: any PendingRefundStoring
    private let identity: () -> Identity?
    private let openingIdentity: Identity?
    private let scope: String

    nonisolated let id: String

    init(
        paymentId: String,
        total: Int,
        api: APIClient,
        store: any PendingRefundStoring = PendingRefundStore(),
        identity: (() -> Identity?)? = nil
    ) {
        id = paymentId
        self.paymentId = paymentId
        self.total = total
        self.api = api
        self.store = store
        let resolve = identity ?? {
            let auth = api.authProvider ?? AuthManager.shared
            guard case let .signedIn(user) = auth.state else { return nil }
            let session: String
            if let sessionId = auth.sessionId {
                session = sessionId
            } else if let token = auth.accessToken {
                session = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
            } else { return nil }
            return Identity(account: user.id, session: session, origin: api.apiBaseURL.absoluteString)
        }
        self.identity = resolve
        openingIdentity = resolve()
        scope = "\(openingIdentity?.origin ?? "")|\(openingIdentity?.account ?? "")|\(paymentId)"
    }

    var isCurrent: Bool {
        !invalidated && openingIdentity != nil && identity() == openingIdentity
    }

    var requests: [PaymentRefundRequestDTO] {
        isCurrent ? history : []
    }

    var remaining: Int {
        isCurrent ? summary?.remaining ?? 0 : 0
    }

    var isRelease: Bool {
        isCurrent && summary?.isRelease == true
    }

    var mayRequest: Bool {
        isCurrent && ready && !busy && attempt == nil && summary?.mayRequest == true
    }

    var releaseMessage: String? {
        isCurrent ? summary?.releaseMessage : nil
    }

    var hasUnconfirmedRequest: Bool {
        isCurrent && attempt != nil && !history.contains { $0.requestId == attempt?.requestId }
    }

    var mayRetry: Bool {
        guard isCurrent, ready, !busy, let attempt else { return false }
        guard let receipt = history.first(where: { $0.requestId == attempt.requestId }) else { return true }
        return receipt.isPending && receipt.canRetry
    }

    func checkStatus() async {
        guard begin() else { return }
        defer { finish() }
        ready = false
        error = nil
        do {
            let saved = try attempt ?? store.load(scope: scope)
            attempt = saved
            let result: PaymentRefundHistoryDTO = try await api.request(PaymentsEndpoints.refunds(paymentId: paymentId))
            try requireCurrent()
            try validate(result.payment, requests: result.requests)
            let pending = result.requests.filter(\.isPending)
            guard pending.count <= 1 else { throw APIError.invalidResponse }
            let exact = saved.flatMap { stored in result.requests.first { $0.requestId == stored.requestId } }
            if let saved, let exact, saved != exact.attempt { throw APIError.invalidResponse }
            if let exact, !exact.isPending {
                try store.clear(scope: scope)
                attempt = pending.first?.attempt
            } else {
                // An empty response cannot discard a locally sent operation
                // whose outcome is still unknown.
                attempt = exact?.attempt ?? saved ?? pending.first?.attempt
            }
            history = result.requests
            summary = result.payment
            ready = true
        } catch {
            self.error = "Could not confirm refund status. Check again before starting another request."
        }
    }

    /// Called only after the view's explicit confirmation. Blank means all
    /// remaining cents; a retry always keeps the original nullable amount.
    func submit(amountText: String, reason: PaymentRefundReason) async {
        guard mayRequest else { return }
        let text = amountText.trimmingCharacters(in: .whitespacesAndNewlines)
        let amount = isRelease || text.isEmpty ? nil : Self.cents(text)
        if !isRelease && !text.isEmpty && !(amount.map { $0 >= 50 && $0 <= remaining } ?? false) {
            error = "Enter an amount from $0.50 to \(PaymentRefundRequestDTO.money(remaining))."
            return
        }
        await send(PaymentRefundAttempt(
            requestId: UUID().uuidString.lowercased(),
            requestedAmountCents: amount,
            reason: reason,
            description: nil
        ))
    }

    func retry() async {
        guard mayRetry, let attempt else { return }
        await send(attempt)
    }

    private func send(_ next: PaymentRefundAttempt) async {
        guard begin() else { return }
        defer { finish() }
        error = nil
        do {
            try store.save(next, scope: scope)
        } catch {
            self.error = "Could not save recovery details. No new request was sent. Try again."
            return
        }
        attempt = next
        do {
            let result: PaymentRefundResultDTO = try await api.request(PaymentsEndpoints.refund(paymentId: paymentId, attempt: next))
            try requireCurrent()
            try validate(result.payment, requests: [result.refundRequest])
            let receipt = result.refundRequest
            guard receipt.attempt == next else { throw APIError.invalidResponse }
            history.removeAll { $0.requestId == receipt.requestId }
            history.insert(receipt, at: 0)
            summary = result.payment
            if receipt.isPending {
                attempt = receipt.attempt
            } else {
                try store.clear(scope: scope)
                attempt = nil
            }
            ready = true
        } catch {
            if isCurrent { recoverConflict(error, sent: next) }
            ready = false
            self.error = "The result is not confirmed. Check status to recover this request."
        }
    }

    private func recoverConflict(_ error: any Error, sent: PaymentRefundAttempt) {
        guard case let APIError.clientError(status, message) = error, let data = message?.data(using: .utf8),
              let result = try? JSONDecoder().decode(Conflict.self, from: data),
              result.refundRequest.isValid(paymentId: paymentId, total: total) else { return }
        let receipt = result.refundRequest
        if receipt.attempt == sent {
            attempt = receipt.attempt
        } else if status == 409, result.code == "REFUND_ACTIVE", receipt.requestId != sent.requestId {
            do {
                try store.clear(scope: scope)
                attempt = receipt.attempt
            } catch {
                // Keep the original identity until saved recovery can update.
                return
            }
        }
    }

    private struct Conflict: Decodable {
        let code: String
        let refundRequest: PaymentRefundRequestDTO
    }

    private func validate(_ payment: RefundPaymentSummary, requests: [PaymentRefundRequestDTO]) throws {
        guard payment.isValid(paymentId: paymentId, total: total),
              Set(requests.map(\.requestId)).count == requests.count,
              requests.allSatisfy({ $0.isValid(paymentId: paymentId, total: total) }) else { throw APIError.invalidResponse }
    }

    private func begin() -> Bool {
        guard isCurrent, !busy, UUID(uuidString: paymentId) != nil, total >= 50,
              Self.active.insert(scope).inserted else { return false }
        busy = true
        return true
    }

    private func finish() {
        busy = false
        Self.active.remove(scope)
    }

    private func requireCurrent() throws {
        guard isCurrent, !Task.isCancelled else {
            invalidated = true
            throw APIError.invalidResponse
        }
    }

    static func cents(_ value: String) -> Int? {
        guard value.range(of: "^[0-9]+(\\.[0-9]{1,2})?$", options: .regularExpression) != nil else { return nil }
        let parts = value.split(separator: ".", omittingEmptySubsequences: false)
        guard let dollars = Int(parts[0]), dollars <= (Int.max - 99) / 100 else { return nil }
        let fraction = parts.count == 2 ? String(parts[1]).padding(toLength: 2, withPad: "0", startingAt: 0) : "00"
        return dollars * 100 + (Int(fraction) ?? 0)
    }
}
