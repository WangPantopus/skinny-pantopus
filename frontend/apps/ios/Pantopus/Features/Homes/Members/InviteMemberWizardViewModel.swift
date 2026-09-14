import CryptoKit
import Foundation
import Observation

/// Sender actions retain their exact original before HTTP. Historical completion
/// is separate from current authority, roster freshness, and delivery proof.
@Observable
@MainActor
final class InviteMemberWizardViewModel {
    let homeId: String
    let target: HomeInvitationSenderTarget
    let accountLabel: String
    var email = ""
    var role = "member"
    var message = ""
    private let api: APIClient
    private let scope: HomeCreationScope
    private let session: HomeClaimSessionScope
    private let store: any PendingHomeInvitationSenderStoring
    private var serverSession: String?
    private var saved: PendingHomeInvitationSender?
    private var observed: HomeInvitationSenderOutcome?
    private var visible = false
    private var attempted = false
    private(set) var generation = 0
    private(set) var isWorking = false
    private(set) var opened = false
    private(set) var errorMessage: String?
    private(set) var context: HomeInvitationSenderContext?
    private(set) var sharingChecked = false
    private(set) var sharingExpiresAt: Date?

    init(
        homeId: String,
        target: HomeInvitationSenderTarget = .init(action: .create, invitationId: nil),
        api: APIClient = .shared,
        store: any PendingHomeInvitationSenderStoring = PendingHomeInvitationSenderStore()
    ) {
        self.homeId = homeId
        self.target = target
        self.api = api
        self.store = store
        scope = HomeInvitationDecisionViewModel.scope(api: api)
        session = HomeClaimSessionScope(api: api)
        let auth = api.authProvider ?? AuthManager.shared
        if case let .signedIn(user) = auth.state {
            accountLabel = user.displayName ?? user.username
        } else {
            accountLabel = "Sign in to manage invitations"
        }
    }

    var isCurrent: Bool {
        session.isCurrent && scope.isValid
    }

    var pending: PendingHomeInvitationSender? {
        visible && isCurrent ? saved : nil
    }

    var canPrepare: Bool {
        visible && isCurrent && opened && !isWorking && !attempted && saved == nil
    }

    var canSubmit: Bool {
        canPrepare && context != nil
    }

    var canAcknowledge: Bool {
        !isWorking && pending?.outcome?.isTerminal == true
    }

    func suspend() {
        retireSharing()
        generation += 1
        visible = false
        opened = false
        context = nil
        errorMessage = nil
    }

    func open() async {
        guard !isWorking else { return }
        visible = true
        await run { revision in
            self.context = nil
            self.opened = false
            let restored = try self.store.load(scope: self.scope)
            if let saved = self.saved, restored?.bodyData != saved.bodyData { throw HomeInvitationSenderError.changed }
            self.saved = restored
            self.attempted = restored != nil
            self.serverSession = try await self.readSession(revision)
            self.opened = true
            if restored != nil { try await self.resolve(.check, revision: revision) }
        }
        if canPrepare && target.action != .create { await prepare() }
    }

    func prepare() async {
        guard canPrepare else { return }
        if target.action == .create && !Self.isValidEmail(email) { errorMessage = "Enter a complete email address."
            return
        }
        await run { revision in
            self.context = nil
            _ = try await self.readSession(revision)
            let intent = self.currentIntent
            guard HomeInvitationSenderValidation.intent(intent) else { throw HomeInvitationSenderError.changed }
            let response = try await self.read(Endpoint(method: .post, path: self.base + "/context", body: intent, headers: self.headers))
            try self.current(revision)
            guard response.status == 200 else { throw HomeInvitationSenderError.refusal(response.value.dictValue?["code"]?.stringValue) }
            let context = HomeInvitationSenderContext(intent: intent, value: response.value)
            guard let serverSession = self.serverSession, context.matches(self.scope, session: serverSession)
            else { throw HomeInvitationSenderError.unavailable }
            self.context = context
        }
    }

    var currentIntent: JSONValue {
        var fields: [String: JSONValue] = ["home_id": .string(homeId), "action": .string(target.action.rawValue)]
        if target.action == .create {
            fields["payload"] = .object([
                "email": .string(email.trimmingCharacters(in: .whitespacesAndNewlines)),
                "relationship": .string(role),
                "message": message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .null
                    : .string(message.trimmingCharacters(in: .whitespacesAndNewlines))
            ])
        } else { fields["invitation_id"] = target.invitationId.map(JSONValue.string) ?? .null }
        return .object(fields)
    }

