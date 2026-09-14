import Foundation
import Observation

@MainActor
protocol HomeTaskCreationAccess {
    var openingActorId: String? { get }
    var lifecycleRevision: Int { get }
    func requireCurrent(_ revision: Int?) throws
    func create(_ draft: HomeTaskCreateDraft) async throws -> HomeTaskCreationResult
}

@Observable
@MainActor
final class HomeTaskCreationCoordinator {
    enum RecoveryError: LocalizedError {
        case changedRequest
        case storage
        case completed

        var errorDescription: String? {
            switch self {
            case .changedRequest: "A task request is already saved. Reopen this form to recover that exact request."
            case .storage: "Your saved task request could not be read. Try again before starting another task."
            case .completed: "This task request is complete. Close this form to view your tasks."
            }
        }
    }

    private(set) var pending: HomeTaskCreateDraft?
    private(set) var receipt: HomeTaskCreationReceipt?
    private(set) var terminalMessage: String?
    private let access: any HomeTaskCreationAccess
    private let store: any PendingHomeTaskCreateStoring
    private let scope: String
    private let home: String
    private let actor: String
    private var completed = false
    private var expectedRequestId: String?
    private let requestId: () -> String
    private static var active = Set<String>()

    init(
        home: String,
        origin: URL,
        access: any HomeTaskCreationAccess,
        store: any PendingHomeTaskCreateStoring,
        requestId: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) {
        self.home = home
        self.access = access
        self.store = store
        self.requestId = requestId
        actor = access.openingActorId ?? ""
        scope = "\(origin.absoluteString)|\(actor)|\(home)"
    }

    func restore() throws {
        try access.requireCurrent(nil)
        let saved = try readSaved()
        guard saved == nil || saved?.matches(home: home, actor: actor) == true else { throw RecoveryError.storage }
        if let expectedRequestId, saved?.requestId != expectedRequestId { throw RecoveryError.changedRequest }
        if let pending, let saved, !pending.compatible(with: saved) { throw RecoveryError.changedRequest }
        if let receipt, let saved {
            guard receipt.matches(saved) else { throw RecoveryError.changedRequest }
            pending = saved.confirmed(by: receipt)
        } else if pending?.taskId == nil { pending = saved }
        expectedRequestId = saved?.requestId
    }

    func save(_ payload: CreateHomeTaskRequest) async throws -> HomeTaskDTO {
        let revision = access.lifecycleRevision
        try access.requireCurrent(revision)
        guard !completed else { throw RecoveryError.completed }
        guard Self.active.insert(scope).inserted else { throw HomeTaskAccess.AccessError.busy }
        defer { Self.active.remove(scope) }
        let saved = try readSaved()
        if let saved {
            guard pending?.compatible(with: saved) == true else { throw RecoveryError.changedRequest }
            if pending?.taskId == nil { pending = saved }
        } else if pending != nil { throw RecoveryError.changedRequest }
        let draft = pending ?? HomeTaskCreateDraft(
            requestId: requestId(), homeId: home, actorId: actor, payload: payload
        )
        guard draft.matches(home: home, actor: actor) else { throw APIError.invalidResponse }
        // Persist the original UUID and exact payload before the first possible POST.
        try store.save(draft, scope: scope, matching: saved)
        pending = draft
        expectedRequestId = draft.requestId
        try access.requireCurrent(revision)
        let result: HomeTaskCreationResult
        do { result = try await access.create(draft) } catch {
            try access.requireCurrent(revision)
            terminalMessage = Self.terminalMessage(for: error)
            throw error
        }
        try access.requireCurrent(revision)
        terminalMessage = nil
        guard receipt == nil || receipt == result.receipt else { throw APIError.invalidResponse }
        receipt = result.receipt
        let confirmed = draft.confirmed(by: result.receipt)
        pending = confirmed
        try store.save(confirmed, scope: scope, matching: draft)
        try access.requireCurrent(revision)
        try store.clear(scope: scope, matching: confirmed)
        pending = nil
        expectedRequestId = nil
        completed = true
        return result.task
    }

    func acknowledgeTerminalRequest() throws {
        try access.requireCurrent(nil)
        guard terminalMessage != nil, let pending, !Self.active.contains(scope), try readSaved() == pending else {
            throw RecoveryError.changedRequest
        }
        try store.clear(scope: scope, matching: pending)
        self.pending = nil
        receipt = nil
        expectedRequestId = nil
        terminalMessage = nil
        completed = true
    }

    private static func terminalMessage(for error: any Error) -> String? {
        guard case let APIError.clientError(status, body) = error else { return nil }
        switch (status, APIError.code(in: body)) {
        case (400, "HOME_RECORD_INVALID"):
            return "The server rejected this saved request. You can clear the request and reopen Add task to correct its details."
        case (409, "HOME_TASK_CREATE_RETIRED"):
            return "The task for this saved request is no longer available. Clearing the request does not restore or delete a task."
        default: return nil
        }
    }

    private func readSaved() throws -> HomeTaskCreateDraft? {
        do { return try store.load(scope: scope) } catch { throw RecoveryError.storage }
    }

    func hide() {
        // The protected store retains the original for a new current screen.
        pending = nil
        // An observed receipt contains only identity/hash metadata. Keep it if
        // writing that proof failed, so a later restore cannot forget known facts.
        terminalMessage = nil
    }
}
