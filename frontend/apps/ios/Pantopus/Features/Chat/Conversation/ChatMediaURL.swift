//
//  ChatMediaURL.swift
//  Pantopus
//
//  Resolves chat attachment URLs for native image loaders. Upload stores
//  proxy paths like `/api/chat/files/:id`; loaders need an absolute origin
//  and auth (Bearer header is not sent by AsyncImage — use ?token=).
//

import Foundation

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
}
