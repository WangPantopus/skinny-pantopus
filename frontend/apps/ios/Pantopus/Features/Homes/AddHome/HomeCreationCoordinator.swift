import Foundation
import Observation

enum HomeCreationAction {
    case submit, check, cancel
}

@MainActor
protocol HomeCreationTransport {
    func resolve(_ draft: PendingHomeCreation, action: HomeCreationAction) async throws -> HomeCreationOutcome
}

@MainActor
struct APIHomeCreationTransport: HomeCreationTransport {
    let api: APIClient

    func resolve(_ draft: PendingHomeCreation, action: HomeCreationAction) async throws -> HomeCreationOutcome {
        let submitPath = draft.residencyHomeId.map { "/api/homes/\($0)/residency-submissions" } ?? "/api/homes"
        let recoveryPath = draft.residencyHomeId != nil ? "\(submitPath)/\(draft.requestId)"
            : "/api/homes/create-commands/\(draft.requestId)"
        let endpoint: Endpoint = switch action {
        case .submit: Endpoint(method: .post, path: submitPath, body: draft.body, cachePolicy: .reloadIgnoringLocalCacheData)
        case .check: Endpoint(
                method: .get,
                path: recoveryPath,
                cachePolicy: .reloadIgnoringLocalCacheData
            )
        case .cancel: Endpoint(
                method: .post,
                path: "\(recoveryPath)/cancel",
                cachePolicy: .reloadIgnoringLocalCacheData
            )
        }
        let data: Data
        let status: Int
        do {
            let response = try await api.requestDataResponse(endpoint, includingForbidden: true)
            data = response.data
            status = response.response.statusCode
        } catch let APIError.clientError(code, body) {
            guard let bytes = body?.data(using: .utf8) else { throw HomeCreationRecoveryError.unavailable }
            data = bytes
            status = code
        } catch let APIError.server(code, body) {
            data = Data(body.utf8)
            status = code
        } catch {
            // In particular, a 404 is not proof that a delayed POST cannot
            // arrive. The draft stays protected until Cancel has an outcome.
            throw HomeCreationRecoveryError.unavailable
        }
        guard let result = try? JSONDecoder().decode(HomeCreationOutcome.self, from: data), result.matches(draft) else {
            throw HomeCreationRecoveryError.unavailable
        }
        let acceptedStatus = accepts(status, for: result.state)
        guard acceptedStatus else { throw HomeCreationRecoveryError.unavailable }
        return result
    }

    private func accepts(_ status: Int, for state: HomeCreationOutcome.State) -> Bool {
        switch state {
        case .completed: [200, 201].contains(status)
        case .cancelled: status == 200
        case .pending: [200, 202, 503].contains(status)
        case .rejected: [400, 403, 404, 409, 422].contains(status)
        }
    }
}

/// Retain one immutable command per account/origin. Reads and cancellation
/// resolve uncertainty; local dismissal never means a server action was undone.
@Observable
@MainActor
final class HomeCreationCoordinator {
    private(set) var pending: PendingHomeCreation?
    private(set) var isBusy = false
    private(set) var storageFailed = false
    private let scope: HomeCreationScope
    private let store: any PendingHomeCreationStoring
    private let transport: any HomeCreationTransport
    private let requireCurrent: () throws -> Void
    private let requestId: () -> String
    private var revision = 0
    private var knownOutcome: HomeCreationOutcome?
    private var expectedRequestId: String?
    private static var activeScopes = Set<String>()

    init(
        scope: HomeCreationScope,
        store: any PendingHomeCreationStoring,
        transport: any HomeCreationTransport,
        requireCurrent: @escaping () throws -> Void,
        requestId: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) {
        self.scope = scope
        self.store = store
        self.transport = transport
        self.requireCurrent = requireCurrent
        self.requestId = requestId
    }

    var outcome: HomeCreationOutcome? {
        knownOutcome ?? pending?.outcome
    }

    func restore() throws {
        try requireCurrent()
        let saved = try readSaved()
        if let expectedRequestId, saved?.requestId != expectedRequestId { throw HomeCreationRecoveryError.changed }
        if let pending, let saved, !pending.hasSameIntent(as: saved) { throw HomeCreationRecoveryError.changed }
        if let knownOutcome {
            guard let saved, knownOutcome.matches(saved) else { throw HomeCreationRecoveryError.changed }
            if knownOutcome.isTerminal, let proof = saved.outcome, proof.isTerminal, !knownOutcome.hasSameDecision(as: proof) {
                throw HomeCreationRecoveryError.changed
            }
        }
        pending = saved
        expectedRequestId = saved?.requestId
        if knownOutcome?.isTerminal != true { knownOutcome = saved?.outcome }
    }