    func edit() {
        guard canPrepare else { return }
        context = nil
        generation += 1
    }

    func submit(reviewedToken: String, lifetime: Int) async {
        guard canSubmit, generation == lifetime, let context, context.token == reviewedToken,
              context.intent == currentIntent else { return }
        await run { revision in
            _ = try await self.readSession(revision)
            var fields = context.intent.dictValue ?? [:]
            fields["request_id"] = .string(UUID().uuidString.lowercased())
            fields["decision_token"] = .string(reviewedToken)
            fields["token"] = self.target.action == .withdraw ? .null
                : .string(SymmetricKey(size: .bits256).withUnsafeBytes { $0.map { String(format: "%02x", $0) }.joined() })
            var review = context.invitation.filter {
                [
                    "invitee_email",
                    "proposed_role",
                    "proposed_role_base",
                    "proposed_preset_key",
                    "expires_at",
                    "access_start_at",
                    "access_end_at"
                ].contains($0.key)
            }
            if let profile = context.invitation["invitee"]?.dictValue {
                review["recipient_label"] = .string(HomeInvitationSenderValidation.profileLabel(profile))
            }
            let original = try PendingHomeInvitationSender(
                scope: self.scope,
                bodyData: HomeInvitationSenderValidation.encode(.object(fields)),
                review: .object(review)
            )
            guard original.matches(self.scope) else { throw HomeInvitationSenderError.changed }
            self.attempted = true
            try self.current(revision)
            try self.store.replace(scope: self.scope, expected: nil, next: original)
            self.saved = original
            self.context = nil
            try await self.resolve(.retry, revision: revision)
        }
    }

    func recover(_ action: HomeInvitationRecoveryAction, requestId: String, lifetime: Int) async {
        guard pending?.requestId == requestId, generation == lifetime else { return }
        await run { revision in try await self.resolve(action, revision: revision) }
    }

    func acknowledge(requestId: String) async -> PendingHomeInvitationSender? {
        guard canAcknowledge, pending?.requestId == requestId else { return nil }
        var result: PendingHomeInvitationSender?
        await run { revision in
            guard let original = self.saved, original.requestId == requestId else { throw HomeInvitationSenderError.changed }
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
            self.context = nil
            result = original
        }
        return result
    }

    var shareURL: URL? {
        guard sharingChecked, sharingExpiresAt == nil || (sharingExpiresAt.map { $0 > Date() } ?? true), let original = pending,
              original.outcome?.state == "completed", original.action != .withdraw,
              let token = original.token else { return nil }
        return HomeInvitationShareURL.make(
            token: token,
            apiOrigin: api.apiBaseURL,
            configuredWebOrigin: Bundle.main.object(forInfoDictionaryKey: "PantopusPublicWebURL") as? String
        )
    }

    func retireSharing() {
        sharingChecked = false
        sharingExpiresAt = nil
    }

    func checkSharing(requestId: String) async {
        guard let original = pending, original.requestId == requestId, original.outcome?.state == "completed",
              original.action != .withdraw, let invitationId = original.outcome?.invitationId else { return }
        await run { revision in
            guard try self.store.load(scope: self.scope) == original else { throw HomeInvitationSenderError.changed }
            _ = try await self.readSession(revision)
            let intent: JSONValue = .object([
                "home_id": .string(original.homeId),
                "action": .string("resend"),
                "invitation_id": .string(invitationId)
            ])
            let response = try await self.read(Endpoint(
                method: .post,
                path: self.base + "/context",
                body: intent,
                headers: self.headers,
                cachePolicy: .reloadIgnoringLocalCacheData
            ))
            try self.current(revision)
            let current = HomeInvitationSenderContext(intent: intent, value: response.value)
            guard response.status == 200, let session = self.serverSession, current.matches(self.scope, session: session),
                  try self.store.load(scope: self.scope) == original else { throw HomeInvitationSenderError.unavailable }
            let expiry = current.invitation["expires_at"]?.stringValue.flatMap(HomeInvitationValidation.date)
            guard expiry == nil || (expiry.map { $0 > Date() } ?? true) else { throw HomeInvitationSenderError.unavailable }
            self.sharingExpiresAt = min(expiry ?? Date().addingTimeInterval(60), Date().addingTimeInterval(60))
            self.sharingChecked = true
        }
    }

