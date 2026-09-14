import Foundation
import Observation

/// State for the wizard's existing Attach/remove controls. Draft bytes and the
/// upload identity survive an explicit retry only inside the opening session.
@Observable
@MainActor
final class VerifyLandlordLeaseAttachment {
    var showsPicker = false
    private(set) var isBusy = false
    private(set) var errorMessage: String?
    private(set) var file: TenantLeaseFile?
    private(set) var pickedFile: PickedFile?
    private let homeId: String
    private let actorId: String?
    private let api: APIClient
    private let uploader: MultipartUploader
    private let scope: HomeClaimSessionScope
    private var serverSession: TenantLeaseFileSession?
    private var context: TenantRequestContext?
    private(set) var uploadId: String?
    private var generation = 0
    private var pickerGeneration: Int?
    private var removalPending = false
    @ObservationIgnored private var work: Task<Void, Never>?

    init(homeId: String, api: APIClient, uploader: MultipartUploader = .shared, actorId: String? = nil, identity: (() -> String?)? = nil) {
        self.homeId = homeId
        self.api = api
        self.uploader = uploader
        scope = HomeClaimSessionScope(api: api, identity: identity)
        if let actorId {
            self.actorId = actorId
        } else if case let .signedIn(user) = (api.authProvider ?? AuthManager.shared).state {
            self.actorId = user.id
        } else {
            self.actorId = nil
        }
    }

    var hasDraft: Bool {
        pickedFile != nil
    }

    var needsRetry: Bool {
        hasDraft && (file == nil || removalPending) && !isBusy
    }

    var retryLabel: String {
        removalPending ? "Retry removal" : "Retry attachment"
    }

