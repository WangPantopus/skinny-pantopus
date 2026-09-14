import Foundation
import Observation

/// A receipt confirms only its original. Fresh member-list authority is separate.
@Observable
@MainActor
final class HomeMemberRemovalViewModel {
    let target: HomeMemberRemovalTarget?
    let accountLabel: String
    private let api: APIClient
    private let scope: HomeCreationScope
    private let session: HomeClaimSessionScope
    private let store: any PendingHomeMemberRemovalStoring
    private let requestId: () -> String
    private var saved: PendingHomeMemberRemoval?
    private var observed: HomeMemberRemovalOutcome?
    private var serverSession: String?
    private var visible = false
    private var retired = false
    private var attempted = false
    private static var activeScopes = Set<String>()
    private(set) var generation = 0
    private(set) var isWorking = false
    private(set) var opened = false
    private(set) var errorMessage: String?
    private var preparedContext: HomeMemberRemovalContext?
    var context: HomeMemberRemovalContext? {
        visible && isCurrent ? preparedContext : nil
    }

    init(
        target: HomeMemberRemovalTarget? = nil,
        api: APIClient = .shared,
        store: any PendingHomeMemberRemovalStoring = PendingHomeMemberRemovalStore(),
        requestId: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) {
        self.target = target
        self.api = api
        self.store = store
        self.requestId = requestId
        scope = HomeInvitationDecisionViewModel.scope(api: api)
        session = HomeClaimSessionScope(api: api)
        let auth = api.authProvider ?? AuthManager.shared
        if case let .signedIn(user) = auth.state {
            accountLabel = user.displayName ?? user.username
        } else {
            accountLabel = "Sign in to recover a removal"
        }
    }

    var isCurrent: Bool {
        !retired && session.isCurrent && scope.isValid
    }

    var pending: PendingHomeMemberRemoval? {
        visible && isCurrent ? saved : nil
    }

    var canSubmit: Bool {
        visible && isCurrent && opened && !isWorking && !attempted && saved == nil && context != nil
    }

    var canAcknowledge: Bool {
        !isWorking && pending?.outcome?.isTerminal == true
    }

    var recoveringAnotherTarget: Bool {
        guard let target, let pending else { return false }
        return target.homeId != pending.homeId || target.userId != pending.targetId
    }

    func suspend() {
        generation += 1
        visible = false
        opened = false
        preparedContext = nil
        errorMessage = nil
    }

    func open() async {
        guard !isWorking else { return }
        visible = true
        await run { revision in
            self.preparedContext = nil
            self.opened = false
            try self.restore()
            self.serverSession = try await self.readSession(revision)
            self.opened = true
            if self.saved != nil {
                try await self.resolve(.check, revision: revision)
            } else if let target = self.target {
                try await self.readContext(target, revision: revision)
            }
        }
    }

    func submit(reviewedToken: String, lifetime: Int) async {
        guard canSubmit, generation == lifetime, let context, context.token == reviewedToken, let target else { return }
        await run { revision in
            _ = try await self.readSession(revision)
            guard context.matches(target, scope: self.scope, session: self.serverSession ?? "") else {
                throw HomeMemberRemovalError.changed
            }
            var fields = context.fields.filter { HomeMemberRemovalValidation.intentKeys.contains($0.key) }
            fields["request_id"] = .string(self.requestId())
            let original = try PendingHomeMemberRemoval(
                scope: self.scope, bodyData: HomeMemberRemovalValidation.encode(.object(fields)), review: context.summary
            )
            guard original.matches(self.scope) else { throw HomeMemberRemovalError.changed }
            self.attempted = true
            try self.current(revision)
            try self.store.replace(scope: self.scope, expected: nil, next: original)
            self.saved = original
            self.preparedContext = nil
            try await self.resolve(.retry, revision: revision)
        }
    }

    func recover(_ action: HomeInvitationRecoveryAction, requestId: String, lifetime: Int) async {
        guard pending?.requestId == requestId, generation == lifetime else { return }
        await run { revision in try await self.resolve(action, revision: revision) }
    }

    func acknowledge(requestId: String) async -> PendingHomeMemberRemoval? {
        guard canAcknowledge, pending?.requestId == requestId else { return nil }
        var result: PendingHomeMemberRemoval?
        await run { revision in
            try self.restore()
            guard let original = self.saved, original.requestId == requestId, original.outcome?.isTerminal == true else {
                throw HomeMemberRemovalError.changed
            }
            try self.current(revision)
            do {
                try self.store.replace(scope: self.scope, expected: original, next: nil)
            } catch {
                guard try self.store.load(scope: self.scope) == nil else { throw error }
            }
            try self.current(revision)
            self.saved = nil
            self.observed = nil
            self.attempted = false
            self.preparedContext = nil
            result = original
        }
        return result
    }

    private func restore() throws {
        let original = try store.load(scope: scope)
        if let saved {
            guard original?.bodyData == saved.bodyData, original?.review == saved.review else { throw HomeMemberRemovalError.changed }
        }
        if let observed {
            guard let original, observed.matches(original),
                  original.outcome == nil || original.outcome?.isTerminal == false || original.outcome == observed else {
                throw HomeMemberRemovalError.changed
            }
        }
        saved = original
        if observed == nil { observed = original?.outcome }
        attempted = original != nil
    }

