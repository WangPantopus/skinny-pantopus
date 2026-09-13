import Foundation
import Observation

@Observable
@MainActor
final class HomeInvitationDecisionViewModel {
    let token: String
    let accountLabel: String
    private let api: APIClient
    private let scope: HomeCreationScope
    private let session: HomeClaimSessionScope
    private let store: any PendingHomeInvitationDecisionStoring
    private var serverSession: String?
    private var saved: PendingHomeInvitationDecision?
    private var observed: HomeInvitationDecisionOutcome?
    private var attempted = false
    private var visible = false
    private(set) var generation = 0
    private(set) var isWorking = false
    private(set) var opened = false
    private(set) var error: String?
    private(set) var context: HomeInvitationDecisionContext?
    private(set) var progress: PersonalHomeResidencyProgress?

    init(token: String, api: APIClient = .shared, store: any PendingHomeInvitationDecisionStoring = PendingHomeInvitationDecisionStore()) {
        self.token = token
        self.api = api
        self.store = store
        scope = Self.scope(api: api)
        session = HomeClaimSessionScope(api: api)
        let auth = api.authProvider ?? AuthManager.shared
        if case let .signedIn(user) = auth.state {
            accountLabel = user.displayName ?? user.username ?? user.email
        } else {
            accountLabel = "Sign in to review this invitation"
        }
    }

    static func scope(api: APIClient) -> HomeCreationScope {
        let auth = api.authProvider ?? AuthManager.shared
        let actor: String = if case let .signedIn(user) = auth.state { user.id.lowercased() } else { "" }
        return HomeCreationScope(origin: api.apiBaseURL.absoluteString, actorId: actor)
    }

    var isCurrent: Bool {
        session.isCurrent && scope.isValid
    }

    var pending: PendingHomeInvitationDecision? {
        visible && isCurrent ? saved : nil
    }

    var canDecide: Bool {
        visible && isCurrent && opened && !isWorking && !attempted && saved == nil && context != nil
            && (context?.expiresAt == nil || (context?.expiresAt.map { $0 > Date() } ?? true))
    }

    var canAcknowledge: Bool {
        !isWorking && pending?.outcome?.isTerminal == true
    }

    func suspend() {
        generation += 1
        visible = false
        context = nil
        progress = nil
        error = nil
    }

    func open() async {
        guard !isWorking else { return }
        visible = true
        await run { revision in
            self.context = nil
            self.progress = nil
            let restored = try self.store.load(scope: self.scope)
            if let saved = self.saved, restored?.body != saved.body { throw HomeInvitationDecisionError.changed }
            self.saved = restored
            self.attempted = restored != nil
            self.serverSession = try await self.readSession(revision)
            self.opened = true
            if restored != nil { try await self.resolve(.check, revision: revision) } else { try await self.readContext(revision) }
        }
    }

    func decide(_ action: HomeInvitationAction, reviewedToken: String, lifetime: Int) async {
        guard canDecide, generation == lifetime, let context, context.decisionToken == reviewedToken else { return }
        await run { revision in
            let body: JSONValue = .object([
                "request_id": .string(UUID().uuidString.lowercased()), "token": .string(self.token),
                "home_id": .string(context.homeId), "invitation_id": .string(context.invitationId),
                "action": .string(action.rawValue), "decision_token": .string(reviewedToken)
            ])
            let draft = PendingHomeInvitationDecision(scope: self.scope, homeLabel: context.homeLabel, body: body)
            self.attempted = true
            try self.current(revision)
            try self.store.replace(scope: self.scope, expected: nil, next: draft)
            self.saved = draft
            self.context = nil
            self.progress = nil
            try await self.resolve(.retry, revision: revision)
        }
    }

    func recover(_ action: HomeInvitationRecoveryAction, requestId: String, lifetime: Int) async {
        guard pending?.requestId == requestId, generation == lifetime else { return }
        await run { revision in try await self.resolve(action, revision: revision) }
    }

    func checkAccess() async {
        await run { revision in try await self.readAccess(revision) }
    }

    /// A returned original is proof that protected acknowledgement completed in
    /// this lifetime. The caller alone chooses its explicit navigation target.
    func acknowledge(requestId: String, openHome: Bool = false) async -> PendingHomeInvitationDecision? {
        guard canAcknowledge, pending?.requestId == requestId else { return nil }
        var result: PendingHomeInvitationDecision?
        await run { revision in
            guard let original = self.saved, original.requestId == requestId else { throw HomeInvitationDecisionError.changed }
            if openHome {
                try await self.readAccess(revision)
                guard self.progress?.currentAccess == "shared"
                else { throw HomeInvitationDecisionError.refusal("CURRENT_ACCESS_UNAVAILABLE") }
            }
            try self.current(revision)
            do { try self.store.replace(scope: self.scope, expected: original, next: nil) } catch {
                guard try self.store.load(scope: self.scope) == nil else { throw error }
            }
            try self.current(revision)
            self.saved = nil
            self.observed = nil
            self.attempted = false
            self.context = nil
            self.progress = nil
            result = original
        }
        return result
    }

    func switchAccount(lifetime: Int) async {
        guard visible, isCurrent, generation == lifetime, !isWorking else { return }
        let auth = api.authProvider ?? AuthManager.shared
        if await !(auth.signOutReturningToContent("/invite/\(token)")), visible, isCurrent, generation == lifetime {
            error = "The invitation could not be saved securely for sign-in. Your account is still signed in. Try again."
        }
    }

