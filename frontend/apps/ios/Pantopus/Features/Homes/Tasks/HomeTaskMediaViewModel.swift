import Foundation
import Observation

@Observable
@MainActor
final class HomeTaskMediaViewModel: Identifiable {
    nonisolated let id = UUID()
    struct Preview {
        let record: HomeTaskMediaDTO
        let bytes: Data
    }

    private let client: HomeTaskMediaClient
    private var generation = 0
    private var visible = false
    private var accessConfirmed = false
    private var records: [HomeTaskMediaDTO] = []
    private var canUpload = false
    private var attemptedUpload = false
    private var pendingReload = false
    private(set) var pendingUpload: PendingHomeTaskUpload?
    private(set) var removedUploadId: String?
    private(set) var pendingRemoval: HomeTaskMediaDTO?
    private(set) var preview: Preview?
    private(set) var busy = false
    private(set) var error: String?
    private(set) var notice: String?

    init(homeId: String, taskId: String, client: HomeTaskMediaClient? = nil) {
        self.client = client ?? HomeTaskMediaClient(homeId: homeId, taskId: taskId)
    }

    var isCurrent: Bool {
        client.isCurrent
    }

    var isActive: Bool {
        visible && isCurrent
    }

    var activationRevision: Int {
        generation
    }

    var media: [HomeTaskMediaDTO] {
        visible && isCurrent && accessConfirmed ? records : []
    }

    var visiblePreview: Preview? {
        visible && isCurrent && accessConfirmed ? preview : nil
    }

    var mayChoose: Bool {
        visible && isCurrent && accessConfirmed && canUpload && !busy && pendingUpload == nil && pendingRemoval == nil
    }

    var mayRetryUpload: Bool {
        visible && isCurrent && !busy && pendingUpload != nil && pendingRemoval == nil && removedUploadId == nil
    }

    var mayRetryRemoval: Bool {
        visible && isCurrent && !busy && pendingRemoval != nil
    }

    var mayDiscardUnsent: Bool {
        pendingUpload != nil && !attemptedUpload && !busy
    }

    var mayAcknowledgeRemovedUpload: Bool {
        visible && isCurrent && !busy && removedUploadId != nil && pendingUpload?.id == removedUploadId
    }

    func mayRemove(_ record: HomeTaskMediaDTO) -> Bool {
        visible && isCurrent && accessConfirmed && canUpload && !busy && pendingRemoval == nil && pendingUpload == nil
            && records.contains(record) && record.state != "legacy" && (record.state != "retired" || record.cleanupPending == true)
    }

    func activate(ifCurrent revision: Int) async {
        guard revision == generation, isCurrent, !Task.isCancelled else { return }
        visible = true
        await load()
    }

    func suspend() {
        visible = false
        generation += 1
        client.suspend()
        hideContent()
    }

    func retire() {
        suspend()
        client.retire()
        pendingUpload = nil
        removedUploadId = nil
        pendingRemoval = nil
        attemptedUpload = false
    }

    func load() async {
        guard visible, isCurrent else { return }
        if busy { pendingReload = true
            return
        }
        busy = true
        let revision = generation
        hideContent()
        defer { finish() }
        do {
            let result = try await client.list()
            guard current(revision) else { return }
            accept(result)
            error = nil
        } catch { fail(error, revision: revision) }
    }

    func picked(_ file: ClaimPickedFile, revision: Int) {
        guard mayChoose, revision == generation, !file.data.isEmpty, file.data.count <= CLAIM_FILE_MAX_BYTES,
              PrivateClaimEvidenceClient.allowedMIMEs.contains(file.mimeType) else { return }
        pendingUpload = PendingHomeTaskUpload(id: UUID().uuidString.lowercased(), file: file)
        removedUploadId = nil
        attemptedUpload = false
        notice = nil
    }

    func discardUnsent(id: String) {
        guard mayDiscardUnsent, pendingUpload?.id == id else { return }
        pendingUpload = nil
    }

    func acknowledgeRemovedUpload(id: String) async {
        guard mayAcknowledgeRemovedUpload, removedUploadId == id, pendingUpload?.id == id else { return }
        pendingUpload = nil
        removedUploadId = nil
        attemptedUpload = false
        error = nil
        await load()
    }

    func upload(id: String) async {
        guard mayRetryUpload, let pendingUpload, pendingUpload.id == id else { return }
        busy = true
        attemptedUpload = true
        let revision = generation
        hideContent()
        defer { finish() }
        do {
            let record = try await client.upload(pendingUpload)
            guard current(revision) else { return }
            let result = try await client.list()
            guard current(revision) else { return }
            guard result.media.contains(record) else { throw APIError.invalidResponse }
            accept(result)
            self.pendingUpload = nil
            removedUploadId = nil
            attemptedUpload = false
            error = nil
            notice = "Private attachment saved."
        } catch {
            if current(revision), self.pendingUpload?.id == id,
               case let APIError.clientError(status, message) = error,
               status == 409, APIError.code(in: message) == "HOME_TASK_UPLOAD_RETIRED" {
                removedUploadId = id
            }
            fail(error, revision: revision)
        }
    }

    func open(_ record: HomeTaskMediaDTO) async {
        guard visible, isCurrent, !busy, pendingRemoval == nil, media.contains(record), record.available else { return }
        busy = true
        let revision = generation
        hideContent()
        defer { finish() }
        do {
            let bytes = try await client.download(record)
            guard current(revision) else { return }
            records = [record]
            accessConfirmed = true
            preview = Preview(record: record, bytes: bytes)
            error = nil
        } catch { fail(error, revision: revision) }
    }

    func closePreview() {
        preview = nil
    }

    func remove(_ record: HomeTaskMediaDTO) async {
        guard mayRemove(record) else { return }
        pendingRemoval = record
        await retryRemoval()
    }

    func retryRemoval() async {
        guard mayRetryRemoval, let pendingRemoval else { return }
        busy = true
        let revision = generation
        hideContent()
        defer { finish() }
        do {
            _ = try await client.remove(pendingRemoval)
            guard current(revision) else { return }
            let result = try await client.list()
            guard current(revision) else { return }
            accept(result)
            self.pendingRemoval = nil
            error = nil
            notice = "Attachment removed. Its history remains."
        } catch { fail(error, revision: revision) }
    }

    private func accept(_ result: HomeTaskMediaList) {
        records = result.media
        canUpload = result.canUpload
        accessConfirmed = true
        preview = nil
    }

    private func current(_ revision: Int) -> Bool {
        visible && revision == generation && isCurrent && !Task.isCancelled
    }

    private func finish() {
        busy = false
        guard pendingReload, visible, isCurrent else { return }
        pendingReload = false
        let revision = generation
        Task { [weak self] in
            guard let self, current(revision) else { return }
            await load()
        }
    }

    private func hideContent() {
        records = []
        preview = nil
        accessConfirmed = false
        canUpload = false
    }

    private func fail(_ error: any Error, revision: Int) {
        guard current(revision) else { return }
        hideContent()
        self.error = error.localizedDescription
        notice = nil
    }
}
