//
//  PantopusImagePipeline.swift
//  Pantopus
//
//  Images for Instant Screens (contract sections 6 and 7): decoded images in
//  `PantopusImageCache` (memory), their bytes in Library/Caches/Pantopus/Images
//  with complete file protection, inside the one storage limit shared with
//  the saved pages (`StorageLimit`, 100 MB by default). At the limit the least
//  recently used go first, and anything not opened in 30 days goes too.
//  Videos, documents and full-size originals are never kept on disk. Downloads
//  use their own session with no URL cache, and a link's token or signature
//  never reaches a cache key or a file name. Everything goes at sign-out.
//

import CryptoKit
import Foundation
import UIKit

final class PantopusImagePipeline: @unchecked Sendable {
    static let shared = PantopusImagePipeline()

    /// Unopened this long, an image goes from the phone.
    static let unusedLifetime: TimeInterval = 30 * 24 * 3600
    /// A single image larger than this stays in memory only.
    static let maxFileBytes = 8 * 1024 * 1024
    /// Query items that carry a token or a signature: never part of a key.
    static let secretQueryNames: Set<String> = [
        "token", "access_token", "signature", "expires", "key-pair-id", "policy",
        "x-amz-signature", "x-amz-credential", "x-amz-security-token", "x-amz-date", "x-amz-expires"
    ]

    let root: URL
    private let memory: PantopusImageCache
    private let session: URLSession
    private let queue = DispatchQueue(label: "app.pantopus.ios.images", qos: .utility)
    private let lock = NSLock()
    /// Bumped by `removeAll`: downloads started before it write nothing.
    private var generation = 0
    private var inFlight: [String: Task<UIImage?, Never>] = [:]
    private var trimScheduled = false

