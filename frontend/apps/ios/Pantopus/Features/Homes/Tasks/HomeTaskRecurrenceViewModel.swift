import Foundation
import Observation

@Observable
@MainActor
final class HomeTaskRecurrenceViewModel {
    enum Failure: LocalizedError, Equatable {
        case changedRequest, storage, changedSource

        var errorDescription: String? {
            switch self {
            case .changedRequest: "The saved schedule change changed elsewhere. Reload to recover the current original request."
            case .storage: "The original schedule change could not be read. It has been kept; no new change was submitted."
            case .changedSource: "The task changed. Reload and review it before changing repeats."
            }
        }
    }

    private(set) var task: HomeTaskDTO?
    private(set) var state: HomeTaskRecurrenceState?
    private(set) var pending: HomeTaskRecurrenceDraft?
    private(set) var loading = false
    private(set) var busy = false
    private(set) var error: String?
    private(set) var canDismiss = false
    var frequency: HomeTaskRecurrenceFrequency = .weekly
    var interval = "1"
    var timezone = "UTC"
    private let access: HomeTaskAccess
    private let store: any PendingHomeTaskRecurrenceStoring
    private let taskId: String
    private let actor: String
    private let origin: String
    private let scope: String
    private let newRequestId: () -> String
    private var visible = false
    private var reloadQueued = false
    private var observedReceipt: HomeTaskRecurrenceReceipt?
    private static var active = Set<String>()

    init(
        homeId: String,
        taskId: String,
        api: APIClient = .shared,
        access: HomeTaskAccess? = nil,
        store: any PendingHomeTaskRecurrenceStoring = PendingHomeTaskRecurrenceStore(),
        requestId: @escaping () -> String = { UUID().uuidString.lowercased() }
    ) {
        let access = access ?? HomeTaskAccess(homeId: homeId, api: api)
        self.access = access
        self.store = store
        self.taskId = taskId
        actor = access.openingActorId ?? ""
        origin = api.apiBaseURL.absoluteString
        scope = "recurrence-v1|\(origin)|\(actor)|\(homeId)|\(taskId)"
        newRequestId = requestId
    }

    var activationRevision: Int {
        access.lifecycleRevision
    }

    var isCurrent: Bool {
        access.isCurrent
    }

    var isActive: Bool {
        visible && isCurrent
    }

    var canChange: Bool {
        isActive && !busy && !loading && pending == nil && state?.canManage == true
    }

    var canStart: Bool {
        canChange && task?.status != "canceled" && HomeTaskRecurrenceDate.parse(task?.dueAt) != nil && startCommand?.valid == true
            && (state?.configuration?.state != "active" || state?.configuration?.frequency != frequency
                || state?.configuration?.interval != Int(interval) || state?.configuration?.timezone != timezone)
    }

    private var startCommand: HomeTaskRecurrenceCommand? {
        guard let state, let count = Int(interval) else { return nil }
        return HomeTaskRecurrenceCommand(
            action: "start",
            expectedRevision: state.revision,
            expectedTaskUpdatedAt: state.taskUpdatedAt,
            frequency: frequency,
            interval: count,
            timezone: timezone
        )
    }

    func activate(ifCurrent revision: Int) async {
        guard revision == activationRevision, !Task.isCancelled else { return }
        visible = true
        await load()
    }

    func load() async {
        guard isActive, !Task.isCancelled else { return }
        if busy { reloadQueued = true
            return
        }
        access.invalidatePending()
        let revision = activationRevision
        loading = true
        task = nil
        state = nil
        pending = nil
        error = nil
        canDismiss = false
        do {
            let (task, state) = try await currentSource(revision)
            let saved = try readSaved()
            try current(revision)
            self.task = task
            self.state = state
            pending = saved
            applyFields()
        } catch { record(error, revision: revision) }
        if revision == activationRevision { loading = false }
    }

    private func currentSource(_ revision: Int) async throws -> (HomeTaskDTO, HomeTaskRecurrenceState) {
        let task = try await access.detail(taskId: taskId)
        try current(revision)
        let state = try await access.recurrence(taskId: taskId)
        try current(revision)
        guard task.updatedAt == state.taskUpdatedAt else { throw Failure.changedSource }
        return (task, state)
    }

    func start() async {
        guard canStart, let command = startCommand else { return }
        await perform(command: command)
    }

    func pause() async {
        guard canChange, let state, let config = state.configuration, config.state != "paused" else { return }
        await perform(command: HomeTaskRecurrenceCommand(action: "pause", expectedRevision: state.revision))
    }

    func retry() async {
        guard pending != nil, pending?.confirmed == nil, state?.canManage == true else { return }
        await perform(command: nil)
    }

