import Foundation
import Observation

/// One protected original postal command survives interruption and uncertain transport.
@Observable
@MainActor
final class HomePostalCoordinator {
    private(set) var pending: PendingHomePostalCommand?
    private(set) var isBusy = false
    private(set) var storageFailed = false
    private let scope: HomePostalScope
    private let store: any PendingHomePostalStoring
    private let transport: any HomePostalTransport
    private let requireCurrent: () throws -> Void
    private let requestId: () -> String
    private var revision = 0
    private var knownOutcome: HomePostalOutcome?
    private var expectedRequestId: String?
    private static var activeScopes = Set<HomePostalScope>()

    init(
        scope: HomePostalScope,
        store: any PendingHomePostalStoring,
        transport: any HomePostalTransport,
        requireCurrent: @escaping () throws -> Void,
        requestId: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) {
        self.scope = scope
        self.store = store
        self.transport = transport
        self.requireCurrent = requireCurrent
        self.requestId = requestId
    }

    var outcome: HomePostalOutcome? {
        knownOutcome ?? pending?.outcome
    }

    func restore() throws {
        try requireCurrent()
        let saved = try readSaved()
        if let expectedRequestId, saved?.requestId != expectedRequestId { throw HomePostalError.changed }
        if let pending, let saved, !pending.hasSameIntent(as: saved) { throw HomePostalError.changed }
        if let knownOutcome {
            guard let saved, knownOutcome.matches(saved) else { throw HomePostalError.changed }
            if knownOutcome.isTerminal, let proof = saved.outcome, proof.isTerminal, !knownOutcome.hasSameDecision(as: proof) {
                throw HomePostalError.changed
            }
        }
        pending = saved
        expectedRequestId = saved?.requestId
        if knownOutcome?.isTerminal != true { knownOutcome = saved?.outcome }
    }

    func prepareMail(address: JSONValue, originalRequestId: String? = nil) throws {
        let id = originalRequestId ?? requestId()
        try prepare(PendingHomePostalCommand(
            scope: scope,
            requestId: id,
            kind: .mail,
            postcardId: nil,
            body: .object(["request_id": .string(id), "address": address])
        ))
    }

    func prepareCode(_ code: String, postcardId: String) throws {
        let id = requestId()
        try prepare(PendingHomePostalCommand(
            scope: scope,
            requestId: id,
            kind: .code,
            postcardId: postcardId,
            body: .object(["request_id": .string(id), "code": .string(code)])
        ))
    }

    private func prepare(_ draft: PendingHomePostalCommand) throws {
        try requireCurrent()
        guard !isBusy, pending == nil, knownOutcome == nil, try readSaved() == nil,
              draft.matches(scope) else { throw HomePostalError.changed }
        try replace(expected: nil, next: draft)
        pending = draft
        expectedRequestId = draft.requestId
    }

    @discardableResult
    func resolve(_ action: HomePostalAction) async throws -> HomePostalOutcome {
        try requireCurrent()
        let key = scope
        guard !isBusy, Self.activeScopes.insert(key).inserted else { throw HomePostalError.busy }
        isBusy = true
        defer { isBusy = false
            Self.activeScopes.remove(key)
        }
        let openingRevision = revision
        try restore()
        guard let draft = pending else { throw HomePostalError.changed }
        if let knownOutcome, knownOutcome.isTerminal {
            try persist(knownOutcome, for: draft)
            return knownOutcome
        }
        let result = try await transport.resolve(draft, action: action)
        try requireCurrent()
        guard revision == openingRevision, result.matches(draft) else { throw HomePostalError.sessionChanged }
        try persist(result, for: draft)
        return outcome ?? result
    }

    /// Called only after the user acknowledges a confirmed terminal result.
    /// Navigation then reads current residency access and mailing status.
    @discardableResult
    func acknowledge() throws -> PendingHomePostalCommand {
        try requireCurrent()
        guard !isBusy, let pending, let outcome, outcome.isTerminal, let saved = try readSaved(),
              pending.hasSameIntent(as: saved), saved.outcome?.hasSameDecision(as: outcome) == true else {
            throw HomePostalError.changed
        }
        try replace(expected: saved, next: nil)
        self.pending = nil
        knownOutcome = nil
        expectedRequestId = nil
        return pending
    }

    func hide() {
        revision += 1
        pending = nil
        // A known terminal identity survives a failed storage write in memory;
        // the protected original still permits recovery after process death.
        if knownOutcome?.isTerminal != true { knownOutcome = nil }
    }

    private func persist(_ result: HomePostalOutcome, for draft: PendingHomePostalCommand) throws {
        guard let saved = try readSaved(), saved.hasSameIntent(as: draft) else { throw HomePostalError.changed }
        let previous = knownOutcome?.isTerminal == true ? knownOutcome : saved.outcome
        let retained: HomePostalOutcome
        if let previous, previous.isTerminal {
            guard !result.isTerminal || previous.hasSameDecision(as: result) else { throw HomePostalError.changed }
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

    private func readSaved() throws -> PendingHomePostalCommand? {
        do {
            let saved = try store.load(scope: scope)
            guard saved == nil || saved?.matches(scope) == true else { throw HomePostalError.storage }
            storageFailed = false
            return saved
        } catch {
            storageFailed = true
            throw HomePostalError.storage
        }
    }

    private func replace(expected: PendingHomePostalCommand?, next: PendingHomePostalCommand?) throws {
        do {
            try store.replace(scope: scope, expected: expected, next: next)
            storageFailed = false
        } catch {
            storageFailed = true
            throw HomePostalError.storage
        }
    }
}
