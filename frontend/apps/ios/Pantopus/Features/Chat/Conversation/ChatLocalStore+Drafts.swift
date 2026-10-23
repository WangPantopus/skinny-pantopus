import CryptoKit
import Darwin
import Foundation

extension ChatLocalStore {
    /// Reserve before scheduling an async save. Older writers cannot overwrite
    /// a later composer snapshot or recreate a draft already handed to outbox.
    func reserveDraft(_ id: String) -> UUID {
        lock.withLock {
            let reservation = UUID()
            draftReservations[id] = reservation
            return reservation
        }
    }

    func saveDraft(
        _ draft: ChatComposerDraft, attachments: [ChatQueuedAttachment], reservation: UUID, scope: String, version: Int
    ) async throws {
        try Self.validateAttachmentSizes(attachments)
        try await onQueue {
            let key = try self.lock.withLock {
                try self.requireDraft(draft.id, reservation: reservation, version: version)
                return try self.prepare(scope: scope, generation: self.generation)
            }
            let folder = self.draftURL(draft.id)
            defer { self.removeDraftAfterAccountChange(folder, version: version) }
            if !draft.isEmpty {
                try self.writeDraftAttachments(draft, attachments: attachments, folder: folder, scope: scope, key: key)
            }
            try self.lock.withLock {
                try self.requireDraft(draft.id, reservation: reservation, version: version)
                if draft.isEmpty {
                    try? FileManager.default.removeItem(at: folder)
                } else {
                    try self.writeDraft(draft, folder: folder, scope: scope, key: key)
                    self.trimDraftAttachments(draft, folder: folder)
                }
            }
        }
    }

    func loadDraft(scope: String, thread: String, version: Int) async throws -> (ChatComposerDraft, [ChatQueuedAttachment])? {
        try await onQueue {
            let key = try self.lock.withLock {
                try self.requireSession(version)
                return try self.prepare(scope: scope, generation: self.generation)
            }
            let drafts = try self.draftFolders().compactMap { folder -> ChatComposerDraft? in
                guard FileManager.default.fileExists(atPath: folder.appendingPathComponent("draft.sealed").path) else { return nil }
                // ChatOutbox awaits startup recovery before calling this. A Send
                // that hit a later filesystem failure stays consumed until restart.
                guard !FileManager.default.fileExists(atPath: folder.appendingPathComponent("message.sealed").path) else { return nil }
                return try self.readDraft(folder: folder, scope: scope, key: key)
            }
            guard let draft = drafts.filter({ $0.threadKey == thread }).max(by: { $0.updatedAt < $1.updatedAt }) else { return nil }
            let folder = self.draftURL(draft.id)
            let attachments = try draft.attachments.map { saved -> ChatQueuedAttachment in
                var bytes = Data()
                try Self.openChunks(
                    from: folder.appendingPathComponent(saved.file),
                    size: saved.size,
                    key: key,
                    context: "\(scope)|\(draft.id)|\(saved.file)"
                ) { bytes.append($0) }
                var video: Data?
                if let size = saved.liveVideoSize {
                    var restored = Data()
                    try Self.openChunks(
                        from: folder.appendingPathComponent(saved.liveVideoFile),
                        size: size,
                        key: key,
                        context: "\(scope)|\(draft.id)|\(saved.liveVideoFile)"
                    ) { restored.append($0) }
                    video = restored
                }
                return ChatQueuedAttachment(
                    id: saved.id,
                    kind: saved.isImage ? .image : .document,
                    filename: saved.filename,
                    mimeType: saved.mimeType,
                    data: bytes,
                    liveVideo: video
                )
            }
            try self.lock.withLock { try self.requireSession(version) }
            return (draft, attachments)
        }
    }

