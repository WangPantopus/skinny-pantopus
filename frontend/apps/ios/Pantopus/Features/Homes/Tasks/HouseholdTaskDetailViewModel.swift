import Foundation
import Observation

@Observable
@MainActor
final class HouseholdTaskDetailViewModel {
    private(set) var task: HomeTaskDTO?
    private(set) var loading = false
    private(set) var error: String?
    private(set) var acting = false
    /// "You", a member's name, or the short "Member 1A2B" label; nil when nobody is assigned.
    private(set) var assignee: String?
    private let taskId: String
    private let access: HomeTaskAccess
    private var generation = 0
    private var visible = false
    private var pendingReload = false
    private var mountedViews = Set<UUID>()
    private var readTask: (revision: Int, task: Task<Void, Never>)?
    /// Members' names by user id; nil until read, empty when the viewer may not list members.
    private var memberNames: [String: String]?
    private var namesRead: Task<Void, Never>?
    private var namesToken = 0

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
            show(current)
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
            show(current)
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
            show(current)
        } catch {
            guard visible, revision == generation else { return }
            self.task = nil
            self.error = error.localizedDescription
        }
    }

    private func show(_ current: HomeTaskDTO) {
        task = current
        assignee = assigneeLabel(current)
        loadMemberNames(for: current)
    }

    private func assigneeLabel(_ task: HomeTaskDTO) -> String? {
        guard let id = task.assignedTo, !id.isEmpty else { return nil }
        if id == access.openingActorId { return "You" }
        return memberNames?[id] ?? "Member \(id.prefix(4).uppercased())"
    }

    /// Only for someone else's task; a viewer who may not list members keeps the short label.
    private func loadMemberNames(for task: HomeTaskDTO) {
        guard memberNames == nil, namesRead == nil, let id = task.assignedTo, !id.isEmpty,
              id != access.openingActorId else { return }
        namesToken += 1
        let token = namesToken
        let access = access
        namesRead = Task { [weak self] in
            let names: [String: String]?
            do {
                let response = try await access.occupants()
                names = Dictionary(
                    response.occupants.compactMap(HouseholdTaskAssignableMember.from).map { ($0.id, $0.displayName) }
                ) { first, _ in first }
            } catch APIError.forbidden {
                names = [:] // A refusal won't change on retry; other failures try again on the next read.
            } catch {
                names = nil
            }
            guard let self, token == namesToken else { return }
            namesRead = nil
            if let names { memberNames = names }
            // Whatever task is shown now (a completion may have replaced it) gets the name.
            if visible, isCurrent, let shown = self.task { assignee = assigneeLabel(shown) }
        }
    }

    private func cancelNames() {
        namesToken += 1
        namesRead?.cancel()
        namesRead = nil
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
        cancelNames()
        task = nil
        assignee = nil
        loading = false
    }

    func retire() {
        visible = false
        generation += 1
        access.retire()
        readTask?.task.cancel()
        readTask = nil
        cancelNames()
        memberNames = nil
        task = nil
        assignee = nil
        loading = false
        error = HomeTaskAccess.AccessError.changed.localizedDescription
    }
}
