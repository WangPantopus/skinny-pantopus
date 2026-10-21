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

    /// Files opened from chats and copies of photos sent to the assistant go at the next launch and
    /// with the account's data (sign-out, a switch), so nothing of one person's chats stays for the next.
    static func removeLocalFiles() {
        try? FileManager.default.removeItem(at: openedFilesFolder)
        try? FileManager.default.removeItem(at: sentPhotosRoot)
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
        guard let url = resolve(raw: raw) else { throw URLError(.badURL) }
        let (temporary, response) = try await URLSession.shared.download(from: url)
        defer { try? FileManager.default.removeItem(at: temporary) }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        try FileManager.default.createDirectory(at: openedFilesFolder, withIntermediateDirectories: true)
        let target = openedFilesFolder.appendingPathComponent(localName(filename, mimeType: mimeType))
        try? FileManager.default.removeItem(at: target)
        try FileManager.default.moveItem(at: temporary, to: target)
        return target
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