    func promoteDraft(
        _ draft: ChatComposerDraft, message: ChatOutboxMessage, attachments: [ChatQueuedAttachment], scope: String, version: Int
    ) async throws {
        guard draft.id == message.id, draft.threadKey == message.threadKey else { throw ChatLocalStorageError.unavailable }
        // Late save tasks from the consumed composer must never recreate it,
        // even if a socket acknowledges and deletes the outbox immediately.
        _ = lock.withLock { consumedDraftIds.insert(draft.id) }
        try await onQueue {
            let key = try self.lock.withLock {
                try self.requireSession(version)
                return try self.prepare(scope: scope, generation: self.generation)
            }
            let folder = self.draftURL(draft.id)
            defer { self.removeDraftAfterAccountChange(folder, version: version) }
            let draftCost = try self.draftWriteCost(draft, attachments: attachments, folder: folder, scope: scope, key: key)
            let intentCost = try JSONEncoder().encode(message).count + 28
            guard self.outboxBytes() + draftCost + intentCost < Self.outboxLimit else { throw ChatLocalStorageError.quota }
            try self.writeDraftAttachments(draft, attachments: attachments, folder: folder, scope: scope, key: key)
            try self.lock.withLock {
                try self.requireSession(version)
                try self.writeDraft(draft, folder: folder, scope: scope, key: key, pruneSuperseded: false)
                self.trimDraftAttachments(draft, folder: folder)
                // This authenticated manifest is the durable Send intent. If
                // killed before rename, startup completes the same promotion.
                try self.writeMessage(message, folder: folder, key: key, scope: scope)
                try Self.createProtectedDirectory(self.root.appendingPathComponent("outbox"))
                try FileManager.default.moveItem(at: folder, to: self.outboxURL(message.id))
            }
        }
    }

    /// Called on the storage queue under the account lock, before workers or
    /// composers receive any state. No network request starts before this ends.
    func recoverDraftPromotions(scope: String, key: SymmetricKey) throws {
        for folder in draftFolders() {
            let intent = folder.appendingPathComponent("message.sealed")
            guard FileManager.default.fileExists(atPath: intent.path) else { continue }
            let bytes = try AES.GCM.open(
                AES.GCM.SealedBox(combined: Data(contentsOf: intent)),
                using: key,
                authenticating: Data("\(scope)|\(folder.lastPathComponent)".utf8)
            )
            let message = try JSONDecoder().decode(ChatOutboxMessage.self, from: bytes)
            guard ScreenStoreDisk.hashed(message.id) == folder.lastPathComponent else { throw ChatLocalStorageError.unavailable }
            try Self.createProtectedDirectory(root.appendingPathComponent("outbox"))
            try FileManager.default.moveItem(at: folder, to: outboxURL(message.id))
            consumedDraftIds.insert(message.id)
        }
    }

    private func removeDraftAfterAccountChange(_ folder: URL, version: Int) {
        lock.withLock {
            do { try requireSession(version) } catch { try? FileManager.default.removeItem(at: folder) }
        }
    }

    private func requireDraft(_ id: String, reservation: UUID, version: Int) throws {
        try requireSession(version)
        guard draftReservations[id] == reservation, !consumedDraftIds.contains(id) else { throw CancellationError() }
    }

    private func draftURL(_ id: String) -> URL {
        root.appendingPathComponent("drafts", isDirectory: true).appendingPathComponent(ScreenStoreDisk.hashed(id))
    }

    private func draftFolders() -> [URL] {
        (try? FileManager.default.contentsOfDirectory(at: root.appendingPathComponent("drafts"), includingPropertiesForKeys: nil)) ?? []
    }

    private func readDraft(folder: URL, scope: String, key: SymmetricKey) throws -> ChatComposerDraft {
        let sealed = try Data(contentsOf: folder.appendingPathComponent("draft.sealed"))
        let bytes = try AES.GCM.open(
            AES.GCM.SealedBox(combined: sealed),
            using: key,
            authenticating: Data("\(scope)|draft|\(folder.lastPathComponent)".utf8)
        )
        return try JSONDecoder().decode(ChatComposerDraft.self, from: bytes)
    }