    private func run(_ action: (Int) async throws -> Void) async {
        guard visible, isCurrent else { error = HomeInvitationDecisionError.sessionChanged.localizedDescription
            return
        }
        guard !isWorking else { return }
        let revision = generation
        isWorking = true
        error = nil
        defer { isWorking = false
        }
        do { try await action(revision) } catch {
            guard visible, generation == revision, isCurrent else { return }
            self.error = (error as? HomeInvitationDecisionError)?.localizedDescription ?? HomeInvitationDecisionError.storage
                .localizedDescription
        }
    }

    private func current(_ revision: Int) throws {
        guard visible, isCurrent, revision == generation, !Task.isCancelled else { throw HomeInvitationDecisionError.sessionChanged }
    }

    private func readSession(_ revision: Int) async throws -> String {
        let response = try await read(Endpoint(
            method: .get,
            path: "/api/homes/invitations/decisions/session",
            cachePolicy: .reloadIgnoringLocalCacheData
        ))
        try current(revision)
        guard response.status == 200, let value = HomeInvitationValidation.session(response.value.dictValue?["session"], scope: scope),
              serverSession == nil || serverSession == value else { throw HomeInvitationDecisionError.sessionChanged }
        return value
    }

    private func readContext(_ revision: Int) async throws {
        guard !attempted, saved == nil, !token.isEmpty, token.utf16.count <= 512,
              let serverSession else { throw HomeInvitationDecisionError.changed }
        let endpoint = Endpoint(
            method: .get,
            path: "/api/homes/invitations/token/\(token)/decision-context",
            headers: headers,
            cachePolicy: .reloadIgnoringLocalCacheData
        )
        let response = try await read(endpoint)
        try current(revision)
        guard response.status == 200 else {
            let code = response.value.dictValue?["code"]?.stringValue
            if code == "SESSION_SCOPE_CHANGED" { throw HomeInvitationDecisionError.sessionChanged }
            if response.status >= 500 { throw HomeInvitationDecisionError.unavailable }
            throw HomeInvitationDecisionError.refusal(code)
        }
        let context = HomeInvitationDecisionContext(value: response.value)
        guard context.matches(scope, session: serverSession),
              context.expiresAt == nil || (context.expiresAt.map { $0 > Date() } ?? true)
        else { throw HomeInvitationDecisionError.unavailable }
        self.context = context
    }

    private func resolve(_ action: HomeInvitationRecoveryAction, revision: Int) async throws {
        guard let original = saved, let serverSession,
              try store.load(scope: scope) == original else { throw HomeInvitationDecisionError.changed }
        try current(revision)
        if let known = observed ?? original.outcome, known.isTerminal { try persist(known, original: original)
            return
        }
        let base = "/api/homes/invitations/decisions"
        let path = action == .retry ? base : "\(base)/\(original.requestId)" + (action == .cancel ? "/cancel" : "")
        let body: JSONValue? = action == .check ? nil : action == .retry ? original
            .body : .object(original.fields.filter { $0.key != "request_id" })
        let response: (status: Int, value: JSONValue)
        do { response = try await read(Endpoint(
            method: action == .check ? .get : .post,
            path: path,
            body: body,
            headers: headers,
            cachePolicy: .reloadIgnoringLocalCacheData
        )) } catch { throw HomeInvitationDecisionError.unknown }
        try current(revision)
        let result = HomeInvitationDecisionOutcome(value: response.value)
        let allowed = ["completed": [200, 201], "pending": [202], "cancelled": [200], "rejected": [400, 403, 404, 409, 410, 422]]
        guard HomeInvitationValidation.session(response.value.dictValue?["session"], scope: scope) == serverSession,
              result.matches(original),
              allowed[result.state]?.contains(response.status) == true else { throw HomeInvitationDecisionError.unknown }
        try persist(result.projected(), original: original)
    }

    private func persist(_ outcome: HomeInvitationDecisionOutcome, original: PendingHomeInvitationDecision) throws {
        guard outcome.matches(original) else { throw HomeInvitationDecisionError.unknown }
        if outcome.isTerminal { observed = outcome }
        var next = original
        next.outcome = outcome
        try store.replace(scope: scope, expected: original, next: next)
        saved = next
    }

    private func readAccess(_ revision: Int) async throws {
        progress = nil
        guard let original = saved, original.outcome?.state == "completed",
              original.action == .accept else { throw HomeInvitationDecisionError.changed }
        _ = try await readSession(revision)
        let result: PersonalHomeResidencyProgress
        do { result = try await api.request(Endpoint(
            method: .get,
            path: "/api/homes/\(original.homeId)/my-residency",
            cachePolicy: .reloadIgnoringLocalCacheData
        )) } catch { throw HomeInvitationDecisionError.unavailable }
        try current(revision)
        _ = try await readSession(revision)
        guard result.matches(original.homeId) else { throw HomeInvitationDecisionError.unavailable }
        progress = result
    }

    private var headers: [String: String] {
        ["X-Pantopus-Session-Scope": serverSession ?? "", "Cache-Control": "no-cache, no-store"]
    }

    private func read(_ endpoint: Endpoint) async throws -> (status: Int, value: JSONValue) {
        let data: Data
        let status: Int
        do {
            let response = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
            data = response.data
            status = response.response.statusCode
        } catch let APIError.clientError(code, body) {
            guard let bytes = body?.data(using: .utf8) else { throw HomeInvitationDecisionError.unavailable }
            data = bytes
            status = code
        } catch APIError
            .unauthorized { throw HomeInvitationDecisionError.sessionChanged } catch { throw HomeInvitationDecisionError.unavailable }
        guard let value = try? JSONDecoder().decode(JSONValue.self, from: data) else { throw HomeInvitationDecisionError.unavailable }
        return (status, value)
    }
}
