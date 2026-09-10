import Foundation

/// Current record permissions include the exact private-creator first-use path.
/// Generic Home membership and inferred owner roles are not task authority.
@MainActor
final class HomeTaskAccess: HomeTaskCreationAccess {
    enum AccessError: LocalizedError, Equatable {
        case changed
        case denied
        case busy

        var errorDescription: String? {
            switch self {
            case .changed: "Your session changed. Reopen Tasks to continue."
            case .denied: "You don't have permission for this task action."
            case .busy: "Wait for the current task action to finish."
            }
        }
    }

    let homeId: String
    private let api: APIClient
    private let scope: HomeClaimSessionScope
    private let actorId: String?
    private var serverSession: String?
    private var retired = false
    private var mutating = false
    private var generation = 0

    init(homeId: String, api: APIClient = .shared, actorId: String? = nil, identity: (() -> String?)? = nil) {
        self.homeId = homeId
        self.api = api
        scope = HomeClaimSessionScope(api: api, identity: identity)
        if let actorId {
            self.actorId = actorId
        } else if case let .signedIn(user) = (api.authProvider ?? AuthManager.shared).state {
            self.actorId = user.id
        } else {
            self.actorId = nil
        }
    }

    var isCurrent: Bool {
        !retired && actorId != nil && scope.isCurrent
    }

    var lifecycleRevision: Int {
        generation
    }

    var openingActorId: String? {
        actorId
    }

    var currentHeaders: [String: String] {
        serverSession.map { ["X-Pantopus-Session-Scope": $0] } ?? [:]
    }

    func invalidatePending() {
        generation += 1
    }

    func retire() {
        invalidatePending()
        retired = true
        serverSession = nil
    }

    func requireCurrent(_ revision: Int? = nil) throws {
        if let revision, revision != generation { throw CancellationError() }
        guard isCurrent else { retire()
            throw AccessError.changed
        }
        guard UUID(uuidString: homeId) != nil else { throw APIError.invalidResponse }
        try Task.checkCancellation()
    }

    func list() async throws -> GetHomeTasksResponse {
        let revision = generation
        try requireCurrent(revision)
        let result: GetHomeTasksResponse = try await api.request(endpoint())
        try requireCurrent(revision)
        try bind(result.taskSession)
        guard result.collectionCapabilities != nil,
              result.tasks.allSatisfy({ valid($0) }), Set(result.tasks.map(\.id)).count == result.tasks.count else {
            throw APIError.invalidResponse
        }
        return result
    }

    func detail(taskId: String) async throws -> HomeTaskDTO {
        let revision = generation
        try requireCurrent(revision)
        guard UUID(uuidString: taskId) != nil else { throw APIError.invalidResponse }
        let result: HomeTaskResponse = try await api.request(endpoint(taskId: taskId))
        try requireCurrent(revision)
        try bind(result.taskSession)
        guard valid(result.task), result.task.id == taskId else { throw APIError.invalidResponse }
        return result.task
    }

    func complete(taskId: String, status: String) async throws -> HomeTaskDTO {
        let revision = generation
        guard !mutating else { throw AccessError.busy }
        mutating = true
        defer { mutating = false }
        let before = try await detail(taskId: taskId)
        guard before.capabilities?.canComplete == true, ["open", "done"].contains(status) else { throw AccessError.denied }
        try requireCurrent(revision)
        let result: HomeTaskResponse = try await api.request(endpoint(
            taskId: taskId,
            method: .put,
            body: UpdateHomeTaskRequest(status: status)
        ))
        try requireCurrent(revision)
        guard valid(result.task), result.task.id == taskId, result.task.status == status else { throw APIError.invalidResponse }
        return try await detail(taskId: taskId)
    }

    func delete(taskId: String) async throws {
        let revision = generation
        guard !mutating else { throw AccessError.busy }
        mutating = true
        defer { mutating = false }
        let before = try await detail(taskId: taskId)
        guard before.capabilities?.canDelete == true else { throw AccessError.denied }
        try requireCurrent(revision)
        let result: DeleteResult = try await api.request(endpoint(taskId: taskId, method: .delete))
        try requireCurrent(revision)
        guard result.message == "Task deleted" else { throw APIError.invalidResponse }
    }

