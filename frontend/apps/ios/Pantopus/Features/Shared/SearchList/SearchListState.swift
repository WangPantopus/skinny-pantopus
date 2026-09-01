//
//  SearchListState.swift
//  Pantopus
//
//  P4.1 — Payload + persistence types for the SearchListShell scaffold.
//  The shell itself is decoupled from any specific data source; this
//  file carries the small support types every caller needs.
//

import Foundation

/// Empty-state payload for `SearchListShell`. Mirrors the `EmptyState`
/// component's props (icon + headline + subcopy). No CTA — the
/// canonical empty-search outcome is "no results for this query",
/// which the user resolves by changing the query, not by tapping a
/// button.
public struct EmptyStateContent: Sendable, Hashable {
    public let icon: PantopusIcon
    public let headline: String
    public let subcopy: String

    public init(icon: PantopusIcon, headline: String, subcopy: String) {
        self.icon = icon
        self.headline = headline
        self.subcopy = subcopy
    }
}

/// `UserDefaults`-backed move-to-front recents store. One instance per
/// search surface — pass the `userDefaultsKey` that scopes the queries
/// (e.g. `search.connections.recent`).
///
/// The `SearchListShell` does not call this directly — callers wire it
/// in so the shell stays decoupled from any persistence layer. The
/// canonical wiring is:
///
///   1. ViewModel owns the store + a `recentQueries: [String]` field.
///   2. ViewModel calls `store.load()` in `init` to seed the field.
///   3. On a successful search submit, ViewModel calls `store.record(q)`.
///   4. The shell renders `recentQueries` and routes `onRecentTap`
///      back into the ViewModel to re-issue the query.
public final class RecentQueriesStore: @unchecked Sendable {
    private let key: String
    private let limit: Int
    private let defaults: UserDefaults

    public init(
        userDefaultsKey: String,
        limit: Int = 6,
        defaults: UserDefaults = .standard
    ) {
        key = userDefaultsKey
        self.limit = limit
        self.defaults = defaults
    }

    /// Returns the persisted queries, most-recent first.
    public func load() -> [String] {
        defaults.stringArray(forKey: key) ?? []
    }

    /// Record the latest query — case-insensitive move-to-front, trim
    /// whitespace, drop empties, cap at `limit`.
    public func record(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        var current = load()
        current.removeAll { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
        current.insert(trimmed, at: 0)
        if current.count > limit {
            current = Array(current.prefix(limit))
        }
        defaults.set(current, forKey: key)
    }

    /// Wipe the persisted queries — wired to "Clear recent searches" CTAs.
    public func clear() {
        defaults.removeObject(forKey: key)
    }
}
