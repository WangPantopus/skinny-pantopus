import CryptoKit
import Foundation
import Observation

@Observable
@MainActor
final class GigStopViewModel: Identifiable {
    struct Identity: Equatable {
        let actor: String
        let session: String
        let origin: String
    }

    nonisolated let id = UUID()
    let action: GigStopAction
    private(set) var busy = false
    private(set) var error: String?
    private var preview: GigStopPreview?
    private var attempt: GigStopRequest?
    private var progress: GigStopProgress?
    private var retryAllowed = false
    private var retired = false
    private var serverSession: String?
    private let recoveryOnly: Bool
    private let gig: String
    private let actor: String
    private let api: APIClient
    private let store: any PendingGigStopStoring
    private let identity: () -> Identity?
    private let openingIdentity: Identity?
    private let scope: String
    private static var active = Set<String>()

    init(
        gig: String,
        actor: String,
        action: GigStopAction,
        api: APIClient,
        store: any PendingGigStopStoring = PendingGigStopStore(),
        recoveryOnly: Bool = false,
        identity: (() -> Identity?)? = nil
    ) {
        self.gig = gig
        self.actor = actor
        self.action = action
        self.api = api
        self.store = store
        self.recoveryOnly = recoveryOnly
        let resolve = identity ?? { Self.currentIdentity(api: api) }
        self.identity = resolve
        openingIdentity = resolve()
        scope = Self.storageScope(origin: openingIdentity?.origin ?? "", actor: actor, gig: gig)
    }

