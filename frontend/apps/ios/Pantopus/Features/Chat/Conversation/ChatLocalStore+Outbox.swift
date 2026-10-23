import CryptoKit
import Foundation

extension ChatLocalStore {
    static let outboxLimit = 100 * 1024 * 1024
    static let chunkSize = 1024 * 1024

    func pendingBytes() -> Int {
        lock.withLock { outboxBytes() }
    }

    /// A multipart body exists only while URLSession is sending it. Remove an
    /// interrupted upload's protected temporary file before any account opens.
    func clearTemporaryUploads() {
        lock.withLock { try? FileManager.default.removeItem(at: root.appendingPathComponent("uploads")) }
    }

    func loadOutbox(scope: String, version: Int) async throws -> [ChatOutboxMessage] {
        try await onQueue {
            try self.lock.withLock {
                try self.requireSession(version)
                let key = try self.prepare(scope: scope, generation: self.generation)
                try self.recoverDraftPromotions(scope: scope, key: key)
                let directory = self.root.appendingPathComponent("outbox")
                let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
                // Temporary upload bodies and interrupted staging directories are
                // never reused after launch. The sealed original remains intact.
                try? FileManager.default.removeItem(at: self.root.appendingPathComponent("uploads"))
                return try files.compactMap { folder in
                    if folder.lastPathComponent.hasPrefix(".") {
                        try? FileManager.default.removeItem(at: folder)
                        return nil
                    }
                    let sealed = try Data(contentsOf: folder.appendingPathComponent("message.sealed"))
                    let bytes = try AES.GCM.open(
                        AES.GCM.SealedBox(combined: sealed),
                        using: key,
                        authenticating: Data("\(scope)|\(folder.lastPathComponent)".utf8)
                    )
                    return try JSONDecoder().decode(ChatOutboxMessage.self, from: bytes)
                }
                .sorted { $0.queuedAt < $1.queuedAt }
            }
        }
    }

    func enqueue(
        _ message: ChatOutboxMessage,
        attachments: [ChatQueuedAttachment],
        scope: String,
        version: Int,
        draft: ChatComposerDraft? = nil
    ) async throws {
        try Self.validateAttachmentSizes(attachments)
        if let draft {
            try await promoteDraft(draft, message: message, attachments: attachments, scope: scope, version: version)
            return
        }
        try await onQueue {
            let (key, staging) = try self.lock.withLock {
                try self.requireSession(version)
                let key = try self.prepare(scope: scope, generation: self.generation)
                let size = attachments.reduce(0) { $0 + ($1.data?.count ?? 0) + ($1.liveVideo?.count ?? 0) }
                guard size + self.outboxBytes() + 4096 < Self.outboxLimit else { throw ChatLocalStorageError.quota }
                let staging = self.root.appendingPathComponent("outbox/.\(UUID().uuidString)", isDirectory: true)
                try Self.createProtectedDirectory(staging)
                return (key, staging)
            }
            defer { try? FileManager.default.removeItem(at: staging) }
            for attachment in attachments {
                guard let bytes = attachment.data else { continue }
                let saved = ChatOutboxAttachment(attachment)
                try Self.sealChunks(
                    bytes,
                    to: staging.appendingPathComponent(saved.file),
                    key: key,
                    context: "\(scope)|\(message.id)|\(saved.file)"
                )
                if let video = attachment.liveVideo {
                    try Self.sealChunks(
                        video,
                        to: staging.appendingPathComponent(saved.liveVideoFile),
                        key: key,
                        context: "\(scope)|\(message.id)|\(saved.liveVideoFile)"
                    )
                }
            }
            try self.lock.withLock {
                try self.requireSession(version)
                try self.writeMessage(message, folder: staging, key: key, scope: scope)
                guard self.outboxBytes() <= Self.outboxLimit else { throw ChatLocalStorageError.quota }
                try FileManager.default.moveItem(at: staging, to: self.outboxURL(message.id))
            }
        }
    }

    /// Match the server's category limits before encrypting or uploading bytes.
    static func validateAttachmentSizes(_ attachments: [ChatQueuedAttachment]) throws {
        for attachment in attachments {
            let megabytes = attachment.mimeType.hasPrefix("image/") ? 10 : attachment.mimeType.hasPrefix("video/") ? 100 : 25
            guard (attachment.data?.count ?? 0) <= megabytes * 1024 * 1024 else {
                throw ChatLocalStorageError.attachmentLimit(megabytes: megabytes)
            }
            guard (attachment.liveVideo?.count ?? 0) <= 100 * 1024 * 1024 else {
                throw ChatLocalStorageError.attachmentLimit(megabytes: 100)
            }
        }
    }

