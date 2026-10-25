import Foundation

extension ChatLocalStore {
    /// One thread's own retirement (a Read correction), beside the account's history epoch.
    struct ThreadEpoch: Codable {
        let id: String
        let retiredAt: Date
    }

    static let inboxThread = "inbox"
    /// Read corrections are rare; past this many retired threads the account's history retires instead.
    private static let threadEpochLimit = 64

    /// Every saved window of one thread (a person's All window and each topic,
    /// a room for each identity) shares its key without the query.
    static func threadBase(_ thread: String) -> String {
        ScreenStoreDisk.hashed(thread.components(separatedBy: "?")[0])
    }

    /// Called with the lock held. An unreadable file fails every history read
    /// and write, never back to a retired window.
    func threadEpoch(_ base: String) throws -> ThreadEpoch? {
        try threadEpochs()[base]
    }

    /// A Read correction retires only these threads' saved windows (every topic
    /// or identity) and the inbox copy, not the account's. Their new epochs are
    /// written and synced before any old file goes, and every read checks them,
    /// so no old window can be read after this returns even if deletion stops.
    /// Other threads and saved media stay. If the epochs can't be recorded, the
    /// account's history retires as for ended access.
    func retireThreads(scope: String, threads: [String]) {
        lock.withLock {
            let marker = root.appendingPathComponent("scope")
            guard (try? String(contentsOf: marker, encoding: .utf8)) == scope else { return }
            // Reads and writes already in flight, for any thread, start again.
            generation += 1
            let bases = Set(threads.map(Self.threadBase))
            do {
                var epochs = try threadEpochs()
                let retiredAt = Date()
                for base in bases.union([Self.inboxThread]) {
                    epochs[base] = ThreadEpoch(id: UUID().uuidString, retiredAt: retiredAt)
                }
                guard epochs.count <= Self.threadEpochLimit else { throw CocoaError(.fileWriteOutOfSpace) }
                try Self.writeSynced(JSONEncoder().encode(epochs), to: root.appendingPathComponent("history-thread-epochs"))
            } catch {
                retireHistory()
                return
            }
            let directory = root.appendingPathComponent("history", isDirectory: true)
            let names = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
            let retired = names.filter { name in name == "inbox.sealed" || bases.contains { name.hasPrefix($0 + "-") } }
            for name in retired {
                try? FileManager.default.removeItem(at: directory.appendingPathComponent(name))
            }
        }
    }

    private func threadEpochs() throws -> [String: ThreadEpoch] {
        let marker = root.appendingPathComponent("history-thread-epochs")
        guard FileManager.default.fileExists(atPath: marker.path) else { return [:] }
        return try JSONDecoder().decode([String: ThreadEpoch].self, from: Data(contentsOf: marker))
    }

    /// Replaces `url` atomically: the new contents and the renamed directory
    /// entry are synced to storage before this returns.
    private static func writeSynced(_ data: Data, to url: URL) throws {
        let directory = url.deletingLastPathComponent()
        let temporary = directory.appendingPathComponent(".\(url.lastPathComponent)-\(UUID().uuidString)")
        guard FileManager.default.createFile(
            atPath: temporary.path, contents: nil, attributes: [.protectionKey: FileProtectionType.complete]
        ) else { throw CocoaError(.fileWriteUnknown) }
        defer { try? FileManager.default.removeItem(at: temporary) }
        let handle = try FileHandle(forWritingTo: temporary)
        defer { try? handle.close() }
        try handle.write(contentsOf: data)
        guard fcntl(handle.fileDescriptor, F_FULLFSYNC) == 0 || fsync(handle.fileDescriptor) == 0 else { throw POSIXError(.EIO) }
        guard rename(temporary.path, url.path) == 0 else { throw POSIXError(.EIO) }
        let folder = open(directory.path, O_RDONLY)
        guard folder >= 0 else { throw POSIXError(.EIO) }
        defer { close(folder) }
        guard fsync(folder) == 0 else { throw POSIXError(.EIO) }
    }
}
