//
//  LinkPreviewStore.swift
//  Pantopus
//
//  A15.2 `.link-bubble` — in-memory Open Graph metadata cache for chat
//  link-preview cards. Fetches the first ~120KB of an http(s) page,
//  regex-parses `og:title` / `og:description` / `og:image` with a
//  `<title>` fallback, and caches results (including negative results)
//  by URL, capped at ~50 entries. No third-party dependencies; views
//  observe per-URL state via the published `entries` dictionary.
//

import Foundation
import Observation

/// Parsed Open Graph metadata for one URL. A card is only rendered
/// when at least a `title` resolved.
struct LinkPreviewMetadata: Equatable {
    let url: URL
    let host: String
    let title: String
    let description: String?
    let imageURL: URL?
}

@MainActor
@Observable
final class LinkPreviewStore {
    static let shared = LinkPreviewStore()

    enum Entry: Equatable {
        /// Metadata resolved — render the card.
        case loaded(LinkPreviewMetadata)
        /// Fetch or parse failed — cached so we never retry; no card.
        case unavailable
    }

    /// Per-URL terminal state. Views read `entries[url]` and re-render
    /// when the fetch lands. In-flight URLs have no entry yet.
    private(set) var entries: [String: Entry] = [:]

    private var inFlight: Set<String> = []
    /// FIFO insertion order backing the ~50-entry cache cap.
    private var insertionOrder: [String] = []
    private static let maxEntries = 50
    private static let maxBytes = 120 * 1024

    private let session: URLSession

    init(session: URLSession? = nil) {
        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.ephemeral
            config.timeoutIntervalForRequest = 5
            config.timeoutIntervalForResource = 5
            self.session = URLSession(configuration: config)
        }
    }

    func metadata(for url: URL) -> LinkPreviewMetadata? {
        if case let .loaded(meta) = entries[url.absoluteString] { return meta }
        return nil
    }

    /// Idempotent — no-ops when the URL is cached (positively or
    /// negatively) or already in flight. http/https only.
    func fetchIfNeeded(_ url: URL) async {
        let key = url.absoluteString
        guard entries[key] == nil, !inFlight.contains(key) else { return }
        guard let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else { return }
        inFlight.insert(key)
        defer { inFlight.remove(key) }

        var entry = Entry.unavailable
        do {
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.timeoutInterval = 5
            let (bytes, response) = try await session.bytes(for: request)
            if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                // Read at most ~120KB — og: tags live in <head>.
                var data = Data()
                data.reserveCapacity(Self.maxBytes)
                for try await byte in bytes {
                    data.append(byte)
                    if data.count >= Self.maxBytes { break }
                }
                // Lossy UTF-8 decode by design — malformed bytes shouldn't
                // abort og: parsing, so keep the non-failable initializer.
                // swiftlint:disable:next optional_data_string_conversion
                let html = String(decoding: data, as: UTF8.self)
                if let meta = Self.parse(html: html, url: url) {
                    entry = .loaded(meta)
                }
            }
        } catch {
            // Negative-cached below — never retried this session.
        }
        store(entry, for: key)
    }

    private func store(_ entry: Entry, for key: String) {
        if entries[key] == nil {
            insertionOrder.append(key)
            if insertionOrder.count > Self.maxEntries {
                let evicted = insertionOrder.removeFirst()
                entries[evicted] = nil
            }
        }
        entries[key] = entry
    }

    // MARK: - Parsing

    /// `og:title` / `og:description` / `og:image` with `<title>`
    /// fallback. Returns nil when no title resolves — the caller
    /// negative-caches and renders no card.
    static func parse(html: String, url: URL) -> LinkPreviewMetadata? {
        let title = metaContent(in: html, property: "og:title") ?? htmlTitle(in: html)
        guard let title, !title.isEmpty else { return nil }
        let description = metaContent(in: html, property: "og:description")
        let imageURL = metaContent(in: html, property: "og:image")
            .flatMap { URL(string: $0, relativeTo: url)?.absoluteURL }
            .flatMap { ["http", "https"].contains($0.scheme?.lowercased() ?? "") ? $0 : nil }
        return LinkPreviewMetadata(
            url: url,
            host: url.host?.replacingOccurrences(of: "www.", with: "") ?? url.absoluteString,
            title: title,
            description: description.flatMap { $0.isEmpty ? nil : $0 },
            imageURL: imageURL
        )
    }

    /// `<meta property="og:x" content="…">` in either attribute order.
    private static func metaContent(in html: String, property: String) -> String? {
        let escaped = NSRegularExpression.escapedPattern(for: property)
        let patterns = [
            "<meta[^>]+(?:property|name)\\s*=\\s*[\"']\(escaped)[\"'][^>]*?content\\s*=\\s*[\"']([^\"']*)[\"']",
            "<meta[^>]+content\\s*=\\s*[\"']([^\"']*)[\"'][^>]*?(?:property|name)\\s*=\\s*[\"']\(escaped)[\"']"
        ]
        for pattern in patterns {
            if let value = firstCapture(pattern, in: html), !value.isEmpty {
                return decodeEntities(value)
            }
        }
        return nil
    }

    private static func htmlTitle(in html: String) -> String? {
        firstCapture("<title[^>]*>([^<]*)</title>", in: html)
            .map(decodeEntities)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func firstCapture(_ pattern: String, in html: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive, .dotMatchesLineSeparators]) else {
            return nil
        }
        let range = NSRange(html.startIndex..., in: html)
        guard let match = regex.firstMatch(in: html, range: range),
              match.numberOfRanges > 1,
              let captureRange = Range(match.range(at: 1), in: html) else { return nil }
        return String(html[captureRange])
    }

    /// Minimal HTML-entity decoding — the handful that show up in
    /// og: content in practice.
    private static func decodeEntities(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
            .replacingOccurrences(of: "&#x27;", with: "'")
            .replacingOccurrences(of: "&apos;", with: "'")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&nbsp;", with: " ")
    }
}

/// View-layer URL detection for plain text bubble bodies — kept out of
/// the projection layer on purpose (A15.2).
enum ChatLinkDetection {
    private static let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)

    /// All http(s) link matches in `text`, in order.
    static func linkMatches(in text: String) -> [(range: Range<String.Index>, url: URL)] {
        guard let detector, !text.isEmpty else { return [] }
        let nsRange = NSRange(text.startIndex..., in: text)
        return detector.matches(in: text, range: nsRange).compactMap { match in
            guard let url = match.url,
                  let scheme = url.scheme?.lowercased(),
                  scheme == "http" || scheme == "https",
                  let range = Range(match.range, in: text) else { return nil }
            return (range, url)
        }
    }

    /// First http(s) URL in `text` — drives the single preview card.
    static func firstURL(in text: String) -> URL? {
        linkMatches(in: text).first?.url
    }
}
