//
//  ScreenStoreDisk.swift
//  Pantopus
//
//  The screen store's saved copy (Instant Screens contract sections 5 to 7):
//  the entries that may stay on the phone, one JSON file each with a schema
//  version and the app build, under Library/Caches/Pantopus/Saved/<account
//  folder>/ with complete file protection. At most 20 MB, the least recently
//  used going first; nothing older than 7 days is read; a file that doesn't
//  decode is deleted, and one that can't be read while the phone is locked
//  counts as missing. Folder and file names are hashes: no account ids, paths
//  or tokens appear in them.
//

import CryptoKit
import Foundation

/// One saved store entry: the reply's bytes and what the store knew about them.
struct SavedScreenEntry: Codable {
    /// Earlier copies did not account for HomeOccupancy.access_end_at.
    static let currentSchema = 2

    let schema: Int
    let build: String
    let kind: String
    let fetchedAt: Date
    let etag: String?
    let topics: [String]
    let expiresAt: Date?
    let data: Data
}

final class ScreenStoreDisk: @unchecked Sendable {
    static let shared = ScreenStoreDisk()

    /// Saved pages take at most this much of the storage limit (decision 6).
    static let maxBytes = 20 * 1024 * 1024
    /// Nothing older is read; offline, a household copy goes after it too.
    static let maxAge: TimeInterval = 7 * 24 * 3600

    let root: URL
    let build: String
    private let queue = DispatchQueue(label: "app.pantopus.ios.saved-copy", qos: .utility)
    private let lock = NSLock()
    /// File names per folder, read from the folder on first use.
    private var index: [String: Set<String>] = [:]
    /// Bumped by `removeAll`: writes queued before it are dropped.
    private var generation = 0

    init(root: URL? = nil) {
        self.root = root ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Pantopus/Saved", isDirectory: true)
        build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
        // Remove older unsafe copies even when an offline access gate stops
        // their screen from asking for them. Reads also reject old schemas.
        queue.async { [self] in removeObsoleteCopies() }
    }

    // MARK: - Names

    static func hashed(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).prefix(16).map { String(format: "%02x", $0) }.joined()
    }

    func folder(server: String, account: String) -> String {
        Self.hashed("\(server)|\(account)")
    }

    func file(method: String, path: String, query: String) -> String {
        Self.hashed("\(method) \(path)?\(query)") + ".json"
    }

    // MARK: - Reading (small files, on the caller's thread)

    func read(folder: String, file: String, now: Date) -> SavedScreenEntry? {
        guard names(in: folder).contains(file) else { return nil }
        let url = root.appendingPathComponent(folder, isDirectory: true).appendingPathComponent(file)
        // Missing, or unreadable while the phone is locked: no copy, nothing deleted.
        guard let bytes = try? Data(contentsOf: url) else { return nil }
        guard let entry = try? Self.decoder.decode(SavedScreenEntry.self, from: bytes),
              entry.schema == SavedScreenEntry.currentSchema,
              now.timeIntervalSince(entry.fetchedAt) <= Self.maxAge
        else {
            remove(folder: folder, file: file)
            return nil
        }
        // The least recently used go first: reading counts as use.
        try? FileManager.default.setAttributes([.modificationDate: now], ofItemAtPath: url.path)
        return entry
    }

    // MARK: - Writing (in the background, in order)

    func write(_ entry: SavedScreenEntry, folder: String, file: String) {
        let started = lock.withLock {
            index[folder, default: []].insert(file)
            return generation
        }
        queue.async { [self] in
            guard lock.withLock({ generation == started }) else { return }
            let directory = root.appendingPathComponent(folder, isDirectory: true)
            do {
                try FileManager.default.createDirectory(
                    at: directory,
                    withIntermediateDirectories: true,
                    attributes: [.protectionKey: FileProtectionType.complete]
                )
                let bytes = try Self.encoder.encode(entry)
                try bytes.write(to: directory.appendingPathComponent(file), options: [.atomic, .completeFileProtection])
            } catch {
                lock.withLock { _ = index[folder]?.remove(file) }
            }
            trimToLimit()
        }
    }

    func remove(folder: String, file: String) {
        lock.withLock { _ = index[folder]?.remove(file) }
        let url = root.appendingPathComponent(folder, isDirectory: true).appendingPathComponent(file)
        queue.async { try? FileManager.default.removeItem(at: url) }
    }

    /// Sign-out, a session ended, an account switch, Clear cache: every saved
    /// page goes at once (the folder is moved aside, then deleted).
    func removeAll() {
        lock.withLock {
            generation += 1
            index.removeAll()
        }
        let aside = root.deletingLastPathComponent().appendingPathComponent("Saved-\(UUID().uuidString)", isDirectory: true)
        let moved = (try? FileManager.default.moveItem(at: root, to: aside)) != nil
        queue.async { [self] in
            try? FileManager.default.removeItem(at: moved ? aside : root)
        }
    }

    /// The saved pages' size on disk (Storage & data).
    func totalBytes() -> Int {
        files().reduce(0) { $0 + $1.size }
    }

    // MARK: - Private

    private func removeObsoleteCopies() {
        for file in files() {
            guard let bytes = try? Data(contentsOf: file.url) else { continue }
            if let saved = try? Self.decoder.decode(SavedScreenEntry.self, from: bytes),
               saved.schema == SavedScreenEntry.currentSchema { continue }
            try? FileManager.default.removeItem(at: file.url)
            let folder = file.url.deletingLastPathComponent().lastPathComponent
            lock.withLock { _ = index[folder]?.remove(file.url.lastPathComponent) }
        }
    }

    private func names(in folder: String) -> Set<String> {
        lock.withLock {
            if let names = index[folder] { return names }
            let directory = root.appendingPathComponent(folder, isDirectory: true)
            let names = Set((try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? [])
            index[folder] = names
            return names
        }
    }

    private struct SavedFile {
        let url: URL
        let size: Int
        let used: Date
    }

    private func files() -> [SavedFile] {
        let keys: [URLResourceKey] = [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey]
        guard let walker = FileManager.default.enumerator(at: root, includingPropertiesForKeys: keys) else { return [] }
        return walker.compactMap { item in
            guard let url = item as? URL, let values = try? url.resourceValues(forKeys: Set(keys)),
                  values.isRegularFile == true else { return nil }
            return SavedFile(url: url, size: values.fileSize ?? 0, used: values.contentModificationDate ?? .distantPast)
        }
    }

    /// At the 20 MB limit the least recently used pages go first.
    private func trimToLimit() {
        var all = files()
        var total = all.reduce(0) { $0 + $1.size }
        guard total > Self.maxBytes else { return }
        all.sort { $0.used < $1.used }
        for file in all where total > Self.maxBytes {
            try? FileManager.default.removeItem(at: file.url)
            total -= file.size
            let folder = file.url.deletingLastPathComponent().lastPathComponent
            lock.withLock { _ = index[folder]?.remove(file.url.lastPathComponent) }
        }
    }

    private static var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        return encoder
    }

    private static var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return decoder
    }
}