    func prepareShare(requestId: String, lifetime: Int) async -> URL? {
        guard generation == lifetime, pending?.requestId == requestId else { return nil }
        await checkSharing(requestId: requestId)
        guard generation == lifetime else { return nil }
        return shareURL
    }

    private func run(_ action: (Int) async throws -> Void) async {
        guard visible, isCurrent else { errorMessage = HomeInvitationSenderError.sessionChanged.localizedDescription
            return
        }
        guard !isWorking else { return }
        let revision = generation
        retireSharing()
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await action(revision)
        } catch {
            guard visible, isCurrent, generation == revision else { return }
            errorMessage = (error as? HomeInvitationSenderError)?.localizedDescription ?? HomeInvitationSenderError.storage
                .localizedDescription
        }
    }

    private func current(_ revision: Int) throws {
        guard visible, isCurrent, generation == revision, !Task.isCancelled else { throw HomeInvitationSenderError.sessionChanged }
    }

    private var base: String {
        "/api/homes/invitations/sender"
    }

    private var headers: [String: String] {
        ["X-Pantopus-Session-Scope": serverSession ?? "", "Cache-Control": "no-cache, no-store"]
    }

    private func resolve(_ action: HomeInvitationRecoveryAction, revision: Int) async throws {
        guard let original = saved, let serverSession,
              try store.load(scope: scope) == original else { throw HomeInvitationSenderError.changed }
        try current(revision)
        if let known = observed ?? original.outcome, known.isTerminal { try persist(known, original: original)
            return
        }
        _ = try await readSession(revision)
        let path = base + "/commands" + (action == .retry ? "" : "/" + original.requestId + (action == .cancel ? "/cancel" : ""))
        let bytes: Data? = action == .check ? nil : action == .retry ? original.bodyData
            : try HomeInvitationSenderValidation.encode(.object(original.fields.filter { $0.key != "request_id" }))
        let response: (status: Int, value: JSONValue)
        do { response = try await read(Endpoint(
            method: action == .check ? .get : .post,
            path: path,
            bodyData: bytes,
            headers: headers,
            cachePolicy: .reloadIgnoringLocalCacheData
        )) } catch { throw HomeInvitationSenderError.unknown }
        try current(revision)
        let result = HomeInvitationSenderOutcome(value: response.value)
        let allowed = ["completed": [200, 201], "pending": [202], "cancelled": [200], "rejected": [400, 403, 404, 409, 410, 422]]
        guard HomeInvitationValidation.session(response.value.dictValue?["session"], scope: scope) == serverSession,
              result.matches(original),
              allowed[result.state]?.contains(response.status) == true else { throw HomeInvitationSenderError.unknown }
        try persist(result.projected(), original: original)
    }

    private func persist(_ outcome: HomeInvitationSenderOutcome, original: PendingHomeInvitationSender) throws {
        guard outcome.matches(original) else { throw HomeInvitationSenderError.unknown }
        if outcome.isTerminal { observed = outcome }
        var next = original
        next.outcome = outcome
        try store.replace(scope: scope, expected: original, next: next)
        saved = next
    }

    static func isValidEmail(_ raw: String) -> Bool {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = value.split(separator: "@")
        return !value.isEmpty && value.utf16.count <= 254 && parts.count == 2 && parts[1].contains(".")
            && !value.contains(where: \.isWhitespace)
    }
}

@MainActor
private extension InviteMemberWizardViewModel {
    func readSession(_ revision: Int) async throws -> String {
        let response = try await read(Endpoint(method: .get, path: base + "/session", cachePolicy: .reloadIgnoringLocalCacheData))
        try current(revision)
        guard response.status == 200, let value = HomeInvitationValidation.session(response.value.dictValue?["session"], scope: scope),
              serverSession == nil || serverSession == value else { throw HomeInvitationSenderError.sessionChanged }
        return value
    }

    func read(_ endpoint: Endpoint) async throws -> (status: Int, value: JSONValue) {
        let data: Data
        let status: Int
        do {
            let response = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
            data = response.data
            status = response.response.statusCode
        } catch let APIError.clientError(code, body) {
            guard let bytes = body?.data(using: .utf8) else { throw HomeInvitationSenderError.unavailable }
            data = bytes
            status = code
        } catch APIError.unauthorized {
            throw HomeInvitationSenderError.sessionChanged
        } catch {
            throw HomeInvitationSenderError.unavailable
        }
        guard let value = try? JSONDecoder().decode(JSONValue.self, from: data) else { throw HomeInvitationSenderError.unavailable }
        return (status, value)
    }
}
