import CryptoKit
import Foundation
import Observation

@Observable
@MainActor
final class GigAssignedAuthorizationViewModel: Identifiable {
    struct Identity: Equatable {
        let actor: String
        let session: String
        let origin: String
    }

    nonisolated let id: String
    let amount: Int
    private(set) var busy = false
    private(set) var error: String?
    private var progress: GigAssignedAuthorizationProgress?
    private var serverSession: String?
    private var retired = false
    private let api: APIClient
    private let checkout: CheckoutCoordinator
    private let terms: GigAssignedAuthorizationTerms
    private let actor: String
    private let identity: () -> Identity?
    private let openingIdentity: Identity?
    private static var active = Set<String>()

    init(
        gigId: String,
        actor: String,
        terms: GigAssignedAuthorizationTerms,
        api: APIClient,
        checkout: CheckoutCoordinator,
        identity: (() -> Identity?)? = nil
    ) {
        id = gigId
        self.actor = actor
        self.terms = terms
        amount = terms.amount
        self.api = api
        self.checkout = checkout
        let resolve = identity ?? {
            let auth = api.authProvider ?? AuthManager.shared
            guard case let .signedIn(user) = auth.state else { return nil }
            let session: String
            if let sessionId = auth.sessionId {
                session = sessionId
            } else if let token = auth.accessToken {
                session = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
            } else { return nil }
            return Identity(actor: user.id, session: session, origin: api.apiBaseURL.absoluteString)
        }
        self.identity = resolve
        openingIdentity = resolve()
    }

    var isCurrent: Bool {
        !retired && openingIdentity?.actor == actor && openingIdentity != nil && identity() == openingIdentity
    }

    var authorized: Bool {
        isCurrent && progress?.authorizationReady == true
    }

    func retire() {
        retired = true
        progress = nil
        serverSession = nil
    }

    var mayContinue: Bool {
        isCurrent && !busy && serverSession != nil && progress?.canRetry == true && !authorized
    }

    var message: String {
        guard isCurrent else { return "Your session changed. Reopen payment details to continue." }
        if authorized { return "The payment hold is authorized. The worker can start." }
        if progress?.cancellationPending == true { return "The authorization is being canceled. Check its status before continuing." }
        if let available = progress?.authorizationAvailableAt, let date = GigAssignedAuthorizationProgress.date(available) {
            return "Authorization opens \(date.formatted(date: .abbreviated, time: .shortened)). No new hold will be created before then."
        }
        switch progress?.recoveryState {
        case .needsReview:
            return progress?.canRetry == true
                ? "The previous authorization ended. Continue to authorize the same task amount."
                : "This payment needs review before another authorization can be started."
        case .pending: return "Authorization is pending. Check its status before continuing."
        default: return "Complete the card authorization before the worker starts."
        }
    }

    func checkStatus() async {
        guard begin() else { return }
        defer { finish() }
        do {
            try await readStatus()
        } catch { fail("Payment status is unconfirmed. Check again before continuing.") }
    }

    func continueAuthorization() async {
        guard mayContinue, let serverSession, begin() else { return }
        defer { finish() }
        do {
            let result: GigAssignedAuthorizationProgress = try await api.request(
                GigAssignedAuthorizationEndpoints.resume(gigId: id, body: terms.body(actor: actor, session: serverSession))
            )
            try accept(result)
            guard result.recoveryState == .actionRequired else { return }
            // Recheck the actual server session/operation immediately before SDK presentation.
            try await readStatus(matching: result)
            guard let selected = progress, selected.recoveryState == .actionRequired else { return }
            try requireCurrent()
            let outcome = await checkout.present(PaymentIntentSheetParams(
                clientSecret: selected.clientSecret, paymentIntentId: selected.paymentIntentId, isSetupIntent: false
            ))
            try requireCurrent()
            switch outcome {
            case .paid: try await readStatus(matching: selected)
            case .canceled: error = "Authorization has not been confirmed. Check its status before continuing."
            case .declined, .failed: error = "Authorization has not been confirmed. Retry the same payment or check its status."
            }
        } catch { fail("Authorization is unconfirmed. Check its status before retrying.") }
    }

    private func readStatus(matching previous: GigAssignedAuthorizationProgress? = nil) async throws {
        try requireCurrent()
        let result: GigAssignedAuthorizationProgress = try await api.request(GigAssignedAuthorizationEndpoints.status(gigId: id))
        try requireCurrent()
        if let previous {
            guard result.authorizationAttemptId == previous.authorizationAttemptId,
                  result.paymentIntentId == previous.paymentIntentId else { throw APIError.invalidResponse }
        }
        try accept(result)
    }

    private func accept(_ result: GigAssignedAuthorizationProgress) throws {
        try requireCurrent()
        guard result.matches(gig: id, actor: actor, terms: terms, session: serverSession) else { throw APIError.invalidResponse }
        serverSession = result.sessionScope
        progress = result
    }

    private var activeKey: String {
        "\(openingIdentity?.origin ?? "")|\(actor)|\(id)"
    }

    private func begin() -> Bool {
        guard isCurrent, !busy, Self.active.insert(activeKey).inserted else { return false }
        busy = true
        error = nil
        return true
    }

    private func finish() {
        busy = false
        Self.active.remove(activeKey)
    }

    private func requireCurrent() throws {
        guard isCurrent, !Task.isCancelled else {
            retired = true
            progress = nil
            throw APIError.invalidResponse
        }
    }

    private func fail(_ message: String) {
        error = isCurrent ? message : "Your session changed. Reopen payment details to continue."
    }
}
