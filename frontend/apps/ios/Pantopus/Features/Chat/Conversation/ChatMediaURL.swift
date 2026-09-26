//
//  ChatMediaURL.swift
//  Pantopus
//
//  Resolves chat attachment URLs for native image loaders. Upload stores
//  proxy paths like `/api/chat/files/:id`; loaders need an absolute origin
//  and auth (Bearer header is not sent by AsyncImage — use ?token=).
//

import Foundation
import UniformTypeIdentifiers

enum ChatMediaURL {
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

        guard absolute.path.contains("/api/chat/files/"),
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
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("chat-files", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let target = directory.appendingPathComponent(localName(filename, mimeType: mimeType))
        try? FileManager.default.removeItem(at: target)
        try FileManager.default.moveItem(at: temporary, to: target)
        return target
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
