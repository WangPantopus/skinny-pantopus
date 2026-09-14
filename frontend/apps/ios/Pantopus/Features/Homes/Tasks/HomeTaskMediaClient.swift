import Foundation

/// Private bytes use the same current Home/task/session boundary as task detail.
@MainActor
final class HomeTaskMediaClient {
    private let api: APIClient
    private let uploader: MultipartUploader
    private let access: HomeTaskAccess
    let taskId: String
    private var mutating = false

    init(
        homeId: String,
        taskId: String,
        api: APIClient = .shared,
        uploader: MultipartUploader = .shared,
        access: HomeTaskAccess? = nil
    ) {
        self.api = api
        self.uploader = uploader
        self.access = access ?? HomeTaskAccess(homeId: homeId, api: api)
        self.taskId = taskId
    }

    var isCurrent: Bool {
        access.isCurrent && api.apiBaseURL == uploader.apiBaseURL
    }

    var actorId: String? {
        access.openingActorId
    }

    var revision: Int {
        access.lifecycleRevision
    }

    func suspend() {
        access.invalidatePending()
    }

    func retire() {
        access.retire()
    }

    func requireCurrent(_ revision: Int? = nil) throws {
        guard isCurrent else { retire()
            throw HomeTaskAccess.AccessError.changed
        }
        try access.requireCurrent(revision)
    }

    func list() async throws -> HomeTaskMediaList {
        let revision = revision
        try requireCurrent(revision)
        _ = try await access.detail(taskId: taskId)
        try requireCurrent(revision)
        let result: HomeTaskMediaList = try await api.request(endpoint())
        try requireCurrent(revision)
        let task = try await access.detail(taskId: taskId)
        try requireCurrent(revision)
        guard result.media.allSatisfy({ $0.matches(home: access.homeId, task: taskId) }),
              Set(result.media.map(\.id)).count == result.media.count else { throw APIError.invalidResponse }
        return HomeTaskMediaList(media: result.media, canUpload: result.canUpload && task.capabilities?.canUpload == true)
    }

    func upload(_ pending: PendingHomeTaskUpload) async throws -> HomeTaskMediaDTO {
        guard !mutating else { throw HomeTaskAccess.AccessError.busy }
        mutating = true
        defer { mutating = false }
        let revision = revision
        let before = try await list()
        try requireCurrent(revision)
        guard before.canUpload else { throw HomeTaskAccess.AccessError.denied }
        guard UUID(uuidString: pending.id) != nil, !pending.file.data.isEmpty,
              pending.file.data.count <= CLAIM_FILE_MAX_BYTES,
              PrivateClaimEvidenceClient.allowedMIMEs.contains(pending.file.mimeType) else { throw APIError.invalidResponse }
        let result = try await uploader.uploadHomeTaskMedia(
            homeId: access.homeId,
            taskId: taskId,
            uploadId: pending.id,
            headers: access.currentHeaders,
            file: MultipartFile(
                fieldName: "file",
                filename: pending.serverFilename,
                mimeType: pending.file.mimeType,
                data: pending.file.data
            )
        )
        try requireCurrent(revision)
        guard result.media.count == 1, let record = result.media.first,
              record.matches(home: access.homeId, task: taskId), record.id == pending.id,
              record.uploadedBy == actorId, record.fileName == pending.serverFilename,
              record.fileSize == pending.file.data.count, record.mimeType == pending.file.mimeType,
              record.state == "ready", record.available else { throw APIError.invalidResponse }
        let after = try await list()
        try requireCurrent(revision)
        guard after.media.contains(record) else { throw APIError.invalidResponse }
        return record
    }

    func download(_ record: HomeTaskMediaDTO) async throws -> Data {
        let revision = revision
        let before = try await list()
        try requireCurrent(revision)
        try requireDownload(record, current: before)
        let result = try await api.requestDataResponse(endpoint(id: record.id, suffix: "/download"))
        try requireCurrent(revision)
        let after = try await list()
        try requireCurrent(revision)
        try requireDownload(record, current: after)
        guard result.data.count == record.fileSize, result.response.mimeType == record.mimeType else { throw APIError.invalidResponse }
        return result.data
    }

    private func requireDownload(_ record: HomeTaskMediaDTO, current: HomeTaskMediaList) throws {
        guard record.available, record.state == "ready", current.media.contains(record) else { throw APIError.invalidResponse }
    }

    func remove(_ record: HomeTaskMediaDTO) async throws -> HomeTaskMediaDTO {
        guard !mutating else { throw HomeTaskAccess.AccessError.busy }
        mutating = true
        defer { mutating = false }
        let revision = revision
        let before = try await list()
        try requireCurrent(revision)
        guard before.canUpload else { throw HomeTaskAccess.AccessError.denied }
        guard record.matches(home: access.homeId, task: taskId), record.state != "legacy" else { throw APIError.invalidResponse }
        if let current = before.media.first(where: { $0.id == record.id }), !current.sameFile(as: record) { throw APIError.invalidResponse }
        let result: HomeTaskMediaRemoval = try await api.request(endpoint(id: record.id, method: .delete))
        try requireCurrent(revision)
        guard result.media.sameFile(as: record), result.media.state == "retired", !result.media.available,
              result.media.cleanupPending == false else { throw APIError.invalidResponse }
        let after = try await list()
        try requireCurrent(revision)
        if let current = after.media.first(where: { $0.id == record.id }) {
            guard current.sameFile(as: record), current.state == "retired", !current.available,
                  current.cleanupPending == false else { throw APIError.invalidResponse }
        }
        return result.media
    }

    private func endpoint(id: String? = nil, suffix: String = "", method: Endpoint.Method = .get) -> Endpoint {
        Endpoint(
            method: method,
            path: "/api/upload/home-task-media/\(access.homeId)/\(taskId)" + (id.map { "/\($0)" } ?? "") + suffix,
            headers: access.currentHeaders,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        )
    }
}