    func create(_ draft: HomeTaskCreateDraft) async throws -> HomeTaskCreationResult {
        let revision = generation
        guard !mutating else { throw AccessError.busy }
        mutating = true
        defer { mutating = false }
        let collection = try await list()
        guard collection.collectionCapabilities?.canCreate == true,
              let actorId, draft.matches(home: homeId, actor: actorId) else { throw AccessError.denied }
        try requireCurrent(revision)
        let result: HomeTaskCreationResult = try await api.request(endpoint(method: .post, body: HomeTaskCreateDraft.Command(draft: draft)))
        try requireCurrent(revision)
        try bind(result.taskSession)
        guard valid(result.task), result.receipt.matches(draft, task: result.task) else { throw APIError.invalidResponse }
        return result
    }

    func edit(taskId: String, patch: HomeTaskEditPatch) async throws -> HomeTaskDTO {
        let revision = generation
        guard !mutating else { throw AccessError.busy }
        mutating = true
        defer { mutating = false }
        let before = try await detail(taskId: taskId)
        guard before.capabilities?.canEdit == true, !patch.values.isEmpty else { throw AccessError.denied }
        try requireCurrent(revision)
        let result: HomeTaskResponse = try await api.request(endpoint(taskId: taskId, method: .put, body: patch))
        try requireCurrent(revision)
        guard valid(result.task), result.task.id == taskId, patch.matches(result.task) else { throw APIError.invalidResponse }
        return try await detail(taskId: taskId)
    }

    private struct DeleteResult: Decodable {
        let message: String
    }

    func recurrence(taskId: String) async throws -> HomeTaskRecurrenceState {
        let revision = generation
        try requireCurrent(revision)
        guard UUID(uuidString: taskId) != nil else { throw APIError.invalidResponse }
        let result: HomeTaskRecurrenceState = try await api.request(recurrenceEndpoint(taskId: taskId))
        try requireCurrent(revision)
        try bind(result.taskSession)
        guard result.matches(home: homeId, task: taskId) else { throw APIError.invalidResponse }
        return result
    }

    func changeRecurrence(
        _ draft: HomeTaskRecurrenceDraft,
        beforeDispatch: @MainActor () throws -> Void
    ) async throws -> HomeTaskRecurrenceResponse {
        let revision = generation
        guard !mutating else { throw AccessError.busy }
        mutating = true
        defer { mutating = false }
        let current = try await recurrence(taskId: draft.taskId)
        guard current.canManage else { throw AccessError.denied }
        guard let actorId, draft.matches(origin: api.apiBaseURL.absoluteString, home: homeId, task: draft.taskId, actor: actorId) else {
            throw APIError.invalidResponse
        }
        try beforeDispatch()
        try requireCurrent(revision)
        let result: HomeTaskRecurrenceResponse = try await api.request(recurrenceEndpoint(
            taskId: draft.taskId, body: HomeTaskRecurrenceDraft.Request(draft: draft)
        ))
        try requireCurrent(revision)
        try bind(result.state.taskSession)
        guard result.state.matches(home: homeId, task: draft.taskId), result.receipt.matches(draft),
              result.state.revision >= result.receipt.revision,
              draft.confirmed == nil || draft.confirmed == result.receipt else { throw APIError.invalidResponse }
        return result
    }

    private func recurrenceEndpoint(taskId: String, body: (any Encodable & Sendable)? = nil) -> Endpoint {
        Endpoint(
            method: body == nil ? .get : .post,
            path: "/api/homes/\(homeId)/tasks/\(taskId)/recurrence",
            body: body,
            headers: currentHeaders,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        )
    }

    private func valid(_ task: HomeTaskDTO) -> Bool {
        UUID(uuidString: homeId) != nil && UUID(uuidString: task.id) != nil && task.homeId == homeId
            && ["open", "in_progress", "done", "canceled"].contains(task.status)
            && (task.automaticRecurrence?.valid ?? true)
    }

    private func bind(_ session: HomeTaskSession?) throws {
        guard let session, let actorId, session.matches(homeId: homeId, actorId: actorId),
              serverSession == nil || serverSession == session.sessionScope else {
            retire()
            throw AccessError.changed
        }
        serverSession = session.sessionScope
    }

    private func endpoint(taskId: String? = nil, method: Endpoint.Method = .get, body: (any Encodable & Sendable)? = nil) -> Endpoint {
        Endpoint(
            method: method,
            path: "/api/homes/\(homeId)/tasks" + (taskId.map { "/\($0)" } ?? ""),
            body: body,
            headers: currentHeaders,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        )
    }
}
