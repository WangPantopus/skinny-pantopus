//
//  GigSearchViewModel.swift
//  Pantopus
//
//  Backs the Gig Search surface (P4.4). Debounces the query 250ms, then
//  hits `GET /api/gigs?search=&category=` — the backend does a
//  case-insensitive substring match on title + body. Category chips
//  narrow the same query. Rows are projected via
//  `GigsFeedViewModel.project` so search results render identically to
//  the feed.
//

import Foundation
import Observation

/// Render state for the Gig Search surface. `idle` (empty query) maps to
/// the shell's "recent" phase; `loading` to the typing-shimmer; `empty`
/// and `error` both surface through the shell's empty phase with
/// different copy (the shell has no separate error slot — the user
/// recovers by changing the query, per its design).
public enum GigSearchState: Sendable {
    case idle
    case loading
    case loaded([GigCardContent])
    case empty
    case error(message: String)
}

/// Gig Search view-model.
@Observable
@MainActor
public final class GigSearchViewModel {
    /// Current render state.
    public private(set) var state: GigSearchState = .idle

    /// Live search text — bound to the shell's field.
    public var query: String = ""

    /// Active category chip. `all` is the no-filter sentinel.
    public private(set) var activeCategory: GigsCategory = .all

    private let api: APIClient
    private let latitude: Double?
    private let longitude: Double?
    private let radiusMiles: Double?
    private var searchTask: Task<Void, Never>?

    init(
        api: APIClient = .shared,
        latitude: Double? = nil,
        longitude: Double? = nil,
        radiusMiles: Double? = nil
    ) {
        self.api = api
        self.latitude = latitude
        self.longitude = longitude
        self.radiusMiles = radiusMiles
    }

    // MARK: - Shell projections

    /// Drives the shell's typing-shimmer.
    public var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    /// Rows handed to the shell's results phase.
    public var results: [GigCardContent] {
        if case let .loaded(rows) = state { return rows }
        return []
    }

    /// Empty-phase payload — error copy when the last fetch failed,
    /// otherwise the no-matches copy.
    public var emptyStateContent: EmptyStateContent {
        if case let .error(message) = state {
            return EmptyStateContent(
                icon: .alertCircle,
                headline: "Couldn't search",
                subcopy: message
            )
        }
        return EmptyStateContent(
            icon: .search,
            headline: "No matches",
            subcopy: "Try a different keyword or category."
        )
    }

    // MARK: - Intent

    /// Debounced search kicked on every query keystroke. An empty query
    /// returns to `idle` (recent phase) and cancels any in-flight fetch.
    public func scheduleSearch() {
        searchTask?.cancel()
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            state = .idle
            return
        }
        state = .loading
        searchTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await self?.search()
        }
    }

    /// Chip tap. Re-issues the search immediately when there's an active
    /// query; otherwise just records the filter for the next keystroke.
    public func selectCategory(_ category: GigsCategory) async {
        guard category != activeCategory else { return }
        searchTask?.cancel()
        activeCategory = category
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        await search()
    }

    /// Immediate (non-debounced) fetch for the current query + category.
    /// The view drives the debounced `scheduleSearch()`; this is the seam
    /// tests exercise directly.
    public func search() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            state = .idle
            return
        }
        state = .loading
        do {
            let response: GigsListResponse = try await api.request(
                GigsEndpoints.list(
                    category: activeCategory.rawValue,
                    latitude: latitude,
                    longitude: longitude,
                    radiusMiles: radiusMiles,
                    search: trimmed,
                    limit: 20
                )
            )
            if response.gigs.isEmpty {
                state = .empty
            } else {
                state = .loaded(response.gigs.map(GigsFeedViewModel.project))
            }
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't search gigs."
            state = .error(message: message)
        }
    }
}
