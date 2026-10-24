import CryptoKit
import Foundation

/// Account-scoped chat storage. Only encrypted envelopes leave memory;
/// the encryption key stays in the device-only Keychain used by authentication.
/// History is a bounded accelerator, and every open still reconciles with the server.
final class ChatLocalStore: @unchecked Sendable {
    static let shared = ChatLocalStore()
    static let historyLimit = 5 * 1024 * 1024
    static let threadLimit = 20
    static let historyLifetime: TimeInterval = 7 * 24 * 3600
    static let historyRetired = Notification.Name("pantopus.chatHistoryRetired")

    private struct SavedInbox: Codable {
        let schema: Int
        let memory: ChatInboxMemory
        var epoch: String?
    }

    private struct SavedHistory: Codable {
        let schema: Int
        let savedAt: Date
        let thread: ChatThreadMemory
        var epoch: String?
    }

    private struct HistoryEpoch: Codable {
        let id: String
        let retiredAt: Date
        var scope: String?
    }

    let root: URL
    private let secure = KeychainStore(service: "app.pantopus.ios.chat-local")
    let queue = DispatchQueue(label: "app.pantopus.ios.chat-local", qos: .utility)
    let lock = NSLock()
    var generation = 0
    var draftReservations: [String: UUID] = [:]
    var consumedDraftIds: Set<String> = []
    private var sessionGeneration = 0
    private var inboxGeneration = 0
    private var inboxReadConfirmedAt: Date?
    private var historyRetirementFailed = false
    // The following preparation state is used only on `queue`.
    private var preparedGeneration: Int?
    private var preparedScope: String?
    private var encryptionKey: SymmetricKey?

    private init() {
        root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Pantopus/ChatLocal", isDirectory: true)
    }

    static func scope(server: String, account: String) -> String {
        ScreenStoreDisk.hashed("\(server)|\(account)")
    }

    var version: Int {
        lock.withLock { generation }
    }

    var sessionVersion: Int {
        lock.withLock { sessionGeneration }
    }

    func requireSession(_ started: Int) throws {
        guard sessionGeneration == started else { throw CancellationError() }
    }

    func history(scope: String, thread: String) async -> ChatThreadMemory? {
        let started = lock.withLock { generation }
        return await withCheckedContinuation { continuation in
            queue.async { [self] in
                let value: ChatThreadMemory? = try? lock.withLock {
                    guard generation == started else { throw CancellationError() }
                    let key = try prepare(scope: scope, generation: started)
                    let url = historyURL(thread)
                    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
                    guard (attributes[.size] as? Int ?? 0) <= Self.historyLimit else {
                        try? FileManager.default.removeItem(at: url)
                        return nil
                    }
                    let encrypted = try Data(contentsOf: url)
                    let bytes = try AES.GCM.open(
                        AES.GCM.SealedBox(combined: encrypted),
                        using: key,
                        authenticating: Data("\(scope)|\(thread)".utf8)
                    )
                    let saved = try JSONDecoder().decode(SavedHistory.self, from: bytes)
                    guard try saved.epoch == historyEpoch()?.id, saved.schema == 1,
                          Date().timeIntervalSince(saved.savedAt) <= Self.historyLifetime else {
                        try? FileManager.default.removeItem(at: url)
                        return nil
                    }
                    try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
                    var memory = saved.thread
                    memory.cacheGeneration = started
                    return memory
                }
                continuation.resume(returning: value)
            }
        }
    }