    init(root: URL? = nil, memory: PantopusImageCache = .shared) {
        self.root = root ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Pantopus/Images", isDirectory: true)
        self.memory = memory
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: configuration)
        // Images unopened for 30 days go even when nothing new is downloaded.
        scheduleTrim()
    }

    // MARK: - Keys

    /// The link without its token or signature: a re-signed link to the same
    /// picture finds the same copy.
    static func cacheKey(for url: URL) -> String {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url.absoluteString }
        let kept = (components.queryItems ?? []).filter { !secretQueryNames.contains($0.name.lowercased()) }
        components.queryItems = kept.isEmpty ? nil : kept.sorted { $0.name < $1.name }
        components.fragment = nil
        return components.string ?? url.absoluteString
    }

    private static func fileName(for key: String) -> String {
        SHA256.hash(data: Data(key.utf8)).prefix(20).map { String(format: "%02x", $0) }.joined()
    }

    private func memoryKey(_ key: String) -> URL {
        URL(string: key) ?? root.appendingPathComponent(Self.fileName(for: key))
    }

    // MARK: - Reading

    /// The decoded image already in memory, for a screen's first frame.
    func cachedImage(for url: URL) -> UIImage? {
        memory.image(for: memoryKey(Self.cacheKey(for: url)))
    }

    /// Memory, then the phone, then the network. `keepsOnDisk: false` for
    /// full-size originals (the photo viewer): memory only.
    func image(for url: URL, keepsOnDisk: Bool = true) async -> UIImage? {
        let key = Self.cacheKey(for: url)
        if let image = memory.image(for: memoryKey(key)) { return image }
        let (task, started) = lock.withLock { () -> (Task<UIImage?, Never>, Int) in
            if let running = inFlight[key] { return (running, generation) }
            let started = generation
            let task = Task.detached(priority: .userInitiated) { [self] in
                await fetch(url: url, key: key, keepsOnDisk: keepsOnDisk, generation: started)
            }
            inFlight[key] = task
            return (task, started)
        }
        let image = await task.value
        lock.withLock { if generation == started { inFlight[key] = nil } }
        return image
    }

    private func fetch(url: URL, key: String, keepsOnDisk: Bool, generation started: Int) async -> UIImage? {
        let file = root.appendingPathComponent(Self.fileName(for: key))
        if let bytes = try? Data(contentsOf: file), let image = Self.decode(bytes) {
            try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path)
            keep(image, key: key, generation: started)
            return image
        }
        guard let (bytes, response) = try? await session.data(from: url),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              !Self.isNeverKept(http.mimeType), let image = Self.decode(bytes)
        else { return nil }
        keep(image, key: key, generation: started)
        // Web links only: a local file is already on the phone.
        if keepsOnDisk, url.scheme?.hasPrefix("http") == true, bytes.count <= Self.maxFileBytes {
            write(bytes, to: file, generation: started)
        }
        return image
    }

    private static func isNeverKept(_ mimeType: String?) -> Bool {
        guard let type = mimeType?.lowercased() else { return false }
        return type.hasPrefix("video/") || type.hasPrefix("audio/") || type == "application/pdf" || type.hasPrefix("text/")
    }

    private static func decode(_ bytes: Data) -> UIImage? {
        guard let image = UIImage(data: bytes) else { return nil }
        return image.preparingForDisplay() ?? image
    }

    private func keep(_ image: UIImage, key: String, generation started: Int) {
        guard lock.withLock({ generation == started }) else { return }
        memory.store(image, for: memoryKey(key))
    }

    // MARK: - Writing and the limit

    private func write(_ bytes: Data, to file: URL, generation started: Int) {
        queue.async { [self] in
            guard lock.withLock({ generation == started }) else { return }
            try? FileManager.default.createDirectory(
                at: root,
                withIntermediateDirectories: true,
                attributes: [.protectionKey: FileProtectionType.complete]
            )
            try? bytes.write(to: file, options: [.atomic, .completeFileProtection])
            scheduleTrim()
        }
    }

    private func scheduleTrim() {
        let schedule = lock.withLock { () -> Bool in
            guard !trimScheduled else { return false }
            trimScheduled = true
            return true
        }
        guard schedule else { return }
        queue.asyncAfter(deadline: .now() + 5) { [self] in
            lock.withLock { trimScheduled = false }
            trim()
        }
    }

    /// Images not opened in 30 days go; then, over the space the saved pages
    /// leave in the storage limit, the least recently used go first.
    func trim() {
        let budget = max(0, StorageLimit.bytes - ScreenStoreDisk.shared.totalBytes())
        let cutoff = Date().addingTimeInterval(-Self.unusedLifetime)
        var files = imageFiles()
        for file in files where file.used < cutoff {
            try? FileManager.default.removeItem(at: file.url)
        }
        files.removeAll { $0.used < cutoff }
        var total = files.reduce(0) { $0 + $1.size }
        guard total > budget else { return }
        for file in files.sorted(by: { $0.used < $1.used }) where total > budget {
            try? FileManager.default.removeItem(at: file.url)
            total -= file.size
        }
    }

    /// Sign-out, a session ended, an account switch, Clear cache.
    func removeAll() {
        lock.withLock {
            generation += 1
            inFlight.removeAll()
        }
        memory.evictAll()
        let aside = root.deletingLastPathComponent().appendingPathComponent("Images-\(UUID().uuidString)", isDirectory: true)
        let moved = (try? FileManager.default.moveItem(at: root, to: aside)) != nil
        queue.async { [self] in
            try? FileManager.default.removeItem(at: moved ? aside : root)
        }
    }

    /// The images' size on disk (Storage & data).
    func totalBytes() -> Int {
        imageFiles().reduce(0) { $0 + $1.size }
    }

    private struct ImageFile {
        let url: URL
        let size: Int
        let used: Date
    }

    private func imageFiles() -> [ImageFile] {
        let keys: Set<URLResourceKey> = [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey]
        let urls = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: Array(keys))) ?? []
        return urls.compactMap { url in
            guard let values = try? url.resourceValues(forKeys: keys), values.isRegularFile == true else { return nil }
            return ImageFile(url: url, size: values.fileSize ?? 0, used: values.contentModificationDate ?? .distantPast)
        }
    }
}

/// The one limit for photos and saved pages together (decision 6): 100 MB by
/// default, with 50, 100 or 250 MB to choose from. A setting of the phone,
/// not the account: Clear cache and sign-out keep it.
enum StorageLimit {
    static let choices = [50, 100, 250]
    static let defaultMegabytes = 100
    private static let key = "pantopus.storage.limitMB"

    static var megabytes: Int {
        get {
            let stored = UserDefaults.standard.integer(forKey: key)
            return choices.contains(stored) ? stored : defaultMegabytes
        }
        set {
            guard choices.contains(newValue) else { return }
            UserDefaults.standard.set(newValue, forKey: key)
        }
    }

    static var bytes: Int {
        megabytes * 1024 * 1024
    }
}
