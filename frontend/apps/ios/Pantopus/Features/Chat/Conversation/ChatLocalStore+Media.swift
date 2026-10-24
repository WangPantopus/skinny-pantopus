import CryptoKit
import Foundation

extension ChatLocalStore {
    /// Opened originals and thumbnails share a bounded, encrypted received cache.
    /// Larger originals still open online without being retained.
    static let mediaFileLimit = 10 * 1024 * 1024
    private static let mediaLimit = 25 * 1024 * 1024

    private struct SavedMedia: Codable {
        let epoch: String?
        let savedAt: Date
        let bytes: Data
    }

    private struct MediaFile {
        let url: URL
        let size: Int
        let used: Date
    }

    func media(scope: String, key mediaKey: String, version: Int) async -> Data? {
        try? await onQueue {
            try self.lock.withLock {
                guard self.generation == version else { throw CancellationError() }
                let key = try self.prepare(scope: scope, generation: version)
                let url = self.mediaURL(mediaKey)
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= Self.mediaFileLimit * 2 else { return nil }
                let bytes = try AES.GCM.open(
                    AES.GCM.SealedBox(combined: Data(contentsOf: url)),
                    using: key,
                    authenticating: Data("\(scope)|media|\(mediaKey)".utf8)
                )
                let saved = try JSONDecoder().decode(SavedMedia.self, from: bytes)
                guard try saved.epoch == self.mediaEpoch(), saved.bytes.count <= Self.mediaFileLimit,
                      Date().timeIntervalSince(saved.savedAt) <= Self.historyLifetime else {
                    try? FileManager.default.removeItem(at: url)
                    return nil
                }
                try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
                return saved.bytes
            }
        }
    }

    func saveMedia(_ bytes: Data, scope: String, key mediaKey: String, version: Int) async {
        guard bytes.count <= Self.mediaFileLimit else { return }
        _ = try? await onQueue {
            try self.lock.withLock {
                guard self.generation == version else { throw CancellationError() }
                let key = try self.prepare(scope: scope, generation: version)
                let saved = try SavedMedia(epoch: self.mediaEpoch(), savedAt: Date(), bytes: bytes)
                let sealed = try AES.GCM.seal(
                    JSONEncoder().encode(saved),
                    using: key,
                    authenticating: Data("\(scope)|media|\(mediaKey)".utf8)
                )
                let directory = self.root.appendingPathComponent("media", isDirectory: true)
                try Self.createProtectedDirectory(directory)
                try sealed.combined?.write(to: self.mediaURL(mediaKey), options: [.atomic, .completeFileProtection])
                self.trimMedia()
            }
        }
    }

    private func mediaURL(_ key: String) -> URL {
        root.appendingPathComponent("media").appendingPathComponent(ScreenStoreDisk.hashed(key) + ".sealed")
    }

    private func trimMedia() {
        let urls = (try? FileManager.default.contentsOfDirectory(
            at: root.appendingPathComponent("media"), includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]
        )) ?? []
        let files = urls.compactMap { url -> MediaFile? in
            guard let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey]) else { return nil }
            return MediaFile(url: url, size: values.fileSize ?? 0, used: values.contentModificationDate ?? .distantPast)
        }
        .sorted { $0.used < $1.used }
        var total = files.reduce(0) { $0 + $1.size }
        for file in files where total > Self.mediaLimit || Date().timeIntervalSince(file.used) > Self.historyLifetime {
            try? FileManager.default.removeItem(at: file.url)
            total -= file.size
        }
    }
}