    private func perform(command: HomeTaskRecurrenceCommand?) async {
        guard begin() else { return }
        let revision = activationRevision
        defer { finish() }
        do {
            try current(revision)
            guard try readSaved() == pending else { throw Failure.changedRequest }
            let draft: HomeTaskRecurrenceDraft
            if let command {
                guard pending == nil, command.valid else { throw Failure.changedRequest }
                draft = HomeTaskRecurrenceDraft(
                    version: 1,
                    origin: origin,
                    actorId: actor,
                    homeId: access.homeId,
                    taskId: taskId,
                    requestId: newRequestId(),
                    command: command
                )
                guard draft.matches(origin: origin, home: access.homeId, task: taskId, actor: actor) else { throw APIError.invalidResponse }
                try store.save(draft, scope: scope, matching: nil)
                pending = draft
            } else {
                guard let original = pending, original.confirmed == nil else { throw Failure.changedRequest }
                draft = original
            }
            try current(revision)
            let response = try await access.changeRecurrence(draft) {
                try self.current(revision)
                guard try self.readSaved() == draft else { throw Failure.changedRequest }
            }
            try current(revision)
            if let observedReceipt, observedReceipt.requestId == draft.requestId, observedReceipt != response.receipt {
                throw APIError.invalidResponse
            }
            observedReceipt = response.receipt
            var confirmed = draft
            confirmed.confirmed = response.receipt
            try store.save(confirmed, scope: scope, matching: draft)
            pending = confirmed
            // Keep the receipt durable while a fresh source/current state is read.
            let (task, state) = try await currentSource(revision)
            self.task = task
            self.state = state
            applyFields()
        } catch { record(error, revision: revision) }
    }

    func acknowledge() async {
        guard let original = pending, original.confirmed != nil || canDismiss, begin() else { return }
        let revision = activationRevision
        defer { finish() }
        do {
            let (task, state) = try await currentSource(revision)
            guard try readSaved() == original else { throw Failure.changedRequest }
            try current(revision)
            try store.clear(scope: scope, matching: original)
            pending = nil
            observedReceipt = nil
            self.task = task
            self.state = state
            applyFields()
        } catch { record(error, revision: revision) }
    }

    private func begin() -> Bool {
        guard isActive, !busy, !loading, state != nil, Self.active.insert(scope).inserted else { return false }
        busy = true
        error = nil
        canDismiss = false
        return true
    }

    private func finish() {
        busy = false
        Self.active.remove(scope)
        if reloadQueued, isActive {
            reloadQueued = false
            let revision = activationRevision
            Task { await self.activate(ifCurrent: revision) }
        }
    }

    private func current(_ revision: Int) throws {
        try access.requireCurrent(revision)
        guard visible else { throw CancellationError() }
    }

    private func readSaved() throws -> HomeTaskRecurrenceDraft? {
        do {
            let saved = try store.load(scope: scope)
            guard saved == nil || saved?.matches(origin: origin, home: access.homeId, task: taskId, actor: actor) == true else {
                throw Failure.storage
            }
            return saved
        } catch { throw Failure.storage }
    }

    private func applyFields() {
        let command = pending?.confirmed == nil ? pending?.command : nil
        frequency = command?.frequency ?? state?.configuration?.frequency ?? .weekly
        interval = String(command?.interval ?? state?.configuration?.interval ?? 1)
        timezone = command?.timezone ?? state?.configuration?.timezone ?? "UTC"
    }

    private func record(_ failure: any Error, revision: Int) {
        guard visible else { return }
        guard isCurrent else { retire()
            return
        }
        guard revision == activationRevision else { return }
        error = failure.localizedDescription
        if Self.accessEnded(failure) || failure as? Failure == .changedSource {
            task = nil
            state = nil
        }
        if case let APIError.clientError(status, body) = failure {
            canDismiss = (status == 409 && APIError.code(in: body) == "HOME_TASK_RECURRENCE_STALE")
                || (status == 400 && APIError.code(in: body) == "HOME_RECORD_INVALID")
        }
    }

    private static func accessEnded(_ failure: any Error) -> Bool {
        if failure as? HomeTaskAccess.AccessError == .denied { return true }
        switch failure {
        case APIError.unauthorized, APIError.forbidden, APIError.notFound: return true
        case let APIError.clientError(status, _): return [401, 403, 404].contains(status)
        default: return false
        }
    }

    func suspend() {
        visible = false
        access.invalidatePending()
        task = nil
        state = nil
        pending = nil
        loading = false
        canDismiss = false
        error = nil
        reloadQueued = false
    }

    func retire() {
        suspend()
        access.retire()
        error = HomeTaskAccess.AccessError.changed.localizedDescription
    }
}
