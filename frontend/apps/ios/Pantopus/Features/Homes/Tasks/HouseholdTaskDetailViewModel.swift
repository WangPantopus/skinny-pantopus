import Foundation
import Observation

@Observable
@MainActor
final class HouseholdTaskDetailViewModel {
    private(set) var task: HomeTaskDTO?
    private(set) var loading = false
    private(set) var error: String?
    private(set) var acting = false
    private let taskId: String
    private let access: HomeTaskAccess
    private var generation = 0
    private var visible = false
    private var pendingReload = false
    private var mountedViews = Set<UUID>()
    private var readTask: (revision: Int, task: Task<Void, Never>)?

    var isCurrent: Bool {
        access.isCurrent
    }

    init(homeId: String, taskId: String, api: APIClient = .shared, access: HomeTaskAccess? = nil) {
        self.taskId = taskId
        self.access = access ?? HomeTaskAccess(homeId: homeId, api: api)
    }

    var activationRevision: Int {
        generation
    }

    func attachView() -> UUID {
        let owner = UUID()
        mountedViews.insert(owner)
        return owner
    }

    /// A replacement can temporarily mount two copies sharing this model.
    /// Only the last departure ends the screen's authority and pending read.
    @discardableResult
    func detachView(_ owner: UUID) -> Bool {
        guard mountedViews.remove(owner) != nil else { return false }
        guard mountedViews.isEmpty else { return false }
        suspend()
        return true
    }

    func resume(ifCurrent revision: Int) async {
        guard revision == generation else { return }
        await load()
    }

    func load() async {
        guard !Task.isCancelled else { return }
        if let readTask {
            await readTask.task.value
            return
        }
        visible = true
        if acting { pendingReload = true
            return
        }
        generation += 1
        let revision = generation
        loading = true
        task = nil
        error = nil
        // The model owns this read. Canceling one view-bound waiter must not
        // cancel the read still needed by another mounted copy.
        let operation = Task { [weak self] in
            guard let self else { return }
            await fetch(revision: revision)
            if readTask?.revision == revision { readTask = nil }
        }
        readTask = (revision, operation)
        await operation.value
    }

    private func fetch(revision: Int) async {
        do {
            let current = try await access.detail(taskId: taskId)
            guard revision == generation else { return }
            task = current
        } catch {
            guard revision == generation else { return }
            self.error = error.localizedDescription
        }
        if revision == generation { loading = false }
    }

    func accessChanged() {
        if !isCurrent { retire() }
    }

    func edit(onAllowed: @MainActor () -> Void) async {
        guard visible, !acting, isCurrent, task?.capabilities?.canEdit == true else { return }
        acting = true
        generation += 1
        let revision = generation
        defer { finishAction() }
        do {
            let current = try await access.detail(taskId: taskId)
            guard visible, revision == generation, isCurrent else { return }
            guard current.capabilities?.canEdit == true else { throw HomeTaskAccess.AccessError.denied }
            task = current
            onAllowed()
        } catch {
            guard revision == generation else { return }
            task = nil
            self.error = error.localizedDescription
        }
    }

    func toggleDone() async {
        guard visible, !acting, isCurrent, let task, task.capabilities?.canComplete == true else { return }
        acting = true
        generation += 1
        let revision = generation
        error = nil
        defer { finishAction() }
        do {
            let current = try await access.complete(taskId: taskId, status: task.status == "done" ? "open" : "done") {
                guard self.visible, revision == self.generation, self.isCurrent else { throw CancellationError() }
            }
            guard visible, revision == generation, isCurrent else { return }
            self.task = current
        } catch {
            guard visible, revision == generation else { return }
            self.task = nil
            self.error = error.localizedDescription
        }
    }

    private func finishAction() {
        acting = false
        if pendingReload, visible {
            pendingReload = false
            let revision = generation
            Task { [weak self] in
                guard let self, visible else { return }
                await resume(ifCurrent: revision)
            }
        }
    }

    func suspend() {
        visible = false
        generation += 1
        access.invalidatePending()
        readTask?.task.cancel()
        readTask = nil
        task = nil
        loading = false
    }

    func retire() {
        visible = false
        generation += 1
        access.retire()
        readTask?.task.cancel()
        readTask = nil
        task = nil
        loading = false
        error = HomeTaskAccess.AccessError.changed.localizedDescription
    }
}
