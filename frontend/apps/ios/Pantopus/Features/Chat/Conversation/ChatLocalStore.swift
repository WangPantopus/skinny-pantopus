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

    private struct SavedHistory: Codable {
        let schema: Int
        let savedAt: Date
        let thread: ChatThreadMemory
    }

    let root: URL
    private let secure = KeychainStore(service: "app.pantopus.ios.chat-local")
    let queue = DispatchQueue(label: "app.pantopus.ios.chat-local", qos: .utility)
    let lock = NSLock()
    var generation = 0
    private var sessionGeneration = 0
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
                    guard saved.schema == 1, Date().timeIntervalSince(saved.savedAt) <= Self.historyLifetime else {
                        try? FileManager.default.removeItem(at: url)
                        return nil
                    }
                    try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
                    return saved.thread
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
                    let bytes = try JSONEncoder().encode(SavedHistory(schema: 1, savedAt: memory.confirmedAt ?? Date(), thread: memory))
                    guard bytes.count <= Self.historyLimit else { return }
                    let encrypted = try AES.GCM.seal(bytes, using: key, authenticating: Data("\(scope)|\(thread)".utf8))
                    guard let combined = encrypted.combined else { return }
                    try combined.write(to: historyURL(thread), options: [.atomic, .completeFileProtection])
                    trimHistory()
                }
            }
        }
    }

    /// Called synchronously by every sign-out/account-switch path. In-flight
    /// reads and writes fail their generation check and cannot recreate old data.
    func clear() {
        let aside = root.deletingLastPathComponent().appendingPathComponent("ChatLocal-\(UUID().uuidString)")
        lock.withLock {
            generation += 1
            sessionGeneration += 1
            try? secure.delete("encryption-key")
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
            try? FileManager.default.removeItem(at: root.appendingPathComponent("history"))
        }
    }

    func historyBytes() -> Int {
        lock.withLock {
            let directory = root.appendingPathComponent("history")
            let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey])) ?? []
            return files.reduce(0) { $0 + ((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
        }
    }

    private func historyURL(_ thread: String) -> URL {
        let base = thread.components(separatedBy: "?")[0]
        return root.appendingPathComponent("history")
            .appendingPathComponent(ScreenStoreDisk.hashed(base) + "-" + ScreenStoreDisk.hashed(thread) + ".sealed")
    }

    /// A permission refusal removes every topic copy for this conversation.
    func removeHistory(scope: String, thread: String) {
        lock.withLock {
            generation += 1
            let marker = root.appendingPathComponent("scope")
            guard (try? String(contentsOf: marker, encoding: .utf8)) == scope else { return }
            let directory = root.appendingPathComponent("history")
            let prefix = ScreenStoreDisk.hashed(thread.components(separatedBy: "?")[0]) + "-"
            let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
            for file in files where file.lastPathComponent.hasPrefix(prefix) {
                try? FileManager.default.removeItem(at: file)
            }
        }
    }

    /// `lock` is held and this runs only on the serial storage queue.
    func prepare(scope: String, generation: Int) throws -> SymmetricKey {
        if preparedGeneration == generation, preparedScope == scope, let encryptionKey { return encryptionKey }
        let marker = root.appendingPathComponent("scope")
        if let previous = try? String(contentsOf: marker, encoding: .utf8), previous != scope {
            try FileManager.default.removeItem(at: root)
            try secure.delete("encryption-key")
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
        var count = entries.count
        var bytes = entries.reduce(0) { $0 + $1.size }
        for file in entries {
            guard count > Self.threadLimit || bytes > Self.historyLimit || Date().timeIntervalSince(file.used) > Self.historyLifetime
            else { continue }
            try? FileManager.default.removeItem(at: file.url)
            bytes -= file.size
            count -= 1
        }
    }
}
