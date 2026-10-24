//
//  ChatMediaURL.swift
//  Pantopus
//
//  Resolves chat attachment URLs for native image loaders. Upload stores
//  proxy paths like `/api/chat/files/:id`; loaders need an absolute origin
//  and auth (Bearer header is not sent by AsyncImage — use ?token=).
//

import ImageIO
import UIKit
import UniformTypeIdentifiers

enum ChatMediaURL {
    /// Longest side of a sent photo's copy: its 72-pt tile at 3x, with room to crop it square.
    static let sentPhotoPixels = 384
    /// Copies of photos sent to the assistant, a folder per thread inside this one. They belong to
    /// one app process: the next launch clears whatever a run left.
    static let sentPhotosRoot = FileManager.default.temporaryDirectory.appendingPathComponent("ai-photos", isDirectory: true)
    /// Files opened from chats (QuickLook needs a file on the phone).
    static let openedFilesFolder = FileManager.default.temporaryDirectory.appendingPathComponent("chat-files", isDirectory: true)
    private static let downloadSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        return URLSession(configuration: configuration)
    }()

    static func isChatFile(_ url: URL) -> Bool {
        isSameOrigin(url, AppEnvironment.current.apiBaseURL) && url.path.hasPrefix("/api/chat/files/")
    }

    /// Files opened from chats and copies of photos sent to the assistant go at the next launch and
    /// with the account's data (sign-out, a switch), so nothing of one person's chats stays for the next.
    static func removeLocalFiles() {
        removeOpenedFiles()
        try? FileManager.default.removeItem(at: sentPhotosRoot)
    }

    static func removeOpenedFiles() {
        try? FileManager.default.removeItem(at: openedFilesFolder)
    }

    /// Turn a stored attachment URL into something `AsyncImage` can fetch.
    @MainActor
    static func resolve(
        raw: String?,
        baseURL: URL = AppEnvironment.current.apiBaseURL,
        accessToken: String? = nil
    ) -> URL? {
        let token = accessToken ?? AuthManager.shared.accessToken
        guard let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }

        let absolute: URL? = if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            URL(string: trimmed)
        } else if trimmed.hasPrefix("/") {
            URL(string: trimmed, relativeTo: baseURL)?.absoluteURL
        } else {
            URL(string: trimmed, relativeTo: baseURL)?.absoluteURL
        }
        guard let absolute else { return nil }

        // The token goes only to the API's own chat-file proxy. Message metadata
        // comes from the sender, so a link to another host that merely has this
        // path must load without it, or that host collects the viewer's token.
        guard isSameOrigin(absolute, baseURL),
              absolute.path.contains("/api/chat/files/"),
              let trimmedToken = token?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmedToken.isEmpty
        else {
            return absolute
        }

        var components = URLComponents(url: absolute, resolvingAgainstBaseURL: false)
        var items = components?.queryItems ?? []
        if !items.contains(where: { $0.name == "token" }) {
            items.append(URLQueryItem(name: "token", value: trimmedToken))
        }
        components?.queryItems = items
        return components?.url ?? absolute
    }

    /// Timeline tiles request the bounded image variant; opening or saving a
    /// file keeps its original URL. Never rewrite an external sender URL.
    @MainActor
    static func thumbnail(_ url: URL, baseURL: URL = AppEnvironment.current.apiBaseURL) -> URL {
        guard isSameOrigin(url, baseURL), url.path.hasPrefix("/api/chat/files/") else { return url }
        var parts = URLComponents(url: url, resolvingAgainstBaseURL: false)
        var items = (parts?.queryItems ?? []).filter { $0.name != "variant" }
        items.append(URLQueryItem(name: "variant", value: "thumbnail"))
        parts?.queryItems = items
        return parts?.url ?? url
    }

    struct PickedDocument {
        let filename: String
        let mimeType: String
        let data: Data
    }

    /// Called off the main actor. Refuse oversized files before reading their
    /// bytes, and bound the read too when a provider cannot report its size.
    static func readDocument(_ url: URL, isAssistant: Bool) throws -> PickedDocument {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        let values = try url.resourceValues(forKeys: [.contentTypeKey, .localizedNameKey, .fileSizeKey])
        let mime = values.contentType?.preferredMIMEType ?? "application/octet-stream"
        let filename = values.localizedName ?? url.lastPathComponent
        let data: Data
        if isAssistant {
            // The assistant keeps its existing PDF validation and limits.
            data = try Data(contentsOf: url)
        } else {
            let megabytes = mime.hasPrefix("image/") ? 10 : mime.hasPrefix("video/") ? 100 : 25
            let limit = megabytes * 1024 * 1024
            guard (values.fileSize ?? 0) <= limit else { throw ChatLocalStorageError.attachmentLimit(megabytes: megabytes) }
            let file = try FileHandle(forReadingFrom: url)
            defer { try? file.close() }
            var bytes = Data()
            while bytes.count <= limit {
                let chunk = try file.read(upToCount: min(1024 * 1024, limit + 1 - bytes.count)) ?? Data()
                if chunk.isEmpty { break }
                bytes.append(chunk)
            }
            data = bytes
            guard data.count <= limit else { throw ChatLocalStorageError.attachmentLimit(megabytes: megabytes) }
        }
        return PickedDocument(filename: filename, mimeType: mime, data: data)
    }

    /// Same scheme, host and port (a missing port is the scheme's default).
    static func isSameOrigin(_ url: URL, _ other: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased(), !host.isEmpty,
              scheme == other.scheme?.lowercased(), host == other.host?.lowercased()
        else { return false }
        return effectivePort(url) == effectivePort(other)
    }

    private static func effectivePort(_ url: URL) -> Int {
        url.port ?? (url.scheme?.lowercased() == "https" ? 443 : 80)
    }

    /// Download a chat file into the temporary directory so QuickLook can
    /// open it. The proxy redirects to a short-lived signed URL; the token
    /// rides the query as it does for photos, so no Authorization header
    /// follows the redirect to storage.
    @MainActor
    static func download(raw: String, filename: String, mimeType: String?) async throws -> URL {
        let session = AuthManager.shared.requestSessionGeneration
        let version = ChatLocalStore.shared.version
        guard let url = resolve(raw: raw) else { throw URLError(.badURL) }
        let scope: String? = if isChatFile(url), case let .signedIn(user) = AuthManager.shared.state {
            ChatLocalStore.scope(server: AppEnvironment.current.apiBaseURL.absoluteString, account: user.id)
        } else { nil }
        let key = PantopusImagePipeline.cacheKey(for: url)
        if let scope, let bytes = await ChatLocalStore.shared.media(scope: scope, key: key, version: version) {
            try requireMediaSession(session, version: version)
            let target = try openedFile(filename, mimeType: mimeType)
            try bytes.write(to: target, options: [.atomic, .completeFileProtection])
            return target
        }
        let (temporary, response) = try await downloadSession.download(from: url)
        defer { try? FileManager.default.removeItem(at: temporary) }
        // Sign-out clears opened files while a download may still be in flight.
        // Its late response must not recreate the previous account's bytes.
        try requireMediaSession(session, version: version)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        if let scope, let bytes = await boundedMediaBytes(temporary) {
            await ChatLocalStore.shared.saveMedia(bytes, scope: scope, key: key, version: version)
        }
        try requireMediaSession(session, version: version)
        let target = try openedFile(filename, mimeType: mimeType)
        try FileManager.default.moveItem(at: temporary, to: target)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: target.path)
        return target
    }

    @MainActor
    static func imageData(_ url: URL) async -> Data? {
        try? await openedData(url, limit: ChatLocalStore.mediaFileLimit)
    }

    @MainActor
    static func openedData(_ url: URL, limit: Int) async throws -> Data {
        let session = AuthManager.shared.requestSessionGeneration
        let version = ChatLocalStore.shared.version
        let file = try await download(raw: url.absoluteString, filename: "attachment", mimeType: nil)
        defer { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        guard let bytes = await boundedMediaBytes(file, limit: limit) else { throw URLError(.dataLengthExceedsMaximum) }
        try requireMediaSession(session, version: version)
        return bytes
    }

    private static func boundedMediaBytes(_ url: URL, limit: Int = ChatLocalStore.mediaFileLimit) async -> Data? {
        await Task.detached(priority: .utility) {
            guard let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize,
                  size <= limit else { return nil }
            return try? Data(contentsOf: url)
        }.value
    }

    @MainActor
    private static func requireMediaSession(_ session: Int, version: Int) throws {
        try AuthManager.shared.requireRequestSession(session)
        guard ChatLocalStore.shared.version == version else { throw CancellationError() }
    }

    private static func openedFile(_ filename: String, mimeType: String?) throws -> URL {
        let folder = openedFilesFolder.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try ChatLocalStore.createProtectedDirectory(folder)
        return folder.appendingPathComponent(localName(filename, mimeType: mimeType))
    }

    /// A small copy of a photo sent to the assistant, for its bubble: the server deletes the
    /// photo once it has read it. The bytes as they are when they can't be shrunk; nil when
    /// the copy can't be written.
    static func sentPhotoCopy(of data: Data, in folder: URL) -> URL? {
        let small = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary)
            .flatMap { source in
                CGImageSourceCreateThumbnailAtIndex(source, 0, [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                    kCGImageSourceThumbnailMaxPixelSize: sentPhotoPixels
                ] as CFDictionary)
            }
            .flatMap { UIImage(cgImage: $0).jpegData(compressionQuality: 0.8) }
        let file = folder.appendingPathComponent("\(UUID().uuidString).jpg")
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try (small ?? data).write(to: file, options: [.atomic, .completeFileProtection])
            return file
        } catch {
            return nil
        }
    }

    /// The sender's filename, reduced to its last path component, with an
    /// extension from the MIME type when it has none (QuickLook picks the
    /// previewer by extension).
    private static func localName(_ filename: String, mimeType: String?) -> String {
        let last = (filename as NSString).lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = ["", ".", "..", "/"].contains(last) ? "attachment" : last
        guard (name as NSString).pathExtension.isEmpty,
              let ext = mimeType.flatMap({ UTType(mimeType: $0)?.preferredFilenameExtension })
        else { return name }
        return "\(name).\(ext)"
    }
}
