import CryptoKit
import Foundation

extension ChatLocalStore {
    /// A business's shared inbox is kept beside the threads in the history
    /// directory: same account key, epoch and lifetime, so sign-out, history
    /// retirement and Storage & data remove it with them.
    private struct SavedBusinessInbox: Codable {
        let epoch: String?
        let savedAt: Date
        let response: BusinessInboxRoomsResponse
    }

    func businessInbox(scope: String, businessId: String, version: Int) async -> BusinessInboxRoomsResponse? {
        try? await onQueue {
            try self.lock.withLock {
                guard self.generation == version else { throw CancellationError() }
                let key = try self.prepare(scope: scope, generation: version)
                let url = self.businessInboxURL(businessId)
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= Self.historyLimit else { return nil }
                let bytes = try AES.GCM.open(
                    AES.GCM.SealedBox(combined: Data(contentsOf: url)),
                    using: key,
                    authenticating: Data("\(scope)|business-inbox|\(businessId)".utf8)
                )
                let saved = try JSONDecoder().decode(SavedBusinessInbox.self, from: bytes)
                // The history epoch media and threads share.
                guard try saved.epoch == self.mediaEpoch(),
                      Date().timeIntervalSince(saved.savedAt) <= Self.historyLifetime else {
                    try? FileManager.default.removeItem(at: url)
                    return nil
                }
                try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
                return saved.response
            }
        }
    }

    /// `version` is the store version read before the request started: a
    /// sign-out or retirement since then leaves nothing behind.
    func saveBusinessInbox(_ response: BusinessInboxRoomsResponse, scope: String, businessId: String, version: Int) async {
        _ = try? await onQueue {
            try self.lock.withLock {
                guard self.generation == version else { throw CancellationError() }
                let key = try self.prepare(scope: scope, generation: version)
                let saved = try SavedBusinessInbox(epoch: self.mediaEpoch(), savedAt: Date(), response: response)
                let bytes = try JSONEncoder().encode(saved)
                guard bytes.count <= Self.historyLimit else { return }
                let sealed = try AES.GCM.seal(
                    bytes,
                    using: key,
                    authenticating: Data("\(scope)|business-inbox|\(businessId)".utf8)
                )
                try Self.createProtectedDirectory(self.root.appendingPathComponent("history", isDirectory: true))
                try sealed.combined?.write(to: self.businessInboxURL(businessId), options: [.atomic, .completeFileProtection])
            }
        }
    }

    /// Queued after any save already in flight, so a refused inbox stays gone.
    func removeBusinessInbox(scope: String, businessId: String) async {
        _ = try? await onQueue {
            self.lock.withLock {
                let marker = self.root.appendingPathComponent("scope")
                guard (try? String(contentsOf: marker, encoding: .utf8)) == scope else { return }
                try? FileManager.default.removeItem(at: self.businessInboxURL(businessId))
            }
        }
    }

    private func businessInboxURL(_ businessId: String) -> URL {
        root.appendingPathComponent("history")
            .appendingPathComponent("business-" + ScreenStoreDisk.hashed(businessId) + ".sealed")
    }
}