    func updateOutbox(_ message: ChatOutboxMessage, scope: String, version: Int) async throws {
        try await onQueue {
            try self.lock.withLock {
                try self.requireSession(version)
                let key = try self.prepare(scope: scope, generation: self.generation)
                let folder = self.outboxURL(message.id)
                guard FileManager.default.fileExists(atPath: folder.path) else { throw CancellationError() }
                try self.writeMessage(message, folder: folder, key: key, scope: scope)
            }
        }
    }

    func removeOutbox(_ id: String, version: Int) async {
        _ = try? await onQueue {
            try self.lock.withLock {
                try self.requireSession(version)
                try? FileManager.default.removeItem(at: self.outboxURL(id))
            }
        }
    }

    /// Decrypts one small chunk at a time directly into a protected multipart
    /// file. URLSession streams that file; neither the full attachment nor the
    /// full multipart body is reconstructed as an in-memory Data buffer.
    func uploadBody(_ message: ChatOutboxMessage, scope: String, version: Int) async throws -> ChatOutboxUpload {
        try await onQueue {
            let (key, upload) = try self.lock.withLock {
                try self.requireSession(version)
                let key = try self.prepare(scope: scope, generation: self.generation)
                let directory = self.root.appendingPathComponent("uploads", isDirectory: true)
                try Self.createProtectedDirectory(directory)
                return (key, ChatOutboxUpload(
                    url: directory.appendingPathComponent(UUID().uuidString),
                    boundary: "PantopusBoundary-\(UUID().uuidString)"
                ))
            }
            do {
                try Data().write(to: upload.url, options: .completeFileProtection)
                let output = try FileHandle(forWritingTo: upload.url)
                defer { try? output.close() }
                try self.writeUpload(message, upload: upload, output: output, key: key, scope: scope)
                try self.lock.withLock { try self.requireSession(version) }
                return upload
            } catch {
                try? FileManager.default.removeItem(at: upload.url)
                throw error
            }
        }
    }

    private func writeUpload(
        _ message: ChatOutboxMessage, upload: ChatOutboxUpload, output: FileHandle, key: SymmetricKey, scope: String
    ) throws {
        let context = UploadContext(message: message, upload: upload, output: output, key: key, scope: scope)
        var slots: [[String: Int]] = []
        var index = 0
        for attachment in message.attachments {
            var slot = ["fileIndex": index]
            try writeUploadFile(
                UploadPart(name: attachment.file, filename: attachment.filename, mime: attachment.mimeType, size: attachment.size),
                context: context
            )
            index += 1
            if let size = attachment.liveVideoSize {
                slot["liveVideoIndex"] = index
                try writeUploadFile(
                    UploadPart(name: attachment.liveVideoFile, filename: "live-\(attachment.id).mp4", mime: "video/mp4", size: size),
                    context: context
                )
                index += 1
            }
            slots.append(slot)
        }
        guard let media = try String(bytes: JSONEncoder().encode(slots), encoding: .utf8) else {
            throw ChatLocalStorageError.damagedAttachment
        }
        for (name, value) in [("client_request_id", message.id), ("media", media)] {
            try output
                .write(contentsOf: Data("--\(upload.boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n"
                        .utf8))
        }
        try output.write(contentsOf: Data("--\(upload.boundary)--\r\n".utf8))
    }

    private struct UploadPart {
        let name: String
        let filename: String
        let mime: String
        let size: Int
    }

    private struct UploadContext {
        let message: ChatOutboxMessage
        let upload: ChatOutboxUpload
        let output: FileHandle
        let key: SymmetricKey
        let scope: String
    }

