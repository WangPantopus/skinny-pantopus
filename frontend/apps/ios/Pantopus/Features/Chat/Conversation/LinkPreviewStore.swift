//
//  LinkPreviewStore.swift
//  Pantopus
//
//  A15.2 `.link-bubble` — in-memory cache of chat link previews. The
//  server reads each page (`GET /api/link-preview`) and answers with its
//  title, description and site name, so this device never contacts the
//  linked host and whoever controls a link can't learn recipients' IP
//  addresses. Results, including links the server can't preview, are
//  cached by URL, capped at ~50 entries; views observe per-URL state via
//  the published `entries` dictionary.
//

import Foundation
import Observation
import os

/// One link's preview text. A card is only rendered when a title or a
/// description resolved.
struct LinkPreviewMetadata: Equatable {
    let url: URL
    /// The page's site name, else the link's host without `www.`.
    let site: String
    let title: String?
    let description: String?
}

@MainActor
@Observable
final class LinkPreviewStore {
    static let shared = LinkPreviewStore()

    enum Entry: Equatable {
        /// Metadata resolved — render the card.
        case loaded(LinkPreviewMetadata)
        /// The server can't preview the link (blocked, or not a web page)
        /// or found nothing to show — cached so we never ask again; no card.
        case unavailable
    }

    /// Per-URL terminal state. Views read `entries[url]` and re-render
    /// when the request lands. In-flight URLs, and URLs whose last request
    /// failed for a passing reason, have no entry.
    private(set) var entries: [String: Entry] = [:]

    /// One request per URL, shared by every bubble that shows the link.
    private var inFlight: Set<String> = []
    /// FIFO insertion order backing the ~50-entry cache cap.
    private var insertionOrder: [String] = []
    /// Bumped by `clear()` so a request started for the previous account
    /// doesn't land in the next one's cache.
    private var generation = 0
    private static let maxEntries = 50

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    func metadata(for url: URL) -> LinkPreviewMetadata? {
        if case let .loaded(meta) = entries[url.absoluteString] { return meta }
        return nil
    }

    /// Idempotent — no-ops when the URL is cached or already in flight.
    /// http/https only.
    func fetchIfNeeded(_ url: URL) async {
        let key = url.absoluteString
        guard entries[key] == nil, !inFlight.contains(key) else { return }
        guard let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else { return }
        inFlight.insert(key)
        let startedIn = generation
        defer { if generation == startedIn { inFlight.remove(key) } }
        // Its own task: the bubble that asked scrolling away must not cancel
        // the request other bubbles showing the same link are waiting on.
        let entry = await Task { await load(url) }.value
        guard generation == startedIn, let entry else { return }
        store(entry, for: key)
    }

    /// Sign-out: previews of the links in the last account's chats go with it.
    func clear() {
        generation += 1
        entries.removeAll()
        inFlight.removeAll()
        insertionOrder.removeAll()
    }

    /// `nil` when the answer may change: the server busy (429) or in
    /// trouble (5xx), the device offline, or the session ending. Nothing is
    /// cached then, so the link's next appearance asks again.
    private func load(_ url: URL) async -> Entry? {
        do {
            let preview: LinkPreviewDTO = try await client.request(LinkPreviewEndpoints.preview(url: url.absoluteString))
            return Self.metadata(from: preview, url: url).map(Entry.loaded) ?? .unavailable
        } catch let APIError.clientError(status, _) where status == 400 || status == 422 {
            // An invalid or blocked link (400), or not a web page (422).
            return .unavailable
        } catch {
            return nil
        }
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

    /// Text only — the server never offers the page's image. Returns nil
    /// when neither a title nor a description resolved; the caller caches
    /// that and renders no card.
    static func metadata(from preview: LinkPreviewDTO, url: URL) -> LinkPreviewMetadata? {
        let title = nonEmpty(preview.title)
        let description = nonEmpty(preview.description)
        guard title != nil || description != nil else { return nil }
        let host = url.host.map { $0.hasPrefix("www.") ? String($0.dropFirst(4)) : $0 } ?? url.absoluteString
        return LinkPreviewMetadata(
            url: url,
            site: nonEmpty(preview.siteName) ?? host,
            title: title,
            description: description
        )
    }

    private static func nonEmpty(_ text: String?) -> String? {
        guard let text = text?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
        return text
    }
}

/// View-layer URL detection for plain text bubble bodies — kept out of
/// the projection layer on purpose (A15.2).
enum ChatLinkDetection {
    private static let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
    /// A bubble asks up to three times per render and renders often, and
    /// running the detector is its costliest step. Recent texts keep their
    /// matches as UTF-16 ranges, rebuilt for the string that asks.
    private static let recentMatches = OSAllocatedUnfairLock(initialState: [String: [LinkMatch]]())
    private static let recentLimit = 512

    private struct LinkMatch {
        let range: NSRange
        let url: URL
    }

    /// All http(s) link matches in `text`, in order.
    static func linkMatches(in text: String) -> [(range: Range<String.Index>, url: URL)] {
        guard let detector, !text.isEmpty else { return [] }
        let found: [LinkMatch]
        if let cached = recentMatches.withLock({ $0[text] }) {
            found = cached
        } else {
            let nsRange = NSRange(text.startIndex..., in: text)
            found = detector.matches(in: text, range: nsRange).compactMap { match in
                guard let url = match.url,
                      let scheme = url.scheme?.lowercased(),
                      scheme == "http" || scheme == "https" else { return nil }
                return LinkMatch(range: match.range, url: url)
            }
            recentMatches.withLock { recent in
                if recent.count >= recentLimit { recent.removeAll(keepingCapacity: true) }
                recent[text] = found
            }
        }
        return found.compactMap { match in
            Range(match.range, in: text).map { ($0, match.url) }
        }
    }

    /// First http(s) URL in `text` — drives the single preview card.
    static func firstURL(in text: String) -> URL? {
        linkMatches(in: text).first?.url
    }
}