    func saveHistory(_ memory: ChatThreadMemory, scope: String, thread: String, version started: Int) async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            queue.async { [self] in
                defer { continuation.resume() }
                // Encoding and encryption happen off the main thread. The lock also
                // prevents a concurrent logout from racing the final atomic write.
                try? lock.withLock {
                    guard generation == started else { throw CancellationError() }
                    let key = try prepare(scope: scope, generation: started)
                    let directory = root.appendingPathComponent("history", isDirectory: true)
                    try FileManager.default.createDirectory(
                        at: directory,
                        withIntermediateDirectories: true,
                        attributes: [.protectionKey: FileProtectionType.complete]
                    )
                    let epoch = try historyEpoch()
                    guard memory.confirmedAt.map({ $0 >= (epoch?.retiredAt ?? .distantPast) }) == true else { return }
                    let bytes = try JSONEncoder().encode(SavedHistory(
                        schema: 1, savedAt: memory.confirmedAt ?? Date(), thread: memory, epoch: epoch?.id
                    ))
                    guard bytes.count <= Self.historyLimit else { return }
                    let encrypted = try AES.GCM.seal(bytes, using: key, authenticating: Data("\(scope)|\(thread)".utf8))
                    guard let combined = encrypted.combined else { return }
                    try combined.write(to: historyURL(thread), options: [.atomic, .completeFileProtection])
                    trimHistory()
                }
            }
        }
    }

    /// Last-message previews use the same encrypted account store as history.
    /// Keep one bounded response and its matching pagination cursor.
    func inbox(scope: String) async -> ChatInboxMemory? {
        let started = version
        return await withCheckedContinuation { continuation in
            queue.async { [self] in
                let memory: ChatInboxMemory? = try? lock.withLock {
                    guard generation == started else { throw CancellationError() }
                    let key = try prepare(scope: scope, generation: started)
                    let url = root.appendingPathComponent("history/inbox.sealed")
                    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
                    guard (attributes[.size] as? Int ?? 0) <= Self.historyLimit else { return nil }
                    let bytes = try AES.GCM.open(
                        AES.GCM.SealedBox(combined: Data(contentsOf: url)),
                        using: key,
                        authenticating: Data("\(scope)|inbox".utf8)
                    )
                    let saved = try JSONDecoder().decode(SavedInbox.self, from: bytes)
                    guard try saved.epoch == historyEpoch()?.id, saved.schema == 1,
                          Date().timeIntervalSince(saved.memory.confirmedAt) <= Self.historyLifetime
                    else {
                        try? FileManager.default.removeItem(at: url)
                        return nil
                    }
                    try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
                    return saved.memory
                }
                continuation.resume(returning: memory)
            }
        }
    }

    func saveInbox(_ memory: ChatInboxMemory, scope: String, checkpoint: ChatInboxCheckpoint) async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            queue.async { [self] in
                defer { continuation.resume() }
                try? lock.withLock {
                    guard generation == checkpoint.version, inboxGeneration == checkpoint.revision else { throw CancellationError() }
                    let key = try prepare(scope: scope, generation: checkpoint.version)
                    guard memory.confirmedAt >= (inboxReadConfirmedAt ?? .distantPast) else { return }
                    // Keep rows and their paging cursor as one snapshot. A truncated
                    // prefix paired with the loaded tail's cursor would skip rows.
                    // An over-budget response leaves the prior complete snapshot.
                    let epoch = try historyEpoch()
                    guard memory.confirmedAt >= (epoch?.retiredAt ?? .distantPast) else { return }
                    let bytes = try JSONEncoder().encode(SavedInbox(schema: 1, memory: memory, epoch: epoch?.id))
                    guard bytes.count <= Self.historyLimit else { return }
                    let sealed = try AES.GCM.seal(bytes, using: key, authenticating: Data("\(scope)|inbox".utf8))
                    guard let combined = sealed.combined else { return }
                    let directory = root.appendingPathComponent("history", isDirectory: true)
                    try FileManager.default.createDirectory(
                        at: directory,
                        withIntermediateDirectories: true,
                        attributes: [.protectionKey: FileProtectionType.complete]
                    )
                    try combined.write(to: directory.appendingPathComponent("inbox.sealed"), options: [.atomic, .completeFileProtection])
                    inboxGeneration += 1
                    trimHistory()
                }
            }
        }
    }

    func removeInbox(scope: String) {
        lock.withLock {
            let marker = root.appendingPathComponent("scope")
            guard (try? String(contentsOf: marker, encoding: .utf8)) == scope else { return }
            generation += 1
            try? FileManager.default.removeItem(at: root.appendingPathComponent("history/inbox.sealed"))
        }
    }

    /// Called synchronously by every sign-out/account-switch path. In-flight
    /// reads and writes fail their generation check and cannot recreate old data.
    func clear() {
        let aside = root.deletingLastPathComponent().appendingPathComponent("ChatLocal-\(UUID().uuidString)")
        lock.withLock {
            generation += 1
            sessionGeneration += 1
            inboxGeneration += 1
            inboxReadConfirmedAt = nil
            historyRetirementFailed = false
            draftReservations.removeAll()
            consumedDraftIds.removeAll()
            try? secure.delete("encryption-key")
            try? secure.delete("history-retirement")
            if FileManager.default.fileExists(atPath: root.path) {
                try? FileManager.default.moveItem(at: root, to: aside)
            }
        }
        queue.async { try? FileManager.default.removeItem(at: aside) }
    }

    /// Storage & data clears received history, preserving any unsent outbox.
    func clearHistory() {
        lock.withLock {
            generation += 1
            retireHistory()
        }
    }

    func historyBytes() -> Int {
        lock.withLock {
            let files = ["history", "media"].flatMap { name in
                (try? FileManager.default.contentsOfDirectory(
                    at: root.appendingPathComponent(name), includingPropertiesForKeys: [.fileSizeKey]
                )) ?? []
            }
            return files.reduce(0) { $0 + ((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
        }
    }

    private func historyURL(_ thread: String) -> URL {
        let base = thread.components(separatedBy: "?")[0]
        return root.appendingPathComponent("history")
            .appendingPathComponent(ScreenStoreDisk.hashed(base) + "-" + ScreenStoreDisk.hashed(thread) + ".sealed")
    }

    /// Retiring a conversation conservatively retires this account's bounded
    /// history/inbox cache. One durable epoch makes every old variant unreadable
    /// before cleanup starts; draft/outbox storage is independent and untouched.
    func removeHistory(scope: String, thread _: String) {
        lock.withLock {
            let marker = root.appendingPathComponent("scope")
            guard (try? String(contentsOf: marker, encoding: .utf8)) == scope else { return }
            generation += 1
            inboxGeneration += 1
            retireHistory()
        }
    }

    /// `lock` is held and this runs only on the serial storage queue.
    func prepare(scope: String, generation: Int) throws -> SymmetricKey {
        if preparedGeneration == generation, preparedScope == scope, let encryptionKey { return encryptionKey }
        if preparedScope != scope { inboxReadConfirmedAt = nil }
        let marker = root.appendingPathComponent("scope")
        if let previous = try? String(contentsOf: marker, encoding: .utf8), previous != scope {
            try FileManager.default.removeItem(at: root)
            try secure.delete("encryption-key")
            try secure.delete("history-retirement")
            historyRetirementFailed = false
        }
        try FileManager.default.createDirectory(
            at: root,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.complete]
        )
        var directory = root
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        let key: SymmetricKey
        if let bytes = try secure.readData("encryption-key") {
            key = SymmetricKey(data: bytes)
        } else {
            key = SymmetricKey(size: .bits256)
            try secure.setData(key.withUnsafeBytes { Data($0) }, for: "encryption-key")
        }
        try Data(scope.utf8).write(to: marker, options: [.atomic, .completeFileProtection])
        preparedScope = scope
        preparedGeneration = generation
        encryptionKey = key
        return key
    }

    private struct SavedFile {
        let url: URL
        let size: Int
        let used: Date
    }

    private func trimHistory() {
        let directory = root.appendingPathComponent("history")
        let keys: Set<URLResourceKey> = [.fileSizeKey, .contentModificationDateKey]
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: Array(keys))) ?? []
        let entries = files.compactMap { url -> SavedFile? in
            guard let values = try? url.resourceValues(forKeys: keys) else { return nil }
            return SavedFile(url: url, size: values.fileSize ?? 0, used: values.contentModificationDate ?? .distantPast)
        }
        .sorted { $0.used < $1.used }
        var count = entries.filter { $0.url.lastPathComponent != "inbox.sealed" }.count
        var bytes = entries.reduce(0) { $0 + $1.size }
        for file in entries {
            guard count > Self.threadLimit || bytes > Self.historyLimit || Date().timeIntervalSince(file.used) > Self.historyLifetime
            else { continue }
            try? FileManager.default.removeItem(at: file.url)
            bytes -= file.size
            if file.url.lastPathComponent != "inbox.sealed" { count -= 1 }
        }
    }
}