    func prepare(request: CreateHomeRequest, form: AddHomeFormState, accessItems: [AddHomeAccessItem]) throws {
        try requireCurrent()
        guard !isBusy, pending == nil, knownOutcome == nil, try readSaved() == nil else { throw HomeCreationRecoveryError.changed }
        let id = requestId()
        guard var body = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(request)).dictValue else {
            throw HomeCreationRecoveryError.unavailable
        }
        body["request_id"] = .string(id)
        body["access_secrets"] = .array(accessItems.filter(\.isComplete).map {
            .object([
                "access_type": .string($0.accessType.rawValue),
                "label": .string($0.label.trimmingCharacters(in: .whitespacesAndNewlines)),
                "secret_value": .string($0.secretValue.trimmingCharacters(in: .whitespacesAndNewlines)),
                "visibility": .string("members")
            ])
        })
        let draft = PendingHomeCreation(scope: scope, requestId: id, body: .object(body), form: form)
        try replace(expected: nil, next: draft)
        pending = draft
        expectedRequestId = draft.requestId
    }

    func prepareResidency(homeId: String, address: HomeResidencyAddressSnapshot, form: AddHomeFormState) throws {
        try requireCurrent()
        guard !isBusy, pending == nil, knownOutcome == nil, try readSaved() == nil,
              UUID(uuidString: homeId) != nil, address.isValid,
              let role = form.role?.claimedRole, ["renter", "household"].contains(role) else {
            throw HomeCreationRecoveryError.changed
        }
        let id = requestId()
        let addressValue = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(address))
        let draft = PendingHomeCreation(
            scope: scope,
            requestId: id,
            body: .object(["request_id": .string(id), "claimed_role": .string(role), "address": addressValue]),
            form: form,
            residencyHomeId: homeId.lowercased()
        )
        try replace(expected: nil, next: draft)
        pending = draft
        expectedRequestId = draft.requestId
    }

    @discardableResult
    func resolve(_ action: HomeCreationAction) async throws -> HomeCreationOutcome {
        try requireCurrent()
        let key = "\(scope.origin)|\(scope.actorId)"
        guard !isBusy, Self.activeScopes.insert(key).inserted else { throw HomeCreationRecoveryError.busy }
        isBusy = true
        defer { isBusy = false
            Self.activeScopes.remove(key)
        }
        let openingRevision = revision
        try restore()
        guard let draft = pending else { throw HomeCreationRecoveryError.changed }
        if let knownOutcome, knownOutcome.isTerminal {
            try persist(knownOutcome, for: draft)
            return knownOutcome
        }
        let result = try await transport.resolve(draft, action: action)
        try requireCurrent()
        guard revision == openingRevision, result.matches(draft) else { throw HomeCreationRecoveryError.sessionChanged }
        try persist(result, for: draft)
        return outcome ?? result
    }

    /// Called only after the user acknowledges a confirmed terminal result.
    /// Navigation then reloads the current Homes list and its current grants.
    func acknowledge() throws {
        try requireCurrent()
        guard !isBusy, let pending, let outcome, outcome.isTerminal, let saved = try readSaved(),
              pending.hasSameIntent(as: saved), saved.outcome?.hasSameDecision(as: outcome) == true else {
            throw HomeCreationRecoveryError.changed
        }
        try replace(expected: saved, next: nil)
        self.pending = nil
        knownOutcome = nil
        expectedRequestId = nil
    }

    func hide() {
        revision += 1
        pending = nil
        // A known terminal identity survives a failed storage write in memory;
        // the protected original still permits recovery after process death.
        if knownOutcome?.isTerminal != true { knownOutcome = nil }
    }

    private func persist(_ result: HomeCreationOutcome, for draft: PendingHomeCreation) throws {
        guard let saved = try readSaved(), saved.hasSameIntent(as: draft) else { throw HomeCreationRecoveryError.changed }
        let previous = knownOutcome?.isTerminal == true ? knownOutcome : saved.outcome
        let retained: HomeCreationOutcome
        if let previous, previous.isTerminal {
            guard !result.isTerminal || previous.hasSameDecision(as: result) else { throw HomeCreationRecoveryError.changed }
            retained = previous
        } else {
            retained = result
        }
        knownOutcome = retained
        var confirmed = saved
        confirmed.outcome = retained
        pending = confirmed
        try replace(expected: saved, next: confirmed)
    }

    private func readSaved() throws -> PendingHomeCreation? {
        do {
            let saved = try store.load(scope: scope)
            guard saved == nil || saved?.matches(scope) == true else { throw HomeCreationRecoveryError.storage }
            storageFailed = false
            return saved
        } catch {
            storageFailed = true
            throw HomeCreationRecoveryError.storage
        }
    }

    private func replace(expected: PendingHomeCreation?, next: PendingHomeCreation?) throws {
        do {
            try store.replace(scope: scope, expected: expected, next: next)
            storageFailed = false
        } catch {
            storageFailed = true
            throw HomeCreationRecoveryError.storage
        }
    }
}