    private func run(_ operation: (Int) async throws -> Void) async {
        guard visible, isCurrent else { errorMessage = HomeMemberRemovalError.sessionChanged.localizedDescription
            return
        }
        guard !isWorking else { return }
        let key = PendingHomeMemberRemovalStore.key(scope)
        guard Self.activeScopes.insert(key).inserted else { errorMessage = HomeMemberRemovalError.busy.localizedDescription
            return
        }
        let revision = generation
        isWorking = true
        errorMessage = nil
        defer { isWorking = false
            Self.activeScopes.remove(key)
        }
        do {
            try await operation(revision)
        } catch {
            guard visible, generation == revision else { return }
            if !session.isCurrent || (error as? HomeMemberRemovalError).map(Self.isSessionError) == true {
                retired = true
                preparedContext = nil
                errorMessage = HomeMemberRemovalError.sessionChanged.localizedDescription
            } else {
                errorMessage = (error as? HomeMemberRemovalError)?.localizedDescription ?? HomeMemberRemovalError.storage
                    .localizedDescription
            }
        }
    }

    private static func isSessionError(_ error: HomeMemberRemovalError) -> Bool {
        if case .sessionChanged = error { return true }
        return false
    }

    private func current(_ revision: Int) throws {
        guard visible, isCurrent, generation == revision, !Task.isCancelled else { throw HomeMemberRemovalError.sessionChanged }
    }

    private var base: String {
        "/api/homes/member-removals"
    }

    private var headers: [String: String] {
        ["X-Pantopus-Session-Scope": serverSession ?? "", "Cache-Control": "no-cache, no-store"]
    }

    private func readContext(_ target: HomeMemberRemovalTarget, revision: Int) async throws {
        guard HomePostalValidation.uuid(target.homeId), HomePostalValidation.uuid(target.userId) else {
            throw HomeMemberRemovalError.changed
        }
        preparedContext = nil
        let response = try await read(Endpoint(
            method: .post,
            path: base + "/context",
            body: JSONValue.object(["home_id": .string(target.homeId), "target_user_id": .string(target.userId)]),
            headers: headers,
            cachePolicy: .reloadIgnoringLocalCacheData
        ))
        try current(revision)
        guard HomeInvitationValidation.session(response.value.dictValue?["session"], scope: scope) == serverSession else {
            throw HomeMemberRemovalError.unavailable
        }
        guard response.status == 200 else { throw HomeMemberRemovalError.refusal(response.value.dictValue?["code"]?.stringValue) }
        let review = HomeMemberRemovalContext(value: response.value)
        guard review.matches(target, scope: scope, session: serverSession ?? "") else { throw HomeMemberRemovalError.unavailable }
        preparedContext = review
    }

    private func resolve(_ action: HomeInvitationRecoveryAction, revision: Int) async throws {
        try restore()
        guard let original = saved else { throw HomeMemberRemovalError.changed }
        try current(revision)
        if let known = observed ?? original.outcome, known.isTerminal { try persist(known, original: original)
            return
        }
        _ = try await readSession(revision)
        guard try store.load(scope: scope) == original else { throw HomeMemberRemovalError.changed }
        let path = base + "/commands" + (action == .retry ? "" : "/" + original.requestId + (action == .cancel ? "/cancel" : ""))
        let bytes: Data? = action == .check ? nil : action == .retry ? original.bodyData
            : try HomeMemberRemovalValidation.encode(.object(original.fields.filter { $0.key != "request_id" }))
        let response: (status: Int, value: JSONValue)
        do {
            response = try await read(Endpoint(
                method: action == .check ? .get : .post,
                path: path,
                bodyData: bytes,
                headers: headers,
                cachePolicy: .reloadIgnoringLocalCacheData
            ))
        } catch HomeMemberRemovalError.sessionChanged {
            throw HomeMemberRemovalError.sessionChanged
        } catch {
            throw HomeMemberRemovalError.unknown
        }
        try current(revision)
        let proof = HomeMemberRemovalOutcome(value: response.value)
        guard HomeInvitationValidation.session(proof.fields["session"], scope: scope) == serverSession,
              action != .check || proof.fields["replayed"] == nil,
              proof.matches(original), response.status == proof.expectedStatus else { throw HomeMemberRemovalError.unknown }
        try persist(proof.projected(), original: original)
    }

    private func persist(_ outcome: HomeMemberRemovalOutcome, original: PendingHomeMemberRemoval) throws {
        guard outcome.matches(original), observed == nil || observed?.isTerminal == false || observed == outcome else {
            throw HomeMemberRemovalError.unknown
        }
        if outcome.isTerminal { observed = outcome }
        var next = original
        next.outcome = outcome
        try store.replace(scope: scope, expected: original, next: next)
        saved = next
    }

    private func readSession(_ revision: Int) async throws -> String {
        let response = try await read(Endpoint(method: .get, path: base + "/session", cachePolicy: .reloadIgnoringLocalCacheData))
        try current(revision)
        guard response.status == 200, let value = HomeInvitationValidation.session(response.value.dictValue?["session"], scope: scope)
        else { throw HomeMemberRemovalError.unavailable }
        guard serverSession == nil || serverSession == value else { throw HomeMemberRemovalError.sessionChanged }
        return value
    }

    private func read(_ endpoint: Endpoint) async throws -> (status: Int, value: JSONValue) {
        let data: Data
        let status: Int
        do {
            let response = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
            data = response.data
            status = response.response.statusCode
        } catch let APIError.clientError(code, body) {
            guard let bytes = body?.data(using: .utf8) else { throw HomeMemberRemovalError.unavailable }
            data = bytes
            status = code
        } catch APIError.unauthorized {
            throw HomeMemberRemovalError.sessionChanged
        } catch {
            throw HomeMemberRemovalError.unavailable
        }
        guard let value = try? JSONDecoder().decode(JSONValue.self, from: data) else { throw HomeMemberRemovalError.unavailable }
        if value.dictValue?["code"] == .string("SESSION_SCOPE_CHANGED") { throw HomeMemberRemovalError.sessionChanged }
        return (status, value)
    }
}