extension ChatLocalStore {
    /// Called with the lock held. A failed epoch write blocks history reads and
    /// writes in this process; a directory rename is the durable fallback.
    private func retireHistory() {
        Task { @MainActor in
            ChatMediaURL.removeOpenedFiles()
            NotificationCenter.default.post(name: Self.historyRetired, object: nil)
        }
        let directory = root.appendingPathComponent("history", isDirectory: true)
        let scope = try? String(contentsOf: root.appendingPathComponent("scope"), encoding: .utf8)
        let epoch = HistoryEpoch(id: UUID().uuidString, retiredAt: Date(), scope: scope)
        do {
            try JSONEncoder().encode(epoch).write(
                to: root.appendingPathComponent("history-epoch"), options: [.atomic, .completeFileProtection]
            )
            try secure.delete("history-retirement")
            historyRetirementFailed = false
            // Interrupted deletion is harmless: every prior envelope fails its
            // epoch check, including inbox previews and all topic query keys.
            try? FileManager.default.removeItem(at: directory)
            try? FileManager.default.removeItem(at: root.appendingPathComponent("media"))
        } catch {
            historyRetirementFailed = true
            // The existing device-only Keychain is an independent durable
            // fallback if the filesystem cannot record retirement. It contains
            // only an opaque epoch and hashed scope, never messages or keys.
            if let encoded = try? JSONEncoder().encode(epoch) {
                try? secure.setData(encoded, for: "history-retirement")
            }
            let aside = root.appendingPathComponent("retired-history-\(UUID().uuidString)", isDirectory: true)
            do {
                try FileManager.default.moveItem(at: directory, to: aside)
                queue.async { try? FileManager.default.removeItem(at: aside) }
            } catch {
                // Retain the failed state; never reuse old history in memory.
            }
        }
    }

