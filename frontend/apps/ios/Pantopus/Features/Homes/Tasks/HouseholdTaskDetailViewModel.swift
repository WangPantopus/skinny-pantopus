import Foundation
import Observation
#if DEBUG
import OSLog
#endif

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
    #if DEBUG
    private static let lifecycleLogger = Logger(subsystem: "app.pantopus", category: "HomeTaskDetailLifecycle")
    #endif

    var isCurrent: Bool {
        access.isCurrent
    }

    init(homeId: String, taskId: String, api: APIClient = .shared, access: HomeTaskAccess? = nil) {
        self.taskId = taskId
        self.access = access ?? HomeTaskAccess(homeId: homeId, api: api)
        traceLifecycle("init")
    }

    var activationRevision: Int {
        generation
    }

    func resume(ifCurrent revision: Int) async {
        traceLifecycle("resume", expectedRevision: revision)
        guard revision == generation else { return }
        await load()
    }

    func load() async {
        traceLifecycle("load.enter")
        defer { traceLifecycle("load.exit") }
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
        traceLifecycle("load.read", expectedRevision: revision)
        do {
            let current = try await access.detail(taskId: taskId)
            traceLifecycle("load.response", expectedRevision: revision)
            guard revision == generation else { return }
            task = current
            traceLifecycle("load.applied", expectedRevision: revision)
        } catch {
            traceLifecycle(error is CancellationError ? "load.cancel" : "load.error", expectedRevision: revision)
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
        task = nil
        loading = false
        traceLifecycle("suspend")
    }

    func retire() {
        visible = false
        generation += 1
        access.retire()
        task = nil
        loading = false
        error = HomeTaskAccess.AccessError.changed.localizedDescription
        traceLifecycle("retire")
    }

    /// Temporary native diagnosis: constants and lifecycle state only. Never
    /// include record IDs, titles, response bodies, session values or tokens.
    func traceLifecycle(
        _ event: StaticString,
        expectedRevision: Int = -1,
        viewVisible: Bool? = nil,
        sceneActive: Bool? = nil
    ) {
        #if DEBUG
        let instance = String(describing: ObjectIdentifier(self))
        let revision = generation
        let current = isCurrent
        let modelVisible = visible
        let view = viewVisible.map(String.init) ?? "unknown"
        let scene = sceneActive.map(String.init) ?? "unknown"
        Self.lifecycleLogger.notice(
            """
            event=\(event.description, privacy: .public) instance=\(instance, privacy: .public) \
            generation=\(revision) expected=\(expectedRevision) current=\(current) visible=\(modelVisible) \
            viewVisible=\(view, privacy: .public) sceneActive=\(scene, privacy: .public) cancel=\(Task.isCancelled)
            """
        )
        #endif
    }
}
