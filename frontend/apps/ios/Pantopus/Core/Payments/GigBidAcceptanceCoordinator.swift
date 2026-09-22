import CryptoKit
import Foundation

/// The server retains the selected bid and payment operation. Restarting or
/// navigating back resumes that identity without persisting payment secrets.
@MainActor
final class GigBidAcceptanceCoordinator {
    enum Outcome: Equatable {
        case accepted
        case canceled
        case failed(String)
    }

    private static var active = Set<String>()
    private let api: APIClient
    private let checkout: CheckoutCoordinator
    private let identity: () -> String?
    private let initialIdentity: String?

    var isCurrentAccount: Bool {
        initialIdentity != nil && identity() == initialIdentity
    }

    init(api: APIClient, checkout: CheckoutCoordinator, identity: (() -> String?)? = nil) {
        self.api = api
        self.checkout = checkout
        let resolveIdentity = identity ?? {
            let auth = api.authProvider ?? AuthManager.shared
            guard case let .signedIn(user) = auth.state else { return nil }
            let session: String
            if let sessionId = auth.sessionId {
                session = sessionId
            } else if let token = auth.accessToken {
                // Older sessions have no server ID. A credential change then
                // conservatively interrupts the continuation; retry reads the
                // same server operation. No credential is saved in the scope.
                session = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
            } else {
                return nil
            }
            return "\(api.apiBaseURL.absoluteString)|\(user.id)|\(session)"
        }
        self.identity = resolveIdentity
        initialIdentity = resolveIdentity()
    }

    func accept(gigId: String, bidId: String) async -> Outcome {
        guard isCurrentAccount, let scope = identity() else { return .failed("Sign in to continue this payment.") }
        let key = "\(scope)|\(gigId)"
        guard Self.active.insert(key).inserted else { return .failed("A payment action is already in progress.") }
        defer { Self.active.remove(key) }
        do {
            let response: GigBidAcceptResponse = try await api.request(GigsEndpoints.acceptBid(gigId: gigId, bidId: bidId))
            try requireIdentity(scope)
            guard response.bid?.id == bidId else { throw APIError.invalidResponse }
            if response.bid?.status == "accepted" { return .accepted }
            guard response.bid?.status == "pending_payment",
                  let amount = response.amountCents, amount >= 50,
                  response.currency?.lowercased() == "usd", response.isSetupIntent != true
            else { throw APIError.invalidResponse }
            if response.authorizationReady == true {
                return await finalize(gigId: gigId, bidId: bidId, scope: scope)
            }
            guard response.sheetParams.clientSecret?.isEmpty == false else { throw APIError.invalidResponse }
            let outcome = await checkout.present(response.sheetParams)
            try requireIdentity(scope)
            switch outcome {
            case .paid:
                return await finalize(gigId: gigId, bidId: bidId, scope: scope)
            case .canceled:
                return await abort(gigId: gigId, bidId: bidId, scope: scope)
            case let .declined(message), let .failed(message):
                return .failed("\(message) Resume or cancel this payment to check its progress.")
            }
        } catch {
            if let recovered = await recoverAccepted(gigId: gigId, bidId: bidId, scope: scope) { return recovered }
            return .failed("Payment progress is unconfirmed. Resume this same bid to check it.")
        }
    }

    func cancel(gigId: String, bidId: String) async -> Outcome {
        guard isCurrentAccount, let scope = identity() else { return .failed("Sign in to check this payment.") }
        let key = "\(scope)|\(gigId)"
        guard Self.active.insert(key).inserted else { return .failed("A payment action is already in progress.") }
        defer { Self.active.remove(key) }
        return await abort(gigId: gigId, bidId: bidId, scope: scope)
    }

    private func finalize(gigId: String, bidId: String, scope: String) async -> Outcome {
        do {
            try requireIdentity(scope)
            let receipt: GigBidAcceptResponse = try await api.request(GigsEndpoints.finalizeAcceptBid(gigId: gigId, bidId: bidId))
            try requireIdentity(scope)
            guard receipt.bid?.id == bidId, receipt.bid?.status == "accepted" else { throw APIError.invalidResponse }
            return .accepted
        } catch {
            return .failed("Authorization may be complete. Resume this same bid to confirm acceptance.")
        }
    }

    /// A committed assignment can make another accept/cancel request fail.
    /// Read the exact owned bid, then require the same finalization receipt;
    /// a cached mail payload or a different accepted bid is never sufficient.
    private func recoverAccepted(gigId: String, bidId: String, scope: String) async -> Outcome? {
        do {
            try requireIdentity(scope)
            let response: GigBidsResponse = try await api.request(GigsEndpoints.bids(gigId: gigId))
            try requireIdentity(scope)
            guard response.bids.contains(where: { $0.id == bidId && $0.gigId == gigId && $0.status == "accepted" }) else { return nil }
            return await finalize(gigId: gigId, bidId: bidId, scope: scope)
        } catch {
            return nil
        }
    }

    private func abort(gigId: String, bidId: String, scope: String) async -> Outcome {
        do {
            try requireIdentity(scope)
            let receipt: GigBidAcceptResponse = try await api.request(GigsEndpoints.abortAcceptBid(gigId: gigId, bidId: bidId))
            try requireIdentity(scope)
            guard receipt.bid?.id == bidId, receipt.bid?.status == "pending" else { throw APIError.invalidResponse }
            return .canceled
        } catch {
            if let recovered = await recoverAccepted(gigId: gigId, bidId: bidId, scope: scope) { return recovered }
            return .failed("Cancellation is unconfirmed. Retry canceling this same payment.")
        }
    }

    private func requireIdentity(_ scope: String) throws {
        guard !Task.isCancelled, identity() == scope else { throw APIError.invalidResponse }
    }
}