    private func historyEpoch() throws -> HistoryEpoch? {
        guard !historyRetirementFailed else { throw CocoaError(.fileReadNoPermission) }
        if let data = try secure.readData("history-retirement") {
            let retired = try JSONDecoder().decode(HistoryEpoch.self, from: data)
            if retired.scope == nil || retired.scope == preparedScope { throw CocoaError(.fileReadNoPermission) }
        }
        let marker = root.appendingPathComponent("history-epoch")
        guard FileManager.default.fileExists(atPath: marker.path) else { return nil }
        return try JSONDecoder().decode(HistoryEpoch.self, from: Data(contentsOf: marker))
    }

    /// Called with the storage lock held, including the durable tombstone check.
    func mediaEpoch() throws -> String? {
        try historyEpoch()?.id
    }
}

struct ChatInboxCheckpoint {
    let version: Int
    let revision: Int
}

extension ChatLocalStore {
    var inboxCheckpoint: ChatInboxCheckpoint {
        lock.withLock { ChatInboxCheckpoint(version: generation, revision: inboxGeneration) }
    }

    /// A new message can arrive after the server accepts a read but before its
    /// response reaches us. Generic read invalidations must not bump this guard.
    func invalidateInboxReadCheckpoint() {
        lock.withLock { inboxGeneration += 1 }
    }

    func saveInboxRead(
        count: Int,
        kind: UnifiedConversation.Kind,
        id: String,
        scope: String,
        checkpoint: ChatInboxCheckpoint
    ) async {
        let confirmedAt = Date()
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            queue.async { [self] in
                defer { continuation.resume() }
                try? lock.withLock {
                    guard count >= 0, generation == checkpoint.version, inboxGeneration == checkpoint.revision else { return }
                    let key = try prepare(scope: scope, generation: checkpoint.version)
                    let url = root.appendingPathComponent("history/inbox.sealed")
                    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
                    guard (attributes[.size] as? Int ?? 0) <= Self.historyLimit else { return }
                    let bytes = try AES.GCM.open(
                        AES.GCM.SealedBox(combined: Data(contentsOf: url)),
                        using: key,
                        authenticating: Data("\(scope)|inbox".utf8)
                    )
                    let saved = try JSONDecoder().decode(SavedInbox.self, from: bytes)
                    guard try saved.epoch == historyEpoch()?.id,
                          saved.schema == 1, Date().timeIntervalSince(saved.memory.confirmedAt) <= Self.historyLifetime,
                          saved.memory.response.conversations.contains(where: { $0.kind == kind && $0.id == id }) else { return }
                    let old = saved.memory.response
                    let rows = old.conversations.map { $0.kind == kind && $0.id == id ? $0.withUnreadCount(count) : $0 }
                    let response = UnifiedConversationsResponse(
                        conversations: rows,
                        total: old.total,
                        totalUnread: old.totalUnread,
                        totalUnmutedUnread: old.totalUnmutedUnread,
                        hasMore: old.hasMore,
                        nextCursor: old.nextCursor
                    )
                    // Scope-only unread cannot safely change global or mixed-mute
                    // totals. Preserve them and the snapshot's original lifetime.
                    let memory = ChatInboxMemory(response: response, stats: saved.memory.stats, confirmedAt: saved.memory.confirmedAt)
                    let encoded = try JSONEncoder().encode(SavedInbox(schema: 1, memory: memory, epoch: saved.epoch))
                    guard encoded.count <= Self.historyLimit else { return }
                    let sealed = try AES.GCM.seal(encoded, using: key, authenticating: Data("\(scope)|inbox".utf8))
                    guard let combined = sealed.combined else { return }
                    try combined.write(to: url, options: [.atomic, .completeFileProtection])
                    inboxGeneration += 1
                    // A later fallback of an older ScreenStore head must not
                    // overwrite this read when canonical revalidation failed.
                    inboxReadConfirmedAt = confirmedAt
                }
            }
        }
    }
}

struct ChatInboxMemory: Codable {
    let response: UnifiedConversationsResponse
    let stats: ChatStatsResponse.Stats?
    let confirmedAt: Date
}
