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

    func resume(ifCurrent revision: Int) async {
        guard revision == generation else { return }
        await load()
    }

    func load() async {
        guard !Task.isCancelled else { return }
        visible = true
        if acting { pendingReload = true
            return
        }
        generation += 1
        let revision = generation
        loading = true
        task = nil
        error = nil
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
        defer {
            acting = false
            if pendingReload, visible {
                pendingReload = false
                let revision = generation
                Task { [weak self] in
                    guard let self, self.visible else { return }
                    await self.resume(ifCurrent: revision)
                }
            }
        }
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

    func suspend() {
        visible = false
        generation += 1
        access.invalidatePending()
        task = nil
        loading = false
    }

    func retire() {
        visible = false
        generation += 1
        access.retire()
        task = nil
        loading = false
        error = HomeTaskAccess.AccessError.changed.localizedDescription
    }
}