    static func currentIdentity(api: APIClient) -> Identity? {
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

    static func storageScope(origin: String, actor: String, gig: String) -> String {
        "\(origin)|\(actor)|\(gig)"
    }

    var isCurrent: Bool {
        !retired && openingIdentity != nil && openingIdentity?.actor == actor && identity() == openingIdentity
    }

    var completed: Bool {
        isCurrent && progress?.status == "completed"
    }

    var displayedAction: GigStopAction {
        isCurrent ? attempt?.action ?? action : action
    }

    var terms: GigStopTerms? {
        isCurrent ? attempt?.terms ?? preview?.terms : nil
    }

    var hasRequest: Bool {
        isCurrent && attempt != nil
    }

    var maySubmit: Bool {
        isCurrent && !recoveryOnly && !busy && serverSession != nil && attempt == nil && preview?.eligible == true
            && preview?.activeRequestId == nil && preview?.financialAction != .review
    }

    var mayRetry: Bool {
        isCurrent && !busy && serverSession != nil && retryAllowed && attempt?.actorId == actor && !completed
    }

    var message: String {
        guard isCurrent else { return "Your session changed. Reopen task actions to continue." }
        if let progress { return progress.message }
        if attempt != nil { return "The original request is not confirmed. Check its status before trying another action." }
        if preview?
            .eligible ==
            false { return "This action is unavailable under the current task or payment policy. Check again or contact support." }
        switch preview?.financialAction {
        case .release: return "This action releases the payment hold before updating the task."
        case .refund: return "This action refunds the remaining captured amount before updating the task."
        case .some(.none): return "Review the current task details before continuing."
        default: return "Check the current task and payment details before continuing."
        }
    }

    func retire() {
        retired = true
        preview = nil
        progress = nil
        attempt = nil
        serverSession = nil
        retryAllowed = false
    }

    func checkStatus() async {
        guard begin() else { return }
        defer { finish() }
        preview = nil
        retryAllowed = false
        do {
            let saved = try attempt ?? storedRequest()
            if let saved {
                attempt = saved
                do {
                    let result: GigStopProgress = try await api.request(GigStopEndpoints.status(gig: gig, request: saved.requestId))
                    try accept(result, request: saved.requestId, expected: saved)
                } catch APIError.notFound {
                    let next = try await readPreview(action: saved.action)
                    retryAllowed = saved.actorId == actor && (next.activeRequestId != nil
                        || (next.eligible && next.terms == saved.terms && next.financialAction == saved.financialAction))
                    error = "The original request is not confirmed. Check again or explicitly retry the same request when available."
                }
                return
            }
            guard !recoveryOnly else {
                error = "The saved request is unavailable. Reopen the task's current actions to continue."
                return
            }
            let next = try await readPreview(action: action)
            if let activeId = next.activeRequestId {
                let result: GigStopProgress = try await api.request(GigStopEndpoints.status(gig: gig, request: activeId))
                try accept(result, request: activeId)
            }
        } catch {
            retireIfDenied(error)
            fail("Could not verify task action details. Check again before continuing.")
        }
    }

    func submit(reason: GigStopReason) async {
        guard maySubmit, let preview else { return }
        let request = GigStopRequest(
            requestId: UUID().uuidString.lowercased(),
            gigId: gig,
            actorId: actor,
            action: preview.action,
            terms: preview.terms,
            reason: reason,
            rollbackMode: nil,
            financialAction: preview.financialAction
        )
        await send(request)
    }

    func retry() async {
        guard mayRetry, let attempt else { return }
        await send(attempt)
    }

    private func send(_ request: GigStopRequest) async {
        guard let serverSession, begin() else { return }
        defer { finish() }
        retryAllowed = false
        do {
            let saved = try storedRequest()
            guard saved == nil || saved == request else { throw APIError.invalidResponse }
            try store.save(request, scope: scope)
            attempt = request
            try requireCurrent()
        } catch {
            fail("Could not preserve this request for recovery. No new request was sent. Reopen task actions before continuing.")
            return
        }
        do {
            let result: GigStopProgress = try await api.request(
                GigStopEndpoints.submit(gig: gig, command: GigStopCommand(request: request, session: serverSession))
            )
            try accept(result, request: request.requestId, expected: request)
        } catch {
            retireIfDenied(error)
            guard isCurrent else { return }
            do {
                if try await recoverConflict(error, original: request) { return }
            } catch {
                // Keep the original request until another receipt is verified.
                retireIfDenied(error)
            }
            fail("The result is not confirmed. Check status to recover this request before trying another action.")
        }
    }

    private func readPreview(action: GigStopAction) async throws -> GigStopPreview {
        try requireCurrent()
        let next: GigStopPreview = try await api.request(GigStopEndpoints.preview(gig: gig, action: action))
        try requireCurrent()
        try verifySession(actor: next.actorId, session: next.sessionScope)
        guard next.isValid(gig: gig, action: action) else { throw APIError.invalidResponse }
        preview = next
        return next
    }

    private func accept(_ result: GigStopProgress, request: String, expected: GigStopRequest? = nil) throws {
        try requireCurrent()
        try verifySession(actor: result.actorId, session: result.sessionScope)
        guard result.isValid(gig: gig, actor: actor, requestId: request, expected: expected) else { throw APIError.invalidResponse }
        if result.status == "completed" {
            try store.clear(scope: scope, matching: result.request)
        } else if result.request.actorId == actor {
            let saved = try storedRequest()
            guard saved == nil || saved == result.request else { throw APIError.invalidResponse }
            try store.save(result.request, scope: scope)
        }
        attempt = result.request
        progress = result
        retryAllowed = result.status != "completed" && result.canRetry && result.request.actorId == actor
    }

    private struct Conflict: Decodable {
        let code: String
        let activeRequestId: String
    }

    private func recoverConflict(_ error: any Error, original: GigStopRequest) async throws -> Bool {
        guard case let APIError.clientError(status, message) = error, status == 409,
              let data = message?.data(using: .utf8), let conflict = try? JSONDecoder().decode(Conflict.self, from: data),
              conflict.code == "STOP_ACTIVE", UUID(uuidString: conflict.activeRequestId) != nil,
              conflict.activeRequestId != original.requestId else { return false }
        try requireCurrent()
        let result: GigStopProgress = try await api.request(GigStopEndpoints.status(gig: gig, request: conflict.activeRequestId))
        try requireCurrent()
        try verifySession(actor: result.actorId, session: result.sessionScope)
        guard result.isValid(gig: gig, actor: actor, requestId: conflict.activeRequestId, expected: nil)
        else { throw APIError.invalidResponse }
        // Replace only after the protected conflict and its exact validated GET.
        // For the same actor, one atomic file write preserves recovery on failure.
        if result.request.actorId == actor && result.status != "completed" {
            try store.save(result.request, scope: scope)
        } else { try store.clear(scope: scope, matching: original) }
        try accept(result, request: conflict.activeRequestId)
        return true
    }

    private func storedRequest() throws -> GigStopRequest? {
        let saved = try store.load(scope: scope)
        guard saved == nil || (saved?.actorId == actor && saved?.isValid(gig: gig) == true) else { throw APIError.invalidResponse }
        return saved
    }

    private func retireIfDenied(_ error: any Error) {
        guard let error = error as? APIError else { return }
        switch error {
        case .unauthorized, .forbidden, .notFound: retire()
        default: break
        }
    }

    private func verifySession(actor: String, session: String) throws {
        guard actor == self.actor, session.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              serverSession == nil || serverSession == session else {
            retire()
            throw APIError.invalidResponse
        }
        serverSession = session
    }

    private func begin() -> Bool {
        guard isCurrent else { retire()
            return false
        }
        guard !Task.isCancelled, !busy, UUID(uuidString: gig) != nil, UUID(uuidString: actor) != nil,
              Self.active.insert(scope).inserted else { return false }
        busy = true
        error = nil
        return true
    }

    private func finish() {
        busy = false
        Self.active.remove(scope)
    }

    private func requireCurrent() throws {
        guard isCurrent, !Task.isCancelled else { retire()
            throw APIError.invalidResponse
        }
    }

    private func fail(_ message: String) {
        error = isCurrent ? message : "Your session changed. Reopen task actions to continue."
    }
}