    private func writeUploadFile(_ part: UploadPart, context: UploadContext) throws {
        let safeName = part.filename.replacingOccurrences(of: "\"", with: "_")
            .replacingOccurrences(of: "\r", with: "_")
            .replacingOccurrences(of: "\n", with: "_")
        let header = "--\(context.upload.boundary)\r\n"
            + "Content-Disposition: form-data; name=\"files\"; filename=\"\(safeName)\"\r\n"
            + "Content-Type: \(part.mime)\r\n\r\n"
        try context.output.write(contentsOf: Data(header.utf8))
        try Self.openChunks(
            from: outboxURL(context.message.id).appendingPathComponent(part.name),
            into: context.output,
            size: part.size,
            key: context.key,
            context: "\(context.scope)|\(context.message.id)|\(part.name)"
        )
        try context.output.write(contentsOf: Data("\r\n".utf8))
    }

    func outboxURL(_ id: String) -> URL {
        root.appendingPathComponent("outbox", isDirectory: true).appendingPathComponent(ScreenStoreDisk.hashed(id))
    }

    func writeMessage(_ message: ChatOutboxMessage, folder: URL, key: SymmetricKey, scope: String) throws {
        let bytes = try JSONEncoder().encode(message)
        let context = "\(scope)|\(ScreenStoreDisk.hashed(message.id))"
        let encrypted = try AES.GCM.seal(bytes, using: key, authenticating: Data(context.utf8))
        guard let combined = encrypted.combined else { throw ChatLocalStorageError.damagedAttachment }
        try combined.write(to: folder.appendingPathComponent("message.sealed"), options: [.atomic, .completeFileProtection])
    }

    func outboxBytes() -> Int {
        ["outbox", "drafts"].reduce(0) { total, directory in
            let files = FileManager.default.enumerator(
                at: root.appendingPathComponent(directory), includingPropertiesForKeys: [.fileSizeKey]
            )
            return total + (files?.allObjects as? [URL] ?? []).reduce(0) {
                $0 + ((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
            }
        }
    }

    static func createProtectedDirectory(_ url: URL) throws {
        try FileManager.default.createDirectory(
            at: url,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.complete]
        )
    }

    func onQueue<Value: Sendable>(_ action: @escaping @Sendable () throws -> Value) async throws -> Value {
        try await withCheckedThrowingContinuation { continuation in
            queue.async { continuation.resume(with: Result { try action() }) }
        }
    }

    static func sealChunks(_ bytes: Data, to url: URL, key: SymmetricKey, context: String) throws {
        try Data().write(to: url, options: .completeFileProtection)
        let output = try FileHandle(forWritingTo: url)
        defer { try? output.close() }
        for offset in stride(from: 0, to: bytes.count, by: chunkSize) {
            let chunk = bytes.subdata(in: offset..<min(bytes.count, offset + chunkSize))
            let sealed = try AES.GCM.seal(chunk, using: key, authenticating: Data("\(context)|\(offset / chunkSize)".utf8))
            guard let combined = sealed.combined else { throw ChatLocalStorageError.damagedAttachment }
            var length = UInt32(combined.count).littleEndian
            try output.write(contentsOf: withUnsafeBytes(of: &length) { Data($0) })
            try output.write(contentsOf: combined)
        }
    }

    static func openChunks(from url: URL, into output: FileHandle, size: Int, key: SymmetricKey, context: String) throws {
        try openChunks(from: url, size: size, key: key, context: context) { try output.write(contentsOf: $0) }
    }

    static func openChunks(from url: URL, size: Int, key: SymmetricKey, context: String, receive: (Data) throws -> Void) throws {
        let input = try FileHandle(forReadingFrom: url)
        defer { try? input.close() }
        var total = 0
        var index = 0
        while let prefix = try input.read(upToCount: 4), !prefix.isEmpty {
            guard prefix.count == 4 else { throw ChatLocalStorageError.damagedAttachment }
            let length = prefix.enumerated().reduce(0) { $0 | (Int($1.element) << ($1.offset * 8)) }
            guard length >= 28, length <= chunkSize + 28,
                  let sealed = try input.read(upToCount: length), sealed.count == length else {
                throw ChatLocalStorageError.damagedAttachment
            }
            let bytes = try AES.GCM.open(
                AES.GCM.SealedBox(combined: sealed),
                using: key,
                authenticating: Data("\(context)|\(index)".utf8)
            )
            total += bytes.count
            guard total <= size else { throw ChatLocalStorageError.damagedAttachment }
            try receive(bytes)
            index += 1
        }
        guard total == size else { throw ChatLocalStorageError.damagedAttachment }
    }
}

struct ChatOutboxUpload {
    let url: URL
    let boundary: String
}