    private func writeDraft(
        _ draft: ChatComposerDraft,
        folder: URL,
        scope: String,
        key: SymmetricKey,
        pruneSuperseded: Bool = true
    ) throws {
        let superseded = try draftFolders().filter { $0 != folder }.compactMap { other -> URL? in
            guard pruneSuperseded,
                  FileManager.default.fileExists(atPath: other.appendingPathComponent("draft.sealed").path),
                  !FileManager.default.fileExists(atPath: other.appendingPathComponent("message.sealed").path) else { return nil }
            let saved = try readDraft(folder: other, scope: scope, key: key)
            guard saved.threadKey == draft.threadKey else { return nil }
            guard saved.updatedAt <= draft.updatedAt else { throw CancellationError() }
            return other
        }
        let bytes = try JSONEncoder().encode(draft)
        let encrypted = try AES.GCM.seal(
            bytes,
            using: key,
            authenticating: Data("\(scope)|draft|\(folder.lastPathComponent)".utf8)
        )
        guard let combined = encrypted.combined else { throw ChatLocalStorageError.unavailable }
        try combined.write(to: folder.appendingPathComponent("draft.sealed"), options: [.atomic, .completeFileProtection])
        for old in superseded {
            try? FileManager.default.removeItem(at: old)
        }
    }

    private func writeDraftAttachments(
        _ draft: ChatComposerDraft, attachments: [ChatQueuedAttachment], folder: URL, scope: String, key: SymmetricKey
    ) throws {
        let existing = (try? readDraft(folder: folder, scope: scope, key: key))?.attachments ?? []
        let added = attachments.filter { !existing.contains(ChatOutboxAttachment($0)) }
        // Attachment identities are immutable. A conflicting replacement must
        // never destroy bytes referenced by the previous valid draft manifest.
        guard !added.contains(where: { item in existing.contains(where: { $0.id == item.id }) }) else {
            throw ChatLocalStorageError.damagedAttachment
        }
        let cost = try draftWriteCost(draft, attachments: attachments, folder: folder, scope: scope, key: key)
        guard outboxBytes() + cost < Self.outboxLimit else { throw ChatLocalStorageError.quota }
        try Self.createProtectedDirectory(folder)
        for attachment in added {
            guard let bytes = attachment.data else { continue }
            let saved = ChatOutboxAttachment(attachment)
            try writeDraftChunk(bytes, name: saved.file, folder: folder, context: "\(scope)|\(draft.id)|\(saved.file)", key: key)
            if let video = attachment.liveVideo {
                try writeDraftChunk(
                    video,
                    name: saved.liveVideoFile,
                    folder: folder,
                    context: "\(scope)|\(draft.id)|\(saved.liveVideoFile)",
                    key: key
                )
            }
        }
    }

    private func draftWriteCost(
        _ draft: ChatComposerDraft, attachments: [ChatQueuedAttachment], folder: URL, scope: String, key: SymmetricKey
    ) throws -> Int {
        let existing = (try? readDraft(folder: folder, scope: scope, key: key))?.attachments ?? []
        let added = attachments.filter { !existing.contains(ChatOutboxAttachment($0)) }
        let chunks = added.reduce(0) { total, attachment in
            total + [attachment.data, attachment.liveVideo].compactMap { $0 }.reduce(0) { size, bytes in
                size + bytes.count + ((bytes.count + Self.chunkSize - 1) / Self.chunkSize) * 32
            }
        }
        // AES nonce/tag and every per-chunk length prefix count against quota.
        return try chunks + JSONEncoder().encode(draft).count + 28
    }

    private func writeDraftChunk(
        _ bytes: Data,
        name: String,
        folder: URL,
        context: String,
        key: SymmetricKey
    ) throws {
        let temporary = folder.appendingPathComponent(".\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: temporary) }
        try Self.sealChunks(bytes, to: temporary, key: key, context: context)
        let destination = folder.appendingPathComponent(name)
        guard Darwin.rename(temporary.path, destination.path) == 0 else {
            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
        }
    }

    private func trimDraftAttachments(_ draft: ChatComposerDraft, folder: URL) {
        let keep = Set(draft.attachments.flatMap { [$0.file, $0.liveVideoFile] } + ["draft.sealed", "message.sealed"])
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        for file in files where !keep.contains(file.lastPathComponent) {
            try? FileManager.default.removeItem(at: file)
        }
    }
}
