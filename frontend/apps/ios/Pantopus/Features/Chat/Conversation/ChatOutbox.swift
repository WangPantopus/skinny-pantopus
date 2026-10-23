import Foundation

/// A conversation may disappear while its request is still running. The signed-in
/// session owns sends, and screens observe them without owning their lifetime.
@MainActor
final class ChatOutbox {
    static let shared = ChatOutbox()

    enum Event { case changed, accepted(ChatMessageDTO) }

    private(set) var messages: [ChatOutboxMessage] = []
    private(set) var restoreFailure: String?
    private var account: String?
    private var scope = ""
    private var version = 0
    private var lifetime = 0
    private var requestGeneration = 0
    private var loadTask: Task<Void, Never>?
    private var socketTask: Task<Void, Never>?
    private var connectionTask: Task<Void, Never>?
    private var wakeTask: Task<Void, Never>?
    private struct Worker {
        let id: UUID
        let messageId: String
        let task: Task<Void, Never>
    }

    private var workers: [String: Worker] = [:]
    private var listeners: [UUID: AsyncStream<Event>.Continuation] = [:]
    private let storage = ChatLocalStore.shared
    private let api = APIClient.shared

    func start(account: String) {
        guard case let .signedIn(user) = AuthManager.shared.state, user.id == account else { return }
        guard self.account != account else { return }
        stop()
        self.account = account
        scope = ChatLocalStore.scope(server: api.apiBaseURL.absoluteString, account: account)
        version = storage.sessionVersion
        requestGeneration = AuthManager.shared.requestSessionGeneration
        let started = lifetime
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let saved = try await storage.loadOutbox(scope: scope, version: version)
                guard lifetime == started else { return }
                messages = saved
                restoreFailure = nil
                publish(.changed)
                pump()
            } catch {
                guard lifetime == started, !Task.isCancelled else { return }
                restoreFailure = "Couldn't restore unsent messages. Reopen the app to try again."
                publish(.changed)
            }
        }
        socketTask = Task { [weak self] in
            let stream = SocketClient.shared.events(
                named: "message:new", as: ChatRealtimeMessageEnvelope.self, keyDecodingStrategy: .useDefaultKeys
            )
            for await event in stream {
                guard let self, lifetime == started else { return }
                confirm(event.message)
            }
        }
        connectionTask = Task { [weak self] in
            for await state in SocketClient.shared.connectionStates() {
                guard let self, lifetime == started else { return }
                guard state == .connected else { continue }
                for index in messages.indices where messages[index].status == .retrying {
                    messages[index].retryAt = nil
                }
                pump()
            }
        }
    }

    func stop() {
        lifetime += 1
        loadTask?.cancel()
        socketTask?.cancel()
        connectionTask?.cancel()
        wakeTask?.cancel()
        for worker in workers.values {
            worker.task.cancel()
        }
        workers.removeAll()
        messages.removeAll()
        account = nil
        restoreFailure = nil
        publish(.changed)
    }

    func events() -> AsyncStream<Event> {
        let id = UUID()
        return AsyncStream { continuation in
            listeners[id] = continuation
            continuation.yield(.changed)
            continuation.onTermination = { [weak self] _ in
                Task { @MainActor in self?.listeners[id] = nil }
            }
        }
    }

    func enqueue(_ message: ChatOutboxMessage, attachments: [ChatQueuedAttachment]) async throws {
        let started = lifetime
        await loadTask?.value
        guard lifetime == started, account != nil else { throw CancellationError() }
        guard restoreFailure == nil else { throw ChatLocalStorageError.unavailable }
        try await storage.enqueue(message, attachments: attachments, scope: scope, version: version)
        guard lifetime == started else { throw CancellationError() }
        messages.append(message)
        messages.sort { $0.queuedAt < $1.queuedAt }
        publish(.changed)
        pump()
    }

    func retry(_ id: String) async {
        guard let index = messages.firstIndex(where: { $0.id == id }), messages[index].status != .refused else { return }
        messages[index].status = .queued
        messages[index].retryAt = nil
        messages[index].failure = nil
        try? await storage.updateOutbox(messages[index], scope: scope, version: version)
        publish(.changed)
        pump()
    }

    func confirm(_ message: ChatMessageDTO) {
        guard let id = message.clientMessageId, let accepted = messages.first(where: { $0.id == id }) else { return }
        messages.removeAll { $0.id == id }
        publish(.accepted(message))
        publish(.changed)
        let version = version
        Task { await storage.removeOutbox(id, version: version) }
        releaseWorker(for: accepted)
        pump()
    }

    func discard(_ id: String) async {
        guard let message = messages.first(where: { $0.id == id }) else { return }
        messages.removeAll { $0.id == id }
        releaseWorker(for: message)
        publish(.changed)
        await storage.removeOutbox(id, version: version)
        pump()
    }

    /// A socket/history acknowledgement is enough to release the next send,
    /// even while the accepted POST response is delayed or lost. Match the
    /// message as well as the thread so discarding a later item leaves the
    /// current send alone; the worker token guards its eventual completion.
    private func releaseWorker(for message: ChatOutboxMessage) {
        guard let worker = workers[message.threadKey], worker.messageId == message.id else { return }
        workers[message.threadKey] = nil
        worker.task.cancel()
    }

    private func publish(_ event: Event) {
        for listener in listeners.values {
            listener.yield(event)
        }
    }

    private func pump() {
        wakeTask?.cancel()
        var visited = Set<String>()
        var nextWake: Date?
        for message in messages where message.status == .queued || message.status == .retrying {
            let thread = message.threadKey
            guard visited.insert(thread).inserted, workers[thread] == nil else { continue }
            if let retryAt = message.retryAt, retryAt > Date() {
                nextWake = min(nextWake ?? retryAt, retryAt)
                continue
            }
            guard workers.count < 3 else { continue }
            let started = lifetime
            let workerId = UUID()
            let task = Task { [weak self] in
                guard let self else { return }
                await transmit(message, lifetime: started)
                guard lifetime == started, workers[thread]?.id == workerId else { return }
                workers[thread] = nil
                pump()
            }
            workers[thread] = Worker(id: workerId, messageId: message.id, task: task)
        }
        if let nextWake {
            wakeTask = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(max(0.1, nextWake.timeIntervalSinceNow))) } catch { return }
                self?.pump()
            }
        }
    }

    private func transmit(_ original: ChatOutboxMessage, lifetime started: Int) async {
        guard lifetime == started, messages.contains(where: { $0.id == original.id }), !Task.isCancelled else { return }
        var message = original
        do {
            if message.roomId == nil {
                if message.destination == .room {
                    message.roomId = message.targetId
                } else {
                    let response: CreateDirectChatResponse = try await api.request(
                        ChatEndpoints.createDirectChat(otherUserId: message.targetId), expectedSessionGeneration: requestGeneration
                    )
                    message.roomId = response.roomId
                }
                try await saveProgress(message, lifetime: started)
            }
            guard let roomId = message.roomId else { throw APIError.invalidResponse }
            if message.fileIds == nil {
                if message.attachments.isEmpty {
                    message.fileIds = []
                } else {
                    let upload = try await storage.uploadBody(message, scope: scope, version: version)
                    guard lifetime == started, !Task.isCancelled else {
                        try? FileManager.default.removeItem(at: upload.url)
                        throw CancellationError()
                    }
                    let response = try await MultipartUploader.shared.uploadChatMedia(
                        roomId: roomId, prepared: upload, expectedSessionGeneration: requestGeneration
                    )
                    message.fileIds = response.media.map(\.id)
                }
                // Persist successful upload ids before the message request. A
                // relaunch after a lost POST response reuses both idempotency keys.
                try await saveProgress(message, lifetime: started)
            }
            let files = message.fileIds ?? []
            let response: SendChatMessageResponse = try await api.request(ChatEndpoints.sendMessage(body: SendChatMessageBody(
                roomId: roomId,
                messageText: message.text.isEmpty ? nil : message.text,
                messageType: message.messageType ?? (files.isEmpty ? "text" : "file"),
                fileIds: files.isEmpty ? nil : files,
                clientMessageId: message.id,
                replyToId: message.replyRoomId == roomId ? message.replyToId : nil,
                topicId: message.topicId,
                metadata: message.metadata,
                asBusinessUserId: message.businessUserId
            )), expectedSessionGeneration: requestGeneration)
            guard lifetime == started else { return }
            confirm(response.message)
        } catch {
            await recordFailure(error, message: message, lifetime: started)
        }
    }

    private func recordFailure(_ error: any Error, message original: ChatOutboxMessage, lifetime started: Int) async {
        var message = original
        guard lifetime == started, messages.contains(where: { $0.id == message.id }), !Task.isCancelled else { return }
        message.attempts += 1
        message.failure = error.localizedDescription
        if Self.isTransient(error) {
            message.status = .retrying
            message.retryAt = Date().addingTimeInterval(min(60, pow(2, Double(min(message.attempts, 6)))))
        } else {
            message.status = Self.isRefused(error) ? .refused : .failed
            message.retryAt = nil
        }
        do {
            try await saveProgress(message, lifetime: started)
        } catch {
            guard lifetime == started, let index = messages.firstIndex(where: { $0.id == message.id }) else { return }
            message.status = .failed
            message.failure = "Couldn't save send progress. Reopen the app to retry safely."
            messages[index] = message
            publish(.changed)
        }
    }

    private func saveProgress(_ message: ChatOutboxMessage, lifetime started: Int) async throws {
        guard lifetime == started, messages.contains(where: { $0.id == message.id }) else { throw CancellationError() }
        try await storage.updateOutbox(message, scope: scope, version: version)
        guard lifetime == started, let index = messages.firstIndex(where: { $0.id == message.id }) else { throw CancellationError() }
        messages[index] = message
        publish(.changed)
    }

    private static func isRefused(_ error: any Error) -> Bool {
        if case APIError.forbidden = error { return true }
        if case let APIError.clientError(status, _) = error { return status == 403 }
        return false
    }

    private static func isTransient(_ error: any Error) -> Bool {
        if let apiError = error as? APIError {
            if apiError.isTransient { return true }
            if case .retriesExhausted = apiError { return true }
            if case let .clientError(status, body) = apiError {
                return status == 429 && APIError.code(in: body) != "PRE_BID_LIMIT"
            }
        }
        return (error as? URLError).map { $0.code != .cancelled } ?? false
    }
}