    var displayFile: VerifyLandlordLeaseFile? {
        guard scope.isCurrent, let pickedFile else { return nil }
        let name = file?.fileName ?? pickedFile.filename
        let size = file?.fileSize ?? pickedFile.data?.count ?? 0
        return VerifyLandlordLeaseFile(
            filename: name,
            sizeLabel: ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file),
            pageCount: nil,
            detectedOwner: nil,
            detectedUnit: nil,
            typeLabel: pickedFile.mimeType == "application/pdf" ? "PDF" : (pickedFile.mimeType == "text/plain" ? "TXT" : "IMG"),
            uploadStatus: removalPending ? (isBusy ? "Removing…" : "Removal unconfirmed")
                : (file != nil ? "Uploaded privately" : (isBusy ? "Uploading…" : "Upload unconfirmed")),
            reviewNote: file != nil && !removalPending ? "Shared with the verified property owner when you submit."
                : "Retry the attachment or remove it before submitting."
        )
    }

    func choose() {
        guard scope.isCurrent, !isBusy, !hasDraft else { return }
        errorMessage = nil
        pickerGeneration = generation
        showsPicker = true
    }

    func received(_ result: Result<[URL], any Error>) {
        guard pickerGeneration == generation, scope.isCurrent else { return }
        pickerGeneration = nil
        showsPicker = false
        switch result {
        case let .success(urls):
            guard let url = urls.first else { return }
            run { current in
                let picked = try await Task.detached(priority: .userInitiated) { try DocumentFileReader.read(url) }.value
                try self.requireCurrent(current)
                try self.select(picked)
                try await self.upload(current)
            }
        case let .failure(error):
            if (error as NSError).code != NSUserCancelledError { errorMessage = "Couldn't read that file. Choose it again." }
        }
    }

    /// Selection is local; no request, claim or membership is created here.
    func select(_ picked: PickedFile) throws {
        try requireCurrent(generation)
        guard !hasDraft, let data = picked.data, !data.isEmpty, data.count <= TenantLeaseFile.maxBytes,
              let mime = picked.mimeType, TenantLeaseFile.allowedMIMEs.contains(mime) else {
            throw APIError.clientError(status: 400, message: "Choose a nonempty PDF, text file or supported image of 25 MB or less.")
        }
        let name = picked.filename.precomposedStringWithCanonicalMapping
            .replacingOccurrences(of: "[\\x00-\\x1f\\x7f/\\\\\"]", with: "_", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name.utf16.count <= 255 else { throw APIError.invalidResponse }
        pickedFile = PickedFile(filename: name, sizeBytes: Int64(data.count), mimeType: mime, data: data)
        uploadId = UUID().uuidString.lowercased()
    }

    func retry() {
        if removalPending { remove() } else { run { try await self.upload($0) } }
    }

    func remove() {
        guard hasDraft, !isBusy, scope.isCurrent else { return }
        removalPending = true
        run { current in
            guard let id = self.uploadId else { return }
            if self.context != nil {
                let session = try await self.session(current)
                do {
                    let result: TenantLeaseFileRemoval = try await self.api.request(TenantEndpoints.leaseFile(
                        homeId: self.homeId, suffix: id, headers: session.headers, method: .delete
                    ))
                    guard result.deleted else { throw APIError.invalidResponse }
                } catch APIError.notFound { /* The draft was never reserved or is already gone. */ }
            }
            try self.requireCurrent(current)
            self.clearDraft()
        }
    }

    func retirePendingWork() {
        generation &+= 1
        work?.cancel()
        work = nil
        isBusy = false
        showsPicker = false
        pickerGeneration = nil
    }

    func clear() {
        retirePendingWork()
        clearDraft()
        serverSession = nil
        errorMessage = nil
    }

    private func clearDraft() {
        pickedFile = nil
        uploadId = nil
        file = nil
        context = nil
        removalPending = false
    }

    private func requireCurrent(_ current: Int) throws {
        try Task.checkCancellation()
        guard generation == current, scope.isCurrent, actorId != nil, UUID(uuidString: homeId) != nil,
              api.apiBaseURL == uploader.apiBaseURL else { throw APIError.unauthorized }
    }

    private func run(_ operation: @escaping @MainActor (Int) async throws -> Void) {
        guard !isBusy, scope.isCurrent else { return }
        let current = generation
        isBusy = true
        errorMessage = nil
        work = Task { [weak self] in
            guard let self else { return }
            defer { if generation == current { isBusy = false } }
            do { try requireCurrent(current)
                try await operation(current)
            } catch {
                guard generation == current, scope.isCurrent, !Task.isCancelled else { return }
                errorMessage = "Couldn't confirm the attachment. Retry or remove it before submitting."
                if case let APIError.clientError(_, message) = error { errorMessage = message }
            }
        }
    }

    private func session(_ current: Int) async throws -> TenantLeaseFileSession {
        try requireCurrent(current)
        let result: TenantLeaseFileSession = try await api.request(TenantEndpoints.leaseFile(
            homeId: homeId, suffix: "session", headers: serverSession?.headers ?? [:]
        ))
        try requireCurrent(current)
        guard result.matches(home: homeId, actor: actorId ?? ""),
              serverSession == nil || result.sessionScope == serverSession?.sessionScope else { throw APIError.unauthorized }
        serverSession = result
        return result
    }

    private func upload(_ current: Int) async throws {
        try requireCurrent(current)
        guard let pickedFile, let data = pickedFile.data, let mime = pickedFile.mimeType, let uploadId else { return }
        let session = try await session(current)
        if context == nil {
            let status: TenantHomeStatusResponse = try await api.request(TenantEndpoints.homeStatus(homeId: homeId))
            try requireCurrent(current)
            guard status.matches(homeId: homeId), status.requestContext.actorId == actorId,
                  status.lease?.state != .pending, status.lease?.state != .active else { throw APIError.invalidResponse }
            context = status.requestContext
        }
        guard let context else { throw APIError.invalidResponse }
        let result = try await uploader.uploadLeaseFile(
            scope: session,
            uploadId: uploadId,
            context: context,
            file: MultipartFile(
                fieldName: "file",
                filename: pickedFile.filename,
                mimeType: mime,
                data: data
            )
        )
        try requireCurrent(current)
        guard result.file.matches(home: homeId, file: uploadId), result.file.fileName == pickedFile.filename,
              result.file.fileSize == data.count, result.file.mimeType == mime, result.file.leaseId == nil else {
            throw APIError.invalidResponse
        }
        file = result.file
    }

    func requestApproval(_ request: TenantRequestApprovalRequest) async throws -> TenantLeaseDTO {
        let current = generation
        try requireCurrent(current)
        guard !removalPending, let file, let context, file.id == uploadId, request.homeId == homeId else { throw APIError.invalidResponse }
        let session = try await session(current)
        let bound = TenantRequestApprovalRequest(
            homeId: homeId,
            startAt: request.startAt,
            endAt: request.endAt,
            message: request.message,
            requestContext: context,
            leaseFileId: file.id
        )
        let result: TenantRequestApprovalResponse = try await api.request(TenantEndpoints.requestApproval(bound, headers: session.headers))
        try requireCurrent(current)
        guard result.lease.homeId == homeId, UUID(uuidString: result.lease.id) != nil,
              result.lease.metadata?.leaseFileId == file.id, [.pending, .active].contains(result.lease.state) else {
            throw APIError.invalidResponse
        }
        return result.lease
    }
}
